import type { HandSide, SongNote } from "@/types/music";

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

// Key root semitone & whether key prefers flats
const KEY_SPECS: Record<string, { rootPc: number; jianpuRootPc: number; preferFlats: boolean; fifths: number }> = {
  C: { rootPc: 0, jianpuRootPc: 0, preferFlats: false, fifths: 0 },
  G: { rootPc: 7, jianpuRootPc: 7, preferFlats: false, fifths: 1 },
  D: { rootPc: 2, jianpuRootPc: 2, preferFlats: false, fifths: 2 },
  A: { rootPc: 9, jianpuRootPc: 9, preferFlats: false, fifths: 3 },
  E: { rootPc: 4, jianpuRootPc: 4, preferFlats: false, fifths: 4 },
  B: { rootPc: 11, jianpuRootPc: 11, preferFlats: false, fifths: 5 },
  F: { rootPc: 5, jianpuRootPc: 5, preferFlats: true, fifths: -1 },
  Bb: { rootPc: 10, jianpuRootPc: 10, preferFlats: true, fifths: -2 },
  Eb: { rootPc: 3, jianpuRootPc: 3, preferFlats: true, fifths: -3 },
  Ab: { rootPc: 8, jianpuRootPc: 8, preferFlats: true, fifths: -4 },
  Am: { rootPc: 9, jianpuRootPc: 0, preferFlats: false, fifths: 0 },
  Em: { rootPc: 4, jianpuRootPc: 7, preferFlats: false, fifths: 1 },
  Dm: { rootPc: 2, jianpuRootPc: 5, preferFlats: true, fifths: -1 },
  Gm: { rootPc: 7, jianpuRootPc: 10, preferFlats: true, fifths: -2 },
  Cm: { rootPc: 0, jianpuRootPc: 3, preferFlats: true, fifths: -3 },
};

export function getKeySpec(keySignature: string) {
  return KEY_SPECS[keySignature] ?? KEY_SPECS.C;
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PCS.has(((midi % 12) + 12) % 12);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number, preferFlats = false): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  return `${names[pc]}${octave}`;
}

export function nameToMidi(name: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) return null;
  const letterMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = letterMap[m[1].toUpperCase()];
  if (m[2] === "#") pc += 1;
  if (m[2] === "b") pc -= 1;
  const octave = parseInt(m[3], 10);
  return (octave + 1) * 12 + pc;
}

export interface StaffPosition {
  step: number; // diatonic step where C4 = 28, D4 = 29, E4 = 30 ...
  accidental: "#" | "b" | "";
}

// Sharp letter index (0=C, 1=D, 2=E, 3=F, 4=G, 5=A, 6=B)
const SHARP_LETTER_INDEX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const SHARP_ACC: ("" | "#")[] = ["", "#", "", "#", "", "", "#", "", "#", "", "#", ""];

const FLAT_LETTER_INDEX = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const FLAT_ACC: ("" | "b")[] = ["", "b", "", "b", "", "", "b", "", "b", "", "b", ""];

export function midiToStaffPosition(midi: number, preferFlats = false): StaffPosition {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const letterIdx = preferFlats ? FLAT_LETTER_INDEX[pc] : SHARP_LETTER_INDEX[pc];
  const accidental = preferFlats ? FLAT_ACC[pc] : SHARP_ACC[pc];
  return {
    step: octave * 7 + letterIdx,
    accidental,
  };
}

export interface JianpuPitch {
  degree: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  accidental: "#" | "b" | "";
  octaveOffset: number; // 0 = C4..B4 relative to key root, +1 = dot above, -1 = dot below
}

const MAJOR_SCALE_MAP: Record<number, { degree: 1 | 2 | 3 | 4 | 5 | 6 | 7; acc: "#" | "b" | "" }> = {
  0: { degree: 1, acc: "" },
  1: { degree: 1, acc: "#" },
  2: { degree: 2, acc: "" },
  3: { degree: 3, acc: "b" },
  4: { degree: 3, acc: "" },
  5: { degree: 4, acc: "" },
  6: { degree: 4, acc: "#" },
  7: { degree: 5, acc: "" },
  8: { degree: 5, acc: "#" },
  9: { degree: 6, acc: "" },
  10: { degree: 7, acc: "b" },
  11: { degree: 7, acc: "" },
};

export function midiToJianpu(midi: number, keySignature = "C"): JianpuPitch {
  const spec = getKeySpec(keySignature);
  // Base tonic C4 = 60 + jianpuRootPc (keep root near C4/F3-B4)
  const tonicMidi = 60 + (spec.jianpuRootPc > 7 ? spec.jianpuRootPc - 12 : spec.jianpuRootPc);
  const diff = midi - tonicMidi;
  const octaveOffset = Math.floor(diff / 12);
  const interval = ((diff % 12) + 12) % 12;
  const mapped = MAJOR_SCALE_MAP[interval];
  return {
    degree: mapped.degree,
    accidental: mapped.acc,
    octaveOffset,
  };
}

