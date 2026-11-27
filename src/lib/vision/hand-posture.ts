import type { HandSide, YamahaModelId } from "@/types/music";
import { computeKeyboardLayout } from "@/lib/music/keyboard-layout";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import { midiToName } from "@/lib/music/theory";

export interface Point2D {
  x: number; // normalized [0..1]
  y: number; // normalized [0..1]
}

export interface KeyboardCalibration {
  model: YamahaModelId;
  leftAnchor: Point2D;
  rightAnchor: Point2D;
  bandHalfHeight: number;
}

export interface HandLandmark2D {
  x: number;
  y: number;
  z: number;
}

export interface DetectedHandFrame {
  hand: HandSide;
  landmarks: HandLandmark2D[]; // 21 MediaPipe landmarks
  timestamp: number;
}

export interface PostureAssessment {
  hand: HandSide;
  status: "OK" | "FLAT_FINGERS" | "WRIST_LOW";
  archRatio: number;
  tipSpread: number;
  messageZh: string;
  messageEn: string;
}

export interface FingeringCheckResult {
  id: string;
  midi: number;
  keyName: string;
  hand: HandSide;
  expectedFinger?: 1 | 2 | 3 | 4 | 5;
  actualFinger: 1 | 2 | 3 | 4 | 5;
  matched: boolean;
  distanceT: number;
  messageZh: string;
  messageEn: string;
  timestamp: number;
}

// MediaPipe 21-point fingertip indices mapped to standard piano finger numbers (1=thumb .. 5=pinky)
export const FINGERTIP_LANDMARKS: { finger: 1 | 2 | 3 | 4 | 5; landmarkIdx: number }[] = [
  { finger: 1, landmarkIdx: 4 },
  { finger: 2, landmarkIdx: 8 },
  { finger: 3, landmarkIdx: 12 },
  { finger: 4, landmarkIdx: 16 },
  { finger: 5, landmarkIdx: 20 },
];

export const HAND_SKELETON_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17],            // Palm arch
];

export function defaultCalibration(model: YamahaModelId): KeyboardCalibration {
  return {
    model,
    leftAnchor: { x: 0.06, y: 0.64 },
    rightAnchor: { x: 0.94, y: 0.64 },
    bandHalfHeight: 0.14,
  };
}

/**
 * Projects a normalized keyboard X in [0..1] onto the calibrated video line segment.
 */
export function projectKeyToCamera(
  cal: KeyboardCalibration,
  normX: number,
  normW: number,
): { p0: Point2D; p1: Point2D; center: Point2D; angleRad: number } {
  const dx = cal.rightAnchor.x - cal.leftAnchor.x;
  const dy = cal.rightAnchor.y - cal.leftAnchor.y;
  const p0 = {
    x: cal.leftAnchor.x + dx * normX,
    y: cal.leftAnchor.y + dy * normX,
  };
  const p1 = {
    x: cal.leftAnchor.x + dx * (normX + normW),
    y: cal.leftAnchor.y + dy * (normX + normW),
  };
  return {
    p0,
    p1,
    center: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 },
    angleRad: Math.atan2(dy, dx),
  };
}

/**
 * Inverse projection: maps a fingertip point in normalized camera coordinates
 * onto keyboard axis scalar t in [0..1], plus signed perpendicular offset and distance.
 */
export function projectPointOntoKeyAxis(
  cal: KeyboardCalibration,
  pt: Point2D,
): { t: number; signedPerp: number; perpDist: number } {
  const dx = cal.rightAnchor.x - cal.leftAnchor.x;
  const dy = cal.rightAnchor.y - cal.leftAnchor.y;
  const len = Math.hypot(dx, dy);
  const lenSq = len * len;
  if (lenSq < 1e-6) return { t: 0.5, signedPerp: 0, perpDist: 1 };
  const vx = pt.x - cal.leftAnchor.x;
  const vy = pt.y - cal.leftAnchor.y;
  const t = (vx * dx + vy * dy) / lenSq;
  const projX = cal.leftAnchor.x + t * dx;
  const projY = cal.leftAnchor.y + t * dy;
  // Cross product sign: negative = above line (top half / black keys), positive = below line
  const signedPerp = (dx * (pt.y - projY) - dy * (pt.x - projX)) / len;
  const perpDist = Math.abs(signedPerp);
  return { t, signedPerp, perpDist };
}

