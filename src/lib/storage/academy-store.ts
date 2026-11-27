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
  streakDays: 0,
  songsCleared: [],
  bestScores: {},
  recentHistory: [],
  dailyActivity: {},
};

export function toLocalDateKey(isoOrDate: string | Date = new Date()): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return toLocalDateKey(new Date());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calendarDaysBetween(earlierKey: string, laterKey: string): number {
  const [y1, m1, d1] = earlierKey.split("-").map(Number);
  const [y2, m2, d2] = laterKey.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 999;
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86_400_000);
}

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

  const dayKey = toLocalDateKey(record.playedAt);
  let nextStreak = prev.streakDays || 0;
  if (!prev.lastPracticeDate) {
    nextStreak = 1;
  } else {
    const gap = calendarDaysBetween(prev.lastPracticeDate, dayKey);
    if (gap === 0) nextStreak = Math.max(1, prev.streakDays || 1);
    else if (gap === 1) nextStreak = (prev.streakDays || 0) + 1;
    else if (gap > 1) nextStreak = 1;
  }

  const prevDaily = prev.dailyActivity ?? {};
  const todayPrev = prevDaily[dayKey] ?? { sessions: 0, xp: 0, bestAcc: 0, notesHit: 0 };
  const notesHit = record.perfectCount + record.greatCount + record.goodCount;
  const dailyActivity = {
    ...prevDaily,
    [dayKey]: {
      sessions: todayPrev.sessions + 1,
      xp: todayPrev.xp + record.xpEarned,
      bestAcc: Math.max(todayPrev.bestAcc, record.accuracy),
      notesHit: todayPrev.notesHit + notesHit,
    },
  };

  const next: UserAcademyStats = {
    totalXp: nextXp,
    level: nextLevel,
    streakDays: nextStreak,
    lastPracticeDate: dayKey,
    songsCleared,
    bestScores,
    recentHistory: [record, ...prev.recentHistory].slice(0, 60),
    dailyActivity,
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
