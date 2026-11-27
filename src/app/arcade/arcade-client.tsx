"use client";

import { useSearchParams } from "next/navigation";
import { ArcadeStudio } from "@/components/arcade/arcade-studio";

export function ArcadeClient() {
  const sp = useSearchParams();
  const songId = sp.get("song") ?? undefined;
  return <ArcadeStudio key={songId || "default"} initialSongId={songId} />;
}
