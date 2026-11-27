"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Repeat,
  Volume2,
  Mic,
  MicOff,
  SlidersHorizontal,
  ArrowLeft,
  RotateCw,
  Minimize2,
  FileMusic,
  Camera,
  Lightbulb,
} from "lucide-react";
import type {
  ArrangerStyleId,
  FreeAssistMode,
  HandFilter,
  HitJudgement,
  HitToleranceTier,
  ImprovRecordedNote,
  LoopRangeBars,
  PlaySessionRecord,
  PracticeMode,
  ReplayEvent,
  ReverbPreset,
  Song,
  SynthVoiceId,
  YamahaModelId,
} from "@/types/music";
import {
  computeLeadInStartSec,
  evaluateTimingHit,
  TOLERANCE_TIERS,
} from "@/lib/music/arcade-grading";
import {
  buildMagicRhythmSteps,
  CHORD_PROGRESSIONS,
  compileImprovTakeToSong,
  snapMidiToSmartScale,
  type MagicVibePreset,
} from "@/lib/music/magic-engine";
import {
  completeDailyPlanStep,
  getAllSongs,
  getStoredModel,
  recordPlaySession,
  saveCustomSong,
  subscribeStore,
} from "@/lib/storage/academy-store";
import {
  YAMAHA_PROFILES,
  getMidiToPcKeyMap,
  resolvePcKeyToMidi,
  type PcKeyboardLayoutId,
} from "@/lib/music/yamaha-profiles";
import { ARRANGER_STYLES, triggerArrangerStep } from "@/lib/music/arranger-styles";
import { decodeSongShareCode } from "@/lib/music/song-share";
import { startCanvasVideoCapture, triggerDownload } from "@/lib/music/replay-recorder";
import { requestScreenOrientation } from "@/lib/mobile-orientation";
import { midiToName } from "@/lib/music/theory";
import { audioEngine } from "@/lib/music/audio-engine";
import { exportSongToMidi } from "@/lib/music/midi-exporter";
import { useWebMidi } from "@/hooks/use-web-midi";
import { useMicPitch } from "@/hooks/use-mic-pitch";
import { FallingNotesCanvas } from "./falling-notes-canvas";
import { FreePlayWorkstation } from "./free-play-workstation";
import { MobileArcadeOverlays } from "./mobile-arcade-overlays";
import { SessionShareModal } from "./session-share-modal";
import { YamahaKeyboard, type TargetKeyHint } from "../piano/yamaha-keyboard";
import { SheetMusicView } from "../score/sheet-music-view";
import { CamTutorPanel, emitCamNotePlayed } from "../vision/cam-tutor-panel";
import { KeyBarPreviewStrip } from "../hardware/keybar-preview-strip";
import {
  buildKeyBarFrame,
  DEFAULT_KEYBAR_CONFIG,
  keyBarManager,
  readKeyBarConfig,
  subscribeKeyBarConfig,
  writeKeyBarConfig,
} from "@/lib/hardware/led-strip-bridge";
import { PixelPet, emitNotePet } from "../pixel-pet";
import { playSfx } from "@/lib/sfx";
import { useI18n } from "@/lib/i18n";

