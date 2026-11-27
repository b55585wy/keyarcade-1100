"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { HandFilter, HitJudgement, SongNote, YamahaModelId } from "@/types/music";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import { computeKeyboardLayout } from "@/lib/music/keyboard-layout";
import { isBlackKey, midiToName } from "@/lib/music/theory";

export interface NoteJudgementVisual {
  judgement: HitJudgement;
  noteId: string;
}

interface FallingNotesCanvasProps {
  model: YamahaModelId;
  notes: SongNote[];
  currentSec: number;
  tempoScale: number;
  handFilter: HandFilter;
  hitStatusMap: Map<string, HitJudgement>;
  activeNotes: Set<number>;
  lastBanner?: { text: string; color: string; at: number } | null;
  zoom?: 1 | 2 | 3;
  immersiveMobile?: boolean;
  feverActive?: boolean;
  combo?: number;
  hitSparkPulse?: { midi: number; color: string; at: number } | null;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onScrollSync?: (scrollLeft: number) => void;
}

interface CanvasSpark {
  xNorm: number;
  yOffset: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

const LOOKAHEAD_SEC = 2.6; // seconds visible above hit line

export function FallingNotesCanvas({
  model,
  notes,
  currentSec,
  tempoScale,
  handFilter,
  hitStatusMap,
  activeNotes,
  lastBanner,
  zoom = 1,
  immersiveMobile = false,
  feverActive = false,
  combo = 0,
  hitSparkPulse,
  onCanvasReady,
  scrollContainerRef,
  onScrollSync,
}: FallingNotesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<CanvasSpark[]>([]);
  const lastPulseAtRef = useRef<number>(0);
  const [resizeTick, setResizeTick] = useState(0);
  const profile = YAMAHA_PROFILES[model];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(() => setResizeTick((t) => t + 1));
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [zoom]);

  const layout = useMemo(
    () => computeKeyboardLayout(profile.minMidi, profile.maxMidi),
    [profile.minMidi, profile.maxMidi],
  );

