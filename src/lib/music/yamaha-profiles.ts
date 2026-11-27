import type { KeyboardModelId, SynthVoiceId, YamahaHardwareProfile } from "@/types/music";
import { getKeySpec } from "./theory";

export const HARDWARE_PROFILES: Record<KeyboardModelId, YamahaHardwareProfile> = {
  kbp1100: {
    id: "kbp1100",
    brand: "YAMAHA",
    name: "YAMAHA KBP-1100",
    shortName: "KBP-1100 [88K]",
    keys: 88,
    minMidi: 21, // A0
    maxMidi: 108, // C8
    defaultSplitMidi: 54, // F#3
    hasMidiPort: true,
    actionDescZh: "88键 GHS 渐层式重锤键盘 · 中国直触面板 · 民族音色伴奏",
    actionDescEn: "88-Key GHS Graded Hammer Action · CN Direct Panel · Folk Styles",
    midiPortDescZh: "USB TO HOST (直连电脑传输 MIDI)",
    midiPortDescEn: "USB TO HOST (Class-Compliant MIDI)",
    defaultVoice: "grand-piano",
    voices: ["Grand Piano", "Chinese GuZheng", "DX Electric Piano", "8-Bit Arcade"],
  },
  psr1100: {
    id: "psr1100",
    brand: "YAMAHA",
    name: "YAMAHA PSR-1100",
    shortName: "PSR-1100 [61K]",
    keys: 61,
    minMidi: 36, // C2
    maxMidi: 96, // C7
    defaultSplitMidi: 54, // F#3
    hasMidiPort: true,
    actionDescZh: "61键力度感应编曲键盘 · 大屏歌词LCD · 16轨XG自动伴奏",
    actionDescEn: "61-Key Touch Arranger · Graphic LCD · 16-Track XG Accompaniment",
    midiPortDescZh: "USB TO HOST / 标准 MIDI IN-OUT",
    midiPortDescEn: "USB TO HOST / Standard DIN MIDI IN-OUT",
    defaultVoice: "yamaha-ep",
    voices: ["Sweet Grand", "DX Electric Piano", "Chinese GuZheng", "8-Bit Arcade"],
  },
  pxs1100: {
    id: "pxs1100",
    brand: "CASIO",
    name: "CASIO PX-S1100",
    shortName: "PX-S1100 [88K]",
    keys: 88,
    minMidi: 21, // A0
    maxMidi: 108, // C8
    defaultSplitMidi: 54, // F#3
    hasMidiPort: true,
    actionDescZh: "88键智能缩放重锤键盘 · 超薄镜面触控 · 内置60首音乐库+10首合奏曲",
    actionDescEn: "88-Key Smart Scaled Hammer Action · 60 Music Library + 10 Concert Play",
    midiPortDescZh: "USB Type-B MIDI + WU-BT10 蓝牙 MIDI",
    midiPortDescEn: "USB Type-B MIDI + WU-BT10 Bluetooth MIDI",
    defaultVoice: "grand-piano",
    voices: ["Privia Grand", "Stage EP", "Strings", "8-Bit Arcade"],
  },
  wk1100: {
    id: "wk1100",
    brand: "CASIO",
    name: "CASIO WK-1100",
    shortName: "WK-1100 [76K]",
    keys: 76,
    minMidi: 28, // E1
    maxMidi: 103, // G7
    defaultSplitMidi: 54, // F#3
    hasMidiPort: true,
    actionDescZh: "76键力度感应宽音域电子琴 (E1–G7) · 内置伴奏与曲目扩展",
    actionDescEn: "76-Key Touch-Response Portable Keyboard (E1–G7) · GM MIDI",
    midiPortDescZh: "USB Type-B (通用 GM USB-MIDI)",
    midiPortDescEn: "USB Type-B (General MIDI Interface)",
    defaultVoice: "yamaha-ep",
    voices: ["Stereo Grand", "Stage EP", "GuZheng", "8-Bit Arcade"],
  },
  ctk1100: {
    id: "ctk1100",
    brand: "CASIO",
    name: "CASIO CTK-1100",
    shortName: "CTK-1100 [61K]",
    keys: 61,
    minMidi: 36, // C2
    maxMidi: 96, // C7
    defaultSplitMidi: 54, // F#3
    hasMidiPort: false,
    actionDescZh: "61键入门练习琴 · 内置100首曲库 (无USB/MIDI口，支持麦克风听音/摄像头跟弹)",
    actionDescEn: "61-Key Song Bank Keyboard (100 Songs · No USB/MIDI, use Mic Pitch or Camera)",
    midiPortDescZh: "无物理 MIDI 口 · 请开启 [MIC 听音判音] 或 [CAM 摄像头]",
    midiPortDescEn: "No USB/MIDI Port · Use [MIC PITCH] or [CAM] Mode",
    defaultVoice: "grand-piano",
    voices: ["CTK Grand", "Elec. Piano", "GuZheng", "8-Bit Arcade"],
  },
};

