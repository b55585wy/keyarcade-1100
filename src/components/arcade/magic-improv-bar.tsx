"use client";

import { useState } from "react";
import Link from "next/link";
import { Circle, Square, Wand2, Sparkles, Play, Share2, Check, FileMusic } from "lucide-react";
import type { FreeAssistMode, Song } from "@/types/music";
import { CHORD_PROGRESSIONS, FREE_ASSIST_MODES } from "@/lib/music/magic-engine";
import { buildSongShareUrl } from "@/lib/music/song-share";
import { playSfx } from "@/lib/sfx";

interface MagicImprovBarProps {
  locale: "zh" | "en";
  compact?: boolean;
  assistMode: FreeAssistMode;
  onChangeAssistMode: (m: FreeAssistMode) => void;
  progressionId: string;
  onChangeProgression: (id: string) => void;
  activeChord: string;
  magicStepIdx: number;
  magicTotalSteps: number;
  songTitle: string;
  isRecording: boolean;
  recordedCount: number;
  onToggleRecord: () => void;
  compiledSong: Song | null;
  onPracticeCompiledSong: (song: Song) => void;
  onDismissCompiledSong: () => void;
}

export function MagicImprovBar({
  locale,
  compact = false,
  assistMode,
  onChangeAssistMode,
  progressionId,
  onChangeProgression,
  activeChord,
  magicStepIdx,
  magicTotalSteps,
  songTitle,
  isRecording,
  recordedCount,
  onToggleRecord,
  compiledSong,
  onPracticeCompiledSong,
  onDismissCompiledSong,
}: MagicImprovBarProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const activeMeta =
    FREE_ASSIST_MODES.find((m) => m.id === assistMode) ?? FREE_ASSIST_MODES[0];

  const handleCopyShare = async () => {
    if (!compiledSong) return;
    try {
      await navigator.clipboard.writeText(buildSongShareUrl(compiledSong));
      setCopiedUrl(true);
      playSfx("coin");
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // clipboard blocked
    }
  };

  return (
    <div
      className={
        compact
          ? "space-y-1.5 rounded-2xl border border-[#00ff88]/25 bg-[#091310] p-2.5 text-[10px]"
          : "mb-2.5 space-y-2 border border-[#00ff88]/25 bg-[#08130f] p-2.5 text-xs"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        {/* 3 Assist Mode Pills */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-black/45 p-0.5">
          {FREE_ASSIST_MODES.map((m) => {
            const active = assistMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeAssistMode(m.id)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 font-bold transition-colors ${
                  active ? "text-[#0a0a0a]" : "text-[#9ca3af] hover:text-white"
                }`}
                style={active ? { backgroundColor: m.accent } : undefined}
                title={locale === "zh" ? m.hintZh : m.hintEn}
              >
                {m.id === "smart-scale" && <Wand2 className="h-3 w-3" />}
                {m.id === "magic-rhythm" && <Sparkles className="h-3 w-3" />}
                <span>{locale === "zh" ? m.labelZh : m.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Auto Chord Loop Progression + One-Click Compile-to-Song REC */}
        <div className="flex flex-wrap items-center gap-1.5">
          {assistMode !== "magic-rhythm" && (
            <select
              aria-label="Chord Progression Preset"
              value={progressionId}
              onChange={(e) => onChangeProgression(e.target.value)}
              className="max-w-[140px] rounded-lg border border-white/10 bg-[#0d1613] px-2 py-1 text-[10px] font-bold text-[#00d4ff] focus:outline-none"
              title={
                locale === "zh"
                  ? "配合顶部 STYLE 鼓机每小节自动切换和弦进行"
                  : "Auto-cycle chord progression each bar with Arranger"
              }
            >
              {CHORD_PROGRESSIONS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#121218]">
                  {locale === "zh" ? p.labelZh : p.labelEn}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={onToggleRecord}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-[10px] font-bold transition-colors ${
              isRecording
                ? "animate-pulse border-[#ef4444] bg-[#2a0a0a] text-[#fca5a5]"
                : "border-[#00ff88]/50 bg-[#0c2319] text-[#00ff88] hover:bg-[#123626]"
            }`}
            title={
              locale === "zh"
                ? "录下乱弹或即兴节奏，停止后自动编译为双谱 + 分享短链！"
                : "Record your rhythm take & compile to Sheet Music + Share Link"
            }
          >
            {isRecording ? (
              <>
                <Square className="h-3 w-3 fill-current" />
                {locale === "zh" ? `停并成曲 (${recordedCount})` : `COMPILE (${recordedCount})`}
              </>
            ) : (
              <>
                <Circle className="h-3 w-3 fill-[#ff4d6d] text-[#ff4d6d]" />
                {locale === "zh" ? "录成双谱成歌" : "REC TO SONG"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contextual Status Hint */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#8aa89b]">
        <span>
          {assistMode === "magic-rhythm"
            ? locale === "zh"
              ? `🎵 剧本：《${songTitle}》 · 乱按任意键只要节奏对就能奏出下一音 (${magicStepIdx + 1}/${magicTotalSteps})`
              : `🎵 Script: "${songTitle}" · Tap ANY keys in rhythm (${magicStepIdx + 1}/${magicTotalSteps})`
            : locale === "zh"
              ? `${activeMeta.hintZh} · 当前吸附和弦: [${activeChord}]`
              : `${activeMeta.hintEn} · Active Chord: [${activeChord}]`}
        </span>
      </div>

      {/* Compiled Improv Result Banner */}
      {compiledSong && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#ff6a00]/60 bg-[#1a1008] p-2 text-[11px]">
          <div className="min-w-0">
            <div className="font-bold text-[#ff8b33]">
              ✨ {locale === "zh" ? "即兴成曲已生成！" : "Custom Song Compiled!"} · {compiledSong.title}
            </div>
            <div className="text-[10px] text-[#c7b3a1]">
              {compiledSong.notes.length} notes · {compiledSong.bpm} BPM · 1={compiledSong.keySignature}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPracticeCompiledSong(compiledSong)}
              className="flex items-center gap-1 rounded bg-[#ff6a00] px-2.5 py-1 text-[10px] font-bold text-[#0a0a0a]"
            >
              <Play className="h-3 w-3 fill-current" />
              {locale === "zh" ? "立即跟弹此曲" : "PLAY NOW"}
            </button>
            <Link
              href={`/scores?song=${encodeURIComponent(compiledSong.id)}`}
              className="flex items-center gap-1 rounded border border-[#00ff88]/50 bg-[#081b12] px-2 py-1 text-[10px] font-bold text-[#00ff88]"
            >
              <FileMusic className="h-3 w-3" />
              {locale === "zh" ? "查看双谱" : "SCORE"}
            </Link>
            <button
              type="button"
              onClick={handleCopyShare}
              className="flex items-center gap-1 rounded border border-[#00d4ff]/50 bg-[#071820] px-2 py-1 text-[10px] font-bold text-[#7dd3fc]"
            >
              {copiedUrl ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
              {copiedUrl ? (locale === "zh" ? "已复制" : "COPIED") : locale === "zh" ? "分享短链" : "SHARE"}
            </button>
            <button
              type="button"
              onClick={onDismissCompiledSong}
              className="px-1.5 text-[10px] text-[#777] hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
