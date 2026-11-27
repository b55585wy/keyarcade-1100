"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Trophy, Clock, Flame } from "lucide-react";
import { getAcademyStats, subscribeStore } from "@/lib/storage/academy-store";
import type { UserAcademyStats } from "@/types/music";
import { useI18n } from "@/lib/i18n";

export default function RankPage() {
  const { locale } = useI18n();
  const [stats, setStats] = useState<UserAcademyStats | null>(null);

  useEffect(() => {
    const sync = () => setStats(getAcademyStats());
    sync();
    return subscribeStore(sync);
  }, []);

  if (!stats) return null;

  const currentLvlFloor = Math.pow(stats.level - 1, 2) * 100;
  const nextLvlXp = Math.pow(stats.level, 2) * 100;
  const progressPct = Math.min(
    100,
    Math.max(4, Math.round(((stats.totalXp - currentLvlFloor) / Math.max(1, nextLvlXp - currentLvlFloor)) * 100)),
  );

  const bestList = Object.values(stats.bestScores).sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 font-mono sm:px-4">
      {/* Player Level Card */}
      <div className="terminal-box p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] tracking-widest text-[#ff6a00]">PLAYER://PROFILE_TELEMETRY</div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#e0e0e0]">
              LV.{String(stats.level).padStart(2, "0")} YAMAHA PERFORMER
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="border border-[#222] bg-[#080808] px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] text-[#00ff88]">
                <Flame className="h-3 w-3" /> XP
              </div>
              <div className="text-lg font-bold text-[#00ff88]">{stats.totalXp}</div>
            </div>
            <div className="border border-[#222] bg-[#080808] px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] text-[#00d4ff]">
                <Trophy className="h-3 w-3" /> CLEARED
              </div>
              <div className="text-lg font-bold text-[#00d4ff]">{stats.songsCleared.length}</div>
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[10px] text-[#666]">
            <span>PROGRESS TO LV.{stats.level + 1}</span>
            <span>
              {stats.totalXp} / {nextLvlXp} XP
            </span>
          </div>
          <div className="h-3 w-full border border-[#242424] bg-[#060606]">
            <div
              className="h-full bg-[#ff6a00] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Best Scores per Song */}
      <div className="mt-6 terminal-box p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#ff6a00]">
          <Award className="h-4 w-4" />
          {locale === "zh" ? "曲目最高战绩榜" : "SONG PERSONAL BESTS"}
        </h2>

        {bestList.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#666]">
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
      {stats.recentHistory.length > 0 && (
        <div className="mt-6 terminal-box p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#00d4ff]">
            <Clock className="h-4 w-4" />
            {locale === "zh" ? "最近练琴日志" : "RECENT PRACTICE LOG"}
          </h2>
          <div className="space-y-1.5 text-xs">
            {stats.recentHistory.slice(0, 10).map((h) => (
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
    </div>
  );
}
