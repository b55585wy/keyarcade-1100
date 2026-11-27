"use client";

import type { PlaySessionRecord, Song, UserAcademyStats, YamahaModelId } from "@/types/music";
import { BUILTIN_SONGS } from "@/lib/music/builtin-songs";

const CUSTOM_SONGS_KEY = "yamaha1100:custom-songs";
const STATS_KEY = "yamaha1100:academy-stats";
const MODEL_KEY = "yamaha1100:hardware-model";
const CHANGE_EVENT = "yamaha1100:store-change";

const DEFAULT_STATS: UserAcademyStats = {
  totalXp: 0,
  level: 1,
  streakDays: 1,
  songsCleared: [],
  bestScores: {},
  recentHistory: [],
};

export function computeLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}

const VALID_MODELS = new Set<YamahaModelId>([
  "kbp1100",
  "psr1100",
  "pxs1100",
  "ctk1100",
  "wk1100",
]);

export function getStoredModel(): YamahaModelId {
  if (typeof window === "undefined") return "kbp1100";
  const v = window.localStorage.getItem(MODEL_KEY) as YamahaModelId | null;
  return v && VALID_MODELS.has(v) ? v : "kbp1100";
}

export function setStoredModel(model: YamahaModelId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODEL_KEY, model);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getCustomSongs(): Song[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_SONGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAllSongs(): Song[] {
  return [...getCustomSongs(), ...BUILTIN_SONGS];
}

export function saveCustomSong(song: Song) {
  if (typeof window === "undefined") return;
  const current = getCustomSongs().filter((s) => s.id !== song.id);
  const next = [song, ...current];
  window.localStorage.setItem(CUSTOM_SONGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function deleteCustomSong(songId: string) {
  if (typeof window === "undefined") return;
  const next = getCustomSongs().filter((s) => s.id !== songId);
  window.localStorage.setItem(CUSTOM_SONGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getAcademyStats(): UserAcademyStats {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return DEFAULT_STATS;
    const merged = { ...DEFAULT_STATS, ...JSON.parse(raw) } as UserAcademyStats;
    merged.level = computeLevelFromXp(merged.totalXp);
    return merged;
  } catch {
    return DEFAULT_STATS;
  }
}

export function recordPlaySession(record: PlaySessionRecord): UserAcademyStats {
  const prev = getAcademyStats();
  const nextXp = prev.totalXp + record.xpEarned;
  const nextLevel = computeLevelFromXp(nextXp);

  const prevBest = prev.bestScores[record.songId];
  const bestScores = {
    ...prev.bestScores,
    [record.songId]: !prevBest || record.score > prevBest.score ? record : prevBest,
  };

  const songsCleared =
    record.accuracy >= 70 && !prev.songsCleared.includes(record.songId)
      ? [...prev.songsCleared, record.songId]
      : prev.songsCleared;

  const next: UserAcademyStats = {
    totalXp: nextXp,
    level: nextLevel,
    streakDays: prev.streakDays,
    songsCleared,
    bestScores,
    recentHistory: [record, ...prev.recentHistory].slice(0, 30),
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
  return next;
}

export function subscribeStore(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}
