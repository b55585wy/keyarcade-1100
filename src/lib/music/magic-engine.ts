import type { FreeAssistMode, ImprovRecordedNote, Song, SongNote } from "@/types/music";
import { chordToMidiNotes, getKeySpec } from "./theory";

export interface FreeAssistModeMeta {
  id: FreeAssistMode;
  labelZh: string;
  labelEn: string;
  hintZh: string;
  hintEn: string;
  accent: string;
}

export const FREE_ASSIST_MODES: FreeAssistModeMeta[] = [
  {
    id: "pro",
    labelZh: "原音直出",
    labelEn: "Pro Raw",
    hintZh: "真实弹奏每个黑白键原音",
    hintEn: "Play exact chromatic keys directly",
    accent: "#9898a6",
  },
  {
    id: "smart-scale",
    labelZh: "防跑调魔法",
    labelEn: "Smart Scale",
    hintZh: "任意乱弹自动锁五声音阶 + 强拍吸附和弦，节奏对就成曲",
    hintEn: "Locks any random key press to pentatonic & chord harmony",
    accent: "#00ff88",
  },
  {
    id: "magic-rhythm",
    labelZh: "节奏弹名曲",
    labelEn: "Magic Song",
    hintZh: "点选一首谱子，只按节奏任意敲键即可按剧本弹完整首歌",
    hintEn: "Tap ANY keys in rhythm to perform the selected song melody step-by-step",
    accent: "#ff6a00",
  },
];

export interface ProgressionPreset {
  id: string;
  labelZh: string;
  labelEn: string;
  chords: string[];
}

export const CHORD_PROGRESSIONS: ProgressionPreset[] = [
  {
    id: "off",
    labelZh: "手动切换",
    labelEn: "Manual",
    chords: [],
  },
  {
    id: "pop-1645",
    labelZh: "抒情 1645 (C·Am·F·G)",
    labelEn: "Pop 1-6-4-5",
    chords: ["C", "Am", "F", "G"],
  },
  {
    id: "guofeng-6415",
    labelZh: "国风 6415 (Am·F·C·G)",
    labelEn: "Guofeng 6-4-1-5",
    chords: ["Am", "F", "C", "G"],
  },
  {
    id: "canon",
    labelZh: "卡农循环 (C·G·Am·Em·F·C·F·G)",
    labelEn: "Canon 8-Bar Loop",
    chords: ["C", "G", "Am", "Em", "F", "C", "F", "G"],
  },
  {
    id: "lofi-2516",
    labelZh: "Lo-Fi 爵士 (Dm7·G7·Cmaj7·Am7)",
    labelEn: "Lo-Fi 2-5-1-6",
    chords: ["Dm7", "G7", "Cmaj7", "Am7"],
  },
];

const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
const MINOR_PENTATONIC = [0, 3, 5, 7, 10];

function buildAllowedPitchClasses(keySig: string): Set<number> {
  const spec = getKeySpec(keySig);
  const intervals = keySig.endsWith("m") ? MINOR_PENTATONIC : MAJOR_PENTATONIC;
  const out = new Set<number>();
  for (const iv of intervals) {
    out.add((spec.rootPc + iv) % 12);
  }
  return out;
}

/**
 * Quantizes any raw key input to a zero-wrong-note pentatonic + harmony pitch while strictly
 * preserving left-to-right pitch height relative to the key pressed.
 */
export function snapMidiToSmartScale(
  rawMidi: number,
  keySig: string,
  activeChord: string,
  onStrongBeat: boolean,
  velocity = 96,
): { primaryMidi: number; harmonyMidi?: number } {
  const pentatonicPcs = buildAllowedPitchClasses(keySig);
  const chordMidis = activeChord ? chordToMidiNotes(activeChord, 4) : [];
  const chordPcs = new Set(chordMidis.map((m) => ((m % 12) + 12) % 12));

  // Combine pentatonic safety net with strong-beat chord priority
  let bestMidi = rawMidi;
  let bestPenalty = Infinity;

  for (let delta = -4; delta <= 4; delta++) {
    const candidate = rawMidi + delta;
    if (candidate < 36 || candidate > 96) continue;
    const pc = ((candidate % 12) + 12) % 12;
    const inScale = pentatonicPcs.has(pc);
    const inChord = chordPcs.has(pc);

    if (!inScale && !inChord) continue;

    // Prioritize chord tones on strong beats; prefer nearest height overall
    let penalty = Math.abs(delta);
    if (onStrongBeat && inChord) penalty -= 1.6;
    else if (inChord) penalty -= 0.4;

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMidi = candidate;
    }
  }

  // Add subtle third/sixth harmony when struck firmly above melody register
  let harmonyMidi: number | undefined;
  if (velocity >= 104 && bestMidi >= 57 && bestMidi <= 84) {
    for (let step = 3; step <= 5; step++) {
      const h = bestMidi + step;
      const pc = ((h % 12) + 12) % 12;
      if (pentatonicPcs.has(pc) || chordPcs.has(pc)) {
        harmonyMidi = h;
        break;
      }
    }
  }

  return { primaryMidi: bestMidi, harmonyMidi };
}

/**
 * Builds step-by-step melody/chord clusters from a Song for Rhythm-Triggered performance.
 */