export const YAMAHA_PROFILES = HARDWARE_PROFILES;

export interface SynthVoiceMeta {
  id: SynthVoiceId;
  code: string;
  labelZh: string;
  labelEn: string;
  yamahaBank: string;
}

export const SYNTH_VOICES: SynthVoiceMeta[] = [
  {
    id: "grand-piano",
    code: "001",
    labelZh: "音乐会三角钢琴",
    labelEn: "Live! Grand Piano",
    yamahaBank: "XG 000/001",
  },
  {
    id: "yamaha-ep",
    code: "005",
    labelZh: "雅马哈 DX 电钢",
    labelEn: "DX7 Sweet EP",
    yamahaBank: "XG 000/005",
  },
  {
    id: "guzheng",
    code: "108",
    labelZh: "古筝 · 国风音色",
    labelEn: "KBP GuZheng Folk",
    yamahaBank: "CN 112/108",
  },
  {
    id: "8bit-arcade",
    code: "888",
    labelZh: "街机 8-Bit 方波",
    labelEn: "Arcade 8-Bit Pulse",
    yamahaBank: "CHIP/NES",
  },
];

export type PcKeyboardLayoutId = "piano-qwerty" | "jianpu-num";

// Classic two-row chromatic piano mapping:
// - Bottom row Z..M = Left hand C3..B3 (MIDI 48..59)
// - Top row Q..P    = Right hand C4..E5 (MIDI 60..76)
export const QWERTY_TO_MIDI: Record<string, number> = {
  z: 48, // C3
  s: 49, // C#3
  x: 50, // D3
  d: 51, // D#3
  c: 52, // E3
  v: 53, // F3
  g: 54, // F#3
  b: 55, // G3
  h: 56, // G#3
  n: 57, // A3
  j: 58, // A#3
  m: 59, // B3
  ",": 60, // C4
  q: 60, // C4
  "2": 61, // C#4
  w: 62, // D4
  "3": 63, // D#4
  e: 64, // E4
  r: 65, // F4
  "5": 66, // F#4
  t: 67, // G4
  "6": 68, // G#4
  y: 69, // A4
  "7": 70, // A#4
  u: 71, // B4
  i: 72, // C5
  "9": 73, // C#5
  o: 74, // D5
  "0": 75, // D#5
  p: 76, // E5
};

export const MIDI_TO_QWERTY: Record<number, string> = Object.entries(QWERTY_TO_MIDI).reduce(
  (acc, [key, midi]) => {
    if (!acc[midi]) acc[midi] = key.toUpperCase();
    return acc;
  },
  {} as Record<number, string>,
);

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

