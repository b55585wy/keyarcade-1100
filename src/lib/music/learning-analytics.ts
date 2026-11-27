import type { PlaySessionRecord, Song, UserAcademyStats } from "@/types/music";

export interface SessionCurvePoint {
  index: number;
  id: string;
  shortLabel: string;
  songTitle: string;
  accuracy: number;
  movingAvgAcc: number;
  perfectRate: number;
  score: number;
  cumulativeXp: number;
  xpEarned: number;
  rank: PlaySessionRecord["rank"];
  playedAt: string;
}

export interface DailyPracticeBar {
  dateKey: string;
  shortLabel: string;
  sessions: number;
  xp: number;
  bestAcc: number;
  notesHit: number;
}

export interface SkillMetric {
  id: string;
  labelZh: string;
  labelEn: string;
  value: number; // 0..100
  detailZh: string;
  detailEn: string;
  color: string;
}

export interface ReviewSongRecommendation {
  songId: string;
  songTitle: string;
  lastAccuracy: number;
  rank: PlaySessionRecord["rank"];
  daysAgo: number;
  retentionPct: number;
  reasonZh: string;
  reasonEn: string;
}

export interface DailyQuestItem {
  id: string;
  titleZh: string;
  titleEn: string;
  current: number;
  target: number;
  completed: boolean;
  rewardXp: number;
}

export interface AchievementBadge {
  id: string;
  titleZh: string;
  titleEn: string;
  descZh: string;
  descEn: string;
  unlocked: boolean;
  color: string;
}

