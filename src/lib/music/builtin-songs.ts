import type { ChordMarker, HandSide, Song, SongNote, SynthVoiceId, YamahaModelId } from "@/types/music";
import { assignFingersAndHands, chordToMidiNotes, nameToMidi } from "./theory";
import { CASIO_1100_SONGS } from "./casio-1100-pack";

interface RawEvent {
  note: string;
  beat: number;
  dur: number;
  hand: HandSide;
  vel?: number;
  finger?: 1 | 2 | 3 | 4 | 5;
}

function buildSongFromEvents(
  meta: {
    id: string;
    title: string;
    titleZh: string;
    composer: string;
    category: Song["category"];
    difficulty: Song["difficulty"];
    bpm: number;
    timeSignature: [number, number];
    keySignature: string;
    recommendedModel: YamahaModelId;
    recommendedVoice: SynthVoiceId;
    splitMidi?: number;
    descriptionZh: string;
    descriptionEn: string;
  },
  events: RawEvent[],
  chords: ChordMarker[],
): Song {
  const secPerBeat = 60 / meta.bpm;
  const rawNotes: SongNote[] = events.map((ev, idx) => {
    const midi = nameToMidi(ev.note) ?? 60;
    return {
      id: `${meta.id}-n-${idx}`,
      midi,
      startBeat: ev.beat,
      durationBeats: ev.dur,
      startSec: ev.beat * secPerBeat,
      durationSec: ev.dur * secPerBeat,
      velocity: ev.vel ?? (ev.hand === "right" ? 96 : 72),
      hand: ev.hand,
      finger: ev.finger,
    };
  });

  const notes = assignFingersAndHands(rawNotes, meta.splitMidi ?? 57);
  return {
    ...meta,
    sourceFormat: "builtin",
    splitMidi: meta.splitMidi ?? 57,
    notes,
    chords,
    createdAt: "2026-11-27T00:00:00.000Z",
  };
}

function addAccompanimentBlock(
  events: RawEvent[],
  startBeat: number,
  chordSymbol: string,
  pattern: "block" | "alberti" | "waltz" | "arp4",
  octave = 3,
) {
  const midis = chordToMidiNotes(chordSymbol, octave);
  if (midis.length < 3) return;
  const names = midis.map((m) => {
    const pcs = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return `${pcs[m % 12]}${Math.floor(m / 12) - 1}`;
  });

  if (pattern === "block") {
    for (const n of names) {
      events.push({ note: n, beat: startBeat, dur: 1.8, hand: "left", vel: 68 });
    }
  } else if (pattern === "alberti") {
    const seq = [names[0], names[2], names[1], names[2]];
    seq.forEach((n, i) => {
      events.push({ note: n, beat: startBeat + i * 0.5, dur: 0.45, hand: "left", vel: 68 });
    });
  } else if (pattern === "arp4") {
    const seq = [names[0], names[1], names[2], names[1]];
    seq.forEach((n, i) => {
      events.push({ note: n, beat: startBeat + i, dur: 0.9, hand: "left", vel: 70 });
    });
  } else if (pattern === "waltz") {
    events.push({ note: names[0], beat: startBeat, dur: 0.9, hand: "left", vel: 74 });
    events.push({ note: names[1], beat: startBeat + 1, dur: 0.7, hand: "left", vel: 64 });
    events.push({ note: names[2], beat: startBeat + 1, dur: 0.7, hand: "left", vel: 64 });
    events.push({ note: names[1], beat: startBeat + 2, dur: 0.7, hand: "left", vel: 62 });
    events.push({ note: names[2], beat: startBeat + 2, dur: 0.7, hand: "left", vel: 62 });
  }
}