export function buildMagicRhythmSteps(song: Song): number[][] {
  const rh = song.notes.filter((n) => n.hand === "right");
  const pool = (rh.length >= 6 ? rh : song.notes)
    .slice()
    .sort((a, b) => a.startSec - b.startSec || a.midi - b.midi);

  const steps: number[][] = [];
  for (const n of pool) {
    const prev = steps[steps.length - 1];
    const prevLastNote = pool[steps.length > 0 ? pool.indexOf(n) - 1 : -1];
    if (prev && prevLastNote && Math.abs(n.startSec - prevLastNote.startSec) <= 0.045) {
      if (!prev.includes(n.midi)) prev.push(n.midi);
    } else {
      steps.push([n.midi]);
    }
  }
  return steps.length > 0 ? steps : [[60], [64], [67], [72]];
}

/**
 * Compiles an improvised free-play recording (notes + chord stamps) into a playable, shareable Song
 * complete with quantized beats, auto left-hand chord accompaniment, Dual Sheet Music & Arcade notes.
 */
export function compileImprovTakeToSong(
  take: ImprovRecordedNote[],
  opts: {
    title?: string;
    bpm: number;
    keySignature: string;
    voiceName?: string;
  },
): Song | null {
  if (take.length === 0) return null;
  const bpm = Math.max(52, Math.min(168, Math.round(opts.bpm || 96)));
  const secPerBeat = 60 / bpm;
  const firstSec = Math.min(...take.map((t) => t.startSec));

  const notes: SongNote[] = [];
  const chords: Array<{ startBeat: number; symbol: string }> = [];
  const seenChordBar = new Map<number, string>();

  take.forEach((item, idx) => {
    const relSec = Math.max(0, item.startSec - firstSec);
    // Quantize cleanly to nearest quarter/eighth beat so SheetMusicView stays legible
    const rawBeat = relSec / secPerBeat;
    const startBeat = Math.round(rawBeat * 4) / 4;
    const rawDurBeats = Math.max(0.25, Math.min(4, item.durationSec / secPerBeat));
    const durationBeats = Math.max(0.25, Math.round(rawDurBeats * 4) / 4);
    const barIdx = Math.floor(startBeat / 4);

    let barChordLabel: string | undefined;
    if (item.chordSymbol && seenChordBar.get(barIdx) !== item.chordSymbol) {
      seenChordBar.set(barIdx, item.chordSymbol);
      barChordLabel = item.chordSymbol;
      chords.push({ startBeat: barIdx * 4, symbol: item.chordSymbol });

      // Generate warm left-hand root + 5th accompaniment on downbeat of each new chord bar
      const lhMidis = chordToMidiNotes(item.chordSymbol, 3).slice(0, 3);
      lhMidis.forEach((lm, lIdx) => {
        notes.push({
          id: `imp-lh-${idx}-${lIdx}`,
          midi: lm,
          startBeat: barIdx * 4,
          durationBeats: 2,
          startSec: Math.round(barIdx * 4 * secPerBeat * 1000) / 1000,
          durationSec: Math.round(2 * secPerBeat * 1000) / 1000,
          velocity: 68,
          hand: "left",
          chordSymbol: lIdx === 0 ? item.chordSymbol : undefined,
        });
      });
    }

    notes.push({
      id: `imp-rh-${idx}`,
      midi: item.midi,
      startBeat,
      durationBeats,
      startSec: Math.round(startBeat * secPerBeat * 1000) / 1000,
      durationSec: Math.round(durationBeats * secPerBeat * 1000) / 1000,
      velocity: item.velocity || 94,
      hand: item.midi < 54 ? "left" : "right",
      chordSymbol: barChordLabel,
    });

    if (item.harmonyMidi !== undefined) {
      notes.push({
        id: `imp-harm-${idx}`,
        midi: item.harmonyMidi,
        startBeat,
        durationBeats,
        startSec: Math.round(startBeat * secPerBeat * 1000) / 1000,
        durationSec: Math.round(durationBeats * secPerBeat * 1000) / 1000,
        velocity: 78,
        hand: "right",
      });
    }
  });

  notes.sort((a, b) => a.startSec - b.startSec || a.midi - b.midi);
  const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const songId = `improv-${Date.now().toString(36)}`;
  const cleanTitle = opts.title?.trim() || `即兴成曲 ${stamp}`;

  return {
    id: songId,
    title: cleanTitle,
    titleZh: cleanTitle,
    composer: opts.voiceName ? `KeyArcade Magic (${opts.voiceName})` : "KeyArcade Magic Studio",
    category: "imported",
    difficulty: 2,
    bpm,
    timeSignature: [4, 4],
    keySignature: opts.keySignature,
    recommendedModel: "kbp1100",
    recommendedVoice: "grand-piano",
    sourceFormat: "ai",
    splitMidi: 54,
    descriptionZh: `零门槛防跑调即兴录音自动成谱（${notes.length} 音符 · 1=${opts.keySignature}）`,
    descriptionEn: `Quantized magic improvisation score (${notes.length} notes · Key ${opts.keySignature})`,
    notes,
    chords,
    createdAt: new Date().toISOString(),
  };
}
