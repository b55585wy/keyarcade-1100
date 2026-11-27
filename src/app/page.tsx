"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BootSequence } from "@/components/boot-sequence";
import { CdCollectionShelf } from "@/components/cd-collection-shelf";
import { useI18n } from "@/lib/i18n";
import { useWebMidi } from "@/hooks/use-web-midi";
import {
  getAcademyStats,
  getAllSongs,
  getStoredModel,
  setStoredModel,
  subscribeStore,
} from "@/lib/storage/academy-store";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import { midiToName } from "@/lib/music/theory";
import { playSfx } from "@/lib/sfx";
import type { Song, UserAcademyStats, YamahaModelId } from "@/types/music";
import {
  Music2,
  Gamepad2,
  Award,
  Usb,
  FileMusic,
  Flame,
  TrendingUp,
  Play,
  Mic,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  const { locale, t } = useI18n();
  const webMidi = useWebMidi({});
  const [model, setModel] = useState<YamahaModelId>("kbp1100");
  const [songs, setSongs] = useState<Song[]>([]);
  const [stats, setStats] = useState<UserAcademyStats | null>(null);

  useEffect(() => {
    const sync = () => {
      setModel(getStoredModel());
      setSongs(getAllSongs());
      setStats(getAcademyStats());
    };
    sync();
    return subscribeStore(sync);
  }, []);

  const profile = YAMAHA_PROFILES[model];
  const featuredSongs = songs.slice(0, 10);

  return (
    <>
      {/* Native Mobile Dashboard App Home (< md) */}
      <div className="space-y-5 px-3.5 py-4 md:hidden">
        {/* Hero Practice Card */}
        <section className="rounded-2xl border border-[#ff6a00]/30 bg-gradient-to-br from-[#1d120a] via-[#131318] to-[#0d111a] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ff6a00]/15 px-2.5 py-0.5 font-semibold text-[#ff8b33]">
              <Flame className="h-3.5 w-3.5" />
              {locale === "zh"
                ? `LV.${stats?.level ?? 1} · 连胜 ${stats?.streakDays ?? 0} 天`
                : `LV.${stats?.level ?? 1} · ${stats?.streakDays ?? 0}d Streak`}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${
                webMidi.devices.length > 0
                  ? "bg-[#00ff88]/15 text-[#00ff88]"
                  : !profile.hasMidiPort
                    ? "bg-[#a855f7]/15 text-[#c084fc]"
                    : "bg-white/10 text-[#b4b4c0]"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {webMidi.devices.length > 0
                ? "MIDI ON"
                : !profile.hasMidiPort
                  ? locale === "zh"
                    ? "MIC 听音就绪"
                    : "MIC Ready"
                  : locale === "zh"
                    ? "触屏 / MIDI 就绪"
                    : "Touch Ready"}
            </span>
          </div>

          <div className="mt-3.5">
            <div className="text-[11px] font-medium text-[#9898a6]">{profile.name}</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-white">
              {locale === "zh" ? "准备好了，开始今日练琴" : "Ready for Today’s Session"}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-[#9898a6]">
              {locale === "zh"
                ? "跟弹等待零基础上手 · 瀑布流街机连击 · 自动双谱实时对照"
                : "Wait-for-Note guidance, falling notes arcade & live dual sheet music"}
            </p>
          </div>

          <Link
            href="/arcade"
            onClick={() => playSfx("navigate")}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6a00] text-sm font-bold text-[#0a0a0a] shadow-[0_6px_20px_rgba(255,106,0,0.35)] transition-transform active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-current" />
            {locale === "zh" ? "立即进入沉浸练琴" : "Start Arcade Practice"}
          </Link>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <Link
              href="/import"
              onClick={() => playSfx("navigate")}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-[#e6e6ec] active:bg-white/10"
            >
              <Mic className="h-3.5 w-3.5 text-[#00ff88]" />
              {locale === "zh" ? "哼唱 / AI 扒谱" : "Hum & AI Score"}
            </Link>
            <Link
              href="/drills"
              onClick={() => playSfx("navigate")}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-[#e6e6ec] active:bg-white/10"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#00d4ff]" />
              {locale === "zh" ? "和弦道场特训" : "Chord Dojo"}
            </Link>
          </div>
        </section>

        {/* Compact Progress Stats Strip */}
        <Link
          href="/rank"
          className="grid grid-cols-3 gap-2.5 rounded-2xl border border-white/10 bg-[#121217] p-3 active:bg-[#181820]"
        >
          <div className="text-center">
            <div className="text-base font-bold text-[#00ff88]">{stats?.totalXp ?? 120}</div>
            <div className="mt-0.5 text-[10px] text-[#8a8a98]">
              {locale === "zh" ? "总经验 XP" : "Total XP"}
            </div>
          </div>
          <div className="border-x border-white/10 text-center">
            <div className="text-base font-bold text-[#ff6a00]">
              {stats?.songsCleared.length ?? 0}
            </div>
            <div className="mt-0.5 text-[10px] text-[#8a8a98]">
              {locale === "zh" ? "已通关曲目" : "Cleared"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-[#00d4ff]">{songs.length}</div>
            <div className="mt-0.5 text-[10px] text-[#8a8a98]">
              {locale === "zh" ? "曲库总曲目" : "Song Bank"}
            </div>
          </div>
        </Link>

        {/* Horizontal Song Carousel */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              {locale === "zh" ? "推荐练琴曲目" : "Quick Pick Songs"}
            </h2>
            <Link
              href="/scores"
              className="flex items-center gap-0.5 text-xs font-medium text-[#ff6a00]"
            >
              {locale === "zh" ? "全部曲谱" : "All"}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
            {featuredSongs.map((s) => (
              <Link
                key={s.id}
                href={`/arcade?song=${s.id}`}
                onClick={() => playSfx("navigate")}
                className="flex w-40 shrink-0 flex-col justify-between rounded-2xl border border-white/10 bg-[#131319] p-3.5 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="rounded-md bg-[#ff6a00]/15 px-1.5 py-0.5 font-bold text-[#ff8b33]">
                    Lv.{s.difficulty}
                  </span>
                  <span className="text-[#8a8a98]">{s.bpm} BPM</span>
                </div>
                <div className="mt-3">
                  <div className="line-clamp-1 text-sm font-bold text-white">
                    {locale === "zh" && s.titleZh ? s.titleZh : s.title}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-[#7a7a88]">
                    {s.keySignature} · {s.composer}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[#00ff88]">
                  <Play className="h-3 w-3 fill-current" />
                  {locale === "zh" ? "立即练习" : "Play"}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Quick Hardware Model Pills */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              {locale === "zh" ? "我的琴型" : "Keyboard Profile"}
            </h2>
            <span className="text-[11px] text-[#8a8a98]">
              {profile.keys}K · {midiToName(profile.minMidi)}–{midiToName(profile.maxMidi)}
            </span>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {(["kbp1100", "psr1100", "pxs1100", "wk1100", "ctk1100"] as const).map((id) => {
              const p = YAMAHA_PROFILES[id];
              const active = model === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setStoredModel(id);
                    playSfx("key");
                  }}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-[#ff6a00] bg-[#1e140c] text-white"
                      : "border-white/10 bg-[#121217] text-[#9898a6]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span
                      className={p.brand === "CASIO" ? "text-[#00d4ff]" : "text-[#ff6a00]"}
                    >
                      {p.brand}
                    </span>
                    <span>{p.shortName}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#7a7a88]">
                    {p.keys}键 {p.hasMidiPort ? "· MIDI" : "· MIC听音"}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Compact Progress Telemetry Link Card */}
        <Link
          href="/rank"
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#121217] p-4 active:bg-[#181820]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a855f7]/15 text-[#c084fc]">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-white">
                {locale === "zh" ? "学习进度曲线 & 成长档案" : "Learning Curve & Stats"}
              </div>
              <div className="text-[11px] text-[#8a8a98]">
                {locale === "zh"
                  ? "查看练习曲线、准确率雷达与每日成就"
                  : "Track XP trend, accuracy & streaks"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[#7a7a88]" />
        </Link>
      </div>

      {/* Desktop Terminal Landing Page (md:+) */}
      <div className="mx-auto hidden max-w-5xl px-4 py-10 font-mono md:block">
        <BootSequence
          midiReady={webMidi.status === "ready"}
          deviceCount={webMidi.devices.length}
          modelLabel={profile.shortName}
        />

      {/* Hero Terminal Box (signature agent-coding style) */}
      <div className="terminal-box relative p-5 text-center sm:p-8">
        <div className="mb-4 inline-block bg-[#ff6a00] px-3 py-1 text-xs font-bold text-[#0a0a0a]">
          {t("hero.badge")}
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-5xl">
          <span className="text-[#e0e0e0]">{t("hero.line1")}</span>
          <br />
          <span className="text-[#ff6a00] glow-orange cursor-blink">{t("hero.line2")}</span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-xs leading-relaxed text-[#888] sm:mt-6 sm:text-sm">
          {t("hero.sub1")}
          <br />
          {t("hero.sub2")}
        </p>

        <p className="mt-3 text-[11px] text-[#a855f7] sm:text-xs">
          &gt; {t("hero.tagline")}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-8 sm:gap-4">
          <Link
            href="/arcade"
            className="pixel-border bg-[#ff6a00] px-6 py-2.5 text-sm font-bold text-[#0a0a0a] transition-colors hover:bg-[#ff8a33]"
          >
            &gt; {t("cta.arcade")}
          </Link>
          <Link
            href="/import"
            className="pixel-border bg-[#111] px-6 py-2.5 text-sm font-bold text-[#00ff88] transition-colors hover:border-[#00ff88]"
          >
            &gt; {t("cta.import")}
          </Link>
          <Link
            href="/scores"
            className="pixel-border bg-[#111] px-6 py-2.5 text-sm text-[#888] transition-colors hover:border-[#00d4ff] hover:text-[#00d4ff]"
          >
            &gt; {t("cta.scores")}
          </Link>
        </div>
      </div>

      {/* 3-Step Workflow */}
      <div className="mt-6 terminal-box p-4 sm:mt-8 sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-bold tracking-wider text-[#ff6a00]">
            {t("how.heading")}
          </h2>
          <div className="mt-1 text-xs text-[#555]">$ yamaha-1100 --workflow</div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            {
              step: "01",
              cmd: "connect-midi",
              title: t("how.01.title"),
              hint: t("how.01.hint"),
              color: "#00ff88",
              Icon: Usb,
            },
            {
              step: "02",
              cmd: "gen-score",
              title: t("how.02.title"),
              hint: t("how.02.hint"),
              color: "#00d4ff",
              Icon: FileMusic,
            },
            {
              step: "03",
              cmd: "play-arcade",
              title: t("how.03.title"),
              hint: t("how.03.hint"),
              color: "#ff6a00",
              Icon: Gamepad2,
            },
          ].map(({ step, cmd, title, hint, color, Icon }) => (
            <div key={step} className="terminal-box hover-glow p-4 transition-all">
              <div className="flex items-start justify-between">
                <span className="text-xs text-[#555]">$ yamaha {cmd}</span>
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <div className="mt-3 mb-1 text-2xl font-bold" style={{ color }}>
                [{step}]
              </div>
              <h3 className="text-sm font-bold text-[#e0e0e0]">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#666]">&gt; {hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hardware Profiles Comparison: Yamaha 1100 & Casio 1100 */}
      <div className="mt-6 terminal-box p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold tracking-wider text-[#ff6a00]">
              {locale === "zh"
                ? "## YAMAHA & CASIO 1100 硬件全适配"
                : "## YAMAHA & CASIO 1100 HARDWARE PROFILES"}
            </h2>
            <div className="mt-1 text-xs text-[#555]">
              $ keyarcade --detect-hardware --yamaha --casio
            </div>
          </div>
          <span className="border border-[#222] bg-[#080808] px-2.5 py-1 text-[11px] text-[#00ff88]">
            {webMidi.devices.length > 0
              ? `MIDI ONLINE: ${webMidi.devices[0].name}`
              : locale === "zh"
                ? "点击卡片切换默认琴型 · 支持 USB/蓝牙 MIDI 与无 MIDI 口麦克风听音"
                : "Click a model to switch · Supports USB/BLE MIDI + Mic Pitch for CTK-1100"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(["kbp1100", "psr1100", "pxs1100", "wk1100", "ctk1100"] as const).map((id) => {
            const p = YAMAHA_PROFILES[id];
            const active = model === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setStoredModel(id);
                  playSfx("key");
                }}
                className={`border p-4 text-left transition-all ${
                  active
                    ? "border-[#ff6a00] bg-[#14100c] shadow-[4px_4px_0_#222]"
                    : "border-[#222] bg-[#0c0c0c] hover:border-[#444]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-extrabold ${
                        p.brand === "CASIO"
                          ? "bg-[#00d4ff] text-[#0a0a0a]"
                          : "bg-[#ff6a00] text-[#0a0a0a]"
                      }`}
                    >
                      {p.brand}
                    </span>
                    <span className="text-sm font-bold text-[#e0e0e0]">{p.shortName}</span>
                  </div>
                  <span className="border border-[#333] bg-[#080808] px-2 py-0.5 text-[10px] text-[#00d4ff]">
                    {p.keys}K · {midiToName(p.minMidi)}–{midiToName(p.maxMidi)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#888]">
                  {locale === "zh" ? p.actionDescZh : p.actionDescEn}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                  <span className={p.hasMidiPort ? "text-[#00ff88]" : "text-[#a855f7]"}>
                    {p.hasMidiPort ? "MIDI:" : "AUDIO/CAM:"}{" "}
                    {locale === "zh" ? p.midiPortDescZh : p.midiPortDescEn}
                  </span>
                  {active && (
                    <span className="shrink-0 bg-[#00ff88] px-1.5 py-0.5 text-[9px] font-bold text-[#0a0a0a]">
                      ACTIVE
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CD Album Collection Shelf */}
      <CdCollectionShelf songs={songs} locale={locale} />

      {/* Telemetry Stats Strip + Link to Learning Curve */}
      <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div className="terminal-box p-4">
          <div className="flex justify-center text-[#00ff88] mb-1">
            <Award className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-[#00ff88]">LV.{stats?.level ?? 1}</div>
          <div className="mt-1 text-[10px] text-[#555]">PLAYER_LEVEL ({stats?.totalXp ?? 0} XP)</div>
        </div>
        <div className="terminal-box p-4">
          <div className="flex justify-center text-[#ff6a00] mb-1">
            <Flame className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-[#ff6a00]">{stats?.streakDays ?? 0}d</div>
          <div className="mt-1 text-[10px] text-[#555]">DAILY_STREAK</div>
        </div>
        <div className="terminal-box p-4">
          <div className="flex justify-center text-[#00d4ff] mb-1">
            <Music2 className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-[#00d4ff]">{songs.length}</div>
          <div className="mt-1 text-[10px] text-[#555]">SONGS_IN_BANK</div>
        </div>
          <Link href="/rank" className="terminal-box hover-glow block p-4">
          <div className="flex justify-center text-[#a855f7] mb-1">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-[#a855f7]">{stats?.songsCleared.length ?? 0} CLEAR</div>
          <div className="mt-1 text-[10px] text-[#00d4ff]">
            &gt; {locale === "zh" ? "查看学习进度曲线" : "LEARNING CURVE"}
          </div>
        </Link>
      </div>
      </div>
    </>
  );
}