/**
 * Resolves a camera-space fingertip point into the exact MIDI key under it
 * (respecting white-key vs upper-half black-key geometry).
 */
export function findMidiAtCalibratedPoint(
  cal: KeyboardCalibration,
  pt: Point2D,
): { midi: number; keyName: string; isBlack: boolean } | null {
  const { t, signedPerp, perpDist } = projectPointOntoKeyAxis(cal, pt);
  if (t < -0.01 || t > 1.01 || perpDist > cal.bandHalfHeight * 1.45) {
    return null;
  }

  const profile = YAMAHA_PROFILES[cal.model];
  const layout = computeKeyboardLayout(profile.minMidi, profile.maxMidi);
  const clampedT = Math.max(0, Math.min(0.9999, t));

  // Black keys occupy the upper ~58% of the keybed strip
  if (signedPerp <= cal.bandHalfHeight * 0.25) {
    for (const bk of layout.blackKeys) {
      if (clampedT >= bk.x - bk.w * 0.12 && clampedT <= bk.x + bk.w * 1.12) {
        return { midi: bk.midi, keyName: midiToName(bk.midi), isBlack: true };
      }
    }
  }

  for (const wk of layout.whiteKeys) {
    if (clampedT >= wk.x && clampedT <= wk.x + wk.w) {
      return { midi: wk.midi, keyName: midiToName(wk.midi), isBlack: false };
    }
  }

  return null;
}

export interface AirTapEvent {
  midi: number;
  velocity: number;
  hand: HandSide;
  finger: 1 | 2 | 3 | 4 | 5;
  keyName: string;
}

interface TipTrackState {
  lastY: number;
  lastZ: number;
  lastAt: number;
  minRecentY: number;
  minRecentZ: number;
  activeMidi: number | null;
  lastTriggerAt: number;
}

/**
 * Stateful visual desk-tap detector ("Paper / Air Piano"):
 * Tracks each fingertip's downward velocity/depth impulse inside the calibrated keyboard strip
 * and emits clean NoteOn / NoteOff events without spamming held keys.
 */
export class AirTriggerTracker {
  private tips = new Map<string, TipTrackState>();

  reset(): number[] {
    const released: number[] = [];
    for (const st of this.tips.values()) {
      if (st.activeMidi !== null && !released.includes(st.activeMidi)) {
        released.push(st.activeMidi);
      }
    }
    this.tips.clear();
    return released;
  }

