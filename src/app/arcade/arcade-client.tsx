"use client";

import { useSearchParams } from "next/navigation";
import { ArcadeStudio } from "@/components/arcade/arcade-studio";
import type { PracticeMode } from "@/types/music";

export function ArcadeClient() {
  const sp = useSearchParams();
  const songId = sp.get("song") ?? undefined;
  const modeParam = sp.get("mode");
  const initialMode: PracticeMode | undefined =
    modeParam === "wait" || modeParam === "arcade" || modeParam === "listen" || modeParam === "free"
      ? modeParam
      : undefined;
  const initialCamOpen = sp.get("cam") === "1";

  return (
    <ArcadeStudio
      key={`${songId || "default"}-${initialMode || "wait"}-${initialCamOpen ? "cam" : "nocam"}`}
      initialSongId={songId}
      initialMode={initialMode}
      initialCamOpen={initialCamOpen}
    />
  );
}
