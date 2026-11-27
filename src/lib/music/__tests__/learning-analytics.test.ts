import { describe, expect, it } from "vitest";
import { buildDemoPreviewStats, computeLearningTelemetry } from "../learning-analytics";
import { evaluateCampaignProgress } from "../campaign-stages";
import { BUILTIN_SONGS } from "../builtin-songs";

describe("learning-analytics & campaign progression", () => {
  it("computes telemetry curve, positive trend delta, and spaced review priority", () => {
    const stats = buildDemoPreviewStats(new Date("2026-11-28T10:00:00Z"));
    const telemetry = computeLearningTelemetry(stats, BUILTIN_SONGS, new Date("2026-11-28T10:00:00Z"));

    expect(telemetry.sessionCurve.length).toBe(7);
    expect(telemetry.avgAccuracy).toBeGreaterThan(80);
    expect(telemetry.accuracyDelta).toBeGreaterThan(0);
    expect(telemetry.reviewQueue.length).toBeGreaterThan(0);
  });

  it("unlocks reward synth voices automatically when clearing campaign stages", () => {
    const stats = buildDemoPreviewStats();
    // Inject passing Ode to Joy score (>= 80%) to clear Stage 1-2 & unlock Lo-Fi Tape
    stats.bestScores["ode-to-joy"] = {
      id: "pass-ode",
      songId: "ode-to-joy",
      songTitle: "Ode to Joy",
      model: "kbp1100",
      mode: "arcade",
      score: 9200,
      accuracy: 88,
      maxCombo: 25,
      perfectCount: 20,
      greatCount: 5,
      goodCount: 1,
      missCount: 1,
      rank: "A",
      xpEarned: 160,
      playedAt: "2026-11-28T00:00:00Z",
    };

    const progress = evaluateCampaignProgress(stats);
    expect(progress.unlockedVoices).toContain("lofi-tape");
    expect(progress.stages[1].cleared).toBe(true);
  });
});
