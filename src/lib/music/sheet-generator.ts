import type { HandSide, Song, SongNote } from "@/types/music";
import { getKeySpec, midiToJianpu, midiToStaffPosition, type JianpuPitch } from "./theory";

export type NoteValueType = "whole" | "half" | "quarter" | "eighth" | "sixteenth";

export interface StaffEvent {
  id: string;
  hand: HandSide;
  beatInMeasure: number;
  globalBeat: number;
  durationBeats: number;
  noteType: NoteValueType;
  dotted: boolean;
  notes: {
    midi: number;
    step: number;
    accidental: "#" | "b" | "";
    finger?: 1 | 2 | 3 | 4 | 5;
    jianpu: JianpuPitch;
  }[];
}

export interface SheetMeasure {
  measureIndex: number;
  startBeat: number;
  beatsPerMeasure: number;
  chords: { beatInMeasure: number; symbol: string }[];
  trebleEvents: StaffEvent[];
  bassEvents: StaffEvent[];
}

function classifyNoteDuration(beats: number): { noteType: NoteValueType; dotted: boolean } {
  if (beats >= 3.5) return { noteType: "whole", dotted: false };
  if (beats >= 2.75) return { noteType: "half", dotted: true };
  if (beats >= 1.75) return { noteType: "half", dotted: false };
  if (beats >= 1.35) return { noteType: "quarter", dotted: true };
  if (beats >= 0.85) return { noteType: "quarter", dotted: false };
  if (beats >= 0.65) return { noteType: "eighth", dotted: true };
  if (beats >= 0.35) return { noteType: "eighth", dotted: false };
  return { noteType: "sixteenth", dotted: false };
}

function groupEventsByBeat(
  notes: SongNote[],
  hand: HandSide,
  measureStartBeat: number,
  preferFlats: boolean,
  keySig: string,
): StaffEvent[] {
  const buckets = new Map<number, SongNote[]>();
  for (const n of notes) {
    const qBeat = Math.round(n.startBeat * 4) / 4;
    const list = buckets.get(qBeat) ?? [];
    list.push(n);
    buckets.set(qBeat, list);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([globalBeat, group]) => {
      const sorted = [...group].sort((a, b) => a.midi - b.midi);
      const maxDur = Math.max(...sorted.map((n) => n.durationBeats));
      const { noteType, dotted } = classifyNoteDuration(maxDur);
      return {
        id: `${hand}-${globalBeat}`,
        hand,
        beatInMeasure: Math.max(0, globalBeat - measureStartBeat),
        globalBeat,
        durationBeats: maxDur,
        noteType,
        dotted,
        notes: sorted.map((n) => {
          const staffPos = midiToStaffPosition(n.midi, preferFlats);
          return {
            midi: n.midi,
            step: staffPos.step,
            accidental: staffPos.accidental,
            finger: n.finger,
            jianpu: midiToJianpu(n.midi, keySig),
          };
        }),
      };
    });
}

/**
 * Generates synchronized Grand Staff + Jianpu measure layout from any Song.
 */
export function buildSheetMeasures(song: Song): SheetMeasure[] {
  const [num, den] = song.timeSignature;
  const beatsPerMeasure = num * (4 / den);
  const spec = getKeySpec(song.keySignature);

  const maxStartBeat =
    song.notes.length > 0
      ? Math.max(...song.notes.map((n) => n.startBeat))
      : 0;
  const measureCount = Math.max(1, Math.floor(maxStartBeat / beatsPerMeasure) + 1);

  const measures: SheetMeasure[] = [];
  for (let m = 0; m < measureCount; m++) {
    const startBeat = m * beatsPerMeasure;
    const endBeat = startBeat + beatsPerMeasure;

    const measureNotes = song.notes.filter(
      (n) => n.startBeat >= startBeat - 0.05 && n.startBeat < endBeat - 0.05,
    );
    const rh = measureNotes.filter((n) => n.hand === "right");
    const lh = measureNotes.filter((n) => n.hand === "left");

    const chords = song.chords
      .filter((c) => c.startBeat >= startBeat - 0.05 && c.startBeat < endBeat - 0.05)
      .map((c) => ({
        beatInMeasure: Math.max(0, c.startBeat - startBeat),
        symbol: c.symbol,
      }));

    measures.push({
      measureIndex: m,
      startBeat,
      beatsPerMeasure,
      chords,
      trebleEvents: groupEventsByBeat(rh, "right", startBeat, spec.preferFlats, song.keySignature),
      bassEvents: groupEventsByBeat(lh, "left", startBeat, spec.preferFlats, song.keySignature),
    });
  }

  return measures;
}
