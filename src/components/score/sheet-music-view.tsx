"use client";

import { useMemo, useState } from "react";
import type { Song } from "@/types/music";
import { buildSheetMeasures, type SheetMeasure, type StaffEvent } from "@/lib/music/sheet-generator";
import { getKeySpec } from "@/lib/music/theory";
import { useI18n } from "@/lib/i18n";

interface SheetMusicViewProps {
  song: Song;
  currentBeat: number;
  activeMidis?: Set<number>;
  onJumpToBeat?: (beat: number) => void;
  compact?: boolean;
}

type ViewNotationMode = "dual" | "staff" | "jianpu";

const TREBLE_TOP_Y = 30; // F5 (step 38)
const BASS_TOP_Y = 98;  // A3 (step 26)
const STEP_PX = 4;      // half-space = 4px, line gap = 8px

function trebleY(step: number): number {
  return TREBLE_TOP_Y + (38 - step) * STEP_PX;
}

function bassY(step: number): number {
  return BASS_TOP_Y + (26 - step) * STEP_PX;
}

function getLedgerSteps(step: number, clef: "treble" | "bass"): number[] {
  const lines: number[] = [];
  if (clef === "treble") {
    for (let s = 28; s >= step; s -= 2) lines.push(s);
    for (let s = 40; s <= step; s += 2) lines.push(s);
  } else {
    for (let s = 28; s <= step; s += 2) lines.push(s);
    for (let s = 16; s >= step; s -= 2) lines.push(s);
  }
  return lines;
}

function formatJianpuDisplay(ev: StaffEvent): string {
  return ev.notes
    .map((n) => `${n.jianpu.accidental}${n.jianpu.degree}`)
    .join("/");
}

