"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Camera,
  CameraOff,
  Crosshair,
  FlipHorizontal2,
  FlipVertical2,
  Sparkles,
  Hand,
  Zap,
} from "lucide-react";
import type { HandSide, YamahaModelId } from "@/types/music";
import type { TargetKeyHint } from "../piano/yamaha-keyboard";
import { computeKeyboardLayout } from "@/lib/music/keyboard-layout";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import { midiToName } from "@/lib/music/theory";
import {
  AirTriggerTracker,
  assessHandPosture,
  buildSimulatedHands,
  defaultCalibration,
  evaluateFingeringFromHands,
  FINGERTIP_LANDMARKS,
  HAND_SKELETON_EDGES,
  type AirTapEvent,
  type DetectedHandFrame,
  type FingeringCheckResult,
  type KeyboardCalibration,
  type PostureAssessment,
} from "@/lib/vision/hand-posture";
import { useI18n } from "@/lib/i18n";

export interface CamNotePlayedDetail {
  midi: number;
  expectedHand?: HandSide;
  expectedFinger?: 1 | 2 | 3 | 4 | 5;
}

export function emitCamNotePlayed(detail: CamNotePlayedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CamNotePlayedDetail>("yamaha1100:cam-note", { detail }));
}

interface CamTutorPanelProps {
  model: YamahaModelId;
  targetHints: TargetKeyHint[];
  activeNotes: Set<number>;
  onAirNoteOn?: (midi: number, velocity?: number) => void;
  onAirNoteOff?: (midi: number) => void;
  initialAirTrigger?: boolean;
  mobileImmersive?: boolean;
}

const CAL_STORAGE_PREFIX = "yamaha1100:cam-cal:";
const CAL_CHANGE_EVENT = "yamaha1100:cam-cal-change";

const calCache = new Map<string, { raw: string | null; value: KeyboardCalibration }>();

function subscribeCal(cb: () => void) {
  window.addEventListener(CAL_CHANGE_EVENT, cb);
  return () => window.removeEventListener(CAL_CHANGE_EVENT, cb);
}

function getCalibrationSnapshot(model: YamahaModelId): KeyboardCalibration {
  if (typeof window === "undefined") return defaultCalibration(model);
  const key = `${CAL_STORAGE_PREFIX}${model}`;
  const raw = window.localStorage.getItem(key);
  const cached = calCache.get(key);
  if (cached && cached.raw === raw) return cached.value;

  let value = defaultCalibration(model);
  if (raw) {
    try {
      value = JSON.parse(raw) as KeyboardCalibration;
    } catch {
      value = defaultCalibration(model);
    }
  }
  calCache.set(key, { raw, value });
  return value;
}

const SERVER_FALLBACK_CAL: Record<YamahaModelId, KeyboardCalibration> = {
  kbp1100: defaultCalibration("kbp1100"),
  psr1100: defaultCalibration("psr1100"),
  pxs1100: defaultCalibration("pxs1100"),
  wk1100: defaultCalibration("wk1100"),
  ctk1100: defaultCalibration("ctk1100"),
};

interface MediaPipeModule {
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<unknown>;
  };
  HandLandmarker: {
    createFromOptions: (
      vision: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate?: "GPU" | "CPU" };
        runningMode: "VIDEO";
        numHands: number;
      },
    ) => Promise<{
      detectForVideo: (
        video: HTMLVideoElement,
        timestampMs: number,
      ) => {
        landmarks?: { x: number; y: number; z: number }[][];
        handedness?: { categoryName?: string }[][];
      };
      close: () => void;
    }>;
  };
}