  update(
    hands: DetectedHandFrame[],
    nowMs: number,
    cal: KeyboardCalibration,
    sensitivity: "normal" | "high" = "normal",
  ): {
    noteOns: AirTapEvent[];
    noteOffs: number[];
    activeTipIds: Set<string>;
  } {
    const noteOns: AirTapEvent[] = [];
    const noteOffs: number[] = [];
    const activeTipIds = new Set<string>();
    const seenKeys = new Set<string>();

    const yDeltaThresh = sensitivity === "high" ? 0.011 : 0.018;
    const zDeltaThresh = sensitivity === "high" ? 0.012 : 0.02;
    const vyThresh = sensitivity === "high" ? 0.14 : 0.22;
    const cooldownMs = 150;

    for (const h of hands) {
      for (const { finger, landmarkIdx } of FINGERTIP_LANDMARKS) {
        const lm = h.landmarks[landmarkIdx];
        if (!lm) continue;
        const tipId = `${h.hand}:${finger}`;
        seenKeys.add(tipId);

        const hitKey = findMidiAtCalibratedPoint(cal, { x: lm.x, y: lm.y });
        const prev = this.tips.get(tipId);

        if (!prev) {
          this.tips.set(tipId, {
            lastY: lm.y,
            lastZ: lm.z,
            lastAt: nowMs,
            minRecentY: lm.y,
            minRecentZ: lm.z,
            activeMidi: null,
            lastTriggerAt: 0,
          });
          continue;
        }

        const dtSec = Math.max(0.016, (nowMs - prev.lastAt) / 1000);
        const vy = (lm.y - prev.lastY) / dtSec;
        const vz = (lm.z - prev.lastZ) / dtSec;

        // Slowly decay the recent baseline hover height so resting hands re-arm cleanly
        const minRecentY = lm.y < prev.minRecentY ? lm.y : prev.minRecentY + (lm.y - prev.minRecentY) * 0.08;
        const minRecentZ = lm.z < prev.minRecentZ ? lm.z : prev.minRecentZ + (lm.z - prev.minRecentZ) * 0.08;

        const dropY = lm.y - minRecentY;
        const dropZ = lm.z - minRecentZ;

        if (prev.activeMidi !== null) {
          // Check release: finger lifted up OR moved off the key
          const lifted = lm.y < prev.lastY - 0.012 || lm.z < prev.lastZ - 0.014;
          const leftZone = !hitKey || hitKey.midi !== prev.activeMidi;
          if (lifted || leftZone) {
            noteOffs.push(prev.activeMidi);
            prev.activeMidi = null;
            prev.minRecentY = lm.y;
            prev.minRecentZ = lm.z;
          } else {
            activeTipIds.add(tipId);
          }
        } else if (hitKey && nowMs - prev.lastTriggerAt >= cooldownMs) {
          // Detect crisp downward strike in either screen Y (angled view) or MediaPipe Z (overhead view)
          const strikeY = dropY >= yDeltaThresh || vy >= vyThresh;
          const strikeZ = dropZ >= zDeltaThresh || vz >= vyThresh * 0.9;
          if (strikeY || strikeZ) {
            const vel = Math.round(
              Math.max(68, Math.min(120, 72 + Math.max(vy, vz) * 80)),
            );
            prev.activeMidi = hitKey.midi;
            prev.lastTriggerAt = nowMs;
            prev.minRecentY = lm.y;
            prev.minRecentZ = lm.z;
            activeTipIds.add(tipId);
            noteOns.push({
              midi: hitKey.midi,
              velocity: vel,
              hand: h.hand,
              finger,
              keyName: hitKey.keyName,
            });
          }
        }

        prev.lastY = lm.y;
        prev.lastZ = lm.z;
        prev.lastAt = nowMs;
        if (prev.activeMidi === null) {
          prev.minRecentY = minRecentY;
          prev.minRecentZ = minRecentZ;
        }
      }
    }

    // Release any fingertips that disappeared from frame
    for (const [tipId, st] of this.tips.entries()) {
      if (!seenKeys.has(tipId)) {
        if (st.activeMidi !== null) {
          noteOffs.push(st.activeMidi);
        }
        this.tips.delete(tipId);
      }
    }

    return { noteOns, noteOffs, activeTipIds };
  }
}

/**
 * Given a MIDI note pressed (via Yamaha USB-MIDI / keyboard) and recent detected hands,
 * identifies which fingertip (1..5) is physically positioned over that key!
 */
