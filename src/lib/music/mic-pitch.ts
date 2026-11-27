import { midiToName } from "./theory";

export interface PitchDetectionResult {
  hz: number;
  midi: number;
  noteName: string;
  clarity: number;
  rms: number;
}

/**
 * Time-domain normalized autocorrelation pitch detector optimized for piano/keyboard tones (C2..C7).
 * Enables keyboards without USB-MIDI (such as Casio CTK-1100) to be graded via microphone.
 */
export function detectPitchFromSamples(
  samples: Float32Array,
  sampleRate: number,
  minRms = 0.015,
  minClarity = 0.82,
  minHz = 60,
  maxHz = 2100,
): PitchDetectionResult | null {
  const n = samples.length;
  if (n < 512) return null;

  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    sumSq += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSq / n);
  if (rms < minRms) return null;

  // Search lag range corresponding to [minHz..maxHz]
  const minLag = Math.max(10, Math.floor(sampleRate / Math.max(200, maxHz)));
  const maxLag = Math.min(Math.floor(n / 2), Math.floor(sampleRate / Math.max(40, minHz)));
  if (maxLag <= minLag) return null;

  let bestLag = -1;
  let bestCorr = 0;

  // First compute normalized autocorrelation across candidate lags
  const corrs = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let dot = 0;
    let e1 = 0;
    let e2 = 0;
    const limit = n - lag;
    for (let i = 0; i < limit; i++) {
      const a = samples[i];
      const b = samples[i + lag];
      dot += a * b;
      e1 += a * a;
      e2 += b * b;
    }
    const denom = Math.sqrt(e1 * e2);
    const c = denom > 1e-8 ? dot / denom : 0;
    corrs[lag] = c;
    if (c > bestCorr) {
      bestCorr = c;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorr < minClarity) return null;

  // Prefer the first local peak that reaches >= 95% of global bestCorr to avoid octave-down subharmonics
  for (let lag = minLag + 1; lag < bestLag; lag++) {
    if (
      corrs[lag] >= bestCorr * 0.94 &&
      corrs[lag] > corrs[lag - 1] &&
      corrs[lag] >= corrs[lag + 1]
    ) {
      bestLag = lag;
      bestCorr = corrs[lag];
      break;
    }
  }

  // Parabolic interpolation for sub-sample precision
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y0 = corrs[bestLag - 1];
    const y1 = corrs[bestLag];
    const y2 = corrs[bestLag + 1];
    const denom = 2 * (2 * y1 - y0 - y2);
    if (Math.abs(denom) > 1e-6) {
      refinedLag = bestLag + (y0 - y2) / denom;
    }
  }

  const hz = sampleRate / refinedLag;
  if (hz < 55 || hz > 2200) return null;

  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  if (midi < 21 || midi > 108) return null;

  return {
    hz,
    midi,
    noteName: midiToName(midi),
    clarity: bestCorr,
    rms,
  };
}
