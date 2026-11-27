import { describe, expect, it } from "vitest";
import { buildSongShareUrl, decodeSongShareCode, encodeSongShareCode } from "../song-share";
import type { Song } from "@/types/music";

describe("song-share codec", () => {
  it("performs lossless URL/code roundtrip with CJK titles, fingers, and chords", () => {
    const sample: Song = {
      id: "demo-cjk",
      title: "Jasmine Melody",
      titleZh: "茉莉花自定义",
      composer: "User",
      category: "imported",
      difficulty: 2,
      bpm: 108,
      timeSignature: [4, 4],
      keySignature: "G",
      recommendedModel: "psr1100",
      recommendedVoice: "guzheng",
      sourceFormat: "jianpu",
      splitMidi: 54,
      descriptionZh: "",
      descriptionEn: "",
      chords: [{ startBeat: 0, symbol: "G" }],
      createdAt: "2026-01-01T00:00:00Z",
      notes: [
        { id: "n1", midi: 67, startSec: 0, durationSec: 0.5, startBeat: 0, durationBeats: 1, velocity: 90, hand: "right", finger: 3, chordSymbol: "G" },
        { id: "n2", midi: 55, startSec: 0.5, durationSec: 0.5, startBeat: 1, durationBeats: 1, velocity: 72, hand: "left" },
      ],
    };

    const code = encodeSongShareCode(sample);
    expect(code.startsWith("K1100:")).toBe(true);

    const decoded = decodeSongShareCode(code);
    expect(decoded).not.toBeNull();
    expect(decoded!.titleZh).toBe("茉莉花自定义");
    expect(decoded!.bpm).toBe(108);
    expect(decoded!.notes.length).toBe(2);
    expect(decoded!.notes[0].finger).toBe(3);
    expect(decoded!.notes[0].chordSymbol).toBe("G");
    expect(decoded!.notes[1].hand).toBe("left");

    const url = buildSongShareUrl(sample, "https://example.com");
    const fromUrl = decodeSongShareCode(url);
    expect(fromUrl?.notes.length).toBe(2);
  });

  it("returns null gracefully for malformed share inputs", () => {
    expect(decodeSongShareCode("")).toBeNull();
    expect(decodeSongShareCode("K1100:not-valid-base64!!!")).toBeNull();
  });
});