export function evaluateFingeringFromHands(params: {
  midi: number;
  expectedHand?: HandSide;
  expectedFinger?: 1 | 2 | 3 | 4 | 5;
  calibration: KeyboardCalibration;
  hands: DetectedHandFrame[];
}): FingeringCheckResult | null {
  const { midi, expectedHand, expectedFinger, calibration, hands } = params;
  if (hands.length === 0) return null;

  const profile = YAMAHA_PROFILES[calibration.model];
  const layout = computeKeyboardLayout(profile.minMidi, profile.maxMidi);
  const keyRect = layout.byMidi.get(midi);
  if (!keyRect) return null;

  const keyCenterT = keyRect.x + keyRect.w / 2;

  // Prefer matching hand side if both hands are visible; otherwise pick closest fingertip across all hands
  const preferredHands = expectedHand
    ? hands.filter((h) => h.hand === expectedHand)
    : hands;
  const pool = preferredHands.length > 0 ? preferredHands : hands;

  let best: {
    hand: HandSide;
    finger: 1 | 2 | 3 | 4 | 5;
    distT: number;
  } | null = null;

  for (const h of pool) {
    for (const { finger, landmarkIdx } of FINGERTIP_LANDMARKS) {
      const lm = h.landmarks[landmarkIdx];
      if (!lm) continue;
      const { t, perpDist } = projectPointOntoKeyAxis(calibration, { x: lm.x, y: lm.y });
      // Weight horizontal error primarily, lightly penalize fingertips very far from keybed strip
      const scoreDist = Math.abs(t - keyCenterT) + Math.max(0, perpDist - calibration.bandHalfHeight * 1.8) * 0.4;
      if (!best || scoreDist < best.distT) {
        best = { hand: h.hand, finger, distT: scoreDist };
      }
    }
  }

  if (!best || best.distT > 0.14) return null;

  const keyName = midiToName(midi);
  const expHand = expectedHand ?? best.hand;
  const matched = expectedFinger
    ? best.finger === expectedFinger && best.hand === expHand
    : best.hand === expHand;
  const expHandZh = expHand === "right" ? "右手" : "左手";
  const actHandZh = best.hand === "right" ? "右手" : "左手";

  return {
    id: `fc-${Date.now()}-${midi}`,
    midi,
    keyName,
    hand: best.hand,
    expectedFinger,
    actualFinger: best.finger,
    matched,
    distanceT: best.distT,
    messageZh: expectedFinger
      ? matched
        ? `[OK] ${keyName} · ${actHandZh} ${best.finger} 指命中`
        : `[WARN] ${keyName} 建议 ${expHandZh} ${expectedFinger} 指（检测到 ${actHandZh} ${best.finger} 指）`
      : `[CAM] ${keyName} · 检测到 ${actHandZh} ${best.finger} 指`,
    messageEn: expectedFinger
      ? matched
        ? `[OK] ${keyName} · ${best.hand.toUpperCase()} finger ${best.finger}`
        : `[WARN] ${keyName} expected ${expHand.toUpperCase()} F${expectedFinger} (saw ${best.hand.toUpperCase()} F${best.finger})`
      : `[CAM] ${keyName} · ${best.hand.toUpperCase()} F${best.finger}`,
    timestamp: performance.now(),
  };
}

/**
 * Evaluates hand posture (finger arch & wrist alignment) from 21 3D landmarks.
 */
export function assessHandPosture(handFrame: DetectedHandFrame): PostureAssessment {
  const lm = handFrame.landmarks;
  const wrist = lm[0];
  const midMcp = lm[9];
  const midPip = lm[10];
  const midTip = lm[12];
  const ringTip = lm[16];
  const indexTip = lm[8];

  const palmLen = Math.max(0.02, Math.hypot(midMcp.x - wrist.x, midMcp.y - wrist.y));
  // Compare straight-line MCP->TIP length vs MCP->PIP + PIP->TIP segment sum:
  // Curved ("holding an egg") hand has archRatio ~ 0.62..0.88; completely flat stiff hand approaches ~ 0.96+
  const seg1 = Math.hypot(midPip.x - midMcp.x, midPip.y - midMcp.y);
  const seg2 = Math.hypot(midTip.x - midPip.x, midTip.y - midPip.y);
  const direct = Math.hypot(midTip.x - midMcp.x, midTip.y - midMcp.y);
  const archRatio = direct / Math.max(0.01, seg1 + seg2);

  // Average tip-to-tip span normalized by palm length
  const tipSpread = Math.hypot(ringTip.x - indexTip.x, ringTip.y - indexTip.y) / palmLen;

  // In overhead/angled view, z-depth of wrist vs knuckles indicates wrist drop (MediaPipe z: negative = closer to cam)
  const wristDropDelta = wrist.z - midMcp.z;

  const sideZh = handFrame.hand === "right" ? "右手" : "左手";
  const sideEn = handFrame.hand === "right" ? "RH" : "LH";

  if (wristDropDelta > 0.09) {
    return {
      hand: handFrame.hand,
      status: "WRIST_LOW",
      archRatio,
      tipSpread,
      messageZh: `${sideZh}手腕偏低，尝试轻抬腕部与琴键齐平`,
      messageEn: `${sideEn} wrist looks low — keep wrist level with keybed`,
    };
  }

  if (archRatio > 0.96) {
    return {
      hand: handFrame.hand,
      status: "FLAT_FINGERS",
      archRatio,
      tipSpread,
      messageZh: `${sideZh}手指略平直，注意掌关节拱起如轻握小球`,
      messageEn: `${sideEn} fingers look flat — curve knuckles into natural arch`,
    };
  }

  return {
    hand: handFrame.hand,
    status: "OK",
    archRatio,
    tipSpread,
    messageZh: `${sideZh}手型自然拱起`,
    messageEn: `${sideEn} arch looks relaxed`,
  };
}

