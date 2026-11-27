import type { Song, SongNote } from "@/types/music";

const SHARE_PREFIX = "K1100:";

interface CompactSharePayload {
  v: 1;
  t: string;
  tz?: string;
  c: string;
  b: number;
  ts: [number, number];
  k: string;
  d: Song["difficulty"];
  // Compact tuples: [midi, startBeat, durationBeats, handCode(0=R,1=L), finger?, chord?]
  n: Array<[number, number, number, 0 | 1, number?, string?]>;
}

function encodeUtf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64UrlToUtf8(b64u: string): string {
  const normalized = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Serializes a Song into a compact, zero-backend `K1100:<base64url>` share code.
 */
export function encodeSongShareCode(song: Song): string {
  const payload: CompactSharePayload = {
    v: 1,
    t: song.title.slice(0, 60),
    tz: song.titleZh?.slice(0, 60),
    c: song.composer.slice(0, 40),
    b: Math.round(song.bpm),
    ts: song.timeSignature,
    k: song.keySignature,
    d: song.difficulty,
    n: song.notes.slice(0, 480).map((note) => {
      const tuple: [number, number, number, 0 | 1, number?, string?] = [
        note.midi,
        Math.round(note.startBeat * 1000) / 1000,
        Math.round(note.durationBeats * 1000) / 1000,
        note.hand === "left" ? 1 : 0,
      ];
      if (note.finger) tuple.push(note.finger);
      if (note.chordSymbol) {
        if (!note.finger) tuple.push(0);
        tuple.push(note.chordSymbol);
      }
      return tuple;
    }),
  };
  return `${SHARE_PREFIX}${encodeUtf8ToBase64Url(JSON.stringify(payload))}`;
}

/**
 * Parses a full URL containing `?shared=K1100:...` or a raw `K1100:...` share code into a Song.
 */
export function decodeSongShareCode(input: string): Song | null {
  try {
    let raw = input.trim();
    if (!raw) return null;
    if (raw.includes("shared=")) {
      const match = raw.match(/[?&]shared=([^&#]+)/);
      if (match?.[1]) {
        raw = decodeURIComponent(match[1]);
      }
    }
    const token = raw.startsWith(SHARE_PREFIX) ? raw.slice(SHARE_PREFIX.length) : raw;
    const jsonText = decodeBase64UrlToUtf8(token);
    const parsed = JSON.parse(jsonText) as CompactSharePayload;
    if (parsed.v !== 1 || !Array.isArray(parsed.n) || parsed.n.length === 0) {
      return null;
    }

    const bpm = Math.max(40, Math.min(220, parsed.b || 96));
    const secPerBeat = 60 / bpm;
    const idHash = token.slice(0, 8).toLowerCase();
    const songId = `shared-${idHash}-${parsed.n.length}`;

    const notes: SongNote[] = parsed.n.map((tuple, idx) => {
      const startBeat = Math.max(0, Number(tuple[1]) || 0);
      const durationBeats = Math.max(0.125, Number(tuple[2]) || 0.5);
      return {
        id: `${songId}-n-${idx}`,
        midi: Math.max(21, Math.min(108, Math.round(tuple[0]))),
        startBeat,
        durationBeats,
        startSec: Math.round(startBeat * secPerBeat * 1000) / 1000,
        durationSec: Math.round(durationBeats * secPerBeat * 1000) / 1000,
        hand: tuple[3] === 1 ? "left" : "right",
        finger:
          tuple[4] && tuple[4] >= 1 && tuple[4] <= 5
            ? (tuple[4] as 1 | 2 | 3 | 4 | 5)
            : undefined,
        chordSymbol: tuple[5] || undefined,
        velocity: tuple[3] === 1 ? 74 : 92,
      };
    });

    const chords = notes
      .filter((n) => n.chordSymbol)
      .map((n) => ({ startBeat: n.startBeat, symbol: n.chordSymbol as string }));

    return {
      id: songId,
      title: parsed.t || "Shared Melody",
      titleZh: parsed.tz || parsed.t || "分享乐谱",
      composer: parsed.c || "KeyArcade Share",
      category: "imported",
      difficulty: parsed.d ?? 2,
      bpm,
      timeSignature: parsed.ts ?? [4, 4],
      keySignature: parsed.k || "C Major",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      sourceFormat: "jianpu",
      splitMidi: 54,
      descriptionZh: "通过零后端短链码导入的可交互双谱乐曲",
      descriptionEn: "Interactive shared score imported via K1100 share link",
      notes,
      chords,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function buildSongShareUrl(song: Song, origin?: string): string {
  const code = encodeSongShareCode(song);
  const base =
    origin || (typeof window !== "undefined" ? window.location.origin : "https://keyarcade.app");
  return `${base}/arcade?shared=${encodeURIComponent(code)}`;
}
