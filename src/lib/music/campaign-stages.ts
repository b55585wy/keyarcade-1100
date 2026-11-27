import type { PlaySessionRecord, SynthVoiceId, UserAcademyStats } from "@/types/music";

export interface QuestStage {
  id: string;
  chapter: number;
  chapterTitleZh: string;
  chapterTitleEn: string;
  stageCode: string;
  songId: string;
  titleZh: string;
  titleEn: string;
  targetAcc: number;
  rewardXp: number;
  unlockVoice?: SynthVoiceId;
  badgeZh: string;
  badgeEn: string;
  accent: string;
}

export interface QuestStageStatus {
  stage: QuestStage;
  unlocked: boolean;
  cleared: boolean;
  stars: 0 | 1 | 2 | 3;
  bestAccuracy: number;
  bestRank?: PlaySessionRecord["rank"];
}

export const QUEST_STAGES: QuestStage[] = [
  {
    id: "q-1-twinkle",
    chapter: 1,
    chapterTitleZh: "启蒙星光村 · Finger Awakening",
    chapterTitleEn: "Ch.1 · Finger Awakening",
    stageCode: "1-1",
    songId: "twinkle-star",
    titleZh: "星光启蒙曲",
    titleEn: "Starlight First Lesson",
    targetAcc: 75,
    rewardXp: 80,
    badgeZh: "星光徽章",
    badgeEn: "Starlight Crest",
    accent: "#00ff88",
  },
  {
    id: "q-1-ode",
    chapter: 1,
    chapterTitleZh: "启蒙星光村 · Finger Awakening",
    chapterTitleEn: "Ch.1 · Finger Awakening",
    stageCode: "1-2",
    songId: "ode-to-joy",
    titleZh: "五指欢乐试炼",
    titleEn: "Five-Finger Joy Trial",
    targetAcc: 80,
    rewardXp: 110,
    unlockVoice: "lofi-tape",
    badgeZh: "磁带宝箱 · Lo-Fi Tape",
    badgeEn: "Chest: Lo-Fi Tape Voice",
    accent: "#f59e0b",
  },
  {
    id: "q-2-c-dojo",
    chapter: 2,
    chapterTitleZh: "技巧道场 · Scale & Cadence",
    chapterTitleEn: "Ch.2 · Scale & Cadence",
    stageCode: "2-1",
    songId: "c-major-dojo",
    titleZh: "穿指与终止式考验",
    titleEn: "Thumb-Under Dojo",
    targetAcc: 82,
    rewardXp: 140,
    badgeZh: "穿指大师印",
    badgeEn: "Scale Runner Seal",
    accent: "#00d4ff",
  },
  {
    id: "q-2-molihua",
    chapter: 2,
    chapterTitleZh: "技巧道场 · Scale & Cadence",
    chapterTitleEn: "Ch.2 · Scale & Cadence",
    stageCode: "2-2",
    songId: "mo-li-hua",
    titleZh: "东方五声雅集",
    titleEn: "Pentatonic Blossom",
    targetAcc: 84,
    rewardXp: 160,
    badgeZh: "国风雅韵",
    badgeEn: "Jade Blossom",
    accent: "#34d399",
  },
  {
    id: "q-3-farewell",
    chapter: 3,
    chapterTitleZh: "抒情殿堂 · Lyrical Expression",
    chapterTitleEn: "Ch.3 · Lyrical Expression",
    stageCode: "3-1",
    songId: "farewell-song",
    titleZh: "长亭抒情慢板",
    titleEn: "Lyrical Legato Gate",
    targetAcc: 86,
    rewardXp: 200,
    unlockVoice: "warm-strings",
    badgeZh: "交响宝箱 · Warm Strings",
    badgeEn: "Chest: Warm Strings Voice",
    accent: "#a855f7",
  },
  {
    id: "q-4-canon",
    chapter: 4,
    chapterTitleZh: "幻想巅峰 · Baroque & Romantic",
    chapterTitleEn: "Ch.4 · Baroque & Romantic",
    stageCode: "4-1",
    songId: "canon-in-d",
    titleZh: "D 大调巴洛克循环",
    titleEn: "Canon Arpeggio Citadel",
    targetAcc: 88,
    rewardXp: 260,
    unlockVoice: "cyber-synth",
    badgeZh: "霓虹宝箱 · Cyber Synth",
    badgeEn: "Chest: Cyber Synth Voice",
    accent: "#ec4899",
  },
  {
    id: "q-5-furelise",
    chapter: 5,
    chapterTitleZh: "魔王试炼 · Grand Master Boss",
    chapterTitleEn: "Ch.5 · Grand Master Boss",
    stageCode: "BOSS",
    songId: "fur-elise",
    titleZh: "致爱丽丝 · 半音交接终章",
    titleEn: "Für Elise Boss Showdown",
    targetAcc: 90,
    rewardXp: 400,
    badgeZh: "KBP-1100 殿堂王冠",
    badgeEn: "Grandmaster Crown",
    accent: "#ff6a00",
  },
];

export const DEFAULT_UNLOCKED_VOICES: SynthVoiceId[] = [
  "grand-piano",
  "yamaha-ep",
  "guzheng",
  "8bit-arcade",
];

/**
 * Evaluates full RPG quest map progression and unlocked voices cleanly from stats.
 */
export function evaluateCampaignProgress(stats: UserAcademyStats): {
  stages: QuestStageStatus[];
  clearedCount: number;
  totalStars: number;
  unlockedVoices: SynthVoiceId[];
  currentFrontierStage: QuestStageStatus;
} {
  const unlockedSet = new Set<SynthVoiceId>([
    ...DEFAULT_UNLOCKED_VOICES,
    ...(stats.unlockedVoices ?? []),
  ]);

  let prevCleared = true;
  const statuses: QuestStageStatus[] = [];

  for (const stage of QUEST_STAGES) {
    const best = stats.bestScores[stage.songId];
    const bestAccuracy = best?.accuracy ?? 0;
    const manuallyCleared = Boolean(stats.clearedStages?.includes(stage.id));
    const cleared = manuallyCleared || bestAccuracy >= stage.targetAcc;
    const stars: 0 | 1 | 2 | 3 =
      bestAccuracy >= 95
        ? 3
        : bestAccuracy >= stage.targetAcc + 6
          ? 2
          : cleared
            ? 1
            : 0;

    if (cleared && stage.unlockVoice) {
      unlockedSet.add(stage.unlockVoice);
    }

    const unlocked = prevCleared || cleared;
    statuses.push({
      stage,
      unlocked,
      cleared,
      stars,
      bestAccuracy,
      bestRank: best?.rank,
    });
    prevCleared = cleared;
  }

  const clearedCount = statuses.filter((s) => s.cleared).length;
  const totalStars = statuses.reduce((acc, s) => acc + s.stars, 0);
  const currentFrontierStage =
    statuses.find((s) => s.unlocked && !s.cleared) ?? statuses[statuses.length - 1];

  return {
    stages: statuses,
    clearedCount,
    totalStars,
    unlockedVoices: Array.from(unlockedSet),
    currentFrontierStage,
  };
}
