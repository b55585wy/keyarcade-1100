import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KEYARCADE_1100 — Yamaha & Casio 1100 Piano Academy",
    short_name: "KEYARCADE",
    description:
      "Gamified teaching terminal for Yamaha (KBP-1100, PSR-1100) & Casio (PX-S1100, WK-1100, CTK-1100) with Web MIDI, Mic Pitch, AI Cam Coach & Playable CD Shelf.",
    start_url: "/arcade",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#ff6a00",
    categories: ["music", "education", "games"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "练琴街机 Arcade",
        short_name: "Arcade",
        url: "/arcade",
      },
      {
        name: "CD 曲库首页",
        short_name: "CD Shelf",
        url: "/",
      },
      {
        name: "音频扒谱 & DeepSeek",
        short_name: "Import/AI",
        url: "/import",
      },
      {
        name: "安卓配置指南",
        short_name: "Android",
        url: "/android",
      },
    ],
  };
}
