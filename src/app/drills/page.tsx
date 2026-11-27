"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Target, Zap, RotateCcw } from "lucide-react";
import { YamahaKeyboard } from "@/components/piano/yamaha-keyboard";
import { PixelPet, emitNotePet } from "@/components/pixel-pet";
import { dispatchEarIqNote, EarIqGame } from "@/components/drills/ear-iq-game";
import { useWebMidi } from "@/hooks/use-web-midi";
import { audioEngine } from "@/lib/music/audio-engine";
import { chordToMidiNotes, midiToName, midiToStaffPosition } from "@/lib/music/theory";
import { QWERTY_TO_MIDI } from "@/lib/music/yamaha-profiles";
import {
  completeDailyPlanStep,
  getAcademyStats,
  getStoredModel,
  recordPlaySession,
  subscribeStore,
} from "@/lib/storage/academy-store";
import type { SynthVoiceId, YamahaModelId } from "@/types/music";
import { useI18n } from "@/lib/i18n";
import { playSfx } from "@/lib/sfx";

type DrillPackId = "triads" | "sevenths" | "sightread" | "ear-iq";

const CHORD_PACKS: Record<"triads" | "sevenths", string[]> = {
  triads: ["C", "F", "G", "Am", "Dm", "Em", "D", "A", "E"],
  sevenths: ["G7", "Cmaj7", "Am7", "Dm7", "Fmaj7", "E7", "D7", "C7"],
};

const SIGHT_READ_POOL = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 48, 50, 52, 53, 55, 57, 59];

