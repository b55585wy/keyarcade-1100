"use client";

import { useEffect, useRef, useState } from "react";

export type PetMoodEvent = "perfect" | "combo" | "miss" | "midi" | "idle";

export function emitNotePet(ev: PetMoodEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PetMoodEvent>("yamaha1100:pet", { detail: ev }));
}

export function PixelPet({ label }: { label?: string }) {
  const [mood, setMood] = useState<"idle" | "happy" | "hype" | "oops">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onEv = (e: Event) => {
      const detail = (e as CustomEvent<PetMoodEvent>).detail;
      if (!detail) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (detail === "combo" || detail === "midi") setMood("hype");
      else if (detail === "perfect") setMood("happy");
      else if (detail === "miss") setMood("oops");
      else setMood("idle");
      timerRef.current = setTimeout(() => setMood("idle"), 1100);
    };
    window.addEventListener("yamaha1100:pet", onEv);
    return () => {
      window.removeEventListener("yamaha1100:pet", onEv);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const anim =
    mood === "hype"
      ? "pet-beat-fast"
      : mood === "happy"
        ? "pet-beat-slow"
        : mood === "oops"
          ? "pet-shake"
          : "";

  const bodyColor = mood === "oops" ? "#666" : mood === "hype" ? "#00ff88" : "#ff6a00";
  const earColor = mood === "oops" ? "#444" : "#00d4ff";

  return (
    <div className="inline-flex items-center gap-2 border border-[#222] bg-[#0c0c0c] px-2.5 py-1 text-[10px]">
      <svg
        viewBox="0 0 16 16"
        width="20"
        height="20"
        shapeRendering="crispEdges"
        className={anim}
        aria-hidden="true"
      >
        {/* Pixel synthesizer / cat-note mascot */}
        <rect x="3" y="2" width="2" height="2" fill={earColor} />
        <rect x="11" y="2" width="2" height="2" fill={earColor} />
        <rect x="3" y="4" width="10" height="8" fill={bodyColor} />
        <rect x="2" y="6" width="12" height="4" fill={bodyColor} />
        {/* Eyes */}
        <rect x="5" y="6" width="2" height="2" fill="#0a0a0a" />
        <rect x="9" y="6" width="2" height="2" fill="#0a0a0a" />
        {/* Mouth / smile */}
        {mood === "oops" ? (
          <>
            <rect x="6" y="10" width="4" height="1" fill="#0a0a0a" />
            <rect x="5" y="11" width="1" height="1" fill="#0a0a0a" />
            <rect x="10" y="11" width="1" height="1" fill="#0a0a0a" />
          </>
        ) : (
          <>
            <rect x="6" y="9" width="1" height="1" fill="#0a0a0a" />
            <rect x="9" y="9" width="1" height="1" fill="#0a0a0a" />
            <rect x="7" y="10" width="2" height="1" fill="#0a0a0a" />
          </>
        )}
        {/* Mini piano feet */}
        <rect x="4" y="12" width="2" height="2" fill="#e0e0e0" />
        <rect x="10" y="12" width="2" height="2" fill="#e0e0e0" />
      </svg>
      <div className="leading-tight">
        <div className="font-bold text-[#e0e0e0]">
          {mood === "hype"
            ? "COMBO!"
            : mood === "happy"
              ? "NICE!"
              : mood === "oops"
                ? "RETRY"
                : "KBP-BOT"}
        </div>
        {label && <div className="text-[9px] text-[#666]">{label}</div>}
      </div>
    </div>
  );
}
