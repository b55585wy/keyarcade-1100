"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PixelLogo } from "./pixel-logo";
import { SoundToggle } from "./sound-toggle";
import { usePwaInstallPrompt } from "./pwa-register";
import { useI18n } from "@/lib/i18n";
import { getAcademyStats, getStoredModel, setStoredModel, subscribeStore } from "@/lib/storage/academy-store";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import type { YamahaModelId } from "@/types/music";
import { playSfx } from "@/lib/sfx";

export function Navbar() {
  const pathname = usePathname();
  const { locale, setLocale } = useI18n();
  const { canInstall, triggerInstall } = usePwaInstallPrompt();
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
    { href: "/", label: locale === "zh" ? "首页" : "Home", match: (p: string) => p === "/" },
    { href: "/arcade", label: locale === "zh" ? "练琴" : "Arcade", match: (p: string) => p.startsWith("/arcade") },
    { href: "/scores", label: locale === "zh" ? "曲谱" : "Scores", match: (p: string) => p.startsWith("/scores") },
    { href: "/import", label: locale === "zh" ? "导入" : "Import", match: (p: string) => p.startsWith("/import") },
    { href: "/drills", label: locale === "zh" ? "道场" : "Dojo", match: (p: string) => p.startsWith("/drills") },
    { href: "/rank", label: locale === "zh" ? "成长" : "Stats", match: (p: string) => p.startsWith("/rank") },
  ];

  const profile = YAMAHA_PROFILES[model];
  const isArcade = pathname.startsWith("/arcade");

  const mobilePageTitle =
    pathname === "/"
      ? "KEY1100"
      : pathname.startsWith("/scores")
        ? locale === "zh"
          ? "智能双谱"
          : "Scores"
        : pathname.startsWith("/import")
          ? locale === "zh"
            ? "哼唱扒谱"
            : "Import"
          : pathname.startsWith("/drills")
            ? locale === "zh"
              ? "和弦道场"
              : "Dojo"
            : pathname.startsWith("/rank")
              ? locale === "zh"
                ? "学习曲线"
                : "Progress"
              : pathname.startsWith("/android")
                ? locale === "zh"
                  ? "安卓 APK"
                  : "APK"
                : "KEY1100";

  return (
    <>
      {/* Native Sleek Mobile Top App Bar (hidden inside immersive /arcade player & mobile landscape) */}
      {!isArcade && (
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0b0f]/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md md:hidden">
          <div className="flex h-[52px] items-center justify-between gap-2 px-3">
            <Link href="/" className="flex min-w-0 items-center gap-1.5">
              <PixelLogo className="h-4 w-[58px] shrink-0" />
              <span className="truncate text-xs font-extrabold tracking-wide text-[#f2f2f5]">
                {mobilePageTitle}
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-1.5">
              <label
                className="flex items-center gap-1 rounded-full border border-[#ff6a00]/40 bg-[#1a120b] px-2 py-1 text-[11px]"
                title={profile.name}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    profile.brand === "CASIO" ? "bg-[#00d4ff]" : "bg-[#ff6a00]"
                  }`}
                />
                <select
                  aria-label="Mobile Hardware Model"
                  value={model}
                  onChange={(e) => switchModel(e.target.value as YamahaModelId)}
                  className="max-w-[88px] bg-transparent font-bold text-[#f5f5f5] focus:outline-none"
                >
                  <optgroup label="YAMAHA 1100">
                    <option value="kbp1100">KBP-1100</option>
                    <option value="psr1100">PSR-1100</option>
                  </optgroup>
                  <optgroup label="CASIO 1100">
                    <option value="pxs1100">PX-S1100</option>
                    <option value="wk1100">WK-1100</option>
                    <option value="ctk1100">CTK-1100</option>
                  </optgroup>
                </select>
              </label>

              <SoundToggle />

              <button
                onClick={() => {
                  setLocale(locale === "zh" ? "en" : "zh");
                  playSfx("key");
                }}
                className="rounded-full border border-white/10 bg-[#14141a] px-2.5 py-1 text-[11px] font-medium text-[#aaa]"
              >
                {locale === "zh" ? "EN" : "中"}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Sleek Single-Row Studio Desktop Navbar (hidden on compact mobile landscape < 540px height) */}
      <nav className="sticky top-0 z-40 hidden border-b border-white/10 bg-[#0b0b10]/95 backdrop-blur-md md:block [@media(max-height:540px)]:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <PixelLogo className="h-5 w-[78px] shrink-0" />
            <span className="font-mono text-base font-extrabold tracking-wide text-[#f2f2f5]">
              KEYARCADE<span className="text-[#ff6a00]">_1100</span>
            </span>
          </Link>

          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1">
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => playSfx("navigate")}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-[#ff6a00] text-[#0a0a0a] shadow-[0_2px_10px_rgba(255,106,0,0.3)]"
                      : "text-[#9a9aa8] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2 text-xs">
            <label
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#14141b] px-2.5 py-1.5 text-[11px]"
              title={`${profile.name} · ${locale === "zh" ? profile.midiPortDescZh : profile.midiPortDescEn}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  profile.brand === "CASIO" ? "bg-[#00d4ff]" : "bg-[#ff6a00]"
                }`}
              />
              <select
                aria-label="Hardware Model"
                value={model}
                onChange={(e) => switchModel(e.target.value as YamahaModelId)}
                className="bg-transparent font-semibold text-[#f0f0f5] focus:outline-none"
              >
                <optgroup label="YAMAHA 1100" className="bg-[#121218]">
                  <option value="kbp1100">KBP-1100 [88K]</option>
                  <option value="psr1100">PSR-1100 [61K]</option>
                </optgroup>
                <optgroup label="CASIO 1100" className="bg-[#121218]">
                  <option value="pxs1100">PX-S1100 [88K]</option>
                  <option value="wk1100">WK-1100 [76K]</option>
                  <option value="ctk1100">CTK-1100 [61K·MIC]</option>
                </optgroup>
              </select>
            </label>

            <Link
              href="/rank"
              className="hidden rounded-lg border border-[#00ff88]/25 bg-[#0a1811] px-2.5 py-1.5 font-mono text-[11px] font-bold text-[#00ff88] hover:border-[#00ff88]/50 xl:inline-flex"
            >
              LV.{String(level).padStart(2, "0")} · {xp}XP
            </Link>

            <SoundToggle />

            <Link
              href="/android"
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                pathname.startsWith("/android")
                  ? "border-[#00ff88]/60 bg-[#0a1a12] text-[#00ff88]"
                  : "border-white/10 bg-[#14141b] text-[#9a9aa8] hover:text-white"
              }`}
              title={locale === "zh" ? "下载安卓 APK 安装包" : "Android APK"}
            >
              APK
            </Link>

            {canInstall && (
              <button
                type="button"
                onClick={() => void triggerInstall()}
                className="rounded-lg border border-[#00ff88]/50 bg-[#081a10] px-2 py-1.5 font-mono text-[11px] font-bold text-[#00ff88]"
                title={locale === "zh" ? "安装到桌面/主屏幕 (PWA)" : "Install App"}
              >
                +APP
              </button>
            )}

            <button
              onClick={() => {
                setLocale(locale === "zh" ? "en" : "zh");
                playSfx("key");
              }}
              className="rounded-lg border border-white/10 bg-[#14141b] px-2.5 py-1.5 text-[11px] font-medium text-[#aaa] transition-colors hover:border-white/25 hover:text-white"
            >
              {locale === "zh" ? "EN" : "中"}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
