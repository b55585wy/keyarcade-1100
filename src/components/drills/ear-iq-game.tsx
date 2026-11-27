"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Play, RotateCcw, Trophy } from "lucide-react";
import { audioEngine } from "@/lib/music/audio-engine";
import { midiToName } from "@/lib/music/theory";
import { recordEarIqScore } from "@/lib/storage/academy-store";
import { generateSessionPosterDataUrl, triggerDownload } from "@/lib/music/replay-recorder";
import { playSfx } from "@/lib/sfx";

const EAR_IQ_EVENT = "yamaha1100:eariq-note";

export function dispatchEarIqNote(midi: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<number>(EAR_IQ_EVENT, { detail: midi }));
}

interface EarIqGameProps {
  locale: "zh" | "en";
  bestEarIq?: number;
}

const WHITE_SCALE_MIDIS = [60, 62, 64, 65, 67, 69, 71, 72]; // C4..C5

export function EarIqGame({ locale, bestEarIq }: EarIqGameProps) {
  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [timeLeft, setTimeLeft] = useState(60);
  const [sequence, setSequence] = useState<number[]>([60, 64, 67]);
  const [inputSeq, setInputSeq] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [correctRounds, setCorrectRounds] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const stateRef = useRef({
    phase,
    sequence,
    inputSeq,
    score,
    correctRounds,
    totalRounds,
  });
  useEffect(() => {
    stateRef.current = { phase, sequence, inputSeq, score, correctRounds, totalRounds };
  }, [correctRounds, inputSeq, phase, score, sequence, totalRounds]);

  const playBlindSequence = useCallback((notes: number[]) => {
    notes.forEach((m, idx) => {
      window.setTimeout(() => {
        audioEngine.noteOn(m, 96);
        window.setTimeout(() => audioEngine.noteOff(m), 360);
      }, idx * 420);
    });
  }, []);

  const spawnRound = useCallback(
    (roundNum: number) => {
      const len = roundNum >= 6 ? 4 : roundNum >= 3 ? 3 : 2;
      const next: number[] = [];
      for (let i = 0; i < len; i++) {
        const idx = Math.floor(Math.random() * WHITE_SCALE_MIDIS.length);
        next.push(WHITE_SCALE_MIDIS[idx]);
      }
      setSequence(next);
      setInputSeq([]);
      playBlindSequence(next);
    },
    [playBlindSequence],
  );

  const startTest = () => {
    setScore(0);
    setCorrectRounds(0);
    setTotalRounds(0);
    setTimeLeft(60);
    setStatusMsg(null);
    setPhase("playing");
    spawnRound(0);
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const st = stateRef.current;
          const acc = st.totalRounds > 0 ? Math.round((st.correctRounds / st.totalRounds) * 100) : 0;
          const iq = Math.min(160, Math.round(78 + st.correctRounds * 7 + acc * 0.35));
          recordEarIqScore(st.score, iq, acc);
          playSfx("powerup");
          setPhase("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const onMidi = (e: Event) => {
      const midi = (e as CustomEvent<number>).detail;
      const st = stateRef.current;
      if (st.phase !== "playing") return;

      const playedPc = midi % 12;
      const targetMidi = st.sequence[st.inputSeq.length];
      if (targetMidi === undefined) return;

      if (playedPc === targetMidi % 12) {
        const nextInputs = [...st.inputSeq, midi];
        if (nextInputs.length >= st.sequence.length) {
          const nextRound = st.totalRounds + 1;
          setCorrectRounds((c) => c + 1);
          setTotalRounds(nextRound);
          setScore((s) => s + st.sequence.length * 100 + 50);
          setStatusMsg(locale === "zh" ? "✓ 全中! 进入下一题..." : "✓ PERFECT EAR!");
          playSfx("coin");
          window.setTimeout(() => spawnRound(nextRound), 550);
        } else {
          setInputSeq(nextInputs);
        }
      } else {
        const nextRound = st.totalRounds + 1;
        setTotalRounds(nextRound);
        setStatusMsg(
          locale === "zh"
            ? `✗ 正解: ${st.sequence.map((m) => midiToName(m)).join(" → ")}`
            : `✗ Answer: ${st.sequence.map((m) => midiToName(m)).join(" → ")}`,
        );
        playSfx("error");
        window.setTimeout(() => spawnRound(nextRound), 850);
      }
    };

    window.addEventListener(EAR_IQ_EVENT, onMidi);
    return () => window.removeEventListener(EAR_IQ_EVENT, onMidi);
  }, [locale, spawnRound]);

  const computedAccuracy =
    totalRounds > 0 ? Math.round((correctRounds / totalRounds) * 100) : 0;
  const computedIq = Math.min(160, Math.round(78 + correctRounds * 7 + computedAccuracy * 0.35));

  const handleDownloadEarCard = () => {
    const url = generateSessionPosterDataUrl(
      {
        id: `eariq-${Date.now()}`,
        songId: "ear-iq-60s",
        songTitle: `60s Ear IQ Challenge · IQ ${computedIq}`,
        model: "kbp1100",
        mode: "wait",
        score,
        accuracy: computedAccuracy,
        maxCombo: correctRounds,
        perfectCount: correctRounds,
        greatCount: 0,
        goodCount: 0,
        missCount: Math.max(0, totalRounds - correctRounds),
        rank: computedAccuracy >= 90 ? "S+" : computedAccuracy >= 75 ? "S" : "A",
        xpEarned: Math.max(30, Math.round(score / 18)),
        playedAt: new Date().toISOString(),
      },
      { locale, modelLabel: `EAR IQ ${computedIq}` },
    );
    if (url) {
      triggerDownload(url, `keyarcade-ear-iq-${computedIq}.png`);
      playSfx("success");
    }
  };

  return (
    <div className="mt-4 border border-[#00d4ff]/35 bg-[#071219] p-5 text-center">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-[#00d4ff]">
          <Headphones className="h-4 w-4" />
          {locale === "zh" ? "60秒听音盲测 · EAR IQ 挑战" : "60s BLIND EAR IQ TEST"}
        </span>
        <div className="flex items-center gap-3 font-mono">
          {bestEarIq && <span className="text-[#a855f7]">BEST IQ {bestEarIq}</span>}
          <span className="font-bold text-[#ff6a00]">{timeLeft}s</span>
          <span className="font-bold text-[#00ff88]">SCORE {score}</span>
        </div>
      </div>

      {phase === "ready" && (
        <div className="py-5">
          <p className="text-xs text-[#9fb2c2]">
            {locale === "zh"
              ? "系统将盲播 2~4 个旋律音 (已隐藏键盘亮灯提示)，请在下方琴键/外接MIDI/麦克风还原弹出！"
              : "Listen blindly to 2–4 notes (hints hidden), then echo them back on the keyboard below within 60 seconds."}
          </p>
          <button
            type="button"
            onClick={startTest}
            className="mt-4 inline-flex items-center gap-2 bg-[#00d4ff] px-5 py-2.5 text-xs font-bold text-[#0a0a0a]"
          >
            <Play className="h-4 w-4 fill-current" />
            {locale === "zh" ? "开始 60 秒耳朵 IQ 测试" : "START 60s EAR IQ CHALLENGE"}
          </button>
        </div>
      )}

      {phase === "playing" && (
        <div className="py-4">
          <div className="text-sm font-bold text-white">
            {locale === "zh"
              ? `请依序弹奏刚听到的 ${sequence.length} 个音 (${inputSeq.length}/${sequence.length})`
              : `Echo back ${sequence.length} notes (${inputSeq.length}/${sequence.length})`}
          </div>
          <div className="mt-3 flex justify-center gap-2">
            {sequence.map((_, idx) => (
              <span
                key={idx}
                className={`flex h-9 w-9 items-center justify-center border font-mono text-xs font-bold ${
                  idx < inputSeq.length
                    ? "border-[#00ff88] bg-[#082417] text-[#00ff88]"
                    : "border-[#00d4ff]/40 bg-[#0b1b24] text-[#7dd3fc]"
                }`}
              >
                {idx < inputSeq.length ? midiToName(inputSeq[idx]) : "?"}
              </span>
            ))}
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => playBlindSequence(sequence)}
              className="border border-[#00d4ff]/40 bg-[#0c2330] px-3 py-1 text-[11px] font-bold text-[#00d4ff]"
            >
              🔊 {locale === "zh" ? "重听一遍" : "REPLAY AUDIO"}
            </button>
          </div>
          {statusMsg && (
            <div className="mt-2.5 text-xs font-bold text-[#00ff88]">{statusMsg}</div>
          )}
        </div>
      )}

      {phase === "finished" && (
        <div className="py-4">
          <div className="flex items-center justify-center gap-2 text-2xl font-extrabold text-[#00ff88]">
            <Trophy className="h-6 w-6 text-[#ff6a00]" />
            EAR IQ {computedIq}
          </div>
          <div className="mt-1 text-xs text-[#9fb2c2]">
            {locale === "zh"
              ? `总分 ${score} · 命中 ${correctRounds}/${totalRounds} 轮 (${computedAccuracy}%) · 结果已计入成长档案`
              : `Score ${score} · ${correctRounds}/${totalRounds} rounds (${computedAccuracy}%)`}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleDownloadEarCard}
              className="bg-[#ff6a00] px-4 py-1.5 text-xs font-bold text-[#0a0a0a]"
            >
              {locale === "zh" ? "导出耳朵 IQ 战报 (.PNG)" : "SAVE EAR IQ POSTER (.PNG)"}
            </button>
            <button
              type="button"
              onClick={startTest}
              className="flex items-center gap-1 border border-[#333] bg-[#111] px-4 py-1.5 text-xs text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {locale === "zh" ? "再来一次" : "RETRY"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
