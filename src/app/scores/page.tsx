"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Play, Pause, Download, Gamepad2, Printer, Share2, Check } from "lucide-react";
import type { Song } from "@/types/music";
import { getAllSongs, subscribeStore } from "@/lib/storage/academy-store";
import { SheetMusicView } from "@/components/score/sheet-music-view";
import { ScoreQuickEditor } from "@/components/score/score-quick-editor";
import { audioEngine } from "@/lib/music/audio-engine";
import { exportSongToMidi } from "@/lib/music/midi-exporter";
import { buildSongShareUrl } from "@/lib/music/song-share";
import { useI18n } from "@/lib/i18n";
import { playSfx } from "@/lib/sfx";

function ScoresInner() {
  const { locale } = useI18n();
  const params = useSearchParams();
  const qSong = params.get("song");

  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedId, setSelectedId] = useState<string>(qSong || "twinkle-star");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [copiedShare, setCopiedShare] = useState(false);
  const currentSecRef = useRef(0);
  const activeDemoRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    currentSecRef.current = currentSec;
  }, [currentSec]);

  useEffect(() => {
    const sync = () => {
      const list = getAllSongs();
      setSongs(list);
      if (qSong && list.some((s) => s.id === qSong)) {
        setSelectedId(qSong);
      }
    };
    sync();
    return subscribeStore(sync);
  }, [qSong]);

  const song = useMemo(
    () => songs.find((s) => s.id === selectedId) ?? songs[0],
    [selectedId, songs],
  );

  const totalSec = useMemo(() => {
    if (!song || song.notes.length === 0) return 10;
    return Math.max(...song.notes.map((n) => n.startSec + n.durationSec)) + 0.8;
  }, [song]);

  useEffect(() => {
    if (!isPlaying || !song) return;
    audioEngine.setVoice(song.recommendedVoice);
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = currentSecRef.current + dt;

      for (const n of song.notes) {
        const on = next >= n.startSec && next <= n.startSec + n.durationSec;
        if (on && !activeDemoRef.current.has(n.id)) {
          activeDemoRef.current.add(n.id);
          audioEngine.noteOn(n.midi, n.velocity);
        } else if (!on && activeDemoRef.current.has(n.id)) {
          activeDemoRef.current.delete(n.id);
          audioEngine.noteOff(n.midi);
        }
      }

      if (next >= totalSec) {
        audioEngine.stopAll();
        activeDemoRef.current.clear();
        setIsPlaying(false);
        setCurrentSec(0);
        return;
      }

      currentSecRef.current = next;
      setCurrentSec(next);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      audioEngine.stopAll();
    };
  }, [isPlaying, song, totalSec]);

  if (!song) return null;
  const currentBeat = (currentSec * song.bpm) / 60;

  const handleExportMidi = () => {
    const bytes = exportSongToMidi(song);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.id}.mid`;
    a.click();
    URL.revokeObjectURL(url);
    playSfx("success");
  };

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 font-mono sm:px-4">
      <div className="mb-4 terminal-box p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#ff6a00]">
              &gt; {locale === "zh" ? "智能双谱生成与视奏台" : "AUTO SHEET MUSIC STUDIO"}
            </h1>
            <p className="mt-1 text-xs text-[#666]">
              {locale === "zh"
                ? "五线谱 (高音/低音谱表 + 指法 + 和弦标记) 与简谱实时对照，点击任意小节可直接试听。"
                : "Synchronized Grand Staff & Jianpu with automatic fingerings and chord badges."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Choose score"
              value={song.id}
              onChange={(e) => {
                setIsPlaying(false);
                audioEngine.stopAll();
                setCurrentSec(0);
                setSelectedId(e.target.value);
              }}
              className="border border-[#2a2a2a] bg-[#080808] px-3 py-1.5 text-xs text-[#e0e0e0] focus:border-[#ff6a00] focus:outline-none"
            >
              {songs.map((s) => (
                <option key={s.id} value={s.id}>
                  {locale === "zh" && s.titleZh ? s.titleZh : s.title}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="pixel-border flex items-center gap-1.5 bg-[#00ff88] px-3 py-1.5 text-xs font-bold text-[#0a0a0a]"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? (locale === "zh" ? "停止" : "STOP") : locale === "zh" ? "试听曲谱" : "AUDITION"}
            </button>

            <button
              onClick={handleExportMidi}
              className="flex items-center gap-1 border border-[#2a2a2a] bg-[#111] px-2.5 py-1.5 text-xs text-[#00d4ff] hover:border-[#00d4ff]"
            >
              <Download className="h-3.5 w-3.5" />
              .MID
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(buildSongShareUrl(song));
                  setCopiedShare(true);
                  playSfx("coin");
                  window.setTimeout(() => setCopiedShare(false), 2000);
                } catch {
                  // ignore
                }
              }}
              className="flex items-center gap-1 border border-[#2a2a2a] bg-[#111] px-2.5 py-1.5 text-xs text-[#a855f7] hover:border-[#a855f7]"
            >
              {copiedShare ? <Check className="h-3.5 w-3.5 text-[#00ff88]" /> : <Share2 className="h-3.5 w-3.5" />}
              {copiedShare ? (locale === "zh" ? "已复制" : "COPIED") : locale === "zh" ? "分享码" : "SHARE"}
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 border border-[#2a2a2a] bg-[#111] px-2.5 py-1.5 text-xs text-[#888] hover:border-[#ff6a00] hover:text-[#e0e0e0]"
            >
              <Printer className="h-3.5 w-3.5" />
              {locale === "zh" ? "打印" : "PRINT"}
            </button>

            <Link
              href={`/arcade?song=${encodeURIComponent(song.id)}`}
              className="flex items-center gap-1.5 bg-[#ff6a00] px-3 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#ff8a33]"
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              {locale === "zh" ? "进入练琴" : "PRACTICE"}
            </Link>
          </div>
        </div>
      </div>

      <ScoreQuickEditor
        song={song}
        locale={locale}
        onSongUpdated={(updated) => setSelectedId(updated.id)}
      />

      <SheetMusicView
        song={song}
        currentBeat={currentBeat}
        onJumpToBeat={(beat) => {
          audioEngine.stopAll();
          activeDemoRef.current.clear();
          setCurrentSec((beat * 60) / song.bpm);
        }}
      />
    </div>
  );
}

export default function ScoresPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#666]">Loading scores...</div>}>
      <ScoresInner />
    </Suspense>
  );
}
