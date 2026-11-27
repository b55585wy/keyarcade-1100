import type { HitJudgement, HitToleranceTier } from "@/types/music";

export interface ToleranceWindows {
  tier: HitToleranceTier;
  perfectSec: number;
  greatSec: number;
  goodSec: number;
  missAfterSec: number;
  labelZh: string;
  labelEn: string;
}

export const TOLERANCE_TIERS: Record<HitToleranceTier, ToleranceWindows> = {
  relaxed: {
    tier: "relaxed",
    perfectSec: 0.14,
    greatSec: 0.22,
    goodSec: 0.34,
    missAfterSec: 0.42,
    labelZh: "萌新 ±340ms",
    labelEn: "Relaxed",
  },
  standard: {
    tier: "standard",
    perfectSec: 0.09,
    greatSec: 0.17,
    goodSec: 0.28,
    missAfterSec: 0.3,
    labelZh: "标准 ±280ms",
    labelEn: "Standard",
  },
  strict: {
    tier: "strict",
    perfectSec: 0.055,
    greatSec: 0.1,
    goodSec: 0.16,
    missAfterSec: 0.2,
    labelZh: "硬核 ±160ms",
    labelEn: "Strict",
  },
};

/**
 * Classifies an absolute note timing offset against the chosen difficulty tolerance tier.
 */
export function evaluateTimingHit(
  absDiffSec: number,
  tier: HitToleranceTier,
): HitJudgement | null {
  const w = TOLERANCE_TIERS[tier];
  if (absDiffSec <= w.perfectSec) return "PERFECT";
  if (absDiffSec <= w.greatSec) return "GREAT";
  if (absDiffSec <= w.goodSec) return "GOOD";
  return null;
}

/**
 * Computes negative start lead-in seconds for a clean 4-beat countdown when Count-In is enabled.
 */
export function computeLeadInStartSec(bpm: number, countInEnabled: boolean): number {
  if (!countInEnabled) return -0.8;
  const secPerBeat = 60 / Math.max(40, bpm);
  // Ensure 4 full visual/audio beats fit comfortably before Beat 0
  return -Math.min(3.4, Math.max(1.8, Math.round(secPerBeat * 4 * 100) / 100));
}
