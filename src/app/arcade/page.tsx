import { Suspense } from "react";
import { ArcadeStudio } from "@/components/arcade/arcade-studio";

export default async function ArcadePage({
  searchParams,
}: {
  searchParams: Promise<{ song?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#666]">Booting Arcade...</div>}>
      <ArcadeStudio initialSongId={sp.song} />
    </Suspense>
  );
}
