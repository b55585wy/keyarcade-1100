import { describe, expect, it } from "vitest";
import {
  decodeFullSaveBackup,
  encodeFullSaveBackup,
  mergeBackupPayloads,
} from "../save-sync";
import type { UserAcademyStats } from "@/types/music";

describe("cross-device save-sync", () => {
  const baseStats: UserAcademyStats = {
    totalXp: 150,
    level: 2,
    streakDays: 2,
    lastPracticeDate: "2026-11-26",
    songsCleared: ["twinkle-star"],
    bestScores: {},
    recentHistory: [],
    unlockedVoices: ["grand-piano"],
    clearedStages: ["q-1-twinkle"],
  };

  it("encodes, decodes, and safely merges K1100-SAVE payloads across devices", () => {
    const incomingStats: UserAcademyStats = {
      ...baseStats,
      totalXp: 520,
      level: 3,
      streakDays: 4,
      lastPracticeDate: "2026-11-28",
      songsCleared: ["ode-to-joy"],
      unlockedVoices: ["grand-piano", "lofi-tape"],
      clearedStages: ["q-1-ode"],
      earIq: { bestScore: 700, bestIq: 124, bestAccuracy: 90, attempts: 2 },
    };

    const encoded = encodeFullSaveBackup(incomingStats, [], "kbp1100");
    expect(encoded.startsWith("K1100-SAVE:")).toBe(true);

    const decoded = decodeFullSaveBackup(encoded);
    expect(decoded).not.toBeNull();

    const merged = mergeBackupPayloads(baseStats, [], decoded!);
    expect(merged.stats.totalXp).toBe(520);
    expect(merged.stats.streakDays).toBe(4);
    expect(merged.stats.songsCleared).toEqual(
      expect.arrayContaining(["twinkle-star", "ode-to-joy"]),
    );
    expect(merged.stats.unlockedVoices).toEqual(
      expect.arrayContaining(["grand-piano", "lofi-tape"]),
    );
    expect(merged.stats.earIq?.bestIq).toBe(124);
  });

  it("rejects corrupted backup strings cleanly", () => {
    expect(decodeFullSaveBackup("garbage-string")).toBeNull();
    expect(decodeFullSaveBackup("K1100-SAVE:!!!")).toBeNull();
  });
});