export interface LearningTelemetry {
  sessionCurve: SessionCurvePoint[];
  dailyBars14: DailyPracticeBar[];
  skillMetrics: SkillMetric[];
  reviewQueue: ReviewSongRecommendation[];
  nextRecommendedSong: Song | null;
  dailyQuests: DailyQuestItem[];
  badges: AchievementBadge[];
  avgAccuracy: number;
  accuracyDelta: number; // latest MA minus earliest MA
  activeDays14: number;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function stabilityDaysForRank(rank: PlaySessionRecord["rank"], accuracy: number): number {
  if (rank === "S+" || accuracy >= 96) return 10;
  if (rank === "S" || accuracy >= 90) return 7;
  if (rank === "A" || accuracy >= 80) return 5;
  if (rank === "B") return 3;
  return 1.8;
}

/**
 * Computes scientific learning analytics from player session history & stats:
 * - Chronological accuracy curve + 3-session moving average
 * - Cumulative XP climb curve
 * - 14-day consistency heatmap bars
 * - 5-dimension skill profile
 * - Ebbinghaus retention queue for spaced repetition review
 * - Daily quests & achievement badges
 */
export function computeLearningTelemetry(
  stats: UserAcademyStats,
  songs: Song[],
  now = new Date(),
): LearningTelemetry {
  const chrono = [...stats.recentHistory].reverse();

  let runningXp = Math.max(
    0,
    stats.totalXp - chrono.reduce((acc, r) => acc + (r.xpEarned || 0), 0),
  );
  const sessionCurve: SessionCurvePoint[] = chrono.map((r, idx) => {
    runningXp += r.xpEarned || 0;
    const totalJudged = Math.max(
      1,
      r.perfectCount + r.greatCount + r.goodCount + r.missCount,
    );
    const perfectRate = Math.round((r.perfectCount / totalJudged) * 100);

    const winStart = Math.max(0, idx - 2);
    const winSlice = chrono.slice(winStart, idx + 1);
    const movingAvgAcc = Math.round(
      winSlice.reduce((sum, item) => sum + item.accuracy, 0) / winSlice.length,
    );

    const dt = new Date(r.playedAt);
    const shortLabel = Number.isNaN(dt.getTime())
      ? `#${idx + 1}`
      : `${dt.getMonth() + 1}/${dt.getDate()}`;

    return {
      index: idx + 1,
      id: r.id,
      shortLabel,
      songTitle: r.songTitle,
      accuracy: r.accuracy,
      movingAvgAcc,
      perfectRate,
      score: r.score,
      cumulativeXp: runningXp,
      xpEarned: r.xpEarned,
      rank: r.rank,
      playedAt: r.playedAt,
    };
  });

  // Backfill daily buckets from recentHistory when older records lack dailyActivity entries
  const dailyMap = new Map<string, { sessions: number; xp: number; bestAcc: number; notesHit: number }>();
  for (const r of chrono) {
    const dt = new Date(r.playedAt);
    const key = Number.isNaN(dt.getTime()) ? localDateKey(now) : localDateKey(dt);
    const cur = dailyMap.get(key) ?? { sessions: 0, xp: 0, bestAcc: 0, notesHit: 0 };
    cur.sessions += 1;
    cur.xp += r.xpEarned;
    cur.bestAcc = Math.max(cur.bestAcc, r.accuracy);
    cur.notesHit += r.perfectCount + r.greatCount + r.goodCount;
    dailyMap.set(key, cur);
  }
  if (stats.dailyActivity) {
    for (const [k, v] of Object.entries(stats.dailyActivity)) {
      const cur = dailyMap.get(k);
      if (!cur || v.sessions >= cur.sessions) {
        dailyMap.set(k, v);
      }
    }
  }

  const dailyBars14: DailyPracticeBar[] = [];
  for (let offset = 13; offset >= 0; offset--) {
    const d = new Date(now.getTime() - offset * 86_400_000);
    const dateKey = localDateKey(d);
    const stat = dailyMap.get(dateKey);
    dailyBars14.push({
      dateKey,
      shortLabel: `${d.getMonth() + 1}/${d.getDate()}`,
      sessions: stat?.sessions ?? 0,
      xp: stat?.xp ?? 0,
      bestAcc: stat?.bestAcc ?? 0,
      notesHit: stat?.notesHit ?? 0,
    });
  }

  const avgAccuracy =
    sessionCurve.length > 0
      ? Math.round(sessionCurve.reduce((s, p) => s + p.accuracy, 0) / sessionCurve.length)
      : 0;
  const accuracyDelta =
    sessionCurve.length >= 2
      ? sessionCurve[sessionCurve.length - 1].movingAvgAcc - sessionCurve[0].movingAvgAcc
      : 0;
  const avgPerfectRate =
    sessionCurve.length > 0
      ? Math.round(sessionCurve.reduce((s, p) => s + p.perfectRate, 0) / sessionCurve.length)
      : 0;
  const bestComboOverall = Object.values(stats.bestScores).reduce(
    (mx, r) => Math.max(mx, r.maxCombo),
    0,
  );
  const activeDays14 = dailyBars14.filter((d) => d.sessions > 0).length;
  const breadthPct = Math.min(
    100,
    Math.round((stats.songsCleared.length / Math.max(1, Math.min(songs.length, 20))) * 100),
  );
  const habitPct = Math.min(100, Math.round(((stats.streakDays * 12) + activeDays14 * 7)));

  const skillMetrics: SkillMetric[] = [
    {
      id: "accuracy",
      labelZh: "音准准确率",
      labelEn: "Pitch Accuracy",
      value: avgAccuracy,
      detailZh: `均值 ${avgAccuracy}%`,
      detailEn: `Avg ${avgAccuracy}%`,
      color: "#00ff88",
    },
    {
      id: "timing",
      labelZh: "节奏精准度 (PERFECT)",
      labelEn: "Timing Precision",
      value: avgPerfectRate,
      detailZh: `PERFECT 占比 ${avgPerfectRate}%`,
      detailEn: `PERFECT ${avgPerfectRate}%`,
      color: "#ff6a00",
    },
    {
      id: "combo",
      labelZh: "连击流畅度",
      labelEn: "Combo Flow",
      value: Math.min(100, bestComboOverall * 2),
      detailZh: `最高连击 ${bestComboOverall}x`,
      detailEn: `Best ${bestComboOverall}x`,
      color: "#00d4ff",
    },
    {
      id: "breadth",
      labelZh: "曲库通关广度",
      labelEn: "Repertoire",
      value: breadthPct,
      detailZh: `已通关 ${stats.songsCleared.length} 首`,
      detailEn: `${stats.songsCleared.length} cleared`,
      color: "#a855f7",
    },
    {
      id: "habit",
      labelZh: "坚持规律性",
      labelEn: "Consistency",
      value: habitPct,
      detailZh: `连续 ${stats.streakDays} 天 · 近两周活跃 ${activeDays14} 天`,
      detailEn: `${stats.streakDays}d streak · ${activeDays14}/14d`,
      color: "#eab308",
    },
  ];

  // Ebbinghaus retention queue across practiced songs
  const latestBySong = new Map<string, PlaySessionRecord>();
  for (const r of stats.recentHistory) {
    if (!latestBySong.has(r.songId)) latestBySong.set(r.songId, r);
  }
  for (const [id, r] of Object.entries(stats.bestScores)) {
    if (!latestBySong.has(id)) latestBySong.set(id, r);
  }

  const reviewQueue: ReviewSongRecommendation[] = Array.from(latestBySong.values())
    .filter((r) => !r.songId.startsWith("drill-"))
    .map((r) => {
      const playedMs = new Date(r.playedAt).getTime();
      const daysAgo = Number.isNaN(playedMs)
        ? 0
        : Math.max(0, (now.getTime() - playedMs) / 86_400_000);
      const stability = stabilityDaysForRank(r.rank, r.accuracy);
      const retentionPct = Math.max(
        18,
        Math.min(100, Math.round(100 * Math.exp(-daysAgo / stability))),
      );

      let reasonZh = "记忆稳固，可冲刺更高评级";
      let reasonEn = "Solid retention — push for higher rank";
      if (r.accuracy < 80) {
        reasonZh = `上次准确率仅 ${r.accuracy}%，建议跟弹等待模式巩固`;
        reasonEn = `${r.accuracy}% last run — reinforce in Wait Mode`;
      } else if (retentionPct < 75) {
        reasonZh = `距上次练习约 ${Math.round(daysAgo)} 天，艾宾浩斯遗忘临界点，建议复习`;
        reasonEn = `${Math.round(daysAgo)}d since last run — due for spaced review`;
      }

      return {
        songId: r.songId,
        songTitle: r.songTitle,
        lastAccuracy: r.accuracy,
        rank: r.rank,
        daysAgo: Number(daysAgo.toFixed(1)),
        retentionPct,
        reasonZh,
        reasonEn,
      };
    })
    .sort((a, b) => a.retentionPct - b.retentionPct || a.lastAccuracy - b.lastAccuracy)
    .slice(0, 5);

  const clearedSet = new Set(stats.songsCleared);
  const targetDifficulty = stats.level >= 5 ? 3 : stats.level >= 3 ? 2 : 1;
  const nextRecommendedSong =
    songs
      .filter((s) => !clearedSet.has(s.id) && s.category !== "drill")
      .sort(
        (a, b) =>
          Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty) ||
          a.difficulty - b.difficulty,
      )[0] ?? songs[0] ?? null;