function makeTwinkle(): Song {
  const melody: [string, number, number][] = [
    // Bar 1-2: C C G G | A A G -
    ["C4", 0, 1], ["C4", 1, 1], ["G4", 2, 1], ["G4", 3, 1],
    ["A4", 4, 1], ["A4", 5, 1], ["G4", 6, 2],
    // Bar 3-4: F F E E | D D C -
    ["F4", 8, 1], ["F4", 9, 1], ["E4", 10, 1], ["E4", 11, 1],
    ["D4", 12, 1], ["D4", 13, 1], ["C4", 14, 2],
    // Bar 5-6: G G F F | E E D -
    ["G4", 16, 1], ["G4", 17, 1], ["F4", 18, 1], ["F4", 19, 1],
    ["E4", 20, 1], ["E4", 21, 1], ["D4", 22, 2],
    // Bar 7-8: C C G G | A A G -
    ["C4", 24, 1], ["C4", 25, 1], ["G4", 26, 1], ["G4", 27, 1],
    ["A4", 28, 1], ["A4", 29, 1], ["G4", 30, 2],
    // Bar 9-10: F F E E | D D C -
    ["F4", 32, 1], ["F4", 33, 1], ["E4", 34, 1], ["E4", 35, 1],
    ["D4", 36, 1], ["D4", 37, 1], ["C4", 38, 2],
  ];
  const events: RawEvent[] = melody.map(([note, beat, dur]) => ({ note, beat, dur, hand: "right" }));

  const lhChords: [number, string][] = [
    [0, "C"], [2, "C"], [4, "F"], [6, "C"],
    [8, "F"], [10, "C"], [12, "G7"], [14, "C"],
    [16, "C"], [18, "F"], [20, "C"], [22, "G"],
    [24, "C"], [26, "C"], [28, "F"], [30, "C"],
    [32, "F"], [34, "C"], [36, "G7"], [38, "C"],
  ];
  for (const [b, sym] of lhChords) {
    addAccompanimentBlock(events, b, sym, "block", 3);
  }
  const chords: ChordMarker[] = [
    { startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "F" }, { startBeat: 6, symbol: "C" },
    { startBeat: 8, symbol: "F" }, { startBeat: 10, symbol: "C" }, { startBeat: 12, symbol: "G7" },
    { startBeat: 14, symbol: "C" }, { startBeat: 16, symbol: "C" }, { startBeat: 18, symbol: "F" },
    { startBeat: 20, symbol: "C" }, { startBeat: 22, symbol: "G" }, { startBeat: 24, symbol: "C" },
    { startBeat: 28, symbol: "F" }, { startBeat: 30, symbol: "C" }, { startBeat: 32, symbol: "F" },
    { startBeat: 34, symbol: "C" }, { startBeat: 36, symbol: "G7" }, { startBeat: 38, symbol: "C" },
  ];

  return buildSongFromEvents(
    {
      id: "twinkle-star",
      title: "Twinkle Twinkle Little Star",
      titleZh: "小星星 · 双手启蒙第一课",
      composer: "Traditional / Mozart Theme",
      category: "classical",
      difficulty: 1,
      bpm: 92,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "最适合电子琴入门的双手指法与左手柱式和弦配合曲目，熟悉 C / F / G7 基础伴奏。",
      descriptionEn: "Ideal starter piece pairing single-position right-hand melody with C / F / G7 left-hand chords.",
    },
    events,
    chords,
  );
}

