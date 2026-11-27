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
      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors md:rounded-lg ${
        muted
          ? "border-white/10 bg-[#14141b] text-[#777] hover:text-[#e0e0e0]"
          : "border-[#00ff88]/30 bg-[#0c1c14] text-[#00ff88] hover:border-[#00ff88]/60"
      }`}
      title={muted ? "Sound SFX off — click to enable" : "Sound SFX on — click to mute"}
    >
      {muted ? "♪ 静音" : "♪ 音效"}
    </button>
  );
}