const CHORD_PATTERNS: { suffix: string; intervals: number[] }[] = [
  { suffix: "", intervals: [0, 4, 7] },
  { suffix: "m", intervals: [0, 3, 7] },
  { suffix: "7", intervals: [0, 4, 7, 10] },
  { suffix: "maj7", intervals: [0, 4, 7, 11] },
  { suffix: "m7", intervals: [0, 3, 7, 10] },
  { suffix: "dim", intervals: [0, 3, 6] },
  { suffix: "aug", intervals: [0, 4, 8] },
  { suffix: "sus4", intervals: [0, 5, 7] },
  { suffix: "sus2", intervals: [0, 2, 7] },
  { suffix: "6", intervals: [0, 4, 7, 9] },
  { suffix: "m6", intervals: [0, 3, 7, 9] },
  { suffix: "5", intervals: [0, 7] },
];

export function detectChord(midiNotes: number[]): string | null {
  if (midiNotes.length < 2) return null;
  const sorted = [...new Set(midiNotes)].sort((a, b) => a - b);
  const uniquePcs = [...new Set(sorted.map((m) => ((m % 12) + 12) % 12))];
  if (uniquePcs.length < 2) return null;

  const bassPc = ((sorted[0] % 12) + 12) % 12;
  // Prioritize bass note as root first, then try inversions
  const candidates = [bassPc, ...uniquePcs.filter((pc) => pc !== bassPc)];

  for (const rootPc of candidates) {
    const intervals = uniquePcs.map((pc) => (pc - rootPc + 12) % 12).sort((a, b) => a - b);
    for (const pat of CHORD_PATTERNS) {
      if (pat.intervals.length === intervals.length && pat.intervals.every((v, idx) => v === intervals[idx])) {
        const rootName = SHARP_NAMES[rootPc];
        const slash = rootPc !== bassPc ? `/${SHARP_NAMES[bassPc]}` : "";
        return `${rootName}${pat.suffix}${slash}`;
      }
    }
  }
  return null;
}

export function detectKeySignature(notes: SongNote[]): string {
  if (notes.length === 0) return "C";
  const pcWeights = new Array<number>(12).fill(0);
  for (const n of notes) {
    pcWeights[((n.midi % 12) + 12) % 12] += Math.max(0.25, n.durationBeats);
  }
  // Krumhansl-inspired simple major diatonic profile
  const majorMask = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
  const keyNames = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  let bestKey = "C";
  let bestScore = -1;
  for (let root = 0; root < 12; root++) {
    let score = 0;
    for (let i = 0; i < 12; i++) {
      if (majorMask[(i - root + 12) % 12]) {
        score += pcWeights[i];
      } else {
        score -= pcWeights[i] * 0.6;
      }
    }
    // Slight preference for C major / G / F when tied
    if (root === 0) score += 0.05;
    if (score > bestScore) {
      bestScore = score;
      bestKey = keyNames[root] === "F#" ? "G" : keyNames[root];
    }
  }
  return bestKey;
}

export function assignFingersAndHands(notes: SongNote[], splitMidi = 57): SongNote[] {
  const byHand: Record<HandSide, SongNote[]> = { right: [], left: [] };
  const cloned = notes.map((n) => ({
    ...n,
    hand: n.hand ?? (n.midi >= splitMidi ? "right" : "left"),
  }));

  for (const n of cloned) {
    byHand[n.hand].push(n);
  }

  for (const side of ["right", "left"] as const) {
    const list = byHand[side].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
    let prevMidi: number | null = null;
    let prevFinger = side === "right" ? 3 : 3;

    for (const note of list) {
      if (note.finger) {
        prevMidi = note.midi;
        prevFinger = note.finger;
        continue;
      }
      if (prevMidi === null) {
        note.finger = side === "right" ? (note.midi <= 62 ? 1 : 3) : (note.midi <= 48 ? 5 : 2);
      } else {
        const diff = note.midi - prevMidi;
        if (diff === 0) {
          note.finger = prevFinger as 1 | 2 | 3 | 4 | 5;
        } else if (side === "right") {
          const step = Math.round(diff / 2);
          const next = Math.max(1, Math.min(5, prevFinger + step));
          note.finger = next as 1 | 2 | 3 | 4 | 5;
        } else {
          const step = Math.round(-diff / 2);
          const next = Math.max(1, Math.min(5, prevFinger + step));
          note.finger = next as 1 | 2 | 3 | 4 | 5;
        }
      }
      prevMidi = note.midi;
      prevFinger = note.finger;
    }
  }

  return cloned.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
}

export function chordToMidiNotes(symbol: string, octave = 3): number[] {
  const m = /^([A-G])([#b]?)(maj7|m7|m|7|dim|aug|sus4|sus2|6|m6)?/i.exec(symbol.trim());
  if (!m) return [];
  const letterMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = letterMap[m[1].toUpperCase()];
  if (m[2] === "#") pc += 1;
  if (m[2] === "b") pc -= 1;
  const rootMidi = (octave + 1) * 12 + ((pc + 12) % 12);
  const q = (m[3] || "").toLowerCase();
  const map: Record<string, number[]> = {
    "": [0, 4, 7],
    m: [0, 3, 7],
    "7": [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    m7: [0, 3, 7, 10],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    sus4: [0, 5, 7],
    sus2: [0, 2, 7],
    "6": [0, 4, 7, 9],
    m6: [0, 3, 7, 9],
  };
  const intervals = map[q] ?? [0, 4, 7];
  return intervals.map((i) => rootMidi + i);
}
