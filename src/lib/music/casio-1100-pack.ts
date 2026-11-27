import type { ChordMarker, HandSide, Song, SongNote, SynthVoiceId, YamahaModelId } from "@/types/music";
import { assignFingersAndHands, chordToMidiNotes, nameToMidi } from "./theory";
import { CASIO_1100_BATCH2 } from "./casio-1100-batch2";

interface RawEvent {
  note: string;
  beat: number;
  dur: number;
  hand: HandSide;
  vel?: number;
  finger?: 1 | 2 | 3 | 4 | 5;
}

function buildCasioSong(
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
    descriptionZh: string;
    descriptionEn: string;
  },
  melody: [string, number, number][],
  lhChords: { beat: number; sym: string; pattern?: "block" | "arp4" | "waltz" }[],
  octave = 3,
): Song {
  const secPerBeat = 60 / meta.bpm;
  const events: RawEvent[] = melody.map(([note, beat, dur]) => ({
    note,
    beat,
    dur,
    hand: "right",
  }));

  const pcs = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  for (const ch of lhChords) {
    const midis = chordToMidiNotes(ch.sym, octave);
    if (midis.length < 3) continue;
    const names = midis.map((m) => `${pcs[m % 12]}${Math.floor(m / 12) - 1}`);
    const pat = ch.pattern ?? "arp4";

    if (pat === "block") {
      for (const n of names) {
        events.push({ note: n, beat: ch.beat, dur: 1.8, hand: "left", vel: 68 });
      }
    } else if (pat === "waltz") {
      events.push({ note: names[0], beat: ch.beat, dur: 0.9, hand: "left", vel: 72 });
      events.push({ note: names[1], beat: ch.beat + 1, dur: 0.8, hand: "left", vel: 62 });
      events.push({ note: names[2], beat: ch.beat + 1, dur: 0.8, hand: "left", vel: 62 });
      events.push({ note: names[1], beat: ch.beat + 2, dur: 0.8, hand: "left", vel: 60 });
      events.push({ note: names[2], beat: ch.beat + 2, dur: 0.8, hand: "left", vel: 60 });
    } else {
      const seq = [names[0], names[1], names[2], names[1]];
      seq.forEach((n, i) => {
        events.push({ note: n, beat: ch.beat + i * 0.5, dur: 0.48, hand: "left", vel: 68 });
      });
    }
  }

  const rawNotes: SongNote[] = events.map((ev, idx) => {
    const midi = nameToMidi(ev.note) ?? 60;
    return {
      id: `${meta.id}-n-${idx}`,
      midi,
      startBeat: ev.beat,
      durationBeats: ev.dur,
      startSec: ev.beat * secPerBeat,
      durationSec: ev.dur * secPerBeat,
      velocity: ev.vel ?? (ev.hand === "right" ? 96 : 70),
      hand: ev.hand,
    };
  });

  const chords: ChordMarker[] = lhChords.map((c) => ({ startBeat: c.beat, symbol: c.sym }));
  return {
    ...meta,
    sourceFormat: "builtin",
    splitMidi: 57,
    notes: assignFingersAndHands(rawNotes, 57),
    chords,
    createdAt: "2026-11-27T00:00:00.000Z",
  };
}

