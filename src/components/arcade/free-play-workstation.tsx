"use client";

import { Keyboard } from "lucide-react";
import type {
  ArrangerStyleId,
  FreeAssistMode,
  Song,
  YamahaModelId,
} from "@/types/music";
import { ARRANGER_STYLES } from "@/lib/music/arranger-styles";
import {
  KEY_DIATONIC_CHORDS,
  resolvePcKeyToMidi,
  type PcKeyboardLayoutId,
} from "@/lib/music/yamaha-profiles";
import { chordToMidiNotes, midiToName } from "@/lib/music/theory";
import type { MagicVibePreset } from "@/lib/music/magic-engine";
import { MagicImprovBar } from "./magic-improv-bar";

interface FreePlayWorkstationProps {
  locale: "zh" | "en";
  isMobileShell: boolean;
  model: YamahaModelId;
  songs: Song[];
  song: Song;
  freeKeySig: string;
  onChangeFreeKeySig: (key: string) => void;
  pcLayout: PcKeyboardLayoutId;
  qwertyOctaveShift: number;
  onChangeOctaveShift: (shift: number) => void;
  sustainLock: boolean;
  onToggleSustainLock: () => void;
  onPanicStop: () => void;
  arrangerStyle: ArrangerStyleId;
  onChangeArrangerStyle: (style: ArrangerStyleId) => void;
  arrangerActive: boolean;
  onToggleArrangerActive: () => void;
  arrangerChord: string;
  onSelectChordPad: (sym: string) => void;
  freeAssistMode: FreeAssistMode;
  onChangeAssistMode: (m: FreeAssistMode) => void;
  activeVibeId: string;
  onApplyVibe: (vibe: MagicVibePreset) => void;
  progressionId: string;
  onChangeProgression: (id: string) => void;
  magicStepIdx: number;
  magicTotalSteps: number;
  magicAutoLh: boolean;
  onToggleMagicAutoLh: () => void;
  onSelectMagicSong: (songId: string) => void;
  isImprovRecording: boolean;
  recordedCount: number;
  onToggleImprovRecord: () => void;
  compiledImprovSong: Song | null;
  onPracticeCompiledSong: (song: Song) => void;
  onDismissCompiledSong: () => void;
  onAiSongReady: (song: Song) => void;
  activeNotes: Set<number>;
  noteTrail: string[];
  onNoteOn: (midi: number, velocity?: number, opts?: { silent?: boolean; rawChordPad?: boolean }) => void;
  onNoteOff: (midi: number, opts?: { silent?: boolean; rawChordPad?: boolean }) => void;
}

const KEY_OPTIONS = ["C", "G", "D", "F", "Bb", "Am"] as const;