/**
 * Generates synthetic animated 21-point hand landmarks over target keys
 * for testing/previewing AR + Fingering Check (and optional Air Trigger tap pulse).
 */
export function buildSimulatedHands(
  cal: KeyboardCalibration,
  hints: { midi: number; hand: HandSide; finger?: number }[],
  timeSec: number,
  airTapMode = false,
): DetectedHandFrame[] {
  const profile = YAMAHA_PROFILES[cal.model];
  const layout = computeKeyboardLayout(profile.minMidi, profile.maxMidi);
  const bob = airTapMode ? 0 : Math.sin(timeSec * 3.5) * 0.01;
  // When airTapMode is enabled, produce a crisp periodic downward strike on the target key every ~1.25s
  const cycle = (timeSec % 1.25) / 1.25;
  const tapDip = airTapMode && cycle > 0.45 && cycle < 0.72 ? Math.sin(((cycle - 0.45) / 0.27) * Math.PI) * 0.045 : 0;

  const makeHand = (side: HandSide, anchorMidi: number, targetFinger = 3): DetectedHandFrame => {
    const keyRect = layout.byMidi.get(anchorMidi) ?? { x: side === "left" ? 0.3 : 0.55, w: 0.02 };
    const proj = projectKeyToCamera(cal, keyRect.x, keyRect.w);
    const cx = proj.center.x;
    const cy = proj.center.y;

    // Mirror X offsets for left hand vs right hand (left hand thumb is on the right side)
    const dir = side === "right" ? 1 : -1;
    const rawOffsets = [
      { dx: -0.055 * dir, dy: -0.10, arch: 0.022 }, // 1 thumb
      { dx: -0.025 * dir, dy: -0.17, arch: 0.028 }, // 2 index
      { dx: 0.0, dy: -0.185, arch: 0.032 },         // 3 middle
      { dx: 0.025 * dir, dy: -0.17, arch: 0.028 },  // 4 ring
      { dx: 0.05 * dir, dy: -0.145, arch: 0.024 },  // 5 pinky
    ];

    // Shift wrist so the chosen targetFinger lands directly over cx
    const fIdx = Math.max(0, Math.min(4, targetFinger - 1));
    const wristX = cx - rawOffsets[fIdx].dx;
    const baseHoverY = airTapMode ? cy - 0.028 : cy + bob;
    const wrist: HandLandmark2D = { x: wristX, y: baseHoverY + 0.22, z: 0.01 };
    const pts: HandLandmark2D[] = new Array(21);
    pts[0] = wrist;

    rawOffsets.forEach((f, idx) => {
      const base = 1 + idx * 4;
      const isTargetTip = idx === fIdx;
      const extraDip = isTargetTip ? tapDip : 0;
      const mcp = { x: wrist.x + f.dx * 0.65, y: wrist.y + f.dy * 0.48, z: -0.01 };
      const pip = {
        x: wrist.x + f.dx * 0.88 - f.arch * 0.6 * dir,
        y: wrist.y + f.dy * 0.78 - f.arch + extraDip * 0.35,
        z: -0.04,
      };
      const dip = {
        x: wrist.x + f.dx * 0.96 - f.arch * 0.25 * dir,
        y: wrist.y + f.dy * 0.91 - f.arch * 0.4 + extraDip * 0.7,
        z: -0.02,
      };
      const tip = {
        x: wrist.x + f.dx,
        y: baseHoverY + extraDip,
        z: -0.01 + extraDip * 0.8,
      };
      pts[base] = mcp;
      pts[base + 1] = pip;
      pts[base + 2] = dip;
      pts[base + 3] = tip;
    });

    return {
      hand: side,
      landmarks: pts,
      timestamp: performance.now(),
    };
  };

  const rhHint = hints.find((h) => h.hand === "right");
  const lhHint = hints.find((h) => h.hand === "left");
  const result: DetectedHandFrame[] = [];

  if (lhHint) {
    result.push(makeHand("left", lhHint.midi, lhHint.finger ?? 5));
  }
  result.push(makeHand("right", rhHint?.midi ?? 60, rhHint?.finger ?? 1));
  return result;
}
