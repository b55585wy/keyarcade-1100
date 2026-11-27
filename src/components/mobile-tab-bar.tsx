"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Gamepad2, FileMusic, Mic, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { playSfx } from "@/lib/sfx";

export function MobileTabBar() {
  const pathname = usePathname();
  const { locale } = useI18n();

  // Immersive full-viewport arcade mode hides the bottom navigation bar
  if (pathname.startsWith("/arcade")) {
    return null;
  }

  const tabs = [
    {
      href: "/",
      label: locale === "zh" ? "首页" : "Home",
      Icon: Home,
      active: pathname === "/",
      accent: false,
    },
    {
      href: "/scores",
      label: locale === "zh" ? "曲谱" : "Scores",
      Icon: FileMusic,
      active: pathname.startsWith("/scores"),
      accent: false,
    },
    {
      href: "/arcade",
      label: locale === "zh" ? "练琴" : "Play",
      Icon: Gamepad2,
      active: pathname.startsWith("/arcade"),
      accent: true,
    },
    {
      href: "/import",
      label: locale === "zh" ? "导入" : "Import",
      Icon: Mic,
      active: pathname.startsWith("/import"),
      accent: false,
    },
    {
      href: "/rank",
      label: locale === "zh" ? "成长" : "Stats",
      Icon: TrendingUp,
      active: pathname.startsWith("/rank"),
      accent: false,
    },
  ];

  return (
    <>
      <div className="h-[calc(68px+env(safe-area-inset-bottom))] md:hidden" aria-hidden="true" />
      <nav
        aria-label="Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0b0f]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1.5">
          {tabs.map(({ href, label, Icon, active, accent }) => {
            if (accent) {
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => playSfx("navigate")}
                  className="flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="flex h-10 w-12 items-center justify-center rounded-2xl bg-[#ff6a00] text-[#0a0a0a] shadow-[0_4px_16px_rgba(255,106,0,0.45)] transition-transform active:scale-95">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] font-bold text-[#ff6a00]">{label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                onClick={() => playSfx("navigate")}
                className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors ${
                  active ? "text-[#ff6a00]" : "text-[#7a7a88] active:text-[#e0e0e0]"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.4]" : "stroke-[1.8]"}`} />
                <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
