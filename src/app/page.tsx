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
import { Music2, Gamepad2, Award, Usb, FileMusic, Flame, TrendingUp } from "lucide-react";

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

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 font-mono sm:px-4 sm:py-10">
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
  );
}
