export type KeyboardModelId = "kbp1100" | "psr1100" | "pxs1100" | "ctk1100" | "wk1100";

export type YamahaModelId = KeyboardModelId;

export interface YamahaHardwareProfile {
  id: KeyboardModelId;
  brand: "YAMAHA" | "CASIO";
  name: string;
  shortName: string;
  keys: 88 | 76 | 61;
  minMidi: number;
  maxMidi: number;
  defaultSplitMidi: number;
  hasMidiPort: boolean;
  actionDescZh: string;
  actionDescEn: string;
  midiPortDescZh: string;
  midiPortDescEn: string;
  defaultVoice: SynthVoiceId;
  voices: string[];
}

export type SynthVoiceId = "grand-piano" | "yamaha-ep" | "guzheng" | "8bit-arcade";

export type HandSide = "right" | "left";

export type PracticeMode = "wait" | "arcade" | "listen" | "free";

export type HandFilter = "both" | "right" | "left";

export interface SongNote {
  id: string;
  midi: number;         // 21..108
  startSec: number;     // absolute time in seconds (at native bpm)
  durationSec: number;  // duration in seconds
  startBeat: number;    // beat position (0-based, quarter note = 1)
  durationBeats: number;
  velocity: number;     // 1..127
  hand: HandSide;
  finger?: 1 | 2 | 3 | 4 | 5;
  chordSymbol?: string; // optional chord label anchored on this beat
}

export interface ChordMarker {
  startBeat: number;
  symbol: string;
}

export interface Song {
  id: string;
  title: string;
  titleZh?: string;
  composer: string;
  category: "classical" | "chinese-folk" | "pop-etude" | "drill" | "imported";
  difficulty: 1 | 2 | 3 | 4 | 5;
  bpm: number;
  timeSignature: [number, number];
  keySignature: string;
  recommendedModel: KeyboardModelId;
  recommendedVoice: SynthVoiceId;
  sourceFormat: "builtin" | "midi" | "jianpu" | "musicxml" | "json" | "audio" | "ai";
  splitMidi: number;
  descriptionZh: string;
  descriptionEn: string;
  notes: SongNote[];
  chords: ChordMarker[];
  createdAt: string;
}

export type HitJudgement = "PERFECT" | "GREAT" | "GOOD" | "MISS";

export interface PlaySessionRecord {
  id: string;
  songId: string;
  songTitle: string;
  model: KeyboardModelId;
  mode: PracticeMode;
  score: number;
  accuracy: number;
  maxCombo: number;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  rank: "S+" | "S" | "A" | "B" | "C";
  xpEarned: number;
  playedAt: string;
}

export interface DailyPracticeStat {
  sessions: number;
  xp: number;
  bestAcc: number;
  notesHit: number;
}

export interface UserAcademyStats {
  totalXp: number;
  level: number;
  streakDays: number;
  lastPracticeDate?: string;
  songsCleared: string[];
  bestScores: Record<string, PlaySessionRecord>;
  recentHistory: PlaySessionRecord[];
  dailyActivity?: Record<string, DailyPracticeStat>;
}
