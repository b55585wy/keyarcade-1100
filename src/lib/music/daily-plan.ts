import type { Song, UserAcademyStats } from "@/types/music";
import { evaluateCampaignProgress } from "./campaign-stages";
import { computeLearningTelemetry } from "./learning-analytics";
import { toLocalDateKey } from "@/lib/storage/academy-store";

export interface DailyCapsuleStep {
  id: "capsule-warmup" | "capsule-review" | "capsule-frontier";
  order: 1 | 2 | 3;
  minutes: number;
  titleZh: string;
  titleEn: string;
  subtitleZh: string;
  subtitleEn: string;
  href: string;
  songId?: string;
  completed: boolean;
  accent: string;
}

export interface DailyPracticeCapsule {
  dateKey: string;
  steps: DailyCapsuleStep[];
  completedCount: number;
  totalMinutes: number;
  nextStep: DailyCapsuleStep | null;
}

/**
 * Generates today's personalized 10-minute 3-step practice capsule:
 * 1) 2-min Warmup / Ear IQ or Finger Dojo
 * 2) 4-min Ebbinghaus Spaced Repetition Review Song
 * 3) 4-min RPG Frontier Progression Song
 */
export function computeDailyCapsule(
  stats: UserAcademyStats,
  songs: Song[],
  now = new Date(),
): DailyPracticeCapsule {
  const dateKey = toLocalDateKey(now);
  const doneIds =
    stats.dailyPlan?.date === dateKey ? stats.dailyPlan.completedStepIds : [];

  const telemetry = computeLearningTelemetry(stats, songs, now);
  const campaign = evaluateCampaignProgress(stats);

  const reviewItem = telemetry.reviewQueue[0];
  const reviewSong =
    (reviewItem && songs.find((s) => s.id === reviewItem.songId)) ??
    songs.find((s) => s.id === "twinkle-star") ??
    songs[0];

  const frontierStage = campaign.currentFrontierStage;
  const frontierSong =
    songs.find((s) => s.id === frontierStage.stage.songId) ?? songs[0];

  const reviewDone =
    doneIds.includes("capsule-review") ||
    stats.recentHistory.some(
      (r) =>
        reviewSong &&
        r.songId === reviewSong.id &&
        toLocalDateKey(r.playedAt) === dateKey,
    );

  const frontierDone =
    doneIds.includes("capsule-frontier") ||
    stats.recentHistory.some(
      (r) =>
        frontierSong &&
        r.songId === frontierSong.id &&
        toLocalDateKey(r.playedAt) === dateKey,
    );

  const warmupDone =
    doneIds.includes("capsule-warmup") ||
    (stats.earIq?.lastPlayedAt !== undefined &&
      toLocalDateKey(stats.earIq.lastPlayedAt) === dateKey) ||
    stats.recentHistory.some(
      (r) =>
        (r.songId.startsWith("drill-") || r.songId === "c-major-dojo") &&
        toLocalDateKey(r.playedAt) === dateKey,
    );

  const steps: DailyCapsuleStep[] = [
    {
      id: "capsule-warmup",
      order: 1,
      minutes: 2,
      titleZh: "2m 音感 & 和弦热身",
      titleEn: "2m Ear IQ & Chord Warmup",
      subtitleZh: "1 分钟盲测 + 三和弦指法激活",
      subtitleEn: "60s Ear IQ + Triads warmup",
      href: "/drills?tab=ear-iq&capsule=capsule-warmup",
      completed: warmupDone,
      accent: "#00d4ff",
    },
    {
      id: "capsule-review",
      order: 2,
      minutes: 4,
      titleZh: reviewItem
        ? `4m 记忆复习 · ${reviewSong?.titleZh ?? reviewItem.songTitle}`
        : `4m 经典复习 · ${reviewSong?.titleZh ?? "小星星"}`,
      titleEn: reviewItem
        ? `4m Memory Review · ${reviewSong?.title ?? reviewItem.songTitle}`
        : `4m Classic Review · ${reviewSong?.title ?? "Twinkle Star"}`,
      subtitleZh: reviewItem
        ? `艾宾浩斯保持率 ${reviewItem.retentionPct}% · 推荐巩固`
        : "用 Slower 0.9x 或 Wait 模式找回手感",
      subtitleEn: reviewItem
        ? `Ebbinghaus retention ${reviewItem.retentionPct}% · Refresh now`
        : "Solidify muscle memory in Wait Mode",
      href: `/arcade?song=${encodeURIComponent(reviewSong?.id ?? "twinkle-star")}&mode=wait&capsule=capsule-review`,
      songId: reviewSong?.id,
      completed: reviewDone,
      accent: "#00ff88",
    },
    {
      id: "capsule-frontier",
      order: 3,
      minutes: 4,
      titleZh: `4m 闯关推进 · ${frontierStage.stage.stageCode} ${frontierStage.stage.titleZh}`,
      titleEn: `4m Quest Push · ${frontierStage.stage.stageCode} ${frontierStage.stage.titleEn}`,
      subtitleZh: frontierStage.stage.unlockVoice
        ? `目标 ≥ ${frontierStage.stage.targetAcc}% 解锁限定音色`
        : `目标准确率 ≥ ${frontierStage.stage.targetAcc}% 赢取 +${frontierStage.stage.rewardXp}XP`,
      subtitleEn: `Reach ≥ ${frontierStage.stage.targetAcc}% acc for +${frontierStage.stage.rewardXp}XP`,
      href: `/arcade?song=${encodeURIComponent(frontierSong?.id ?? "twinkle-star")}&mode=wait&capsule=capsule-frontier`,
      songId: frontierSong?.id,
      completed: frontierDone,
      accent: "#ff6a00",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  return {
    dateKey,
    steps,
    completedCount,
    totalMinutes: 10,
    nextStep: steps.find((s) => !s.completed) ?? null,
  };
}
