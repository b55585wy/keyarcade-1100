"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { playSfx } from "@/lib/sfx";
import { useI18n } from "@/lib/i18n";

interface BootLine {
  prefix?: string;
  prefixColor?: string;
  text: string;
  color?: string;
}

const COMPACT_KEY = "yamaha1100:boot-compact";
const COMPACT_EVENT = "yamaha1100:boot-compact-change";

function subscribeCompact(cb: () => void) {
  window.addEventListener(COMPACT_EVENT, cb);
  return () => window.removeEventListener(COMPACT_EVENT, cb);
}

export function BootSequence({
  midiReady,
  deviceCount,
  modelLabel,
}: {
  midiReady: boolean;
  deviceCount: number;
  modelLabel: string;
}) {
  const { locale } = useI18n();
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.localStorage.getItem(COMPACT_KEY) === "1",
    () => false,
  );
  const [visibleCount, setVisibleCount] = useState(1);

  const lines = useMemo<BootLine[]>(
    () => [
      { text: "$ ./keyarcade-1100 --boot --brand=yamaha+casio --mode=gamified", color: "#888" },
      {
        prefix: "[OK]",
        prefixColor: "#00ff88",
        text:
          locale === "zh"
            ? ` 已加载琴型配置 · ${modelLabel} (Yamaha KBP/PSR-1100 & Casio PX-S1100 / WK-1100 / CTK-1100)`
            : ` Hardware profiles loaded · ${modelLabel} (Yamaha KBP/PSR-1100 & Casio PX-S1100 / WK-1100 / CTK-1100)`,
      },
      {
        prefix: midiReady ? "[OK]" : "[SIM]",
        prefixColor: midiReady ? "#00ff88" : "#00d4ff",
        text:
          locale === "zh"
            ? ` Web MIDI & 麦克风听音就绪: ${deviceCount > 0 ? `已连接 ${deviceCount} 台琴体` : "待接入 (无 MIDI 口琴型如 CTK-1100 可启用 MIC/摄像头/键盘直弹)"}`
            : ` Web MIDI & Mic Pitch ready: ${deviceCount > 0 ? `${deviceCount} device(s) online` : "standby (Mic / Cam / QWERTY ready for no-MIDI CTK-1100)"}`,
      },
      {
        prefix: "[OK]",
        prefixColor: "#00ff88",
        text:
          locale === "zh"
            ? " 自动扒谱引擎就绪 · SMF(.mid) + MusicXML + 简谱 -> 实时生成五线谱/简谱/瀑布流"
            : " Auto-Score Engine ready · SMF(.mid) + MusicXML + Jianpu -> Staff + Jianpu + Arcade",
      },
      {
        prefix: "[SYS]",
        prefixColor: "#a855f7",
        text:
          locale === "zh"
            ? " Yamaha & Casio 1100 像素终端教学舱已上线 · 准备开始演奏"
            : " Yamaha & Casio 1100 Pixel-Terminal Teaching Cockpit Online",
      },
    ],
    [deviceCount, locale, midiReady, modelLabel],
  );

  useEffect(() => {
    if (compact) return;
    let idx = 1;
    const t = setInterval(() => {
      idx += 1;
      setVisibleCount(idx);
      playSfx("boot");
      if (idx >= lines.length) {
        clearInterval(t);
      }
    }, 150);
    return () => clearInterval(t);
  }, [compact, lines.length]);

  const toggleCompact = () => {
    const next = !compact;
    window.localStorage.setItem(COMPACT_KEY, next ? "1" : "0");
    window.dispatchEvent(new CustomEvent(COMPACT_EVENT));
    setVisibleCount(lines.length);
  };

  if (compact) {
    return (
      <div className="mb-4 flex items-center justify-between border border-[#222] bg-[#0c0c0c] px-3 py-1.5 text-[11px] text-[#666]">
        <span>
          <span className="text-[#00ff88]">[BOOT:OK]</span> $ ./yamaha-1100-academy --ready · {modelLabel}
        </span>
        <button
          onClick={toggleCompact}
          className="text-[#888] hover:text-[#ff6a00] transition-colors"
        >
          [expand log]
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 terminal-box p-3 sm:p-4 text-xs">
      <div className="mb-2 flex items-center justify-between border-b border-[#1c1c1c] pb-2 text-[10px] text-[#555]">
        <span>TERMINAL://BOOT_SEQUENCE</span>
        <button
          onClick={toggleCompact}
          className="hover:text-[#ff6a00] transition-colors"
        >
          [collapse]
        </button>
      </div>
      <div className="space-y-1 font-mono leading-relaxed">
        {lines.slice(0, visibleCount).map((line, idx) => (
          <div key={idx} style={{ color: line.color ?? "#b8b8b8" }}>
            {line.prefix && (
              <span className="font-bold" style={{ color: line.prefixColor ?? "#00ff88" }}>
                {line.prefix}
              </span>
            )}
            <span>{line.text}</span>
          </div>
        ))}
        {visibleCount < lines.length && <span className="cursor-blink text-[#ff6a00]" />}
      </div>
    </div>
  );
}
