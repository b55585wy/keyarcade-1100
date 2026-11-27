"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Trophy,
  Clock,
  Flame,
  TrendingUp,
  Target,
  Brain,
  Sparkles,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { getAcademyStats, getAllSongs, subscribeStore } from "@/lib/storage/academy-store";
import {
  buildDemoPreviewStats,
  computeLearningTelemetry,
} from "@/lib/music/learning-analytics";
import { LearningCurves } from "@/components/rank/learning-curves";
import { QuestMapPanel } from "@/components/rank/quest-map-panel";
import { SaveSyncPanel } from "@/components/rank/save-sync-panel";
import type { Song, UserAcademyStats } from "@/types/music";
import { useI18n } from "@/lib/i18n";

export default function RankPage() {
  const { locale } = useI18n();
  const [stats, setStats] = useState<UserAcademyStats | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [demoPreview, setDemoPreview] = useState(false);

  useEffect(() => {
    const sync = () => {
      setStats(getAcademyStats());
      setSongs(getAllSongs());
    };
    sync();
    return subscribeStore(sync);
  }, []);

  const effectiveStats = useMemo(() => {
    if (!stats) return null;
    if (demoPreview && stats.recentHistory.length === 0) {
      return buildDemoPreviewStats();
    }
    return stats;
  }, [demoPreview, stats]);

  const telemetry = useMemo(() => {
    if (!effectiveStats) return null;
    return computeLearningTelemetry(effectiveStats, songs);
  }, [effectiveStats, songs]);

  if (!effectiveStats || !telemetry) return null;

  const isShowingDemo = demoPreview && (stats?.recentHistory.length ?? 0) === 0;
  const currentLvlFloor = Math.pow(effectiveStats.level - 1, 2) * 100;
  const nextLvlXp = Math.pow(effectiveStats.level, 2) * 100;
  const progressPct = Math.min(
    100,
    Math.max(
      4,
      Math.round(
        ((effectiveStats.totalXp - currentLvlFloor) / Math.max(1, nextLvlXp - currentLvlFloor)) * 100,
      ),
    ),
  );

  const bestList = Object.values(effectiveStats.bestScores).sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto max-w-7xl px-3.5 py-5 font-sans sm:px-4">
      {/* Player Level & Gamified Header Card */}
      <div className="terminal-box p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-widest text-[#ff8b33]">
              <span>LEARNING CURVE TELEMETRY</span>
              {isShowingDemo && (
                <span className="rounded bg-[#a855f7] px-2 py-0.5 font-bold text-[#0a0a0a]">
                  DEMO PREVIEW · 非真实记录
                </span>
              )}
            </div>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              {locale === "zh"
                ? `LV.${String(effectiveStats.level).padStart(2, "0")} 1100 系列钢琴成长档案`
                : `LV.${String(effectiveStats.level).padStart(2, "0")} Piano Mastery Profile`}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {(stats?.recentHistory.length ?? 0) === 0 && (
              <button
                type="button"
                onClick={() => setDemoPreview((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                  demoPreview
                    ? "border-[#a855f7] bg-[#1a0d29] text-[#d8b4fe]"
                    : "border-[#00d4ff]/40 bg-[#071820] text-[#00d4ff] hover:bg-[#0c2633]"
                }`}
              >
                <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                {demoPreview
                  ? locale === "zh"
                    ? "退出 7 天示例曲线"
                    : "EXIT DEMO PREVIEW"
                  : locale === "zh"
                    ? "预览 7 天科学成长曲线"
                    : "PREVIEW 7-DAY CURVE"}
              </button>
            )}

            <div className="rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-1.5 text-center font-mono">
              <div className="flex items-center justify-center gap-1 text-[10px] text-[#ff8b33]">
                <Flame className="h-3 w-3" /> {locale === "zh" ? "连胜" : "STREAK"}
              </div>
              <div className="text-base font-bold text-[#ff8b33]">{effectiveStats.streakDays}d</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-1.5 text-center font-mono">
              <div className="flex items-center justify-center gap-1 text-[10px] text-[#00ff88]">
                <TrendingUp className="h-3 w-3" /> {locale === "zh" ? "均准率" : "AVG ACC"}
              </div>
              <div className="text-base font-bold text-[#00ff88]">
                {telemetry.avgAccuracy}%
                {telemetry.accuracyDelta !== 0 && (
                  <span className="ml-1 text-[10px]">
                    ({telemetry.accuracyDelta > 0 ? `+${telemetry.accuracyDelta}` : telemetry.accuracyDelta}%)
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-1.5 text-center font-mono">
              <div className="flex items-center justify-center gap-1 text-[10px] text-[#00d4ff]">
                <Trophy className="h-3 w-3" /> {locale === "zh" ? "已通关" : "CLEARED"}
              </div>
              <div className="text-base font-bold text-[#00d4ff]">{effectiveStats.songsCleared.length}</div>
            </div>

            {effectiveStats.earIq && (
              <div className="rounded-xl border border-[#a855f7]/35 bg-[#120b1a] px-3 py-1.5 text-center font-mono">
                <div className="text-[10px] text-[#c084fc]">EAR IQ</div>
                <div className="text-base font-bold text-[#e9d5ff]">{effectiveStats.earIq.bestIq}</div>
              </div>
            )}
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="mt-4">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-[#8a8a98]">
            <span>PROGRESS TO LV.{effectiveStats.level + 1}</span>
            <span>
              {effectiveStats.totalXp} / {nextLvlXp} XP
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-[#07070b]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ff6a00] to-[#ff9a3d] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* RPG Quest Map & Synth Voice Vault */}
      <div id="quest" className="mt-5">
        <QuestMapPanel stats={effectiveStats} locale={locale} />
      </div>

      {/* Interactive Scientific Learning Curves */}
      <div className="mt-5">
        <LearningCurves
          sessionCurve={telemetry.sessionCurve}
          dailyBars14={telemetry.dailyBars14}
          locale={locale}
        />
      </div>

      {/* Daily Quests & Achievement Badges */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="terminal-box p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-[#ff6a00]">
            <Target className="h-4 w-4" />
            {locale === "zh" ? "03 // 今日游戏化打卡任务 (DAILY QUESTS)" : "03 // DAILY QUESTS"}
          </h2>
          <div className="space-y-2.5 text-xs">
            {telemetry.dailyQuests.map((q) => {
              const pct = Math.min(100, Math.round((q.current / Math.max(1, q.target)) * 100));
              return (
                <div key={q.id} className="border border-[#202020] bg-[#080808] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-bold text-[#e0e0e0]">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 ${q.completed ? "text-[#00ff88]" : "text-[#444]"}`}
                      />
                      {locale === "zh" ? q.titleZh : q.titleEn}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#00d4ff]">
                      {q.current}/{q.target} · +{q.rewardXp}XP
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-[#151515]">
                    <div
                      className={`h-full transition-all ${q.completed ? "bg-[#00ff88]" : "bg-[#ff6a00]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="terminal-box p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-[#a855f7]">
            <Shield className="h-4 w-4" />
            {locale === "zh" ? "04 // 演奏家成就勋章墙 (BADGES)" : "04 // ACHIEVEMENT BADGES"}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-xs">
            {telemetry.badges.map((b) => (
              <div
                key={b.id}
                className={`border p-2.5 transition-all ${
                  b.unlocked
                    ? "border-[#00ff88]/50 bg-[#08150e]"
                    : "border-[#1f1f1f] bg-[#080808] opacity-55"
                }`}
              >
                <div
                  className="text-[11px] font-extrabold"
                  style={{ color: b.unlocked ? b.color : "#666" }}
                >
                  {b.unlocked ? "★ " : "○ "}
                  {locale === "zh" ? b.titleZh : b.titleEn}
                </div>
                <div className="mt-1 text-[10px] text-[#777]">
                  {locale === "zh" ? b.descZh : b.descEn}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5-Dimension Skill Profile & Ebbinghaus Spaced Repetition Review */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="terminal-box p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-[#00d4ff]">
            <TrendingUp className="h-4 w-4" />
            {locale === "zh" ? "05 // 五维钢琴技能评估 (SKILL TELEMETRY)" : "05 // 5-AXIS SKILL PROFILE"}
          </h2>
          <div className="space-y-3 text-xs">
            {telemetry.skillMetrics.map((m) => (
              <div key={m.id}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#e0e0e0]">
                    {locale === "zh" ? m.labelZh : m.labelEn}
                  </span>
                  <span style={{ color: m.color }}>
                    {m.value}/100 ({locale === "zh" ? m.detailZh : m.detailEn})
                  </span>
                </div>
                <div className="h-2.5 w-full border border-[#1d1d1d] bg-[#060606]">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.max(4, m.value)}%`, backgroundColor: m.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="terminal-box p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-[#00ff88]">
            <Brain className="h-4 w-4" />
            {locale === "zh"
              ? "06 // 艾宾浩斯遗忘曲线科学复习队列"
              : "06 // EBBINGHAUS SPACED REVIEW QUEUE"}
          </h2>

          {telemetry.reviewQueue.length === 0 ? (
            <div className="border border-[#1b1b1b] bg-[#080808] p-4 text-xs text-[#666]">
              {locale === "zh"
                ? "完成任意曲目练习后，系统将结合上次准确率与间隔天数估算记忆保持率并安排复习。"
                : "Complete a song run to compute spaced-repetition retention and review priority."}
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {telemetry.reviewQueue.map((item) => (
                <div
                  key={item.songId}
                  className="flex flex-wrap items-center justify-between gap-2 border border-[#202020] bg-[#080808] p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-[#e0e0e0]">
                      [{item.rank}] {item.songTitle}
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#777]">
                      {locale === "zh" ? item.reasonZh : item.reasonEn}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`border px-2 py-0.5 text-[10px] font-bold ${
                        item.retentionPct < 75
                          ? "border-[#ff6a00]/60 bg-[#211205] text-[#ff6a00]"
                          : "border-[#00ff88]/50 bg-[#081a10] text-[#00ff88]"
                      }`}
                    >
                      {locale === "zh" ? `记忆 ${item.retentionPct}%` : `RET ${item.retentionPct}%`}
                    </span>
                    <Link
                      href={`/arcade?song=${encodeURIComponent(item.songId)}`}
                      className="bg-[#ff6a00] px-2.5 py-1 text-[10px] font-bold text-[#0a0a0a] hover:bg-[#ff8533]"
                    >
                      {locale === "zh" ? "去复习" : "REVIEW"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {telemetry.nextRecommendedSong && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-[#00d4ff]/40 bg-[#07151c] p-2.5 text-xs">
              <div>
                <span className="text-[10px] font-bold text-[#00d4ff]">NEXT RECOMMENDED // </span>
                <span className="font-bold text-[#e0e0e0]">
                  {locale === "zh" && telemetry.nextRecommendedSong.titleZh
                    ? telemetry.nextRecommendedSong.titleZh
                    : telemetry.nextRecommendedSong.title}
                </span>
              </div>
              <Link
                href={`/arcade?song=${encodeURIComponent(telemetry.nextRecommendedSong.id)}`}
                className="bg-[#00d4ff] px-3 py-1 text-[10px] font-bold text-[#0a0a0a]"
              >
                &gt; PLAY
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Best Scores per Song */}
      <div className="mt-5 terminal-box p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#ff6a00]">
          <Award className="h-4 w-4" />
          {locale === "zh" ? "曲目最高战绩榜" : "SONG PERSONAL BESTS"}
        </h2>

        {bestList.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#666]">
            {locale === "zh"
              ? "还没有通关记录，快去「练琴街机」完成第一首曲子吧！"
              : "No scored runs yet. Complete a song in the Arcade!"}
            <div className="mt-3">
              <Link
                href="/arcade"
                className="pixel-border inline-block bg-[#ff6a00] px-4 py-1.5 text-xs font-bold text-[#0a0a0a]"
              >
                &gt; START ARCADE
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#222] text-[10px] text-[#555]">
                <tr>
                  <th className="py-2 pr-3">SONG</th>
                  <th className="py-2 pr-3">MODEL</th>
                  <th className="py-2 pr-3">RANK</th>
                  <th className="py-2 pr-3">SCORE</th>
                  <th className="py-2 pr-3">ACCURACY</th>
                  <th className="py-2 pr-3">MAX COMBO</th>
                </tr>
              </thead>
              <tbody>
                {bestList.map((r) => (
                  <tr key={r.id} className="border-b border-[#161616]">
                    <td className="py-2.5 pr-3 font-bold text-[#e0e0e0]">{r.songTitle}</td>
                    <td className="py-2.5 pr-3 text-[#00d4ff]">{r.model.toUpperCase()}</td>
                    <td className="py-2.5 pr-3 font-extrabold text-[#00ff88]">{r.rank}</td>
                    <td className="py-2.5 pr-3 text-[#ff6a00]">{r.score}</td>
                    <td className="py-2.5 pr-3">{r.accuracy}%</td>
                    <td className="py-2.5 pr-3">{r.maxCombo}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Session Log */}
      {effectiveStats.recentHistory.length > 0 && (
        <div className="mt-5 terminal-box p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#00d4ff]">
            <Clock className="h-4 w-4" />
            {locale === "zh" ? "最近练琴日志" : "RECENT PRACTICE LOG"}
          </h2>
          <div className="space-y-1.5 text-xs">
            {effectiveStats.recentHistory.slice(0, 10).map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-[#1a1a1a] bg-[#080808] px-3 py-2"
              >
                <span className="text-[#e0e0e0]">
                  [{h.mode.toUpperCase()}] {h.songTitle}
                </span>
                <span className="text-[#00ff88]">
                  RANK {h.rank} · {h.accuracy}% · +{h.xpEarned} XP
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SaveSyncPanel locale={locale} />
    </div>
  );
}
