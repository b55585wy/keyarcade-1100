import type { ChordMarker, KeyboardModelId, Song, SongNote } from "@/types/music";
import { detectPitchFromSamples } from "./mic-pitch";
import { parseJianpuText } from "./score-parsers";
import { assignFingersAndHands, detectKeySignature, getKeySpec, midiToJianpu } from "./theory";

export interface AudioTranscriptionOptions {
  title?: string;
  bpmOverride?: number;
  maxDurationSec?: number;
  autoAccompaniment?: boolean;
  recommendedModel?: KeyboardModelId;
}

export interface AudioTranscriptionResult {
  song: Song;
  jianpuDraft: string;
  analyzedSeconds: number;
  totalSeconds: number;
  detectedBpm: number;
}

interface RawPitchFrame {
  timeSec: number;
  midi: number | null;
  rms: number;
  clarity: number;
}

interface RawSegment {
  midi: number;
  startSec: number;
  durationSec: number;
  peakRms: number;
}

/**
 * Downsamples mono PCM samples to <= 22050 Hz via block averaging so autocorrelation
 * transcription finishes within ~0.3-0.8s even for 60s of 48kHz audio.
 */
export function downsampleMono(
  samples: Float32Array,
  sampleRate: number,
  targetMaxRate = 22050,
): { samples: Float32Array; sampleRate: number } {
  if (sampleRate <= targetMaxRate || samples.length === 0) {
    return { samples, sampleRate };
  }
  const factor = Math.max(2, Math.floor(sampleRate / targetMaxRate));
  const outLen = Math.floor(samples.length / factor);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    let sum = 0;
    const base = i * factor;
    for (let j = 0; j < factor; j++) {
      sum += samples[base + j];
    }
    out[i] = sum / factor;
  }
  return { samples: out, sampleRate: sampleRate / factor };
}

function medianOfThree(a: number, b: number, c: number): number {
  if (a > b) {
    if (b > c) return b;
    return a > c ? c : a;
  }
  if (a > c) return a;
  return b > c ? c : b;
}