export const CASIO_1100_SONGS: Song[] = [
  buildCasioSong(
    {
      id: "casio-000-jupiter",
      title: 'CTK-1100 #000 · Jupiter ("The Planets")',
      titleZh: "CTK-1100 #000 · 朱庇特 (行星组曲)",
      composer: "Gustav Holst",
      category: "classical",
      difficulty: 2,
      bpm: 88,
      timeSignature: [3, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 第 000 号开篇主打曲目！宏伟的三拍子进行曲主题。",
      descriptionEn: "Casio CTK-1100 Song Bank #000 showcase — stately 3/4 Thaxted hymn theme.",
    },
    [
      ["E4", 0, 0.5], ["G4", 0.5, 0.5],
      ["A4", 1, 1.5], ["A4", 2.5, 0.5], ["C5", 3, 1],
      ["B4", 4, 1], ["G4", 5, 0.5], ["C5", 5.5, 0.5], ["D5", 6, 1],
      ["C5", 7, 1.5], ["B4", 8.5, 0.5], ["A4", 9, 1],
      ["B4", 10, 1], ["G4", 11, 1], ["E4", 12, 1],
      ["E4", 13, 0.5], ["G4", 13.5, 0.5],
      ["A4", 14, 1.5], ["A4", 15.5, 0.5], ["C5", 16, 1],
      ["B4", 17, 1], ["G4", 18, 0.5], ["C5", 18.5, 0.5], ["D5", 19, 1],
      ["C5", 20, 2], ["B4", 22, 1], ["A4", 23, 3],
    ],
    [
      { beat: 1, sym: "Am", pattern: "waltz" },
      { beat: 4, sym: "G", pattern: "waltz" },
      { beat: 7, sym: "F", pattern: "waltz" },
      { beat: 10, sym: "G", pattern: "waltz" },
      { beat: 14, sym: "Am", pattern: "waltz" },
      { beat: 17, sym: "G", pattern: "waltz" },
      { beat: 20, sym: "C", pattern: "waltz" },
      { beat: 23, sym: "Am", pattern: "waltz" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-003-jingle-bells",
      title: "CTK-1100 #003 · Jingle Bells",
      titleZh: "CTK-1100 #003 · 铃儿响叮当",
      composer: "James Lord Pierpont",
      category: "pop-etude",
      difficulty: 1,
      bpm: 116,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "yamaha-ep",
      descriptionZh: "卡西欧 CTK-1100 #003 经典入门欢快曲目，练熟同音连击与附点节奏。",
      descriptionEn: "Casio CTK-1100 #003 holiday classic training repeated-note articulation.",
    },
    [
      ["E4", 0, 1], ["E4", 1, 1], ["E4", 2, 2],
      ["E4", 4, 1], ["E4", 5, 1], ["E4", 6, 2],
      ["E4", 8, 1], ["G4", 9, 1], ["C4", 10, 1.5], ["D4", 11.5, 0.5],
      ["E4", 12, 4],
      ["F4", 16, 1], ["F4", 17, 1], ["F4", 18, 1.5], ["F4", 19.5, 0.5],
      ["F4", 20, 1], ["E4", 21, 1], ["E4", 22, 1], ["E4", 23, 0.5], ["E4", 23.5, 0.5],
      ["G4", 24, 1], ["G4", 25, 1], ["F4", 26, 1], ["D4", 27, 1],
      ["C4", 28, 4],
    ],
    [
      { beat: 0, sym: "C", pattern: "block" },
      { beat: 4, sym: "C", pattern: "block" },
      { beat: 8, sym: "C", pattern: "block" },
      { beat: 12, sym: "C", pattern: "block" },
      { beat: 16, sym: "F", pattern: "block" },
      { beat: 20, sym: "C", pattern: "block" },
      { beat: 24, sym: "G7", pattern: "block" },
      { beat: 28, sym: "C", pattern: "block" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-004-silent-night",
      title: "CTK-1100 #004 · Silent Night",
      titleZh: "CTK-1100 #004 · 平安夜",
      composer: "Franz Xaver Gruber",
      category: "classical",
      difficulty: 1,
      bpm: 80,
      timeSignature: [3, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #004 三拍子华尔兹伴奏入门代表曲。",
      descriptionEn: "Casio CTK-1100 #004 gentle 3/4 ballad with dotted rhythm & waltz bass.",
    },
    [
      ["G4", 0, 1.5], ["A4", 1.5, 0.5], ["G4", 2, 1], ["E4", 3, 3],
      ["G4", 6, 1.5], ["A4", 7.5, 0.5], ["G4", 8, 1], ["E4", 9, 3],
      ["D5", 12, 2], ["D5", 14, 1], ["B4", 15, 3],
      ["C5", 18, 2], ["C5", 20, 1], ["G4", 21, 3],
      ["A4", 24, 2], ["A4", 26, 1], ["C5", 27, 1.5], ["B4", 28.5, 0.5], ["A4", 29, 1],
      ["G4", 30, 1.5], ["A4", 31.5, 0.5], ["G4", 32, 1], ["E4", 33, 3],
    ],
    [
      { beat: 0, sym: "C", pattern: "waltz" },
      { beat: 3, sym: "C", pattern: "waltz" },
      { beat: 6, sym: "C", pattern: "waltz" },
      { beat: 9, sym: "C", pattern: "waltz" },
      { beat: 12, sym: "G7", pattern: "waltz" },
      { beat: 15, sym: "G7", pattern: "waltz" },
      { beat: 18, sym: "C", pattern: "waltz" },
      { beat: 21, sym: "C", pattern: "waltz" },
      { beat: 24, sym: "F", pattern: "waltz" },
      { beat: 27, sym: "F", pattern: "waltz" },
      { beat: 30, sym: "C", pattern: "waltz" },
      { beat: 33, sym: "C", pattern: "waltz" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-008-greensleeves",
      title: "CTK-1100 #008 · Greensleeves",
      titleZh: "CTK-1100 #008 · 绿袖子",
      composer: "Traditional English",
      category: "classical",
      difficulty: 2,
      bpm: 86,
      timeSignature: [3, 4],
      keySignature: "Am",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #008，融合和声小调黑键 G#4 与优雅三拍子。",
      descriptionEn: "Casio CTK-1100 #008 English folk standard introducing harmonic minor G#4.",
    },
    [
      ["A4", 0, 1],
      ["C5", 1, 2], ["D5", 3, 1],
      ["E5", 4, 1.5], ["F5", 5.5, 0.5], ["E5", 6, 1],
      ["D5", 7, 2], ["B4", 9, 1],
      ["G4", 10, 1.5], ["A4", 11.5, 0.5], ["B4", 12, 1],
      ["C5", 13, 2], ["A4", 15, 1],
      ["A4", 16, 1.5], ["G#4", 17.5, 0.5], ["A4", 18, 1],
      ["B4", 19, 2], ["G#4", 21, 1],
      ["E4", 22, 3],
    ],
    [
      { beat: 1, sym: "Am", pattern: "waltz" },
      { beat: 4, sym: "C", pattern: "waltz" },
      { beat: 7, sym: "G", pattern: "waltz" },
      { beat: 10, sym: "G", pattern: "waltz" },
      { beat: 13, sym: "Am", pattern: "waltz" },
      { beat: 16, sym: "Am", pattern: "waltz" },
      { beat: 19, sym: "E7", pattern: "waltz" },
      { beat: 22, sym: "Am", pattern: "waltz" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-009-amazing-grace",
      title: "CTK-1100 #009 · Amazing Grace",
      titleZh: "CTK-1100 #009 · 奇异恩典",
      composer: "Traditional Hymn",
      category: "pop-etude",
      difficulty: 1,
      bpm: 78,
      timeSignature: [3, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #009，练习五声音阶连奏与弱起小节气息感。",
      descriptionEn: "Casio CTK-1100 #009 expressive 3/4 pentatonic melody with pickup phrasing.",
    },
    [
      ["G3", 0, 1],
      ["C4", 1, 2], ["E4", 3, 0.5], ["C4", 3.5, 0.5],
      ["E4", 4, 2], ["D4", 6, 1],
      ["C4", 7, 2], ["A3", 9, 1],
      ["G3", 10, 2], ["G3", 12, 1],
      ["C4", 13, 2], ["E4", 15, 0.5], ["C4", 15.5, 0.5],
      ["E4", 16, 2], ["D4", 18, 1],
      ["G4", 19, 3],
    ],
    [
      { beat: 1, sym: "C", pattern: "waltz" },
      { beat: 4, sym: "C", pattern: "waltz" },
      { beat: 7, sym: "F", pattern: "waltz" },
      { beat: 10, sym: "C", pattern: "waltz" },
      { beat: 13, sym: "C", pattern: "waltz" },
      { beat: 16, sym: "G7", pattern: "waltz" },
      { beat: 19, sym: "C", pattern: "waltz" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-015-london-bridge",
      title: "CTK-1100 #015 · London Bridge",
      titleZh: "CTK-1100 #015 · 伦敦桥",
      composer: "Traditional Nursery",
      category: "pop-etude",
      difficulty: 1,
      bpm: 112,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "8bit-arcade",
      descriptionZh: "卡西欧 CTK-1100 #015，最适合儿童及零基础新手测试五指跨度。",
      descriptionEn: "Casio CTK-1100 #015 brisk beginner tune great for arcade sight-reading.",
    },
    [
      ["G4", 0, 1.5], ["A4", 1.5, 0.5], ["G4", 2, 1], ["F4", 3, 1],
      ["E4", 4, 1], ["F4", 5, 1], ["G4", 6, 2],
      ["D4", 8, 1], ["E4", 9, 1], ["F4", 10, 2],
      ["E4", 12, 1], ["F4", 13, 1], ["G4", 14, 2],
      ["G4", 16, 1.5], ["A4", 17.5, 0.5], ["G4", 18, 1], ["F4", 19, 1],
      ["E4", 20, 1], ["F4", 21, 1], ["G4", 22, 2],
      ["D4", 24, 2], ["G4", 26, 2],
      ["E4", 28, 1], ["C4", 29, 3],
    ],
    [
      { beat: 0, sym: "C", pattern: "block" },
      { beat: 4, sym: "C", pattern: "block" },
      { beat: 8, sym: "G7", pattern: "block" },
      { beat: 12, sym: "C", pattern: "block" },
      { beat: 16, sym: "C", pattern: "block" },
      { beat: 20, sym: "C", pattern: "block" },
      { beat: 24, sym: "G7", pattern: "block" },
      { beat: 28, sym: "C", pattern: "block" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-047-oh-susanna",
      title: "CTK-1100 #047 · Oh! Susanna",
      titleZh: "CTK-1100 #047 · 哦！苏珊娜",
      composer: "Stephen Foster",
      category: "pop-etude",
      difficulty: 2,
      bpm: 112,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "yamaha-ep",
      descriptionZh: "卡西欧 CTK-1100 #047 乡村切分旋律，考验双手协调与节奏稳定性。",
      descriptionEn: "Casio CTK-1100 #047 upbeat Stephen Foster melody with syncopated eighth notes.",
    },
    [
      ["C4", 0, 0.5], ["D4", 0.5, 0.5],
      ["E4", 1, 1], ["G4", 2, 1], ["G4", 3, 1.5], ["A4", 4.5, 0.5],
      ["G4", 5, 1], ["E4", 6, 1], ["C4", 7, 1.5], ["D4", 8.5, 0.5],
      ["E4", 9, 1], ["E4", 10, 1], ["D4", 11, 1], ["C4", 12, 1],
      ["D4", 13, 3],
      ["C4", 16, 0.5], ["D4", 16.5, 0.5],
      ["E4", 17, 1], ["G4", 18, 1], ["G4", 19, 1.5], ["A4", 20.5, 0.5],
      ["G4", 21, 1], ["E4", 22, 1], ["C4", 23, 1.5], ["D4", 24.5, 0.5],
      ["E4", 25, 1], ["E4", 26, 1], ["D4", 27, 1], ["D4", 28, 1],
      ["C4", 29, 3],
    ],
    [
      { beat: 1, sym: "C", pattern: "arp4" },
      { beat: 5, sym: "C", pattern: "arp4" },
      { beat: 9, sym: "C", pattern: "arp4" },
      { beat: 13, sym: "G7", pattern: "arp4" },
      { beat: 17, sym: "C", pattern: "arp4" },
      { beat: 21, sym: "C", pattern: "arp4" },
      { beat: 25, sym: "G7", pattern: "arp4" },
      { beat: 29, sym: "C", pattern: "block" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-062-sakura",
      title: "CTK-1100 #062 · Sakura Sakura",
      titleZh: "CTK-1100 #062 · 樱花",
      composer: "Traditional Japanese",
      category: "chinese-folk",
      difficulty: 2,
      bpm: 84,
      timeSignature: [4, 4],
      keySignature: "Am",
      recommendedModel: "kbp1100",
      recommendedVoice: "guzheng",
      descriptionZh: "卡西欧 CTK-1100 #062 东亚五声调式名曲，用 KBP-1100 古筝音色演奏极具韵味。",
      descriptionEn: "Casio CTK-1100 #062 pentatonic folk classic tailored for KBP GuZheng voice.",
    },
    [
      ["A4", 0, 1], ["A4", 1, 1], ["B4", 2, 2],
      ["A4", 4, 1], ["A4", 5, 1], ["B4", 6, 2],
      ["A4", 8, 1], ["B4", 9, 1], ["C5", 10, 1], ["B4", 11, 1],
      ["A4", 12, 1], ["B4", 13, 0.5], ["A4", 13.5, 0.5], ["F4", 14, 2],
      ["E4", 16, 1], ["C4", 17, 1], ["E4", 18, 1], ["F4", 19, 1],
      ["E4", 20, 1], ["E4", 21, 0.5], ["C4", 21.5, 0.5], ["B3", 22, 2],
      ["E4", 24, 1], ["F4", 25, 1], ["B4", 26, 0.5], ["A4", 26.5, 0.5], ["F4", 27, 1],
      ["E4", 28, 4],
    ],
    [
      { beat: 0, sym: "Am", pattern: "block" },
      { beat: 4, sym: "Am", pattern: "block" },
      { beat: 8, sym: "Am", pattern: "arp4" },
      { beat: 12, sym: "F", pattern: "block" },
      { beat: 16, sym: "Am", pattern: "arp4" },
      { beat: 20, sym: "E", pattern: "block" },
      { beat: 24, sym: "Dm", pattern: "block" },
      { beat: 28, sym: "Am", pattern: "block" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-064-vivaldi-spring",
      title: 'CTK-1100 #064 / PX-S1100 · Spring ("Four Seasons")',
      titleZh: "CTK-1100 #064 · 四季·春 (维瓦尔第)",
      composer: "Antonio Vivaldi",
      category: "classical",
      difficulty: 2,
      bpm: 108,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "同时收录于 CTK-1100 (#064) 与 PX-S1100 音乐会曲目！轻快跳跃的巴洛克主题。",
      descriptionEn: "Featured in both CTK-1100 #064 and PX-S1100 Concert Play — bright Baroque motif.",
    },
    [
      ["C4", 0, 1],
      ["E4", 1, 1], ["E4", 2, 1], ["E4", 3, 1], ["D4", 4, 0.5], ["C4", 4.5, 0.5],
      ["G4", 5, 3], ["G4", 8, 0.5], ["F4", 8.5, 0.5],
      ["E4", 9, 1], ["E4", 10, 1], ["E4", 11, 1], ["D4", 12, 0.5], ["C4", 12.5, 0.5],
      ["G4", 13, 3], ["G4", 16, 0.5], ["F4", 16.5, 0.5],
      ["E4", 17, 1], ["F4", 18, 0.5], ["G4", 18.5, 0.5], ["F4", 19, 1], ["E4", 20, 1],
      ["D4", 21, 3],
    ],
    [
      { beat: 1, sym: "C", pattern: "arp4" },
      { beat: 5, sym: "C", pattern: "arp4" },
      { beat: 9, sym: "C", pattern: "arp4" },
      { beat: 13, sym: "C", pattern: "arp4" },
      { beat: 17, sym: "F", pattern: "arp4" },
      { beat: 21, sym: "G7", pattern: "block" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-067-nachtmusik",
      title: "CTK-1100 #067 · Eine kleine Nachtmusik",
      titleZh: "CTK-1100 #067 · 莫扎特弦乐小夜曲",
      composer: "W. A. Mozart",
      category: "classical",
      difficulty: 3,
      bpm: 120,
      timeSignature: [4, 4],
      keySignature: "G",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #067，分解和弦琶音跳进训练，包含 F#4 黑键。",
      descriptionEn: "Casio CTK-1100 #067 Mozart Serenade developing crisp arpeggio leaps.",
    },
    [
      ["G4", 0, 1.5], ["D4", 1.5, 0.5], ["G4", 2, 1.5], ["D4", 3.5, 0.5],
      ["G4", 4, 0.5], ["D4", 4.5, 0.5], ["G4", 5, 0.5], ["B4", 5.5, 0.5], ["D5", 6, 2],
      ["C5", 8, 1.5], ["A4", 9.5, 0.5], ["C5", 10, 1.5], ["A4", 11.5, 0.5],
      ["C5", 12, 0.5], ["A4", 12.5, 0.5], ["F#4", 13, 0.5], ["A4", 13.5, 0.5], ["D4", 14, 2],
    ],
    [
      { beat: 0, sym: "G", pattern: "block" },
      { beat: 4, sym: "G", pattern: "arp4" },
      { beat: 8, sym: "D7", pattern: "block" },
      { beat: 12, sym: "D7", pattern: "arp4" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-081-minuet-in-g",
      title: "CTK-1100 #081 / PX-S1100 · Minuet in G",
      titleZh: "CTK-1100 #081 · G大调小步舞曲 (巴赫)",
      composer: "Christian Petzold / J.S. Bach",
      category: "classical",
      difficulty: 2,
      bpm: 108,
      timeSignature: [3, 4],
      keySignature: "G",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "电钢琴考级与音乐库必选名曲，训练双手复调独立性与八分音符流畅度。",
      descriptionEn: "Casio CTK-1100 #081 / PX-S1100 classical staple building Baroque finger independence.",
    },
    [
      ["D5", 0, 1], ["G4", 1, 0.5], ["A4", 1.5, 0.5], ["B4", 2, 0.5], ["C5", 2.5, 0.5],
      ["D5", 3, 1], ["G4", 4, 1], ["G4", 5, 1],
      ["E5", 6, 1], ["C5", 7, 0.5], ["D5", 7.5, 0.5], ["E5", 8, 0.5], ["F#5", 8.5, 0.5],
      ["G5", 9, 1], ["G4", 10, 1], ["G4", 11, 1],
      ["C5", 12, 1], ["D5", 13, 0.5], ["C5", 13.5, 0.5], ["B4", 14, 0.5], ["A4", 14.5, 0.5],
      ["B4", 15, 1], ["C5", 16, 0.5], ["B4", 16.5, 0.5], ["A4", 17, 0.5], ["G4", 17.5, 0.5],
      ["F#4", 18, 1], ["G4", 19, 0.5], ["A4", 19.5, 0.5], ["B4", 20, 0.5], ["G4", 20.5, 0.5],
      ["A4", 21, 3],
    ],
    [
      { beat: 0, sym: "G", pattern: "waltz" },
      { beat: 3, sym: "G", pattern: "waltz" },
      { beat: 6, sym: "C", pattern: "waltz" },
      { beat: 9, sym: "G", pattern: "waltz" },
      { beat: 12, sym: "C", pattern: "waltz" },
      { beat: 15, sym: "G", pattern: "waltz" },
      { beat: 18, sym: "D7", pattern: "waltz" },
      { beat: 21, sym: "D", pattern: "waltz" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-089-going-home",
      title: 'CTK-1100 #089 · Going Home ("New World")',
      titleZh: "CTK-1100 #089 · 念故乡 (自新大陆交响曲)",
      composer: "Antonín Dvořák",
      category: "classical",
      difficulty: 1,
      bpm: 74,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #089/090 经典抒情曲目，大附点与连音旋律极易上手。",
      descriptionEn: "Casio CTK-1100 #089/090 Largo theme from Dvořák's New World Symphony.",
    },
    [
      ["E4", 0, 1.5], ["G4", 1.5, 0.5], ["G4", 2, 2],
      ["E4", 4, 1.5], ["D4", 5.5, 0.5], ["C4", 6, 2],
      ["D4", 8, 1], ["E4", 9, 1], ["G4", 10, 1], ["E4", 11, 1],
      ["D4", 12, 4],
      ["E4", 16, 1.5], ["G4", 17.5, 0.5], ["G4", 18, 2],
      ["E4", 20, 1.5], ["D4", 21.5, 0.5], ["C4", 22, 2],
      ["D4", 24, 1], ["E4", 25, 1], ["D4", 26, 1.5], ["C4", 27.5, 0.5],
      ["C4", 28, 4],
    ],
    [
      { beat: 0, sym: "C", pattern: "arp4" },
      { beat: 4, sym: "C", pattern: "arp4" },
      { beat: 8, sym: "F", pattern: "arp4" },
      { beat: 12, sym: "G7", pattern: "block" },
      { beat: 16, sym: "C", pattern: "arp4" },
      { beat: 20, sym: "Am", pattern: "arp4" },
      { beat: 24, sym: "G7", pattern: "arp4" },
      { beat: 28, sym: "C", pattern: "block" },
    ],
  ),

  buildCasioSong(
    {
      id: "pxs1100-turkish-march",
      title: "PX-S1100 Library · Turkish March",
      titleZh: "PX-S1100 音乐库 · 土耳其进行曲 (主题)",
      composer: "W. A. Mozart",
      category: "classical",
      difficulty: 4,
      bpm: 112,
      timeSignature: [4, 4],
      keySignature: "Am",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 PX-S1100 60首音乐库经典高阶曲目，考验十六分音符跑动与黑键快速交替。",
      descriptionEn: "Casio PX-S1100 Music Library showpiece practicing crisp chromatic turns.",
    },
    [
      ["B4", 0, 0.5], ["A4", 0.5, 0.5], ["G#4", 1, 0.5], ["A4", 1.5, 0.5], ["C5", 2, 2],
      ["D5", 4, 0.5], ["C5", 4.5, 0.5], ["B4", 5, 0.5], ["C5", 5.5, 0.5], ["E5", 6, 2],
      ["F5", 8, 0.5], ["E5", 8.5, 0.5], ["D#5", 9, 0.5], ["E5", 9.5, 0.5],
      ["B5", 10, 0.5], ["A5", 10.5, 0.5], ["G#5", 11, 0.5], ["A5", 11.5, 0.5],
      ["B5", 12, 0.5], ["A5", 12.5, 0.5], ["G#5", 13, 0.5], ["A5", 13.5, 0.5],
      ["C6", 14, 2],
      ["A5", 16, 1], ["C6", 17, 1], ["G5", 18, 0.5], ["A5", 18.5, 0.5], ["B5", 19, 1],
      ["A5", 20, 1], ["G5", 21, 1], ["A5", 22, 2],
    ],
    [
      { beat: 0, sym: "Am", pattern: "arp4" },
      { beat: 4, sym: "Am", pattern: "arp4" },
      { beat: 8, sym: "E7", pattern: "arp4" },
      { beat: 12, sym: "Am", pattern: "block" },
      { beat: 16, sym: "F", pattern: "arp4" },
      { beat: 20, sym: "E7", pattern: "block" },
    ],
  ),

  buildCasioSong(
    {
      id: "casio-079-swan-lake",
      title: "CTK-1100 #079 · Scene from Swan Lake",
      titleZh: "CTK-1100 #079 · 天鹅湖选段",
      composer: "P. I. Tchaikovsky",
      category: "classical",
      difficulty: 2,
      bpm: 84,
      timeSignature: [4, 4],
      keySignature: "Am",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #079 经典芭蕾舞剧主题，旋律跨度优美、适合练双手呼吸感。",
      descriptionEn: "Casio CTK-1100 #079 dramatic Swan Lake theme with lyrical minor arpeggios.",
    },
    [
      ["E5", 0, 2], ["A4", 2, 0.5], ["B4", 2.5, 0.5], ["C5", 3, 0.5], ["D5", 3.5, 0.5],
      ["E5", 4, 1.5], ["C5", 5.5, 0.5], ["E5", 6, 2],
      ["E5", 8, 1.5], ["C5", 9.5, 0.5], ["E5", 10, 2],
      ["A4", 12, 0.5], ["C5", 12.5, 0.5], ["B4", 13, 0.5], ["G4", 13.5, 0.5], ["A4", 14, 2],
    ],
    [
      { beat: 0, sym: "Am", pattern: "arp4" },
      { beat: 4, sym: "Am", pattern: "arp4" },
      { beat: 8, sym: "F", pattern: "arp4" },
      { beat: 12, sym: "E7", pattern: "block" },
    ],
  ),
  ...CASIO_1100_BATCH2,
];
