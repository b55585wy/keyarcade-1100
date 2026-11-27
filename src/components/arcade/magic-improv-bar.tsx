"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Circle,
  Square,
  Wand2,
  Sparkles,
  Play,
  Share2,
  Check,
  FileMusic,
  Bot,
  Shuffle,
  Loader2,
  KeyRound,
  Layers,
} from "lucide-react";
import type { FreeAssistMode, Song, YamahaModelId } from "@/types/music";
import {
  buildOfflineBlueprintSong,
  CHORD_PROGRESSIONS,
  FREE_ASSIST_MODES,
  MAGIC_VIBE_PRESETS,
  type MagicVibePreset,
} from "@/lib/music/magic-engine";
import {
  DeepSeekApiError,
  generateScoreWithDeepSeek,
  readDeepSeekKey,
  subscribeDeepSeekKey,
  writeDeepSeekKey,
} from "@/lib/music/deepseek-score";
import { saveCustomSong } from "@/lib/storage/academy-store";
import { buildSongShareUrl } from "@/lib/music/song-share";
import { playSfx } from "@/lib/sfx";

interface MagicImprovBarProps {
  locale: "zh" | "en";
  compact?: boolean;
  model: YamahaModelId;
  songs: Song[];
  selectedSongId: string;
  onSelectSongId: (songId: string) => void;
  assistMode: FreeAssistMode;
  onChangeAssistMode: (m: FreeAssistMode) => void;
  activeVibeId: string;
  onApplyVibe: (vibe: MagicVibePreset) => void;
  progressionId: string;
  onChangeProgression: (id: string) => void;
  activeChord: string;
  magicStepIdx: number;
  magicTotalSteps: number;
  magicAutoLh: boolean;
  onToggleMagicAutoLh: () => void;
  songTitle: string;
  isRecording: boolean;
  recordedCount: number;
  onToggleRecord: () => void;
  compiledSong: Song | null;
  onPracticeCompiledSong: (song: Song) => void;
  onDismissCompiledSong: () => void;
  onAiSongReady: (song: Song) => void;
}

const HOT_AI_TITLES = ["晴天", "天空之城", "青花瓷", "起风了", "River Flows in You"];

