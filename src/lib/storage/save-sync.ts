"use client";

import type { Song, UserAcademyStats, YamahaModelId } from "@/types/music";
import {
  getAcademyStats,
  getCustomSongs,
  getStoredModel,
  setStoredModel,
} from "./academy-store";

const BACKUP_PREFIX = "K1100-SAVE:";

export interface FullBackupPayload {
  v: 1;
  exportedAt: string;
  model: YamahaModelId;
  stats: UserAcademyStats;
  customSongs: Song[];
}

function encodeUtf8Base64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeUtf8Base64Url(b64u: string): string {
  const norm = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (norm.length % 4)) % 4;
  const bin = atob(norm + "=".repeat(pad));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Serializes stats, active keyboard model, and custom/AI songs into a portable `K1100-SAVE:` code.
 */
export function encodeFullSaveBackup(
  stats: UserAcademyStats,
  customSongs: Song[],
  model: YamahaModelId,
): string {
  const payload: FullBackupPayload = {
    v: 1,
    exportedAt: new Date().toISOString(),
    model,
    stats,
    customSongs: customSongs.slice(0, 40),
  };
  return `${BACKUP_PREFIX}${encodeUtf8Base64Url(JSON.stringify(payload))}`;
}

export function encodeCurrentLocalBackup(): string {
  return encodeFullSaveBackup(getAcademyStats(), getCustomSongs(), getStoredModel());
}

/**
 * Parses and validates a `K1100-SAVE:` cross-device backup string (or raw JSON backup).
 */
export function decodeFullSaveBackup(rawInput: string): FullBackupPayload | null {
  try {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;
    const jsonText = trimmed.startsWith(BACKUP_PREFIX)
      ? decodeUtf8Base64Url(trimmed.slice(BACKUP_PREFIX.length))
      : trimmed;
    const parsed = JSON.parse(jsonText) as Partial<FullBackupPayload>;
    if (
      parsed.v !== 1 ||
      !parsed.stats ||
      typeof parsed.stats.totalXp !== "number" ||
      !Array.isArray(parsed.customSongs)
    ) {
      return null;
    }
    return parsed as FullBackupPayload;
  } catch {
    return null;
  }
}

/**
 * Merges a decoded backup into existing stats & custom songs (or replaces cleanly).
 */
export function mergeBackupPayloads(
  currentStats: UserAcademyStats,
  currentSongs: Song[],
  incoming: FullBackupPayload,
): { stats: UserAcademyStats; songs: Song[] } {
  const mergedBest = { ...currentStats.bestScores };
  for (const [k, rec] of Object.entries(incoming.stats.bestScores ?? {})) {
    if (!mergedBest[k] || rec.score > mergedBest[k].score) {
      mergedBest[k] = rec;
    }
  }

  const seenIds = new Set<string>();
  const mergedHistory = [...currentStats.recentHistory, ...(incoming.stats.recentHistory ?? [])]
    .filter((h) => {
      if (seenIds.has(h.id)) return false;
      seenIds.add(h.id);
      return true;
    })
    .slice(0, 60);

  const mergedDaily = { ...(currentStats.dailyActivity ?? {}) };
  for (const [dKey, dStat] of Object.entries(incoming.stats.dailyActivity ?? {})) {
    const prev = mergedDaily[dKey];
    if (!prev || dStat.xp > prev.xp) mergedDaily[dKey] = dStat;
  }

  const totalXp = Math.max(currentStats.totalXp, incoming.stats.totalXp);
  const earCurrent = currentStats.earIq;
  const earIncoming = incoming.stats.earIq;
  const mergedEar =
    earIncoming && (!earCurrent || earIncoming.bestIq > earCurrent.bestIq)
      ? earIncoming
      : earCurrent;

  const stats: UserAcademyStats = {
    totalXp,
    level: Math.max(1, Math.floor(Math.sqrt(totalXp / 100)) + 1),
    streakDays: Math.max(currentStats.streakDays, incoming.stats.streakDays),
    lastPracticeDate:
      (incoming.stats.lastPracticeDate ?? "") > (currentStats.lastPracticeDate ?? "")
        ? incoming.stats.lastPracticeDate
        : currentStats.lastPracticeDate,
    songsCleared: Array.from(
      new Set([...currentStats.songsCleared, ...(incoming.stats.songsCleared ?? [])]),
    ),
    bestScores: mergedBest,
    recentHistory: mergedHistory,
    dailyActivity: mergedDaily,
    unlockedVoices: Array.from(
      new Set([...(currentStats.unlockedVoices ?? []), ...(incoming.stats.unlockedVoices ?? [])]),
    ),
    clearedStages: Array.from(
      new Set([...(currentStats.clearedStages ?? []), ...(incoming.stats.clearedStages ?? [])]),
    ),
    dailyPlan: currentStats.dailyPlan ?? incoming.stats.dailyPlan,
    earIq: mergedEar,
  };

  const songMap = new Map<string, Song>();
  for (const s of [...incoming.customSongs, ...currentSongs]) {
    songMap.set(s.id, s);
  }

  return { stats, songs: Array.from(songMap.values()) };
}

/**
 * Applies a `K1100-SAVE:` backup directly to localStorage and triggers reactive UI sync.
 */
export function importFullBackupCode(
  code: string,
  mode: "merge" | "replace" = "merge",
): { songsCount: number; totalXp: number; level: number } | null {
  if (typeof window === "undefined") return null;
  const decoded = decodeFullSaveBackup(code);
  if (!decoded) return null;

  const nextData =
    mode === "replace"
      ? { stats: decoded.stats, songs: decoded.customSongs }
      : mergeBackupPayloads(getAcademyStats(), getCustomSongs(), decoded);

  window.localStorage.setItem("yamaha1100:academy-stats", JSON.stringify(nextData.stats));
  window.localStorage.setItem("yamaha1100:custom-songs", JSON.stringify(nextData.songs));
  setStoredModel(decoded.model);
  window.dispatchEvent(new CustomEvent("yamaha1100:store-change"));

  return {
    songsCount: nextData.songs.length,
    totalXp: nextData.stats.totalXp,
    level: nextData.stats.level,
  };
}
