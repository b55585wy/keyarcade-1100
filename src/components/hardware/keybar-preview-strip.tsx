"use client";

import type { KeyBarLedPixel } from "@/lib/hardware/led-strip-bridge";

interface KeyBarPreviewStripProps {
  ledCount: number;
  pixels: KeyBarLedPixel[];
  compact?: boolean;
  label?: string;
}

/**
 * Real-time digital twin of the WS2812B LED KeyBar placed above the piano keys.
 */
export function KeyBarPreviewStrip({
  ledCount,
  pixels,
  compact = false,
  label,
}: KeyBarPreviewStripProps) {
  const displayBins = Math.min(88, Math.max(24, Math.round(ledCount / 2)));
  const binMap = new Map<number, KeyBarLedPixel>();

  for (const p of pixels) {
    const bin = Math.min(displayBins - 1, Math.max(0, Math.floor((p.idx / Math.max(1, ledCount)) * displayBins)));
    binMap.set(bin, p);
  }

  return (
    <div
      className={
        compact
          ? "w-full border-t border-white/10 bg-[#050508] px-2 py-1"
          : "w-full rounded-xl border border-white/10 bg-[#07070c] p-3"
      }
    >
      {!compact && (
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="font-mono font-bold text-[#ff8b33]">
            {label || `KEYBAR PREVIEW · ${ledCount} WS2812B LEDS`}
          </span>
          <span className="font-mono text-[10px] text-[#8a8a98]">
            {pixels.length > 0 ? `${pixels.length} LED ACTIVE` : "STANDBY"}
          </span>
        </div>
      )}

      <div
        className="grid gap-[1px] rounded-md bg-[#020204] p-1"
        style={{ gridTemplateColumns: `repeat(${displayBins}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: displayBins }).map((_, idx) => {
          const lit = binMap.get(idx);
          const color = lit ? `rgb(${lit.r}, ${lit.g}, ${lit.b})` : "#181822";
          return (
            <div
              key={idx}
              className={compact ? "h-2 rounded-[1px]" : "h-3 rounded-[2px]"}
              style={{
                backgroundColor: color,
                boxShadow: lit ? `0 0 8px rgb(${lit.r}, ${lit.g}, ${lit.b})` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