  const todayStat = dailyMap.get(localDateKey(now)) ?? {
    sessions: 0,
    xp: 0,
    bestAcc: 0,
    notesHit: 0,
  };

  const dailyQuests: DailyQuestItem[] = [
    {
      id: "q-warmup",
      titleZh: "今日练琴打卡：完成 2 局曲目/道场训练",
      titleEn: "Daily Warmup: Complete 2 sessions today",
      current: Math.min(2, todayStat.sessions),
      target: 2,
      completed: todayStat.sessions >= 2,
      rewardXp: 80,
    },
    {
      id: "q-acc",
      titleZh: "精准控制：今日任意曲目达到 85% 以上准确率",
      titleEn: "Sharp Ear: Reach 85%+ accuracy on a run today",
      current: Math.min(85, todayStat.bestAcc),
      target: 85,
      completed: todayStat.bestAcc >= 85,
      rewardXp: 100,
    },
    {
      id: "q-notes",
      titleZh: "指尖热力：今日累计准确弹对 60 个音符",
      titleEn: "Finger Mileage: Hit 60 notes today",
      current: Math.min(60, todayStat.notesHit),
      target: 60,
      completed: todayStat.notesHit >= 60,
      rewardXp: 120,
    },
  ];

  const hasSPlus = Object.values(stats.bestScores).some((r) => r.rank === "S+");
  const badges: AchievementBadge[] = [
    {
      id: "first-note",
      titleZh: "初次登台",
      titleEn: "First Stage",
      descZh: "完成第 1 次练琴记录",
      descEn: "Finish your 1st scored run",
      unlocked: stats.recentHistory.length >= 1,
      color: "#00ff88",
    },
    {
      id: "combo-20",
      titleZh: "20 连击手感",
      titleEn: "20x Combo Flow",
      descZh: "单曲达到 20 以上连击",
      descEn: "Reach 20+ note combo",
      unlocked: bestComboOverall >= 20,
      color: "#00d4ff",
    },
    {
      id: "s-plus",
      titleZh: "S+ 大师级",
      titleEn: "S+ Virtuoso",
      descZh: "获得至少 1 个 S+ 评级 (96%+)",
      descEn: "Earn an S+ rank (96%+)",
      unlocked: hasSPlus,
      color: "#ff6a00",
    },
    {
      id: "five-cleared",
      titleZh: "五曲通关",
      titleEn: "5 Songs Cleared",
      descZh: "累计通关 5 首不同曲目",
      descEn: "Clear 5 different songs",
      unlocked: stats.songsCleared.length >= 5,
      color: "#a855f7",
    },
    {
      id: "streak-3",
      titleZh: "三日不辍",
      titleEn: "3-Day Streak",
      descZh: "保持连续 3 天练琴记录",
      descEn: "Practice 3 consecutive days",
      unlocked: stats.streakDays >= 3,
      color: "#eab308",
    },
    {
      id: "lv-5",
      titleZh: "Lv.5 街机演奏家",
      titleEn: "Lv.5 Performer",
      descZh: "总经验升级至 Lv.5",
      descEn: "Reach Academy Level 5",
      unlocked: stats.level >= 5,
      color: "#ec4899",
    },
  ];

