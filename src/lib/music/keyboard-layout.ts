import { isBlackKey } from "./theory";

export interface KeyRect {
  midi: number;
  isBlack: boolean;
  /** Normalized horizontal start in [0..1] across the keyboard width */
  x: number;
  /** Normalized width in [0..1] */
  w: number;
}

const BLACK_OFFSET_WITHIN_OCTAVE: Record<number, number> = {
  1: 0.65,  // C# between C(0) and D(1)
  3: 1.75,  // D# between D(1) and E(2)
  6: 3.62,  // F# between F(3) and G(4)
  8: 4.68,  // G# between G(4) and A(5)
  10: 5.75, // A# between A(5) and B(6)
};

/**
 * Computes exact normalized X & Width geometry for all keys in [minMidi, maxMidi].
 * Shared by both the Canvas Falling-Notes Roll and the HTML Yamaha Keyboard
 * so every falling bar aligns pixel-for-pixel with its physical key!
 */
export function computeKeyboardLayout(minMidi: number, maxMidi: number): {
  whiteKeys: KeyRect[];
  blackKeys: KeyRect[];
  byMidi: Map<number, KeyRect>;
  whiteCount: number;
} {
  const whiteMidis: number[] = [];
  for (let m = minMidi; m <= maxMidi; m++) {
    if (!isBlackKey(m)) whiteMidis.push(m);
  }
  const whiteCount = Math.max(1, whiteMidis.length);
  const whiteW = 1 / whiteCount;
  const blackW = whiteW * 0.62;

  const whiteIndexMap = new Map<number, number>();
  whiteMidis.forEach((m, idx) => whiteIndexMap.set(m, idx));

  const whiteKeys: KeyRect[] = [];
  const blackKeys: KeyRect[] = [];
  const byMidi = new Map<number, KeyRect>();

  for (let m = minMidi; m <= maxMidi; m++) {
    if (!isBlackKey(m)) {
      const idx = whiteIndexMap.get(m)!;
      const rect: KeyRect = { midi: m, isBlack: false, x: idx * whiteW, w: whiteW };
      whiteKeys.push(rect);
      byMidi.set(m, rect);
    } else {
      // Position relative to the preceding white key
      const prevWhiteIdx = whiteIndexMap.get(m - 1);
      const pc = ((m % 12) + 12) % 12;
      const centerWhiteRatio =
        prevWhiteIdx !== undefined
          ? prevWhiteIdx + 1 + ((BLACK_OFFSET_WITHIN_OCTAVE[pc] % 1) - 0.68) * 0.25
          : 0.5;
      const x = Math.max(0, Math.min(1 - blackW, centerWhiteRatio * whiteW - blackW / 2));
      const rect: KeyRect = { midi: m, isBlack: true, x, w: blackW };
      blackKeys.push(rect);
      byMidi.set(m, rect);
    }
  }

  return { whiteKeys, blackKeys, byMidi, whiteCount };
}

/**
 * Resolves a normalized (x, y) point inside the keybed container ([0..1], [0..1])
 * to the topmost KeyRect MIDI number, giving black keys priority in the top 62%.
 * Shared by Android multi-touch glissando pointer handlers and unit tests.
 */
export function findMidiAtNormalizedPoint(
  normX: number,
  normY: number,
  layout: { whiteKeys: KeyRect[]; blackKeys: KeyRect[] },
): number | null {
  if (normX < 0 || normX > 1 || normY < 0 || normY > 1) return null;

  if (normY <= 0.62) {
    for (const bk of layout.blackKeys) {
      if (normX >= bk.x && normX <= bk.x + bk.w) {
        return bk.midi;
      }
    }
  }

  for (const wk of layout.whiteKeys) {
    if (normX >= wk.x && normX <= wk.x + wk.w) {
      return wk.midi;
    }
  }

  return null;
}