export function CamTutorPanel({
  model,
  targetHints,
  activeNotes,
  onAirNoteOn,
  onAirNoteOff,
  initialAirTrigger = false,
  mobileImmersive = false,
}: CamTutorPanelProps) {
  const { locale } = useI18n();
  const [camActive, setCamActive] = useState(false);
  const [simMode, setSimMode] = useState(false);
  const [mirrorX, setMirrorX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [showArGrid, setShowArGrid] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [airTrigger, setAirTrigger] = useState(initialAirTrigger);
  const [airSensitivity, setAirSensitivity] = useState<"normal" | "high">("normal");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [calibratingStep, setCalibratingStep] = useState<"none" | "left" | "right">("none");
  const [postures, setPostures] = useState<PostureAssessment[]>([]);
  const [lastCheck, setLastCheck] = useState<FingeringCheckResult | null>(null);
  const [lastAirTap, setLastAirTap] = useState<AirTapEvent | null>(null);
  const [fingerStats, setFingerStats] = useState({ checked: 0, matched: 0 });

  const calibration = useSyncExternalStore(
    subscribeCal,
    () => getCalibrationSnapshot(model),
    () => SERVER_FALLBACK_CAL[model],
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<Awaited<
    ReturnType<MediaPipeModule["HandLandmarker"]["createFromOptions"]>
  > | null>(null);
  const detectedHandsRef = useRef<DetectedHandFrame[]>([]);
  const lastInferTsRef = useRef<number>(0);
  const lastPostureUiTsRef = useRef<number>(0);
  const airTrackerRef = useRef<AirTriggerTracker>(new AirTriggerTracker());
  const activeAirTipsRef = useRef<Set<string>>(new Set());
  const airCallbacksRef = useRef({ onAirNoteOn, onAirNoteOff });

  useEffect(() => {
    airCallbacksRef.current = { onAirNoteOn, onAirNoteOff };
  });

  const releaseAllAirNotes = useCallback(() => {
    const released = airTrackerRef.current.reset();
    activeAirTipsRef.current = new Set();
    for (const midi of released) {
      airCallbacksRef.current.onAirNoteOff?.(midi);
    }
  }, []);

  const saveCalibration = useCallback((next: KeyboardCalibration) => {
    try {
      const key = `${CAL_STORAGE_PREFIX}${next.model}`;
      const raw = JSON.stringify(next);
      window.localStorage.setItem(key, raw);
      calCache.set(key, { raw, value: next });
      window.dispatchEvent(new CustomEvent(CAL_CHANGE_EVENT));
    } catch {
      // ignore
    }
  }, []);

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setModelStatus("loading");
    try {
      const mp = (await import("@mediapipe/tasks-vision")) as unknown as MediaPipeModule;
      const vision = await mp.FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const lm = await mp.HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/mediapipe/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });
      landmarkerRef.current = lm;
      setModelStatus("ready");
      return lm;
    } catch {
      setModelStatus("error");
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    releaseAllAirNotes();
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    detectedHandsRef.current = [];
    setPostures([]);
    setCamActive(false);
    setSimMode(false);
  }, [releaseAllAirNotes]);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      setCamError(null);
      setSimMode(false);
      releaseAllAirNotes();
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCamError(
          locale === "zh"
            ? "当前环境不支持摄像头 API，可点击「模拟手势预览」体验 AR 效果。"
            : "Camera API unavailable here; click [SIM HAND] to preview.",
        );
        return;
      }

      try {
        if (streamRef.current) {
          for (const t of streamRef.current.getTracks()) t.stop();
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCamActive(true);
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list.filter((d) => d.kind === "videoinput"));
        void ensureLandmarker();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Camera permission denied";
        setCamError(
          locale === "zh"
            ? `无法打开摄像头 (${msg})。可点击「模拟手势预览」体验 AR 与虚拟键盘触发。`
            : `Cannot open camera (${msg}). Try [SIM HAND] mode to preview AR & Air Trigger.`,
        );
      }
    },
    [ensureLandmarker, locale, releaseAllAirNotes],
  );

  useEffect(() => {
    const tracker = airTrackerRef.current;
    return () => {
      tracker.reset();
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Subscribe to note-on events from Yamaha MIDI / keyboard / Air Trigger to verify fingering
  useEffect(() => {
    if (!camActive && !simMode) return;
    const onNote = (e: Event) => {
      const detail = (e as CustomEvent<CamNotePlayedDetail>).detail;
      if (!detail) return;
      const hint = targetHints.find((h) => h.midi === detail.midi) ?? targetHints[0];
      const check = evaluateFingeringFromHands({
        midi: detail.midi,
        expectedHand: detail.expectedHand ?? hint?.hand,
        expectedFinger: detail.expectedFinger ?? (hint?.finger as 1 | 2 | 3 | 4 | 5 | undefined),
        calibration,
        hands: detectedHandsRef.current,
      });

      if (check) {
        setLastCheck(check);
        if (check.expectedFinger) {
          setFingerStats((prev) => ({
            checked: prev.checked + 1,
            matched: prev.matched + (check.matched ? 1 : 0),
          }));
        }
      }
    };

    window.addEventListener("yamaha1100:cam-note", onNote);
    return () => window.removeEventListener("yamaha1100:cam-note", onNote);
  }, [calibration, camActive, simMode, targetHints]);

  // Main render + throttled MediaPipe inference + Air Trigger tap detection loop
  useEffect(() => {
    if (!camActive && !simMode) return;
    let rafId = 0;
    const profile = YAMAHA_PROFILES[model];
    const layout = computeKeyboardLayout(profile.minMidi, profile.maxMidi);

    const drawFrame = (now: number) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(drawFrame);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const w = Math.max(360, Math.floor(rect.width));
      const h = Math.max(200, Math.floor(rect.height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      if (camActive && video && video.readyState >= 2) {
        ctx.translate(mirrorX ? w : 0, flipY ? h : 0);
        ctx.scale(mirrorX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(video, 0, 0, w, h);
      } else {
        ctx.fillStyle = "#080b0a";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(0, 255, 136, 0.06)";
        ctx.lineWidth = 1;
        for (let gx = 0; gx < w; gx += 32) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, h);
          ctx.stroke();
        }
        for (let gy = 0; gy < h; gy += 32) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
          ctx.stroke();
        }
      }
      ctx.restore();

      let handsUpdated = false;
      if (simMode) {
        const simHands = buildSimulatedHands(calibration, targetHints, now / 1000, airTrigger);
        detectedHandsRef.current = simHands;
        handsUpdated = true;
        if (now - lastPostureUiTsRef.current > 260) {
          lastPostureUiTsRef.current = now;
          setPostures(simHands.map(assessHandPosture));
        }
      } else if (
        camActive &&
        video &&
        video.readyState >= 2 &&
        landmarkerRef.current &&
        now - lastInferTsRef.current >= 50
      ) {
        lastInferTsRef.current = now;
        try {
          const res = landmarkerRef.current.detectForVideo(video, now);
          const nextHands: DetectedHandFrame[] = [];
          const lms = res.landmarks ?? [];
          const handed = res.handedness ?? [];
          for (let i = 0; i < lms.length; i++) {
            const rawLabel = handed[i]?.[0]?.categoryName ?? "Right";
            const isRightRaw = rawLabel.toLowerCase() === "right";
            const hand: HandSide = (mirrorX ? !isRightRaw : isRightRaw) ? "right" : "left";
            const mapped = lms[i].map((p) => ({
              x: mirrorX ? 1 - p.x : p.x,
              y: flipY ? 1 - p.y : p.y,
              z: p.z,
            }));
            nextHands.push({ hand, landmarks: mapped, timestamp: now });
          }
          detectedHandsRef.current = nextHands;
          handsUpdated = true;
          if (now - lastPostureUiTsRef.current > 260) {
            lastPostureUiTsRef.current = now;
            setPostures(nextHands.map(assessHandPosture));
          }
        } catch {
          // ignore transient frame error
        }
      }

      // Air / Paper Piano visual tap trigger detection
      if (airTrigger && handsUpdated) {
        const airRes = airTrackerRef.current.update(
          detectedHandsRef.current,
          now,
          calibration,
          airSensitivity,
        );
        activeAirTipsRef.current = airRes.activeTipIds;
        for (const offMidi of airRes.noteOffs) {
          airCallbacksRef.current.onAirNoteOff?.(offMidi);
        }
        for (const tap of airRes.noteOns) {
          airCallbacksRef.current.onAirNoteOn?.(tap.midi, tap.velocity);
          setLastAirTap(tap);
        }
      }

      const bandPx = calibration.bandHalfHeight * h;
      if (showArGrid) {
        const dx = (calibration.rightAnchor.x - calibration.leftAnchor.x) * w;
        const dy = (calibration.rightAnchor.y - calibration.leftAnchor.y) * h;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(calibration.leftAnchor.x * w, calibration.leftAnchor.y * h);
        ctx.rotate(angle);

        ctx.fillStyle = airTrigger ? "rgba(12, 22, 18, 0.58)" : "rgba(10, 10, 10, 0.28)";
        ctx.fillRect(0, -bandPx, len, bandPx * 2);
        ctx.strokeStyle = airTrigger ? "#00ff88" : "rgba(0, 255, 136, 0.45)";
        ctx.lineWidth = airTrigger ? 1.8 : 1.2;
        ctx.strokeRect(0, -bandPx, len, bandPx * 2);

        for (const k of layout.whiteKeys) {
          const kx = k.x * len;
          const kw = k.w * len;
          const isC = k.midi % 12 === 0;
          ctx.strokeStyle = isC ? "rgba(255, 106, 0, 0.65)" : "rgba(255, 255, 255, 0.18)";
          ctx.beginPath();
          ctx.moveTo(kx, -bandPx);
          ctx.lineTo(kx, bandPx);
          ctx.stroke();

          if (activeNotes.has(k.midi)) {
            ctx.fillStyle = "rgba(0, 255, 136, 0.52)";
            ctx.fillRect(kx, -bandPx, kw, bandPx * 2);
          }

          // When Air Trigger virtual keyboard mode is active, label every C key clearly on desk
          if (airTrigger && isC) {
            ctx.fillStyle = "#ff8a33";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.fillText(midiToName(k.midi), kx + kw / 2, bandPx - 5);
          }
        }

        for (const k of layout.blackKeys) {
          const kx = k.x * len;
          const kw = k.w * len;
          ctx.fillStyle = activeNotes.has(k.midi)
            ? "rgba(0, 255, 136, 0.78)"
            : airTrigger
              ? "rgba(0, 0, 0, 0.72)"
              : "rgba(0, 0, 0, 0.42)";
          ctx.fillRect(kx, -bandPx, kw, bandPx * 1.15);
          if (airTrigger) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            ctx.lineWidth = 0.8;
            ctx.strokeRect(kx, -bandPx, kw, bandPx * 1.15);
          }
        }

        for (const hint of targetHints) {
          const keyRect = layout.byMidi.get(hint.midi);
          if (!keyRect) continue;
          const kx = keyRect.x * len;
          const kw = Math.max(8, keyRect.w * len);
          const color = hint.hand === "right" ? "#ff6a00" : "#00d4ff";

          ctx.fillStyle =
            hint.hand === "right" ? "rgba(255, 106, 0, 0.45)" : "rgba(0, 212, 255, 0.45)";
          ctx.fillRect(kx, -bandPx, kw, bandPx * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(kx, -bandPx, kw, bandPx * 2);

          if (hint.finger) {
            ctx.fillStyle = color;
            ctx.fillRect(kx + kw / 2 - 9, -bandPx - 20, 18, 16);
            ctx.fillStyle = "#0a0a0a";
            ctx.font = "bold 11px monospace";
            ctx.textAlign = "center";
            ctx.fillText(String(hint.finger), kx + kw / 2, -bandPx - 8);
          }
        }

        ctx.restore();

        for (const [label, pt] of [
          [midiToName(profile.minMidi), calibration.leftAnchor],
          [midiToName(profile.maxMidi), calibration.rightAnchor],
        ] as const) {
          const ax = pt.x * w;
          const ay = pt.y * h;
          ctx.fillStyle = "#00ff88";
          ctx.beginPath();
          ctx.arc(ax, ay, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(ax - 12, ay + 6, 24, 13);
          ctx.fillStyle = "#00ff88";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(label, ax, ay + 15);
        }
      }

      if (showSkeleton) {
        for (const handFrame of detectedHandsRef.current) {
          const color = handFrame.hand === "right" ? "#ff6a00" : "#00d4ff";
          const pts = handFrame.landmarks;

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          for (const [a, b] of HAND_SKELETON_EDGES) {
            const pa = pts[a];
            const pb = pts[b];
            if (!pa || !pb) continue;
            ctx.beginPath();
            ctx.moveTo(pa.x * w, pa.y * h);
            ctx.lineTo(pb.x * w, pb.y * h);
            ctx.stroke();
          }

          for (let idx = 0; idx < pts.length; idx++) {
            const p = pts[idx];
            ctx.fillStyle = "#e0e0e0";
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          for (const { finger, landmarkIdx } of FINGERTIP_LANDMARKS) {
            const tip = pts[landmarkIdx];
            if (!tip) continue;
            const tx = tip.x * w;
            const ty = tip.y * h;
            const isTapping = activeAirTipsRef.current.has(`${handFrame.hand}:${finger}`);

            if (isTapping) {
              ctx.strokeStyle = "#00ff88";
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(tx, ty, 11, 0, Math.PI * 2);
              ctx.stroke();
            }

            ctx.fillStyle = isTapping ? "#00ff88" : color;
            ctx.fillRect(tx - 7, ty - 16, 14, 13);
            ctx.fillStyle = "#0a0a0a";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.fillText(String(finger), tx, ty - 6);
          }
        }
      }

      if (calibratingStep !== "none") {
        ctx.fillStyle = "rgba(10, 10, 10, 0.72)";
        ctx.fillRect(0, 0, w, 30);
        ctx.fillStyle = "#ff6a00";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        const msg =
          calibratingStep === "left"
            ? locale === "zh"
              ? `步骤 1/2：请点击画面中琴区【最左边】的位置 (${midiToName(profile.minMidi)})`
              : `STEP 1/2: Click LEFTMOST key edge (${midiToName(profile.minMidi)})`
            : locale === "zh"
              ? `步骤 2/2：请点击画面中琴区【最右边】的位置 (${midiToName(profile.maxMidi)})`
              : `STEP 2/2: Click RIGHTMOST key edge (${midiToName(profile.maxMidi)})`;
        ctx.fillText(msg, w / 2, 19);
      }

      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, [
    activeNotes,
    airSensitivity,
    airTrigger,
    calibration,
    calibratingStep,
    camActive,
    flipY,
    locale,
    mirrorX,
    model,
    showArGrid,
    showSkeleton,
    simMode,
    targetHints,
  ]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (calibratingStep === "none" || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));

    if (calibratingStep === "left") {
      saveCalibration({ ...calibration, model, leftAnchor: { x: nx, y: ny } });
      setCalibratingStep("right");
    } else {
      saveCalibration({ ...calibration, model, rightAnchor: { x: nx, y: ny } });
      setCalibratingStep("none");
    }
  };

  const accuracyPct =
    fingerStats.checked > 0 ? Math.round((fingerStats.matched / fingerStats.checked) * 100) : null;

  return (
    <div
      className={
        mobileImmersive
          ? "rounded-2xl border border-white/10 bg-[#0d0d14] p-3"
          : "mb-3 terminal-box p-3"
      }
    >
      <video ref={videoRef} playsInline muted className="hidden" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              camActive
                ? "bg-[#00ff88] shadow-[0_0_8px_#00ff88]"
                : simMode
                  ? "bg-[#00d4ff] shadow-[0_0_8px_#00d4ff]"
                  : "bg-[#555]"
            }`}
          />
          <span className="text-xs font-bold tracking-wider text-[#ff6a00]">
            {mobileImmersive
              ? locale === "zh"
                ? "AR 桌面投影琴"
                : "AR AIR PIANO"
              : "CAM://FINGERING_COACH"}
          </span>
          <span
            className={
              mobileImmersive
                ? "truncate rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#9898a6]"
                : "border border-[#222] bg-[#080808] px-1.5 py-0.5 text-[10px] text-[#888]"
            }
          >
            {camActive
              ? modelStatus === "loading"
                ? "LOADING AI..."
                : modelStatus === "ready"
                  ? airTrigger
                    ? "AIR PIANO + 21-PT LIVE"
                    : "MEDIAPIPE 21-PT LIVE"
                  : "VIDEO ONLY"
              : simMode
                ? airTrigger
                  ? "SIMULATED AIR PIANO"
                  : "SIMULATED HAND DEMO"
                : locale === "zh"
                  ? mobileImmersive
                    ? "俯拍桌面隔空弹奏"
                    : "摄像头待机 (支持 AR 指法纠偏 / 无琴桌面虚拟弹奏)"
                  : "STANDBY (AR FINGERING & AIR PIANO)"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {!camActive ? (
            <>
              <button
                onClick={() => void startCamera(selectedDeviceId || undefined)}
                className={`flex items-center gap-1 font-bold transition-colors ${
                  mobileImmersive
                    ? "rounded-full bg-[#00ff88] px-3 py-1.5 text-[#0a0a0a]"
                    : "border border-[#00ff88] bg-[#081a10] px-2.5 py-1 text-[10px] text-[#00ff88] hover:bg-[#0f2f1e]"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                {locale === "zh" ? "开启摄像头" : "START CAM"}
              </button>
              <button
                onClick={() => {
                  if (simMode) releaseAllAirNotes();
                  setSimMode((s) => !s);
                }}
                className={`flex items-center gap-1 transition-colors ${
                  mobileImmersive
                    ? `rounded-full border px-3 py-1.5 font-semibold ${
                        simMode
                          ? "border-[#00d4ff] bg-[#00d4ff]/20 text-[#00d4ff]"
                          : "border-white/15 bg-white/5 text-[#d4d4df]"
                      }`
                    : `border px-2 py-1 text-[10px] ${
                        simMode
                          ? "border-[#00d4ff] bg-[#081920] font-bold text-[#00d4ff]"
                          : "border-[#252525] text-[#888] hover:border-[#00d4ff] hover:text-[#00d4ff]"
                      }`
                }`}
              >
                <Hand className="h-3.5 w-3.5" />
                {locale === "zh" ? (simMode ? "关闭模拟" : "模拟手势演示") : simMode ? "STOP SIM" : "SIM HAND"}
              </button>
            </>
          ) : (
            <button
              onClick={stopCamera}
              className={`flex items-center gap-1 font-bold ${
                mobileImmersive
                  ? "rounded-full bg-[#ff4444]/20 px-3 py-1.5 text-[#ff6666] ring-1 ring-[#ff4444]/50"
                  : "border border-[#ff4444]/60 bg-[#1a0a0a] px-2.5 py-1 text-[10px] text-[#ff6666]"
              }`}
            >
              <CameraOff className="h-3.5 w-3.5" />
              {locale === "zh" ? "关闭摄像头" : "STOP CAM"}
            </button>
          )}
        </div>
      </div>

      {camError && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#aa3333]/60 bg-[#1a0c0c] px-3 py-2 text-[11px] text-[#ff8888]">
          <span>{camError}</span>
          {!simMode && (
            <button
              type="button"
              onClick={() => {
                setAirTrigger(true);
                setSimMode(true);
              }}
              className="rounded-full bg-[#00d4ff] px-2.5 py-1 text-[10px] font-bold text-[#0a0a0a]"
            >
              {locale === "zh" ? "改用模拟手势演示桌弹" : "Demo Simulated Air Keys"}
            </button>
          )}
        </div>
      )}

      {(camActive || simMode) && (
        <div className="mt-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border border-[#1c1c1c] bg-[#080808] px-2.5 py-1.5 text-[10px]">
            <div className="flex flex-wrap items-center gap-1.5">
              {devices.length > 1 && (
                <select
                  aria-label="Select Camera"
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    void startCamera(e.target.value);
                  }}
                  className="border border-[#262626] bg-[#0c0c0c] px-2 py-1 text-[#e0e0e0]"
                >
                  {devices.map((d, idx) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setCalibratingStep((s) => (s === "none" ? "left" : "none"))}
                className={`flex items-center gap-1 border px-2 py-1 ${
                  calibratingStep !== "none"
                    ? "border-[#ff6a00] bg-[#211205] font-bold text-[#ff6a00]"
                    : "border-[#262626] text-[#ccc] hover:border-[#ff6a00]"
                }`}
              >
                <Crosshair className="h-3 w-3" />
                {locale === "zh"
                  ? calibratingStep === "none"
                    ? "两点校准琴键"
                    : "取消校准"
                  : calibratingStep === "none"
                    ? "CALIBRATE KEYS"
                    : "CANCEL"}
              </button>

              <button
                onClick={() => saveCalibration(defaultCalibration(model))}
                className="border border-[#222] px-2 py-1 text-[#666] hover:text-[#e0e0e0]"
              >
                {locale === "zh" ? "重置校准" : "RESET CAL"}
              </button>

              {/* Paper / Air Piano Visual Trigger Toggle */}
              <button
                onClick={() => {
                  const next = !airTrigger;
                  if (!next) releaseAllAirNotes();
                  setAirTrigger(next);
                }}
                className={`flex items-center gap-1 border px-2.5 py-1 font-bold transition-colors ${
                  airTrigger
                    ? "border-[#00ff88] bg-[#0a2616] text-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.2)]"
                    : "border-[#2a2a2a] text-[#ccc] hover:border-[#00ff88] hover:text-[#00ff88]"
                }`}
                title={
                  locale === "zh"
                    ? "开启后无需实体琴，指尖轻点桌面校准琴区即可直接发声弹奏"
                    : "Tap fingertips in calibrated desk zone to trigger virtual keys without a physical MIDI piano"
                }
              >
                <Zap className="h-3 w-3" />
                {locale === "zh" ? "AIR TRIGGER 视觉触键" : "AIR TRIGGER"}
              </button>

              {airTrigger && (
                <button
                  onClick={() =>
                    setAirSensitivity((s) => (s === "normal" ? "high" : "normal"))
                  }
                  className="border border-[#262626] bg-[#0c0c0c] px-2 py-1 text-[#a855f7]"
                  title="Tap detection sensitivity"
                >
                  {locale === "zh"
                    ? `灵敏度:${airSensitivity === "high" ? "高" : "标准"}`
                    : `SENS:${airSensitivity.toUpperCase()}`}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setMirrorX((v) => !v)}
                className={`flex items-center gap-1 border px-2 py-1 ${
                  mirrorX ? "border-[#00d4ff] text-[#00d4ff]" : "border-[#222] text-[#777]"
                }`}
              >
                <FlipHorizontal2 className="h-3 w-3" />
                {locale === "zh" ? "左右镜像" : "MIRROR"}
              </button>
              <button
                onClick={() => setFlipY((v) => !v)}
                className={`flex items-center gap-1 border px-2 py-1 ${
                  flipY ? "border-[#00d4ff] text-[#00d4ff]" : "border-[#222] text-[#777]"
                }`}
              >
                <FlipVertical2 className="h-3 w-3" />
                {locale === "zh" ? "上下翻转" : "FLIP Y"}
              </button>
              <button
                onClick={() => setShowArGrid((v) => !v)}
                className={`border px-2 py-1 ${
                  showArGrid ? "border-[#00ff88] text-[#00ff88]" : "border-[#222] text-[#777]"
                }`}
              >
                AR
              </button>
              <button
                onClick={() => setShowSkeleton((v) => !v)}
                className={`border px-2 py-1 ${
                  showSkeleton ? "border-[#ff6a00] text-[#ff6a00]" : "border-[#222] text-[#777]"
                }`}
              >
                {locale === "zh" ? "骨骼" : "BONES"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="relative border border-[#222] bg-[#060606] lg:col-span-8">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={`block h-56 w-full sm:h-64 ${
                  calibratingStep !== "none" ? "cursor-crosshair" : "cursor-default"
                }`}
              />
            </div>

            <div className="flex flex-col justify-between gap-2 border border-[#222] bg-[#090909] p-3 text-xs lg:col-span-4">
              <div>
                <div className="flex items-center justify-between border-b border-[#1c1c1c] pb-1.5 text-[10px]">
                  <span className="font-bold text-[#ff6a00]">FINGERING &amp; AIR COACH</span>
                  {accuracyPct !== null && (
                    <span className="font-bold text-[#00ff88]">{accuracyPct}% MATCH</span>
                  )}
                </div>

                {airTrigger && (
                  <div className="mt-2 border border-[#00ff88]/40 bg-[#071910] p-2">
                    <div className="text-[9px] text-[#3ea875]">AIR_PIANO_TRIGGER</div>
                    <div className="mt-0.5 text-[11px] font-bold text-[#00ff88]">
                      {lastAirTap
                        ? `${lastAirTap.keyName} · ${lastAirTap.hand === "right" ? "RH" : "LH"} F${lastAirTap.finger} (VEL ${lastAirTap.velocity})`
                        : locale === "zh"
                          ? "已就绪：指尖向下轻点校准琴区即可发声"
                          : "Ready: tap downwards inside calibrated key strip"}
                    </div>
                  </div>
                )}

                <div className="mt-2 border border-[#1d1d1d] bg-[#060606] p-2">
                  <div className="text-[9px] text-[#555]">LAST_KEY_FINGER</div>
                  <div
                    className={`mt-0.5 text-[11px] font-bold ${
                      lastCheck
                        ? lastCheck.matched
                          ? "text-[#00ff88]"
                          : "text-[#ff6a00]"
                        : "text-[#666]"
                    }`}
                  >
                    {lastCheck
                      ? locale === "zh"
                        ? lastCheck.messageZh
                        : lastCheck.messageEn
                      : locale === "zh"
                        ? "弹奏任意琴键即可比对当前指法"
                        : "Play any key to check finger placement"}
                  </div>
                </div>

                <div className="mt-2 space-y-1.5">
                  <div className="text-[9px] text-[#555]">HAND_POSTURE_COACH</div>
                  {postures.length === 0 ? (
                    <div className="text-[11px] text-[#666]">
                      {locale === "zh"
                        ? "未检测到双手（请将手放入琴键区域）"
                        : "Place hands over keyboard for posture check"}
                    </div>
                  ) : (
                    postures.map((p, idx) => (
                      <div
                        key={idx}
                        className={`border px-2 py-1.5 text-[11px] ${
                          p.status === "OK"
                            ? "border-[#00ff88]/30 bg-[#08150e] text-[#00ff88]"
                            : "border-[#ff6a00]/50 bg-[#1a1006] text-[#ff8a33]"
                        }`}
                      >
                        <div className="font-bold">
                          {locale === "zh" ? p.messageZh : p.messageEn}
                        </div>
                        <div className="mt-0.5 text-[9px] text-[#888]">
                          ARCH: {p.archRatio.toFixed(2)} · SPREAD: {p.tipSpread.toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-start gap-1.5 border-t border-[#1a1a1a] pt-2 text-[10px] leading-relaxed text-[#555]">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#a855f7]" />
                <span>
                  {airTrigger
                    ? locale === "zh"
                      ? "当前为无琴桌面虚拟钢琴模式：建议手机/摄像头从上方俯拍桌面或纸键盘，指尖轻点即响。"
                      : "Paper / Air Piano active: aim webcam overhead at desk or printed keys and tap to play."
                    : locale === "zh"
                      ? "提示：接雅马哈 1100 时关闭视觉触键，让 USB-MIDI 判音准、摄像头专注 AR 与指法矫正。"
                      : "Tip: keep AIR TRIGGER off with a real Yamaha 1100 so USB-MIDI grades timing cleanly."}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