  return {
    sessionCurve,
    dailyBars14,
    skillMetrics,
    reviewQueue,
    nextRecommendedSong,
    dailyQuests,
    badges,
    avgAccuracy,
    accuracyDelta,
    activeDays14,
  };
}

/**
 * Deterministic 7-day sample telemetry shown ONLY when the user clicks "Demo Preview"
 * before recording their own real sessions. Never saved into localStorage.
 */
export function buildDemoPreviewStats(now = new Date()): UserAcademyStats {
  const entries: {
    daysAgo: number;
    songId: string;
    songTitle: string;
    accuracy: number;
    combo: number;
    xp: number;
    rank: PlaySessionRecord["rank"];
  }[] = [
    { daysAgo: 6, songId: "twinkle-star", songTitle: "小星星 · 双手启蒙第一课", accuracy: 66, combo: 8, xp: 95, rank: "C" },
    { daysAgo: 5, songId: "twinkle-star", songTitle: "小星星 · 双手启蒙第一课", accuracy: 74, combo: 13, xp: 120, rank: "B" },
    { daysAgo: 4, songId: "ode-to-joy", songTitle: "欢乐颂 (主题入门)", accuracy: 79, combo: 16, xp: 140, rank: "B" },
    { daysAgo: 3, songId: "ode-to-joy", songTitle: "欢乐颂 (主题入门)", accuracy: 86, combo: 24, xp: 175, rank: "A" },
    { daysAgo: 2, songId: "twinkle-star", songTitle: "小星星 · 双手启蒙第一课", accuracy: 91, combo: 30, xp: 190, rank: "S" },
    { daysAgo: 1, songId: "canon-in-d", songTitle: "卡农 (D大调经典循环和弦)", accuracy: 88, combo: 27, xp: 205, rank: "A" },
    { daysAgo: 0, songId: "ode-to-joy", songTitle: "欢乐颂 (主题入门)", accuracy: 96, combo: 38, xp: 240, rank: "S+" },
  ];

  const recentHistory: PlaySessionRecord[] = [...entries]
    .reverse()
    .map((e, idx) => {
      const ts = new Date(now.getTime() - e.daysAgo * 86_400_000).toISOString();
      const perfect = Math.round(e.accuracy * 0.35);
      const great = 8;
      const miss = Math.max(0, 40 - perfect - great);
      return {
        id: `demo-${idx}`,
        songId: e.songId,
        songTitle: e.songTitle,
        model: idx % 2 === 0 ? "ctk1100" : "kbp1100",
        mode: "arcade",
        score: e.accuracy * 120 + e.combo * 35,
        accuracy: e.accuracy,
        maxCombo: e.combo,
        perfectCount: perfect,
        greatCount: great,
        goodCount: 4,
        missCount: miss,
        rank: e.rank,
        xpEarned: e.xp,
        playedAt: ts,
      };
    });

  const bestScores: Record<string, PlaySessionRecord> = {};
  for (const r of recentHistory) {
    if (!bestScores[r.songId] || r.score > bestScores[r.songId].score) {
      bestScores[r.songId] = r;
    }
  }

  return {
    totalXp: entries.reduce((s, e) => s + e.xp, 0),
    level: 4,
    streakDays: 7,
    lastPracticeDate: localDateKey(now),
    songsCleared: ["twinkle-star", "ode-to-joy", "canon-in-d"],
    bestScores,
    recentHistory,
  };
}
