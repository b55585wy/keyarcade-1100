"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PixelLogo } from "./pixel-logo";
import { SoundToggle } from "./sound-toggle";
import { useI18n } from "@/lib/i18n";
import { getAcademyStats, getStoredModel, setStoredModel, subscribeStore } from "@/lib/storage/academy-store";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import type { YamahaModelId } from "@/types/music";
import { playSfx } from "@/lib/sfx";

export function Navbar() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [model, setModel] = useState<YamahaModelId>("kbp1100");
  const [xp, setXp] = useState(120);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    const sync = () => {
      setModel(getStoredModel());
      const st = getAcademyStats();
      setXp(st.totalXp);
      setLevel(st.level);
    };
    sync();
    return subscribeStore(sync);
  }, []);

  const switchModel = (next: YamahaModelId) => {
    setStoredModel(next);
    setModel(next);
    playSfx("key");
  };

  const navItems = [
    { href: "/", label: t("nav.home"), match: (p: string) => p === "/" },
    { href: "/arcade", label: t("nav.arcade"), match: (p: string) => p.startsWith("/arcade") },
    { href: "/scores", label: t("nav.scores"), match: (p: string) => p.startsWith("/scores") },
    { href: "/import", label: t("nav.import"), match: (p: string) => p.startsWith("/import") },
    { href: "/drills", label: t("nav.drills"), match: (p: string) => p.startsWith("/drills") },
    { href: "/rank", label: t("nav.rank"), match: (p: string) => p.startsWith("/rank") },
  ];

  const profile = YAMAHA_PROFILES[model];
  const locSlug = pathname === "/" ? "home" : pathname.replace(/^\//, "").split("/")[0];

  return (
    <nav className="border-b border-[#222] bg-[#0a0a0a]">
      <div className="mx-auto max-w-6xl px-3 font-mono sm:px-4">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <PixelLogo className="h-6 w-[104px] shrink-0" />
            <div className="flex flex-col justify-center">
              <span className="text-[15px] font-extrabold tracking-[0.14em] text-[#ededed] sm:text-[19px]">
                KEYARCADE<span className="text-[#ff6a00]">_1100</span>
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff6a00] sm:block">
                {t("nav.subtitle")}
              </span>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-1.5">
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => playSfx("navigate")}
                  className={`shrink-0 whitespace-nowrap rounded-sm border px-2 py-1 text-xs transition-all sm:text-sm ${
                    active
                      ? "border-[#ff6a00] bg-[#151515] text-[#ff6a00] shadow-[0_0_14px_rgba(255,106,0,0.16)]"
                      : "border-transparent text-[#888] hover:border-[#333] hover:bg-[#111] hover:text-[#e0e0e0]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Hardware Switcher: Yamaha 1100 & Casio 1100 */}
            <label
              className="flex items-center gap-1 border border-[#222] bg-[#111] px-2 py-1 text-[10px]"
              title={profile.name}
            >
              <span
                className={`font-bold ${
                  profile.brand === "CASIO" ? "text-[#00d4ff]" : "text-[#ff6a00]"
                }`}
              >
                {profile.brand}
              </span>
              <select
                aria-label="Hardware Model"
                value={model}
                onChange={(e) => switchModel(e.target.value as YamahaModelId)}
                className="bg-[#111] font-bold text-[#e0e0e0] focus:outline-none"
              >
                <optgroup label="YAMAHA 1100">
                  <option value="kbp1100">KBP-1100 [88K]</option>
                  <option value="psr1100">PSR-1100 [61K]</option>
                </optgroup>
                <optgroup label="CASIO 1100">
                  <option value="pxs1100">PX-S1100 [88K]</option>
                  <option value="wk1100">WK-1100 [76K]</option>
                  <option value="ctk1100">CTK-1100 [61K · MIC]</option>
                </optgroup>
              </select>
            </label>

            <span className="hidden border border-[#222] bg-[#0c0c0c] px-2 py-1 text-[10px] text-[#00ff88] md:inline-block">
              LV.{String(level).padStart(2, "0")} · {xp}XP
            </span>

            <SoundToggle />

            <button
              onClick={() => {
                setLocale(locale === "zh" ? "en" : "zh");
                playSfx("key");
              }}
              className="border border-[#222] px-2 py-1 text-[11px] text-[#888] transition-colors hover:border-[#ff6a00] hover:text-[#ff6a00]"
            >
              {locale === "zh" ? "EN" : "中文"}
            </button>
          </div>
        </div>

        {/* Bottom terminal location strip matching agent-coding */}
        <div className="flex h-7 items-center justify-between border-t border-[#151515] text-[10px] uppercase tracking-[0.2em] text-[#555]">
          <span>
            location://<span className="text-[#e0e0e0]">{locSlug}</span>
          </span>
          <span className="truncate text-[#ff6a00]">
            {profile.shortName} · {locale === "zh" ? profile.midiPortDescZh : profile.midiPortDescEn}
          </span>
        </div>
      </div>
    </nav>
  );
}
