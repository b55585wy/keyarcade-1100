"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitchFromSamples, type PitchDetectionResult } from "@/lib/music/mic-pitch";

interface UseMicPitchOptions {
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
}

export function useMicPitch(opts: UseMicPitchOptions) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPitch, setLastPitch] = useState<PitchDetectionResult | null>(null);

  const cbRef = useRef(opts);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const heldMidiRef = useRef<number | null>(null);
  const candidateRef = useRef<{ midi: number; streak: number }>({ midi: -1, streak: 0 });

  useEffect(() => {
    cbRef.current = opts;
  });

  const stopMic = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (heldMidiRef.current !== null) {
      cbRef.current.onNoteOff?.(heldMidiRef.current);
      heldMidiRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (ctxRef.current) {
      void ctxRef.current.close();
      ctxRef.current = null;
    }
    candidateRef.current = { midi: -1, streak: 0 };
    setActive(false);
    setLastPitch(null);
  }, []);

  const startMic = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone API unavailable in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) throw new Error("Web Audio API not supported");

      const audioCtx = new AC();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      streamRef.current = stream;
      ctxRef.current = audioCtx;
      setActive(true);

      const buf = new Float32Array(analyser.fftSize);
      let lastCheckTs = 0;

      const tick = (now: number) => {
        if (now - lastCheckTs >= 32) {
          lastCheckTs = now;
          analyser.getFloatTimeDomainData(buf);
          const detected = detectPitchFromSamples(buf, audioCtx.sampleRate, 0.016);

          if (detected) {
            setLastPitch(detected);
            if (candidateRef.current.midi === detected.midi) {
              candidateRef.current.streak += 1;
            } else {
              candidateRef.current = { midi: detected.midi, streak: 1 };
            }

            if (candidateRef.current.streak >= 2 && heldMidiRef.current !== detected.midi) {
              if (heldMidiRef.current !== null) {
                cbRef.current.onNoteOff?.(heldMidiRef.current);
              }
              heldMidiRef.current = detected.midi;
              const vel = Math.min(120, Math.max(70, Math.round(detected.rms * 650)));
              cbRef.current.onNoteOn?.(detected.midi, vel);
            }
          } else {
            candidateRef.current = { midi: -1, streak: 0 };
            if (heldMidiRef.current !== null) {
              cbRef.current.onNoteOff?.(heldMidiRef.current);
              heldMidiRef.current = null;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
      stopMic();
    }
  }, [stopMic]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
      }
      if (ctxRef.current) void ctxRef.current.close();
    };
  }, []);

  return {
    active,
    error,
    lastPitch,
    startMic,
    stopMic,
  };
}
