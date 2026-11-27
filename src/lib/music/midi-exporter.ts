import type { Song } from "@/types/music";

function writeVlq(value: number): number[] {
  const bytes: number[] = [];
  let v = Math.max(0, Math.floor(value));
  bytes.unshift(v & 0x7f);
  while ((v >>= 7) > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
  }
  return bytes;
}

/**
 * Exports any Song to Standard MIDI File (SMF Format 1) bytes,
 * ready to load onto Yamaha PSR-1100 / KBP-1100 via USB!
 */
export function exportSongToMidi(song: Song): Uint8Array {
  const ppq = 480;
  const usPerBeat = Math.round(60_000_000 / Math.max(40, song.bpm));

  const buildTrackChunk = (events: { tick: number; bytes: number[] }[]): number[] => {
    const sorted = [...events].sort((a, b) => a.tick - b.tick);
    const body: number[] = [];
    let lastTick = 0;
    for (const ev of sorted) {
      const delta = Math.max(0, ev.tick - lastTick);
      lastTick = ev.tick;
      body.push(...writeVlq(delta), ...ev.bytes);
    }
    // End of Track
    body.push(0x00, 0xff, 0x2f, 0x00);

    const len = body.length;
    return [
      0x4d, 0x54, 0x72, 0x6b, // MTrk
      (len >>> 24) & 0xff,
      (len >>> 16) & 0xff,
      (len >>> 8) & 0xff,
      len & 0xff,
      ...body,
    ];
  };

  // Track 0: Tempo & Time Signature
  const metaEvents: { tick: number; bytes: number[] }[] = [
    {
      tick: 0,
      bytes: [
        0xff, 0x51, 0x03,
        (usPerBeat >>> 16) & 0xff,
        (usPerBeat >>> 8) & 0xff,
        usPerBeat & 0xff,
      ],
    },
    {
      tick: 0,
      bytes: [
        0xff, 0x58, 0x04,
        song.timeSignature[0],
        Math.round(Math.log2(song.timeSignature[1])),
        24,
        8,
      ],
    },
  ];

  // Track 1 (RH ch 0) & Track 2 (LH ch 1)
  const rhEvents: { tick: number; bytes: number[] }[] = [];
  const lhEvents: { tick: number; bytes: number[] }[] = [];

  for (const n of song.notes) {
    const startTick = Math.round(n.startBeat * ppq);
    const endTick = Math.max(startTick + 30, Math.round((n.startBeat + n.durationBeats) * ppq));
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity)));
    const target = n.hand === "left" ? lhEvents : rhEvents;
    const ch = n.hand === "left" ? 1 : 0;
    target.push({ tick: startTick, bytes: [0x90 | ch, n.midi & 0x7f, vel] });
    target.push({ tick: endTick, bytes: [0x80 | ch, n.midi & 0x7f, 0] });
  }

  const tracks = [buildTrackChunk(metaEvents), buildTrackChunk(rhEvents), buildTrackChunk(lhEvents)];
  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x01, // Format 1
    0x00, tracks.length,
    (ppq >>> 8) & 0xff,
    ppq & 0xff,
  ];

  const all = [...header, ...tracks.flat()];
  return new Uint8Array(all);
}