function MeasureSvgCard({
  measure,
  song,
  isCurrentMeasure,
  currentBeat,
  showStaff,
  showJianpu,
  onClickMeasure,
}: {
  measure: SheetMeasure;
  song: Song;
  isCurrentMeasure: boolean;
  currentBeat: number;
  showStaff: boolean;
  showJianpu: boolean;
  onClickMeasure?: (beat: number) => void;
}) {
  const W = 320;
  const H = 160;
  const clefPad = measure.measureIndex === 0 ? 54 : 30;
  const usableW = W - clefPad - 18;
  const keySpec = getKeySpec(song.keySignature);

  const beatToX = (beatInMeasure: number) =>
    clefPad + (beatInMeasure / Math.max(1, measure.beatsPerMeasure)) * usableW;

  const progressInMeasure = isCurrentMeasure
    ? Math.max(0, Math.min(measure.beatsPerMeasure, currentBeat - measure.startBeat))
    : -1;

  const renderClefEvents = (events: StaffEvent[], clef: "treble" | "bass") => {
    const yFn = clef === "treble" ? trebleY : bassY;
    const midStep = clef === "treble" ? 34 : 22;

    return events.map((ev) => {
      const x = beatToX(ev.beatInMeasure);
      const isActive =
        isCurrentMeasure &&
        Math.abs(currentBeat - ev.globalBeat) <= Math.max(0.45, ev.durationBeats * 0.65);

      const baseColor = ev.hand === "right" ? "#ff6a00" : "#00d4ff";
      const color = isActive ? "#00ff88" : baseColor;
      const isHollow = ev.noteType === "whole" || ev.noteType === "half";
      const hasStem = ev.noteType !== "whole";

      const steps = ev.notes.map((n) => n.step);
      const avgStep = steps.reduce((a, b) => a + b, 0) / Math.max(1, steps.length);
      const stemUp = avgStep < midStep;
      const minStep = Math.min(...steps);
      const maxStep = Math.max(...steps);

      return (
        <g key={ev.id}>
          {ev.notes.map((n, idx) => {
            const cy = yFn(n.step);
            const ledgers = getLedgerSteps(n.step, clef);
            const headOffset = idx > 0 && Math.abs(n.step - ev.notes[idx - 1].step) === 1 ? 7 : 0;

            return (
              <g key={`${ev.id}-${n.midi}-${idx}`}>
                {/* Ledger lines */}
                {ledgers.map((ls) => (
                  <line
                    key={ls}
                    x1={x - 9}
                    x2={x + 9}
                    y1={yFn(ls)}
                    y2={yFn(ls)}
                    stroke="#444"
                    strokeWidth={1.2}
                  />
                ))}
                {/* Accidental */}
                {n.accidental && (
                  <text
                    x={x - 12}
                    y={cy + 3.5}
                    fill={color}
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {n.accidental === "#" ? "♯" : "♭"}
                  </text>
                )}
                {/* Notehead */}
                <ellipse
                  cx={x + headOffset}
                  cy={cy}
                  rx={4.5}
                  ry={3.2}
                  transform={`rotate(-18 ${x + headOffset} ${cy})`}
                  fill={isHollow ? "#0c0c0c" : color}
                  stroke={color}
                  strokeWidth={1.6}
                />
                {/* Augmentation dot */}
                {ev.dotted && (
                  <circle cx={x + headOffset + 7.5} cy={cy - 1} r={1.6} fill={color} />
                )}
                {/* Finger number */}
                {n.finger && idx === ev.notes.length - 1 && (
                  <text
                    x={x + headOffset}
                    y={clef === "treble" ? Math.min(cy - 9, TREBLE_TOP_Y - 8) : Math.max(cy + 14, BASS_TOP_Y + 42)}
                    textAnchor="middle"
                    fill="#999"
                    fontSize="8"
                  >
                    {n.finger}
                  </text>
                )}
              </g>
            );
          })}

          {/* Stem & Flag */}
          {hasStem && (
            <>
              <line
                x1={stemUp ? x + 4 : x - 4}
                x2={stemUp ? x + 4 : x - 4}
                y1={yFn(stemUp ? minStep : maxStep)}
                y2={yFn(stemUp ? maxStep : minStep) + (stemUp ? -22 : 22)}
                stroke={color}
                strokeWidth={1.4}
              />
              {(ev.noteType === "eighth" || ev.noteType === "sixteenth") && (
                <path
                  d={
                    stemUp
                      ? `M ${x + 4} ${yFn(maxStep) - 22} Q ${x + 11} ${yFn(maxStep) - 16} ${x + 9} ${yFn(maxStep) - 9}`
                      : `M ${x - 4} ${yFn(minStep) + 22} Q ${x + 4} ${yFn(minStep) + 16} ${x + 2} ${yFn(minStep) + 9}`
                  }
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                />
              )}
              {ev.noteType === "sixteenth" && (
                <path
                  d={
                    stemUp
                      ? `M ${x + 4} ${yFn(maxStep) - 16} Q ${x + 11} ${yFn(maxStep) - 10} ${x + 9} ${yFn(maxStep) - 3}`
                      : `M ${x - 4} ${yFn(minStep) + 16} Q ${x + 4} ${yFn(minStep) + 10} ${x + 2} ${yFn(minStep) + 3}`
                  }
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                />
              )}
            </>
          )}
        </g>
      );
    });
  };

  return (
    <div
      onClick={() => onClickMeasure?.(measure.startBeat)}
      className={`group cursor-pointer border transition-all ${
        isCurrentMeasure
          ? "border-[#ff6a00] bg-[#13100d] shadow-[0_0_16px_rgba(255,106,0,0.18)]"
          : "border-[#222] bg-[#0c0c0c] hover:border-[#444]"
      }`}
    >
      {/* Measure Header */}
      <div className="flex items-center justify-between border-b border-[#191919] px-2.5 py-1 text-[10px]">
        <span className={isCurrentMeasure ? "font-bold text-[#ff6a00]" : "text-[#555]"}>
          M{String(measure.measureIndex + 1).padStart(2, "0")}
        </span>
        <div className="flex items-center gap-1.5">
          {measure.chords.map((c, idx) => (
            <span
              key={idx}
              className="border border-[#00d4ff]/40 bg-[#08161a] px-1.5 py-0.2 text-[9px] font-bold text-[#00d4ff]"
            >
              {c.symbol}
            </span>
          ))}
        </div>
      </div>

      {/* Grand Staff SVG */}
      {showStaff && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          {/* Measure playhead */}
          {progressInMeasure >= 0 && (
            <line
              x1={beatToX(progressInMeasure)}
              x2={beatToX(progressInMeasure)}
              y1={14}
              y2={H - 8}
              stroke="#00ff88"
              strokeWidth={1.8}
              strokeDasharray="3 2"
            />
          )}

          {/* Treble 5 lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`tr-${i}`}
              x1={8}
              x2={W - 6}
              y1={TREBLE_TOP_Y + i * 8}
              y2={TREBLE_TOP_Y + i * 8}
              stroke="#2a2a2a"
              strokeWidth={1}
            />
          ))}

          {/* Bass 5 lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`bs-${i}`}
              x1={8}
              x2={W - 6}
              y1={BASS_TOP_Y + i * 8}
              y2={BASS_TOP_Y + i * 8}
              stroke="#2a2a2a"
              strokeWidth={1}
            />
          ))}

          {/* Left brace + right barline */}
          <line x1={8} x2={8} y1={TREBLE_TOP_Y} y2={BASS_TOP_Y + 32} stroke="#555" strokeWidth={2} />
          <line x1={W - 6} x2={W - 6} y1={TREBLE_TOP_Y} y2={BASS_TOP_Y + 32} stroke="#444" strokeWidth={1.4} />

          {/* Clef symbols */}
          <text x={11} y={TREBLE_TOP_Y + 28} fill="#777" fontSize="28" fontFamily="serif">
            𝄞
          </text>
          <text x={11} y={BASS_TOP_Y + 23} fill="#777" fontSize="22" fontFamily="serif">
            𝄢
          </text>

          {/* Key & Time Signature on Measure 1 */}
          {measure.measureIndex === 0 && (
            <g>
              <text x={33} y={TREBLE_TOP_Y + 13} fill="#ff6a00" fontSize="11" fontWeight="bold">
                {song.timeSignature[0]}
              </text>
              <text x={33} y={TREBLE_TOP_Y + 28} fill="#ff6a00" fontSize="11" fontWeight="bold">
                {song.timeSignature[1]}
              </text>
              <text x={33} y={BASS_TOP_Y + 13} fill="#00d4ff" fontSize="11" fontWeight="bold">
                {song.timeSignature[0]}
              </text>
              <text x={33} y={BASS_TOP_Y + 28} fill="#00d4ff" fontSize="11" fontWeight="bold">
                {song.timeSignature[1]}
              </text>
              {keySpec.fifths !== 0 && (
                <text x={43} y={TREBLE_TOP_Y + 10} fill="#aaa" fontSize="9">
                  {keySpec.fifths > 0 ? `${keySpec.fifths}♯` : `${Math.abs(keySpec.fifths)}♭`}
                </text>
              )}
            </g>
          )}

          {/* Notes */}
          {renderClefEvents(measure.trebleEvents, "treble")}
          {renderClefEvents(measure.bassEvents, "bass")}
        </svg>
      )}

      {/* Jianpu (简谱) Row */}
      {showJianpu && (
        <div className="border-t border-[#181818] bg-[#080808] px-2.5 py-2">
          <div className="mb-1 flex items-center justify-between text-[9px] text-[#555]">
            <span>RH 简谱 (1={song.keySignature})</span>
            {measure.bassEvents.length > 0 && <span>LH: {measure.bassEvents.length} notes</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {measure.trebleEvents.length === 0 ? (
              <span className="text-[#444]">—</span>
            ) : (
              measure.trebleEvents.map((ev) => {
                const isActive =
                  isCurrentMeasure &&
                  Math.abs(currentBeat - ev.globalBeat) <= Math.max(0.45, ev.durationBeats * 0.65);
                const topOct = Math.max(0, ev.notes[0]?.jianpu.octaveOffset ?? 0);
                const botOct = Math.max(0, -(ev.notes[0]?.jianpu.octaveOffset ?? 0));
                const dashes = ev.durationBeats >= 2 ? " -".repeat(Math.floor(ev.durationBeats) - 1) : "";
                const under =
                  ev.noteType === "sixteenth"
                    ? "border-b-2 border-double"
                    : ev.noteType === "eighth"
                      ? "border-b"
                      : "";

                return (
                  <span
                    key={ev.id}
                    className={`inline-flex flex-col items-center leading-none px-1 py-0.5 ${
                      isActive ? "bg-[#00ff88]/20 text-[#00ff88] font-bold" : "text-[#e0e0e0]"
                    }`}
                  >
                    <span className="h-2 text-[8px] text-[#ff6a00]">
                      {topOct > 0 ? "•".repeat(Math.min(2, topOct)) : ""}
                    </span>
                    <span className={`${under} ${isActive ? "border-[#00ff88]" : "border-[#666]"}`}>
                      {formatJianpuDisplay(ev)}
                      {ev.dotted ? "·" : ""}
                      {dashes}
                    </span>
                    <span className="h-2 text-[8px] text-[#00d4ff]">
                      {botOct > 0 ? "•".repeat(Math.min(2, botOct)) : ""}
                    </span>
                  </span>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SheetMusicView({
  song,
  currentBeat,
  onJumpToBeat,
  compact = false,
}: SheetMusicViewProps) {
  const { locale } = useI18n();
  const [mode, setMode] = useState<ViewNotationMode>("dual");

  const measures = useMemo(() => buildSheetMeasures(song), [song]);

  const currentMeasureIndex = useMemo(() => {
    const idx = measures.findIndex(
      (m) => currentBeat >= m.startBeat && currentBeat < m.startBeat + m.beatsPerMeasure,
    );
    return idx >= 0 ? idx : 0;
  }, [currentBeat, measures]);

  return (
    <div className="terminal-box p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#1c1c1c] pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#ff6a00]">
              {locale === "zh" ? "自动生成双谱视图" : "AUTO-GENERATED SCORE"}
            </span>
            <span className="border border-[#262626] bg-[#0a0a0a] px-1.5 py-0.5 text-[10px] text-[#00ff88]">
              1={song.keySignature} · {song.timeSignature[0]}/{song.timeSignature[1]} · {song.bpm} BPM
            </span>
            <span className="text-[10px] text-[#666]">{measures.length} bars</span>
          </div>
          <p className="mt-0.5 text-[10px] text-[#555]">
            {locale === "zh"
              ? "点击任意小节可直接跳转播放位置 · 橙色=右手旋律 / 蓝色=左手伴奏 / 绿色=当前演奏音"
              : "Click any measure to seek · Orange=Right Hand / Cyan=Left Hand / Green=Active Playhead"}
          </p>
        </div>

        <div className="flex border border-[#222] bg-[#080808] text-[10px]">
          {(
            [
              ["dual", locale === "zh" ? "五线谱+简谱" : "DUAL"],
              ["staff", locale === "zh" ? "仅五线谱" : "STAFF"],
              ["jianpu", locale === "zh" ? "仅简谱" : "JIANPU"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`px-2.5 py-1 transition-colors ${
                mode === id ? "bg-[#ff6a00] font-bold text-[#0a0a0a]" : "text-[#777] hover:text-[#e0e0e0]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`grid gap-2.5 ${
          compact
            ? "max-h-[320px] overflow-y-auto grid-cols-1 md:grid-cols-2 xl:grid-cols-3 pr-1"
            : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {measures.map((m) => (
          <MeasureSvgCard
            key={m.measureIndex}
            measure={m}
            song={song}
            isCurrentMeasure={m.measureIndex === currentMeasureIndex}
            currentBeat={currentBeat}
            showStaff={mode === "dual" || mode === "staff"}
            showJianpu={mode === "dual" || mode === "jianpu"}
            onClickMeasure={onJumpToBeat}
          />
        ))}
      </div>
    </div>
  );
}
