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
  Flame,
  TrendingUp,
  Play,
  Mic,
  ChevronRight,
  Sparkles,
  Camera,
  Keyboard,
  Terminal,
  Lightbulb,
} from "lucide-react";

export default function HomePage() {
  const { locale } = useI18n();
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

          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <Link
              href="/arcade?mode=free"
              onClick={() => playSfx("navigate")}
              className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold text-[#e6e6ec] active:bg-white/10"
            >
              <Keyboard className="h-3.5 w-3.5 text-[#00ff88]" />
              {locale === "zh" ? "自由大键" : "Free Play"}
            </Link>
            <Link
              href="/arcade?cam=1"
              onClick={() => playSfx("navigate")}
              className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[#00d4ff]/30 bg-[#071820] text-[11px] font-semibold text-[#7dd3fc] active:bg-[#0d2836]"
            >
              <Camera className="h-3.5 w-3.5 text-[#00d4ff]" />
              {locale === "zh" ? "AR 桌面琴" : "AR Piano"}
            </Link>
            <Link
              href="/import"
              onClick={() => playSfx("navigate")}
              className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold text-[#e6e6ec] active:bg-white/10"
            >
              <Mic className="h-3.5 w-3.5 text-[#ff8b33]" />
              {locale === "zh" ? "哼唱扒谱" : "Hum Score"}
            </Link>
          </div>

          <Link
            href="/drills"
            onClick={() => playSfx("navigate")}
            className="mt-2 flex h-9 items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[11px] text-[#b4b4c2] active:bg-white/10"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-[#a855f7]" />
              {locale === "zh" ? "和弦道场 & 视奏特训" : "Chord Dojo & Sight-Reading"}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-[#666]" />
          </Link>
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

        {/* Retrofit Hardware Accessory Kit Card */}
        <Link
          href="/hardware"
          className="flex items-center justify-between rounded-2xl border border-[#ff6a00]/25 bg-[#16100b] p-4 active:bg-[#1e150e]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6a00]/15 text-[#ff8b33]">
              <Lightbulb className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-white">
                {locale === "zh" ? "旧琴灯条 & 可打印 AR 琴垫" : "KeyBar LED & AR Desk Mat"}
              </div>
              <div className="text-[11px] text-[#9898a6]">
                {locale === "zh"
                  ? "ESP32 外挂灯条蓝牙配对 · 1:1 桌面琴垫矢量打印"
                  : "USB/BLE LED strip sync & printable 1:1 desk mat"}
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[#7a7a88]" />
        </Link>
      </div>

      {/* Two-Column Interactive Studio Desktop Homepage (md:+) */}
      <div className="mx-auto hidden max-w-7xl px-4 py-6 md:block">
        {/* Top Interactive Workbench */}
        <div className="grid grid-cols-12 items-stretch gap-5">
          {/* Left: Hero Action & Quick Launchpad */}
          <section className="col-span-12 flex flex-col justify-between rounded-2xl border border-[#ff6a00]/30 bg-gradient-to-br from-[#1d120a] via-[#121218] to-[#0d111a] p-6 shadow-xl lg:col-span-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6a00]/15 px-3 py-1 font-semibold text-[#ff8b33]">
                  <Flame className="h-3.5 w-3.5" />
                  {locale === "zh"
                    ? `LV.${stats?.level ?? 1} · 连胜 ${stats?.streakDays ?? 0} 天`
                    : `LV.${stats?.level ?? 1} · ${stats?.streakDays ?? 0}d Streak`}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
                    webMidi.devices.length > 0
                      ? "bg-[#00ff88]/15 text-[#00ff88]"
                      : !profile.hasMidiPort
                        ? "bg-[#a855f7]/15 text-[#c084fc]"
                        : "bg-white/10 text-[#b4b4c2]"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {webMidi.devices.length > 0
                    ? `MIDI: ${webMidi.devices[0].name.slice(0, 14)}`
                    : !profile.hasMidiPort
                      ? locale === "zh"
                        ? "MIC 听音就绪"
                        : "MIC Ready"
                      : locale === "zh"
                        ? "MIDI / 键盘就绪"
                        : "MIDI / Keys Ready"}
                </span>
              </div>

              <div className="mt-4">
                <div className="font-mono text-xs text-[#8a8a98]">{profile.name}</div>
                <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white xl:text-3xl">
                  {locale === "zh"
                    ? "接上 1100 电子琴，像玩街机一样练琴"
                    : "Plug In Your 1100, Play Like An Arcade."}
                </h1>
                <p className="mt-2 text-xs leading-relaxed text-[#9898a6] sm:text-sm">
                  {locale === "zh"
                    ? "支持跟弹等待零基础上手、瀑布流连击评分，五线谱/简谱同步对照，无 MIDI 口琴型也能麦克风与 AR 摄像头判音。"
                    : "Wait-for-Note coaching, falling-note combos, live dual sheet music, Mic Pitch & AR Desk Piano."}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <Link
                href="/arcade"
                onClick={() => playSfx("navigate")}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6a00] text-sm font-bold text-[#0a0a0a] shadow-[0_6px_22px_rgba(255,106,0,0.3)] transition-all hover:bg-[#ff8533]"
              >
                <Play className="h-4 w-4 fill-current" />
                {locale === "zh" ? "立即进入练琴街机 (跟弹 / 瀑布流)" : "Launch Arcade Studio"}
              </Link>

              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href="/arcade?mode=free"
                  onClick={() => playSfx("navigate")}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-[#e6e6f0] transition-colors hover:border-[#00ff88]/50 hover:text-[#00ff88]"
                >
                  <Keyboard className="h-3.5 w-3.5 text-[#00ff88]" />
                  {locale === "zh" ? "自由弹 & 伴奏垫" : "Free Play & Chords"}
                </Link>
                <Link
                  href="/arcade?cam=1"
                  onClick={() => playSfx("navigate")}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#00d4ff]/30 bg-[#071820] text-xs font-semibold text-[#7dd3fc] transition-colors hover:border-[#00d4ff]"
                >
                  <Camera className="h-3.5 w-3.5 text-[#00d4ff]" />
                  {locale === "zh" ? "AR 摄像头桌面琴" : "AR Desk Piano"}
                </Link>
                <Link
                  href="/import"
                  onClick={() => playSfx("navigate")}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-[#e6e6f0] transition-colors hover:border-[#ff8b33]/50"
                >
                  <Mic className="h-3.5 w-3.5 text-[#ff8b33]" />
                  {locale === "zh" ? "哼唱 / AI 扒谱" : "Hum & AI Score"}
                </Link>
                <Link
                  href="/drills"
                  onClick={() => playSfx("navigate")}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-[#e6e6f0] transition-colors hover:border-[#a855f7]/50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#a855f7]" />
                  {locale === "zh" ? "和弦道场 & 视奏" : "Chord Dojo"}
                </Link>
              </div>
            </div>
          </section>

          {/* Right: Curated Song Picks + Instant 1100 Hardware Bar */}
          <section className="col-span-12 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#101017] p-5 lg:col-span-7">
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {locale === "zh" ? "快速选曲 · 一键开始练习" : "Quick-Pick Songs"}
                  </h2>
                  <p className="text-xs text-[#8a8a98]">
                    {locale === "zh"
                      ? `内置 ${songs.length} 首曲目（含卡西欧 1100 典藏曲库与自定义导入）`
                      : `${songs.length} built-in & imported songs`}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Link
                    href="/rank"
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-medium text-[#c084fc] hover:border-[#a855f7]/50"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    {locale === "zh" ? "学习曲线" : "Progress"}
                  </Link>
                  <Link
                    href="/scores"
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-medium text-[#00d4ff] hover:border-[#00d4ff]/50"
                  >
                    {locale === "zh" ? "全部双谱" : "All Scores"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
                {featuredSongs.slice(0, 6).map((s) => (
                  <Link
                    key={s.id}
                    href={`/arcade?song=${encodeURIComponent(s.id)}`}
                    onClick={() => playSfx("navigate")}
                    className="group flex flex-col justify-between rounded-xl border border-white/10 bg-[#15151e] p-3.5 transition-all hover:border-[#ff6a00]/60 hover:bg-[#1a1612]"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="rounded bg-[#ff6a00]/15 px-1.5 py-0.5 font-bold text-[#ff8b33]">
                        Lv.{s.difficulty}
                      </span>
                      <span className="text-[#8a8a98]">
                        {s.keySignature} · {s.bpm} BPM
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <div className="truncate text-sm font-bold text-white group-hover:text-[#ff8b33]">
                        {locale === "zh" && s.titleZh ? s.titleZh : s.title}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[#7a7a88]">{s.composer}</div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-[#00ff88]">
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3 fill-current" />
                        {locale === "zh" ? "进入练琴" : "Practice"}
                      </span>
                      <span className="font-mono text-[10px] text-[#666]">{s.notes.length} notes</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Compact Hardware Selector Strip */}
            <div className="mt-4 border-t border-white/10 pt-3.5">
              <div className="mb-2 flex items-center justify-between text-[11px] text-[#8a8a98]">
                <span className="font-semibold text-[#d0d0dc]">
                  {locale === "zh" ? "一键切换匹配琴型 (Yamaha & Casio 1100)" : "Keyboard Profile"}
                </span>
                <span className="font-mono text-[#00ff88]">
                  {profile.shortName} · {profile.keys}K ({midiToName(profile.minMidi)}–{midiToName(profile.maxMidi)})
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
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
                      className={`rounded-xl border px-2.5 py-2 text-left transition-all ${
                        active
                          ? "border-[#ff6a00] bg-[#1e140c] shadow-[0_0_16px_rgba(255,106,0,0.18)]"
                          : "border-white/10 bg-[#14141c] hover:border-white/25"
                      }`}
                      title={locale === "zh" ? p.actionDescZh : p.actionDescEn}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                        <span className={p.brand === "CASIO" ? "text-[#00d4ff]" : "text-[#ff6a00]"}>
                          {p.brand}
                        </span>
                        <span className="font-mono text-[#7a7a88]">{p.keys}K</span>
                      </div>
                      <div className="mt-0.5 truncate text-xs font-bold text-white">{p.shortName}</div>
                      <div className="mt-0.5 truncate text-[9px] text-[#8a8a98]">
                        {p.hasMidiPort ? "MIDI" : "MIC / CAM"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* CD Album Collection Shelf */}
        <CdCollectionShelf songs={songs} locale={locale} />

        {/* Retrofit Hardware Banner */}
        <Link
          href="/hardware"
          className="mt-5 flex items-center justify-between rounded-2xl border border-[#ff6a00]/30 bg-gradient-to-r from-[#1b120b] via-[#121218] to-[#0a161c] p-4 transition-colors hover:border-[#ff6a00]"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff6a00]/15 text-[#ff8b33]">
              <Lightbulb className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-white">
                {locale === "zh"
                  ? "旧琴智能化改造硬件中心 · 外挂 LED 跟弹灯条 & 可打印 1:1 AR 桌面琴垫"
                  : "Retrofit Hardware Lab · ESP32 LED KeyBar & 1:1 Printable AR Desk Mat"}
              </div>
              <div className="mt-0.5 text-xs text-[#9898a6]">
                {locale === "zh"
                  ? "无需重金换整琴：支持 USB 串口 / BLE 蓝牙实时跟灯，以及一键导出给桌垫厂打印的 300DPI AR 琴垫矢量图纸"
                  : "Connect USB/BLE WS2812B LED strip above any legacy piano or print calibrated 1:1 AR desk mats"}
              </div>
            </div>
          </div>
          <span className="shrink-0 rounded-xl bg-[#ff6a00] px-3.5 py-2 text-xs font-bold text-[#0a0a0a]">
            {locale === "zh" ? "进入硬件中心 →" : "Open Gear Lab →"}
          </span>
        </Link>

        {/* Telemetry Summary & Collapsible Geek Terminal Diagnostics */}
        <div className="mt-6 grid grid-cols-4 gap-3 text-center">
          <div className="terminal-box p-3.5">
            <div className="font-mono text-lg font-bold text-[#00ff88]">LV.{stats?.level ?? 1}</div>
            <div className="mt-0.5 text-xs text-[#8a8a98]">
              {locale === "zh" ? `累计 ${stats?.totalXp ?? 0} 经验值` : `${stats?.totalXp ?? 0} XP`}
            </div>
          </div>
          <div className="terminal-box p-3.5">
            <div className="font-mono text-lg font-bold text-[#ff6a00]">{stats?.streakDays ?? 0}d</div>
            <div className="mt-0.5 text-xs text-[#8a8a98]">
              {locale === "zh" ? "连续练琴打卡" : "Daily Streak"}
            </div>
          </div>
          <div className="terminal-box flex flex-col items-center justify-center p-3.5">
            <div className="flex items-center gap-1.5 font-mono text-lg font-bold text-[#00d4ff]">
              <Music2 className="h-4 w-4" />
              {songs.length}
            </div>
            <div className="mt-0.5 text-xs text-[#8a8a98]">
              {locale === "zh" ? "内置 + 自定义曲库" : "Songs Ready"}
            </div>
          </div>
          <Link href="/rank" className="terminal-box hover-glow flex flex-col items-center justify-center p-3.5">
            <div className="font-mono text-lg font-bold text-[#c084fc]">
              {stats?.songsCleared.length ?? 0} CLEAR
            </div>
            <div className="mt-0.5 text-xs font-semibold text-[#00d4ff]">
              {locale === "zh" ? "查看科学成长曲线 →" : "Learning Curve →"}
            </div>
          </Link>
        </div>

        <details className="mt-5 rounded-2xl border border-white/10 bg-[#0d0d13] px-4 py-3 text-xs text-[#8a8a98]">
          <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[11px] font-semibold text-[#9a9aa8] hover:text-white">
            <span className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-[#ff6a00]" />
              {locale === "zh"
                ? "极客系统自检终端 & 1100 硬件接口明细（点击展开）"
                : "Geek Boot Telemetry & 1100 Hardware Diagnostics"}
            </span>
            <span className="text-[#666]">[{profile.shortName}]</span>
          </summary>
          <div className="mt-3 font-mono">
            <BootSequence
              midiReady={webMidi.status === "ready"}
              deviceCount={webMidi.devices.length}
              modelLabel={profile.shortName}
            />
          </div>
        </details>
      </div>
    </>
  );
}