function estimateBpmFromOnsets(segments: RawSegment[]): number {
  if (segments.length < 3) return 100;
  const iois: number[] = [];
  for (let i = 1; i < segments.length; i++) {
    const dt = segments[i].startSec - segments[i - 1].startSec;
    if (dt >= 0.16 && dt <= 2.2) iois.push(dt);
  }
  if (iois.length === 0) return 100;

  let bestBpm = 100;
  let bestScore = -1;
  for (let bpm = 72; bpm <= 144; bpm += 2) {
    const beatSec = 60 / bpm;
    let score = 0;
    for (const dt of iois) {
      const ratio = dt / beatSec;
      // Reward quarter-note (1x), eighth-note (0.5x), and half-note (2x) fit
      const err1 = Math.abs(ratio - Math.round(ratio));
      const errHalf = Math.abs(ratio * 2 - Math.round(ratio * 2)) * 0.5;
      const err = Math.min(err1, errHalf);
      score += Math.max(0, 1 - err * 4);
    }
    // Slight prior toward common 90-120 BPM pop/teaching range
    score += 0.15 * (1 - Math.abs(bpm - 104) / 60);
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  return bestBpm;
}

const MAJOR_DEGREES_CHORDS = [
  { deg: 1, suffix: "" },
  { deg: 2, suffix: "m" },
  { deg: 3, suffix: "m" },
  { deg: 4, suffix: "" },
  { deg: 5, suffix: "" },
  { deg: 6, suffix: "m" },
];
const KEY_ROOT_NAME: Record<string, { pc: number; name: string }> = {
  C: { pc: 0, name: "C" },
  Db: { pc: 1, name: "Db" },
  D: { pc: 2, name: "D" },
  Eb: { pc: 3, name: "Eb" },
  E: { pc: 4, name: "E" },
  F: { pc: 5, name: "F" },
  G: { pc: 7, name: "G" },
  Ab: { pc: 8, name: "Ab" },
  A: { pc: 9, name: "A" },
  Bb: { pc: 10, name: "Bb" },
  B: { pc: 11, name: "B" },
};
const PC_CHORD_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR_SCALE_SEMIS = [0, 2, 4, 5, 7, 9, 11];

function pickBarChordSymbol(barMidis: number[], keySig: string): string {
  const spec = getKeySpec(keySig);
  const tonicPc = spec.jianpuRootPc;
  const barPcs = barMidis.map((m) => (((m % 12) + 12 - tonicPc) % 12));

  // Choose the diatonic chord (I, ii, iii, IV, V, vi) matching the bar's melody notes best
  let bestIdx = 0;
  let bestScore = -1;
  MAJOR_DEGREES_CHORDS.forEach((entry, idx) => {
    const rootSemi = MAJOR_SCALE_SEMIS[entry.deg - 1];
    const thirdSemi = MAJOR_SCALE_SEMIS[(entry.deg + 1) % 7];
    const fifthSemi = MAJOR_SCALE_SEMIS[(entry.deg + 3) % 7];
    let s = 0;
    for (const pc of barPcs) {
      if (pc === rootSemi) s += 2;
      else if (pc === thirdSemi || pc === fifthSemi) s += 1.2;
    }
    if (entry.deg === 1 || entry.deg === 4 || entry.deg === 5) s += 0.25;
    if (s > bestScore) {
      bestScore = s;
      bestIdx = idx;
    }
  });

  const chosen = MAJOR_DEGREES_CHORDS[bestIdx];
  const rootPc = (tonicPc + MAJOR_SCALE_SEMIS[chosen.deg - 1]) % 12;
  const baseName = chosen.deg === 1 && KEY_ROOT_NAME[keySig] ? KEY_ROOT_NAME[keySig].name : PC_CHORD_NAMES[rootPc];
  return `${baseName}${chosen.suffix}`;
}

function buildJianpuDraftFromNotes(
  rhNotes: SongNote[],
  chords: ChordMarker[],
  keySignature: string,
  beatsPerBar = 4,
): string {
  const sorted = [...rhNotes].sort((a, b) => a.startBeat - b.startBeat);
  if (sorted.length === 0) return "[C] 1 - - -";

  const chordByBar = new Map<number, string>();
  for (const c of chords) {
    chordByBar.set(Math.round(c.startBeat / beatsPerBar), c.symbol);
  }

  const maxBeat = Math.max(...sorted.map((n) => n.startBeat + n.durationBeats));
  const bars: string[] = [];
  const totalBars = Math.ceil(maxBeat / beatsPerBar);

  for (let b = 0; b < totalBars; b++) {
    const bStart = b * beatsPerBar;
    const bEnd = (b + 1) * beatsPerBar;
    const notesInBar = sorted.filter((n) => n.startBeat >= bStart - 0.01 && n.startBeat < bEnd - 0.01);
    const parts: string[] = [];
    const chord = chordByBar.get(b);
    if (chord) parts.push(`[${chord}]`);

    let cursor = bStart;
    for (const n of notesInBar) {
      if (n.startBeat - cursor >= 0.49) {
        const restBeats = Math.round((n.startBeat - cursor) * 2) / 2;
        if (restBeats >= 1) {
          parts.push("0".repeat(1) + "-".repeat(Math.max(0, Math.floor(restBeats) - 1)));
        } else if (restBeats >= 0.5) {
          parts.push("0_");
        }
      }
      const jp = midiToJianpu(n.midi, keySignature);
      const octStr = jp.octaveOffset > 0 ? "'".repeat(jp.octaveOffset) : jp.octaveOffset < 0 ? ".".repeat(-jp.octaveOffset) : "";
      const dur = Math.max(0.5, Math.round(n.durationBeats * 2) / 2);
      const subStr = dur < 0.75 ? "_" : "";
      const sustainCount = dur >= 2 ? Math.min(3, Math.round(dur) - 1) : 0;
      const tok = `${jp.accidental}${jp.degree}${octStr}${subStr}${sustainCount > 0 ? "-".repeat(sustainCount) : ""}`;
      parts.push(tok);
      cursor = Math.max(cursor, n.startBeat + dur);
    }

    if (parts.length > 0) bars.push(parts.join(" "));
  }

  return bars.join(" | ");
}

/**
 * Pure PCM audio -> playable Score (Notes + Grand Staff + Jianpu + Chords) transcription engine.
 * Works offline on .mp3 / .wav / .m4a / .ogg decoded via AudioContext (and testable in Node).
 */
export function transcribeAudioSamples(
  rawSamples: Float32Array,
  rawSampleRate: number,
  options: AudioTranscriptionOptions = {},
): AudioTranscriptionResult {
  const totalSeconds = rawSampleRate > 0 ? rawSamples.length / rawSampleRate : 0;
  const maxDurationSec = options.maxDurationSec ?? 75;
  const maxRawSamples = Math.min(rawSamples.length, Math.floor(maxDurationSec * rawSampleRate));
  const clipped = maxRawSamples < rawSamples.length ? rawSamples.subarray(0, maxRawSamples) : rawSamples;
  const analyzedSeconds = clipped.length / rawSampleRate;

  const { samples, sampleRate } = downsampleMono(clipped, rawSampleRate, 22050);

  const windowSize = Math.max(1024, Math.min(4096, Math.round(sampleRate * 0.092)));
  const hopSize = Math.max(256, Math.round(sampleRate * 0.025));

  const frames: RawPitchFrame[] = [];
  for (let start = 0; start + windowSize <= samples.length; start += hopSize) {
    const slice = samples.subarray(start, start + windowSize);
    const res = detectPitchFromSamples(slice, sampleRate, 0.012);
    let rms = res?.rms ?? 0;
    if (!res) {
      let sq = 0;
      for (let i = 0; i < slice.length; i++) sq += slice[i] * slice[i];
      rms = Math.sqrt(sq / slice.length);
    }
    frames.push({
      timeSec: start / sampleRate,
      midi: res ? res.midi : null,
      rms,
      clarity: res?.clarity ?? 0,
    });
  }

  // Median smooth isolated 1-frame pitch spikes
  const smoothedMidis: (number | null)[] = frames.map((f, idx) => {
    const prev = idx > 0 ? frames[idx - 1].midi : null;
    const next = idx + 1 < frames.length ? frames[idx + 1].midi : null;
    if (f.midi !== null && prev !== null && next !== null) {
      return medianOfThree(prev, f.midi, next);
    }
    return f.midi;
  });

  // Segment frames into distinct musical note events
  const segments: RawSegment[] = [];
  let activeMidi: number | null = null;
  let activeStart = 0;
  let peakRms = 0;
  let minRmsInSpan = Infinity;
  let silentCount = 0;

  const flushSegment = (endTime: number) => {
    if (activeMidi === null) return;
    const dur = endTime - activeStart;
    if (dur >= 0.095) {
      segments.push({
        midi: activeMidi,
        startSec: activeStart,
        durationSec: dur,
        peakRms,
      });
    }
    activeMidi = null;
    peakRms = 0;
    minRmsInSpan = Infinity;
    silentCount = 0;
  };

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const midi = smoothedMidis[i];
    if (midi === null) {
      silentCount += 1;
      if (silentCount >= 2 && activeMidi !== null) {
        flushSegment(f.timeSec);
      }
      continue;
    }

    silentCount = 0;
    if (activeMidi === null) {
      activeMidi = midi;
      activeStart = f.timeSec;
      peakRms = f.rms;
      minRmsInSpan = f.rms;
      continue;
    }

    const spanDur = f.timeSec - activeStart;
    const reAttacked =
      midi === activeMidi &&
      spanDur >= 0.14 &&
      minRmsInSpan > 0 &&
      f.rms > minRmsInSpan * 1.65 &&
      f.rms > 0.025;

    if (midi !== activeMidi || reAttacked) {
      flushSegment(f.timeSec);
      activeMidi = midi;
      activeStart = f.timeSec;
      peakRms = f.rms;
      minRmsInSpan = f.rms;
    } else {
      peakRms = Math.max(peakRms, f.rms);
      minRmsInSpan = Math.min(minRmsInSpan, f.rms);
    }
  }
  if (frames.length > 0 && activeMidi !== null) {
    flushSegment(frames[frames.length - 1].timeSec + hopSize / sampleRate);
  }

  if (segments.length === 0) {
    throw new Error(
      "未能在音频中识别出清晰单音旋律，请上传人声清唱、独奏乐器或纯钢琴录音（支持 .mp3 / .wav / .m4a）。",
    );
  }

  const detectedBpm = Math.max(
    45,
    Math.min(180, options.bpmOverride ?? estimateBpmFromOnsets(segments)),
  );
  const secPerBeat = 60 / detectedBpm;
  const firstSec = segments[0].startSec;

  // Quantize right-hand melody notes on an eighth-note (0.5 beat) grid
  const rhNotes: SongNote[] = [];
  let prevBeat = -1;
  segments.forEach((seg, idx) => {
    const relBeat = Math.max(0, (seg.startSec - firstSec) / secPerBeat);
    let qStart = Math.round(relBeat * 2) / 2;
    if (qStart <= prevBeat) qStart = prevBeat + 0.5;
    const qDur = Math.max(0.5, Math.min(4, Math.round((seg.durationSec / secPerBeat) * 2) / 2));
    prevBeat = qStart;
    rhNotes.push({
      id: `aud-rh-${idx}`,
      midi: Math.max(21, Math.min(108, seg.midi)),
      startBeat: qStart,
      durationBeats: qDur,
      startSec: qStart * secPerBeat,
      durationSec: qDur * secPerBeat,
      velocity: Math.max(68, Math.min(115, Math.round(70 + seg.peakRms * 120))),
      hand: "right",
    });
  });

  const keySignature = detectKeySignature(rhNotes);
  const beatsPerBar = 4;
  const maxBeat = Math.max(...rhNotes.map((n) => n.startBeat + n.durationBeats));
  const totalBars = Math.max(1, Math.ceil(maxBeat / beatsPerBar));

  const chords: ChordMarker[] = [];
  for (let b = 0; b < totalBars; b++) {
    const barStart = b * beatsPerBar;
    const barEnd = (b + 1) * beatsPerBar;
    const barMidis = rhNotes
      .filter((n) => n.startBeat >= barStart - 0.05 && n.startBeat < barEnd - 0.05)
      .map((n) => n.midi);
    if (barMidis.length === 0) continue;
    const symbol = pickBarChordSymbol(barMidis, keySignature);
    chords.push({ startBeat: barStart, symbol });
  }

  const jianpuDraft = buildJianpuDraftFromNotes(rhNotes, chords, keySignature, beatsPerBar);

  // Build Song through the unified Jianpu/Accompaniment compiler when autoAccompaniment is requested,
  // or attach quantized RH + optional LH chords directly.
  if (options.autoAccompaniment !== false) {
    const compiled = parseJianpuText(jianpuDraft, {
      title: options.title || "Audio Transcribed Song",
      composer: "Web Audio Auto-Transcriber",
      keySignature,
      bpm: detectedBpm,
      timeSignature: [4, 4],
      autoAccompaniment: true,
      recommendedModel: options.recommendedModel ?? "kbp1100",
    });
    compiled.id = `audio-${Date.now()}`;
    compiled.sourceFormat = "audio";
    compiled.descriptionZh = `由音频自动扒谱生成 (${rhNotes.length} 旋律音符 · ${chords.length} 小节自动和弦 · 1=${keySignature} · ${detectedBpm} BPM)`;
    compiled.descriptionEn = `Transcribed from audio (${rhNotes.length} melody notes · ${chords.length} auto chords · Key ${keySignature} · ${detectedBpm} BPM)`;
    return {
      song: compiled,
      jianpuDraft,
      analyzedSeconds,
      totalSeconds,
      detectedBpm,
    };
  }

  const allNotes = assignFingersAndHands(rhNotes, 57);
  const song: Song = {
    id: `audio-${Date.now()}`,
    title: options.title?.trim() || "Audio Transcribed Song",
    titleZh: options.title?.trim() || "音频自动扒谱",
    composer: "Web Audio Auto-Transcriber",
    category: "imported",
    difficulty: 2,
    bpm: detectedBpm,
    timeSignature: [4, 4],
    keySignature,
    recommendedModel: options.recommendedModel ?? "kbp1100",
    recommendedVoice: "grand-piano",
    sourceFormat: "audio",
    splitMidi: 57,
    descriptionZh: `由音频自动扒谱提取旋律 (${rhNotes.length} 音符 · 1=${keySignature} · ${detectedBpm} BPM)`,
    descriptionEn: `Transcribed melody from audio (${rhNotes.length} notes · Key ${keySignature} · ${detectedBpm} BPM)`,
    notes: allNotes,
    chords,
    createdAt: new Date().toISOString(),
  };

  return {
    song,
    jianpuDraft,
    analyzedSeconds,
    totalSeconds,
    detectedBpm,
  };
}

/**
 * Decodes an uploaded browser audio File (.mp3 / .wav / .m4a / .ogg / .flac)
 * via Web Audio API and transcribes it into playable sheet music & Arcade chart.
 */
export async function transcribeAudioFile(
  file: File,
  options: AudioTranscriptionOptions = {},
): Promise<AudioTranscriptionResult> {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") {
    throw new Error("浏览器音频解码器不可用，请在现代桌面或手机浏览器中运行。");
  }

  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuffer);
    const len = audioBuf.length;
    const chCount = Math.max(1, audioBuf.numberOfChannels);
    const mono = new Float32Array(len);
    for (let ch = 0; ch < chCount; ch++) {
      const data = audioBuf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        mono[i] += data[i] / chCount;
      }
    }
    const cleanTitle =
      options.title ||
      file.name.replace(/\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i, "");
    return transcribeAudioSamples(mono, audioBuf.sampleRate, {
      ...options,
      title: cleanTitle,
    });
  } finally {
    await ctx.close();
  }
}
