import type { ArrangerStyleId } from "@/types/music";
import { audioEngine } from "./audio-engine";
import { chordToMidiNotes } from "./theory";

export interface ArrangerStyleMeta {
  id: ArrangerStyleId;
  code: string;
  labelZh: string;
  labelEn: string;
  stepsPerCycle: number;
  defaultBpm: number;
  accent: string;
}

export const ARRANGER_STYLES: ArrangerStyleMeta[] = [
  {
    id: "off",
    code: "000",
    labelZh: "关闭自动伴奏",
    labelEn: "Style Off",
    stepsPerCycle: 16,
    defaultBpm: 96,
    accent: "#666677",
  },
  {
    id: "8beat-pop",
    code: "001",
    labelZh: "8-Beat 流行摇滚",
    labelEn: "8-Beat Pop Rock",
    stepsPerCycle: 16,
    defaultBpm: 98,
    accent: "#ff6a00",
  },
  {
    id: "bossa-nova",
    code: "028",
    labelZh: "Bossa Nova 爵士",
    labelEn: "Bossa Nova Lounge",
    stepsPerCycle: 16,
    defaultBpm: 112,
    accent: "#00d4ff",
  },
  {
    id: "lofi-chill",
    code: "042",
    labelZh: "Lo-Fi 懒散律动",
    labelEn: "Lo-Fi Chillhop",
    stepsPerCycle: 16,
    defaultBpm: 78,
    accent: "#f59e0b",
  },
  {
    id: "guofeng-pentatonic",
    code: "108",
    labelZh: "国风五声雅韵",
    labelEn: "Guofeng Folk",
    stepsPerCycle: 16,
    defaultBpm: 88,
    accent: "#00ff88",
  },
  {
    id: "waltz-34",
    code: "064",
    labelZh: "3/4 圆舞曲",
    labelEn: "Vienna Waltz 3/4",
    stepsPerCycle: 12,
    defaultBpm: 108,
    accent: "#a855f7",
  },
  {
    id: "synthwave-arcade",
    code: "888",
    labelZh: "80s 霓虹合成波",
    labelEn: "Arcade Synthwave",
    stepsPerCycle: 16,
    defaultBpm: 116,
    accent: "#ec4899",
  },
];

interface StepPattern {
  kick: number[];
  snare: number[];
  hat: number[];
  openhat?: number[];
  rim?: number[];
  bassOffsets: Record<number, number>; // step -> semitone offset from chord root (MIDI octave 2/3)
  compSteps: number[];
  arpSteps?: number[];
}

const STYLE_PATTERNS: Record<Exclude<ArrangerStyleId, "off">, StepPattern> = {
  "8beat-pop": {
    kick: [0, 6, 8, 10],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    openhat: [14],
    bassOffsets: { 0: 0, 3: 0, 6: 7, 8: 0, 10: 7, 14: 12 },
    compSteps: [2, 6, 10, 14],
  },
  "bossa-nova": {
    kick: [0, 3, 6, 8, 11, 14],
    snare: [],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    rim: [0, 3, 6, 10, 12],
    bassOffsets: { 0: 0, 6: 7, 8: 0, 14: 7 },
    compSteps: [0, 6, 10, 13],
  },
  "lofi-chill": {
    kick: [0, 5, 8, 13],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    rim: [7, 15],
    bassOffsets: { 0: 0, 8: 7, 11: 5 },
    compSteps: [0, 10],
    arpSteps: [3, 7, 15],
  },
  "guofeng-pentatonic": {
    kick: [0, 8],
    snare: [],
    hat: [4, 12],
    rim: [0, 4, 8, 12, 14],
    bassOffsets: { 0: 0, 8: 7 },
    compSteps: [0, 8],
    arpSteps: [2, 4, 6, 10, 12, 14],
  },
  "waltz-34": {
    kick: [0],
    snare: [4, 8],
    hat: [0, 2, 4, 6, 8, 10],
    bassOffsets: { 0: 0, 6: 7 },
    compSteps: [4, 8],
  },
  "synthwave-arcade": {
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
    openhat: [14],
    bassOffsets: { 0: 0, 2: 12, 4: 0, 6: 12, 8: 0, 10: 12, 12: 7, 14: 12 },
    compSteps: [0, 8],
    arpSteps: [1, 3, 5, 7, 9, 11, 13, 15],
  },
};

/**
 * Triggers one 16th-note step of procedural WebAudio drums + chord bass + comp/arp.
 */
export function triggerArrangerStep(
  styleId: ArrangerStyleId,
  stepIndex: number,
  chordSymbol: string,
  bpm: number,
  level = 0.24,
) {
  if (styleId === "off") return;
  const meta = ARRANGER_STYLES.find((s) => s.id === styleId);
  const pattern = STYLE_PATTERNS[styleId];
  if (!meta || !pattern) return;

  const step = ((stepIndex % meta.stepsPerCycle) + meta.stepsPerCycle) % meta.stepsPerCycle;
  const stepSec = 60 / Math.max(40, bpm) / 4;

  if (pattern.kick.includes(step)) audioEngine.triggerDrumHit("kick", level);
  if (pattern.snare.includes(step)) audioEngine.triggerDrumHit("snare", level * 0.9);
  if (pattern.hat.includes(step)) audioEngine.triggerDrumHit("hihat", level * 0.65);
  if (pattern.openhat?.includes(step)) audioEngine.triggerDrumHit("openhat", level * 0.65);
  if (pattern.rim?.includes(step)) audioEngine.triggerDrumHit("rim", level * 0.75);

  const chordNotes = chordToMidiNotes(chordSymbol, 4);
  const rootPitch = chordNotes[0] ? 36 + (chordNotes[0] % 12) : 36;

  if (pattern.bassOffsets[step] !== undefined) {
    audioEngine.triggerAccompNote(
      rootPitch + pattern.bassOffsets[step],
      stepSec * 2.1,
      "bass",
      Math.round(78 * (level / 0.24)),
    );
  }

  if (pattern.compSteps.includes(step)) {
    for (const midi of chordNotes.slice(0, 3)) {
      audioEngine.triggerAccompNote(midi, stepSec * 1.8, "comp", 54);
    }
  }

  if (pattern.arpSteps?.includes(step) && chordNotes.length > 0) {
    const arpIdx = pattern.arpSteps.indexOf(step) % chordNotes.length;
    audioEngine.triggerAccompNote(chordNotes[arpIdx] + 12, stepSec * 1.3, "arp", 58);
  }
}
