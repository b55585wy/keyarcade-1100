"use client";

declare global {
  interface Window {
    KeyArcadeNative?: {
      setOrientation?: (mode: "landscape" | "portrait" | "auto") => void;
    };
  }
}

export async function requestScreenOrientation(mode: "landscape" | "portrait" | "auto"): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    if (window.KeyArcadeNative?.setOrientation) {
      window.KeyArcadeNative.setOrientation(mode);
      return;
    }
  } catch {
    // Fall through to Web Screen Orientation API
  }

  try {
    const orient = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
      unlock?: () => void;
    };
    if (mode === "landscape") {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      await orient.lock?.("landscape").catch(() => {});
    } else if (mode === "portrait") {
      await orient.lock?.("portrait").catch(() => {});
    } else {
      orient.unlock?.();
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    }
  } catch {
    // Best effort on browsers without orientation lock
  }
}