function makeOdeToJoy(): Song {
  const melody: [string, number, number][] = [
    ["E4", 0, 1], ["E4", 1, 1], ["F4", 2, 1], ["G4", 3, 1],
    ["G4", 4, 1], ["F4", 5, 1], ["E4", 6, 1], ["D4", 7, 1],
    ["C4", 8, 1], ["C4", 9, 1], ["D4", 10, 1], ["E4", 11, 1],
    ["E4", 12, 1.5], ["D4", 13.5, 0.5], ["D4", 14, 2],

    ["E4", 16, 1], ["E4", 17, 1], ["F4", 18, 1], ["G4", 19, 1],
    ["G4", 20, 1], ["F4", 21, 1], ["E4", 22, 1], ["D4", 23, 1],
    ["C4", 24, 1], ["C4", 25, 1], ["D4", 26, 1], ["E4", 27, 1],
    ["D4", 28, 1.5], ["C4", 29.5, 0.5], ["C4", 30, 2],
  ];
  const events: RawEvent[] = melody.map(([note, beat, dur]) => ({ note, beat, dur, hand: "right" }));

  const lh: [number, string][] = [
    [0, "C"], [4, "G"], [8, "C"], [12, "G"],
    [16, "C"], [20, "G"], [24, "C"], [28, "G7"],
  ];
  for (const [b, sym] of lh) {
    addAccompanimentBlock(events, b, sym, "arp4", 3);
  }
  const chords: ChordMarker[] = lh.map(([startBeat, symbol]) => ({ startBeat, symbol }));

  return buildSongFromEvents(
    {
      id: "ode-to-joy",
      title: "Ode to Joy (Symphony No. 9)",
      titleZh: "欢乐颂 · 贝多芬五指固定位置训练",
      composer: "Ludwig van Beethoven",
      category: "classical",
      difficulty: 1,
      bpm: 100,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "训练右手五指(C-D-E-F-G)顺指法与附点节奏，左手搭配四拍分解和弦。",
      descriptionEn: "Trains five-finger position (C-G), dotted quarter rhythm, and four-beat arpeggiated left hand.",
    },
    events,
    chords,
  );
}

function makeMoLiHua(): Song {
  const melody: [string, number, number][] = [
    // 好一朵美丽的茉莉花 (C Major Pentatonic: C D E G A)
    ["E4", 0, 1], ["E4", 1, 0.5], ["G4", 1.5, 0.5], ["A4", 2, 0.5], ["C5", 2.5, 0.5], ["C5", 3, 0.5], ["A4", 3.5, 0.5],
    ["G4", 4, 1.5], ["G4", 5.5, 0.5], ["A4", 6, 1], ["G4", 7, 1],

    ["E4", 8, 1], ["E4", 9, 0.5], ["G4", 9.5, 0.5], ["A4", 10, 0.5], ["C5", 10.5, 0.5], ["C5", 11, 0.5], ["A4", 11.5, 0.5],
    ["G4", 12, 1.5], ["G4", 13.5, 0.5], ["A4", 14, 1], ["G4", 15, 1],

    ["G4", 16, 1], ["G4", 17, 1], ["G4", 18, 1], ["E4", 19, 0.5], ["G4", 19.5, 0.5],
    ["A4", 20, 1], ["A4", 21, 1], ["G4", 22, 2],

    ["E4", 24, 1], ["D4", 25, 0.5], ["E4", 25.5, 0.5], ["G4", 26, 1.5], ["E4", 27.5, 0.5],
    ["D4", 28, 1], ["E4", 29, 0.5], ["D4", 29.5, 0.5], ["C4", 30, 2],
  ];
  const events: RawEvent[] = melody.map(([note, beat, dur]) => ({ note, beat, dur, hand: "right" }));

  const lh: [number, string][] = [
    [0, "C"], [4, "Am"], [8, "C"], [12, "G"],
    [16, "C"], [20, "F"], [24, "C"], [28, "G7"],
  ];
  for (const [b, sym] of lh) {
    addAccompanimentBlock(events, b, sym, "arp4", 3);
  }
  const chords: ChordMarker[] = lh.map(([startBeat, symbol]) => ({ startBeat, symbol }));

  return buildSongFromEvents(
    {
      id: "mo-li-hua",
      title: "Mo Li Hua (Jasmine Flower)",
      titleZh: "茉莉花 · 雅马哈 KBP-1100 国风民乐示范曲",
      composer: "Jiangsu Folk Song",
      category: "chinese-folk",
      difficulty: 2,
      bpm: 88,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "guzheng",
      descriptionZh: "专为雅马哈 KBP-1100 中国民乐音色定制！五声音阶旋律配古筝音色，练就八分音符流动性。",
      descriptionEn: "Showcases Yamaha KBP-1100 Chinese folk voice! Pentatonic phrasing with eighth-note articulation.",
    },
    events,
    chords,
  );
}

