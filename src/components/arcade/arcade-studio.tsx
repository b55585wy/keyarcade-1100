"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
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
  ArrowLeft,
  RotateCw,
  Minimize2,
  FileMusic,
  Camera,
  X,
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
  SYNTH_VOICES,
  YAMAHA_PROFILES,
  getMidiToPcKeyMap,
  resolvePcKeyToMidi,
  type PcKeyboardLayoutId,
} from "@/lib/music/yamaha-profiles";
import { requestScreenOrientation } from "@/lib/mobile-orientation";
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
  initialMode?: PracticeMode;
  initialCamOpen?: boolean;
}

function subscribeViewportResize(cb: () => void) {
  window.addEventListener("resize", cb);
  window.addEventListener("orientationchange", cb);
  return () => {
    window.removeEventListener("resize", cb);
    window.removeEventListener("orientationchange", cb);
  };
}

function getIsMobileShell(): boolean {
  return window.innerWidth < 768 || (window.innerHeight <= 540 && window.innerWidth < 1100);
}

function getIsLandscapeViewport(): boolean {
  return window.innerWidth > window.innerHeight && window.innerHeight <= 540;
}

export function ArcadeStudio({
  initialSongId,
  initialMode,
  initialCamOpen = false,
}: ArcadeStudioProps) {
  const { locale } = useI18n();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string>(initialSongId || "twinkle-star");
  const [model, setModel] = useState<YamahaModelId>("kbp1100");
  const [voiceOverride, setVoiceOverride] = useState<SynthVoiceId | null>(null);
  const [mode, setMode] = useState<PracticeMode>(initialMode ?? "wait");
  const [handFilter, setHandFilter] = useState<HandFilter>("both");
  const [tempoScale, setTempoScale] = useState<number>(1.0);
  const [metronomeOn, setMetronomeOn] = useState<boolean>(true);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [showSheet, setShowSheet] = useState<boolean>(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(false);
  const [mobileCamOpen, setMobileCamOpen] = useState<boolean>(initialCamOpen);
  const [desktopCamOpen, setDesktopCamOpen] = useState<boolean>(initialCamOpen);
  const [desktopSplitSheet, setDesktopSplitSheet] = useState<boolean>(false);
  const [landscapeLocked, setLandscapeLocked] = useState<boolean>(false);
  const [qwertyOctaveShift, setQwertyOctaveShift] = useState<number>(0);
  const [pcLayout, setPcLayout] = useState<PcKeyboardLayoutId>("jianpu-num");
  const [freeKeySig, setFreeKeySig] = useState<string>("C");
  const [sustainLock, setSustainLock] = useState<boolean>(false);
  const [noteTrail, setNoteTrail] = useState<string[]>([]);
  const [zoomOverride, setZoomOverride] = useState<1 | 2 | 3 | null>(null);
  const [mobileToolsOpen, setMobileToolsOpen] = useState<boolean>(false);
  const isMobileShell = useSyncExternalStore(
    subscribeViewportResize,
    getIsMobileShell,
    () => false,
  );
  const isLandscapeViewport = useSyncExternalStore(
    subscribeViewportResize,
    getIsLandscapeViewport,
    () => false,
  );
  const isLandscape = isLandscapeViewport || landscapeLocked;
  const keybedZoom: 1 | 2 | 3 = zoomOverride ?? (isMobileShell && !isLandscape ? 2 : 1);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const keybedScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncLockRef = useRef<boolean>(false);

  const toggleLandscapeMode = () => {
    const next = !isLandscape;
    setLandscapeLocked(next);
    setZoomOverride(null);
    void requestScreenOrientation(next ? "landscape" : "portrait");
    playSfx("navigate");
  };

  useEffect(() => {
    return () => {
      void requestScreenOrientation("auto");
    };
  }, []);

  useEffect(() => {
    if (!isMobileShell || isLandscape || zoomOverride !== null) return;
    const raf = requestAnimationFrame(() => {
      for (const el of [keybedScrollRef.current, canvasScrollRef.current]) {
        if (!el) continue;
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 0) el.scrollLeft = maxScroll * 0.42;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [isLandscape, isMobileShell, model, zoomOverride]);

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
    <div
      className={
        isMobileShell
          ? "flex h-[100dvh] w-full flex-col overflow-hidden bg-[#060609]"
          : "mx-auto max-w-7xl px-4 py-3 font-sans"
      }
    >
      {/* Immersive Mobile App Player HUD (Portrait & Landscape Touch) */}
      <div className="shrink-0 border-b border-white/10 bg-[#0b0b10] pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] md:hidden [@media(max-height:540px)]:block">
        {/* Top Row: Back + Song Title Picker + Score + Landscape + Settings */}
        <div className={`flex items-center justify-between gap-1.5 px-2.5 ${isLandscape ? "h-10" : "h-12"}`}>
          <Link
            href="/"
            onClick={() => {
              void requestScreenOrientation("auto");
              playSfx("navigate");
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-[#e6e6ec] active:bg-white/15"
            aria-label={locale === "zh" ? "返回首页" : "Back Home"}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <select
            aria-label="Select Song Mobile"
            value={song.id}
            onChange={(e) => {
              setSelectedSongId(e.target.value);
              setVoiceOverride(null);
              resetSession(false);
            }}
            className="min-w-0 flex-1 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white focus:border-[#ff6a00] focus:outline-none"
          >
            {songs.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#121218] text-white">
                {locale === "zh" && s.titleZh ? s.titleZh : s.title} · Lv.{s.difficulty}
              </option>
            ))}
          </select>

          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-bold">
            <span className="text-[#ff8b33]">{String(score).padStart(5, "0")}</span>
            <span className="text-white/20">·</span>
            <span className="text-[#00ff88]">{combo}x</span>
          </div>

          <button
            type="button"
            onClick={toggleLandscapeMode}
            className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 text-[11px] font-semibold text-[#d4d4df] active:bg-white/15"
            title={isLandscape ? "切换竖屏" : "切换横屏全屏"}
          >
            {isLandscape ? <Minimize2 className="h-3.5 w-3.5 text-[#00d4ff]" /> : <RotateCw className="h-3.5 w-3.5 text-[#ff8b33]" />}
            <span className="hidden min-[380px]:inline">{isLandscape ? (locale === "zh" ? "竖屏" : "Port") : (locale === "zh" ? "横屏" : "Land")}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileToolsOpen(true)}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
              mobileToolsOpen
                ? "border-[#ff6a00] bg-[#ff6a00]/20 text-[#ff8b33]"
                : "border-white/10 bg-white/5 text-[#d4d4df]"
            }`}
            aria-label={locale === "zh" ? "练琴设置与工具" : "Practice Settings"}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Row 2: Slim Play/Mode Pill Bar + Direct AR Virtual Cam Entry */}
        <div className={`no-scrollbar flex items-center justify-between gap-1 overflow-x-auto border-t border-white/5 bg-[#08080c] px-2 ${isLandscape ? "h-9" : "h-10"}`}>
          <div className="flex shrink-0 items-center gap-1">
            {mode !== "free" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isPlaying) {
                      pausePlayback();
                    } else if (currentSec >= songTotalSec - 0.1) {
                      resetSession(true);
                    } else {
                      setIsPlaying(true);
                    }
                  }}
                  className={`flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold shadow transition-transform active:scale-95 ${
                    isPlaying ? "bg-[#00ff88] text-[#0a0a0a]" : "bg-[#ff6a00] text-[#0a0a0a]"
                  }`}
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  {isPlaying ? (locale === "zh" ? "停" : "Pause") : (locale === "zh" ? "练" : "Play")}
                </button>

                <button
                  type="button"
                  onClick={() => resetSession(false)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-[#a0a0ae] active:bg-white/15"
                  aria-label={locale === "zh" ? "重来" : "Reset"}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            <div className="flex shrink-0 items-center rounded-full bg-white/5 p-0.5 text-[10px]">
              {(
                [
                  ["wait", locale === "zh" ? "跟弹" : "Wait"],
                  ["arcade", locale === "zh" ? "街机" : "Hit"],
                  ["listen", locale === "zh" ? "示范" : "Demo"],
                  ["free", locale === "zh" ? "自由" : "Free"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    resetSession(false);
                  }}
                  className={`rounded-full px-2 py-0.5 font-semibold transition-colors ${
                    mode === m ? "bg-[#ff6a00] text-[#0a0a0a]" : "text-[#9898a6]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileCamOpen(true)}
              className={`flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-bold ${
                mobileCamOpen
                  ? "bg-[#00d4ff] text-[#0a0a0a]"
                  : "border border-[#00d4ff]/35 bg-[#071820] text-[#7dd3fc]"
              }`}
              title={locale === "zh" ? "AR 摄像头桌面虚拟键盘" : "AR Camera Desk Virtual Piano"}
            >
              <Camera className="h-3 w-3" />
              AR
            </button>

            <button
              type="button"
              onClick={() => (micPitch.active ? micPitch.stopMic() : void micPitch.startMic())}
              className={`flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-semibold ${
                micPitch.active
                  ? "bg-[#00d4ff]/20 text-[#00d4ff] ring-1 ring-[#00d4ff]/50"
                  : !profile.hasMidiPort
                    ? "bg-[#a855f7]/20 text-[#c084fc]"
                    : "bg-white/5 text-[#8a8a98]"
              }`}
              title={locale === "zh" ? "开启麦克风实时听音判音" : "Mic pitch detection"}
            >
              {micPitch.active ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
              {micPitch.active ? micPitch.lastPitch?.noteName ?? "MIC" : "MIC"}
            </button>

            <button
              type="button"
              onClick={() => setMobileSheetOpen((v) => !v)}
              className={`flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-semibold ${
                mobileSheetOpen
                  ? "bg-[#00ff88]/20 text-[#00ff88] ring-1 ring-[#00ff88]/50"
                  : "bg-white/5 text-[#8a8a98]"
              }`}
              aria-label={locale === "zh" ? "展开双谱" : "Toggle Sheet"}
            >
              <FileMusic className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Telemetry + Studio Controls Bar (hidden on mobile & compact landscape) */}
      <div className="mb-2.5 hidden rounded-2xl border border-white/10 bg-[#101017] px-3.5 py-2.5 shadow-lg md:block [@media(max-height:540px)]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Song Selector & Hardware Tooltip */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <select
              aria-label="Select Song"
              value={song.id}
              onChange={(e) => {
                setSelectedSongId(e.target.value);
                setVoiceOverride(null);
                resetSession(false);
              }}
              className="min-w-0 max-w-sm flex-1 truncate rounded-xl border border-white/10 bg-[#161620] px-3 py-1.5 text-xs font-bold text-white focus:border-[#ff6a00] focus:outline-none"
            >
              {songs.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#121218]">
                  [Lv.{s.difficulty}] {locale === "zh" && s.titleZh ? s.titleZh : s.title} ({s.keySignature} · {s.bpm} BPM)
                </option>
              ))}
            </select>

            <button
              onClick={handleExportMidi}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11px] text-[#a0a0b0] transition-colors hover:border-white/25 hover:text-white"
              title="Export Standard MIDI (.mid)"
            >
              <Download className="h-3 w-3" />
              .MID
            </button>

            <span
              className="hidden cursor-help rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-[#8a8a98] xl:inline-flex"
              title={
                mode === "wait"
                  ? "跟弹等待：琴键高亮提示指法，弹对音符才继续往下走；支持 USB/蓝牙 MIDI、MIC 或键盘直弹"
                  : mode === "arcade"
                    ? "街机节奏：按绿色判定线节奏弹奏赚取 PERFECT 连击与经验值"
                    : mode === "listen"
                      ? "自动示范：同步走谱试听，按空格随时暂停"
                      : "电脑键盘自由演奏：支持简谱 1-7 / 双排钢琴，Shift/Space 延音，[ / ] 升降八度"
              }
            >
              {mode === "free"
                ? locale === "zh"
                  ? "Shift延音 · [/]八度"
                  : "Shift=Sustain · [/]=Octave"
                : locale === "zh"
                  ? "Space 播放/暂停 · 悬浮看说明"
                  : "Space=Play · Tip"}
            </span>
          </div>

          {/* Score / Combo / Pet HUD */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-lg border border-white/10 bg-[#0b0b10] px-2.5 py-1 text-right font-mono">
              <div className="text-[9px] text-[#666]">SCORE</div>
              <div className="text-xs font-bold text-[#ff8b33]">{String(score).padStart(6, "0")}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0b0b10] px-2.5 py-1 text-right font-mono">
              <div className="text-[9px] text-[#666]">COMBO</div>
              <div className="text-xs font-bold text-[#00ff88]">{combo}x</div>
            </div>
            <div className="hidden xl:block">
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

        {/* Row 2: Calm Segmented Transport & Studio Toggles */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
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
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold shadow transition-colors ${
                isPlaying
                  ? "bg-[#00ff88] text-[#0a0a0a]"
                  : "bg-[#ff6a00] text-[#0a0a0a] hover:bg-[#ff8533]"
              }`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
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
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-[#a0a0ae] hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              {locale === "zh" ? "重来" : "RESET"}
            </button>

            {/* Primary Mode Selector */}
            <div className="flex rounded-lg bg-white/[0.04] p-0.5 text-[11px]">
              {(
                [
                  ["wait", locale === "zh" ? "跟弹等待" : "WAIT"],
                  ["arcade", locale === "zh" ? "街机节奏" : "ARCADE"],
                  ["listen", locale === "zh" ? "自动示范" : "DEMO"],
                  ["free", locale === "zh" ? "电脑键盘" : "FREE"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    resetSession(false);
                  }}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    mode === m ? "bg-[#ff6a00] text-[#0a0a0a]" : "text-[#9a9aa8] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Contextual PC Keyboard mapping (only relevant in Free Play) */}
            {mode === "free" && (
              <div className="flex rounded-lg bg-white/[0.04] p-0.5 text-[11px]">
                {(
                  [
                    ["jianpu-num", locale === "zh" ? "简谱 1-7" : "1-7"],
                    ["piano-qwerty", locale === "zh" ? "双排钢琴" : "QWERTY"],
                  ] as const
                ).map(([lid, label]) => (
                  <button
                    key={lid}
                    onClick={() => setPcLayout(lid)}
                    className={`rounded-md px-2 py-1 font-semibold transition-colors ${
                      pcLayout === lid ? "bg-[#00ff88] text-[#0a0a0a]" : "text-[#8a8a98]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {/* Hand Filter */}
            <div className="flex rounded-lg bg-white/[0.04] p-0.5">
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
                  className={`rounded-md px-2 py-1 font-medium transition-colors ${
                    handFilter === h ? "bg-[#00d4ff] font-bold text-[#0a0a0a]" : "text-[#8a8a98] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0b0b10] px-2 py-1 font-mono text-[#9a9aa8]">
              <span>SPD</span>
              <select
                value={tempoScale}
                onChange={(e) => setTempoScale(parseFloat(e.target.value))}
                className="bg-transparent font-bold text-[#00ff88] focus:outline-none"
              >
                <option value="0.5" className="bg-[#121218]">0.5x</option>
                <option value="0.75" className="bg-[#121218]">0.75x</option>
                <option value="1" className="bg-[#121218]">1.0x</option>
                <option value="1.25" className="bg-[#121218]">1.25x</option>
              </select>
            </label>

            <button
              onClick={() => setMetronomeOn((m) => !m)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition-colors ${
                metronomeOn
                  ? "border-[#00ff88]/40 bg-[#0a1a12] text-[#00ff88]"
                  : "border-white/10 bg-white/[0.03] text-[#7a7a88]"
              }`}
            >
              <Volume2 className="h-3 w-3" />
              {locale === "zh" ? "节拍器" : "METRO"}
            </button>

            <button
              onClick={() => setLoopEnabled((l) => !l)}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-medium transition-colors ${
                loopEnabled
                  ? "border-[#a855f7]/60 bg-[#180d24] text-[#c084fc]"
                  : "border-white/10 bg-white/[0.03] text-[#7a7a88]"
              }`}
            >
              <Repeat className="h-3 w-3" />
              {locale === "zh" ? "循环" : "LOOP"}
            </button>

            <button
              onClick={() => (micPitch.active ? micPitch.stopMic() : void micPitch.startMic())}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition-colors ${
                micPitch.active
                  ? "border-[#00d4ff]/60 bg-[#071820] text-[#00d4ff]"
                  : "border-white/10 bg-white/[0.03] text-[#8a8a98] hover:text-white"
              }`}
              title={
                locale === "zh"
                  ? "通过麦克风监听真实琴音并实时判音（适合 CTK-1100 等无 MIDI 口琴型）"
                  : "Detect live piano notes via microphone"
              }
            >
              {micPitch.active ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
              {micPitch.active ? `MIC ${micPitch.lastPitch?.noteName ?? "ON"}` : "MIC"}
            </button>

            <button
              type="button"
              onClick={() => setDesktopCamOpen((c) => !c)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition-colors ${
                desktopCamOpen
                  ? "border-[#00d4ff]/60 bg-[#071820] text-[#00d4ff]"
                  : "border-white/10 bg-white/[0.03] text-[#8a8a98] hover:text-white"
              }`}
            >
              <Camera className="h-3 w-3" />
              {locale === "zh" ? "AR 教练" : "AR CAM"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!showSheet) {
                  setShowSheet(true);
                  setDesktopSplitSheet(true);
                } else if (desktopSplitSheet) {
                  setDesktopSplitSheet(false);
                } else {
                  setShowSheet(false);
                }
              }}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium transition-colors ${
                showSheet
                  ? desktopSplitSheet
                    ? "border-[#ff6a00]/60 bg-[#211205] text-[#ff8b33]"
                    : "border-white/25 bg-white/10 text-white"
                  : "border-white/10 bg-white/[0.03] text-[#7a7a88]"
              }`}
              title={locale === "zh" ? "切换双谱视图：下方展示 / 右侧分屏 / 隐藏" : "Cycle Sheet: Bottom / Split / Hide"}
            >
              <FileMusic className="h-3 w-3" />
              {locale === "zh"
                ? !showSheet
                  ? "双谱: 关"
                  : desktopSplitSheet
                    ? "双谱: 并排"
                    : "双谱: 下方"
                : !showSheet
                  ? "SCORE: OFF"
                  : desktopSplitSheet
                    ? "SCORE: SPLIT"
                    : "SCORE: BTM"}
            </button>
          </div>
        </div>
      </div>

      {/* Inline Mic Pitch Error Only (no noisy redundant banners above Waterfall) */}
      {!isMobileShell && micPitch.error && (
        <div className="mb-2 rounded-xl border border-[#ff4444]/50 bg-[#200b0b] px-3 py-1.5 text-xs text-[#ff7777]">
          [MIC] {micPitch.error}
        </div>
      )}

      {/* Mobile Expandable Mini Sheet Music Strip */}
      {isMobileShell && mobileSheetOpen && (
        <div className="max-h-36 shrink-0 overflow-y-auto border-b border-white/10 bg-[#0b0b10] p-2">
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

      {/* Main Playfield + Responsive / Split Sheet Music */}
      <div
        className={
          isMobileShell
            ? "flex min-h-0 flex-1 flex-col"
            : "grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-start"
        }
      >
        <div
          className={
            isMobileShell
              ? "flex min-h-0 flex-1 flex-col"
              : showSheet && desktopSplitSheet
                ? "xl:col-span-8"
                : "xl:col-span-12"
          }
        >
      {/* Free Play Tactile Studio (Mobile Chord + Jianpu Pads OR Desktop PC Keyboard) OR Falling Piano Roll */}
      {mode === "free" ? (
        isMobileShell ? (
          <div className="flex min-h-[180px] flex-1 flex-col justify-between gap-2.5 overflow-y-auto bg-[#07070c] px-2.5 py-2.5">
            {/* Compact Free Play Toolbar */}
            <div className="flex items-center justify-between gap-1.5 rounded-2xl border border-white/10 bg-[#111118] px-2.5 py-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Mobile Free Play Key"
                  value={freeKeySig}
                  onChange={(e) => setFreeKeySig(e.target.value)}
                  className="rounded-full bg-white/5 px-2.5 py-1 font-bold text-[#00ff88] focus:outline-none"
                >
                  {["C", "G", "D", "F", "Bb", "Am"].map((k) => (
                    <option key={k} value={k} className="bg-[#121218]">
                      1 = {k}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const next = !sustainLock;
                    setSustainLock(next);
                    setSustainDown(next);
                    audioEngine.setSustain(next);
                  }}
                  className={`rounded-full px-2.5 py-1 font-bold transition-colors ${
                    sustainLock ? "bg-[#ff6a00] text-[#0a0a0a]" : "bg-white/5 text-[#9898a6]"
                  }`}
                >
                  {locale === "zh" ? (sustainLock ? "延音: 开" : "延音: 关") : sustainLock ? "SUSTAIN" : "PEDAL"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    audioEngine.stopAll();
                    setActiveNotes(new Set());
                    setNoteTrail([]);
                  }}
                  className="rounded-full bg-white/5 px-2 py-1 text-[#9898a6] active:bg-white/15"
                >
                  {locale === "zh" ? "止音" : "STOP"}
                </button>
              </div>

              <span className="max-w-[96px] truncate font-semibold text-[#00d4ff]">
                {noteTrail.slice(-3).join("·") || (locale === "zh" ? "自由弹" : "FREE")}
              </span>
            </div>

            {/* Tactile Left-Hand Chord Accompaniment Pads */}
            <section>
              <div className="mb-1.5 flex items-center justify-between px-0.5 text-[10px]">
                <span className="font-semibold text-[#9898a6]">
                  {locale === "zh" ? `左手伴奏和弦垫 (1=${freeKeySig} · 按住发声)` : `Chord Pads (1=${freeKeySig})`}
                </span>
                <span className="text-[#00d4ff]">OCT 3</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(KEY_DIATONIC_CHORDS[freeKeySig] ?? KEY_DIATONIC_CHORDS.C).map((sym, idx) => {
                  const midis = chordToMidiNotes(sym, 3);
                  const chordLit = midis.some((m) => activeNotes.has(m));
                  const degrees = ["I", "ii", "iii", "IV", "V", "vi"];
                  return (
                    <button
                      key={sym}
                      type="button"
                      onPointerDown={() => {
                        for (const m of midis) handleUserNoteOn(m, 84);
                      }}
                      onPointerUp={() => {
                        for (const m of midis) handleUserNoteOff(m);
                      }}
                      onPointerCancel={() => {
                        for (const m of midis) handleUserNoteOff(m);
                      }}
                      onPointerLeave={() => {
                        for (const m of midis) handleUserNoteOff(m);
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

            {/* Tactile 2-Octave Large Jianpu Arcade Pads */}
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
                      onClick={() => setQwertyOctaveShift(z.shift)}
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
                        onPointerDown={() => mappedMidi !== null && handleUserNoteOn(mappedMidi, 102)}
                        onPointerUp={() => mappedMidi !== null && handleUserNoteOff(mappedMidi)}
                        onPointerCancel={() => mappedMidi !== null && handleUserNoteOff(mappedMidi)}
                        onPointerLeave={() => mappedMidi !== null && handleUserNoteOff(mappedMidi)}
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
        ) : (
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
        )
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
          immersiveMobile={isMobileShell}
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
        immersiveMobile={isMobileShell}
        compactHeight={isLandscape}
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
        </div>

        {/* Synchronized Desktop Sheet Music (Side-by-Side Split OR Full-Width Below) */}
        {!isMobileShell && showSheet && (
          <div
            className={
              desktopSplitSheet
                ? "max-h-[470px] overflow-y-auto rounded-2xl border border-white/10 bg-[#101017] p-2 xl:col-span-4"
                : "xl:col-span-12"
            }
          >
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
      </div>

      {/* Desktop Toggleable AR Camera Coach Below Keyboard */}
      {!isMobileShell && desktopCamOpen && (
        <div className="mt-3">
          <CamTutorPanel
            model={model}
            targetHints={targetHints}
            activeNotes={activeNotes}
            onAirNoteOn={handleUserNoteOn}
            onAirNoteOff={handleUserNoteOff}
            initialAirTrigger
          />
        </div>
      )}

      {/* Mobile Settings & Tools Bottom Sheet */}
      {isMobileShell && mobileToolsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs"
          onClick={() => setMobileToolsOpen(false)}
        >
          <div
            className="max-h-[82dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#111118] p-4 pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                {locale === "zh" ? "练琴控制台" : "Practice Settings"}
              </span>
              <button
                type="button"
                onClick={() => setMobileToolsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[#ccc]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Hand Filter & Speed */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a8a98]">
                    {locale === "zh" ? "手部训练" : "Hands"}
                  </div>
                  <div className="grid grid-cols-3 rounded-xl bg-white/5 p-1">
                    {(
                      [
                        ["both", locale === "zh" ? "双手" : "Both"],
                        ["right", locale === "zh" ? "右手" : "RH"],
                        ["left", locale === "zh" ? "左手" : "LH"],
                      ] as const
                    ).map(([h, label]) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHandFilter(h)}
                        className={`rounded-lg py-1.5 font-semibold ${
                          handFilter === h ? "bg-[#00d4ff] text-[#0a0a0a]" : "text-[#9898a6]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a8a98]">
                    {locale === "zh" ? "倍速" : "Tempo"}
                  </div>
                  <div className="grid grid-cols-4 rounded-xl bg-white/5 p-1">
                    {[0.5, 0.75, 1, 1.25].map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setTempoScale(sp)}
                        className={`rounded-lg py-1.5 text-[11px] font-semibold ${
                          tempoScale === sp ? "bg-[#00ff88] text-[#0a0a0a]" : "text-[#9898a6]"
                        }`}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Synth Voice & Keyboard Zoom */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a8a98]">
                    {locale === "zh" ? "雅马哈/卡西欧音色" : "Instrument Voice"}
                  </div>
                  <select
                    aria-label="Mobile Synth Voice"
                    value={voice}
                    onChange={(e) => setVoiceOverride(e.target.value as SynthVoiceId)}
                    className="w-full rounded-xl border border-white/10 bg-[#181822] px-2.5 py-2 font-semibold text-white focus:border-[#ff6a00] focus:outline-none"
                  >
                    {SYNTH_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {locale === "zh" ? v.labelZh : v.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a8a98]">
                    {locale === "zh" ? "琴键宽窄缩放" : "Keybed Width"}
                  </div>
                  <div className="grid grid-cols-3 rounded-xl bg-white/5 p-1">
                    {([1, 2, 3] as const).map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => setZoomOverride(z)}
                        className={`rounded-lg py-1.5 font-bold ${
                          keybedZoom === z ? "bg-[#ff6a00] text-[#0a0a0a]" : "text-[#9898a6]"
                        }`}
                      >
                        {z}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Switches */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMetronomeOn((m) => !m)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 font-semibold ${
                    metronomeOn
                      ? "border-[#00ff88]/50 bg-[#00ff88]/10 text-[#00ff88]"
                      : "border-white/10 bg-white/5 text-[#8a8a98]"
                  }`}
                >
                  <Volume2 className="h-4 w-4" />
                  {locale === "zh" ? `节拍器 · ${metronomeOn ? "开" : "关"}` : "Metronome"}
                </button>

                <button
                  type="button"
                  onClick={() => setLoopEnabled((l) => !l)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 font-semibold ${
                    loopEnabled
                      ? "border-[#a855f7]/60 bg-[#a855f7]/15 text-[#c084fc]"
                      : "border-white/10 bg-white/5 text-[#8a8a98]"
                  }`}
                >
                  <Repeat className="h-4 w-4" />
                  {locale === "zh" ? `循环练 · ${loopEnabled ? "开" : "关"}` : "Loop"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileToolsOpen(false);
                    setMobileCamOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 font-semibold text-[#00d4ff]"
                >
                  <Camera className="h-4 w-4" />
                  {locale === "zh" ? "AI 摄像头指法教练" : "Cam AR Coach"}
                </button>

                <button
                  type="button"
                  onClick={handleExportMidi}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 font-semibold text-[#e6e6ec]"
                >
                  <Download className="h-4 w-4" />
                  {locale === "zh" ? "导出 .MID 曲谱" : "Export .MID"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Camera Coach Overlay Modal */}
      {isMobileShell && mobileCamOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-xs"
          onClick={() => setMobileCamOpen(false)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#0f0f15] p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#00ff88]">
                {locale === "zh" ? "AR 摄像头桌面虚拟键盘 & 指法教练" : "AR Camera Desk Virtual Piano"}
              </span>
              <button
                type="button"
                onClick={() => setMobileCamOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CamTutorPanel
              model={model}
              targetHints={targetHints}
              activeNotes={activeNotes}
              onAirNoteOn={handleUserNoteOn}
              onAirNoteOff={handleUserNoteOff}
              initialAirTrigger
              mobileImmersive
            />
          </div>
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
