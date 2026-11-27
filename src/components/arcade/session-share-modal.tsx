"use client";

import { useState } from "react";
import { Share2, Play, Film, Image as ImageIcon, RotateCcw, Copy, Check } from "lucide-react";
import type { PlaySessionRecord, ReplayEvent, Song } from "@/types/music";
import { generateSessionPosterDataUrl, triggerDownload } from "@/lib/music/replay-recorder";
import { buildSongShareUrl } from "@/lib/music/song-share";
import { playSfx } from "@/lib/sfx";

interface SessionShareModalProps {
  record: PlaySessionRecord;
  song: Song;
  modelLabel: string;
  locale: "zh" | "en";
  replayEvents: ReplayEvent[];
  canExportVideo: boolean;
  onStartReplayPlayback: () => void;
  onExportVideoReplay: () => void;
  onRestartSong: () => void;
  onClose: () => void;
}

export function SessionShareModal({
  record,
  song,
  modelLabel,
  locale,
  replayEvents,
  canExportVideo,
  onStartReplayPlayback,
  onExportVideoReplay,
  onRestartSong,
  onClose,
}: SessionShareModalProps) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSavePoster = () => {
    const dataUrl = generateSessionPosterDataUrl(record, {
      modelLabel,
      locale,
      feverReached: record.maxCombo >= 15,
    });
    setPosterUrl(dataUrl);
    if (dataUrl) {
      triggerDownload(dataUrl, `keyarcade-${song.id}-${record.rank}.png`);
      playSfx("success");
    }
  };

  const handleCopyShareUrl = async () => {
    try {
      const url = buildSongShareUrl(song);
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      playSfx("coin");
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // clipboard blocked fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="terminal-box w-full max-w-md border-[#ff6a00] p-5 sm:p-6">
        <div className="text-center font-mono">
          <div className="text-[10px] tracking-widest text-[#00d4ff]">
            SESSION COMPLETE // KEYARCADE 1100
          </div>
          <div className="mt-1 truncate text-xs text-[#888]">{record.songTitle}</div>
          <div className="mt-2.5 text-5xl font-extrabold text-[#ff6a00] glow-orange">
            RANK {record.rank}
          </div>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs font-bold text-[#00ff88]">
            <span>+{record.xpEarned} XP EARNED</span>
            {record.maxCombo >= 15 && (
              <span className="border border-[#00ff88]/50 bg-[#081d14] px-1.5 py-0.5 text-[10px]">
                FEVER PEAK
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border border-[#1f1f1f] bg-[#080808] p-3 text-center font-mono text-xs">
          <div>
            <div className="text-[9px] text-[#555]">SCORE</div>
            <div className="font-bold text-[#ff6a00]">{record.score}</div>
          </div>
          <div>
            <div className="text-[9px] text-[#555]">ACCURACY</div>
            <div className="font-bold text-[#00ff88]">{record.accuracy}%</div>
          </div>
          <div>
            <div className="text-[9px] text-[#555]">MAX COMBO</div>
            <div className="font-bold text-[#00d4ff]">{record.maxCombo}x</div>
          </div>
        </div>

        {/* Replay, Video Export & Share Poster Controls */}
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
          <button
            type="button"
            disabled={replayEvents.length === 0}
            onClick={() => {
              onClose();
              onStartReplayPlayback();
            }}
            className="flex items-center justify-center gap-1.5 border border-[#00ff88]/50 bg-[#081b12] py-2 font-bold text-[#00ff88] hover:bg-[#0d2b1d] disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" />
            {locale === "zh" ? "演奏回放" : "REPLAY"} ({replayEvents.length})
          </button>

          <button
            type="button"
            onClick={handleSavePoster}
            className="flex items-center justify-center gap-1.5 border border-[#ff6a00]/50 bg-[#1e1209] py-2 font-bold text-[#ff8b33] hover:bg-[#2c1a0c]"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {locale === "zh" ? "战报海报 PNG" : "POSTER .PNG"}
          </button>

          <button
            type="button"
            disabled={!canExportVideo || replayEvents.length === 0}
            onClick={() => {
              onClose();
              onExportVideoReplay();
            }}
            className="flex items-center justify-center gap-1.5 border border-[#a855f7]/50 bg-[#180d26] py-2 font-bold text-[#d8b4fe] hover:bg-[#241338] disabled:opacity-40"
          >
            <Film className="h-3.5 w-3.5" />
            {locale === "zh" ? "录制瀑布流 WEBM" : "RECORD .WEBM"}
          </button>

          <button
            type="button"
            onClick={handleCopyShareUrl}
            className="flex items-center justify-center gap-1.5 border border-[#00d4ff]/50 bg-[#071820] py-2 font-bold text-[#7dd3fc] hover:bg-[#0d2633]"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {copiedLink
              ? locale === "zh"
                ? "已复制曲谱链"
                : "LINK COPIED"
              : locale === "zh"
                ? "分享同款曲谱"
                : "SHARE SONG"}
          </button>
        </div>

        {posterUrl && (
          <div className="mt-2 flex items-center justify-between border border-[#222] bg-[#09090c] px-2.5 py-1.5 font-mono text-[10px] text-[#00ff88]">
            <span>{locale === "zh" ? "战报海报已下载 (.png)" : "Poster PNG downloaded"}</span>
            <button
              type="button"
              onClick={() => triggerDownload(posterUrl, `keyarcade-${song.id}-${record.rank}.png`)}
              className="flex items-center gap-1 text-[#00d4ff] underline"
            >
              <Copy className="h-3 w-3" /> {locale === "zh" ? "重新保存" : "Save again"}
            </button>
          </div>
        )}

        <div className="mt-4 flex gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={onRestartSong}
            className="flex flex-1 items-center justify-center gap-1.5 bg-[#ff6a00] py-2.5 font-bold text-[#0a0a0a]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {locale === "zh" ? "再弹一遍" : "PLAY AGAIN"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-[#333] px-4 py-2.5 text-[#aaa] hover:text-white"
          >
            {locale === "zh" ? "关闭" : "CLOSE"}
          </button>
        </div>
      </div>
    </div>
  );
}
