"use client";

import { useSyncExternalStore } from "react";
import { isSfxMuted, setSfxMuted, subscribeSfxMute, playSfx } from "@/lib/sfx";

function subscribe(cb: () => void) {
  return subscribeSfxMute(cb);
}

export function SoundToggle() {
  const muted = useSyncExternalStore(
    subscribe,
    () => isSfxMuted(),
    () => false,
  );

  return (
    <button
      onClick={() => {
        const next = !muted;
        setSfxMuted(next);
        if (!next) playSfx("coin");
      }}
      className={`border border-[#222] px-2 py-1 text-[11px] font-mono transition-colors ${
        muted
          ? "text-[#555] hover:border-[#444] hover:text-[#e0e0e0]"
          : "text-[#00ff88] hover:border-[#ff6a00] hover:text-[#ff6a00]"
      }`}
      title={muted ? "Sound SFX off — click to enable" : "Sound SFX on — click to mute"}
    >
      {muted ? "[♪ off]" : "[♪ on]"}
    </button>
  );
}
