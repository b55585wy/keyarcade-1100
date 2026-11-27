"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Disc3,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FileText,
  Upload,
  Gamepad2,
  Volume2,
} from "lucide-react";
import type { Song, SynthVoiceId } from "@/types/music";
import { audioEngine } from "@/lib/music/audio-engine";
import { SYNTH_VOICES } from "@/lib/music/yamaha-profiles";
import { playSfx } from "@/lib/sfx";

interface CdAlbumDef {
  id: string;
  code: string;
  titleZh: string;
  titleEn: string;
  subtitleZh: string;
  subtitleEn: string;
  accent: string;
  year: string;
  songs: Song[];
}

function PixelCdDisc({
  accent,
  spinning,
  size = 52,
}: {
  accent: string;
  spinning?: boolean;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={spinning ? "cd-spin shrink-0" : "shrink-0"}
      aria-hidden="true"
    >
      <rect x="7" y="1" width="10" height="2" fill={accent} />
      <rect x="4" y="3" width="16" height="2" fill={accent} />
      <rect x="2" y="5" width="20" height="2" fill="#2a2a2a" />
      <rect x="1" y="7" width="22" height="10" fill="#1e1e1e" />
      <rect x="2" y="17" width="20" height="2" fill="#2a2a2a" />
      <rect x="4" y="19" width="16" height="2" fill={accent} />
      <rect x="7" y="21" width="10" height="2" fill={accent} />

      <rect x="5" y="5" width="4" height="2" fill="#555" />
      <rect x="3" y="7" width="3" height="3" fill="#444" />
      <rect x="15" y="15" width="4" height="2" fill="#555" />
      <rect x="18" y="12" width="3" height="3" fill="#444" />

      <rect x="8" y="6" width="8" height="2" fill={accent} />
      <rect x="6" y="8" width="12" height="8" fill={accent} />
      <rect x="8" y="16" width="8" height="2" fill={accent} />

      <rect x="9" y="9" width="6" height="6" fill="#111" />
      <rect x="10" y="10" width="4" height="4" fill="#060606" />
    </svg>
  );
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

const STARTER_IDS = new Set([
  "twinkle-star",
  "ode-to-joy",
  "mo-li-hua",
  "farewell-song",
  "canon-in-d",
  "c-major-dojo",
  "casio-062-sakura",
]);

const CLASSICAL_DISC_IDS = new Set([
  "fur-elise",
  "casio-000-jupiter",
  "casio-063-air-on-g-string",
  "casio-064-vivaldi-spring",
  "casio-067-nachtmusik",
  "casio-079-swan-lake",
  "casio-081-minuet-in-g",
  "casio-082-jesu-joy",
  "pxs1100-turkish-march",
]);

const FESTIVE_MARCH_IDS = new Set([
  "casio-001-deck-the-hall",
  "casio-002-merry-christmas",
  "casio-003-jingle-bells",
  "casio-004-silent-night",
  "casio-005-joy-to-the-world",
  "casio-069-bridal-march",
  "casio-070-triumphal-march",
  "casio-078-nutcracker-march",
]);

export function CdCollectionShelf({
  songs,
  locale,
}: {
  songs: Song[];
  locale: "zh" | "en";
}) {
  const albums = useMemo<CdAlbumDef[]>(() => {
    const custom = songs.filter((s) => s.sourceFormat !== "builtin");
    const builtin = songs.filter((s) => s.sourceFormat === "builtin");

    const starter = builtin.filter((s) => STARTER_IDS.has(s.id));
    const classical = builtin.filter((s) => CLASSICAL_DISC_IDS.has(s.id));
    const festive = builtin.filter((s) => FESTIVE_MARCH_IDS.has(s.id));
    const folk = builtin.filter(
      (s) => !STARTER_IDS.has(s.id) && !CLASSICAL_DISC_IDS.has(s.id) && !FESTIVE_MARCH_IDS.has(s.id),
    );

    const list: CdAlbumDef[] = [
      {
        id: "disc-starter",
        code: "DISC-01",
        titleZh: "启蒙与国风名曲集",
        titleEn: "STARTER & FOLK",
        subtitleZh: "小星星 · 茉莉花 · 樱花 · 穿指基本功",
        subtitleEn: "Twinkle · Mo Li Hua · Sakura · Scale Dojo",
        accent: "#ff6a00",
        year: "VOL.1",
        songs: starter,
      },
      {
        id: "disc-classical",
        code: "DISC-02",
        titleZh: "卡西欧 1100 古典殿堂",
        titleEn: "1100 CLASSICAL HALL",
        subtitleZh: "朱庇特 · 巴赫小步舞曲 · 春 · 土耳其进行曲",
        subtitleEn: "Jupiter · Minuet in G · Spring · Turkish March",
        accent: "#00d4ff",
        year: "VOL.2",
        songs: classical,
      },
      {
        id: "disc-festive",
        code: "DISC-03",
        titleZh: "礼堂进行曲与欢庆辑",
        titleEn: "MARCHES & CAROLS",
        subtitleZh: "铃儿响叮当 · 平安夜 · 婚礼进行曲 · 凯旋进行曲",
        subtitleEn: "Jingle Bells · Silent Night · Bridal · Aida",
        accent: "#00ff88",
        year: "VOL.3",
        songs: festive,
      },
      {
        id: "disc-folk",
        code: "DISC-04",
        titleZh: "世界民谣与拉格泰姆",
        titleEn: "WORLD FOLK & RAGTIME",
        subtitleZh: "绿袖子 · 艺人 · 念故乡 · 快乐的农夫",
        subtitleEn: "Greensleeves · Entertainer · Going Home",
        accent: "#a855f7",
        year: "VOL.4",
        songs: folk,
      },
    ];

    if (custom.length > 0) {
      list.push({
        id: "disc-custom",
        code: "USER-CD",
        titleZh: "个人自制刻录专辑",
        titleEn: "MY IMPORTED DISCS",
        subtitleZh: "自定义导入 MIDI / MusicXML / 简谱曲目",
        subtitleEn: "Custom Imported MIDI & Jianpu Tracks",
        accent: "#e0e0e0",
        year: "RAW",
        songs: custom,
      });
    }

    return list;
  }, [songs]);

  const [selectedId, setSelectedId] = useState<string>("disc-starter");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [voiceOverride, setVoiceOverride] = useState<SynthVoiceId | null>(null);

  const currentSecRef = useRef(0);
  const activeNotesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    currentSecRef.current = currentSec;
  }, [currentSec]);

  const activeAlbum = albums.find((a) => a.id === selectedId) ?? albums[0];
  const activeTrackIdx = useMemo(() => {
    if (!activeAlbum || activeAlbum.songs.length === 0) return 0;
    const found = activeAlbum.songs.findIndex((s) => s.id === selectedTrackId);
    return found >= 0 ? found : 0;
  }, [activeAlbum, selectedTrackId]);

  const activeTrack = activeAlbum?.songs[activeTrackIdx];
  const activeVoice = voiceOverride ?? activeTrack?.recommendedVoice ?? "grand-piano";

  useEffect(() => {
    audioEngine.setVoice(activeVoice);
  }, [activeVoice]);

  const totalSec = useMemo(() => {
    if (!activeTrack || activeTrack.notes.length === 0) return 10;
    return Math.max(...activeTrack.notes.map((n) => n.startSec + n.durationSec)) + 0.6;
  }, [activeTrack]);

  const stopAudio = useCallback(() => {
    audioEngine.stopAll();
    activeNotesRef.current.clear();
  }, []);

  const selectTrackAndPlay = useCallback(
    (track: Song, autoPlay: boolean) => {
      stopAudio();
      setSelectedTrackId(track.id);
      setVoiceOverride(null);
      currentSecRef.current = 0;
      setCurrentSec(0);
      setIsPlaying(autoPlay);
    },
    [stopAudio],
  );

  const stepTrack = useCallback(
    (delta: number) => {
      if (!activeAlbum || activeAlbum.songs.length === 0) return;
      const len = activeAlbum.songs.length;
      const nextIdx = (activeTrackIdx + delta + len) % len;
      selectTrackAndPlay(activeAlbum.songs[nextIdx], true);
      playSfx("key");
    },
    [activeAlbum, activeTrackIdx, selectTrackAndPlay],
  );

  // Clean up audio when unmounting homepage
  useEffect(() => {
    return () => {
      audioEngine.stopAll();
    };
  }, []);

  // Real-time CD Player audio playback loop
  useEffect(() => {
    if (!isPlaying || !activeTrack || !activeAlbum) return;

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      const nextSec = currentSecRef.current + dt;

      for (const n of activeTrack.notes) {
        const inside = nextSec >= n.startSec && nextSec <= n.startSec + n.durationSec;
        if (inside && !activeNotesRef.current.has(n.id)) {
          activeNotesRef.current.add(n.id);
          audioEngine.noteOn(n.midi, n.velocity);
        } else if (!inside && activeNotesRef.current.has(n.id)) {
          activeNotesRef.current.delete(n.id);
          audioEngine.noteOff(n.midi);
        }
      }

      if (nextSec >= totalSec) {
        stopAudio();
        // Auto-advance to next track on this CD
        const nextIdx = (activeTrackIdx + 1) % activeAlbum.songs.length;
        const nextSong = activeAlbum.songs[nextIdx];
        if (nextSong) {
          setSelectedTrackId(nextSong.id);
          setVoiceOverride(null);
          currentSecRef.current = 0;
          setCurrentSec(0);
        } else {
          setIsPlaying(false);
        }
        return;
      }

      currentSecRef.current = nextSec;
      setCurrentSec(nextSec);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      stopAudio();
    };
  }, [activeAlbum, activeTrack, activeTrackIdx, isPlaying, stopAudio, totalSec]);

  const progressPct = totalSec > 0 ? Math.min(100, Math.round((currentSec / totalSec) * 100)) : 0;

  return (
    <div className="mt-6 terminal-box p-5 sm:p-6">
      {/* Section Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-white">
            <Disc3 className="h-4 w-4 text-[#ff6a00]" />
            {locale === "zh" ? "像素 CD 唱片架 & 在线试听" : "Playable Pixel CD Collection"}
          </h2>
          <div className="mt-0.5 text-xs text-[#8a8a98]">
            {locale === "zh"
              ? `${albums.length} 张主题专辑 · 共 ${songs.length} 首可试听/跟弹曲目`
              : `${albums.length} Albums · ${songs.length} Interactive Tracks`}
          </div>
        </div>
        <Link
          href="/import"
          className="flex items-center gap-1.5 rounded-lg border border-[#00ff88]/40 bg-[#081910] px-3 py-1.5 text-xs font-semibold text-[#00ff88] hover:bg-[#0f291c]"
        >
          <Upload className="h-3.5 w-3.5" />
          {locale === "zh" ? "刻录新曲 (导入/哼唱)" : "Import / Hum Song"}
        </Link>
      </div>

      {/* CD Jewel Case Shelf */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {albums.map((album) => {
          const isSelected = album.id === activeAlbum?.id;
          return (
            <button
              key={album.id}
              type="button"
              onClick={() => {
                stopAudio();
                setIsPlaying(false);
                currentSecRef.current = 0;
                setCurrentSec(0);
                setSelectedId(album.id);
                setSelectedTrackId(album.songs[0]?.id ?? null);
                setVoiceOverride(null);
                playSfx("key");
              }}
              className={`group relative flex flex-col justify-between border text-left transition-all ${
                isSelected
                  ? "border-[#ff6a00] bg-[#15120f] shadow-[4px_4px_0_#222] -translate-y-0.5"
                  : "border-[#222] bg-[#0b0b0b] hover:border-[#444] hover:bg-[#101010]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#1c1c1c] px-2.5 py-1.5 text-[9px]">
                <span className="font-bold" style={{ color: album.accent }}>
                  {album.code}
                </span>
                <span className="text-[#555]">{album.songs.length}首</span>
              </div>

              <div className="flex flex-col items-center justify-center py-4 px-2">
                <PixelCdDisc
                  accent={album.accent}
                  spinning={isSelected && isPlaying}
                  size={56}
                />
              </div>

              <div className="border-t border-[#181818] bg-[#080808] p-2.5">
                <div className="truncate text-xs font-bold text-[#e0e0e0]">
                  {locale === "zh" ? album.titleZh : album.titleEn}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-[#666]">
                  {locale === "zh" ? album.subtitleZh : album.subtitleEn}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active CD Player Deck + Tracklist */}
      {activeAlbum && activeTrack && (
        <div className="mt-4 border border-[#242424] bg-[#080808] p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left: Interactive Retro CD Player */}
            <div className="flex flex-col justify-between border border-[#1c1c1c] bg-[#0c0c0c] p-3.5 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold" style={{ color: activeAlbum.accent }}>
                    [{activeAlbum.code}] // {isPlaying ? "PLAYING" : "STANDBY"}
                  </span>
                  <span className="text-[#00ff88]">
                    TRK {String(activeTrackIdx + 1).padStart(2, "0")}/
                    {String(activeAlbum.songs.length).padStart(2, "0")}
                  </span>
                </div>

                {/* Disc + Now Playing LCD */}
                <div className="my-3 flex items-center gap-3">
                  <PixelCdDisc accent={activeAlbum.accent} spinning={isPlaying} size={64} />
                  <div className="min-w-0 flex-1 yamaha-lcd px-2.5 py-2">
                    <div className="text-[9px] text-[#3ea875]">
                      {activeTrack.keySignature} · {activeTrack.timeSignature[0]}/
                      {activeTrack.timeSignature[1]} · {activeTrack.bpm} BPM
                    </div>
                    <div className="mt-0.5 truncate text-xs font-bold text-[#00ff88] glow-green">
                      {locale === "zh" && activeTrack.titleZh
                        ? activeTrack.titleZh
                        : activeTrack.title}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-[#7fc7a1]">
                      {activeTrack.composer}
                    </div>
                  </div>
                </div>

                {/* Seekable Progress Bar */}
                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-[10px] text-[#666]">
                    <span>{formatClock(currentSec)}</span>
                    <span>{formatClock(totalSec)}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(
                        0,
                        Math.min(1, (e.clientX - rect.left) / rect.width),
                      );
                      stopAudio();
                      const sec = ratio * totalSec;
                      currentSecRef.current = sec;
                      setCurrentSec(sec);
                    }}
                    className="h-2.5 w-full cursor-pointer border border-[#242424] bg-[#060606]"
                    title="Click to seek"
                  >
                    <div
                      className="h-full bg-[#00ff88] transition-[width]"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Player Controls + Voice + Jump to Arcade */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stepTrack(-1)}
                    aria-label="Previous track"
                    className="border border-[#262626] bg-[#111] p-2 text-[#aaa] hover:border-[#ff6a00] hover:text-[#ff6a00]"
                  >
                    <SkipBack className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isPlaying) {
                        stopAudio();
                        setIsPlaying(false);
                      } else {
                        if (currentSec >= totalSec - 0.1) {
                          currentSecRef.current = 0;
                          setCurrentSec(0);
                        }
                        setIsPlaying(true);
                      }
                    }}
                    className={`pixel-border flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors ${
                      isPlaying
                        ? "bg-[#00ff88] text-[#0a0a0a]"
                        : "bg-[#ff6a00] text-[#0a0a0a] hover:bg-[#ff8a33]"
                    }`}
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {isPlaying
                      ? locale === "zh"
                        ? "暂停播放"
                        : "PAUSE CD"
                      : locale === "zh"
                        ? "首页播放本曲"
                        : "PLAY ON CD"}
                  </button>

                  <button
                    type="button"
                    onClick={() => stepTrack(1)}
                    aria-label="Next track"
                    className="border border-[#262626] bg-[#111] p-2 text-[#aaa] hover:border-[#ff6a00] hover:text-[#ff6a00]"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <label className="flex flex-1 items-center gap-1.5 border border-[#222] bg-[#080808] px-2 py-1 text-[#888]">
                    <Volume2 className="h-3 w-3 text-[#00d4ff]" />
                    <select
                      aria-label="CD Player Voice"
                      value={activeVoice}
                      onChange={(e) => setVoiceOverride(e.target.value as SynthVoiceId)}
                      className="w-full bg-[#080808] text-[#e0e0e0] focus:outline-none"
                    >
                      {SYNTH_VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.code} {locale === "zh" ? v.labelZh : v.labelEn}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Link
                    href={`/arcade?song=${encodeURIComponent(activeTrack.id)}`}
                    onClick={stopAudio}
                    className="flex items-center gap-1 border border-[#ff6a00]/60 bg-[#1a1008] px-2.5 py-1 font-bold text-[#ff6a00] hover:bg-[#ff6a00] hover:text-[#0a0a0a]"
                  >
                    <Gamepad2 className="h-3 w-3" />
                    {locale === "zh" ? "去练琴" : "PRACTICE"}
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: Scrollable CD Tracklist */}
            <div className="border border-[#1c1c1c] bg-[#0a0a0a] lg:col-span-7">
              <div className="flex items-center justify-between border-b border-[#1c1c1c] px-3 py-2 text-[10px] text-[#555]">
                <span>TRACKLIST ({activeAlbum.songs.length})</span>
                <span className="text-[#00ff88]">
                  {locale === "zh" ? "点歌名直接试听 · 点「练琴」进跟弹" : "Click track to play · Practice in Arcade"}
                </span>
              </div>

              <div className="max-h-[260px] divide-y divide-[#151515] overflow-y-auto">
                {activeAlbum.songs.map((s, idx) => {
                  const isCurrent = s.id === activeTrack.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => selectTrackAndPlay(s, true)}
                      className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                        isCurrent
                          ? "bg-[#15120e] border-l-2 border-l-[#00ff88]"
                          : "hover:bg-[#121212]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`w-5 shrink-0 font-bold ${
                            isCurrent ? "text-[#00ff88]" : "text-[#555]"
                          }`}
                        >
                          {isCurrent && isPlaying ? "▶" : String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <div
                            className={`truncate font-bold ${
                              isCurrent ? "text-[#00ff88]" : "text-[#e0e0e0]"
                            }`}
                          >
                            {locale === "zh" && s.titleZh ? s.titleZh : s.title}
                          </div>
                          <div className="text-[10px] text-[#666]">
                            {s.composer} · {s.keySignature} · {s.bpm} BPM
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex shrink-0 items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="border border-[#222] bg-[#080808] px-1.5 py-0.5 text-[10px] text-[#ff6a00]">
                          LV.{s.difficulty}
                        </span>
                        <Link
                          href={`/scores?song=${encodeURIComponent(s.id)}`}
                          onClick={stopAudio}
                          className="flex items-center gap-1 border border-[#252525] px-2 py-1 text-[10px] text-[#888] hover:border-[#00d4ff] hover:text-[#00d4ff]"
                          title="View sheet music"
                        >
                          <FileText className="h-3 w-3" />
                          {locale === "zh" ? "谱" : "SCORE"}
                        </Link>
                        <Link
                          href={`/arcade?song=${encodeURIComponent(s.id)}`}
                          onClick={stopAudio}
                          className="flex items-center gap-1 bg-[#ff6a00] px-2 py-1 text-[10px] font-bold text-[#0a0a0a] hover:bg-[#ff8a33]"
                        >
                          {locale === "zh" ? "练琴" : "PLAY"}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
