"use client";

import { ArrowDown, ArrowUp, Scissors, Undo2, Sparkles } from "lucide-react";
import type { Song } from "@/types/music";
import {
  popLastSongNote,
  toEditableCustomCopy,
  transposeSong,
  trimLeadingSilence,
} from "@/lib/music/score-editor";
import { saveCustomSong } from "@/lib/storage/academy-store";
import { playSfx } from "@/lib/sfx";

interface ScoreQuickEditorProps {
  song: Song;
  locale: "zh" | "en";
  onSongUpdated: (nextSong: Song) => void;
}

export function ScoreQuickEditor({ song, locale, onSongUpdated }: ScoreQuickEditorProps) {
  const applyTransform = (fn: (s: Song) => Song) => {
    const editable = toEditableCustomCopy(song);
    const updated = fn(editable);
    saveCustomSong(updated);
    onSongUpdated(updated);
    playSfx("coin");
  };

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-[#222] bg-[#090b10] px-3 py-2 text-[11px]">
      <div className="flex items-center gap-1.5 text-[#8a96a6]">
        <Sparkles className="h-3.5 w-3.5 text-[#ff8b33]" />
        <span>
          {locale === "zh"
            ? "微调工坊（内置曲目调整将另存为自定义改编版）:"
            : "Score Quick Tweaks (saves edited copy):"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 font-mono">
        <button
          type="button"
          onClick={() => applyTransform(trimLeadingSilence)}
          className="flex items-center gap-1 border border-[#00ff88]/40 bg-[#081a12] px-2.5 py-1 text-[#00ff88] hover:bg-[#102d1e]"
          title={locale === "zh" ? "裁去开头多余空白停顿" : "Trim leading silence to Beat 0"}
        >
          <Scissors className="h-3 w-3" />
          {locale === "zh" ? "裁去前奏留白" : "TRIM INTRO"}
        </button>

        <button
          type="button"
          onClick={() => applyTransform((s) => transposeSong(s, -1))}
          className="flex items-center gap-1 border border-[#00d4ff]/40 bg-[#071820] px-2 py-1 text-[#7dd3fc] hover:bg-[#0d2836]"
          title={locale === "zh" ? "全体音符降半音 (-1)" : "Transpose -1 semitone"}
        >
          <ArrowDown className="h-3 w-3" />
          -1
        </button>

        <button
          type="button"
          onClick={() => applyTransform((s) => transposeSong(s, 1))}
          className="flex items-center gap-1 border border-[#00d4ff]/40 bg-[#071820] px-2 py-1 text-[#7dd3fc] hover:bg-[#0d2836]"
          title={locale === "zh" ? "全体音符升半音 (+1)" : "Transpose +1 semitone"}
        >
          <ArrowUp className="h-3 w-3" />
          +1
        </button>

        <button
          type="button"
          onClick={() => applyTransform(popLastSongNote)}
          disabled={song.notes.length <= 1}
          className="flex items-center gap-1 border border-[#a855f7]/40 bg-[#170c24] px-2 py-1 text-[#d8b4fe] hover:bg-[#231236] disabled:opacity-40"
          title={locale === "zh" ? "删除末尾多余的一音" : "Remove last note"}
        >
          <Undo2 className="h-3 w-3" />
          {locale === "zh" ? "删末音" : "POP LAST"}
        </button>
      </div>
    </div>
  );
}
