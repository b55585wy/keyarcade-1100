"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Sparkles,
  Repeat,
  Volume2,
  Keyboard,
  Mic,
  MicOff,
  SlidersHorizontal,
} from "lucide-react";
import type {
  HandFilter,
  HitJudgement,
  PlaySessionRecord,
  PracticeMode,
  Song,
  SynthVoiceId,
  YamahaModelId,
} from "@/types/music";
import {
  getAllSongs,
  getStoredModel,
  recordPlaySession,
  subscribeStore,
} from "@/lib/storage/academy-store";
import {
  KEY_DIATONIC_CHORDS,
  YAMAHA_PROFILES,
  getMidiToPcKeyMap,
  resolvePcKeyToMidi,
  type PcKeyboardLayoutId,
} from "@/lib/music/yamaha-profiles";
import { chordToMidiNotes, midiToName } from "@/lib/music/theory";
import { audioEngine } from "@/lib/music/audio-engine";
import { exportSongToMidi } from "@/lib/music/midi-exporter";
import { useWebMidi } from "@/hooks/use-web-midi";
import { useMicPitch } from "@/hooks/use-mic-pitch";
import { FallingNotesCanvas } from "./falling-notes-canvas";
import { YamahaKeyboard, type TargetKeyHint } from "../piano/yamaha-keyboard";
import { SheetMusicView } from "../score/sheet-music-view";
import { CamTutorPanel, emitCamNotePlayed } from "../vision/cam-tutor-panel";
import { PixelPet, emitNotePet } from "../pixel-pet";
import { playSfx } from "@/lib/sfx";
import { useI18n } from "@/lib/i18n";

interface ArcadeStudioProps {
  initialSongId?: string;
}

function subscribeViewportResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

function getIsNarrowMobile(): boolean {
  return window.innerWidth < 640;
}