// Jianpu PC keyboard mapping:
// - Bottom row Z..M = Low octave (1. .. 7.)
// - Home row A..J   = Mid octave (1 .. 7)
// - Number row 1..8 = Mid octave (1 .. 7) + High 1'
// - Top row Q..I    = High octave (1' .. 7' + 1'')
const JIANPU_KEY_SPEC: Record<string, { degreeIdx: number; oct: number; label: string }> = {
  z: { degreeIdx: 0, oct: -1, label: "Z" },
  x: { degreeIdx: 1, oct: -1, label: "X" },
  c: { degreeIdx: 2, oct: -1, label: "C" },
  v: { degreeIdx: 3, oct: -1, label: "V" },
  b: { degreeIdx: 4, oct: -1, label: "B" },
  n: { degreeIdx: 5, oct: -1, label: "N" },
  m: { degreeIdx: 6, oct: -1, label: "M" },

  a: { degreeIdx: 0, oct: 0, label: "A/1" },
  s: { degreeIdx: 1, oct: 0, label: "S/2" },
  d: { degreeIdx: 2, oct: 0, label: "D/3" },
  f: { degreeIdx: 3, oct: 0, label: "F/4" },
  g: { degreeIdx: 4, oct: 0, label: "G/5" },
  h: { degreeIdx: 5, oct: 0, label: "H/6" },
  j: { degreeIdx: 6, oct: 0, label: "J/7" },
  k: { degreeIdx: 0, oct: 1, label: "K" },

  "1": { degreeIdx: 0, oct: 0, label: "A/1" },
  "2": { degreeIdx: 1, oct: 0, label: "S/2" },
  "3": { degreeIdx: 2, oct: 0, label: "D/3" },
  "4": { degreeIdx: 3, oct: 0, label: "F/4" },
  "5": { degreeIdx: 4, oct: 0, label: "G/5" },
  "6": { degreeIdx: 5, oct: 0, label: "H/6" },
  "7": { degreeIdx: 6, oct: 0, label: "J/7" },
  "8": { degreeIdx: 0, oct: 1, label: "Q/8" },

  q: { degreeIdx: 0, oct: 1, label: "Q" },
  w: { degreeIdx: 1, oct: 1, label: "W" },
  e: { degreeIdx: 2, oct: 1, label: "E" },
  r: { degreeIdx: 3, oct: 1, label: "R" },
  t: { degreeIdx: 4, oct: 1, label: "T" },
  y: { degreeIdx: 5, oct: 1, label: "Y" },
  u: { degreeIdx: 6, oct: 1, label: "U" },
  i: { degreeIdx: 0, oct: 2, label: "I" },
};

export function resolvePcKeyToMidi(
  key: string,
  layout: PcKeyboardLayoutId,
  keySignature = "C",
  octaveShift = 0,
): number | null {
  const lower = key.toLowerCase();
  if (layout === "piano-qwerty") {
    const base = QWERTY_TO_MIDI[lower];
    return base !== undefined ? Math.max(21, Math.min(108, base + octaveShift * 12)) : null;
  }

  const spec = JIANPU_KEY_SPEC[lower];
  if (!spec) return null;
  const ks = getKeySpec(keySignature);
  const tonicC4 = 60 + (ks.jianpuRootPc > 7 ? ks.jianpuRootPc - 12 : ks.jianpuRootPc);
  const midi = tonicC4 + MAJOR_INTERVALS[spec.degreeIdx] + (spec.oct + octaveShift) * 12;
  return Math.max(21, Math.min(108, midi));
}

export function getMidiToPcKeyMap(
  layout: PcKeyboardLayoutId,
  keySignature = "C",
): Record<number, string> {
  if (layout === "piano-qwerty") {
    return MIDI_TO_QWERTY;
  }

  const ks = getKeySpec(keySignature);
  const tonicC4 = 60 + (ks.jianpuRootPc > 7 ? ks.jianpuRootPc - 12 : ks.jianpuRootPc);
  const map: Record<number, string> = {};
  for (const [, spec] of Object.entries(JIANPU_KEY_SPEC)) {
    const midi = tonicC4 + MAJOR_INTERVALS[spec.degreeIdx] + spec.oct * 12;
    if (!map[midi]) {
      map[midi] = spec.label;
    }
  }
  return map;
}

export const KEY_DIATONIC_CHORDS: Record<string, string[]> = {
  C: ["C", "Dm", "Em", "F", "G7", "Am"],
  G: ["G", "Am", "Bm", "C", "D7", "Em"],
  D: ["D", "Em", "F#m", "G", "A7", "Bm"],
  F: ["F", "Gm", "Am", "Bb", "C7", "Dm"],
  Bb: ["Bb", "Cm", "Dm", "Eb", "F7", "Gm"],
  Am: ["Am", "Dm", "E7", "F", "C", "G"],
};
