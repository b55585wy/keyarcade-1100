import type { ChordMarker, HandSide, Song, SongNote, SynthVoiceId, YamahaModelId } from "@/types/music";
import { assignFingersAndHands, chordToMidiNotes, nameToMidi } from "./theory";

interface RawEvent {
  note: string;
  beat: number;
  dur: number;
  hand: HandSide;
  vel?: number;
}

function buildTrack(
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

export const CASIO_1100_BATCH2: Song[] = [
  buildTrack(
    {
      id: "casio-001-deck-the-hall",
      title: "CTK-1100 #001 · Deck the Hall",
      titleZh: "CTK-1100 #001 · 装饰厅堂",
      composer: "Traditional Welsh",
      category: "pop-etude",
      difficulty: 1,
      bpm: 112,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "yamaha-ep",
      descriptionZh: "卡西欧 CTK-1100 #001 欢快圣诞颂歌，顺畅练习下行音阶与附点四分音符。",
      descriptionEn: "Casio CTK-1100 #001 festive Welsh carol with smooth descending scales.",
    },
    [
      ["G4", 0, 1.5], ["F4", 1.5, 0.5], ["E4", 2, 1], ["D4", 3, 1],
      ["C4", 4, 1], ["D4", 5, 1], ["E4", 6, 1], ["C4", 7, 1],
      ["D4", 8, 0.5], ["E4", 8.5, 0.5], ["F4", 9, 0.5], ["D4", 9.5, 0.5], ["E4", 10, 1.5], ["D4", 11.5, 0.5],
      ["C4", 12, 1], ["B3", 13, 1], ["C4", 14, 2],
      ["G4", 16, 1.5], ["F4", 17.5, 0.5], ["E4", 18, 1], ["D4", 19, 1],
      ["C4", 20, 1], ["D4", 21, 1], ["E4", 22, 1], ["C4", 23, 1],
      ["D4", 24, 0.5], ["E4", 24.5, 0.5], ["F4", 25, 0.5], ["D4", 25.5, 0.5], ["E4", 26, 1.5], ["D4", 27.5, 0.5],
      ["C4", 28, 1], ["B3", 29, 1], ["C4", 30, 2],
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

  buildTrack(
    {
      id: "casio-002-merry-christmas",
      title: "CTK-1100 #002 · We Wish You a Merry Christmas",
      titleZh: "CTK-1100 #002 · 祝你圣诞快乐",
      composer: "Traditional English",
      category: "pop-etude",
      difficulty: 2,
      bpm: 116,
      timeSignature: [3, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "yamaha-ep",
      descriptionZh: "卡西欧 CTK-1100 #002 三拍子经典曲目，练习八分音符连贯跑动与和弦切换。",
      descriptionEn: "Casio CTK-1100 #002 lively 3/4 carol with stepwise eighth-note sequences.",
    },
    [
      ["G4", 0, 1],
      ["C5", 1, 1], ["C5", 2, 0.5], ["D5", 2.5, 0.5], ["C5", 3, 0.5], ["B4", 3.5, 0.5],
      ["A4", 4, 1], ["A4", 5, 1], ["A4", 6, 1],
      ["D5", 7, 1], ["D5", 8, 0.5], ["E5", 8.5, 0.5], ["D5", 9, 0.5], ["C5", 9.5, 0.5],
      ["B4", 10, 1], ["G4", 11, 1], ["G4", 12, 1],
      ["E5", 13, 1], ["E5", 14, 0.5], ["F5", 14.5, 0.5], ["E5", 15, 0.5], ["D5", 15.5, 0.5],
      ["C5", 16, 1], ["A4", 17, 1], ["G4", 18, 0.5], ["G4", 18.5, 0.5],
      ["A4", 19, 1], ["D5", 20, 1], ["B4", 21, 1],
      ["C5", 22, 3],
    ],
    [
      { beat: 1, sym: "C", pattern: "waltz" },
      { beat: 4, sym: "F", pattern: "waltz" },
      { beat: 7, sym: "Dm", pattern: "waltz" },
      { beat: 10, sym: "G7", pattern: "waltz" },
      { beat: 13, sym: "E7", pattern: "waltz" },
      { beat: 16, sym: "Am", pattern: "waltz" },
      { beat: 19, sym: "G7", pattern: "waltz" },
      { beat: 22, sym: "C", pattern: "waltz" },
    ],
  ),

  buildTrack(
    {
      id: "casio-005-joy-to-the-world",
      title: "CTK-1100 #005 · Joy to the World",
      titleZh: "CTK-1100 #005 · 普世欢腾",
      composer: "George Frideric Handel",
      category: "classical",
      difficulty: 2,
      bpm: 102,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #005 亨德尔名作，练习完整 C 大调下行音阶与附点推进。",
      descriptionEn: "Casio CTK-1100 #005 Handel hymn opening with a full descending C-major scale.",
    },
    [
      ["C5", 0, 1], ["B4", 1, 0.75], ["A4", 1.75, 0.25], ["G4", 2, 1.5], ["F4", 3.5, 0.5],
      ["E4", 4, 1], ["D4", 5, 1], ["C4", 6, 1.5], ["G4", 7.5, 0.5],
      ["A4", 8, 1.5], ["A4", 9.5, 0.5], ["B4", 10, 1.5], ["B4", 11.5, 0.5],
      ["C5", 12, 3], ["C5", 15, 0.5], ["C5", 15.5, 0.5],
      ["B4", 16, 0.5], ["A4", 16.5, 0.5], ["G4", 17, 0.5], ["G4", 17.5, 0.75], ["F4", 18.25, 0.25], ["E4", 18.5, 0.5], ["C5", 19, 0.5], ["C5", 19.5, 0.5],
      ["B4", 20, 0.5], ["A4", 20.5, 0.5], ["G4", 21, 0.5], ["G4", 21.5, 0.75], ["F4", 22.25, 0.25], ["E4", 22.5, 0.5], ["E4", 23, 1],
      ["E4", 24, 0.5], ["C5", 24.5, 1], ["A4", 25.5, 0.5], ["G4", 26, 0.75], ["F4", 26.75, 0.25], ["E4", 27, 0.5], ["F4", 27.5, 0.5],
      ["E4", 28, 1], ["D4", 29, 1], ["C4", 30, 2],
    ],
    [
      { beat: 0, sym: "C", pattern: "block" },
      { beat: 4, sym: "G7", pattern: "block" },
      { beat: 8, sym: "F", pattern: "block" },
      { beat: 12, sym: "C", pattern: "block" },
      { beat: 16, sym: "C", pattern: "arp4" },
      { beat: 20, sym: "C", pattern: "arp4" },
      { beat: 24, sym: "F", pattern: "arp4" },
      { beat: 28, sym: "G7", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-007-saints",
      title: "CTK-1100 #007 · When the Saints Go Marching In",
      titleZh: "CTK-1100 #007 · 圣徒进行曲",
      composer: "Traditional Gospel",
      category: "pop-etude",
      difficulty: 1,
      bpm: 118,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "yamaha-ep",
      descriptionZh: "卡西欧 CTK-1100 #007 经典爵士启蒙曲，感受切分音与 C-F-G7 大三和弦进行。",
      descriptionEn: "Casio CTK-1100 #007 jazz standard great for syncopation & C-F-G7 chords.",
    },
    [
      ["C4", 0, 1], ["E4", 1, 1], ["F4", 2, 1], ["G4", 3, 4],
      ["C4", 7, 1], ["E4", 8, 1], ["F4", 9, 1], ["G4", 10, 4],
      ["C4", 14, 1], ["E4", 15, 1], ["F4", 16, 1], ["G4", 17, 2], ["E4", 19, 2],
      ["C4", 21, 2], ["E4", 23, 2], ["D4", 25, 4],
      ["E4", 29, 1], ["E4", 30, 1], ["D4", 31, 1], ["C4", 32, 1.5], ["C4", 33.5, 0.5], ["E4", 34, 1], ["G4", 35, 1],
      ["G4", 36, 1], ["F4", 37, 3],
      ["E4", 40, 1], ["F4", 41, 1], ["G4", 42, 1], ["E4", 43, 1], ["C4", 44, 2], ["D4", 46, 2], ["C4", 48, 4],
    ],
    [
      { beat: 3, sym: "C", pattern: "arp4" },
      { beat: 10, sym: "C", pattern: "arp4" },
      { beat: 17, sym: "C", pattern: "block" },
      { beat: 25, sym: "G7", pattern: "block" },
      { beat: 32, sym: "C", pattern: "block" },
      { beat: 37, sym: "F", pattern: "block" },
      { beat: 42, sym: "G7", pattern: "block" },
      { beat: 48, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-011-auld-lang-syne",
      title: "CTK-1100 #011 · Auld Lang Syne",
      titleZh: "CTK-1100 #011 · 友谊地久天长",
      composer: "Traditional Scottish",
      category: "pop-etude",
      difficulty: 1,
      bpm: 86,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #011 五声音阶抒情经典，适合初学大附点连贯演奏。",
      descriptionEn: "Casio CTK-1100 #011 beloved Scottish melody in gentle C pentatonic.",
    },
    [
      ["G3", 0, 1],
      ["C4", 1, 1.5], ["C4", 2.5, 0.5], ["C4", 3, 1], ["E4", 4, 1],
      ["D4", 5, 1.5], ["C4", 6.5, 0.5], ["D4", 7, 1], ["E4", 8, 1],
      ["C4", 9, 1.5], ["C4", 10.5, 0.5], ["E4", 11, 1], ["G4", 12, 1],
      ["A4", 13, 3], ["A4", 16, 1],
      ["G4", 17, 1.5], ["E4", 18.5, 0.5], ["E4", 19, 1], ["C4", 20, 1],
      ["D4", 21, 1.5], ["C4", 22.5, 0.5], ["D4", 23, 1], ["E4", 24, 1],
      ["C4", 25, 1.5], ["A3", 26.5, 0.5], ["A3", 27, 1], ["G3", 28, 1],
      ["C4", 29, 3],
    ],
    [
      { beat: 1, sym: "C", pattern: "arp4" },
      { beat: 5, sym: "G7", pattern: "arp4" },
      { beat: 9, sym: "C", pattern: "arp4" },
      { beat: 13, sym: "F", pattern: "block" },
      { beat: 17, sym: "C", pattern: "arp4" },
      { beat: 21, sym: "G7", pattern: "arp4" },
      { beat: 25, sym: "Am", pattern: "block" },
      { beat: 29, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-013-lightly-row",
      title: "CTK-1100 #013 · Lightly Row (小蜜蜂/划小船)",
      titleZh: "CTK-1100 #013 · 划小船 (Lightly Row)",
      composer: "Traditional German",
      category: "pop-etude",
      difficulty: 1,
      bpm: 104,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #013 启蒙五指固定位置代表作，左右手配合简单清晰。",
      descriptionEn: "Casio CTK-1100 #013 beginner favorite reinforcing five-finger position.",
    },
    [
      ["G4", 0, 1], ["E4", 1, 1], ["E4", 2, 2],
      ["F4", 4, 1], ["D4", 5, 1], ["D4", 6, 2],
      ["C4", 8, 1], ["D4", 9, 1], ["E4", 10, 1], ["F4", 11, 1],
      ["G4", 12, 1], ["G4", 13, 1], ["G4", 14, 2],
      ["G4", 16, 1], ["E4", 17, 1], ["E4", 18, 2],
      ["F4", 20, 1], ["D4", 21, 1], ["D4", 22, 2],
      ["C4", 24, 1], ["E4", 25, 1], ["G4", 26, 1], ["G4", 27, 1],
      ["C4", 28, 4],
    ],
    [
      { beat: 0, sym: "C", pattern: "block" },
      { beat: 4, sym: "G7", pattern: "block" },
      { beat: 8, sym: "C", pattern: "block" },
      { beat: 12, sym: "C", pattern: "block" },
      { beat: 16, sym: "C", pattern: "block" },
      { beat: 20, sym: "G7", pattern: "block" },
      { beat: 24, sym: "C", pattern: "block" },
      { beat: 28, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-021-long-long-ago",
      title: "CTK-1100 #021 · Long, Long Ago",
      titleZh: "CTK-1100 #021 · 很久以前",
      composer: "Thomas Haynes Bayly",
      category: "pop-etude",
      difficulty: 1,
      bpm: 90,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #021 铃木教材经典入门旋律，练就平滑歌唱性连奏。",
      descriptionEn: "Casio CTK-1100 #021 lyrical Suzuki-method standard in C major.",
    },
    [
      ["C4", 0, 1.5], ["C4", 1.5, 0.5], ["D4", 2, 1], ["E4", 3, 1],
      ["F4", 4, 1.5], ["F4", 5.5, 0.5], ["E4", 6, 1], ["D4", 7, 1],
      ["E4", 8, 1], ["G4", 9, 1], ["F4", 10, 1], ["E4", 11, 1],
      ["D4", 12, 4],
      ["C4", 16, 1.5], ["C4", 17.5, 0.5], ["D4", 18, 1], ["E4", 19, 1],
      ["F4", 20, 1.5], ["F4", 21.5, 0.5], ["E4", 22, 1], ["D4", 23, 1],
      ["E4", 24, 1], ["D4", 25, 1], ["E4", 26, 1], ["D4", 27, 1],
      ["C4", 28, 4],
    ],
    [
      { beat: 0, sym: "C", pattern: "arp4" },
      { beat: 4, sym: "F", pattern: "arp4" },
      { beat: 8, sym: "C", pattern: "arp4" },
      { beat: 12, sym: "G7", pattern: "block" },
      { beat: 16, sym: "C", pattern: "arp4" },
      { beat: 20, sym: "F", pattern: "arp4" },
      { beat: 24, sym: "G7", pattern: "arp4" },
      { beat: 28, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-031-happy-and-know-it",
      title: "CTK-1100 #031 · If You're Happy and You Know It",
      titleZh: "CTK-1100 #031 · 幸福拍手歌",
      composer: "Traditional Children's",
      category: "pop-etude",
      difficulty: 1,
      bpm: 112,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "8bit-arcade",
      descriptionZh: "卡西欧 CTK-1100 #031 弱起八分音符训练曲，街机节奏模式下可玩性极高！",
      descriptionEn: "Casio CTK-1100 #031 upbeat clap-along tune ideal for Arcade rhythm mode.",
    },
    [
      ["G3", 0, 0.5], ["G3", 0.5, 0.5],
      ["C4", 1, 1], ["C4", 2, 1], ["C4", 3, 1], ["C4", 4, 1],
      ["C4", 5, 0.5], ["B3", 5.5, 0.5], ["C4", 6, 0.5], ["D4", 6.5, 2.5],
      ["G3", 9, 0.5], ["G3", 9.5, 0.5],
      ["D4", 10, 1], ["D4", 11, 1], ["D4", 12, 1], ["D4", 13, 1],
      ["D4", 14, 0.5], ["C4", 14.5, 0.5], ["D4", 15, 0.5], ["E4", 15.5, 2.5],
      ["E4", 18, 0.5], ["E4", 18.5, 0.5],
      ["F4", 19, 1], ["F4", 20, 1], ["F4", 21, 1], ["A3", 22, 0.5], ["A3", 22.5, 0.5],
      ["F4", 23, 1], ["F4", 24, 1], ["E4", 25, 1], ["E4", 26, 0.5], ["D4", 26.5, 0.5],
      ["C4", 27, 1], ["C4", 28, 1], ["D4", 29, 1], ["D4", 30, 1],
      ["E4", 31, 1], ["G4", 32, 1], ["E4", 33, 1], ["D4", 34, 1],
      ["C4", 35, 3],
    ],
    [
      { beat: 1, sym: "C", pattern: "block" },
      { beat: 5, sym: "G7", pattern: "block" },
      { beat: 10, sym: "G7", pattern: "block" },
      { beat: 15, sym: "C", pattern: "block" },
      { beat: 19, sym: "F", pattern: "block" },
      { beat: 23, sym: "C", pattern: "block" },
      { beat: 27, sym: "G7", pattern: "block" },
      { beat: 35, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-043-yankee-doodle",
      title: "CTK-1100 #043 · Yankee Doodle",
      titleZh: "CTK-1100 #043 · 扬基歌",
      composer: "Traditional American",
      category: "pop-etude",
      difficulty: 1,
      bpm: 118,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "8bit-arcade",
      descriptionZh: "卡西欧 CTK-1100 #043 经典进行曲童谣，练好手指跑动均匀度。",
      descriptionEn: "Casio CTK-1100 #043 brisk march great for even finger articulation.",
    },
    [
      ["C4", 0, 1], ["C4", 1, 1], ["D4", 2, 1], ["E4", 3, 1],
      ["C4", 4, 1], ["E4", 5, 1], ["D4", 6, 2],
      ["C4", 8, 1], ["C4", 9, 1], ["D4", 10, 1], ["E4", 11, 1],
      ["C4", 12, 2], ["B3", 14, 2],
      ["C4", 16, 1], ["C4", 17, 1], ["D4", 18, 1], ["E4", 19, 1],
      ["F4", 20, 1], ["E4", 21, 1], ["D4", 22, 1], ["C4", 23, 1],
      ["B3", 24, 1], ["G3", 25, 1], ["A3", 26, 1], ["B3", 27, 1],
      ["C4", 28, 2], ["C4", 30, 2],
    ],
    [
      { beat: 0, sym: "C", pattern: "block" },
      { beat: 4, sym: "G7", pattern: "block" },
      { beat: 8, sym: "C", pattern: "block" },
      { beat: 12, sym: "G7", pattern: "block" },
      { beat: 16, sym: "C", pattern: "block" },
      { beat: 20, sym: "F", pattern: "block" },
      { beat: 24, sym: "G7", pattern: "block" },
      { beat: 28, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-053-santa-lucia",
      title: "CTK-1100 #053 · Santa Lucia",
      titleZh: "CTK-1100 #053 · 桑塔露琪亚",
      composer: "Teodoro Cottrau",
      category: "pop-etude",
      difficulty: 2,
      bpm: 88,
      timeSignature: [3, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #053 经典意大利船歌，右手三拍子波浪起伏配左手华尔兹伴奏。",
      descriptionEn: "Casio CTK-1100 #053 classic Neapolitan barcarolle in flowing 3/4.",
    },
    [
      ["G4", 0, 1], ["G4", 1, 1], ["C5", 2, 1],
      ["C5", 3, 1.5], ["B4", 4.5, 0.5], ["B4", 5, 1],
      ["F4", 6, 1], ["F4", 7, 1], ["A4", 8, 1],
      ["A4", 9, 1.5], ["G4", 10.5, 0.5], ["G4", 11, 1],
      ["E4", 12, 1], ["A4", 13, 1], ["G4", 14, 1],
      ["G4", 15, 0.5], ["F4", 15.5, 0.5], ["F4", 16, 1], ["E4", 17, 1],
      ["E4", 18, 1], ["D4", 19, 1], ["G4", 20, 1],
      ["F4", 21, 1], ["D4", 22, 1], ["C4", 23, 1],
    ],
    [
      { beat: 0, sym: "C", pattern: "waltz" },
      { beat: 3, sym: "G7", pattern: "waltz" },
      { beat: 6, sym: "G7", pattern: "waltz" },
      { beat: 9, sym: "C", pattern: "waltz" },
      { beat: 12, sym: "Am", pattern: "waltz" },
      { beat: 15, sym: "Dm", pattern: "waltz" },
      { beat: 18, sym: "G7", pattern: "waltz" },
      { beat: 21, sym: "C", pattern: "waltz" },
    ],
  ),

  buildTrack(
    {
      id: "casio-063-air-on-g-string",
      title: 'CTK-1100 #063 · Air ("Suite No. 3")',
      titleZh: "CTK-1100 #063 · G弦上的咏叹调 (巴赫)",
      composer: "J. S. Bach",
      category: "classical",
      difficulty: 3,
      bpm: 64,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #063 巴赫不朽慢板杰作，考验长音控制与延音踏板质感。",
      descriptionEn: "Casio CTK-1100 #063 serene Baroque masterpiece from Orchestral Suite No. 3.",
    },
    [
      ["E5", 0, 4],
      ["E5", 4, 1], ["F5", 5, 0.5], ["D5", 5.5, 0.5], ["B4", 6, 1], ["D5", 7, 1],
      ["C5", 8, 1], ["A4", 9, 1], ["F4", 10, 1], ["D5", 11, 1],
      ["B4", 12, 1.5], ["C5", 13.5, 0.5], ["D5", 14, 1], ["G4", 15, 1],
      ["C5", 16, 2], ["B4", 18, 1], ["A4", 19, 1],
      ["G4", 20, 4],
    ],
    [
      { beat: 0, sym: "C", pattern: "arp4" },
      { beat: 4, sym: "G", pattern: "arp4" },
      { beat: 8, sym: "Dm", pattern: "arp4" },
      { beat: 12, sym: "G7", pattern: "arp4" },
      { beat: 16, sym: "Am", pattern: "arp4" },
      { beat: 20, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-069-bridal-march",
      title: 'CTK-1100 #069 · Bridal March ("Lohengrin")',
      titleZh: "CTK-1100 #069 · 婚礼进行曲 (瓦格纳)",
      composer: "Richard Wagner",
      category: "classical",
      difficulty: 2,
      bpm: 84,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #069 庄严礼堂进行曲，训练强弱对比与附点仪式感。",
      descriptionEn: "Casio CTK-1100 #069 majestic Wagner processional with crisp dotted rhythms.",
    },
    [
      ["G4", 0, 1], ["C5", 1, 0.75], ["C5", 1.75, 0.25], ["C5", 2, 2],
      ["G4", 4, 1], ["D5", 5, 0.75], ["B4", 5.75, 0.25], ["C5", 6, 2],
      ["G4", 8, 1], ["C5", 9, 0.75], ["F5", 9.75, 0.25], ["F5", 10, 0.75], ["E5", 10.75, 0.25], ["D5", 11, 0.75], ["C5", 11.75, 0.25],
      ["B4", 12, 0.75], ["C5", 12.75, 0.25], ["D5", 13, 3],
      ["G4", 16, 1], ["C5", 17, 0.75], ["C5", 17.75, 0.25], ["C5", 18, 2],
      ["G4", 20, 1], ["D5", 21, 0.75], ["B4", 21.75, 0.25], ["C5", 22, 2],
      ["G4", 24, 1], ["E5", 25, 0.75], ["C5", 25.75, 0.25], ["A4", 26, 1], ["F4", 27, 1],
      ["E4", 28, 1], ["D4", 29, 1], ["C4", 30, 2],
    ],
    [
      { beat: 0, sym: "C", pattern: "block" },
      { beat: 4, sym: "G7", pattern: "block" },
      { beat: 8, sym: "F", pattern: "block" },
      { beat: 12, sym: "G", pattern: "block" },
      { beat: 16, sym: "C", pattern: "block" },
      { beat: 20, sym: "G7", pattern: "block" },
      { beat: 24, sym: "F", pattern: "block" },
      { beat: 28, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-070-triumphal-march",
      title: 'CTK-1100 #070 · Triumphal March ("Aida")',
      titleZh: "CTK-1100 #070 · 凯旋进行曲 (阿伊达)",
      composer: "Giuseppe Verdi",
      category: "classical",
      difficulty: 2,
      bpm: 112,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "psr1100",
      recommendedVoice: "yamaha-ep",
      descriptionZh: "卡西欧 CTK-1100 #070 歌剧《阿伊达》著名铜管号角主题。",
      descriptionEn: "Casio CTK-1100 #070 triumphant Verdi fanfare with bold octave phrasing.",
    },
    [
      ["G4", 0, 0.5], ["C5", 0.5, 1.5], ["G4", 2, 0.5], ["C5", 2.5, 1.5],
      ["E5", 4, 1], ["D5", 5, 0.5], ["C5", 5.5, 0.5], ["D5", 6, 1], ["G4", 7, 1],
      ["A4", 8, 1.5], ["B4", 9.5, 0.5], ["C5", 10, 1], ["D5", 11, 1],
      ["E5", 12, 2], ["G4", 14, 2],
      ["C5", 16, 1.5], ["D5", 17.5, 0.5], ["E5", 18, 1], ["C5", 19, 1],
      ["G5", 20, 2], ["E5", 22, 1], ["C5", 23, 1],
      ["D5", 24, 1], ["E5", 25, 0.5], ["D5", 25.5, 0.5], ["C5", 26, 1], ["B4", 27, 1],
      ["C5", 28, 4],
    ],
    [
      { beat: 0, sym: "C", pattern: "block" },
      { beat: 4, sym: "G7", pattern: "block" },
      { beat: 8, sym: "F", pattern: "block" },
      { beat: 12, sym: "C", pattern: "block" },
      { beat: 16, sym: "C", pattern: "block" },
      { beat: 20, sym: "C", pattern: "block" },
      { beat: 24, sym: "G7", pattern: "block" },
      { beat: 28, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-078-nutcracker-march",
      title: 'CTK-1100 #078 · March ("The Nutcracker")',
      titleZh: "CTK-1100 #078 · 胡桃夹子进行曲",
      composer: "P. I. Tchaikovsky",
      category: "classical",
      difficulty: 3,
      bpm: 116,
      timeSignature: [4, 4],
      keySignature: "G",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #078 芭蕾舞剧《胡桃夹子》断奏主题，G 大调含 F# 黑键。",
      descriptionEn: "Casio CTK-1100 #078 crisp staccato march in G major (with F#).",
    },
    [
      ["G4", 0, 0.5], ["D5", 0.5, 0.5], ["B4", 1, 0.5], ["G4", 1.5, 0.5], ["D5", 2, 1], ["D5", 3, 1],
      ["D5", 4, 0.5], ["E5", 4.5, 0.5], ["F#5", 5, 0.5], ["G5", 5.5, 0.5], ["A5", 6, 1], ["D5", 7, 1],
      ["G4", 8, 0.5], ["D5", 8.5, 0.5], ["B4", 9, 0.5], ["G4", 9.5, 0.5], ["D5", 10, 1], ["B4", 11, 1],
      ["A4", 12, 1], ["G4", 13, 1], ["F#4", 14, 2],
    ],
    [
      { beat: 0, sym: "G", pattern: "block" },
      { beat: 4, sym: "D7", pattern: "block" },
      { beat: 8, sym: "G", pattern: "block" },
      { beat: 12, sym: "D", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-082-jesu-joy",
      title: "CTK-1100 #082 · Jesu, Joy of Man's Desiring",
      titleZh: "CTK-1100 #082 · 耶稣，世人仰望的喜悦 (巴赫)",
      composer: "J. S. Bach",
      category: "classical",
      difficulty: 3,
      bpm: 84,
      timeSignature: [3, 4],
      keySignature: "G",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #082 巴赫最受欢迎的流动性音型名曲，稳步训练均等跑动。",
      descriptionEn: "Casio CTK-1100 #082 flowing Bach cantata chorale in G major.",
    },
    [
      ["G4", 0, 0.5], ["A4", 0.5, 0.5], ["B4", 1, 0.5], ["D5", 1.5, 0.5], ["C5", 2, 0.5], ["C5", 2.5, 0.5],
      ["E5", 3, 0.5], ["D5", 3.5, 0.5], ["D5", 4, 0.5], ["G5", 4.5, 0.5], ["F#5", 5, 0.5], ["G5", 5.5, 0.5],
      ["D5", 6, 0.5], ["B4", 6.5, 0.5], ["G4", 7, 0.5], ["A4", 7.5, 0.5], ["B4", 8, 0.5], ["C5", 8.5, 0.5],
      ["D5", 9, 0.5], ["E5", 9.5, 0.5], ["D5", 10, 0.5], ["C5", 10.5, 0.5], ["B4", 11, 0.5], ["A4", 11.5, 0.5],
      ["B4", 12, 0.5], ["G4", 12.5, 0.5], ["F#4", 13, 0.5], ["G4", 13.5, 0.5], ["A4", 14, 0.5], ["D4", 14.5, 0.5],
      ["G4", 15, 3],
    ],
    [
      { beat: 0, sym: "G", pattern: "waltz" },
      { beat: 3, sym: "C", pattern: "waltz" },
      { beat: 6, sym: "G", pattern: "waltz" },
      { beat: 9, sym: "D7", pattern: "waltz" },
      { beat: 12, sym: "D7", pattern: "waltz" },
      { beat: 15, sym: "G", pattern: "waltz" },
    ],
  ),

  buildTrack(
    {
      id: "casio-088-the-entertainer",
      title: "CTK-1100 #088 · The Entertainer",
      titleZh: "CTK-1100 #088 · 艺人 (经典拉格泰姆)",
      composer: "Scott Joplin",
      category: "pop-etude",
      difficulty: 3,
      bpm: 88,
      timeSignature: [4, 4],
      keySignature: "C",
      recommendedModel: "kbp1100",
      recommendedVoice: "yamaha-ep",
      descriptionZh: "卡西欧 CTK-1100 #088 标志性爵士拉格泰姆切分名曲，包含半音上行 D-D#-E。",
      descriptionEn: "Casio CTK-1100 #088 iconic Scott Joplin ragtime with chromatic pickup & syncopation.",
    },
    [
      ["D4", 0, 0.5], ["D#4", 0.5, 0.5], ["E4", 1, 0.5], ["C5", 1.5, 1], ["E4", 2.5, 0.5], ["C5", 3, 1],
      ["E4", 4, 0.5], ["C5", 4.5, 2.5], ["C5", 7, 0.5], ["D5", 7.5, 0.5],
      ["D#5", 8, 0.5], ["E5", 8.5, 0.5], ["C5", 9, 0.5], ["D5", 9.5, 0.5], ["E5", 10, 1], ["B4", 11, 0.5], ["D5", 11.5, 0.5],
      ["C5", 12, 3],
      ["D4", 15, 0.5], ["D#4", 15.5, 0.5],
      ["E4", 16, 0.5], ["C5", 16.5, 1], ["E4", 17.5, 0.5], ["C5", 18, 1],
      ["E4", 19, 0.5], ["C5", 19.5, 2.5],
      ["A4", 22, 0.5], ["G4", 22.5, 0.5], ["F#4", 23, 0.5], ["A4", 23.5, 0.5], ["C5", 24, 0.5], ["E5", 24.5, 1], ["D5", 25.5, 0.5],
      ["C5", 26, 0.5], ["A4", 26.5, 0.5], ["D5", 27, 1], ["C5", 28, 3],
    ],
    [
      { beat: 1, sym: "C", pattern: "arp4" },
      { beat: 4, sym: "C", pattern: "arp4" },
      { beat: 8, sym: "G7", pattern: "arp4" },
      { beat: 12, sym: "C", pattern: "block" },
      { beat: 16, sym: "C", pattern: "arp4" },
      { beat: 20, sym: "C", pattern: "arp4" },
      { beat: 24, sym: "F", pattern: "arp4" },
      { beat: 28, sym: "C", pattern: "block" },
    ],
  ),

  buildTrack(
    {
      id: "casio-091-happy-farmer",
      title: "CTK-1100 #091 · The Happy Farmer (Fröhlicher Landmann)",
      titleZh: "CTK-1100 #091 · 快乐的农夫 (舒曼)",
      composer: "Robert Schumann",
      category: "classical",
      difficulty: 2,
      bpm: 104,
      timeSignature: [4, 4],
      keySignature: "F",
      recommendedModel: "kbp1100",
      recommendedVoice: "grand-piano",
      descriptionZh: "卡西欧 CTK-1100 #091 / PX-S1100 同收名曲，F 大调含 Bb 黑键，极佳考级前热身曲。",
      descriptionEn: "Casio CTK-1100 #091 Schumann classic in F major (with Bb) for brisk phrasing.",
    },
    [
      ["C4", 0, 0.5],
      ["F4", 0.5, 1], ["A4", 1.5, 0.5], ["C5", 2, 1.5], ["A4", 3.5, 0.5],
      ["D5", 4, 0.5], ["Bb4", 4.5, 0.5], ["G4", 5, 0.5], ["C5", 5.5, 0.5], ["A4", 6, 1], ["F4", 7, 0.5], ["C4", 7.5, 0.5],
      ["F4", 8, 1], ["A4", 9, 0.5], ["C5", 9.5, 1.5], ["A4", 11, 0.5],
      ["G4", 11.5, 1.5], ["A4", 13, 0.5], ["F4", 13.5, 2.5],
    ],
    [
      { beat: 1, sym: "F", pattern: "arp4" },
      { beat: 4, sym: "Bb", pattern: "arp4" },
      { beat: 8, sym: "F", pattern: "arp4" },
      { beat: 12, sym: "C7", pattern: "block" },
    ],
  ),
];