interface ArcadeStudioProps {
  initialSongId?: string;
  initialMode?: PracticeMode;
  initialAssist?: FreeAssistMode;
  initialCamOpen?: boolean;
  initialSharedCode?: string;
  initialCapsuleStepId?: string;
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
  initialAssist,
  initialCamOpen = false,
  initialSharedCode,
  initialCapsuleStepId,
}: ArcadeStudioProps) {
  const { locale } = useI18n();
  const sharedSongInit = useMemo(
    () => (initialSharedCode ? decodeSongShareCode(initialSharedCode) : null),
    [initialSharedCode],
  );
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string>(
    sharedSongInit?.id || initialSongId || "twinkle-star",
  );
  const [model, setModel] = useState<YamahaModelId>("kbp1100");
  const [voiceOverride, setVoiceOverride] = useState<SynthVoiceId | null>(null);
  const [mode, setMode] = useState<PracticeMode>(initialMode ?? "wait");
  const [handFilter, setHandFilter] = useState<HandFilter>("both");
  const [tempoScale, setTempoScale] = useState<number>(1.0);
  const [metronomeOn, setMetronomeOn] = useState<boolean>(true);
  const [countInEnabled, setCountInEnabled] = useState<boolean>(true);
  const [toleranceTier, setToleranceTier] = useState<HitToleranceTier>("standard");
  const [reverbPreset, setReverbPreset] = useState<ReverbPreset>("room");
  const [magicAutoLh, setMagicAutoLh] = useState<boolean>(true);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [loopRangeBars, setLoopRangeBars] = useState<LoopRangeBars>(null);
  const [autoSpeedUp, setAutoSpeedUp] = useState<boolean>(false);
  const [arrangerStyle, setArrangerStyle] = useState<ArrangerStyleId>(
    initialAssist ? "lofi-chill" : "off",
  );
  const [arrangerActive, setArrangerActive] = useState<boolean>(Boolean(initialAssist));
  const [arrangerChord, setArrangerChord] = useState<string>("C");
  const [freeAssistMode, setFreeAssistMode] = useState<FreeAssistMode>(initialAssist ?? "pro");
  const [activeVibeId, setActiveVibeId] = useState<string>("lofi-night");
  const [progressionId, setProgressionId] = useState<string>(
    initialAssist === "smart-scale" ? "pop-1645" : "off",
  );
  const [magicStepIdx, setMagicStepIdx] = useState<number>(0);
  const [isImprovRecording, setIsImprovRecording] = useState<boolean>(false);
  const [recordedCount, setRecordedCount] = useState<number>(0);
  const [compiledImprovSong, setCompiledImprovSong] = useState<Song | null>(null);
  const [showSheet, setShowSheet] = useState<boolean>(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(false);
  const [mobileCamOpen, setMobileCamOpen] = useState<boolean>(initialCamOpen);
  const [desktopCamOpen, setDesktopCamOpen] = useState<boolean>(initialCamOpen);
  const [desktopSplitSheet, setDesktopSplitSheet] = useState<boolean>(false);
  const keyBarCfg = useSyncExternalStore(
    subscribeKeyBarConfig,
    readKeyBarConfig,
    () => DEFAULT_KEYBAR_CONFIG,
  );
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
  const [consecutiveMisses, setConsecutiveMisses] = useState<number>(0);
  const [hitSparkPulse, setHitSparkPulse] = useState<{ midi: number; color: string; at: number } | null>(null);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false);
  const [replaySnapshot, setReplaySnapshot] = useState<ReplayEvent[]>([]);

  const hitStatusMapRef = useRef<Map<string, HitJudgement>>(new Map());
  const demoPlayingRef = useRef<Set<string>>(new Set());
  const lastBeatClickRef = useRef<number>(-1);
  const lastCountInBeatRef = useRef<number>(99);
  const currentSecRef = useRef<number>(-0.8);
  const activePcKeysRef = useRef<Map<string, number>>(new Map());
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const replayLogRef = useRef<ReplayEvent[]>([]);
  const replayCursorRef = useRef<number>(0);
  const videoRecorderRef = useRef<{ stop: () => Promise<Blob | null> } | null>(null);
  const arrangerStepRef = useRef<number>(0);
  const arrangerChordRef = useRef<string>("C");
  const activeRemapRef = useRef<Map<number, number[]>>(new Map());
  const magicCursorRef = useRef<number>(0);
  const improvTakeRef = useRef<ImprovRecordedNote[]>([]);
  const improvStartMsRef = useRef<number>(0);
  const openImprovStartsRef = useRef<Map<number, { idx: number; startMs: number }>>(new Map());

  useEffect(() => {
    arrangerChordRef.current = arrangerChord;
  }, [arrangerChord]);

  useEffect(() => {
    currentSecRef.current = currentSec;
  }, [currentSec]);

  useEffect(() => {
    if (!sharedSongInit) return;
    queueMicrotask(() => {
      saveCustomSong(sharedSongInit);
    });
  }, [sharedSongInit]);

  useEffect(() => {
    const sync = () => {
      const list = getAllSongs();
      setSongs(list);
      setModel(getStoredModel());
      if (!sharedSongInit && initialSongId && list.some((s) => s.id === initialSongId)) {
        setSelectedSongId(initialSongId);
      }
    };
    sync();
    return subscribeStore(sync);
  }, [initialSongId, sharedSongInit]);

  const song = useMemo(() => {
    const found = songs.find((s) => s.id === selectedSongId);
    if (found) return found;
    if (sharedSongInit && selectedSongId === sharedSongInit.id) return sharedSongInit;
    return songs[0];
  }, [selectedSongId, sharedSongInit, songs]);

  const voice = voiceOverride ?? song?.recommendedVoice ?? "grand-piano";

  useEffect(() => {
    audioEngine.setVoice(voice);
  }, [voice]);

  useEffect(() => {
    audioEngine.setReverbPreset(reverbPreset);
  }, [reverbPreset]);

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

  const abWindow = useMemo(() => {
    if (!song || !loopRangeBars) return null;
    const beatsPerBar = song.timeSignature[0] || 4;
    const secPerBar = (beatsPerBar * 60) / Math.max(40, song.bpm);
    const startSec = Math.max(0, loopRangeBars[0] * secPerBar);
    const endSec = Math.min(songTotalSec, (loopRangeBars[1] + 1) * secPerBar);
    return endSec > startSec + 0.3 ? { startSec, endSec } : null;
  }, [loopRangeBars, song, songTotalSec]);

  const currentBeat = useMemo(() => {
    if (!song) return 0;
    return Math.max(0, (currentSec * song.bpm) / 60);
  }, [currentSec, song]);

  const pausePlayback = useCallback(() => {
    audioEngine.stopAll();
    demoPlayingRef.current.clear();
    setActiveNotes(new Set());
    setIsPlaying(false);
    setIsReplaying(false);
  }, []);

  // Reset run state
  const resetSession = useCallback(
    (startPlay = false) => {
      audioEngine.stopAll();
      const empty = new Map<string, HitJudgement>();
      hitStatusMapRef.current = empty;
      setHitStatusMap(empty);
      demoPlayingRef.current.clear();
      lastBeatClickRef.current = -1;
      lastCountInBeatRef.current = 99;
      replayLogRef.current = [];
      replayCursorRef.current = 0;
      setIsReplaying(false);
      setConsecutiveMisses(0);
      setActiveNotes(new Set());
      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      setCounts({ PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 });
      setLastBanner(null);
      setCompletionModal(null);
      const leadSec = startPlay
        ? computeLeadInStartSec(
            song?.bpm ?? 96,
            countInEnabled && (mode === "arcade" || mode === "wait"),
          )
        : 0;
      currentSecRef.current = leadSec;
      setCurrentSec(leadSec);
      setIsPlaying(startPlay);
    },
    [countInEnabled, mode, song?.bpm],
  );

  const handleTogglePlayPause = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
      return;
    }
    if (currentSec >= songTotalSec - 0.1 || currentSec === 0) {
      resetSession(true);
      return;
    }
    setIsPlaying(true);
  }, [currentSec, isPlaying, pausePlayback, resetSession, songTotalSec]);

  const finalizeRun = useCallback(() => {
    if (!song) return;
    setIsPlaying(false);
    setActiveNotes(new Set());
    audioEngine.stopAll();

    if (videoRecorderRef.current) {
      const rec = videoRecorderRef.current;
      videoRecorderRef.current = null;
      void rec.stop().then((blob) => {
        setIsRecordingVideo(false);
        if (blob) {
          triggerDownload(blob, `keyarcade-${song.id}-replay.webm`);
          playSfx("success");
        }
      });
    }

    if (isReplaying) {
      setIsReplaying(false);
      return;
    }
    if (mode === "listen") return;

    if (initialCapsuleStepId) {
      completeDailyPlanStep(initialCapsuleStepId);
    }

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
    setReplaySnapshot([...replayLogRef.current]);
    setCompletionModal(record);
    playSfx(rank === "S+" || rank === "S" ? "podium_first" : "powerup");
  }, [counts, filteredNotes.length, initialCapsuleStepId, isReplaying, locale, maxCombo, mode, model, score, song]);

  const registerJudgement = useCallback((noteId: string, judgement: HitJudgement, midiHint?: number) => {
    const nextMap = new Map(hitStatusMapRef.current);
    nextMap.set(noteId, judgement);
    hitStatusMapRef.current = nextMap;
    setHitStatusMap(nextMap);

    if (judgement === "MISS") {
      setCombo(0);
      setConsecutiveMisses((prev) => {
        const next = prev + 1;
        if (next === 4) emitNotePet("slowhint");
        else emitNotePet("miss");
        return next;
      });
      setCounts((c) => ({ ...c, MISS: c.MISS + 1 }));
      setLastBanner({ text: "MISS", color: "#ff4444", at: performance.now() });
      return;
    }

    setConsecutiveMisses(0);
    const sparkColor =
      judgement === "PERFECT" ? "#00ff88" : judgement === "GREAT" ? "#ff6a00" : "#00d4ff";
    if (midiHint !== undefined) {
      setHitSparkPulse({ midi: midiHint, color: sparkColor, at: performance.now() });
    }

    const pts = judgement === "PERFECT" ? 300 : judgement === "GREAT" ? 200 : 100;
    setCombo((prev) => {
      const next = prev + 1;
      setMaxCombo((m) => Math.max(m, next));
      setScore((s) => s + pts + Math.min(200, next * 10));
      if (next >= 15 && next % 15 === 0) {
        playSfx("powerup");
        emitNotePet("fever");
      } else if (next > 0 && next % 10 === 0) {
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
      color: sparkColor,
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

  const keyBarFrame = useMemo(() => {
    if (!keyBarCfg.enabled) return null;
    const feverPhase = combo >= 15 ? Math.floor(combo / 3) : undefined;
    return buildKeyBarFrame(model, keyBarCfg, targetHints, activeNotes, feverPhase);
  }, [activeNotes, combo, keyBarCfg, model, targetHints]);

  useEffect(() => {
    if (!keyBarFrame) return;
    void keyBarManager.sendCommand(keyBarFrame.command, true);
  }, [keyBarFrame]);

  useEffect(() => {
    return () => {
      void keyBarManager.sendCommand("CLR", true);
    };
  }, []);

  const activeKeySig = mode === "free" ? freeKeySig : song?.keySignature ?? "C";
  const pcKeyLabels = useMemo(
    () => getMidiToPcKeyMap(pcLayout, activeKeySig),
    [activeKeySig, pcLayout],
  );

  const magicSteps = useMemo(
    () => (song ? buildMagicRhythmSteps(song) : [{ melodyMidis: [60], chordMidis: [48, 55] }]),
    [song],
  );

  const countInBeat = useMemo(() => {
    if (!isPlaying || isReplaying || currentSec >= 0 || !song || !countInEnabled) return null;
    if (mode !== "arcade" && mode !== "wait") return null;
    const secPerBeat = 60 / Math.max(40, song.bpm);
    const rem = Math.ceil(Math.abs(currentSec) / secPerBeat);
    return rem >= 1 && rem <= 4 ? rem : null;
  }, [countInEnabled, currentSec, isPlaying, isReplaying, mode, song]);

  const handleApplyVibe = useCallback((vibe: MagicVibePreset) => {
    setActiveVibeId(vibe.id);
    setArrangerStyle(vibe.styleId);
    setArrangerActive(vibe.styleId !== "off");
    setProgressionId(vibe.progressionId);
    setFreeKeySig(vibe.keySignature);
    setVoiceOverride(vibe.voice);
    const prog = CHORD_PROGRESSIONS.find((p) => p.id === vibe.progressionId);
    if (prog && prog.chords[0]) {
      setArrangerChord(prog.chords[0]);
      arrangerChordRef.current = prog.chords[0];
    }
    arrangerStepRef.current = 0;
  }, []);

  const handleSelectMagicSong = useCallback((songId: string) => {
    setSelectedSongId(songId);
    magicCursorRef.current = 0;
    setMagicStepIdx(0);
  }, []);

  const handleAiSongReady = useCallback((aiSong: Song) => {
    setSelectedSongId(aiSong.id);
    setFreeAssistMode("magic-rhythm");
    magicCursorRef.current = 0;
    setMagicStepIdx(0);
    setCompiledImprovSong(aiSong);
  }, []);

  const handleToggleImprovRecord = useCallback(() => {
    if (!isImprovRecording) {
      improvTakeRef.current = [];
      openImprovStartsRef.current.clear();
      improvStartMsRef.current = performance.now();
      setRecordedCount(0);
      setCompiledImprovSong(null);
      setIsImprovRecording(true);
      playSfx("coin");
      return;
    }

    setIsImprovRecording(false);
    const styleMeta = ARRANGER_STYLES.find((s) => s.id === arrangerStyle);
    const effectiveBpm =
      arrangerStyle !== "off" && styleMeta ? styleMeta.defaultBpm : song?.bpm ?? 92;
    const compiled = compileImprovTakeToSong(improvTakeRef.current, {
      bpm: effectiveBpm,
      keySignature: freeKeySig,
      voiceName: voice,
    });
    if (compiled) {
      saveCustomSong(compiled);
      setCompiledImprovSong(compiled);
      playSfx("powerup");
    } else {
      playSfx("error");
    }
  }, [arrangerStyle, freeKeySig, isImprovRecording, song?.bpm, voice]);

  const handleUserNoteOn = useCallback(
    (midi: number, velocity = 98, opts?: { silent?: boolean; rawChordPad?: boolean }) => {
      // Clear any previous remapped voices lingering on this raw key
      const lingering = activeRemapRef.current.get(midi);
      if (lingering && !opts?.silent) {
        for (const oldMidi of lingering) audioEngine.noteOff(oldMidi);
      }

      let soundingList: number[] = [midi];
      let lhExtraList: number[] = [];
      if (mode === "free" && freeAssistMode !== "pro" && !opts?.rawChordPad) {
        if (freeAssistMode === "magic-rhythm") {
          const idx = magicCursorRef.current % magicSteps.length;
          const step = magicSteps[idx];
          soundingList = step.melodyMidis;
          if (magicAutoLh && step.chordMidis.length > 0) {
            lhExtraList = step.chordMidis;
          }
          if (step.chordSymbol) {
            setArrangerChord(step.chordSymbol);
            arrangerChordRef.current = step.chordSymbol;
          }
          magicCursorRef.current = (idx + 1) % magicSteps.length;
          setMagicStepIdx(magicCursorRef.current);
          emitNotePet("perfect");
        } else {
          const strongBeat = arrangerActive
            ? arrangerStepRef.current % 8 <= 1 || arrangerStepRef.current % 8 === 7
            : performance.now() % 900 < 250;
          const snapped = snapMidiToSmartScale(
            midi,
            freeKeySig,
            arrangerChordRef.current,
            strongBeat,
            velocity,
          );
          soundingList =
            snapped.harmonyMidi !== undefined
              ? [snapped.primaryMidi, snapped.harmonyMidi]
              : [snapped.primaryMidi];
          emitNotePet("perfect");
        }
      }

      const allSounding = [...soundingList, ...lhExtraList];
      activeRemapRef.current.set(midi, allSounding);

      if (!opts?.silent) {
        for (const m of soundingList) {
          audioEngine.noteOn(m, velocity);
        }
        const softLhVel = Math.max(48, Math.min(72, Math.round(velocity * 0.72)));
        for (const m of lhExtraList) {
          audioEngine.noteOn(m, softLhVel);
        }
      }

      if (isImprovRecording && !opts?.rawChordPad) {
        const nowMs = performance.now();
        const noteIdx = improvTakeRef.current.length;
        improvTakeRef.current.push({
          midi: soundingList[0],
          harmonyMidi: soundingList[1],
          startSec: Math.max(0, (nowMs - improvStartMsRef.current) / 1000),
          durationSec: 0.45,
          velocity,
          chordSymbol: arrangerChordRef.current,
        });
        openImprovStartsRef.current.set(midi, { idx: noteIdx, startMs: nowMs });
        setRecordedCount(noteIdx + 1);
      }

      setActiveNotes((prev) => {
        const next = new Set(prev);
        for (const m of allSounding) next.add(m);
        return next;
      });
      setNoteTrail((prev) => [...prev.slice(-11), midiToName(soundingList[0])]);
      emitCamNotePlayed({ midi: soundingList[0] });

      if (!isPlaying || !song || mode === "listen" || mode === "free" || isReplaying) return;

      const t = currentSecRef.current;
      replayLogRef.current.push({
        sec: Math.max(0, t),
        midi: soundingList[0],
        type: "on",
        velocity,
      });

      if (mode === "wait") {
        const waitingMatch = nextPendingStepNotes.find((n) => n.midi === midi);
        if (waitingMatch && t >= waitingMatch.startSec - 0.35) {
          registerJudgement(waitingMatch.id, "PERFECT", midi);
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
      if (bestNote) {
        const j = evaluateTimingHit(bestDiff, toleranceTier);
        if (j) registerJudgement(bestNote.id, j, midi);
      }
    },
    [
      arrangerActive,
      filteredNotes,
      freeAssistMode,
      freeKeySig,
      isImprovRecording,
      isPlaying,
      isReplaying,
      magicAutoLh,
      magicSteps,
      mode,
      nextPendingStepNotes,
      registerJudgement,
      song,
      toleranceTier,
    ],
  );

  const handleUserNoteOff = useCallback(
    (midi: number, opts?: { silent?: boolean; rawChordPad?: boolean }) => {
      const mapped = activeRemapRef.current.get(midi) ?? [midi];
      activeRemapRef.current.delete(midi);

      const openEntry = openImprovStartsRef.current.get(midi);
      if (openEntry) {
        openImprovStartsRef.current.delete(midi);
        const rec = improvTakeRef.current[openEntry.idx];
        if (rec) {
          rec.durationSec = Math.max(0.16, (performance.now() - openEntry.startMs) / 1000);
        }
      }

      if (!opts?.silent) {
        for (const m of mapped) audioEngine.noteOff(m);
      }
      if (isPlaying && !isReplaying && mode !== "listen" && mode !== "free") {
        replayLogRef.current.push({
          sec: Math.max(0, currentSecRef.current),
          midi: mapped[0],
          type: "off",
          velocity: 0,
        });
      }
      setActiveNotes((prev) => {
        const next = new Set(prev);
        for (const m of mapped) next.delete(m);
        return next;
      });
    },
    [isPlaying, isReplaying, mode],
  );

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
        } else {
          handleTogglePlayPause();
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
    handleTogglePlayPause,
    handleUserNoteOff,
    handleUserNoteOn,
    mode,
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

      if (!isReplaying && mode === "wait" && nextPendingStepNotes.length > 0) {
        const stopAt = nextPendingStepNotes[0].startSec;
        if (abWindow && stopAt > abWindow.endSec) {
          nextSec = abWindow.endSec;
        } else if (nextSec >= stopAt) {
          nextSec = stopAt;
        }
      }

      if (!isReplaying && countInEnabled && nextSec < 0 && (mode === "arcade" || mode === "wait")) {
        const secPerBeat = 60 / Math.max(40, song.bpm);
        const remBeat = Math.ceil(Math.abs(nextSec) / secPerBeat);
        if (remBeat !== lastCountInBeatRef.current && remBeat >= 1 && remBeat <= 4) {
          lastCountInBeatRef.current = remBeat;
          audioEngine.playMetronomeClick(remBeat === 4);
        }
      }

      if (metronomeOn && nextSec >= 0 && (isReplaying || mode !== "wait")) {
        const beatIdx = Math.floor((nextSec * song.bpm) / 60);
        if (beatIdx !== lastBeatClickRef.current && beatIdx >= 0) {
          lastBeatClickRef.current = beatIdx;
          audioEngine.playMetronomeClick(beatIdx % song.timeSignature[0] === 0);
        }
      }

      if (isReplaying) {
        while (
          replayCursorRef.current < replaySnapshot.length &&
          replaySnapshot[replayCursorRef.current].sec <= nextSec
        ) {
          const ev = replaySnapshot[replayCursorRef.current];
          replayCursorRef.current += 1;
          if (ev.type === "on") {
            audioEngine.noteOn(ev.midi, ev.velocity || 96);
            setActiveNotes((prev) => {
              const s = new Set(prev);
              s.add(ev.midi);
              return s;
            });
          } else {
            audioEngine.noteOff(ev.midi);
            setActiveNotes((prev) => {
              const s = new Set(prev);
              s.delete(ev.midi);
              return s;
            });
          }
        }
      } else if (mode === "listen") {
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
        const missThreshold = TOLERANCE_TIERS[toleranceTier].missAfterSec;
        for (const n of filteredNotes) {
          if (abWindow && (n.startSec < abWindow.startSec - 0.1 || n.startSec > abWindow.endSec)) {
            continue;
          }
          if (!hitStatusMapRef.current.has(n.id) && nextSec - n.startSec > missThreshold) {
            registerJudgement(n.id, "MISS", n.midi);
          }
        }
      }

      const loopEndSec = !isReplaying && abWindow ? abWindow.endSec : songTotalSec;
      const loopStartSec = !isReplaying && abWindow ? abWindow.startSec : 0;

      if (nextSec >= loopEndSec) {
        if (!isReplaying && (loopEnabled || abWindow)) {
          // Evaluate pass accuracy over looped span for optional autoSpeedUp (+0.1x)
          const windowNotes = filteredNotes.filter(
            (n) => !abWindow || (n.startSec >= abWindow.startSec - 0.1 && n.startSec <= abWindow.endSec),
          );
          let passHits = 0;
          for (const wn of windowNotes) {
            const j = hitStatusMapRef.current.get(wn.id);
            if (j === "PERFECT" || j === "GREAT" || j === "GOOD") passHits += 1;
          }
          const passAcc =
            windowNotes.length > 0 ? Math.round((passHits / windowNotes.length) * 100) : 100;
          if (autoSpeedUp && passAcc >= 90 && tempoScale < 1.25) {
            const nextSpeed = Math.min(1.25, Math.round((tempoScale + 0.1) * 100) / 100);
            setTempoScale(nextSpeed);
            setLastBanner({
              text: `${passAcc}% CLEAR! ${nextSpeed}x`,
              color: "#00ff88",
              at: performance.now(),
            });
            playSfx("powerup");
          }

          audioEngine.stopAll();
          demoPlayingRef.current.clear();
          lastBeatClickRef.current = -1;
          const nextMap = new Map(hitStatusMapRef.current);
          for (const wn of windowNotes) nextMap.delete(wn.id);
          hitStatusMapRef.current = nextMap;
          setHitStatusMap(nextMap);

          const jumpSec = abWindow ? Math.max(0, loopStartSec - 0.15) : -0.8;
          currentSecRef.current = jumpSec;
          setCurrentSec(jumpSec);
          rafId = requestAnimationFrame(tick);
          return;
        }
        setCurrentSec(loopEndSec);
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
    abWindow,
    autoSpeedUp,
    filteredNotes,
    finalizeRun,
    isPlaying,
    isReplaying,
    loopEnabled,
    metronomeOn,
    mode,
    nextPendingStepNotes,
    registerJudgement,
    replaySnapshot,
    song,
    songTotalSec,
    tempoScale,
    toleranceTier,
    countInEnabled,
  ]);

  // Procedural WebAudio Arranger Rhythm & Auto Chord Progression Engine
  useEffect(() => {
    const running =
      arrangerStyle !== "off" &&
      (arrangerActive || (isPlaying && !isReplaying && mode !== "wait" && mode !== "listen"));
    if (!running) return;

    const styleMeta = ARRANGER_STYLES.find((s) => s.id === arrangerStyle);
    const effectiveBpm =
      mode === "free"
        ? styleMeta?.defaultBpm ?? 96
        : Math.max(45, Math.round((song?.bpm ?? 96) * tempoScale));
    const stepMs = Math.max(85, Math.round((60 / effectiveBpm / 4) * 1000));
    const progPreset =
      mode === "free" && progressionId !== "off"
        ? CHORD_PROGRESSIONS.find((p) => p.id === progressionId)
        : undefined;

    const timer = window.setInterval(() => {
      const curStep = arrangerStepRef.current;
      let activeChord = arrangerChordRef.current;

      if (progPreset && progPreset.chords.length > 0 && curStep % 16 === 0) {
        const barIdx = Math.floor(curStep / 16) % progPreset.chords.length;
        activeChord = progPreset.chords[barIdx];
        arrangerChordRef.current = activeChord;
        setArrangerChord(activeChord);
      } else if (mode !== "free" && song) {
        const curT = currentSecRef.current;
        for (const n of song.notes) {
          if (n.chordSymbol && n.startSec <= curT + 0.15) {
            activeChord = n.chordSymbol;
          }
        }
      }
      triggerArrangerStep(arrangerStyle, curStep, activeChord, effectiveBpm);
      arrangerStepRef.current = curStep + 1;
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [arrangerActive, arrangerStyle, isPlaying, isReplaying, mode, progressionId, song, tempoScale]);

  const startReplayPlayback = useCallback(
    (captureVideo = false) => {
      if (!song || replaySnapshot.length === 0) return;
      audioEngine.stopAll();
      replayCursorRef.current = 0;
      setCompletionModal(null);
      setActiveNotes(new Set());
      currentSecRef.current = 0;
      setCurrentSec(0);
      setIsReplaying(true);

      if (captureVideo && waterfallCanvasRef.current) {
        const handle = startCanvasVideoCapture(
          waterfallCanvasRef.current,
          audioEngine.getCaptureStream(),
        );
        if (handle) {
          videoRecorderRef.current = handle;
          setIsRecordingVideo(true);
        }
      }
      setIsPlaying(true);
    },
    [replaySnapshot, song],
  );

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
                  onClick={handleTogglePlayPause}
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
              <div
                className={`text-xs font-bold ${
                  combo >= 15 ? "text-[#00ff88] glow-green" : "text-[#00ff88]"
                }`}
              >
                {combo}x {combo >= 15 ? "FEVER" : ""}
              </div>
            </div>
            <div className="hidden xl:block">
              <PixelPet
                feverActive={combo >= 15}
                consecutiveMisses={consecutiveMisses}
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
              onClick={handleTogglePlayPause}
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
                loopEnabled || loopRangeBars
                  ? "border-[#a855f7]/60 bg-[#180d24] text-[#c084fc]"
                  : "border-white/10 bg-white/[0.03] text-[#7a7a88]"
              }`}
            >
              <Repeat className="h-3 w-3" />
              {loopRangeBars
                ? `M${loopRangeBars[0] + 1}-${loopRangeBars[1] + 1}`
                : locale === "zh"
                  ? "循环"
                  : "LOOP"}
            </button>

            <button
              type="button"
              onClick={() => setAutoSpeedUp((a) => !a)}
              className={`rounded-lg border px-2 py-1 font-mono font-medium transition-colors ${
                autoSpeedUp
                  ? "border-[#00ff88]/50 bg-[#081b12] text-[#00ff88]"
                  : "border-white/10 bg-white/[0.03] text-[#7a7a88]"
              }`}
              title={locale === "zh" ? "循环准确度 ≥90% 时自动阶梯提速 +0.1x" : "Step up +0.1x speed on ≥90% loop"}
            >
              AUTO+0.1x
            </button>

            <label className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0b0b10] px-2 py-1 font-mono text-[#9a9aa8]">
              <span className="text-[#ff8b33]">STYLE</span>
              <select
                aria-label="Arranger Style"
                value={arrangerStyle}
                onChange={(e) => {
                  const next = e.target.value as ArrangerStyleId;
                  setArrangerStyle(next);
                  setArrangerActive(next !== "off");
                }}
                className="max-w-[110px] bg-transparent font-bold text-[#00d4ff] focus:outline-none"
              >
                {ARRANGER_STYLES.map((st) => (
                  <option key={st.id} value={st.id} className="bg-[#121218]">
                    {st.code} {locale === "zh" ? st.labelZh : st.labelEn}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0b0b10] px-2 py-1 font-mono text-[#9a9aa8]">
              <span>REV</span>
              <select
                aria-label="Acoustic Reverb"
                value={reverbPreset}
                onChange={(e) => setReverbPreset(e.target.value as ReverbPreset)}
                className="bg-transparent font-bold text-[#a855f7] focus:outline-none"
              >
                <option value="dry" className="bg-[#121218]">DRY</option>
                <option value="room" className="bg-[#121218]">ROOM</option>
                <option value="hall" className="bg-[#121218]">HALL</option>
                <option value="lofi" className="bg-[#121218]">LOFI</option>
              </select>
            </label>

            <label className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0b0b10] px-2 py-1 font-mono text-[#9a9aa8]">
              <span>HIT</span>
              <select
                aria-label="Hit Tolerance"
                value={toleranceTier}
                onChange={(e) => setToleranceTier(e.target.value as HitToleranceTier)}
                className="bg-transparent font-bold text-[#00ff88] focus:outline-none"
              >
                {(Object.keys(TOLERANCE_TIERS) as HitToleranceTier[]).map((tk) => (
                  <option key={tk} value={tk} className="bg-[#121218]">
                    {locale === "zh" ? TOLERANCE_TIERS[tk].labelZh : TOLERANCE_TIERS[tk].labelEn}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setCountInEnabled((c) => !c)}
              className={`rounded-lg border px-2 py-1 font-mono font-medium transition-colors ${
                countInEnabled
                  ? "border-[#ff6a00]/50 bg-[#1e1209] text-[#ff8b33]"
                  : "border-white/10 bg-white/[0.03] text-[#7a7a88]"
              }`}
              title={locale === "zh" ? "开弹前 4 拍倒数预备拍" : "4-Beat Ready Count-In"}
            >
              {locale === "zh" ? "倒数4拍" : "COUNT4"}
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
                const next = writeKeyBarConfig({ enabled: !keyBarCfg.enabled });
                if (!next.enabled) void keyBarManager.sendCommand("CLR", true);
              }}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-medium transition-colors ${
                keyBarCfg.enabled
                  ? "border-[#ff6a00]/60 bg-[#211205] text-[#ff8b33]"
                  : "border-white/10 bg-white/[0.03] text-[#8a8a98] hover:text-white"
              }`}
              title={locale === "zh" ? "开关外部 USB/BLE 跟弹 LED 灯条及虚拟灯带同步" : "Toggle LED KeyBar Sync"}
            >
              <Lightbulb className="h-3 w-3" />
              {locale === "zh" ? "灯条" : "LED"}
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
              loopRangeBars={loopRangeBars}
              onChangeLoopRange={(r) => {
                setLoopRangeBars(r);
                if (r) setLoopEnabled(true);
              }}
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
      {/* Extracted Free Play Workstation OR Falling Piano Roll */}
      {mode === "free" ? (
        <FreePlayWorkstation
          locale={locale}
          isMobileShell={isMobileShell}
          model={model}
          songs={songs}
          song={song}
          freeKeySig={freeKeySig}
          onChangeFreeKeySig={setFreeKeySig}
          pcLayout={pcLayout}
          qwertyOctaveShift={qwertyOctaveShift}
          onChangeOctaveShift={setQwertyOctaveShift}
          sustainLock={sustainLock}
          onToggleSustainLock={() => {
            const next = !sustainLock;
            setSustainLock(next);
            setSustainDown(next);
            audioEngine.setSustain(next);
          }}
          onPanicStop={() => {
            audioEngine.stopAll();
            setActiveNotes(new Set());
            setNoteTrail([]);
          }}
          arrangerStyle={arrangerStyle}
          onChangeArrangerStyle={(next) => {
            setArrangerStyle(next);
            setArrangerActive(next !== "off");
          }}
          arrangerActive={arrangerActive}
          onToggleArrangerActive={() => setArrangerActive((v) => !v)}
          arrangerChord={arrangerChord}
          onSelectChordPad={setArrangerChord}
          freeAssistMode={freeAssistMode}
          onChangeAssistMode={(m) => {
            setFreeAssistMode(m);
            if (m === "smart-scale" && arrangerStyle === "off") {
              setArrangerStyle("lofi-chill");
              setArrangerActive(true);
              if (progressionId === "off") setProgressionId("pop-1645");
            }
            if (m === "magic-rhythm") {
              magicCursorRef.current = 0;
              setMagicStepIdx(0);
            }
          }}
          activeVibeId={activeVibeId}
          onApplyVibe={handleApplyVibe}
          progressionId={progressionId}
          onChangeProgression={setProgressionId}
          magicStepIdx={magicStepIdx}
          magicTotalSteps={magicSteps.length}
          magicAutoLh={magicAutoLh}
          onToggleMagicAutoLh={() => setMagicAutoLh((v) => !v)}
          onSelectMagicSong={handleSelectMagicSong}
          isImprovRecording={isImprovRecording}
          recordedCount={recordedCount}
          onToggleImprovRecord={handleToggleImprovRecord}
          compiledImprovSong={compiledImprovSong}
          onPracticeCompiledSong={(compiled) => {
            setSelectedSongId(compiled.id);
            setCompiledImprovSong(null);
            setMode("wait");
            resetSession(true);
          }}
          onDismissCompiledSong={() => setCompiledImprovSong(null)}
          onAiSongReady={handleAiSongReady}
          activeNotes={activeNotes}
          noteTrail={noteTrail}
          onNoteOn={handleUserNoteOn}
          onNoteOff={handleUserNoteOff}
        />
      ) : (
        <div className={isMobileShell ? "relative flex min-h-0 flex-1 flex-col" : "relative"}>
          {isReplaying && (
            <div className="absolute top-2 left-2.5 z-20 flex items-center gap-2 rounded-full border border-[#ef4444]/70 bg-black/80 px-3 py-1 font-mono text-[10px] font-bold text-[#fca5a5] backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ef4444]" />
              {isRecordingVideo
                ? locale === "zh"
                  ? "正在录制分享视频 .WEBM..."
                  : "RECORDING .WEBM..."
                : locale === "zh"
                  ? "正在回放您的演奏"
                  : "REPLAYING YOUR TAKE"}
              <button
                type="button"
                onClick={pausePlayback}
                className="ml-1 rounded bg-white/15 px-1.5 py-0.5 text-white"
              >
                STOP
              </button>
            </div>
          )}
          {countInBeat !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-[#ff6a00] bg-[#080c12]/90 px-5 py-2.5 text-center font-mono shadow-[0_0_24px_rgba(255,106,0,0.45)] backdrop-blur-xs"
            >
              <div className="text-[10px] font-bold tracking-widest text-[#00d4ff]">
                READY · COUNT IN
              </div>
              <div className="text-3xl font-extrabold text-[#ff8b33]">{countInBeat}</div>
            </div>
          )}
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
            feverActive={combo >= 15}
            combo={combo}
            countInBeat={countInBeat}
            hitSparkPulse={hitSparkPulse}
            onCanvasReady={(el) => {
              waterfallCanvasRef.current = el;
            }}
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
        </div>
      )}

      {keyBarFrame && (
        <KeyBarPreviewStrip compact ledCount={keyBarCfg.ledCount} pixels={keyBarFrame.pixels} />
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
              loopRangeBars={loopRangeBars}
              onChangeLoopRange={(r) => {
                setLoopRangeBars(r);
                if (r) setLoopEnabled(true);
              }}
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

      {/* Mobile Tools & AR Camera Overlays */}
      {isMobileShell && (
        <MobileArcadeOverlays
          locale={locale}
          model={model}
          mobileToolsOpen={mobileToolsOpen}
          onCloseTools={() => setMobileToolsOpen(false)}
          mobileCamOpen={mobileCamOpen}
          onCloseCam={() => setMobileCamOpen(false)}
          onOpenCam={() => setMobileCamOpen(true)}
          handFilter={handFilter}
          onChangeHandFilter={setHandFilter}
          tempoScale={tempoScale}
          onChangeTempoScale={setTempoScale}
          voice={voice}
          onChangeVoice={setVoiceOverride}
          keybedZoom={keybedZoom}
          onChangeZoom={setZoomOverride}
          metronomeOn={metronomeOn}
          onToggleMetronome={() => setMetronomeOn((m) => !m)}
          countInEnabled={countInEnabled}
          onToggleCountIn={() => setCountInEnabled((c) => !c)}
          loopEnabled={loopEnabled}
          loopRangeBars={loopRangeBars}
          onToggleLoop={() => setLoopEnabled((l) => !l)}
          autoSpeedUp={autoSpeedUp}
          onToggleAutoSpeedUp={() => setAutoSpeedUp((a) => !a)}
          reverbPreset={reverbPreset}
          onChangeReverb={setReverbPreset}
          toleranceTier={toleranceTier}
          onChangeTolerance={setToleranceTier}
          arrangerStyle={arrangerStyle}
          onChangeArrangerStyle={(next) => {
            setArrangerStyle(next);
            setArrangerActive(next !== "off");
          }}
          onExportMidi={handleExportMidi}
          keyBarEnabled={keyBarCfg.enabled}
          onToggleKeyBar={() => {
            const next = writeKeyBarConfig({ enabled: !keyBarCfg.enabled });
            if (!next.enabled) void keyBarManager.sendCommand("CLR", true);
          }}
          targetHints={targetHints}
          activeNotes={activeNotes}
          onAirNoteOn={handleUserNoteOn}
          onAirNoteOff={handleUserNoteOff}
        />
      )}

      {/* Completion Rank, Replay, Poster PNG & WebM Video Share Modal */}
      {completionModal && (
        <SessionShareModal
          record={completionModal}
          song={song}
          modelLabel={profile.shortName}
          locale={locale}
          replayEvents={replaySnapshot}
          canExportVideo={typeof MediaRecorder !== "undefined"}
          onStartReplayPlayback={() => startReplayPlayback(false)}
          onExportVideoReplay={() => startReplayPlayback(true)}
          onRestartSong={() => resetSession(true)}
          onClose={() => setCompletionModal(null)}
        />
      )}
    </div>
  );
}
