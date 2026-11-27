"use client";

import { useSearchParams } from "next/navigation";
import { ArcadeStudio } from "@/components/arcade/arcade-studio";
import type { FreeAssistMode, PracticeMode } from "@/types/music";

export function ArcadeClient() {
  const sp = useSearchParams();
  const songId = sp.get("song") ?? undefined;
  const sharedCode = sp.get("shared") ?? undefined;
  const capsuleStepId = sp.get("capsule") ?? undefined;
  const modeParam = sp.get("mode");
  const initialMode: PracticeMode | undefined =
    modeParam === "wait" || modeParam === "arcade" || modeParam === "listen" || modeParam === "free"
      ? modeParam
      : undefined;
  const assistParam = sp.get("assist");
  const initialAssist: FreeAssistMode | undefined =
    assistParam === "smart-scale" || assistParam === "magic-rhythm" || assistParam === "pro"
      ? assistParam
      : undefined;
  const initialCamOpen = sp.get("cam") === "1";

  return (
    <ArcadeStudio
      key={`${songId || "default"}-${sharedCode ? "shared" : "local"}-${initialMode || "wait"}-${initialAssist || "std"}-${initialCamOpen ? "cam" : "nocam"}`}
      initialSongId={songId}
      initialMode={initialMode}
      initialAssist={initialAssist}
      initialCamOpen={initialCamOpen}
      initialSharedCode={sharedCode}
      initialCapsuleStepId={capsuleStepId}
    />
  );
}