export function FreePlayWorkstation(props: FreePlayWorkstationProps) {
  const {
    locale,
    isMobileShell,
    model,
    songs,
    song,
    freeKeySig,
    onChangeFreeKeySig,
    pcLayout,
    qwertyOctaveShift,
    onChangeOctaveShift,
    sustainLock,
    onToggleSustainLock,
    onPanicStop,
    arrangerStyle,
    onChangeArrangerStyle,
    arrangerActive,
    onToggleArrangerActive,
    arrangerChord,
    onSelectChordPad,
    freeAssistMode,
    onChangeAssistMode,
    activeVibeId,
    onApplyVibe,
    progressionId,
    onChangeProgression,
    magicStepIdx,
    magicTotalSteps,
    magicAutoLh,
    onToggleMagicAutoLh,
    onSelectMagicSong,
    isImprovRecording,
    recordedCount,
    onToggleImprovRecord,
    compiledImprovSong,
    onPracticeCompiledSong,
    onDismissCompiledSong,
    onAiSongReady,
    activeNotes,
    noteTrail,
    onNoteOn,
    onNoteOff,
  } = props;

  const chordsList = KEY_DIATONIC_CHORDS[freeKeySig] ?? KEY_DIATONIC_CHORDS.C;

  const sharedMagicBar = (
    <MagicImprovBar
      locale={locale}
      compact={isMobileShell}
      model={model}
      songs={songs}
      selectedSongId={song.id}
      onSelectSongId={onSelectMagicSong}
      assistMode={freeAssistMode}
      onChangeAssistMode={onChangeAssistMode}
      activeVibeId={activeVibeId}
      onApplyVibe={onApplyVibe}
      progressionId={progressionId}
      onChangeProgression={onChangeProgression}
      activeChord={arrangerChord}
      magicStepIdx={magicStepIdx}
      magicTotalSteps={magicTotalSteps}
      magicAutoLh={magicAutoLh}
      onToggleMagicAutoLh={onToggleMagicAutoLh}
      songTitle={locale === "zh" && song.titleZh ? song.titleZh : song.title}
      isRecording={isImprovRecording}
      recordedCount={recordedCount}
      onToggleRecord={onToggleImprovRecord}
      compiledSong={compiledImprovSong}
      onPracticeCompiledSong={onPracticeCompiledSong}
      onDismissCompiledSong={onDismissCompiledSong}
      onAiSongReady={onAiSongReady}
    />
  );

  if (isMobileShell) {
    const degrees = ["I", "ii", "iii", "IV", "V", "vi"];
    return (
      <div className="flex min-h-[180px] flex-1 flex-col justify-between gap-2.5 overflow-y-auto bg-[#07070c] px-2.5 py-2.5">
        {/* Compact Mobile Free Play Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-2xl border border-white/10 bg-[#111118] px-2.5 py-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Mobile Free Play Key"
              value={freeKeySig}
              onChange={(e) => onChangeFreeKeySig(e.target.value)}
              className="rounded-full bg-white/5 px-2.5 py-1 font-bold text-[#00ff88] focus:outline-none"
            >
              {KEY_OPTIONS.map((k) => (
                <option key={k} value={k} className="bg-[#121218]">
                  1 = {k}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onToggleSustainLock}
              className={`rounded-full px-2.5 py-1 font-bold transition-colors ${
                sustainLock ? "bg-[#ff6a00] text-[#0a0a0a]" : "bg-white/5 text-[#9898a6]"
              }`}
            >
              {locale === "zh" ? (sustainLock ? "延音: 开" : "延音: 关") : sustainLock ? "SUSTAIN" : "PEDAL"}
            </button>

            <button
              type="button"
              onClick={onPanicStop}
              className="rounded-full bg-white/5 px-2 py-1 text-[#9898a6] active:bg-white/15"
            >
              {locale === "zh" ? "止音" : "STOP"}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              aria-label="Mobile Arranger Style"
              value={arrangerStyle}
              onChange={(e) => onChangeArrangerStyle(e.target.value as ArrangerStyleId)}
              className="max-w-[92px] rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold text-[#ff8b33] focus:outline-none"
            >
              {ARRANGER_STYLES.map((st) => (
                <option key={st.id} value={st.id} className="bg-[#121218]">
                  {st.id === "off" ? (locale === "zh" ? "无伴奏" : "NoStyle") : st.labelEn.split(" ")[0]}
                </option>
              ))}
            </select>
            {arrangerStyle !== "off" && (
              <button
                type="button"
                onClick={onToggleArrangerActive}
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  arrangerActive ? "bg-[#00d4ff] text-[#0a0a0a]" : "bg-white/10 text-[#00d4ff]"
                }`}
              >
                {arrangerActive ? "■" : "▶"}
              </button>
            )}
          </div>
          <span className="max-w-[76px] truncate font-semibold text-[#00d4ff]">
            {noteTrail.slice(-2).join("·") || (locale === "zh" ? "自由弹" : "FREE")}
          </span>
        </div>

        {sharedMagicBar}

        {/* Mobile Tactile Chord Pads */}
        <section>
          <div className="mb-1.5 flex items-center justify-between px-0.5 text-[10px]">
            <span className="font-semibold text-[#9898a6]">
              {locale === "zh" ? `左手伴奏和弦垫 (1=${freeKeySig} · 按住发声)` : `Chord Pads (1=${freeKeySig})`}
            </span>
            <span className="text-[#00d4ff]">OCT 3</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {chordsList.map((sym, idx) => {
              const midis = chordToMidiNotes(sym, 3);
              const chordLit = midis.some((m) => activeNotes.has(m));
              return (
                <button
                  key={sym}
                  type="button"
                  onPointerDown={() => {
                    onSelectChordPad(sym);
                    for (const m of midis) onNoteOn(m, 84, { rawChordPad: true });
                  }}
                  onPointerUp={() => {
                    for (const m of midis) onNoteOff(m, { rawChordPad: true });
                  }}
                  onPointerCancel={() => {
                    for (const m of midis) onNoteOff(m, { rawChordPad: true });
                  }}
                  onPointerLeave={() => {
                    for (const m of midis) onNoteOff(m, { rawChordPad: true });
                  }}
                  className={`flex touch-none flex-col items-center justify-center rounded-2xl border py-2.5 transition-transform active:scale-95 ${
                    chordLit
                      ? "border-[#00d4ff] bg-[#00d4ff] text-[#0a0a0a] shadow-[0_0_16px_rgba(0,212,255,0.4)]"
                      : "border-white/10 bg-[#12121a] text-[#e6e6f0]"
                  }`}
                >
                  <span className="text-sm font-extrabold leading-tight">{sym}</span>
                  <span className={`text-[9px] ${chordLit ? "text-[#0a0a0a]/80" : "text-[#7a7a8a]"}`}>
                    {degrees[idx] ?? ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Mobile Tactile 2-Octave Large Jianpu Arcade Pads */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5 text-[10px]">
            <span className="font-semibold text-[#9898a6]">
              {locale === "zh" ? "简谱大格旋律键" : "Jianpu Melody Pads"}
            </span>
            <div className="flex items-center gap-1 rounded-full bg-white/5 p-0.5 text-[9px]">
              {[
                { shift: -1, label: locale === "zh" ? "降八" : "-8" },
                { shift: 0, label: locale === "zh" ? "标准" : "0" },
                { shift: 1, label: locale === "zh" ? "升八" : "+8" },
              ].map((z) => (
                <button
                  key={z.shift}
                  type="button"
                  onClick={() => onChangeOctaveShift(z.shift)}
                  className={`rounded-full px-2 py-0.5 font-bold ${
                    qwertyOctaveShift === z.shift ? "bg-[#00ff88] text-[#0a0a0a]" : "text-[#8a8a98]"
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          {(
            [
              {
                dot: true,
                keys: ["q", "w", "e", "r", "t", "y", "u"],
                activeCls: "border-[#ff8b33] bg-[#ff6a00] text-[#0a0a0a] shadow-[0_0_14px_rgba(255,106,0,0.45)]",
                idleCls: "border-[#ff6a00]/25 bg-[#19120c] text-[#ffb178]",
              },
              {
                dot: false,
                keys: ["a", "s", "d", "f", "g", "h", "j"],
                activeCls: "border-[#00ff88] bg-[#00ff88] text-[#0a0a0a] shadow-[0_0_14px_rgba(0,255,136,0.45)]",
                idleCls: "border-[#00ff88]/25 bg-[#0c1712] text-[#7dffbf]",
              },
            ] as const
          ).map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-7 gap-1.5">
              {row.keys.map((kChar, idx) => {
                const mappedMidi = resolvePcKeyToMidi(kChar, "jianpu-num", freeKeySig, qwertyOctaveShift);
                const lit = mappedMidi !== null && activeNotes.has(mappedMidi);
                return (
                  <button
                    key={kChar}
                    type="button"
                    onPointerDown={() => mappedMidi !== null && onNoteOn(mappedMidi, 102)}
                    onPointerUp={() => mappedMidi !== null && onNoteOff(mappedMidi)}
                    onPointerCancel={() => mappedMidi !== null && onNoteOff(mappedMidi)}
                    onPointerLeave={() => mappedMidi !== null && onNoteOff(mappedMidi)}
                    className={`flex touch-none flex-col items-center justify-center rounded-xl border py-2.5 transition-transform active:scale-95 ${
                      lit ? row.activeCls : row.idleCls
                    }`}
                  >
                    <span className="relative text-sm font-extrabold leading-none">
                      {idx + 1}
                      {row.dot && (
                        <span className="absolute -top-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current" />
                      )}
                    </span>
                    <span className={`mt-1 text-[8px] font-medium ${lit ? "text-[#0a0a0a]/80" : "opacity-65"}`}>
                      {mappedMidi !== null ? midiToName(mappedMidi) : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="mb-3 terminal-box p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c1c1c] pb-2.5">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-[#00ff88]" />
          <span className="text-xs font-bold tracking-wider text-[#ff6a00]">
            PC_KEYBOARD // WORKSTATION
          </span>
          <span className="border border-[#262626] bg-[#080808] px-1.5 py-0.5 text-[10px] text-[#00d4ff]">
            {pcLayout === "jianpu-num"
              ? locale === "zh"
                ? `简谱直弹 · 1=${freeKeySig}`
                : `JIANPU · 1=${freeKeySig}`
              : locale === "zh"
                ? "双排钢琴布局"
                : "CHROMATIC QWERTY"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          {pcLayout === "jianpu-num" && (
            <label className="flex items-center gap-1 border border-[#242424] bg-[#080808] px-2 py-1 text-[#888]">
              <span>{locale === "zh" ? "移调:" : "KEY:"}</span>
              <select
                aria-label="Free Play Key Signature"
                value={freeKeySig}
                onChange={(e) => onChangeFreeKeySig(e.target.value)}
                className="bg-[#080808] font-bold text-[#00ff88] focus:outline-none"
              >
                {KEY_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    1 = {k}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={onToggleSustainLock}
            className={`border px-2.5 py-1 font-bold transition-colors ${
              sustainLock
                ? "border-[#ff6a00] bg-[#211205] text-[#ff6a00]"
                : "border-[#252525] text-[#888] hover:border-[#ff6a00]"
            }`}
          >
            {locale === "zh"
              ? sustainLock
                ? "延音踏板: 锁定"
                : "延音踏板: 关"
              : sustainLock
                ? "SUSTAIN: LOCK"
                : "SUSTAIN: OFF"}
          </button>

          <button
            type="button"
            onClick={onPanicStop}
            className="border border-[#252525] px-2 py-1 text-[#777] hover:text-[#e0e0e0]"
          >
            {locale === "zh" ? "全部止音" : "PANIC"}
          </button>
        </div>
      </div>

      <div className="mt-3">{sharedMagicBar}</div>

      <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="border border-[#1f1f1f] bg-[#080808] p-2.5 text-[10px] lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-[#666]">
            <span>
              {pcLayout === "jianpu-num"
                ? locale === "zh"
                  ? "简谱三八度直弹（按 [ / ] 可把按键左右平移到最左侧低音区）"
                  : "Jianpu 3-Octave Mapping (press [ / ] to shift range left/right)"
                : locale === "zh"
                  ? "标准双排钢琴（Z-M 左手低音 · Q-P 右手旋律 · 按 [ / ] 移动八度）"
                  : "Chromatic QWERTY (Z-M bass · Q-P lead · press [ / ] to shift)"}
            </span>
            <div className="flex items-center gap-1">
              {[
                { shift: -2, label: locale === "zh" ? "低音区" : "BASS" },
                { shift: 0, label: locale === "zh" ? "标准区" : "MID" },
                { shift: 1, label: locale === "zh" ? "高音区" : "HIGH" },
              ].map((z) => (
                <button
                  key={z.shift}
                  type="button"
                  onClick={() => onChangeOctaveShift(z.shift)}
                  className={`border px-1.5 py-0.5 transition-colors ${
                    qwertyOctaveShift === z.shift
                      ? "border-[#00ff88] bg-[#00ff88]/20 font-bold text-[#00ff88]"
                      : "border-[#252525] text-[#777] hover:text-[#e0e0e0]"
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          {pcLayout === "jianpu-num" ? (
            <div className="mt-1.5 space-y-1.5">
              {[
                { tag: locale === "zh" ? `高音 C${5 + qwertyOctaveShift}` : `HI +${qwertyOctaveShift}`, color: "#ff6a00", keys: ["Q", "W", "E", "R", "T", "Y", "U"] },
                { tag: locale === "zh" ? `中音 C${4 + qwertyOctaveShift}` : `MID`, color: "#00ff88", keys: ["A/1", "S/2", "D/3", "F/4", "G/5", "H/6", "J/7"] },
                { tag: locale === "zh" ? `低音 C${3 + qwertyOctaveShift}` : `LOW`, color: "#00d4ff", keys: ["Z", "X", "C", "V", "B", "N", "M"] },
              ].map((row) => (
                <div key={row.tag} className="flex items-center gap-1.5">
                  <span className="w-16 shrink-0 font-bold" style={{ color: row.color }}>
                    {row.tag}
                  </span>
                  <div className="grid flex-1 grid-cols-7 gap-1">
                    {row.keys.map((kLabel, idx) => {
                      const testKey = kLabel.split("/")[0].toLowerCase();
                      const mappedMidi = resolvePcKeyToMidi(testKey, pcLayout, freeKeySig, qwertyOctaveShift);
                      const lit = mappedMidi !== null && activeNotes.has(mappedMidi);
                      return (
                        <button
                          key={kLabel}
                          type="button"
                          onPointerDown={() => mappedMidi !== null && onNoteOn(mappedMidi, 100)}
                          onPointerUp={() => mappedMidi !== null && onNoteOff(mappedMidi)}
                          onPointerLeave={() => mappedMidi !== null && onNoteOff(mappedMidi)}
                          className={`border py-1 text-center font-bold transition-colors ${
                            lit
                              ? "border-[#00ff88] bg-[#00ff88] text-[#0a0a0a]"
                              : "border-[#252525] bg-[#101010] text-[#ccc] hover:border-[#ff6a00]"
                          }`}
                        >
                          <div>{kLabel}</div>
                          <div className="text-[8px] font-normal text-[#777]">{idx + 1}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-1.5 space-y-1.5 text-[10px]">
              <div className="border border-[#1c1c1c] bg-[#0d0d0d] px-2.5 py-1.5 text-[#ff6a00]">
                C{4 + qwertyOctaveShift}–E{5 + qwertyOctaveShift}:{" "}
                <span className="text-[#e0e0e0]">Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P</span>
              </div>
              <div className="border border-[#1c1c1c] bg-[#0d0d0d] px-2.5 py-1.5 text-[#00d4ff]">
                C{3 + qwertyOctaveShift}–B{3 + qwertyOctaveShift}:{" "}
                <span className="text-[#e0e0e0]">Z S X D C V G B H N J M</span>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Diatonic Chord Pads + Live Note Trail */}
        <div className="flex flex-col justify-between gap-2 border border-[#1f1f1f] bg-[#080808] p-2.5 text-xs lg:col-span-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[9px] text-[#666]">
              <span>
                {locale === "zh"
                  ? `1100 伴奏和弦垫 (按住发声 · 1=${freeKeySig})`
                  : `CHORD PADS (HOLD · 1=${freeKeySig})`}
              </span>
              <div className="flex items-center gap-1.5">
                {arrangerStyle !== "off" && (
                  <button
                    type="button"
                    onClick={onToggleArrangerActive}
                    className={`border px-1.5 py-0.5 font-bold ${
                      arrangerActive
                        ? "border-[#00d4ff] bg-[#00d4ff] text-[#0a0a0a]"
                        : "border-[#00d4ff]/50 text-[#00d4ff]"
                    }`}
                  >
                    {arrangerActive ? `■ ${arrangerChord}` : `▶ ${arrangerChord}`}
                  </button>
                )}
                <span className="text-[#a855f7]">LH OCT 3</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {chordsList.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onPointerDown={() => {
                    onSelectChordPad(sym);
                    for (const m of chordToMidiNotes(sym, 3)) {
                      onNoteOn(m, 82, { rawChordPad: true });
                    }
                  }}
                  onPointerUp={() => {
                    for (const m of chordToMidiNotes(sym, 3)) {
                      onNoteOff(m, { rawChordPad: true });
                    }
                  }}
                  onPointerLeave={() => {
                    for (const m of chordToMidiNotes(sym, 3)) {
                      onNoteOff(m, { rawChordPad: true });
                    }
                  }}
                  className="border border-[#282828] bg-[#101010] py-1.5 text-xs font-bold text-[#00d4ff] transition-colors hover:border-[#00d4ff] active:bg-[#00d4ff] active:text-[#0a0a0a]"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#181818] pt-2">
            <div className="text-[9px] text-[#555]">NOTE_TRAIL</div>
            <div className="mt-1 flex min-h-[20px] flex-wrap gap-1">
              {noteTrail.length === 0 ? (
                <span className="text-[10px] text-[#444]">
                  {locale === "zh" ? "敲击电脑键盘开始演奏..." : "Press any mapped key..."}
                </span>
              ) : (
                noteTrail.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="border border-[#222] bg-[#0e0e0e] px-1.5 py-0.5 text-[10px] text-[#00ff88]"
                  >
                    {n}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