  useEffect(() => {
    if (!hitSparkPulse || hitSparkPulse.at === lastPulseAtRef.current) return;
    lastPulseAtRef.current = hitSparkPulse.at;
    const keyRect = layout.byMidi.get(hitSparkPulse.midi);
    if (!keyRect) return;
    const cx = keyRect.x + keyRect.w * 0.5;
    for (let i = 0; i < 8; i++) {
      sparksRef.current.push({
        xNorm: cx,
        yOffset: 4,
        vx: (Math.random() - 0.5) * 4.2,
        vy: -(1.8 + Math.random() * 3.6),
        color: hitSparkPulse.color,
        life: 1,
      });
    }
    if (sparksRef.current.length > 56) {
      sparksRef.current = sparksRef.current.slice(-56);
    }
  }, [hitSparkPulse, layout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(180, Math.floor(rect.height));

    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Background obsidian grid (+ subtle FEVER vignette glow)
    ctx.fillStyle = feverActive ? "#090c14" : "#080808";
    ctx.fillRect(0, 0, w, h);
    if (feverActive) {
      const feverGrad = ctx.createLinearGradient(0, 0, w, h);
      feverGrad.addColorStop(0, "rgba(0, 255, 136, 0.08)");
      feverGrad.addColorStop(0.5, "rgba(0, 212, 255, 0.05)");
      feverGrad.addColorStop(1, "rgba(255, 106, 0, 0.09)");
      ctx.fillStyle = feverGrad;
      ctx.fillRect(0, 0, w, h);
    }

    const hitY = h - 10;
    const effectiveLookahead = LOOKAHEAD_SEC / Math.max(0.4, tempoScale);

    // Draw subtle vertical column guides aligned with every C and white key boundary
    for (const k of layout.whiteKeys) {
      const kx = k.x * w;
      const isC = k.midi % 12 === 0;
      ctx.strokeStyle = isC ? "rgba(255, 106, 0, 0.16)" : "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = isC ? 1 : 0.7;
      ctx.beginPath();
      ctx.moveTo(kx, 0);
      ctx.lineTo(kx, hitY);
      ctx.stroke();

      // Active pressed key laser column glow
      if (activeNotes.has(k.midi)) {
        const grad = ctx.createLinearGradient(0, hitY - 90, 0, hitY);
        grad.addColorStop(0, "rgba(0, 255, 136, 0)");
        grad.addColorStop(1, "rgba(0, 255, 136, 0.25)");
        ctx.fillStyle = grad;
        ctx.fillRect(kx, hitY - 90, k.w * w, 90);
      }
    }

    // Active black key columns
    for (const k of layout.blackKeys) {
      if (activeNotes.has(k.midi)) {
        const grad = ctx.createLinearGradient(0, hitY - 70, 0, hitY);
        grad.addColorStop(0, "rgba(0, 255, 136, 0)");
        grad.addColorStop(1, "rgba(0, 255, 136, 0.35)");
        ctx.fillStyle = grad;
        ctx.fillRect(k.x * w, hitY - 70, k.w * w, 70);
      }
    }

    // Horizontal beat/time horizon lines
    for (let i = 1; i <= 4; i++) {
      const y = (hitY / 5) * i;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Render falling note bars
    const pxPerSec = hitY / effectiveLookahead;
    for (const n of notes) {
      if (handFilter !== "both" && n.hand !== handFilter) continue;

      const keyRect = layout.byMidi.get(n.midi);
      if (!keyRect) continue;

      const dtStart = n.startSec - currentSec;
      const dtEnd = n.startSec + n.durationSec - currentSec;

      if (dtEnd < -0.25 || dtStart > effectiveLookahead + 0.2) continue;

      const yBottom = hitY - dtStart * pxPerSec;
      const yTop = hitY - dtEnd * pxPerSec;
      const rawHeight = Math.max(10, yBottom - yTop);

      const drawTop = Math.max(-10, yTop);
      const drawBottom = Math.min(hitY, yBottom);
      const drawHeight = drawBottom - drawTop;
      if (drawHeight <= 1 && rawHeight > 1) continue;

      const bx = keyRect.x * w + 1;
      const bw = Math.max(4, keyRect.w * w - 2);

      const judged = hitStatusMap.get(n.id);
      const isRight = n.hand === "right";
      const isDarkKey = isBlackKey(n.midi);

      let fill = isRight ? "#ff6a00" : "#00d4ff";
      let border = isRight ? "#ffaa66" : "#80ecff";
      if (judged === "PERFECT" || judged === "GREAT" || judged === "GOOD") {
        fill = "#00ff88";
        border = "#b3ffdb";
      } else if (judged === "MISS") {
        fill = "#3b1d1d";
        border = "#aa3333";
      } else if (isDarkKey) {
        fill = isRight ? "#cc5200" : "#0099cc";
      }

      // Note bar with crisp terminal shadow
      ctx.fillStyle = fill;
      ctx.fillRect(bx, drawTop, bw, Math.max(6, drawHeight));

      ctx.strokeStyle = border;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx + 0.5, drawTop + 0.5, bw - 1, Math.max(5, drawHeight - 1));

      // Label note name + finger when bar is tall enough
      if (drawHeight >= 16 && bw >= 13) {
        ctx.fillStyle = "#090909";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        const label = n.finger ? `${midiToName(n.midi)}·${n.finger}` : midiToName(n.midi);
        ctx.fillText(label, bx + bw / 2, drawBottom - 4, bw - 2);
      }
    }

    // 3. Laser Hit Horizon Line
    ctx.strokeStyle = feverActive ? "#00d4ff" : "#00ff88";
    ctx.lineWidth = feverActive ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(w, hitY);
    ctx.stroke();

    // 3b. Pixel hit sparks
    if (sparksRef.current.length > 0) {
      const nextSparks: CanvasSpark[] = [];
      for (const sp of sparksRef.current) {
        const px = sp.xNorm * w + (1 - sp.life) * sp.vx * 18;
        const py = hitY - sp.yOffset + (1 - sp.life) * sp.vy * 18;
        ctx.globalAlpha = Math.max(0, sp.life);
        ctx.fillStyle = sp.color;
        ctx.fillRect(px - 2, py - 2, 4, 4);
        const nextLife = sp.life - 0.065;
        if (nextLife > 0.05) {
          nextSparks.push({ ...sp, life: nextLife });
        }
      }
      ctx.globalAlpha = 1;
      sparksRef.current = nextSparks;
    }

    // 4. FEVER HUD Pill inside canvas (shows cleanly in WebM recordings)
    if (feverActive) {
      ctx.fillStyle = "rgba(8, 22, 18, 0.86)";
      ctx.fillRect(10, 10, 126, 22);
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(10, 10, 126, 22);
      ctx.fillStyle = "#00ff88";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`FEVER x${combo}`, 18, 25);
    }

    // 5. Floating Hit Judgement Banner
    if (lastBanner && performance.now() - lastBanner.at < 750) {
      const age = (performance.now() - lastBanner.at) / 750;
      ctx.globalAlpha = Math.max(0, 1 - age);
      ctx.fillStyle = lastBanner.color;
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText(lastBanner.text, w / 2, Math.max(36, hitY - 46 - age * 18));
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [activeNotes, combo, currentSec, feverActive, handFilter, hitStatusMap, lastBanner, layout, notes, resizeTick, tempoScale, zoom]);

  return (
    <div
      className={
        immersiveMobile
          ? "relative flex min-h-[160px] w-full flex-1 flex-col bg-[#060609]"
          : "relative w-full overflow-hidden rounded-t-2xl border-x border-t border-white/10 bg-[#07070b]"
      }
    >
      <div
        ref={scrollContainerRef}
        onScroll={(e) => onScrollSync?.(e.currentTarget.scrollLeft)}
        className={
          immersiveMobile
            ? "flex h-full w-full flex-1 overflow-x-auto overflow-y-hidden touch-pan-x"
            : "w-full overflow-x-auto overflow-y-hidden touch-pan-x"
        }
      >
        <div
          style={{ width: `${zoom * 100}%` }}
          className={immersiveMobile ? "h-full min-h-[160px] shrink-0" : undefined}
        >
          <canvas
            ref={(el) => {
              canvasRef.current = el;
              onCanvasReady?.(el);
            }}
            className={immersiveMobile ? "block h-full w-full" : "block h-44 w-full sm:h-60 lg:h-64"}
          />
        </div>
      </div>
      <div
        className={`pointer-events-none absolute top-2 right-2.5 flex items-center gap-2.5 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] text-white/80 backdrop-blur-sm ${
          immersiveMobile ? "text-[9px]" : ""
        }`}
      >
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a00]" />
          {immersiveMobile ? "RH" : "右手"}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00d4ff]" />
          {immersiveMobile ? "LH" : "左手"}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
          {immersiveMobile ? "HIT" : "命中"}
        </span>
      </div>
    </div>
  );
}
