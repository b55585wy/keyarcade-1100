"use client";

import Link from "next/link";
import { Lock, Star, Sparkles, Unlock, Play, Volume2 } from "lucide-react";
import type { SynthVoiceId, UserAcademyStats } from "@/types/music";
import { evaluateCampaignProgress } from "@/lib/music/campaign-stages";
import { SYNTH_VOICES } from "@/lib/music/yamaha-profiles";
import { audioEngine } from "@/lib/music/audio-engine";
import { unlockSandboxVoices } from "@/lib/storage/academy-store";
import { playSfx } from "@/lib/sfx";

interface QuestMapPanelProps {
  stats: UserAcademyStats;
  locale: "zh" | "en";
}

export function QuestMapPanel({ stats, locale }: QuestMapPanelProps) {
  const campaign = evaluateCampaignProgress(stats);
  const unlockedSet = new Set<SynthVoiceId>(campaign.unlockedVoices);
  const allVoicesUnlocked = SYNTH_VOICES.every((v) => unlockedSet.has(v.id));

  const handleAuditionVoice = (voiceId: SynthVoiceId) => {
    const prev = audioEngine.getVoice();
    audioEngine.setVoice(voiceId);
    [60, 64, 67, 72].forEach((m, i) => {
      window.setTimeout(() => {
        audioEngine.noteOn(m, 92);
        window.setTimeout(() => audioEngine.noteOff(m), 380);
      }, i * 110);
    });
    window.setTimeout(() => audioEngine.setVoice(prev), 950);
  };

  return (
    <div className="space-y-4">
      {/* RPG Quest Progression Map */}
      <div className="terminal-box p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#1d1d1d] pb-2.5">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#ff6a00]">
              <Sparkles className="h-4 w-4" />
              {locale === "zh"
                ? "01 // RPG 段位闯关地图与宝箱解锁"
                : "01 // RPG QUEST PROGRESSION MAP"}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#777]">
              {locale === "zh"
                ? `已攻克 ${campaign.clearedCount}/${campaign.stages.length} 关 · 总星数 ${campaign.totalStars}/${campaign.stages.length * 3} ★`
                : `Cleared ${campaign.clearedCount}/${campaign.stages.length} stages · ${campaign.totalStars} ★`}
            </p>
          </div>
          <Link
            href={`/arcade?song=${encodeURIComponent(campaign.currentFrontierStage.stage.songId)}`}
            className="flex items-center gap-1 bg-[#ff6a00] px-3 py-1.5 font-mono text-[11px] font-bold text-[#0a0a0a]"
          >
            <Play className="h-3 w-3 fill-current" />
            {locale === "zh"
              ? `挑战 ${campaign.currentFrontierStage.stage.stageCode}`
              : `PLAY ${campaign.currentFrontierStage.stage.stageCode}`}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {campaign.stages.map((item) => {
            const st = item.stage;
            const voiceMeta = st.unlockVoice
              ? SYNTH_VOICES.find((v) => v.id === st.unlockVoice)
              : null;

            return (
              <div
                key={st.id}
                className={`border p-3 transition-all ${
                  item.cleared
                    ? "border-[#00ff88]/50 bg-[#081710]"
                    : item.unlocked
                      ? "border-[#ff6a00]/60 bg-[#150e09]"
                      : "border-[#1f1f1f] bg-[#08080a] opacity-70"
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span
                    className="rounded px-1.5 py-0.5 font-bold"
                    style={{
                      backgroundColor: `${st.accent}22`,
                      color: st.accent,
                    }}
                  >
                    STAGE {st.stageCode}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n <= item.stars
                            ? "fill-[#f59e0b] text-[#f59e0b]"
                            : "text-[#333]"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-2 text-xs font-bold text-white">
                  {locale === "zh" ? st.titleZh : st.titleEn}
                </div>
                <div className="mt-0.5 text-[10px] text-[#8a8a98]">
                  {locale === "zh" ? st.chapterTitleZh : st.chapterTitleEn} · TARGET ≥ {st.targetAcc}%
                </div>

                {voiceMeta && (
                  <div className="mt-2 flex items-center gap-1.5 border border-[#a855f7]/40 bg-[#170c24] px-2 py-1 text-[10px] text-[#d8b4fe]">
                    <Sparkles className="h-3 w-3 shrink-0" />
                    <span>
                      {locale === "zh" ? `解锁音色: ${voiceMeta.labelZh}` : `Reward: ${voiceMeta.labelEn}`}
                    </span>
                  </div>
                )}

                <div className="mt-2.5 flex items-center justify-between font-mono text-[10px]">
                  <span className="text-[#888]">
                    {item.bestAccuracy > 0
                      ? `BEST ${item.bestAccuracy}% (${item.bestRank ?? "-"})`
                      : `+${st.rewardXp} XP`}
                  </span>
                  {item.unlocked ? (
                    <Link
                      href={`/arcade?song=${encodeURIComponent(st.songId)}`}
                      className="bg-[#ff6a00] px-2.5 py-1 font-bold text-[#0a0a0a] hover:bg-[#ff8533]"
                    >
                      {item.cleared
                        ? locale === "zh"
                          ? "重刷冲星"
                          : "REPLAY"
                        : locale === "zh"
                          ? "出战"
                          : "CHALLENGE"}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 text-[#666]">
                      <Lock className="h-3 w-3" /> {locale === "zh" ? "未解锁" : "LOCKED"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Synth Voice Vault */}
      <div className="terminal-box p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#a855f7]">
              <Volume2 className="h-4 w-4" />
              {locale === "zh"
                ? "02 // WebAudio 隐藏合成器音色收藏柜"
                : "02 // UNLOCKABLE SYNTH VOICE VAULT"}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#777]">
              {locale === "zh"
                ? `已解锁 ${campaign.unlockedVoices.length}/${SYNTH_VOICES.length} 款高保真合成器音色`
                : `${campaign.unlockedVoices.length}/${SYNTH_VOICES.length} voices unlocked`}
            </p>
          </div>
          {!allVoicesUnlocked && (
            <button
              type="button"
              onClick={() => {
                unlockSandboxVoices();
                playSfx("powerup");
              }}
              className="flex items-center gap-1.5 border border-[#a855f7]/50 bg-[#1a0d29] px-3 py-1.5 font-mono text-[11px] font-bold text-[#d8b4fe] hover:bg-[#281340]"
            >
              <Unlock className="h-3.5 w-3.5" />
              {locale === "zh" ? "沙盒抢先解锁全部音色" : "UNLOCK ALL (SANDBOX)"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SYNTH_VOICES.map((v) => {
            const isUnlocked = unlockedSet.has(v.id);
            return (
              <div
                key={v.id}
                className={`border p-2.5 text-xs ${
                  isUnlocked
                    ? "border-[#00d4ff]/40 bg-[#08131a]"
                    : "border-[#222] bg-[#0a0a0c] opacity-75"
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-[#00d4ff]">{v.yamahaBank}</span>
                  <span className={isUnlocked ? "text-[#00ff88]" : "text-[#888]"}>
                    {isUnlocked ? "READY" : "LOCKED"}
                  </span>
                </div>
                <div className="mt-1 font-bold text-white">
                  {locale === "zh" ? v.labelZh : v.labelEn}
                </div>
                <div className="mt-1 text-[10px] text-[#7a7a88]">
                  {isUnlocked
                    ? locale === "zh"
                      ? "点击试听 C 大调琶音"
                      : "Click to audition chord"
                    : locale === "zh"
                      ? v.unlockHintZh
                      : v.unlockHintEn}
                </div>
                <button
                  type="button"
                  onClick={() => handleAuditionVoice(v.id)}
                  className="mt-2 w-full border border-white/15 bg-black/40 py-1 font-mono text-[10px] font-bold text-[#e0e0e0] hover:border-[#00d4ff]"
                >
                  ▶ {locale === "zh" ? "试听音色" : "AUDITION"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
