import { Suspense } from "react";
import { ArcadeClient } from "./arcade-client";

export default function ArcadePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#666]">Booting Arcade...</div>}>
      <ArcadeClient />
    </Suspense>
  );
}