export function ArcadeStudio({ initialSongId }: ArcadeStudioProps) {
  const { locale } = useI18n();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string>(initialSongId || "twinkle-star");
  const [model, setModel] = useState<YamahaModelId>("kbp1100");
  const [voiceOverride, setVoiceOverride] = useState<SynthVoiceId | null>(null);
  const [mode, setMode] = useState<PracticeMode>("wait");
  const [handFilter, setHandFilter] = useState<HandFilter>("both");
  const [tempoScale, setTempoScale] = useState<number>(1.0);
  const [metronomeOn, setMetronomeOn] = useState<boolean>(true);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [showSheet, setShowSheet] = useState<boolean>(true);
  const [qwertyOctaveShift, setQwertyOctaveShift] = useState<number>(0);
  const [pcLayout, setPcLayout] = useState<PcKeyboardLayoutId>("jianpu-num");
  const [freeKeySig, setFreeKeySig] = useState<string>("C");
  const [sustainLock, setSustainLock] = useState<boolean>(false);
  const [noteTrail, setNoteTrail] = useState<string[]>([]);
  const [zoomOverride, setZoomOverride] = useState<1 | 2 | 3 | null>(null);
  const [mobileToolsOpen, setMobileToolsOpen] = useState<boolean>(false);
  const isNarrowMobile = useSyncExternalStore(
    subscribeViewportResize,
    getIsNarrowMobile,
    () => false,
  );
  const keybedZoom: 1 | 2 | 3 = zoomOverride ?? (isNarrowMobile ? 2 : 1);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const keybedScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncLockRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isNarrowMobile || zoomOverride !== null) return;
    const raf = requestAnimationFrame(() => {
      for (const el of [keybedScrollRef.current, canvasScrollRef.current]) {
        if (!el) continue;
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 0) el.scrollLeft = maxScroll * 0.42;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [isNarrowMobile, model, zoomOverride]);

  // Playback & grading runtime state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentSec, setCurrentSec] = useState<number>(-0.8);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [sustainDown, setSustainDown] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [counts, setCounts] = useState({ PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 });
  const [lastBanner, setLastBanner] = useState<{ text: string; color: string; at: number } | null>(null);
  const [completionModal, setCompletionModal] = useState<PlaySessionRecord | null>(null);
  const [hitStatusMap, setHitStatusMap] = useState<Map<string, HitJudgement>>(() => new Map());

  const hitStatusMapRef = useRef<Map<string, HitJudgement>>(new Map());
  const demoPlayingRef = useRef<Set<string>>(new Set());
  const lastBeatClickRef = useRef<number>(-1);
  const currentSecRef = useRef<number>(-0.8);
  const activePcKeysRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    currentSecRef.current = currentSec;
  }, [currentSec]);

  useEffect(() => {
    const sync = () => {
      const list = getAllSongs();
      setSongs(list);
      setModel(getStoredModel());
      if (initialSongId && list.some((s) => s.id === initialSongId)) {
        setSelectedSongId(initialSongId);
      }
    };
    sync();
    return subscribeStore(sync);
  }, [initialSongId]);

  const song = useMemo(
    () => songs.find((s) => s.id === selectedSongId) ?? songs[0],
    [selectedSongId, songs],
  );

  const voice = voiceOverride ?? song?.recommendedVoice ?? "grand-piano";

  useEffect(() => {
    audioEngine.setVoice(voice);
  }, [voice]);

  const filteredNotes = useMemo(() => {
    if (!song) return [];
    return song.notes
      .filter((n) => handFilter === "both" || n.hand === handFilter)
      .sort((a, b) => a.startSec - b.startSec || a.midi - b.midi);
  }, [handFilter, song]);

  const songTotalSec = useMemo(() => {
    if (!song || song.notes.length === 0) return 10;
    return Math.max(...song.notes.map((n) => n.startSec + n.durationSec)) + 1.2;
  }, [song]);

  const currentBeat = useMemo(() => {
    if (!song) return 0;
    return Math.max(0, (currentSec * song.bpm) / 60);
  }, [currentSec, song]);

  const pausePlayback = useCallback(() => {
    audioEngine.stopAll();
    demoPlayingRef.current.clear();
    setActiveNotes(new Set());
    setIsPlaying(false);
  }, []);

  // Reset run state
  const resetSession = useCallback((startPlay = false) => {
    audioEngine.stopAll();
    const empty = new Map<string, HitJudgement>();
    hitStatusMapRef.current = empty;
    setHitStatusMap(empty);
    demoPlayingRef.current.clear();
    lastBeatClickRef.current = -1;
    setActiveNotes(new Set());
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setCounts({ PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 });
    setLastBanner(null);
    setCompletionModal(null);
    const startSec = startPlay ? -0.8 : 0;
    currentSecRef.current = startSec;
    setCurrentSec(startSec);
    setIsPlaying(startPlay);
  }, []);

  const finalizeRun = useCallback(() => {
    if (!song) return;
    setIsPlaying(false);
    setActiveNotes(new Set());
    audioEngine.stopAll();
    if (mode === "listen") return;

    const total = Math.max(1, filteredNotes.length);
    const hits = counts.PERFECT + counts.GREAT + counts.GOOD;
    const accuracy = Math.round(((counts.PERFECT + counts.GREAT * 0.8 + counts.GOOD * 0.5) / total) * 100);
    const rank: PlaySessionRecord["rank"] =
      accuracy >= 96 ? "S+" : accuracy >= 90 ? "S" : accuracy >= 80 ? "A" : accuracy >= 68 ? "B" : "C";
    const xpEarned = Math.max(25, Math.round(score / 45 + accuracy * 1.4));

    const record: PlaySessionRecord = {
      id: `run-${Date.now()}`,
      songId: song.id,
      songTitle: locale === "zh" && song.titleZh ? song.titleZh : song.title,
      model,
      mode,
      score,
      accuracy: Math.min(100, Math.max(0, accuracy)),
      maxCombo,
      perfectCount: counts.PERFECT,
      greatCount: counts.GREAT,
      goodCount: counts.GOOD,
      missCount: Math.max(counts.MISS, total - hits),
      rank,
      xpEarned,
      playedAt: new Date().toISOString(),
    };

    recordPlaySession(record);
    setCompletionModal(record);
    playSfx(rank === "S+" || rank === "S" ? "podium_first" : "powerup");
  }, [counts, filteredNotes.length, locale, maxCombo, mode, model, score, song]);

  const registerJudgement = useCallback((noteId: string, judgement: HitJudgement) => {
    const nextMap = new Map(hitStatusMapRef.current);
    nextMap.set(noteId, judgement);
    hitStatusMapRef.current = nextMap;
    setHitStatusMap(nextMap);

    if (judgement === "MISS") {
      setCombo(0);
      setCounts((c) => ({ ...c, MISS: c.MISS + 1 }));
      setLastBanner({ text: "MISS", color: "#ff4444", at: performance.now() });
      emitNotePet("miss");
      return;
    }

    const pts = judgement === "PERFECT" ? 300 : judgement === "GREAT" ? 200 : 100;
    setCombo((prev) => {
      const next = prev + 1;
      setMaxCombo((m) => Math.max(m, next));
      setScore((s) => s + pts + Math.min(200, next * 10));
      if (next > 0 && next % 10 === 0) {
        playSfx("coin");
        emitNotePet("combo");
      } else {
        emitNotePet("perfect");
      }
      return next;
    });
    setCounts((c) => ({ ...c, [judgement]: c[judgement] + 1 }));
    setLastBanner({
      text: judgement,
      color: judgement === "PERFECT" ? "#00ff88" : judgement === "GREAT" ? "#ff6a00" : "#00d4ff",
      at: performance.now(),
    });
  }, []);

  // Determine current target notes for WAIT mode & keyboard hints
  const nextPendingStepNotes = useMemo(() => {
    const unhit = filteredNotes.filter((n) => !hitStatusMap.has(n.id));
    if (unhit.length === 0) return [];
    const firstSec = unhit[0].startSec;
    return unhit.filter((n) => Math.abs(n.startSec - firstSec) <= 0.045);
  }, [filteredNotes, hitStatusMap]);

  const targetHints = useMemo<TargetKeyHint[]>(() => {
    if (mode === "free") {
      return [];
    }
    if (mode === "wait") {
      return nextPendingStepNotes.map((n) => ({
        midi: n.midi,
        hand: n.hand,
        finger: n.finger,
      }));
    }
    // In arcade/listen mode, preview upcoming notes within 0.35s
    const upcoming = filteredNotes.filter(
      (n) => n.startSec >= currentSec - 0.1 && n.startSec <= currentSec + 0.35,
    );
    return upcoming.map((n) => ({
      midi: n.midi,
      hand: n.hand,
      finger: n.finger,
    }));
  }, [currentSec, filteredNotes, mode, nextPendingStepNotes]);

  const activeKeySig = mode === "free" ? freeKeySig : song?.keySignature ?? "C";
  const pcKeyLabels = useMemo(
    () => getMidiToPcKeyMap(pcLayout, activeKeySig),
    [activeKeySig, pcLayout],
  );

  const handleUserNoteOn = useCallback(
    (midi: number, velocity = 98, opts?: { silent?: boolean }) => {
      if (!opts?.silent) audioEngine.noteOn(midi, velocity);
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.add(midi);
        return next;
      });
      setNoteTrail((prev) => [...prev.slice(-11), midiToName(midi)]);
      emitCamNotePlayed({ midi });

      if (!isPlaying || !song || mode === "listen" || mode === "free") return;

      const t = currentSecRef.current;
      if (mode === "wait") {
        const waitingMatch = nextPendingStepNotes.find((n) => n.midi === midi);
        if (waitingMatch && t >= waitingMatch.startSec - 0.35) {
          registerJudgement(waitingMatch.id, "PERFECT");
          return;
        }
      }

      let bestNote = null as (typeof filteredNotes)[0] | null;
      let bestDiff = Infinity;
      for (const n of filteredNotes) {
        if (n.midi !== midi || hitStatusMapRef.current.has(n.id)) continue;
        const diff = Math.abs(n.startSec - t);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestNote = n;
        }
      }
      if (bestNote && bestDiff <= 0.28) {
        const j: HitJudgement = bestDiff <= 0.09 ? "PERFECT" : bestDiff <= 0.17 ? "GREAT" : "GOOD";
        registerJudgement(bestNote.id, j);
      }
    },
    [filteredNotes, isPlaying, mode, nextPendingStepNotes, registerJudgement, song],
  );

  const handleUserNoteOff = useCallback((midi: number, opts?: { silent?: boolean }) => {
    if (!opts?.silent) audioEngine.noteOff(midi);
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  }, []);

  const webMidi = useWebMidi({
    onNoteOn: (ev) => {
      emitNotePet("midi");
      handleUserNoteOn(ev.midi, ev.velocity);
    },
    onNoteOff: handleUserNoteOff,
    onSustainChange: (down) => {
      setSustainDown(down);
      audioEngine.setSustain(down);
    },
  });

  const handleMicNoteOn = useCallback(
    (midi: number, velocity: number) => {
      emitNotePet("midi");
      handleUserNoteOn(midi, velocity, { silent: true });
    },
    [handleUserNoteOn],
  );

  const handleMicNoteOff = useCallback(
    (midi: number) => {
      handleUserNoteOff(midi, { silent: true });
    },
    [handleUserNoteOff],
  );

  const micPitch = useMicPitch({
    onNoteOn: handleMicNoteOn,
    onNoteOff: handleMicNoteOff,
  });

  const profile = YAMAHA_PROFILES[model];

  // Computer QWERTY & Jianpu keyboard binding
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "Shift") {
        setSustainDown(true);
        audioEngine.setSustain(true);
        return;
      }

      const k = e.key.toLowerCase();
      if (k === "[") {
        setQwertyOctaveShift((prev) => Math.max(-2, prev - 1));
        return;
      }
      if (k === "]") {
        setQwertyOctaveShift((prev) => Math.min(2, prev + 1));
        return;
      }

      if (k === " ") {
        e.preventDefault();
        if (mode === "free") {
          setSustainDown(true);
          audioEngine.setSustain(true);
        } else if (isPlaying) {
          pausePlayback();
        } else {
          setIsPlaying(true);
        }
        return;
      }

      const midi = resolvePcKeyToMidi(k, pcLayout, activeKeySig, qwertyOctaveShift);
      if (midi !== null) {
        activePcKeysRef.current.set(k, midi);
        handleUserNoteOn(midi, 100);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        if (!sustainLock) {
          setSustainDown(false);
          audioEngine.setSustain(false);
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === " " && mode === "free") {
        if (!sustainLock) {
          setSustainDown(false);
          audioEngine.setSustain(false);
        }
        return;
      }
      const heldMidi = activePcKeysRef.current.get(k);
      if (heldMidi !== undefined) {
        activePcKeysRef.current.delete(k);
        handleUserNoteOff(heldMidi);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [
    activeKeySig,
    handleUserNoteOff,
    handleUserNoteOn,
    isPlaying,
    mode,
    pausePlayback,
    pcLayout,
    qwertyOctaveShift,
    sustainLock,
  ]);

  // Main 60fps animation & game loop
  useEffect(() => {
    if (!isPlaying || !song) return;

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000) * tempoScale;
      lastTs = now;

      let nextSec = currentSecRef.current + dt;

      if (mode === "wait" && nextPendingStepNotes.length > 0) {
        const stopAt = nextPendingStepNotes[0].startSec;
        if (nextSec >= stopAt) {
          nextSec = stopAt;
        }
      }

      if (metronomeOn && nextSec >= 0 && mode !== "wait") {
        const beatIdx = Math.floor((nextSec * song.bpm) / 60);
        if (beatIdx !== lastBeatClickRef.current && beatIdx >= 0) {
          lastBeatClickRef.current = beatIdx;
          audioEngine.playMetronomeClick(beatIdx % song.timeSignature[0] === 0);
        }
      }

      if (mode === "listen") {
        const activeNow = new Set<number>();
        for (const n of filteredNotes) {
          const inWindow = nextSec >= n.startSec && nextSec <= n.startSec + n.durationSec;
          if (inWindow) {
            activeNow.add(n.midi);
            if (!demoPlayingRef.current.has(n.id)) {
              demoPlayingRef.current.add(n.id);
              audioEngine.noteOn(n.midi, n.velocity);
            }
          } else if (demoPlayingRef.current.has(n.id)) {
            demoPlayingRef.current.delete(n.id);
            audioEngine.noteOff(n.midi);
          }
        }
        setActiveNotes(activeNow);
      } else if (mode === "arcade") {
        for (const n of filteredNotes) {
          if (!hitStatusMapRef.current.has(n.id) && nextSec - n.startSec > 0.3) {
            registerJudgement(n.id, "MISS");
          }
        }
      }

      if (nextSec >= songTotalSec) {
        if (loopEnabled) {
          resetSession(true);
          return;
        }
        setCurrentSec(songTotalSec);
        finalizeRun();
        return;
      }

      currentSecRef.current = nextSec;
      setCurrentSec(nextSec);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      audioEngine.stopAll();
    };
  }, [
    filteredNotes,
    finalizeRun,
    isPlaying,
    loopEnabled,
    metronomeOn,
    mode,
    nextPendingStepNotes,
    registerJudgement,
    resetSession,
    song,
    songTotalSec,
    tempoScale,
  ]);

  const handleExportMidi = () => {
    if (!song) return;
    const bytes = exportSongToMidi(song);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.id}.mid`;
    a.click();
    URL.revokeObjectURL(url);
    playSfx("success");
  };

  if (!song) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-center text-xs text-[#666]">
        Loading 1100 song bank...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-2 py-2.5 font-mono sm:px-4 sm:py-5">
      {/* Top Telemetry + Controls Bar */}
      <div className="mb-2 terminal-box p-2 sm:mb-3 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Song Selector */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#ff6a00]">
              SONG://
            </span>
            <select
              aria-label="Select Song"
              value={song.id}
              onChange={(e) => {
                setSelectedSongId(e.target.value);
                setVoiceOverride(null);
                resetSession(false);
              }}
              className="min-w-0 flex-1 max-w-full truncate border border-[#2a2a2a] bg-[#080808] px-2 py-1 text-[11px] font-bold text-[#e0e0e0] focus:border-[#ff6a00] focus:outline-none sm:max-w-sm sm:px-2.5 sm:py-1.5 sm:text-xs"
            >
              {songs.map((s) => (
                <option key={s.id} value={s.id}>
                  [Lv.{s.difficulty}] {locale === "zh" && s.titleZh ? s.titleZh : s.title} ({s.keySignature})
                </option>
              ))}
            </select>

            <button
              onClick={handleExportMidi}
              className="hidden shrink-0 items-center gap-1 border border-[#242424] bg-[#0d0d0d] px-2 py-1.5 text-[10px] text-[#888] hover:border-[#00d4ff] hover:text-[#00d4ff] sm:flex"
              title="Export Standard MIDI (.mid) for Yamaha & Casio 1100"
            >
              <Download className="h-3 w-3" />
              .MID
            </button>
          </div>

          {/* Score / Combo / Pet HUD */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="border border-[#222] bg-[#080808] px-2 py-0.5 text-right sm:px-2.5 sm:py-1">
              <div className="text-[8px] text-[#555] sm:text-[9px]">SCORE</div>
              <div className="text-xs font-bold text-[#ff6a00] sm:text-sm">
                {String(score).padStart(6, "0")}
              </div>
            </div>
            <div className="border border-[#222] bg-[#080808] px-2 py-0.5 text-right sm:px-2.5 sm:py-1">
              <div className="text-[8px] text-[#555] sm:text-[9px]">COMBO</div>
              <div className="text-xs font-bold text-[#00ff88] sm:text-sm">{combo}x</div>
            </div>
            <div className="hidden sm:block">
              <PixelPet
                label={
                  webMidi.yamahaDetected
                    ? "MIDI:OK"
                    : micPitch.active
                      ? "MIC:OK"
                      : !profile.hasMidiPort
                        ? "NO-MIDI"
                        : "QWERTY"
                }
              />
            </div>
          </div>
        </div>

        {/* Transport & Teaching Controls */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-[#1c1c1c] pt-2 text-xs sm:mt-3 sm:gap-2 sm:pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                if (isPlaying) {
                  pausePlayback();
                } else if (currentSec >= songTotalSec - 0.1) {
                  resetSession(true);
                } else {
                  setIsPlaying(true);
                }
              }}
              className={`pixel-border flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold transition-colors sm:px-4 sm:text-xs ${
                isPlaying
                  ? "bg-[#00ff88] text-[#0a0a0a]"
                  : "bg-[#ff6a00] text-[#0a0a0a] hover:bg-[#ff8533]"
              }`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying
                ? locale === "zh"
                  ? "暂停"
                  : "PAUSE"
                : locale === "zh"
                  ? "开始练琴"
                  : "PLAY"}
            </button>

            <button
              onClick={() => resetSession(false)}
              className="flex items-center gap-1 border border-[#252525] bg-[#0d0d0d] px-2 py-1.5 text-[10px] text-[#888] hover:border-[#ff6a00] hover:text-[#e0e0e0] sm:px-2.5 sm:text-[11px]"
            >
              <RotateCcw className="h-3 w-3" />
              {locale === "zh" ? "重来" : "RESET"}
            </button>

            {/* Primary Mode Selector */}
            <div className="flex border border-[#252525] bg-[#080808] text-[10px]">
              {(
                [
                  ["wait", locale === "zh" ? "跟弹" : "WAIT"],
                  ["arcade", locale === "zh" ? "街机" : "ARCADE"],
                  ["listen", locale === "zh" ? "示范" : "DEMO"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    resetSession(false);
                  }}
                  className={`px-2 py-1.5 font-bold transition-colors sm:px-2.5 ${
                    mode === m
                      ? "bg-[#ff6a00] text-[#0a0a0a]"
                      : "text-[#777] hover:text-[#e0e0e0]"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMode("free");
                  resetSession(false);
                }}
                className={`hidden px-2.5 py-1.5 font-bold transition-colors sm:inline-block ${
                  mode === "free"
                    ? "bg-[#ff6a00] text-[#0a0a0a]"
                    : "text-[#777] hover:text-[#e0e0e0]"
                }`}
              >
                {locale === "zh" ? "电脑键盘演奏" : "PC KEYBOARD"}
              </button>
            </div>

            {/* Quick MIC toggle visible on row 2 for no-MIDI keyboards (e.g. CTK-1100) */}
            {(!profile.hasMidiPort || micPitch.active) && (
              <button
                onClick={() => (micPitch.active ? micPitch.stopMic() : void micPitch.startMic())}
                className={`flex items-center gap-1 border px-2 py-1.5 text-[10px] font-bold sm:hidden ${
                  micPitch.active
                    ? "border-[#00d4ff] bg-[#071820] text-[#00d4ff]"
                    : "border-[#a855f7]/70 text-[#a855f7]"
                }`}
              >
                {micPitch.active ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                {micPitch.active ? micPitch.lastPitch?.noteName ?? "MIC" : "MIC"}
              </button>
            )}

            {/* Mobile expandable tool drawer trigger */}
            <button
              type="button"
              onClick={() => setMobileToolsOpen((o) => !o)}
              className={`ml-auto flex items-center gap-1 border px-2 py-1.5 text-[10px] font-bold sm:hidden ${
                mobileToolsOpen
                  ? "border-[#00d4ff] bg-[#071820] text-[#00d4ff]"
                  : "border-[#252525] bg-[#0d0d0d] text-[#999]"
              }`}
            >
              <SlidersHorizontal className="h-3 w-3" />
              {locale === "zh" ? "工具" : "TOOLS"}
            </button>
          </div>

          <div
            className={`${
              mobileToolsOpen
                ? "mt-1.5 flex w-full flex-wrap items-center gap-1.5 border-t border-[#181818] pt-2"
                : "hidden sm:flex sm:flex-wrap sm:items-center sm:gap-2"
            } text-[10px]`}
          >
            {/* PC Keyboard Mapping Switcher */}
            <div className="hidden border border-[#252525] bg-[#080808] sm:flex">
              {(
                [
                  ["jianpu-num", locale === "zh" ? "简谱 1-7" : "JIANPU 1-7"],
                  ["piano-qwerty", locale === "zh" ? "双排钢琴" : "QWERTY"],
                ] as const
              ).map(([lid, label]) => (
                <button
                  key={lid}
                  onClick={() => setPcLayout(lid)}
                  className={`px-2 py-1 transition-colors ${
                    pcLayout === lid
                      ? "bg-[#00ff88] font-bold text-[#0a0a0a]"
                      : "text-[#777] hover:text-[#e0e0e0]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Hand Filter */}
            <div className="flex border border-[#252525] bg-[#080808]">
              {(
                [
                  ["both", locale === "zh" ? "双手" : "BOTH"],
                  ["right", locale === "zh" ? "右手" : "RH"],
                  ["left", locale === "zh" ? "左手" : "LH"],
                ] as const
              ).map(([h, label]) => (
                <button
                  key={h}
                  onClick={() => setHandFilter(h)}
                  className={`px-2 py-1 transition-colors ${
                    handFilter === h
                      ? "bg-[#00d4ff] font-bold text-[#0a0a0a]"
                      : "text-[#777] hover:text-[#e0e0e0]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1 border border-[#222] bg-[#080808] px-2 py-1 text-[#888]">
              <span>SPD:</span>
              <select
                value={tempoScale}
                onChange={(e) => setTempoScale(parseFloat(e.target.value))}
                className="bg-transparent font-bold text-[#00ff88] focus:outline-none"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1.0x</option>
                <option value="1.25">1.25x</option>
              </select>
            </label>

            <button
              onClick={() => setMetronomeOn((m) => !m)}
              className={`flex items-center gap-1 border px-2 py-1 ${
                metronomeOn
                  ? "border-[#00ff88]/50 text-[#00ff88]"
                  : "border-[#222] text-[#666]"
              }`}
            >
              <Volume2 className="h-3 w-3" />
              {locale === "zh" ? "节拍器" : "METRO"}
            </button>

            <button
              onClick={() => setLoopEnabled((l) => !l)}
              className={`flex items-center gap-1 border px-2 py-1 ${
                loopEnabled
                  ? "border-[#a855f7] text-[#a855f7]"
                  : "border-[#222] text-[#666]"
              }`}
            >
              <Repeat className="h-3 w-3" />
              LOOP
            </button>

            <button
              onClick={() => (micPitch.active ? micPitch.stopMic() : void micPitch.startMic())}
              className={`flex items-center gap-1 border px-2 py-1 ${
                micPitch.active
                  ? "border-[#00d4ff] bg-[#071820] text-[#00d4ff]"
                  : !profile.hasMidiPort
                    ? "border-[#a855f7]/70 text-[#a855f7] hover:border-[#00d4ff] hover:text-[#00d4ff]"
                    : "border-[#222] text-[#666] hover:text-[#e0e0e0]"
              }`}
              title={
                locale === "zh"
                  ? "通过麦克风监听电子琴真实琴音并实时判音 (卡西欧 CTK-1100 无 MIDI 口专用)"
                  : "Detect live piano notes via microphone (for no-MIDI Casio CTK-1100)"
              }
            >
              {micPitch.active ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
              {locale === "zh"
                ? micPitch.active
                  ? `MIC ${micPitch.lastPitch?.noteName ?? "监听中"}`
                  : "MIC 听音判音"
                : micPitch.active
                  ? `MIC ${micPitch.lastPitch?.noteName ?? "ON"}`
                  : "MIC PITCH"}
            </button>

            <button
              onClick={() => setShowSheet((s) => !s)}
              className={`border px-2 py-1 ${
                showSheet
                  ? "border-[#ff6a00]/60 text-[#ff6a00]"
                  : "border-[#222] text-[#666]"
              }`}
            >
              {locale === "zh" ? (showSheet ? "隐藏乐谱" : "显示乐谱") : showSheet ? "HIDE SCORE" : "SHOW SCORE"}
            </button>

            <button
              onClick={() => {
                setMode("free");
                resetSession(false);
              }}
              className={`border px-2 py-1 sm:hidden ${
                mode === "free" ? "border-[#ff6a00] text-[#ff6a00]" : "border-[#222] text-[#777]"
              }`}
            >
              {locale === "zh" ? "键盘模式" : "PC KEYS"}
            </button>

            <button
              onClick={handleExportMidi}
              className="flex items-center gap-1 border border-[#242424] bg-[#0d0d0d] px-2 py-1 text-[#888] sm:hidden"
            >
              <Download className="h-3 w-3" />
              .MID
            </button>
          </div>
        </div>
      </div>

      {/* Mode Tip Banner (desktop only so mobile keeps keyboard in viewport) */}
      <div className="mb-2 hidden flex-wrap items-center justify-between gap-2 border border-[#1d1d1d] bg-[#0c0c0c] px-3 py-1.5 text-[10px] text-[#777] sm:flex">
        <span>
          <span className="text-[#00ff88] font-bold">[MODE:{mode.toUpperCase()}]</span>{" "}
          {mode === "free"
            ? locale === "zh"
              ? "电脑键盘自由演奏：支持「简谱 1-7 / A-J / Q-U」或「双排钢琴 Z-M / Q-P」，按 Shift/Space 踩延音踏板，[ / ] 升降八度！"
              : "PC Keyboard Workstation: play with Jianpu (1-7 / A-J / Q-U) or Chromatic QWERTY. Hold Shift/Space for Sustain, [ / ] for Octave!"
            : mode === "wait"
              ? locale === "zh"
                ? "跟弹等待：琴键会高亮提示手指编号，弹对音符才继续往下走；支持接 USB/蓝牙 MIDI、MIC 听音或电脑键盘直接弹。"
                : "Wait Mode: playhead pauses on highlighted notes until you press the matching MIDI, Mic Pitch, or PC keys."
              : mode === "arcade"
                ? locale === "zh"
                  ? "街机节奏：按节奏准确敲击掉落音符，追求 PERFECT 连击赚取 S+ 评级与经验值！"
                  : "Rhythm Arcade: hit falling bars on the green laser line for PERFECT combos and XP!"
                : locale === "zh"
                  ? "示范试听：自动播放示范音色并同步走谱，按空格键可随时暂停。"
                  : "Auto Demo: listen to the arrangement while watching synchronized keys and sheet music."}
        </span>
        <span className="text-[#555]">
          {mode === "free"
            ? locale === "zh"
              ? "SHIFT/SPACE=延音 · [/]=八度"
              : "SHIFT/SPACE=Sustain · [/]=Octave"
            : `SPACE = ${locale === "zh" ? "播放/暂停" : "Play/Pause"}`}
        </span>
      </div>

      {/* Casio 1100 Hardware & Mic Pitch Advisory Banner */}
      {(profile.brand === "CASIO" || micPitch.error || micPitch.active) && (
        <div
          className={`mb-2 hidden flex-wrap items-center justify-between gap-2 border px-3 py-1.5 text-[10px] sm:flex ${
            micPitch.error
              ? "border-[#ff4444]/60 bg-[#200b0b] text-[#ff6666]"
              : !profile.hasMidiPort
                ? "border-[#a855f7]/50 bg-[#140b1d] text-[#d8b4fe]"
                : "border-[#00d4ff]/40 bg-[#07151c] text-[#7dd3fc]"
          }`}
        >
          <span>
            {micPitch.error
              ? `[MIC ERR] ${micPitch.error}`
              : !profile.hasMidiPort
                ? locale === "zh"
                  ? `[CASIO CTK-1100 无 MIDI 口适配] ${profile.midiPortDescZh} · 请点击上方「MIC 听音判音」直接听琴声判音，或使用摄像头/电脑键盘。`
                  : `[CASIO CTK-1100 NO-MIDI] ${profile.midiPortDescEn} — Enable MIC PITCH above, or use CAM Coach / PC Keyboard.`
                : locale === "zh"
                  ? `[${profile.name}] ${profile.keys}键 (${midiToName(profile.minMidi)}–${midiToName(profile.maxMidi)}) · ${profile.midiPortDescZh}`
                  : `[${profile.name}] ${profile.keys}-Key (${midiToName(profile.minMidi)}–${midiToName(profile.maxMidi)}) · ${profile.midiPortDescEn}`}
          </span>
          {micPitch.active && micPitch.lastPitch && (
            <span className="font-bold text-[#00ff88]">
              MIC DETECT: {micPitch.lastPitch.noteName} ({micPitch.lastPitch.hz.toFixed(1)}Hz)
            </span>
          )}
        </div>
      )}

      {/* PC Keyboard Workstation Panel (in Free Play) OR Falling Piano Roll */}
      {mode === "free" ? (
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
                    onChange={(e) => setFreeKeySig(e.target.value)}
                    className="bg-[#080808] font-bold text-[#00ff88] focus:outline-none"
                  >
                    {["C", "G", "D", "F", "Bb", "Am"].map((k) => (
                      <option key={k} value={k}>
                        1 = {k}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                onClick={() => {
                  const next = !sustainLock;
                  setSustainLock(next);
                  setSustainDown(next);
                  audioEngine.setSustain(next);
                }}
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
                onClick={() => {
                  audioEngine.stopAll();
                  setActiveNotes(new Set());
                  setNoteTrail([]);
                }}
                className="border border-[#252525] px-2 py-1 text-[#777] hover:text-[#e0e0e0]"
              >
                {locale === "zh" ? "全部止音" : "PANIC"}
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
            {/* PC Keymap Visual Cheat-Sheet */}
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
                      onClick={() => setQwertyOctaveShift(z.shift)}
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
                              onPointerDown={() => mappedMidi !== null && handleUserNoteOn(mappedMidi, 100)}
                              onPointerUp={() => mappedMidi !== null && handleUserNoteOff(mappedMidi)}
                              onPointerLeave={() => mappedMidi !== null && handleUserNoteOff(mappedMidi)}
                              className={`border py-1 text-center font-bold transition-colors ${
                                lit
                                  ? "border-[#00ff88] bg-[#00ff88] text-[#0a0a0a]"
                                  : "border-[#252525] bg-[#101010] text-[#ccc] hover:border-[#ff6a00]"
                              }`}
                            >
                              <div>{kLabel}</div>
                              <div className="text-[8px] font-normal text-[#777]">
                                {idx + 1}
                              </div>
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

            {/* Diatonic Accompaniment Chord Pads + Live Note Trail */}
            <div className="flex flex-col justify-between gap-2 border border-[#1f1f1f] bg-[#080808] p-2.5 text-xs lg:col-span-5">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[9px] text-[#666]">
                  <span>{locale === "zh" ? `1100 伴奏和弦垫 (按住发声 · 1=${freeKeySig})` : `CHORD PADS (HOLD · 1=${freeKeySig})`}</span>
                  <span className="text-[#a855f7]">LH OCT 3</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(KEY_DIATONIC_CHORDS[freeKeySig] ?? KEY_DIATONIC_CHORDS.C).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onPointerDown={() => {
                        for (const m of chordToMidiNotes(sym, 3)) {
                          handleUserNoteOn(m, 82);
                        }
                      }}
                      onPointerUp={() => {
                        for (const m of chordToMidiNotes(sym, 3)) {
                          handleUserNoteOff(m);
                        }
                      }}
                      onPointerLeave={() => {
                        for (const m of chordToMidiNotes(sym, 3)) {
                          handleUserNoteOff(m);
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
                <div className="mt-1 flex flex-wrap gap-1 min-h-[20px]">
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
      ) : (
        <FallingNotesCanvas
          model={model}
          notes={song.notes}
          currentSec={currentSec}
          tempoScale={tempoScale}
          handFilter={handFilter}
          hitStatusMap={hitStatusMap}
          activeNotes={activeNotes}
          lastBanner={lastBanner}
          zoom={keybedZoom}
          scrollContainerRef={canvasScrollRef}
          onScrollSync={(left) => {
            if (scrollSyncLockRef.current) return;
            scrollSyncLockRef.current = true;
            if (keybedScrollRef.current) keybedScrollRef.current.scrollLeft = left;
            requestAnimationFrame(() => {
              scrollSyncLockRef.current = false;
            });
          }}
        />
      )}

      <YamahaKeyboard
        model={model}
        activeNotes={activeNotes}
        targetHints={targetHints}
        splitMidi={song.splitMidi}
        voice={voice}
        onVoiceChange={(v) => {
          setVoiceOverride(v);
        }}
        onNoteOn={handleUserNoteOn}
        onNoteOff={handleUserNoteOff}
        midiConnected={webMidi.devices.length > 0}
        midiDeviceName={webMidi.devices[0]?.name}
        micActive={micPitch.active}
        micPitchLabel={micPitch.lastPitch?.noteName}
        lastVelocity={webMidi.lastVelocity}
        sustainDown={sustainDown}
        pcKeyLabels={pcKeyLabels}
        qwertyOctaveShift={qwertyOctaveShift}
        onOctaveShiftChange={(d) => setQwertyOctaveShift((prev) => Math.max(-2, Math.min(2, prev + d)))}
        zoom={keybedZoom}
        onZoomChange={setZoomOverride}
        scrollContainerRef={keybedScrollRef}
        onScrollSync={(left) => {
          if (scrollSyncLockRef.current) return;
          scrollSyncLockRef.current = true;
          if (canvasScrollRef.current) canvasScrollRef.current.scrollLeft = left;
          requestAnimationFrame(() => {
            scrollSyncLockRef.current = false;
          });
        }}
      />

      {/* Camera AR, Fingering Coach & Air Piano Trigger (below keyboard on mobile) */}
      <div className="mt-3">
        <CamTutorPanel
          model={model}
          targetHints={targetHints}
          activeNotes={activeNotes}
          onAirNoteOn={handleUserNoteOn}
          onAirNoteOff={handleUserNoteOff}
        />
      </div>

      {/* Synchronized Auto-Generated Grand Staff & Jianpu */}
      {showSheet && (
        <div className="mt-4">
          <SheetMusicView
            song={song}
            currentBeat={currentBeat}
            activeMidis={activeNotes}
            compact
            onJumpToBeat={(beat) => {
              const sec = (beat * 60) / song.bpm;
              const empty = new Map<string, HitJudgement>();
              hitStatusMapRef.current = empty;
              setHitStatusMap(empty);
              demoPlayingRef.current.clear();
              currentSecRef.current = sec;
              setCurrentSec(sec);
            }}
          />
        </div>
      )}

      {/* Completion Rank Modal */}
      {completionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="pixel-border w-full max-w-md bg-[#0d0d0d] p-5">
            <div className="flex items-center justify-between border-b border-[#222] pb-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#ff6a00]">
                <Sparkles className="h-4 w-4" />
                SESSION COMPLETE
              </span>
              <span className="text-[10px] text-[#666]">{model.toUpperCase()}</span>
            </div>

            <div className="my-4 text-center">
              <div className="text-xs text-[#888]">{completionModal.songTitle}</div>
              <div className="mt-2 text-5xl font-extrabold text-[#00ff88] glow-green">
                RANK {completionModal.rank}
              </div>
              <div className="mt-1 text-xs text-[#a855f7]">
                +{completionModal.xpEarned} XP EARNED
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="border border-[#1f1f1f] bg-[#080808] p-2">
                <div className="text-[9px] text-[#555]">SCORE</div>
                <div className="font-bold text-[#ff6a00]">{completionModal.score}</div>
              </div>
              <div className="border border-[#1f1f1f] bg-[#080808] p-2">
                <div className="text-[9px] text-[#555]">ACCURACY</div>
                <div className="font-bold text-[#00ff88]">{completionModal.accuracy}%</div>
              </div>
              <div className="border border-[#1f1f1f] bg-[#080808] p-2">
                <div className="text-[9px] text-[#555]">MAX COMBO</div>
                <div className="font-bold text-[#00d4ff]">{completionModal.maxCombo}x</div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCompletionModal(null)}
                className="border border-[#2a2a2a] px-3 py-1.5 text-xs text-[#888] hover:text-[#e0e0e0]"
              >
                {locale === "zh" ? "关闭" : "CLOSE"}
              </button>
              <button
                onClick={() => resetSession(true)}
                className="pixel-border bg-[#ff6a00] px-4 py-1.5 text-xs font-bold text-[#0a0a0a]"
              >
                {locale === "zh" ? "再来一局" : "PLAY AGAIN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
