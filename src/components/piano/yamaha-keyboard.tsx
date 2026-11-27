"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { HandSide, SynthVoiceId, YamahaModelId } from "@/types/music";
import { computeKeyboardLayout, findMidiAtNormalizedPoint } from "@/lib/music/keyboard-layout";
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
  zoom?: 1 | 2 | 3;
  onZoomChange?: (z: 1 | 2 | 3) => void;
  immersiveMobile?: boolean;
  compactHeight?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onScrollSync?: (scrollLeft: number) => void;
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
  zoom,
  onZoomChange,
  immersiveMobile = false,
  compactHeight = false,
  scrollContainerRef,
  onScrollSync,
}: YamahaKeyboardProps) {
  const { locale } = useI18n();
  const profile = YAMAHA_PROFILES[model];
  const pointerMidiRef = useRef<Map<number, number>>(new Map());
  const localScrollRef = useRef<HTMLDivElement | null>(null);
  const [internalZoom, setInternalZoom] = useState<1 | 2 | 3>(1);
  const [panPct, setPanPct] = useState<number>(38);

  const activeZoom = zoom ?? internalZoom;
  const setZoom = onZoomChange ?? setInternalZoom;
  const activeScrollRef = scrollContainerRef ?? localScrollRef;

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

  const resolvePointerMidi = (e: ReactPointerEvent<HTMLDivElement>): number | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    return findMidiAtNormalizedPoint(normX, normY, layout);
  };

  const releasePointer = (pointerId: number) => {
    const prevMidi = pointerMidiRef.current.get(pointerId);
    if (prevMidi === undefined) return;
    pointerMidiRef.current.delete(pointerId);
    for (const heldMidi of pointerMidiRef.current.values()) {
      if (heldMidi === prevMidi) return;
    }
    onNoteOff(prevMidi);
  };

  const handleKeybedPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const midi = resolvePointerMidi(e);
    if (midi === null) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore on synthetic pointers
    }
    pointerMidiRef.current.set(e.pointerId, midi);
    onNoteOn(midi, 102);
  };

  const handleKeybedPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerMidiRef.current.has(e.pointerId)) return;
    const nextMidi = resolvePointerMidi(e);
    const prevMidi = pointerMidiRef.current.get(e.pointerId);
    if (nextMidi === prevMidi) return;

    if (prevMidi !== undefined) {
      pointerMidiRef.current.delete(e.pointerId);
      let stillHeld = false;
      for (const heldMidi of pointerMidiRef.current.values()) {
        if (heldMidi === prevMidi) {
          stillHeld = true;
          break;
        }
      }
      if (!stillHeld) onNoteOff(prevMidi);
    }

    if (nextMidi !== null) {
      pointerMidiRef.current.set(e.pointerId, nextMidi);
      onNoteOn(nextMidi, 102);
    }
  };

  const applyPanPercent = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    setPanPct(clamped);
    const el = activeScrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextLeft = (maxScroll * clamped) / 100;
    el.scrollLeft = nextLeft;
    onScrollSync?.(nextLeft);
  };

  const handleZoomSelect = (z: 1 | 2 | 3) => {
    setZoom(z);
    if (z > 1) {
      requestAnimationFrame(() => applyPanPercent(42));
    } else {
      requestAnimationFrame(() => applyPanPercent(0));
    }
  };

  return (
    <div
      className={
        immersiveMobile
          ? "w-full shrink-0 select-none border-t border-white/10 bg-[#09090d]"
          : "w-full select-none overflow-hidden rounded-b-2xl border border-white/10 bg-[#0b0b10] shadow-xl"
      }
    >
      {/* Desktop / Standard Studio Workstation Header + Clickable Graphic LCD */}
      {!immersiveMobile && (
        <div className="grid grid-cols-1 gap-2 border-b border-white/10 bg-[#101017] px-3 py-2 lg:grid-cols-12 lg:items-center">
          {/* Left: Clean Model Identifier */}
          <div className="flex items-center gap-2 lg:col-span-3">
            <span className="inline-block h-2 w-2 rounded-full bg-[#ff6a00] shadow-[0_0_8px_#ff6a00]" />
            <span className="font-mono text-xs font-bold tracking-wider text-white">
              {profile.shortName}
            </span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#00d4ff]">
              {profile.keys}K
            </span>
          </div>

          {/* Center: Interactive Yamaha Retro Graphic LCD Display (click voice inside LCD to change!) */}
          <div className="yamaha-lcd px-3 py-1.5 font-mono lg:col-span-6">
            <div className="hidden items-center justify-between border-b border-[#183326] pb-1 text-[9px] text-[#45b880] sm:flex">
              <span>BANK: {activeVoiceMeta.yamahaBank}</span>
              <span>SPLIT: {midiToName(splitMidi)}</span>
              <span>VEL: {String(lastVelocity || 0).padStart(3, "0")}</span>
              <span className={sustainDown ? "font-bold text-[#ff6a00]" : ""}>
                PEDAL: {sustainDown ? "ON" : "OFF"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              {onVoiceChange ? (
                <select
                  aria-label="Synth Voice"
                  value={voice}
                  onChange={(e) => onVoiceChange(e.target.value as SynthVoiceId)}
                  className="max-w-[200px] cursor-pointer bg-transparent text-xs font-bold text-[#00ff88] glow-green focus:outline-none"
                  title={locale === "zh" ? "点击直接切换内置音色" : "Click to switch synth voice"}
                >
                  {SYNTH_VOICES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#08150e] text-[#00ff88]">
                      {v.code} {locale === "zh" ? v.labelZh : v.labelEn}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="truncate text-xs font-bold text-[#00ff88] glow-green">
                  {activeVoiceMeta.code}{" "}
                  {locale === "zh" ? activeVoiceMeta.labelZh : activeVoiceMeta.labelEn}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <span className="text-[#569475]">NOTES:</span>
                <span
                  className="min-w-[56px] max-w-[160px] truncate rounded border border-[#1c4430] bg-[#040d08] px-1.5 py-0.5 text-center text-[#00d4ff]"
                  title={activeList.length > 0 ? activeList.map((m) => midiToName(m)).join(" + ") : "---"}
                >
                  {activeList.length > 0
                    ? activeList.map((m) => midiToName(m)).join("+")
                    : "---"}
                </span>
                {liveChord && (
                  <span className="rounded border border-[#ff6a00]/60 bg-[#211205] px-1.5 py-0.5 text-[#ff6a00]">
                    {liveChord}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Octave Shift, Zoom, Input Status Pill */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 font-mono lg:col-span-3 lg:justify-end">
            {onOctaveShiftChange && (
              <div className="hidden items-center rounded-lg border border-white/10 bg-[#0b0b10] text-[10px] sm:flex">
                <button
                  type="button"
                  onClick={() => onOctaveShiftChange(-1)}
                  className="px-1.5 py-1 text-[#00d4ff] hover:text-white"
                  title={locale === "zh" ? "键盘映射左移八度 (快捷键 [ )" : "Shift PC keys left 1 octave ([)"}
                >
                  ◀
                </button>
                <span className="px-1 text-[#00ff88]" title="Active PC key range">
                  {pcCoverage?.rangeLabel ?? (qwertyOctaveShift >= 0 ? `+${qwertyOctaveShift}` : qwertyOctaveShift)}
                </span>
                <button
                  type="button"
                  onClick={() => onOctaveShiftChange(1)}
                  className="px-1.5 py-1 text-[#ff6a00] hover:text-white"
                  title={locale === "zh" ? "键盘映射右移八度 (快捷键 ] )" : "Shift PC keys right 1 octave (])"}
                >
                  ▶
                </button>
              </div>
            )}

            <div className="flex items-center rounded-lg border border-white/10 bg-[#0b0b10] p-0.5 text-[10px]">
              {([1, 2, 3] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => handleZoomSelect(z)}
                  className={`rounded-md px-1.5 py-0.5 font-bold transition-colors ${
                    activeZoom === z
                      ? "bg-[#ff6a00] text-[#0a0a0a]"
                      : "text-[#8a8a98] hover:text-white"
                  }`}
                  title={locale === "zh" ? `琴键缩放 ${z}x` : `Keybed zoom ${z}x`}
                >
                  {z}x
                </button>
              ))}
            </div>

            <span
              className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${
                midiConnected
                  ? "border-[#00ff88]/40 bg-[#081a10] text-[#00ff88]"
                  : micActive
                    ? "border-[#00d4ff]/50 bg-[#071820] text-[#00d4ff]"
                    : !profile.hasMidiPort
                      ? "border-[#a855f7]/40 bg-[#160c20] text-[#c084fc]"
                      : "border-white/10 bg-[#14141b] text-[#8a8a98]"
              }`}
              title={
                midiDeviceName ||
                (locale === "zh" ? profile.midiPortDescZh : profile.midiPortDescEn)
              }
            >
              {midiConnected
                ? `MIDI: ${midiDeviceName?.slice(0, 8) || "ON"}`
                : micActive
                  ? `MIC: ${micPitchLabel || "ON"}`
                  : !profile.hasMidiPort
                    ? "MIC/CAM"
                    : "KEY/TOUCH"}
            </span>
          </div>
        </div>
      )}

      {/* Compact Range Slider & Zoom Strip */}
      {(immersiveMobile || activeZoom > 1) && (
        <div
          className={
            immersiveMobile
              ? "flex items-center gap-1.5 border-b border-white/10 bg-[#0d0d13] px-2.5 py-1.5 text-[10px]"
              : "flex items-center gap-2 border-b border-[#1b1b1b] bg-[#090909] px-3 py-1 text-[10px]"
          }
        >
          {activeZoom > 1 ? (
            <>
              <button
                type="button"
                onClick={() => applyPanPercent(panPct - 18)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[#00d4ff] active:bg-white/15"
              >
                ◀ {locale === "zh" ? "低" : "L"}
              </button>
              <input
                type="range"
                aria-label="Pan Keybed"
                min={0}
                max={100}
                value={panPct}
                onChange={(e) => applyPanPercent(Number(e.target.value))}
                className="h-1.5 flex-1 accent-[#ff6a00]"
              />
              <button
                type="button"
                onClick={() => applyPanPercent(45)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-semibold text-[#ff8b33]"
              >
                C4
              </button>
              <button
                type="button"
                onClick={() => applyPanPercent(panPct + 18)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[#00d4ff] active:bg-white/15"
              >
                {locale === "zh" ? "高" : "H"} ▶
              </button>
            </>
          ) : (
            <span className="flex-1 truncate text-[10px] font-medium text-[#8a8a98]">
              {profile.shortName} · {profile.keys}K
            </span>
          )}

          {immersiveMobile && activeList.length > 0 && (
            <span className="max-w-[74px] truncate rounded-full bg-[#00d4ff]/15 px-2 py-0.5 font-bold text-[#00d4ff]">
              {liveChord || activeList.map((m) => midiToName(m)).join("+")}
            </span>
          )}

          {immersiveMobile && (
            <button
              type="button"
              onClick={() => {
                const next = activeZoom === 1 ? 2 : activeZoom === 2 ? 3 : 1;
                handleZoomSelect(next);
              }}
              className="rounded-md border border-[#ff6a00]/40 bg-[#ff6a00]/15 px-2 py-0.5 font-bold text-[#ff8b33]"
              title={locale === "zh" ? "切换琴键宽度缩放" : "Cycle keybed zoom"}
            >
              {activeZoom}x
            </button>
          )}
        </div>
      )}

      {/* Multi-Touch & Glissando Piano Keybed */}
      <div
        ref={activeScrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const maxScroll = el.scrollWidth - el.clientWidth;
          if (maxScroll > 0) setPanPct(Math.round((el.scrollLeft / maxScroll) * 100));
          onScrollSync?.(el.scrollLeft);
        }}
        className="w-full overflow-x-auto overflow-y-hidden touch-pan-x"
      >
        <div
          onPointerDown={handleKeybedPointerDown}
          onPointerMove={handleKeybedPointerMove}
          onPointerUp={(e) => releasePointer(e.pointerId)}
          onPointerCancel={(e) => releasePointer(e.pointerId)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: `${activeZoom * 100}%` }}
          className={`relative touch-none select-none overflow-hidden bg-[#060606] ${
            immersiveMobile ? (compactHeight ? "h-28" : "h-44") : "h-32 sm:h-40"
          }`}
        >
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
          {!immersiveMobile && showQwertyHints && pcCoverage && (
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
          const mappedQwerty =
            !immersiveMobile && showQwertyHints
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
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNoteOn(k.midi, 102);
                  setTimeout(() => onNoteOff(k.midi), 220);
                }
              }}
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
          const mappedBlack =
            !immersiveMobile && showQwertyHints
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
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNoteOn(k.midi, 102);
                  setTimeout(() => onNoteOff(k.midi), 220);
                }
              }}
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
    </div>
  );
}
