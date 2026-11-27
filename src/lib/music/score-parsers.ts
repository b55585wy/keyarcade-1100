import type { ChordMarker, HandSide, Song, SongNote, YamahaModelId } from "@/types/music";
import { assignFingersAndHands, chordToMidiNotes, detectKeySignature, getKeySpec } from "./theory";

export interface JianpuImportOptions {
  title: string;
  composer?: string;
  keySignature?: string;
  bpm?: number;
  timeSignature?: [number, number];
  autoAccompaniment?: boolean;
  recommendedModel?: YamahaModelId;
}

const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];

/**
 * Parses numbered musical notation (简谱) into playable SongNote[] + grand staff + arcade chart!
 * Supported syntax:
 *   [C] 1 2 3 1 | [Am] 1 2 3 1 | [F] 3 4 5 - | [G7] 5_ 6_ 5_ 4_ 3 1
 *   - 1..7 scale degrees, 0 = rest, - = extend previous note by 1 beat
 *   - ' = +1 octave, , or . (trailing) = -1 octave
 *   - # or b prefix for accidentals
 *   - _ or /2 suffix = eighth note (0.5 beat); __ or /4 = sixteenth (0.25 beat)
 *   - * suffix = dotted (1.5x)
 *   - [Chord] inline triggers Yamaha auto-accompaniment LH triad/arpeggio!
 */
