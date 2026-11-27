import type { Song } from "@/types/music";

/**
 * Shifts all notes & chord markers so the earliest note begins cleanly at Beat 0.
 */
export function trimLeadingSilence(song: Song): Song {
  if (song.notes.length === 0) return song;
  const minBeat = Math.min(...song.notes.map((n) => n.startBeat));
  const minSec = Math.min(...song.notes.map((n) => n.startSec));
  if (minBeat <= 0.05 && minSec <= 0.05) return song;

  return {
    ...song,
    notes: song.notes.map((n) => ({
      ...n,
      startBeat: Math.max(0, Math.round((n.startBeat - minBeat) * 1000) / 1000),
      startSec: Math.max(0, Math.round((n.startSec - minSec) * 1000) / 1000),
    })),
    chords: song.chords.map((c) => ({
      ...c,
      startBeat: Math.max(0, Math.round((c.startBeat - minBeat) * 1000) / 1000),
    })),
  };
}

/**
 * Transposes every note in the song by `semitones` while staying within 88-key MIDI bounds [21..108].
 */
export function transposeSong(song: Song, semitones: number): Song {
  if (semitones === 0) return song;
  return {
    ...song,
    notes: song.notes.map((n) => ({
      ...n,
      midi: Math.max(21, Math.min(108, n.midi + semitones)),
    })),
  };
}

/**
 * Removes the chronologically last note (useful to drop an accidental trailing tap after improv recording).
 */
export function popLastSongNote(song: Song): Song {
  if (song.notes.length <= 1) return song;
  const sorted = [...song.notes].sort((a, b) => a.startSec - b.startSec || a.midi - b.midi);
  sorted.pop();
  return {
    ...song,
    notes: sorted,
  };
}

/**
 * Ensures edits to a built-in song clone cleanly into a custom editable copy instead of mutating read-only data.
 */
export function toEditableCustomCopy(song: Song): Song {
  if (song.sourceFormat !== "builtin") return song;
  return {
    ...song,
    id: `edit-${song.id}-${Date.now().toString(36)}`,
    title: `${song.title} (Edited)`,
    titleZh: `${song.titleZh ?? song.title} (改编版)`,
    category: "imported",
    sourceFormat: "jianpu",
    createdAt: new Date().toISOString(),
  };
}
