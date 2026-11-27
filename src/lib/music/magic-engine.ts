import type {
  ArrangerStyleId,
  FreeAssistMode,
  ImprovRecordedNote,
  KeyboardModelId,
  Song,
  SongNote,
  SynthVoiceId,
} from "@/types/music";
import { chordToMidiNotes, getKeySpec } from "./theory";
import { parseJianpuText } from "./score-parsers";

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
    id: "anime-4536",
    labelZh: "日漫燃曲 4536 (F·G·Em·Am)",
    labelEn: "Anime 4-5-3-6",
    chords: ["F", "G", "Em", "Am"],
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
  {
    id: "rnb-warm",
    labelZh: "灵魂 R&B (Fmaj7·E7·Am7·Gm7)",
    labelEn: "Warm R&B Soul",
    chords: ["Fmaj7", "E7", "Am7", "C7"],
  },
];

export interface MagicVibePreset {
  id: string;
  labelZh: string;
  labelEn: string;
  styleId: ArrangerStyleId;
  progressionId: string;
  keySignature: string;
  voice: SynthVoiceId;
  accent: string;
}

export const MAGIC_VIBE_PRESETS: MagicVibePreset[] = [
  {
    id: "lofi-night",
    labelZh: "深夜 Lo-Fi",
    labelEn: "Lo-Fi Night",
    styleId: "lofi-chill",
    progressionId: "lofi-2516",
    keySignature: "C",
    voice: "lofi-tape",
    accent: "#f59e0b",
  },
  {
    id: "guofeng-rain",
    labelZh: "江南国风",
    labelEn: "Guofeng Silk",
    styleId: "guofeng-pentatonic",
    progressionId: "guofeng-6415",
    keySignature: "Am",
    voice: "guzheng",
    accent: "#00ff88",
  },
  {
    id: "anime-4536",
    labelZh: "日漫燃曲",
    labelEn: "Anime 4536",
    styleId: "8beat-pop",
    progressionId: "anime-4536",
    keySignature: "C",
    voice: "grand-piano",
    accent: "#ff6a00",
  },
  {
    id: "canon-dream",
    labelZh: "浪漫卡农",
    labelEn: "Canon Dream",
    styleId: "8beat-pop",
    progressionId: "canon",
    keySignature: "G",
    voice: "warm-strings",
    accent: "#a855f7",
  },
  {
    id: "cyber-wave",
    labelZh: "赛博霓虹",
    labelEn: "Cyber 80s",
    styleId: "synthwave-arcade",
    progressionId: "pop-1645",
    keySignature: "Am",
    voice: "cyber-synth",
    accent: "#ec4899",
  },
  {
    id: "bossa-beach",
    labelZh: "海边 Bossa",
    labelEn: "Bossa Cafe",
    styleId: "bossa-nova",
    progressionId: "rnb-warm",
    keySignature: "C",
    voice: "yamaha-ep",
    accent: "#00d4ff",
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
    if (onStrongBeat && inChord) penalty -= 2.6;
    else if (inChord) penalty -= 0.6;

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

export interface MagicRhythmStep {
  melodyMidis: number[];
  chordMidis: number[];
  chordSymbol?: string;
}

export interface OfflineSongBlueprint {
  id: string;
  keywords: string[];
  titleZh: string;
  titleEn: string;
  keySignature: string;
  bpm: number;
  jianpu: string;
}

export const OFFLINE_POP_BLUEPRINTS: OfflineSongBlueprint[] = [
  {
    id: "offline-sunny-1645",
    keywords: ["晴天", "流行", "周杰伦", "sunny", "1645"],
    titleZh: "校园晴天风 · 1645 流行原型 (离线模板)",
    titleEn: "Sunny Campus 1645 Blueprint (Offline)",
    keySignature: "G",
    bpm: 86,
    jianpu:
      "[C]3 2 1 5. | [G]5 4 3 2 | [Am]1 2 3 5 | [Em]3 2 1 - | [F]6 5 4 3 | [C]5 4 3 1 | [Dm7]2 3 4 5 | [G7]5 - 2 - | [C]3 5 1' 7 | [Am]6 5 3 2 | [F]4 3 2 1 | [G]2 - 1 -",
  },
  {
    id: "offline-sky-city",
    keywords: ["天空", "久石让", "宫崎骏", "castle", "sky"],
    titleZh: "奇幻天空舞曲 · 经典6451原型 (离线模板)",
    titleEn: "Sky Citadel Waltz Motif (Offline)",
    keySignature: "Am",
    bpm: 92,
    jianpu:
      "6_ 7_ | [Am]1' - 7_ 1'_ 3' | [Em]7 - - 3_ 3_ | [F]6 - 5_ 6_ 1' | [C]5 - - 3_ 3_ | [Dm]4 - 3_ 4_ 1' | [C]3 - 1' 7 | [F]6 - 7_ #5_ | [Am]6 - - 0",
  },
  {
    id: "offline-porcelain-guofeng",
    keywords: ["青花瓷", "国风", "五声", "江南", "中国风"],
    titleZh: "烟雨五声雅调 · 国风原型 (离线模板)",
    titleEn: "Porcelain Pentatonic Motif (Offline)",
    keySignature: "C",
    bpm: 84,
    jianpu:
      "[Am]5 3 2 1 | [F]6. 1 2 - | [C]3 5 6 5 | [G]3 2 2 - | [Am]5 3 2 1 | [F]6. 1 5. - | [G]6. 1 2 3 | [C]1 - - 0",
  },
  {
    id: "offline-wedding-romance",
    keywords: ["婚礼", "卡农", "浪漫", "起风", "dream", "river"],
    titleZh: "海风抒情八度分解 · 浪漫原型 (离线模板)",
    titleEn: "Romantic Arpeggio Etude (Offline)",
    keySignature: "C",
    bpm: 88,
    jianpu:
      "[C]5 3' 2' 1' | [G]5 2' 1' 7 | [Am]3 1' 7 6 | [Em]3 7 6 5 | [F]1 6 5 4 | [C]3 5 1' 3 | [F]4 6 2' 1' | [G]7 - 1' -",
  },
];

/**
 * Generates an instant offline-playable Song draft from built-in harmonic prototypes when no AI key is configured.
 * Explicitly badged as a local offline template (never labeled as DeepSeek AI output).
 */
export function buildOfflineBlueprintSong(
  query: string,
  model: KeyboardModelId = "kbp1100",
): Song {
  const lower = query.trim().toLowerCase();
  const matched =
    OFFLINE_POP_BLUEPRINTS.find((bp) => bp.keywords.some((k) => lower.includes(k.toLowerCase()))) ??
    OFFLINE_POP_BLUEPRINTS[0];

  const song = parseJianpuText(matched.jianpu, {
    title: matched.titleEn,
    composer: "Local Offline Template",
    keySignature: matched.keySignature,
    bpm: matched.bpm,
    autoAccompaniment: true,
    recommendedModel: model,
  });

  return {
    ...song,
    id: `tpl-${matched.id}-${Date.now().toString(36)}`,
    title: matched.titleEn,
    titleZh: matched.titleZh,
    sourceFormat: "jianpu",
    descriptionZh: "本地离线即兴曲风原型（非 DeepSeek AI 生成），填入 API Key 可实时生成全网任意曲目",
    descriptionEn: "Local offline progression template (no API key required)",
  };
}

/**
 * Extracts step-by-step melody clusters paired with matching left-hand harmony notes
 * so beginners can play both melody and synced accompaniment with rhythmic taps alone.
 */
export function buildMagicRhythmSteps(song: Song): MagicRhythmStep[] {
  const sorted = song.notes.slice().sort((a, b) => a.startSec - b.startSec || a.midi - b.midi);
  const rh = sorted.filter((n) => n.hand === "right");
  const lh = sorted.filter((n) => n.hand === "left");
  const melodyPool = rh.length > 0 ? rh : sorted;

  // Group chronologically close melody notes into single rhythmic steps
  const clusters: Array<{ startSec: number; melodyMidis: number[]; chordSymbol?: string }> = [];
  for (const n of melodyPool) {
    const prev = clusters[clusters.length - 1];
    if (prev && Math.abs(n.startSec - prev.startSec) <= 0.045) {
      if (!prev.melodyMidis.includes(n.midi)) prev.melodyMidis.push(n.midi);
      if (!prev.chordSymbol && n.chordSymbol) prev.chordSymbol = n.chordSymbol;
    } else {
      clusters.push({
        startSec: n.startSec,
        melodyMidis: [n.midi],
        chordSymbol: n.chordSymbol,
      });
    }
  }

  if (clusters.length === 0) {
    return [{ melodyMidis: [60], chordMidis: [48, 55] }];
  }

  // Pair each melody step with synchronous left-hand notes or bar chord bass
  let lastChordSym: string | undefined;
  return clusters.map((cl, idx) => {
    if (cl.chordSymbol) lastChordSym = cl.chordSymbol;
    const syncedLh = lh
      .filter((ln) => Math.abs(ln.startSec - cl.startSec) <= 0.08)
      .map((ln) => ln.midi);

    let chordMidis = syncedLh.slice(0, 3);
    if (chordMidis.length === 0 && lastChordSym && idx % 2 === 0) {
      chordMidis = chordToMidiNotes(lastChordSym, 3).slice(0, 3);
    }
    return {
      melodyMidis: cl.melodyMidis,
      chordMidis,
      chordSymbol: cl.chordSymbol ?? lastChordSym,
    };
  });
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
