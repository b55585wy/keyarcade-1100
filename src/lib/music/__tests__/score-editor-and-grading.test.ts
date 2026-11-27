import { describe, expect, it } from "vitest";
import {
  popLastSongNote,
  toEditableCustomCopy,
  transposeSong,
  trimLeadingSilence,
} from "../score-editor";
import { computeLeadInStartSec, evaluateTimingHit } from "../arcade-grading";
import type { Song } from "@/types/music";

const mockSong: Song = {
  id: "builtin-test",
  title: "Mock Song",
  composer: "Test",
  category: "classical",
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
  chords: [{ startBeat: 2, symbol: "C" }],
  createdAt: "2026-01-01T00:00:00Z",
  notes: [
    { id: "1", midi: 60, startSec: 1.0, durationSec: 0.5, startBeat: 2, durationBeats: 1, velocity: 90, hand: "right" },
    { id: "2", midi: 107, startSec: 1.5, durationSec: 0.5, startBeat: 3, durationBeats: 1, velocity: 90, hand: "right" },
  ],
};

describe("score-editor & arcade-grading", () => {
  it("trims leading silence cleanly down to beat 0", () => {
    const trimmed = trimLeadingSilence(mockSong);
    expect(trimmed.notes[0].startBeat).toBe(0);
    expect(trimmed.notes[0].startSec).toBe(0);
    expect(trimmed.chords[0].startBeat).toBe(0);
  });

  it("transposes semitones safely clamped to 88-key range and pops last note", () => {
    const up = transposeSong(mockSong, 4);
    expect(up.notes[0].midi).toBe(64);
    expect(up.notes[1].midi).toBe(108); // clamped at C8

    const popped = popLastSongNote(mockSong);
    expect(popped.notes.length).toBe(1);

    const cloned = toEditableCustomCopy(mockSong);
    expect(cloned.sourceFormat).toBe("jianpu");
    expect(cloned.id).not.toBe(mockSong.id);
  });

  it("evaluates hit timing windows accurately per difficulty tier and lead-in", () => {
    expect(evaluateTimingHit(0.05, "strict")).toBe("PERFECT");
    expect(evaluateTimingHit(0.18, "strict")).toBeNull();
    expect(evaluateTimingHit(0.3, "relaxed")).toBe("GOOD");
    expect(evaluateTimingHit(0.3, "standard")).toBeNull();

    expect(computeLeadInStartSec(120, false)).toBe(-0.8);
    expect(computeLeadInStartSec(120, true)).toBe(-2.0);
  });
});