export function parseJianpuText(rawText: string, opts: JianpuImportOptions): Song {
  const keySig = opts.keySignature || "C";
  const bpm = Math.max(40, Math.min(200, opts.bpm ?? 100));
  const timeSig: [number, number] = opts.timeSignature ?? [4, 4];
  const secPerBeat = 60 / bpm;
  const spec = getKeySpec(keySig);
  const tonicC4 = 60 + (spec.jianpuRootPc > 7 ? spec.jianpuRootPc - 12 : spec.jianpuRootPc);

  const tokens = rawText
    .replace(/\|/g, " ")
    .replace(/\r?\n/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const notes: SongNote[] = [];
  const chords: ChordMarker[] = [];
  let beat = 0;
  let lastMelodyNote: SongNote | null = null;
  let noteSeq = 0;

  for (const rawTok of tokens) {
    let tok = rawTok;

    // Leading inline chord like [C]1 or standalone [C]
    const chordMatch = /^\[([A-G][#b]?(?:maj7|m7|m|7|dim|aug|sus4|sus2|6)?)\](.*)$/i.exec(tok);
    if (chordMatch) {
      const symbol = chordMatch[1].charAt(0).toUpperCase() + chordMatch[1].slice(1);
      chords.push({ startBeat: beat, symbol });
      if (opts.autoAccompaniment !== false) {
        const chordMidis = chordToMidiNotes(symbol, 3);
        const barBeats = timeSig[0] * (4 / timeSig[1]);
        chordMidis.forEach((m, idx) => {
          const offset = idx * 0.5;
          if (offset < barBeats) {
            notes.push({
              id: `jp-lh-${noteSeq++}`,
              midi: m,
              startBeat: beat + offset,
              durationBeats: Math.max(0.5, barBeats - offset),
              startSec: (beat + offset) * secPerBeat,
              durationSec: Math.max(0.5, barBeats - offset) * secPerBeat,
              velocity: 74,
              hand: "left",
            });
          }
        });
      }
      tok = chordMatch[2];
      if (!tok) continue;
    }

    if (tok === "-") {
      if (lastMelodyNote) {
        lastMelodyNote.durationBeats += 1;
        lastMelodyNote.durationSec = lastMelodyNote.durationBeats * secPerBeat;
      }
      beat += 1;
      continue;
    }

    const noteMatch = /^([#b]?)([0-7])(['.,]*)(_{1,2}|\/2|\/4)?(\*)?(-*)$/.exec(tok);
    if (!noteMatch) continue;

    const [, acc, degStr, octMarks, subDiv, dot, dashes] = noteMatch;
    const deg = parseInt(degStr, 10);

    let dur = 1;
    if (subDiv === "_" || subDiv === "/2") dur = 0.5;
    else if (subDiv === "__" || subDiv === "/4") dur = 0.25;
    if (dot === "*") dur *= 1.5;
    if (dashes) dur += dashes.length;

    if (deg === 0) {
      lastMelodyNote = null;
      beat += dur;
      continue;
    }

    let octShift = 0;
    for (const ch of octMarks) {
      if (ch === "'") octShift += 1;
      if (ch === "," || ch === ".") octShift -= 1;
    }
    const accShift = acc === "#" ? 1 : acc === "b" ? -1 : 0;
    const midi = tonicC4 + MAJOR_SCALE_OFFSETS[deg - 1] + accShift + octShift * 12;

    const note: SongNote = {
      id: `jp-rh-${noteSeq++}`,
      midi: Math.max(21, Math.min(108, midi)),
      startBeat: beat,
      durationBeats: dur,
      startSec: beat * secPerBeat,
      durationSec: dur * secPerBeat,
      velocity: 96,
      hand: "right",
    };
    notes.push(note);
    lastMelodyNote = note;
    beat += dur;
  }

  if (notes.length === 0) {
    throw new Error("Could not parse any valid Jianpu notes (use digits 1-7, 0 for rest, - to sustain).");
  }

  const enriched = assignFingersAndHands(notes, 57);
  return {
    id: `jianpu-${Date.now()}`,
    title: opts.title.trim() || "Jianpu Etude",
    titleZh: opts.title.trim() || "简谱自定义曲目",
    composer: opts.composer?.trim() || "Yamaha 1100 Jianpu Studio",
    category: "imported",
    difficulty: 2,
    bpm,
    timeSignature: timeSig,
    keySignature: keySig,
    recommendedModel: opts.recommendedModel ?? "kbp1100",
    recommendedVoice: "grand-piano",
    sourceFormat: "jianpu",
    splitMidi: 57,
    descriptionZh: `由简谱文本自动生成五线谱、简谱与落键谱 · 调号 1=${keySig} · ${bpm} BPM`,
    descriptionEn: `Auto-generated Staff, Jianpu & Arcade chart from numbered notation · Key ${keySig} · ${bpm} BPM`,
    notes: enriched,
    chords,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Parses uncompressed MusicXML (.musicxml / .xml) in the browser using DOMParser.
 */
export function parseMusicXml(xmlText: string, fileName = "Imported MusicXML"): Song {
  if (typeof DOMParser === "undefined") {
    throw new Error("MusicXML parser requires a browser DOM environment.");
  }
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserErr = doc.querySelector("parsererror");
  if (parserErr) {
    throw new Error("Invalid MusicXML document");
  }

  const workTitle =
    doc.querySelector("work > work-title")?.textContent?.trim() ||
    doc.querySelector("movement-title")?.textContent?.trim() ||
    fileName.replace(/\.(musicxml|xml)$/i, "");
  const composer =
    doc.querySelector('creator[type="composer"]')?.textContent?.trim() || "MusicXML Import";

  let bpm = 100;
  const soundEl = doc.querySelector("sound[tempo]");
  if (soundEl) {
    const val = parseFloat(soundEl.getAttribute("tempo") || "100");
    if (!Number.isNaN(val) && val > 20) bpm = Math.round(val);
  }
  const secPerBeat = 60 / bpm;

  let divisions = 1;
  let timeSignature: [number, number] = [4, 4];
  let fifths = 0;

  const fifthsMap: Record<number, string> = {
    [-4]: "Ab",
    [-3]: "Eb",
    [-2]: "Bb",
    [-1]: "F",
    0: "C",
    1: "G",
    2: "D",
    3: "A",
    4: "E",
  };

  const letterPc: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const notes: SongNote[] = [];
  const chords: ChordMarker[] = [];

  const parts = Array.from(doc.querySelectorAll("part"));
  let seq = 0;

  parts.forEach((part, partIdx) => {
    let cursorBeat = 0;
    let lastBeat = 0;
    const measures = Array.from(part.querySelectorAll("measure"));

    for (const measure of measures) {
      const divEl = measure.querySelector("attributes > divisions");
      if (divEl?.textContent) {
        divisions = Math.max(1, parseInt(divEl.textContent, 10));
      }
      const beatsEl = measure.querySelector("attributes > time > beats");
      const beatTypeEl = measure.querySelector("attributes > time > beat-type");
      if (beatsEl?.textContent && beatTypeEl?.textContent) {
        timeSignature = [parseInt(beatsEl.textContent, 10), parseInt(beatTypeEl.textContent, 10)];
      }
      const fifthsEl = measure.querySelector("attributes > key > fifths");
      if (fifthsEl?.textContent) {
        fifths = parseInt(fifthsEl.textContent, 10);
      }

      for (const child of Array.from(measure.children)) {
        if (child.tagName === "harmony") {
          const rootStep = child.querySelector("root > root-step")?.textContent?.trim() || "";
          const rootAlter = parseInt(child.querySelector("root > root-alter")?.textContent || "0", 10);
          const kind = child.querySelector("kind")?.textContent?.trim() || "";
          if (rootStep) {
            const acc = rootAlter === 1 ? "#" : rootAlter === -1 ? "b" : "";
            const suf = kind.includes("minor") ? "m" : kind.includes("dominant") ? "7" : "";
            chords.push({ startBeat: cursorBeat, symbol: `${rootStep}${acc}${suf}` });
          }
          continue;
        }
        if (child.tagName === "backup") {
          const d = parseInt(child.querySelector("duration")?.textContent || "0", 10);
          cursorBeat = Math.max(0, cursorBeat - d / divisions);
          continue;
        }
        if (child.tagName === "forward") {
          const d = parseInt(child.querySelector("duration")?.textContent || "0", 10);
          cursorBeat += d / divisions;
          continue;
        }
        if (child.tagName !== "note") continue;

        const isChord = Boolean(child.querySelector("chord"));
        const isRest = Boolean(child.querySelector("rest"));
        const rawDur = parseInt(child.querySelector("duration")?.textContent || String(divisions), 10);
        const durBeats = Math.max(0.25, rawDur / divisions);
        const noteBeat = isChord ? lastBeat : cursorBeat;

        if (!isRest) {
          const step = child.querySelector("pitch > step")?.textContent?.trim();
          const alter = parseInt(child.querySelector("pitch > alter")?.textContent || "0", 10);
          const octave = parseInt(child.querySelector("pitch > octave")?.textContent || "4", 10);
          const staff = parseInt(child.querySelector("staff")?.textContent || "1", 10);

          if (step && step in letterPc) {
            const midi = (octave + 1) * 12 + letterPc[step] + alter;
            const hand: HandSide =
              staff === 2 || partIdx > 0 || midi < 57 ? "left" : "right";
            notes.push({
              id: `mxml-${seq++}`,
              midi: Math.max(21, Math.min(108, midi)),
              startBeat: noteBeat,
              durationBeats: durBeats,
              startSec: noteBeat * secPerBeat,
              durationSec: durBeats * secPerBeat,
              velocity: hand === "right" ? 96 : 76,
              hand,
            });
          }
        }

        if (!isChord) {
          lastBeat = cursorBeat;
          cursorBeat += durBeats;
        }
      }
    }
  });

  if (notes.length === 0) {
    throw new Error("No notes found in MusicXML file.");
  }

  const enriched = assignFingersAndHands(notes, 57);
  const keySig = fifthsMap[fifths] || detectKeySignature(enriched);

  return {
    id: `mxml-${Date.now()}`,
    title: workTitle,
    composer,
    category: "imported",
    difficulty: 2,
    bpm,
    timeSignature,
    keySignature: keySig,
    recommendedModel: "kbp1100",
    recommendedVoice: "grand-piano",
    sourceFormat: "musicxml",
    splitMidi: 57,
    descriptionZh: `从 MusicXML 导入 · ${enriched.length} 个音符 · 五线谱与简谱已自动对齐`,
    descriptionEn: `Imported from MusicXML · ${enriched.length} notes · Grand staff & Jianpu synchronized`,
    notes: enriched,
    chords,
    createdAt: new Date().toISOString(),
  };
}
