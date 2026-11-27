"use client";

import { useEffect, useState } from "react";

export type PetMoodEvent = "perfect" | "combo" | "miss" | "midi" | "idle" | "fever" | "slowhint";

const PET_EVENT = "yamaha1100:pet-mood";

export function emitNotePet(ev: PetMoodEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PetMoodEvent>(PET_EVENT, { detail: ev }));
}

interface PixelPetProps {
  label?: string;
  feverActive?: boolean;
  consecutiveMisses?: number;
}

export function PixelPet({ label, feverActive = false, consecutiveMisses = 0 }: PixelPetProps) {
  const [mood, setMood] = useState<"idle" | "happy" | "hype" | "oops" | "fever" | "sleepy">("idle");
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    let resetTimer: number | undefined;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PetMoodEvent>).detail;
      setBounce(true);
      window.setTimeout(() => setBounce(false), 180);

      if (detail === "fever") setMood("fever");
      else if (detail === "combo") setMood("hype");
      else if (detail === "perfect" || detail === "midi") setMood("happy");
      else if (detail === "miss") setMood("oops");
      else if (detail === "slowhint") setMood("sleepy");
      else setMood("idle");

      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => setMood("idle"), 1600);
    };

    window.addEventListener(PET_EVENT, handler);
    return () => {
      window.removeEventListener(PET_EVENT, handler);
      if (resetTimer) window.clearTimeout(resetTimer);
    };
  }, []);

  const effectiveMood = feverActive ? "fever" : consecutiveMisses >= 4 ? "sleepy" : mood;
  const eyeColor =
    effectiveMood === "fever"
      ? "#00ff88"
      : effectiveMood === "oops" || effectiveMood === "sleepy"
        ? "#ff4d6d"
        : effectiveMood === "hype"
          ? "#00ff88"
          : "#00d4ff";

  const bubbleText =
    effectiveMood === "fever"
      ? "FEVER!!"
      : effectiveMood === "sleepy"
        ? "慢 0.7x 试试?"
        : label;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 transition-all ${
        effectiveMood === "fever"
          ? "border-[#00ff88] bg-[#081a12] shadow-[0_0_14px_rgba(0,255,136,0.3)]"
          : "border-[#222] bg-[#0c0c0c]"
      }`}
    >
      {/* Cute crisp SVG cyber-piano mascot */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 16 16"
        className={`transition-transform duration-150 ${
          bounce ? "-translate-y-1 scale-110" : effectiveMood === "fever" ? "animate-bounce" : ""
        }`}
        shapeRendering="crispEdges"
      >
        <rect x="3" y="2" width="10" height="10" fill={effectiveMood === "fever" ? "#111b18" : "#1d1d24"} />
        <rect x="3" y="2" width="2" height="2" fill={effectiveMood === "fever" ? "#00ff88" : "#ff6a00"} />
        <rect x="11" y="2" width="2" height="2" fill={effectiveMood === "fever" ? "#00ff88" : "#ff6a00"} />

        {/* Cool neon shades in FEVER, expressive eyes otherwise */}
        {effectiveMood === "fever" ? (
          <>
            <rect x="4" y="5" width="3" height="2" fill="#00ff88" />
            <rect x="9" y="5" width="3" height="2" fill="#00d4ff" />
            <rect x="7" y="5" width="2" height="1" fill="#ffffff" />
          </>
        ) : (
          <>
            <rect x="5" y="6" width="2" height={effectiveMood === "sleepy" ? 1 : 2} fill={eyeColor} />
            <rect x="9" y="6" width="2" height={effectiveMood === "sleepy" ? 1 : 2} fill={eyeColor} />
          </>
        )}

        {/* Mouth expression */}
        {effectiveMood === "happy" || effectiveMood === "hype" || effectiveMood === "fever" ? (
          <rect x="6" y="9" width="4" height="1" fill={effectiveMood === "fever" ? "#ff6a00" : "#00ff88"} />
        ) : effectiveMood === "oops" || effectiveMood === "sleepy" ? (
          <rect x="6" y="10" width="4" height="1" fill="#ff4d6d" />
        ) : (
          <rect x="7" y="9" width="2" height="1" fill="#aaa" />
        )}
        {/* Mini piano tie at bottom */}
        <rect x="4" y="12" width="8" height="3" fill="#e0e0e0" />
        <rect x="5" y="12" width="1" height="2" fill="#111" />
        <rect x="7" y="12" width="1" height="2" fill="#111" />
        <rect x="10" y="12" width="1" height="2" fill="#111" />
      </svg>

      {bubbleText && (
        <span
          className={`text-[10px] font-mono leading-tight ${
            effectiveMood === "fever"
              ? "font-bold text-[#00ff88]"
              : effectiveMood === "sleepy"
                ? "font-bold text-[#ff8b33]"
                : "text-[#8a8a98]"
          }`}
        >
          {bubbleText}
        </span>
      )}
    </div>
  );
}
