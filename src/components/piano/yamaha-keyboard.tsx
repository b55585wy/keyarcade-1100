"use client";

import { useMemo, useRef } from "react";
import type { HandSide, SynthVoiceId, YamahaModelId } from "@/types/music";
import { computeKeyboardLayout } from "@/lib/music/keyboard-layout";
import { MIDI_TO_QWERTY, SYNTH_VOICES, YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import { detectChord, midiToName } from "@/lib/music/theory";
import { useI18n } from "@/lib/i18n";

export interface TargetKeyHint {
  midi: number;
  hand: HandSide;
  finger?: number;
}

interface YamahaKeyboardProps {
  model: YamahaModelId;
  activeNotes: Set<number>;
  targetHints: TargetKeyHint[];
  splitMidi: number;
  voice: SynthVoiceId;
  onVoiceChange?: (v: SynthVoiceId) => void;
  onNoteOn: (midi: number, velocity?: number) => void;
  onNoteOff: (midi: number) => void;
  midiConnected: boolean;
  midiDeviceName?: string;
  micActive?: boolean;
  micPitchLabel?: string;
  lastVelocity: number;
  sustainDown: boolean;
  showQwertyHints?: boolean;
  pcKeyLabels?: Record<number, string>;
  qwertyOctaveShift?: number;
  onOctaveShiftChange?: (delta: number) => void;
}

export function YamahaKeyboard({
  model,
  activeNotes,
  targetHints,
  splitMidi,
  voice,
  onVoiceChange,
  onNoteOn,
  onNoteOff,
  midiConnected,
  midiDeviceName,
  micActive = false,
  micPitchLabel,
  lastVelocity,
  sustainDown,
  showQwertyHints = true,
  pcKeyLabels,
  qwertyOctaveShift = 0,
  onOctaveShiftChange,
}: YamahaKeyboardProps) {
  const { locale } = useI18n();
  const profile = YAMAHA_PROFILES[model];
  const pointerDownRef = useRef<Set<number>>(new Set());

  const layout = useMemo(
    () => computeKeyboardLayout(profile.minMidi, profile.maxMidi),
    [profile.minMidi, profile.maxMidi],
  );

  const targetMap = useMemo(() => {
    const m = new Map<number, TargetKeyHint>();
    for (const h of targetHints) m.set(h.midi, h);
    return m;
  }, [targetHints]);

  const activeList = useMemo(() => [...activeNotes].sort((a, b) => a - b), [activeNotes]);
  const liveChord = useMemo(() => detectChord(activeList), [activeList]);
  const activeVoiceMeta = SYNTH_VOICES.find((v) => v.id === voice) ?? SYNTH_VOICES[0];

  const pcCoverage = useMemo(() => {
    const labelSource = pcKeyLabels ?? MIDI_TO_QWERTY;
    const midis = Object.keys(labelSource)
      .map((k) => parseInt(k, 10) + qwertyOctaveShift * 12)
      .filter((m) => m >= profile.minMidi && m <= profile.maxMidi);
    if (midis.length === 0) return null;
    const minM = Math.min(...midis);
    const maxM = Math.max(...midis);
    const leftRect = layout.byMidi.get(minM);
    const rightRect = layout.byMidi.get(maxM);
    if (!leftRect || !rightRect) return null;
    return {
      leftPct: leftRect.x * 100,
      widthPct: (rightRect.x + rightRect.w - leftRect.x) * 100,
      rangeLabel: `${midiToName(minM)}–${midiToName(maxM)}`,
    };
  }, [layout.byMidi, pcKeyLabels, profile.maxMidi, profile.minMidi, qwertyOctaveShift]);

  const handlePress = (midi: number) => {
    if (pointerDownRef.current.has(midi)) return;
    pointerDownRef.current.add(midi);
    onNoteOn(midi, 102);
  };

  const handleRelease = (midi: number) => {
    if (!pointerDownRef.current.has(midi)) return;
    pointerDownRef.current.delete(midi);
    onNoteOff(midi);
  };

  return (
    <div className="w-full select-none border-2 border-[#222] bg-[#0b0b0b] shadow-[4px_4px_0_#000]">
      {/* Yamaha 1100 Hardware Control Panel + Graphic LCD */}
      <div className="grid grid-cols-1 gap-2 border-b border-[#222] bg-[#101010] px-3 py-2.5 lg:grid-cols-12 lg:items-center">
        {/* Left: Model badge & hardware description */}
        <div className="flex flex-col gap-0.5 lg:col-span-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-none bg-[#ff6a00] shadow-[0_0_8px_#ff6a00]" />
            <span className="text-xs font-extrabold tracking-widest text-[#e0e0e0]">
              {profile.name}
            </span>
            <span className="border border-[#2a2a2a] bg-[#0a0a0a] px-1.5 py-0.5 text-[10px] text-[#00d4ff]">
              {profile.keys} KEYS
            </span>
          </div>
          <p className="text-[10px] text-[#666]">
            {locale === "zh" ? profile.actionDescZh : profile.actionDescEn}
          </p>
        </div>

        {/* Center: Authentic Yamaha Retro Graphic LCD Display */}
        <div className="yamaha-lcd px-3 py-1.5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#183326] pb-1 text-[9px] text-[#3ea875]">
            <span>VOICE: {activeVoiceMeta.yamahaBank}</span>
            <span>SPLIT: {midiToName(splitMidi)}</span>
            <span>VEL: {String(lastVelocity || 0).padStart(3, "0")}</span>
            <span className={sustainDown ? "text-[#ff6a00] font-bold" : ""}>
              PEDAL:{sustainDown ? "ON" : "OFF"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="truncate text-xs font-bold text-[#00ff88] glow-green">
              {activeVoiceMeta.code} {locale === "zh" ? activeVoiceMeta.labelZh : activeVoiceMeta.labelEn}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5 text-[11px] font-bold">
              <span className="text-[#569475]">NOTES:</span>
              <span
                className="min-w-[60px] max-w-[200px] truncate border border-[#1c4430] bg-[#040d08] px-1.5 py-0.5 text-center text-[#00d4ff]"
                title={activeList.length > 0 ? activeList.map((m) => midiToName(m)).join(" + ") : "---"}
              >
                {activeList.length > 0
                  ? activeList.map((m) => midiToName(m)).join("+")
                  : "---"}
              </span>
              {liveChord && (
                <span className="border border-[#ff6a00]/60 bg-[#211205] px-1.5 py-0.5 text-[#ff6a00]">
                  {liveChord}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Voice selector, QWERTY Octave, MIDI USB LED */}
        <div className="flex flex-wrap items-center justify-between gap-2 lg:col-span-3 lg:justify-end">
          {onVoiceChange && (
            <select
              aria-label="Synth Voice"
              value={voice}
              onChange={(e) => onVoiceChange(e.target.value as SynthVoiceId)}
              className="border border-[#262626] bg-[#080808] px-2 py-1 text-[10px] text-[#e0e0e0] focus:border-[#ff6a00] focus:outline-none"
            >
              {SYNTH_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} {locale === "zh" ? v.labelZh : v.labelEn}
                </option>
              ))}
            </select>
          )}

          {onOctaveShiftChange && (
            <div className="flex items-center border border-[#222] bg-[#080808] text-[10px]">
              <button
                onClick={() => onOctaveShiftChange(-1)}
                className="px-1.5 py-1 text-[#00d4ff] hover:bg-[#142026] hover:text-[#fff]"
                title={locale === "zh" ? "键盘映射左移八度 (快捷键 [ )" : "Shift PC keys left 1 octave ([)"}
              >
                {locale === "zh" ? "◀左移" : "OCT-"}
              </button>
              <span className="px-1.5 text-[#00ff88]" title="Active PC key range">
                {pcCoverage?.rangeLabel ?? (qwertyOctaveShift >= 0 ? `+${qwertyOctaveShift}` : qwertyOctaveShift)}
              </span>
              <button
                onClick={() => onOctaveShiftChange(1)}
                className="px-1.5 py-1 text-[#ff6a00] hover:bg-[#26160a] hover:text-[#fff]"
                title={locale === "zh" ? "键盘映射右移八度 (快捷键 ] )" : "Shift PC keys right 1 octave (])"}
              >
                {locale === "zh" ? "右移▶" : "OCT+"}
              </button>
            </div>
          )}

          <div
            className={`border px-2 py-1 text-[10px] font-bold ${
              midiConnected
                ? "border-[#00ff88]/50 bg-[#081a10] text-[#00ff88]"
                : micActive
                  ? "border-[#00d4ff]/60 bg-[#071820] text-[#00d4ff]"
                  : !profile.hasMidiPort
                    ? "border-[#a855f7]/60 bg-[#160c20] text-[#a855f7]"
                    : "border-[#2a2a2a] bg-[#0d0d0d] text-[#777]"
            }`}
            title={
              midiDeviceName ||
              (locale === "zh" ? profile.midiPortDescZh : profile.midiPortDescEn)
            }
          >
            {midiConnected
              ? `MIDI: ${midiDeviceName?.slice(0, 12) || "ON"}`
              : micActive
                ? `MIC: ${micPitchLabel || "LISTENING"}`
                : !profile.hasMidiPort
                  ? "NO-MIDI · MIC/CAM"
                  : "QWERTY / TOUCH"}
          </div>
        </div>
      </div>

      {/* Piano Keybed */}
      <div className="relative h-28 w-full overflow-hidden bg-[#060606] sm:h-36">
        {/* Split Zone & PC Keyboard Active Coverage Strip */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-2">
          {layout.byMidi.has(splitMidi) && (
            <>
              <div
                className="h-full bg-[#00d4ff]/35"
                style={{ width: `${(layout.byMidi.get(splitMidi)?.x ?? 0.35) * 100}%` }}
              />
              <div className="h-full flex-1 bg-[#ff6a00]/35" />
            </>
          )}
          {showQwertyHints && pcCoverage && (
            <div
              className="absolute top-0 h-full border-x-2 border-[#00ff88] bg-[#00ff88]/25"
              style={{
                left: `${pcCoverage.leftPct}%`,
                width: `${pcCoverage.widthPct}%`,
              }}
            />
          )}
        </div>

        {/* White Keys */}
        {layout.whiteKeys.map((k) => {
          const isPressed = activeNotes.has(k.midi);
          const hint = targetMap.get(k.midi);
          const isMiddleC = k.midi === 60;
          const isCNote = k.midi % 12 === 0;
          const labelSource = pcKeyLabels ?? MIDI_TO_QWERTY;
          const mappedQwerty = showQwertyHints
            ? labelSource[k.midi - qwertyOctaveShift * 12]
            : undefined;

          let bgClass = "bg-[#e9e9e9] hover:bg-[#ffffff]";
          if (isPressed) {
            bgClass = "bg-[#00ff88] shadow-[inset_0_0_12px_rgba(0,0,0,0.35)]";
          } else if (hint) {
            bgClass =
              hint.hand === "right"
                ? "bg-[#ffb178] ring-2 ring-inset ring-[#ff6a00]"
                : "bg-[#80eaff] ring-2 ring-inset ring-[#00d4ff]";
          }

          return (
            <button
              key={k.midi}
              type="button"
              aria-label={midiToName(k.midi)}
              onPointerDown={() => handlePress(k.midi)}
              onPointerUp={() => handleRelease(k.midi)}
              onPointerLeave={() => handleRelease(k.midi)}
              onPointerCancel={() => handleRelease(k.midi)}
              style={{
                left: `${k.x * 100}%`,
                width: `${k.w * 100}%`,
              }}
              className={`absolute top-1.5 bottom-0 border-r border-b border-[#2a2a2a] transition-colors flex flex-col items-center justify-end pb-1.5 ${bgClass}`}
            >
              {hint?.finger && (
                <span
                  className={`mb-1 inline-flex h-4 w-4 items-center justify-center text-[9px] font-extrabold text-[#0a0a0a] ${
                    hint.hand === "right" ? "bg-[#ff6a00]" : "bg-[#00d4ff]"
                  }`}
                >
                  {hint.finger}
                </span>
              )}
              {mappedQwerty && (
                <span className="hidden text-[7px] font-bold text-[#555] sm:inline">
                  {mappedQwerty}
                </span>
              )}
              {isCNote && (
                <span
                  className={`text-[8px] font-bold leading-none ${
                    isMiddleC ? "text-[#ff6a00]" : "text-[#555]"
                  }`}
                >
                  {midiToName(k.midi)}
                </span>
              )}
            </button>
          );
        })}

        {/* Black Keys */}
        {layout.blackKeys.map((k) => {
          const isPressed = activeNotes.has(k.midi);
          const hint = targetMap.get(k.midi);
          const labelSource = pcKeyLabels ?? MIDI_TO_QWERTY;
          const mappedBlack = showQwertyHints
            ? labelSource[k.midi - qwertyOctaveShift * 12]
            : undefined;

          let bgClass = "bg-[#161616] border-[#050505] hover:bg-[#2a2a2a]";
          if (isPressed) {
            bgClass = "bg-[#00ff88] border-[#00aa55] text-[#0a0a0a]";
          } else if (hint) {
            bgClass =
              hint.hand === "right"
                ? "bg-[#ff6a00] border-[#ffaa66] text-[#0a0a0a]"
                : "bg-[#00d4ff] border-[#88eeff] text-[#0a0a0a]";
          }

          return (
            <button
              key={k.midi}
              type="button"
              aria-label={midiToName(k.midi)}
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePress(k.midi);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                handleRelease(k.midi);
              }}
              onPointerLeave={() => handleRelease(k.midi)}
              onPointerCancel={() => handleRelease(k.midi)}
              style={{
                left: `${k.x * 100}%`,
                width: `${k.w * 100}%`,
              }}
              className={`absolute top-1.5 h-[60%] z-10 border-x border-b-2 shadow-[0_3px_0_#000] transition-colors flex flex-col items-center justify-end pb-1 ${bgClass}`}
            >
              {hint?.finger ? (
                <span className="text-[8px] font-extrabold leading-none text-[#0a0a0a]">
                  {hint.finger}
                </span>
              ) : (
                mappedBlack && (
                  <span className="hidden text-[6px] font-bold leading-none text-[#777] sm:inline">
                    {mappedBlack}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