function makeCanonInD(): Song {
  const melody: [string, number, number][] = [
    ["F#5", 0, 2], ["E5", 2, 2], ["D5", 4, 2], ["C#5", 6, 2],
    ["B4", 8, 2], ["A4", 10, 2], ["B4", 12, 2], ["C#5", 14, 2],

    ["D5", 16, 1], ["F#5", 17, 1], ["A5", 18, 1], ["G5", 19, 1],
    ["F#5", 20, 1], ["D5", 21, 1], ["F#5", 22, 1], ["E5", 23, 1],
    ["D5", 24, 1], ["B4", 25, 1], ["D5", 26, 1], ["A4", 27, 1],
    ["G4", 28, 1], ["B4", 29, 1], ["A4", 30, 1], ["G4", 31, 1],
  ];
  const events: RawEvent[] = melody.map(([note, beat, dur]) => ({ note, beat, dur, hand: "right" }));

  const prog: [number, string][] = [
    [0, "D"], [2, "A"], [4, "Bm"], [6, "F#m"],
    [8, "G"], [10, "D"], [12, "G"], [14, "A"],
    [16, "D"], [18, "A"], [20, "Bm"], [22, "F#m"],
    [24, "G"], [26, "D"], [28, "G"], [30, "A"],
  ];
  for (const [b, sym] of prog) {
    addAccompanimentBlock(events, b, sym, "alberti", 3);
  }
  const chords: ChordMarker[] = prog.map(([startBeat, symbol]) => ({ startBeat, symbol }));

  return buildSongFromEvents(
    {
      id: "canon-in-d",
      title: "Canon in D (Arpeggio Edition)",
      titleZh: "卡农 (D大调经典循环和弦)",
      composer: "Johann Pachelbel",
      category: "pop-etude",
      difficulty: 3,
      bpm: 84,
      timeSignature: [4, 4],
      keySignature: "D",
      recommendedModel: "kbp1100",
      recommendedVoice: "yamaha-ep",
      descriptionZh: "掌握流行音乐万年黄金和弦走向 D - A - Bm - F#m - G - D - G - A，兼顾黑键 F# 与 C#。",
      descriptionEn: "Master the timeless D-A-Bm-F#m-G-D-G-A progression with smooth Alberti left-hand motion.",
    },
    events,
    chords,
  );
}

function makeFarewell(): Song {
  const melody: [string, number, number][] = [
    ["G4", 0, 1], ["E4", 1, 0.5], ["G4", 1.5, 0.5], ["C5", 2, 2],
    ["A4", 4, 1], ["C5", 5, 1], ["G4", 6, 2],
    ["G4", 8, 1], ["C4", 9, 0.5], ["D4", 9.5, 0.5], ["E4", 10, 1], ["D4", 11, 0.5], ["C4", 11.5, 0.5],
    ["D4", 12, 4],

    ["G4", 16, 1], ["E4", 17, 0.5], ["G4", 17.5, 0.5], ["C5", 18, 1.5], ["B4", 19.5, 0.5],
    ["A4", 20, 1], ["C5", 21, 1], ["G4", 22, 2],
    ["G4", 24, 1], ["D4", 25, 0.5], ["E4", 25.5, 0.5], ["F4", 26, 1.5], ["B3", 27.5, 0.5],
    ["C4", 28, 4],
  ];
  const events: RawEvent[] = melody.map(([note, beat, dur]) => ({ note, beat, dur, hand: "right" }));

  const lh: [number, string][] = [
    [0, "C"], [4, "F"], [8, "C"], [12, "G7"],
    [16, "C"], [20, "F"], [24, "G7"], [28, "C"],
  ];
  for (const [b, sym] of lh) {
    addAccompanimentBlock(events, b, sym, "arp4", 3);
  }
  const chords: ChordMarker[] = lh.map(([startBeat, symbol]) => ({ startBeat, symbol }));

  return buildSongFromEvents(
    {
      id: "farewell-song",
      title: "Dreaming of Home (Song Bie)",
      titleZh: "送别 (长亭外古道边)",
      composer: "J. P. Ordway / 李叔同",
      category: "pop-etude",
      difficulty: 2,
      bpm: 78,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "抒情八分音符与跨越八度练唱感训练，搭配 PSR-1100 自动伴奏和弦极易出效果。",
      descriptionEn: "Lyrical phrasing practice pairing eighth-note pickup leaps with warm C-F-G7 accompaniment.",
    },
    events,
    chords,
  );
}