export function MagicImprovBar({
  locale,
  compact = false,
  model,
  songs,
  selectedSongId,
  onSelectSongId,
  assistMode,
  onChangeAssistMode,
  activeVibeId,
  onApplyVibe,
  progressionId,
  onChangeProgression,
  activeChord,
  magicStepIdx,
  magicTotalSteps,
  magicAutoLh,
  onToggleMagicAutoLh,
  songTitle,
  isRecording,
  recordedCount,
  onToggleRecord,
  compiledSong,
  onPracticeCompiledSong,
  onDismissCompiledSong,
  onAiSongReady,
}: MagicImprovBarProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showKeyBox, setShowKeyBox] = useState(false);
  const [lastAttemptedQuery, setLastAttemptedQuery] = useState("晴天");

  const browserApiKey = useSyncExternalStore(
    subscribeDeepSeekKey,
    readDeepSeekKey,
    () => "",
  );

  const activeMeta =
    FREE_ASSIST_MODES.find((m) => m.id === assistMode) ?? FREE_ASSIST_MODES[0];

  const handleRandomVibe = () => {
    const others = MAGIC_VIBE_PRESETS.filter((v) => v.id !== activeVibeId);
    const pick = others[Math.floor(Math.random() * others.length)] ?? MAGIC_VIBE_PRESETS[0];
    onApplyVibe(pick);
    playSfx("coin");
  };

  const handleRandomSong = () => {
    if (songs.length === 0) return;
    const pool = songs.filter((s) => s.id !== selectedSongId);
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? songs[0];
    onSelectSongId(pick.id);
    if (assistMode !== "magic-rhythm") onChangeAssistMode("magic-rhythm");
    playSfx("coin");
  };

  const handleLoadOfflineTemplate = (titleHint?: string) => {
    const tplSong = buildOfflineBlueprintSong(titleHint || lastAttemptedQuery || aiQuery, model);
    saveCustomSong(tplSong);
    onAiSongReady(tplSong);
    setAiError(null);
    setShowKeyBox(false);
    playSfx("powerup");
  };

  const handleGenerateByName = async (explicitTitle?: string) => {
    const prompt = (explicitTitle ?? aiQuery).trim();
    if (!prompt) {
      setAiError(
        locale === "zh"
          ? "请输入音乐名称或风格（如：晴天、天空之城）"
          : "Enter a song name or style prompt first.",
      );
      return;
    }
    setLastAttemptedQuery(prompt);
    setAiBusy(true);
    setAiError(null);
    try {
      const { song } = await generateScoreWithDeepSeek({
        mode: "compose",
        prompt,
        targetModel: model,
        apiKey: browserApiKey || undefined,
      });
      saveCustomSong(song);
      onAiSongReady(song);
      setAiQuery("");
      setShowKeyBox(false);
      playSfx("powerup");
    } catch (err) {
      if (err instanceof DeepSeekApiError && err.code === "NO_DEEPSEEK_KEY") {
        setShowKeyBox(true);
      }
      setAiError(err instanceof Error ? err.message : "DeepSeek AI 生成失败");
      playSfx("error");
    } finally {
      setAiBusy(false);
    }
  };

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
          ? "space-y-2 rounded-2xl border border-[#00ff88]/25 bg-[#091310] p-2.5 text-[10px]"
          : "mb-2.5 space-y-2 border border-[#00ff88]/25 bg-[#08130f] p-3 text-xs"
      }
    >
      {/* Row 1: 3 Engine Modes + Auto Chord Select + REC */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
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

        <div className="flex flex-wrap items-center gap-1.5">
          {assistMode !== "magic-rhythm" && (
            <select
              aria-label="Chord Progression Preset"
              value={progressionId}
              onChange={(e) => onChangeProgression(e.target.value)}
              className="max-w-[140px] rounded-lg border border-white/10 bg-[#0d1613] px-2 py-1 text-[10px] font-bold text-[#00d4ff] focus:outline-none"
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

      {/* Row 2A: Wrapped Multi-Vibe Blind Box Templates OR 40+ Song Jukebox with Auto-LH Sync */}
      {assistMode === "magic-rhythm" ? (
        <div className="space-y-1.5 rounded-xl border border-[#ff6a00]/30 bg-black/35 p-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-1 font-bold text-[#ff8b33]">
              {locale === "zh" ? `选择节奏曲 (${songs.length}首):` : `Song (${songs.length}):`}
            </span>
            <select
              aria-label="Magic Rhythm Song Picker"
              value={selectedSongId}
              onChange={(e) => onSelectSongId(e.target.value)}
              className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-[#12121a] px-2 py-1 text-[10px] font-bold text-white focus:border-[#ff6a00] focus:outline-none"
            >
              {songs.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#121218]">
                  {locale === "zh" && s.titleZh ? s.titleZh : s.title} ({s.bpm} BPM)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRandomSong}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-[#ff6a00]/50 bg-[#261509] px-2 py-1 text-[10px] font-bold text-[#ff8b33] hover:bg-[#381f0d]"
            >
              <Shuffle className="h-3 w-3" />
              {locale === "zh" ? "换一首名曲" : "RANDOM"}
            </button>
            <button
              type="button"
              onClick={onToggleMagicAutoLh}
              className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors ${
                magicAutoLh
                  ? "border-[#00ff88]/50 bg-[#081c13] text-[#00ff88]"
                  : "border-white/15 bg-white/5 text-[#8a8a98]"
              }`}
              title={
                locale === "zh"
                  ? "开启后每次敲击同步触发对应左手原曲和弦低音，完全跟手"
                  : "Sync left-hand bass/chords to every melodic tap"
              }
            >
              <Layers className="h-3 w-3" />
              {locale === "zh" ? `左手同步和弦: ${magicAutoLh ? "开" : "关"}` : `Auto LH: ${magicAutoLh ? "ON" : "OFF"}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleRandomVibe}
            className="flex shrink-0 items-center gap-1 rounded-full border border-[#00ff88]/50 bg-[#0d2419] px-2.5 py-1 text-[10px] font-bold text-[#00ff88] hover:bg-[#153827]"
          >
            <Shuffle className="h-3 w-3" />
            {locale === "zh" ? "盲盒换风格" : "RANDOM VIBE"}
          </button>
          {MAGIC_VIBE_PRESETS.map((vibe) => {
            const active = activeVibeId === vibe.id;
            return (
              <button
                key={vibe.id}
                type="button"
                onClick={() => onApplyVibe(vibe)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${
                  active
                    ? "text-[#0a0a0a]"
                    : "border-white/10 bg-black/35 text-[#c2c8cc] hover:border-white/30"
                }`}
                style={active ? { backgroundColor: vibe.accent, borderColor: vibe.accent } : undefined}
              >
                {locale === "zh" ? vibe.labelZh : vibe.labelEn}
              </button>
            );
          })}
        </div>
      )}

      {/* Row 3: DeepSeek One-Click Generate Song By Name + Zero-Key Offline Template Fallback */}
      <div className="rounded-xl border border-[#a855f7]/35 bg-[#120b1b] p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[10px] font-bold text-[#d8b4fe]">
            <Bot className="h-3.5 w-3.5 text-[#a855f7]" />
            {locale === "zh" ? "AI 输歌名成谱:" : "DeepSeek Song:"}
          </span>
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !aiBusy) {
                e.preventDefault();
                void handleGenerateByName();
              }
            }}
            placeholder={
              locale === "zh"
                ? "输入音乐名称或曲风，如：晴天 / 天空之城 / 卡农抒情版..."
                : "Enter song title or style (e.g. River Flows in You, Lo-Fi chill)..."
            }
            className="min-w-[160px] flex-1 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] text-white placeholder:text-[#666] focus:border-[#a855f7] focus:outline-none"
          />
          <button
            type="button"
            disabled={aiBusy}
            onClick={() => void handleGenerateByName()}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-[#a855f7] px-2.5 py-1 text-[10px] font-bold text-[#0a0a0a] hover:bg-[#c084fc] disabled:opacity-50"
          >
            {aiBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {aiBusy
              ? locale === "zh"
                ? "AI 编谱中..."
                : "GENERATING..."
              : locale === "zh"
                ? "生成并上琴"
                : "GENERATE"}
          </button>
          <button
            type="button"
            onClick={() => setShowKeyBox((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] ${
              browserApiKey
                ? "border-[#00ff88]/40 text-[#00ff88]"
                : "border-white/15 text-[#9ca3af] hover:text-white"
            }`}
            title="DeepSeek API Key"
          >
            <KeyRound className="h-3 w-3" />
            {browserApiKey ? "KEY ✓" : "API Key"}
          </button>
        </div>

        {/* Wrapped quick song chips (zero clipped pills on mobile!) */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
          <span className="shrink-0 text-[#7e728f]">
            {locale === "zh" ? "热门点歌:" : "Try:"}
          </span>
          {HOT_AI_TITLES.map((name) => (
            <button
              key={name}
              type="button"
              disabled={aiBusy}
              onClick={() => {
                setAiQuery(name);
                void handleGenerateByName(name);
              }}
              className="rounded border border-[#a855f7]/25 bg-black/30 px-1.5 py-0.5 text-[#d8b4fe] hover:border-[#a855f7]"
            >
              {name}
            </button>
          ))}
        </div>

        {showKeyBox && (
          <div className="mt-1.5 space-y-1.5 border-t border-white/10 pt-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="password"
                value={browserApiKey}
                onChange={(e) => writeDeepSeekKey(e.target.value)}
                placeholder="sk-... (DeepSeek API Key, 仅保存在本机浏览器)"
                className="min-w-[160px] flex-1 rounded border border-[#a855f7]/40 bg-black/60 px-2 py-1 text-[10px] text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleLoadOfflineTemplate()}
                className="rounded border border-[#00ff88]/50 bg-[#082216] px-2 py-1 text-[10px] font-bold text-[#00ff88] hover:bg-[#103624]"
              >
                {locale === "zh" ? "⚡ 用本地离线模板试弹" : "⚡ Use Offline Template"}
              </button>
              <button
                type="button"
                onClick={() => setShowKeyBox(false)}
                className="rounded border border-white/15 px-2 py-1 text-[10px] text-[#aaa]"
              >
                {locale === "zh" ? "收起" : "OK"}
              </button>
            </div>
          </div>
        )}

        {aiError && (
          <div className="mt-1.5 text-[10px] text-[#fca5a5]">
            {aiError}
          </div>
        )}
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

      {/* Compiled Improv / AI / Offline Blueprint Song Banner */}
      {compiledSong && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#ff6a00]/60 bg-[#1a1008] p-2 text-[11px]">
          <div className="min-w-0">
            <div className="font-bold text-[#ff8b33]">
              ✨{" "}
              {compiledSong.composer.includes("DeepSeek")
                ? locale === "zh"
                  ? "DeepSeek 乐谱已就绪！"
                  : "DeepSeek Score Ready!"
                : compiledSong.composer.includes("Offline")
                  ? locale === "zh"
                    ? "本地离线风味原型已载入！"
                    : "Offline Template Ready!"
                  : locale === "zh"
                    ? "即兴成曲已生成！"
                    : "Custom Song Compiled!"}{" "}
              · {compiledSong.titleZh || compiledSong.title}
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
