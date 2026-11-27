import type { ChordMarker, HandSide, Song, SongNote } from "@/types/music";
import { assignFingersAndHands, detectChord, detectKeySignature } from "./theory";

interface TempoChange {
  tick: number;
  usPerBeat: number; // microseconds per quarter note
}

interface RawMidiNote {
  midi: number;
  startTick: number;
  endTick: number;
  velocity: number;
  channel: number;
  trackIndex: number;
}

class BinaryReader {
  private view: DataView;
  public offset = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get length(): number {
    return this.view.byteLength;
  }

  readUint8(): number {
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  readUint16(): number {
    const v = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return v;
  }

  readUint32(): number {
    const v = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return v;
  }

  readString(len: number): string {
    let out = "";
    for (let i = 0; i < len; i++) {
      out += String.fromCharCode(this.readUint8());
    }
    return out;
  }

  readVlq(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      if (this.offset >= this.length) break;
      const b = this.readUint8();
      value = (value << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    return value;
  }

  skip(n: number) {
    this.offset = Math.min(this.length, this.offset + n);
  }
}

export function parseMidiArrayBuffer(buffer: ArrayBuffer, fileName = "Imported MIDI"): Song {
  const reader = new BinaryReader(buffer);
  const headerId = reader.readString(4);
  if (headerId !== "MThd") {
    throw new Error("Invalid MIDI file: missing MThd header");
  }
  const headerLen = reader.readUint32();
  const format = reader.readUint16();
  const trackCount = reader.readUint16();
  const division = reader.readUint16();
  if (headerLen > 6) {
    reader.skip(headerLen - 6);
  }
  if ((division & 0x8000) !== 0) {
    throw new Error("SMPTE timecode MIDI files are not supported yet");
  }
  const ppq = division || 480;

  const tempoChanges: TempoChange[] = [{ tick: 0, usPerBeat: 500_000 }]; // default 120 BPM
  let timeSignature: [number, number] = [4, 4];
  let parsedTitle = fileName.replace(/\.(mid|midi)$/i, "");
  let parsedKey = "";

  const rawNotes: RawMidiNote[] = [];
  const trackNames: string[] = [];

  for (let t = 0; t < trackCount; t++) {
    if (reader.offset + 8 > reader.length) break;
    const chunkId = reader.readString(4);
    const chunkLen = reader.readUint32();
    const trackEnd = Math.min(reader.length, reader.offset + chunkLen);

    if (chunkId !== "MTrk") {
      reader.offset = trackEnd;
      continue;
    }

    let absTick = 0;
    let runningStatus = 0;
    const activeNotes = new Map<string, { startTick: number; velocity: number; channel: number }>();

    while (reader.offset < trackEnd) {
      const delta = reader.readVlq();
      absTick += delta;
      if (reader.offset >= trackEnd) break;

      let status = reader.readUint8();
      if ((status & 0x80) === 0) {
        // Running status: push byte back
        reader.offset -= 1;
        status = runningStatus;
      } else if (status < 0xf0) {
        runningStatus = status;
      }

      if (status === 0xff) {
        // Meta event
        const metaType = reader.readUint8();
        const metaLen = reader.readVlq();
        const dataStart = reader.offset;
        if (metaType === 0x51 && metaLen === 3) {
          const us =
            (reader.readUint8() << 16) | (reader.readUint8() << 8) | reader.readUint8();
          if (us > 0) tempoChanges.push({ tick: absTick, usPerBeat: us });
        } else if (metaType === 0x58 && metaLen >= 2) {
          const num = reader.readUint8();
          const denPow = reader.readUint8();
          timeSignature = [num, Math.pow(2, denPow)];
        } else if (metaType === 0x59 && metaLen >= 2) {
          const sf = (reader.readUint8() << 24) >> 24;
          const mi = reader.readUint8();
          const majorNames = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#"];
          const minorNames = ["Abm", "Ebm", "Bbm", "Fm", "Cm", "Gm", "Dm", "Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "A#m"];
          const idx = Math.max(0, Math.min(14, sf + 7));
          parsedKey = mi === 1 ? minorNames[idx] : majorNames[idx];
        } else if (metaType === 0x03 && metaLen > 0) {
          let label = "";
          for (let i = 0; i < metaLen && reader.offset < trackEnd; i++) {
            const c = reader.readUint8();
            if (c >= 32 && c <= 126) label += String.fromCharCode(c);
          }
          if (label.trim()) trackNames.push(label.trim());
          if (t === 0 && label.trim().length > 1) parsedTitle = label.trim();
        }
        reader.offset = Math.min(trackEnd, dataStart + metaLen);
      } else if (status === 0xf0 || status === 0xf7) {
        const sysLen = reader.readVlq();
        reader.skip(sysLen);
      } else {
        const type = status & 0xf0;
        const channel = status & 0x0f;
        const data1 = reader.readUint8();
        const data2 = type === 0xc0 || type === 0xd0 ? 0 : reader.readUint8();

        // Skip drum channel 9 (MIDI ch 10) for piano melody/harmony transcription
        if (channel === 9) continue;

        if (type === 0x90 && data2 > 0) {
          const key = `${channel}:${data1}`;
          const prev = activeNotes.get(key);
          if (prev) {
            rawNotes.push({
              midi: data1,
              startTick: prev.startTick,
              endTick: Math.max(prev.startTick + ppq / 8, absTick),
              velocity: prev.velocity,
              channel,
              trackIndex: t,
            });
          }
          activeNotes.set(key, { startTick: absTick, velocity: data2, channel });
        } else if (type === 0x80 || (type === 0x90 && data2 === 0)) {
          const key = `${channel}:${data1}`;
          const active = activeNotes.get(key);
          if (active) {
            rawNotes.push({
              midi: data1,
              startTick: active.startTick,
              endTick: Math.max(active.startTick + ppq / 8, absTick),
              velocity: active.velocity,
              channel,
              trackIndex: t,
            });
            activeNotes.delete(key);
          }
        }
      }
    }

    // Close hanging notes
    for (const [key, active] of activeNotes.entries()) {
      const midi = parseInt(key.split(":")[1], 10);
      rawNotes.push({
        midi,
        startTick: active.startTick,
        endTick: active.startTick + ppq / 2,
        velocity: active.velocity,
        channel: active.channel,
        trackIndex: t,
      });
    }

    reader.offset = trackEnd;
  }

  if (rawNotes.length === 0) {
    throw new Error("No playable piano/melody notes found in MIDI file (only percussion or empty tracks).");
  }

  tempoChanges.sort((a, b) => a.tick - b.tick);
  const initialBpm = Math.max(40, Math.min(220, Math.round(60_000_000 / tempoChanges[0].usPerBeat)));

  // Normalize start offset so song starts near beat 0
  const minTick = Math.min(...rawNotes.map((n) => n.startTick));
  const beatOffset = Math.floor(minTick / ppq);
  const baseTick = beatOffset * ppq;

  const tickToSec = (tick: number): number => {
    let elapsed = 0;
    let prevTick = 0;
    let curUs = tempoChanges[0].usPerBeat;
    for (const tc of tempoChanges) {
      if (tc.tick >= tick) break;
      if (tc.tick > prevTick) {
        elapsed += ((tc.tick - prevTick) / ppq) * (curUs / 1_000_000);
        prevTick = tc.tick;
      }
      curUs = tc.usPerBeat;
    }
    elapsed += ((tick - prevTick) / ppq) * (curUs / 1_000_000);
    return elapsed;
  };

  const baseSec = tickToSec(baseTick);

  // Determine track-based hand hint if format 1 has separate LH/RH piano tracks
  const nonEmptyTracks = [...new Set(rawNotes.map((n) => n.trackIndex))];
  const trackAvgPitch = new Map<number, number>();
  for (const ti of nonEmptyTracks) {
    const tNotes = rawNotes.filter((n) => n.trackIndex === ti);
    const avg = tNotes.reduce((s, n) => s + n.midi, 0) / tNotes.length;
    trackAvgPitch.set(ti, avg);
  }

  const hasSplitTracks =
    format === 1 &&
    nonEmptyTracks.length === 2 &&
    Math.abs((trackAvgPitch.get(nonEmptyTracks[0]) ?? 60) - (trackAvgPitch.get(nonEmptyTracks[1]) ?? 60)) >= 8;

  const highTrack = hasSplitTracks
    ? (trackAvgPitch.get(nonEmptyTracks[0])! >= trackAvgPitch.get(nonEmptyTracks[1])!
        ? nonEmptyTracks[0]
        : nonEmptyTracks[1])
    : -1;

  // Quantize to 16th-note grid (0.25 beats) for crisp sheet music & arcade alignment
  const quantizeBeat = (b: number) => Math.round(b * 4) / 4;

  const songNotes: SongNote[] = rawNotes
    .filter((n) => n.midi >= 21 && n.midi <= 108)
    .map((n, idx) => {
      const rawStartBeat = (n.startTick - baseTick) / ppq;
      const rawDurBeats = Math.max(0.25, (n.endTick - n.startTick) / ppq);
      const startBeat = quantizeBeat(rawStartBeat);
      const durationBeats = Math.max(0.25, quantizeBeat(rawDurBeats));
      const startSec = Math.max(0, tickToSec(n.startTick) - baseSec);
      const endSec = Math.max(startSec + 0.08, tickToSec(n.endTick) - baseSec);

      const hand: HandSide = hasSplitTracks
        ? n.trackIndex === highTrack
          ? "right"
          : "left"
        : n.midi >= 57
          ? "right"
          : "left";

      return {
        id: `mid-${idx}-${n.midi}`,
        midi: n.midi,
        startSec,
        durationSec: endSec - startSec,
        startBeat,
        durationBeats,
        velocity: n.velocity,
        hand,
      };
    });

  const enriched = assignFingersAndHands(songNotes, 57);
  const keySig = parsedKey || detectKeySignature(enriched);

  // Extract chord markers per measure from left-hand or simultaneous notes
  const beatsPerBar = timeSignature[0] * (4 / timeSignature[1]);
  const maxBeat = Math.max(...enriched.map((n) => n.startBeat + n.durationBeats));
  const chords: ChordMarker[] = [];
  for (let barBeat = 0; barBeat < maxBeat; barBeat += beatsPerBar) {
    const barNotes = enriched.filter(
      (n) => n.startBeat >= barBeat - 0.1 && n.startBeat < barBeat + beatsPerBar * 0.5 && n.hand === "left",
    );
    const pool = barNotes.length >= 2 ? barNotes : enriched.filter((n) => Math.abs(n.startBeat - barBeat) < 0.35);
    const chord = detectChord(pool.map((n) => n.midi));
    if (chord) {
      chords.push({ startBeat: barBeat, symbol: chord });
    }
  }

  const minMidi = Math.min(...enriched.map((n) => n.midi));
  const maxMidi = Math.max(...enriched.map((n) => n.midi));
  const recommendedModel = minMidi < 36 || maxMidi > 96 ? "kbp1100" : "psr1100";
  const density = enriched.length / Math.max(1, maxBeat / 4);
  const difficulty = density > 10 ? 4 : density > 6 ? 3 : density > 3 ? 2 : 1;

  return {
    id: `midi-${Date.now()}`,
    title: parsedTitle || "Imported MIDI Song",
    composer: trackNames[0] || "SMF MIDI Import",
    category: "imported",
    difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
    bpm: initialBpm,
    timeSignature,
    keySignature: keySig,
    recommendedModel,
    recommendedVoice: "grand-piano",
    sourceFormat: "midi",
    splitMidi: 57,
    descriptionZh: `从标准 MIDI 导入 · ${enriched.length} 个音符 · 自动识别调号 ${keySig} · 支持双手分轨与自动指法`,
    descriptionEn: `Imported from SMF MIDI · ${enriched.length} notes · Key ${keySig} · Auto-split RH/LH & fingering`,
    notes: enriched,
    chords,
    createdAt: new Date().toISOString(),
  };
}