function makeFurElise(): Song {
  const melody: [string, number, number][] = [
    // Pickup & bars in 3/8 (1 beat = eighth note feel at 132 BPM -> treat 1 quarter beat = 2 eighth notes or 0.5 beat each)
    ["E5", 0, 0.5], ["D#5", 0.5, 0.5],
    ["E5", 1, 0.5], ["D#5", 1.5, 0.5], ["E5", 2, 0.5], ["B4", 2.5, 0.5], ["D5", 3, 0.5], ["C5", 3.5, 0.5],
    ["A4", 4, 1], ["C4", 5, 0.5], ["E4", 5.5, 0.5], ["A4", 6, 0.5],
    ["B4", 7, 1], ["E4", 8, 0.5], ["G#4", 8.5, 0.5], ["B4", 9, 0.5],
    ["C5", 10, 1], ["E4", 11, 0.5], ["E5", 11.5, 0.5], ["D#5", 12, 0.5],

    ["E5", 12.5, 0.5], ["D#5", 13, 0.5], ["E5", 13.5, 0.5], ["B4", 14, 0.5], ["D5", 14.5, 0.5], ["C5", 15, 0.5],
    ["A4", 15.5, 1], ["C4", 16.5, 0.5], ["E4", 17, 0.5], ["A4", 17.5, 0.5],
    ["B4", 18.5, 1], ["E4", 19.5, 0.5], ["C5", 20, 0.5], ["B4", 20.5, 0.5],
    ["A4", 21.5, 2],
  ];
  const events: RawEvent[] = melody.map(([note, beat, dur]) => ({ note, beat, dur, hand: "right" }));

  // LH arpeggiated Am and E7 figures
  const lhEvents: [string, number, number][] = [
    ["A2", 4, 0.5], ["E3", 4.5, 0.5], ["A3", 5, 0.5],
    ["E2", 7, 0.5], ["E3", 7.5, 0.5], ["G#3", 8, 0.5],
    ["A2", 10, 0.5], ["E3", 10.5, 0.5], ["A3", 11, 0.5],
    ["A2", 15.5, 0.5], ["E3", 16, 0.5], ["A3", 16.5, 0.5],
    ["E2", 18.5, 0.5], ["E3", 19, 0.5], ["G#3", 19.5, 0.5],
    ["A2", 21.5, 1.5], ["E3", 21.5, 1.5], ["A3", 21.5, 1.5],
  ];
  for (const [note, beat, dur] of lhEvents) {
    events.push({ note, beat, dur, hand: "left", vel: 72 });
  }

  return buildSongFromEvents(
    {
      id: "fur-elise",
      title: "Für Elise (Theme)",
      titleZh: "致爱丽丝 · 经典半音与琶音交接",
      composer: "Ludwig van Beethoven",
      category: "classical",
      difficulty: 3,
      bpm: 72,
      timeSignature: [3, 4],
      keySignature: "Am",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "训练右手半音交替 (E-D#) 与左右手接力琶音，进阶电子琴必练经典名曲。",
      descriptionEn: "Classic Beethoven theme developing chromatic alternation (E-D#) and hand-off arpeggios.",
    },
    events,
    [
      { startBeat: 4, symbol: "Am" },
      { startBeat: 7, symbol: "E7" },
      { startBeat: 10, symbol: "Am" },
      { startBeat: 15.5, symbol: "Am" },
      { startBeat: 18.5, symbol: "E7" },
      { startBeat: 21.5, symbol: "Am" },
    ],
  );
}

