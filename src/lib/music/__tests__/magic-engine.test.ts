import { describe, expect, it } from "vitest";
import {
  buildMagicRhythmSteps,
  buildOfflineBlueprintSong,
  compileImprovTakeToSong,
  snapMidiToSmartScale,
} from "../magic-engine";
import type { Song } from "@/types/music";

describe("magic-engine", () => {
  it("snaps dissonant black keys to C major pentatonic while keeping left-to-right contour", () => {
    const pcs = new Set([0, 2, 4, 7, 9]);
    const snappedCs = snapMidiToSmartScale(61, "C", "C", false, 90);
    const snappedFs = snapMidiToSmartScale(66, "C", "C", false, 90);
    expect(pcs.has(snappedCs.primaryMidi % 12)).toBe(true);
    expect(pcs.has(snappedFs.primaryMidi % 12)).toBe(true);
    expect(snappedFs.primaryMidi).toBeGreaterThanOrEqual(snappedCs.primaryMidi);
  });

  it("prioritizes active chord tones on strong beats and adds harmony at high velocity", () => {
    const res = snapMidiToSmartScale(69, "C", "G", true, 118); // near G/B/D chord tones
    const gChordPcs = new Set([7, 11, 2]);
    expect(gChordPcs.has(res.primaryMidi % 12)).toBe(true);
    expect(res.harmonyMidi).toBeDefined();
    expect(res.harmonyMidi!).toBeGreaterThan(res.primaryMidi);
  });

  it("pairs melody steps with matching left-hand accompaniment notes", () => {
    const song: Song = {
      id: "test-lh",
      title: "Test Song",
      composer: "Test",
      category: "drill",
      difficulty: 1,
      bpm: 120,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      sourceFormat: "builtin",
      splitMidi: 54,
      descriptionZh: "",
      descriptionEn: "",
      chords: [{ startBeat: 0, symbol: "C" }],
      createdAt: "2026-01-01T00:00:00Z",
      notes: [
        { id: "r1", midi: 64, startSec: 0, durationSec: 0.5, startBeat: 0, durationBeats: 1, velocity: 90, hand: "right", chordSymbol: "C" },
        { id: "l1", midi: 48, startSec: 0, durationSec: 1.0, startBeat: 0, durationBeats: 2, velocity: 70, hand: "left" },
        { id: "r2", midi: 67, startSec: 0.5, durationSec: 0.5, startBeat: 1, durationBeats: 1, velocity: 90, hand: "right" },
      ],
    };

    const steps = buildMagicRhythmSteps(song);
    expect(steps.length).toBe(2);
    expect(steps[0].melodyMidis).toEqual([64]);
    expect(steps[0].chordMidis).toContain(48);
  });

  it("compiles improv takes into quantized Songs with left-hand accompaniment", () => {
    const song = compileImprovTakeToSong(
      [
        { midi: 60, startSec: 1.0, durationSec: 0.4, velocity: 95, chordSymbol: "C" },
        { midi: 64, startSec: 1.5, durationSec: 0.4, velocity: 95, chordSymbol: "C" },
        { midi: 69, startSec: 3.0, durationSec: 0.5, velocity: 95, chordSymbol: "Am" },
      ],
      { bpm: 120, keySignature: "C", voiceName: "grand-piano" },
    );

    expect(song).not.toBeNull();
    expect(song!.notes.some((n) => n.hand === "left")).toBe(true);
    expect(song!.notes.some((n) => n.hand === "right")).toBe(true);
    expect(song!.chords.map((c) => c.symbol)).toEqual(["C", "Am"]);
  });

  it("generates clearly labeled local offline template songs", () => {
    const song = buildOfflineBlueprintSong("天空之城", "kbp1100");
    expect(song.composer).toBe("Local Offline Template");
    expect(song.notes.length).toBeGreaterThan(8);
  });
});