function DrillsInner() {
  const { locale } = useI18n();
  const sp = useSearchParams();
  const tabParam = sp.get("tab");
  const capsuleParam = sp.get("capsule");
  const [pack, setPack] = useState<DrillPackId>(
    tabParam === "ear-iq" || tabParam === "sevenths" || tabParam === "sightread" ? tabParam : "triads",
  );
  const [model, setModel] = useState<YamahaModelId>("kbp1100");
  const [voice, setVoice] = useState<SynthVoiceId>("yamaha-ep");
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [sustainDown, setSustainDown] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [bestEarIq, setBestEarIq] = useState<number | undefined>(undefined);

  const [promptIdx, setPromptIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setModel(getStoredModel());
      setBestEarIq(getAcademyStats().earIq?.bestIq);
    };
    sync();
    return subscribeStore(sync);
  }, []);

  const currentChallenge = useMemo(() => {
    if (pack === "ear-iq") {
      return { label: "EAR IQ", targetMidis: [] as number[], isChord: false };
    }
    if (pack === "sightread") {
      const midi = SIGHT_READ_POOL[promptIdx % SIGHT_READ_POOL.length];
      return {
        label: midiToName(midi),
        targetMidis: [midi],
        isChord: false,
      };
    }
    const pool = CHORD_PACKS[pack];
    const symbol = pool[promptIdx % pool.length];
    return {
      label: symbol,
      targetMidis: chordToMidiNotes(symbol, 4),
      isChord: true,
    };
  }, [pack, promptIdx]);

  const advanceChallenge = useCallback(() => {
    setStreak((s) => s + 1);
    setCleared((c) => {
      const next = c + 1;
      if (next % 5 === 0) {
        if (capsuleParam) completeDailyPlanStep(capsuleParam);
        recordPlaySession({
          id: `drill-${Date.now()}`,
          songId: `drill-${pack}`,
          songTitle: `Dojo: ${pack.toUpperCase()}`,
          model,
          mode: "wait",
          score: next * 300,
          accuracy: 100,
          maxCombo: streak + 1,
          perfectCount: 5,
          greatCount: 0,
          goodCount: 0,
          missCount: 0,
          rank: "S+",
          xpEarned: 60,
          playedAt: new Date().toISOString(),
        });
        playSfx("powerup");
      } else {
        playSfx("coin");
      }
      return next;
    });
    emitNotePet("combo");
    setFeedback(`CLEAR! ${currentChallenge.label}`);
    setPromptIdx((idx) => idx + 1 + Math.floor(Math.random() * 2));
  }, [capsuleParam, currentChallenge.label, model, pack, streak]);

  const checkMatch = useCallback(
    (heldSet: Set<number>) => {
      if (pack === "ear-iq" || currentChallenge.targetMidis.length === 0) return;
      if (currentChallenge.isChord) {
        const targetPcs = new Set(currentChallenge.targetMidis.map((m) => m % 12));
        const heldPcs = new Set([...heldSet].map((m) => m % 12));
        const allFound = [...targetPcs].every((pc) => heldPcs.has(pc));
        if (allFound) {
          advanceChallenge();
        }
      } else {
        if (heldSet.has(currentChallenge.targetMidis[0])) {
          advanceChallenge();
        }
      }
    },
    [advanceChallenge, currentChallenge, pack],
  );

  const onNoteOn = useCallback(
    (midi: number, velocity = 98) => {
      audioEngine.noteOn(midi, velocity);
      if (pack === "ear-iq") dispatchEarIqNote(midi);
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.add(midi);
        checkMatch(next);
        return next;
      });
    },
    [checkMatch, pack],
  );

  const onNoteOff = useCallback((midi: number) => {
    audioEngine.noteOff(midi);
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  }, []);

  const webMidi = useWebMidi({
    onNoteOn: (e) => onNoteOn(e.midi, e.velocity),
    onNoteOff,
    onSustainChange: (d) => {
      setSustainDown(d);
      audioEngine.setSustain(d);
    },
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const m = QWERTY_TO_MIDI[e.key.toLowerCase()];
      if (m !== undefined) onNoteOn(m, 96);
    };
    const up = (e: KeyboardEvent) => {
      const m = QWERTY_TO_MIDI[e.key.toLowerCase()];
      if (m !== undefined) onNoteOff(m);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onNoteOff, onNoteOn]);

  const targetHints =
    showHints && pack !== "ear-iq"
      ? currentChallenge.targetMidis.map((midi) => ({
          midi,
          hand: midi >= 60 ? ("right" as const) : ("left" as const),
        }))
      : [];

  // Mini staff note for sightread
  const sightPos =
    pack === "sightread" && currentChallenge.targetMidis[0] !== undefined
      ? midiToStaffPosition(currentChallenge.targetMidis[0])
      : null;
  const isBass =
    pack === "sightread" &&
    currentChallenge.targetMidis[0] !== undefined &&
    currentChallenge.targetMidis[0] < 60;

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 font-mono sm:px-4">
      <div className="mb-4 terminal-box p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1d1d1d] pb-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold text-[#ff6a00]">
              <Zap className="h-5 w-5" />
              {locale === "zh" ? "雅马哈 1100 和弦与识谱道场" : "YAMAHA 1100 CHORD & SIGHT-READ DOJO"}
            </h1>
            <p className="mt-1 text-xs text-[#666]">
              {locale === "zh"
                ? "专练雅马哈自动伴奏常用左手和弦与五线谱即时反应，每过 5 题奖励 +60 XP！"
                : "Drill Yamaha arranger accompaniment chords and flash sight-reading. +60 XP every 5 clears!"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <PixelPet label={`STREAK ${streak}`} />
            <div className="border border-[#222] bg-[#080808] px-3 py-1.5 text-center">
              <div className="text-[9px] text-[#555]">CLEARED</div>
              <div className="text-sm font-bold text-[#00ff88]">{cleared}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap border border-[#222] bg-[#080808] text-xs">
            {(
              [
                ["triads", locale === "zh" ? "基础三和弦" : "TRIADS"],
                ["sevenths", locale === "zh" ? "流行七和弦" : "7TH CHORDS"],
                ["sightread", locale === "zh" ? "五线谱识谱" : "SIGHT-READ"],
                ["ear-iq", locale === "zh" ? "1分钟耳朵 IQ" : "EAR IQ 60s"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setPack(id);
                  setPromptIdx(0);
                  setFeedback(null);
                }}
                className={`px-3 py-1.5 font-bold ${
                  pack === id ? "bg-[#ff6a00] text-[#0a0a0a]" : "text-[#888] hover:text-[#e0e0e0]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setShowHints((h) => !h)}
              className={`border px-2.5 py-1 ${
                showHints
                  ? "border-[#00d4ff] text-[#00d4ff]"
                  : "border-[#222] text-[#666]"
              }`}
            >
              {locale === "zh" ? (showHints ? "琴键提示: 开" : "琴键提示: 关") : showHints ? "HINTS: ON" : "HINTS: OFF"}
            </button>
            <button
              onClick={() => {
                setStreak(0);
                setCleared(0);
                setFeedback(null);
              }}
              className="flex items-center gap-1 border border-[#222] px-2.5 py-1 text-[#777] hover:text-[#e0e0e0]"
            >
              <RotateCcw className="h-3 w-3" />
              RESET
            </button>
          </div>
        </div>

        {/* Target Challenge Card OR 60s Ear IQ Mode */}
        {pack === "ear-iq" ? (
          <EarIqGame locale={locale} bestEarIq={bestEarIq} />
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center border border-[#222] bg-[#080808] py-6 text-center">
            <div className="flex items-center gap-1.5 text-[10px] tracking-widest text-[#666]">
              <Target className="h-3.5 w-3.5 text-[#ff6a00]" />
              {currentChallenge.isChord
                ? locale === "zh"
                  ? "请同时按下和弦组成音 (任意转位均可)"
                  : "PLAY CHORD (ANY INVERSION)"
                : locale === "zh"
                  ? "请弹出五线谱所示音符"
                  : "PLAY THE SHOWN STAFF NOTE"}
            </div>

            {currentChallenge.isChord ? (
              <div className="mt-3 text-5xl font-extrabold text-[#ff6a00] glow-orange">
                {currentChallenge.label}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-6">
                <svg viewBox="0 0 180 96" className="h-24 w-44 border border-[#1d1d1d] bg-[#0c0c0c]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line key={i} x1={16} x2={164} y1={24 + i * 10} y2={24 + i * 10} stroke="#333" />
                  ))}
                  <text x={20} y={56} fill="#777" fontSize="30" fontFamily="serif">
                    {isBass ? "𝄢" : "𝄞"}
                  </text>
                  {sightPos && (
                    <>
                      {(() => {
                        const topStep = isBass ? 26 : 38;
                        const cy = 24 + (topStep - sightPos.step) * 5;
                        return (
                          <g>
                            {sightPos.step === 28 && (
                              <line x1={88} x2={112} y1={cy} y2={cy} stroke="#666" strokeWidth={1.5} />
                            )}
                            <ellipse cx={100} cy={cy} rx={6} ry={4.5} fill="#00ff88" />
                          </g>
                        );
                      })()}
                    </>
                  )}
                </svg>
                {showHints && (
                  <div className="text-3xl font-bold text-[#00d4ff]">{currentChallenge.label}</div>
                )}
              </div>
            )}

            <div className="mt-2 h-5 text-xs font-bold text-[#00ff88]">
              {feedback || (
                <span className="text-[#555]">
                  {currentChallenge.targetMidis.map((m) => midiToName(m)).join(" + ")}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <YamahaKeyboard
        model={model}
        activeNotes={activeNotes}
        targetHints={targetHints}
        splitMidi={54}
        voice={voice}
        onVoiceChange={(v) => {
          setVoice(v);
          audioEngine.setVoice(v);
        }}
        onNoteOn={onNoteOn}
        onNoteOff={onNoteOff}
        midiConnected={webMidi.devices.length > 0}
        midiDeviceName={webMidi.devices[0]?.name}
        lastVelocity={webMidi.lastVelocity}
        sustainDown={sustainDown}
      />
    </div>
  );
}

export default function DrillsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#666]">Loading dojo...</div>}>
      <DrillsInner />
    </Suspense>
  );
}