function makeScaleDojo(): Song {
  const scaleUp = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
  const scaleDown = ["C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4"];
  const rhFingersUp: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 1, 2, 3, 4, 5];
  const rhFingersDown: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1, 3, 2, 1];

  const events: RawEvent[] = [];
  scaleUp.forEach((note, i) => {
    events.push({ note, beat: i, dur: 0.9, hand: "right", finger: rhFingersUp[i] });
  });
  scaleDown.forEach((note, i) => {
    events.push({ note, beat: 8 + i, dur: 0.9, hand: "right", finger: rhFingersDown[i] });
  });

  // Left hand mirrors one octave lower
  const lhUp = ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"];
  const lhDown = ["C4", "B3", "A3", "G3", "F3", "E3", "D3", "C3"];
  const lhFUp: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1, 3, 2, 1];
  const lhFDown: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 1, 2, 3, 4, 5];

  lhUp.forEach((note, i) => {
    events.push({ note, beat: i, dur: 0.9, hand: "left", finger: lhFUp[i] });
  });
  lhDown.forEach((note, i) => {
    events.push({ note, beat: 8 + i, dur: 0.9, hand: "left", finger: lhFDown[i] });
  });

  // Final C-F-G7-C cadence
  addAccompanimentBlock(events, 16, "C", "block", 3);
  addAccompanimentBlock(events, 18, "F", "block", 3);
  addAccompanimentBlock(events, 20, "G7", "block", 3);
  addAccompanimentBlock(events, 22, "C", "block", 3);
  events.push({ note: "E4", beat: 16, dur: 1.8, hand: "right", finger: 3 });
  events.push({ note: "G4", beat: 16, dur: 1.8, hand: "right", finger: 5 });
  events.push({ note: "F4", beat: 18, dur: 1.8, hand: "right", finger: 4 });
  events.push({ note: "A4", beat: 18, dur: 1.8, hand: "right", finger: 5 });
  events.push({ note: "F4", beat: 20, dur: 1.8, hand: "right", finger: 4 });
  events.push({ note: "B4", beat: 20, dur: 1.8, hand: "right", finger: 5 });
  events.push({ note: "E4", beat: 22, dur: 1.8, hand: "right", finger: 3 });
  events.push({ note: "C5", beat: 22, dur: 1.8, hand: "right", finger: 5 });

  return buildSongFromEvents(
    {
      id: "c-major-dojo",
      title: "C Major Scale & Cadence Dojo",
      titleZh: "C大调穿指音阶与终止式道场",
      composer: "Yamaha Finger Bootcamp",
      category: "drill",
      difficulty: 1,
      bpm: 96,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "严格标明穿指/跨指指法 (1-2-3-1-2-3-4-5)，打好雅马哈 1100 跑动基本功。",
      descriptionEn: "Explicit thumb-under fingering (1-2-3-1-2-3-4-5) plus a C-F-G7-C cadence drill.",
    },
    events,
    [
      { startBeat: 0, symbol: "C" },
      { startBeat: 16, symbol: "C" },
      { startBeat: 18, symbol: "F" },
      { startBeat: 20, symbol: "G7" },
      { startBeat: 22, symbol: "C" },
    ],
  );
}

export const BUILTIN_SONGS: Song[] = [
  makeTwinkle(),
  makeOdeToJoy(),
  makeMoLiHua(),
  makeFarewell(),
  makeCanonInD(),
  makeFurElise(),
  makeScaleDojo(),
  ...CASIO_1100_SONGS,
];
