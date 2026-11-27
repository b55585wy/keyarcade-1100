"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Sparkles,
  Trash2,
  CheckCircle2,
  FileMusic,
  Wand2,
  Bot,
  AudioWaveform,
  KeyRound,
  Loader2,
  Mic,
  Square,
} from "lucide-react";
import type { Song, YamahaModelId } from "@/types/music";
import { parseMidiArrayBuffer } from "@/lib/music/midi-parser";
import { parseJianpuText, parseMusicXml } from "@/lib/music/score-parsers";
import {
  transcribeAudioBlob,
  transcribeAudioFile,
  type TranscriptionSourceMode,
} from "@/lib/music/audio-transcriber";
import { detectPitchFromSamples } from "@/lib/music/mic-pitch";
import type { DeepSeekModelName, DeepSeekScorePayload } from "@/lib/music/deepseek-score";
import {
  deleteCustomSong,
  getCustomSongs,
  getStoredModel,
  saveCustomSong,
  subscribeStore,
} from "@/lib/storage/academy-store";
import { SheetMusicView } from "@/components/score/sheet-music-view";
import { useI18n } from "@/lib/i18n";
import { playSfx } from "@/lib/sfx";

const DEEPSEEK_KEY_STORAGE = "yamaha1100:deepseek-key";
const DEEPSEEK_KEY_EVENT = "yamaha1100:deepseek-key-change";

function subscribeDeepSeekKey(cb: () => void) {
  window.addEventListener(DEEPSEEK_KEY_EVENT, cb);
  return () => window.removeEventListener(DEEPSEEK_KEY_EVENT, cb);
}

function readDeepSeekKey(): string {
  return window.localStorage.getItem(DEEPSEEK_KEY_STORAGE) ?? "";
}

function writeDeepSeekKey(next: string) {
  if (next.trim()) {
    window.localStorage.setItem(DEEPSEEK_KEY_STORAGE, next.trim());
  } else {
    window.localStorage.removeItem(DEEPSEEK_KEY_STORAGE);
  }
  window.dispatchEvent(new CustomEvent(DEEPSEEK_KEY_EVENT));
}

const JIANPU_PRESETS = [
  {
    name: "两只老虎 (Two Tigers)",
    key: "C",
    bpm: 104,
    text: "[C]1 2 3 1 | [C]1 2 3 1 | [F]3 4 5 - | [C]3 4 5 - | [G]5_ 6_ 5_ 4_ [C]3 1 | [G]5_ 6_ 5_ 4_ [C]3 1 | [C]2 [G]5. [C]1 - | [C]2 [G]5. [C]1 -",
  },
  {
    name: "生日快乐 (Happy Birthday)",
    key: "C",
    bpm: 96,
    text: "5._ 5._ | [C]6. 5. 1 | [G]7. - 5._ 5._ | [G]6. 5. 2 | [C]1 - 5._ 5._ | [C]5 3 1 | [F]7. 6. 4_ 4_ | [C]3 1 [G]2 | [C]1 -",
  },
  {
    name: "沧海一声笑 (国风五声)",
    key: "C",
    bpm: 108,
    text: "[C]6 5 3 2 | [Am]1 - 3 2 | [F]1 6. 5. - | [C]5. 6. 1 2 | [G]3 5 6 5 | [C]3 2 1 -",
  },
];

const DEEPSEEK_PROMPTS = [
  {
    labelZh: "CTK-1100 抒情入门 16 小节",
    labelEn: "CTK-1100 Warm Ballad",
    key: "C",
    bpm: 84,
    prompt: "创作一首适合卡西欧 CTK-1100 新手练习的 16 小节 C 大调抒情钢琴小品，右手旋律优美连贯，左手配合 C / Am / F / G7 四小节循环伴奏",
  },
  {
    labelZh: "国风五声古风小曲",
    labelEn: "Pentatonic Folk Etude",
    key: "C",
    bpm: 96,
    prompt: "用纯正中国五声调式（1 2 3 5 6）编写 12 小节古风竹笛感钢琴独奏曲，带 Am / F / C / G 伴奏和弦与流动八分音符",
  },
  {
    labelZh: "卡农进行分解和弦练习",
    labelEn: "Canon Progression Etude",
    key: "C",
    bpm: 92,
    prompt: "基于经典卡农和弦进行 C - G - Am - Em - F - C - F - G 编写一首 16 小节流行钢琴爬音练习曲，逐步升高把位",
  },
  {
    labelZh: "爵士律动练习曲",
    labelEn: "Light Jazz Groove",
    key: "F",
    bpm: 108,
    prompt: "编写一首轻快爵士律动钢琴短曲（12 小节，F 大调），使用七和弦 Fmaj7 / Dm7 / Gm7 / C7 进行并带切分音符",
  },
];

export default function ImportPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const [tab, setTab] = useState<"file" | "jianpu" | "deepseek">("file");
  const [model, setModel] = useState<YamahaModelId>("kbp1100");
  const [customSongs, setCustomSongs] = useState<Song[]>([]);
  const [previewSong, setPreviewSong] = useState<Song | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Audio transcription state
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioSourceMode, setAudioSourceMode] = useState<TranscriptionSourceMode>("piano");
  const [audioBpmOverride, setAudioBpmOverride] = useState<string>("");
  const [audioAutoChord, setAudioAutoChord] = useState(true);
  const [audioTelemetry, setAudioTelemetry] = useState<{
    analyzedSeconds: number;
    totalSeconds: number;
    detectedBpm: number;
    jianpuDraft: string;
  } | null>(null);

  // Quiet humming recorder state
  const [humRecording, setHumRecording] = useState(false);
  const [humLiveNote, setHumLiveNote] = useState<string | null>(null);
  const [humLevel, setHumLevel] = useState(0);
  const [humSec, setHumSec] = useState(0);
  const humRecorderRef = useRef<MediaRecorder | null>(null);
  const humStreamRef = useRef<MediaStream | null>(null);
  const humMonitorCtxRef = useRef<AudioContext | null>(null);
  const humTimerRef = useRef<number | null>(null);
  const humChunksRef = useRef<Blob[]>([]);

  // Jianpu form state
  const [jpTitle, setJpTitle] = useState("两只老虎 · 自动和弦版");
  const [jpKey, setJpKey] = useState("C");
  const [jpBpm, setJpBpm] = useState(104);
  const [jpAutoChord, setJpAutoChord] = useState(true);
  const [jpText, setJpText] = useState(JIANPU_PRESETS[0].text);

  // DeepSeek AI form state
  const browserApiKey = useSyncExternalStore(subscribeDeepSeekKey, readDeepSeekKey, () => "");
  const [serverKeyConfigured, setServerKeyConfigured] = useState(false);
  const [dsModel, setDsModel] = useState<DeepSeekModelName>("deepseek-chat");
  const [dsPrompt, setDsPrompt] = useState(DEEPSEEK_PROMPTS[0].prompt);
  const [dsKey, setDsKey] = useState("C");
  const [dsBpm, setDsBpm] = useState(88);
  const [dsBusy, setDsBusy] = useState(false);
  const [dsPayloadNote, setDsPayloadNote] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setCustomSongs(getCustomSongs());
      setModel(getStoredModel());
    };
    sync();
    return subscribeStore(sync);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/deepseek/score")
      .then((r) => r.json())
      .then((d: { serverKeyConfigured?: boolean }) => {
        if (active && typeof d.serverKeyConfigured === "boolean") {
          setServerKeyConfigured(d.serverKeyConfigured);
        }
      })
      .catch(() => {
        // ignore probe error
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (humTimerRef.current !== null) window.clearInterval(humTimerRef.current);
      if (humStreamRef.current) {
        for (const t of humStreamRef.current.getTracks()) t.stop();
      }
      if (humMonitorCtxRef.current) {
        void humMonitorCtxRef.current.close();
      }
    };
  }, []);

  const applyTranscribedResult = (res: Awaited<ReturnType<typeof transcribeAudioFile>>) => {
    setPreviewSong(res.song);
    setAudioTelemetry({
      analyzedSeconds: res.analyzedSeconds,
      totalSeconds: res.totalSeconds,
      detectedBpm: res.detectedBpm,
      jianpuDraft: res.jianpuDraft,
    });
    setJpTitle(res.song.title);
    setJpKey(res.song.keySignature);
    setJpBpm(res.song.bpm);
    setJpText(res.jianpuDraft);
    playSfx("powerup");
  };

  const stopHumRecording = () => {
    const rec = humRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    setHumRecording(false);
    setHumLiveNote(null);
    setHumLevel(0);
    if (humTimerRef.current !== null) {
      window.clearInterval(humTimerRef.current);
      humTimerRef.current = null;
    }
  };

  const startHumRecording = async () => {
    setErrorMsg(null);
    setSavedNotice(null);
    setAudioTelemetry(null);
    setDsPayloadNote(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setErrorMsg(
        locale === "zh"
          ? "当前浏览器不支持麦克风录音，请在 HTTPS 或 localhost 的 Chrome / Edge / 安卓浏览器中运行。"
          : "Microphone recording requires Chrome/Edge/Android over HTTPS or localhost.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      humStreamRef.current = stream;
      humChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      humRecorderRef.current = recorder;

      // Live pitch & level telemetry loop while user hums softly
      const monCtx = new AudioContext();
      humMonitorCtxRef.current = monCtx;
      const src = monCtx.createMediaStreamSource(stream);
      const analyser = monCtx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const sampleBuf = new Float32Array(analyser.fftSize);
      const startMs = performance.now();

      humTimerRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(sampleBuf);
        const pitch = detectPitchFromSamples(sampleBuf, monCtx.sampleRate, 0.005, 0.70, 75, 1100);
        let peak = 0;
        for (let i = 0; i < sampleBuf.length; i++) {
          const v = Math.abs(sampleBuf[i]);
          if (v > peak) peak = v;
        }
        setHumLevel(Math.min(100, Math.round(peak * 350)));
        setHumLiveNote(pitch ? pitch.noteName : null);
        setHumSec((performance.now() - startMs) / 1000);
      }, 90);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) humChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        for (const t of stream.getTracks()) t.stop();
        humStreamRef.current = null;
        if (humMonitorCtxRef.current) {
          void humMonitorCtxRef.current.close();
          humMonitorCtxRef.current = null;
        }
        const blob = new Blob(humChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const parsedBpm = parseInt(audioBpmOverride, 10);
        setAudioBusy(true);
        void transcribeAudioBlob(blob, {
          title: locale === "zh" ? "我的轻声哼唱曲谱" : "Hummed Melody Score",
          sourceMode: "hum",
          autoAccompaniment: audioAutoChord,
          bpmOverride:
            !Number.isNaN(parsedBpm) && parsedBpm >= 45 && parsedBpm <= 180 ? parsedBpm : undefined,
          recommendedModel: model,
        })
          .then((res) => applyTranscribedResult(res))
          .catch((err) => {
            setErrorMsg(err instanceof Error ? err.message : "未能识别哼唱旋律");
            playSfx("error");
          })
          .finally(() => {
            setAudioBusy(false);
          });
      };

      setHumSec(0);
      setHumRecording(true);
      recorder.start(250);
    } catch (err) {
      setErrorMsg(
        locale === "zh"
          ? `无法开启麦克风进行哼唱录谱 (${err instanceof Error ? err.message : "Permission denied"})`
          : `Microphone error: ${err instanceof Error ? err.message : "Permission denied"}`,
      );
      playSfx("error");
    }
  };

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setSavedNotice(null);
    setAudioTelemetry(null);
    setDsPayloadNote(null);

    try {
      const lower = file.name.toLowerCase();
      let song: Song;

      if (/\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(lower)) {
        setAudioBusy(true);
        const parsedBpm = parseInt(audioBpmOverride, 10);
        const res = await transcribeAudioFile(file, {
          sourceMode: audioSourceMode,
          autoAccompaniment: audioAutoChord,
          bpmOverride: !Number.isNaN(parsedBpm) && parsedBpm >= 45 && parsedBpm <= 180 ? parsedBpm : undefined,
          recommendedModel: model,
        });
        applyTranscribedResult(res);
        return;
      } else if (lower.endsWith(".mid") || lower.endsWith(".midi")) {
        const buf = await file.arrayBuffer();
        song = parseMidiArrayBuffer(buf, file.name);
      } else if (lower.endsWith(".musicxml") || lower.endsWith(".xml")) {
        const txt = await file.text();
        song = parseMusicXml(txt, file.name);
      } else if (lower.endsWith(".json")) {
        const txt = await file.text();
        const parsed = JSON.parse(txt) as Song;
        if (!Array.isArray(parsed.notes) || parsed.notes.length === 0) {
          throw new Error("Invalid JSON song format: missing notes array.");
        }
        song = { ...parsed, id: `json-${Date.now()}`, sourceFormat: "json" };
      } else {
        throw new Error(
          locale === "zh"
            ? "不支持的文件格式，请上传 .mp3 / .wav / .m4a / .ogg / .mid / .musicxml / .json"
            : "Unsupported file. Drop .mp3, .wav, .m4a, .ogg, .mid, .musicxml, or .json.",
        );
      }

      setPreviewSong(song);
      playSfx("powerup");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to parse file.");
      playSfx("error");
    } finally {
      setAudioBusy(false);
    }
  };

  const handleGenerateJianpu = () => {
    setErrorMsg(null);
    setSavedNotice(null);
    setDsPayloadNote(null);
    try {
      const song = parseJianpuText(jpText, {
        title: jpTitle,
        keySignature: jpKey,
        bpm: jpBpm,
        autoAccompaniment: jpAutoChord,
        recommendedModel: model,
      });
      setPreviewSong(song);
      playSfx("powerup");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to parse Jianpu text.");
      playSfx("error");
    }
  };

  const callDeepSeekScore = async (opts: {
    mode: "compose" | "arrange";
    prompt: string;
    draftJianpu?: string;
    keySignature: string;
    bpm: number;
  }) => {
    setErrorMsg(null);
    setSavedNotice(null);
    setDsPayloadNote(null);
    setDsBusy(true);
    try {
      const resp = await fetch("/api/deepseek/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: opts.mode,
          prompt: opts.prompt,
          draftJianpu: opts.draftJianpu,
          keySignature: opts.keySignature,
          bpm: opts.bpm,
          targetModel: model,
          modelName: dsModel,
          apiKey: browserApiKey || undefined,
        }),
      });
      const data = (await resp.json()) as {
        song?: Song;
        payload?: DeepSeekScorePayload;
        error?: string;
        code?: string;
      };
      if (!resp.ok || !data.song || !data.payload) {
        if (data.code === "NO_DEEPSEEK_KEY") {
          setTab("deepseek");
        }
        throw new Error(data.error || `DeepSeek 请求失败 (${resp.status})`);
      }

      setPreviewSong(data.song);
      setJpTitle(data.song.titleZh || data.song.title);
      setJpKey(data.song.keySignature);
      setJpBpm(data.song.bpm);
      setJpText(data.payload.jianpu);
      setDsPayloadNote(data.payload.arrangementNotes || null);
      playSfx("powerup");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "DeepSeek AI 生成曲谱失败");
      playSfx("error");
    } finally {
      setDsBusy(false);
    }
  };

  const handleSaveAndPlay = (launchArcade: boolean) => {
    if (!previewSong) return;
    saveCustomSong(previewSong);
    playSfx("coin");
    if (launchArcade) {
      router.push(`/arcade?song=${encodeURIComponent(previewSong.id)}`);
    } else {
      setSavedNotice(
        locale === "zh"
          ? `已保存《${previewSong.title}》到个人曲库！`
          : `Saved "${previewSong.title}" to your song bank!`,
      );
    }
  };

  const deepSeekReady = serverKeyConfigured || browserApiKey.trim().length > 0;

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 font-mono sm:px-4">
      <div className="mb-4 terminal-box p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f1f1f] pb-3">
          <div>
            <h1 className="text-lg font-bold text-[#ff6a00]">
              &gt;{" "}
              {locale === "zh"
                ? "导入音乐 & DeepSeek AI 自动生成曲谱"
                : "MUSIC IMPORTER · AUDIO TRANSCRIBER & DEEPSEEK AI"}
            </h1>
            <p className="mt-1 text-xs text-[#666]">
              {locale === "zh"
                ? "上传真实音乐 (.mp3/.wav/.m4a) 或 .mid/.musicxml，或用 DeepSeek AI 一键编配：自动输出五线谱、简谱、和弦与街机落键。"
                : "Drop real songs (.mp3/.wav/.m4a), .mid/.musicxml, or generate arrangements with DeepSeek AI -> Staff, Jianpu & Arcade."}
            </p>
          </div>

          <div className="flex flex-wrap border border-[#222] bg-[#080808] text-xs">
            <button
              onClick={() => setTab("file")}
              className={`px-3 py-1.5 font-bold ${
                tab === "file" ? "bg-[#ff6a00] text-[#0a0a0a]" : "text-[#888] hover:text-[#e0e0e0]"
              }`}
            >
              [01] {locale === "zh" ? "音乐音频 / MIDI" : "AUDIO / MIDI"}
            </button>
            <button
              onClick={() => setTab("jianpu")}
              className={`px-3 py-1.5 font-bold ${
                tab === "jianpu" ? "bg-[#00d4ff] text-[#0a0a0a]" : "text-[#888] hover:text-[#e0e0e0]"
              }`}
            >
              [02] {locale === "zh" ? "简谱工作台" : "JIANPU STUDIO"}
            </button>
            <button
              onClick={() => setTab("deepseek")}
              className={`flex items-center gap-1 px-3 py-1.5 font-bold ${
                tab === "deepseek"
                  ? "bg-[#a855f7] text-[#0a0a0a]"
                  : "text-[#888] hover:text-[#e0e0e0]"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              [03] DeepSeek AI
            </button>
          </div>
        </div>

        {/* TAB 01: AUDIO (.mp3/.wav/.m4a) + HUM RECORDER + MIDI + MusicXML */}
        {tab === "file" && (
          <div className="mt-4 space-y-3">
            {/* Hum-to-Score Live Recorder Card */}
            <div className="flex flex-wrap items-center justify-between gap-3 border border-[#00d4ff]/40 bg-[#06131a] p-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-[#00d4ff]">
                  <Mic className="h-4 w-4" />
                  {locale === "zh"
                    ? "轻声哼唱直接生成曲谱 (Hum-to-Score)"
                    : "QUIET HUM-TO-SCORE RECORDER"}
                </div>
                <p className="text-[11px] text-[#88b3c4]">
                  {locale === "zh"
                    ? "开启自动人声增益与低频除噪，对着麦克风轻哼 2 秒以上即可自动识别音高、拍子并生成双谱与和弦。"
                    : "Auto vocal gain + breath rumble filter detects even soft humming into playable Jianpu & Grand Staff."}
                </p>
                {humRecording && (
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="font-bold text-[#ff6a00]">
                      ● REC {humSec.toFixed(1)}s
                    </span>
                    <span className="border border-[#00ff88]/50 bg-[#081a10] px-2 py-0.5 font-bold text-[#00ff88]">
                      {humLiveNote ? `PITCH: ${humLiveNote}` : "LISTENING..."}
                    </span>
                    <span className="inline-block h-2 w-24 overflow-hidden border border-[#243942] bg-[#040a0d]">
                      <span
                        className="block h-full bg-[#00ff88] transition-all"
                        style={{ width: `${humLevel}%` }}
                      />
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={audioBusy}
                onClick={() => (humRecording ? stopHumRecording() : void startHumRecording())}
                className={`pixel-border flex items-center gap-1.5 px-4 py-2 text-xs font-bold ${
                  humRecording
                    ? "bg-[#ff4444] text-[#0a0a0a]"
                    : "bg-[#00d4ff] text-[#0a0a0a] hover:bg-[#5ae4ff]"
                }`}
              >
                {humRecording ? (
                  <>
                    <Square className="h-3.5 w-3.5" />
                    {locale === "zh" ? "停止哼唱并生成曲谱" : "STOP & GENERATE SCORE"}
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    {locale === "zh" ? "开始轻声哼唱" : "START HUMMING"}
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border border-[#1d1d1d] bg-[#080808] px-3 py-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1 font-bold text-[#00ff88]">
                  <AudioWaveform className="h-3.5 w-3.5" />
                  {locale === "zh" ? "音频识别模式:" : "SOURCE MODE:"}
                </span>
                <div className="flex border border-[#242424] bg-[#050505] text-[10px]">
                  {(
                    [
                      ["piano", locale === "zh" ? "钢琴/清唱" : "PIANO/SOLO"],
                      ["hum", locale === "zh" ? "轻声哼唱文件" : "QUIET HUM"],
                      ["pop-song", locale === "zh" ? "流行歌曲(滤伴奏)" : "POP SONG (DSP)"],
                    ] as const
                  ).map(([sm, label]) => (
                    <button
                      key={sm}
                      type="button"
                      onClick={() => setAudioSourceMode(sm)}
                      className={`px-2 py-1 font-bold transition-colors ${
                        audioSourceMode === sm
                          ? "bg-[#ff6a00] text-[#0a0a0a]"
                          : "text-[#777] hover:text-[#e0e0e0]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1 text-[#aaa]">
                  <span>{locale === "zh" ? "指定 BPM:" : "BPM:"}</span>
                  <input
                    type="number"
                    min={45}
                    max={180}
                    placeholder={locale === "zh" ? "自动检测" : "Auto"}
                    value={audioBpmOverride}
                    onChange={(e) => setAudioBpmOverride(e.target.value)}
                    className="w-20 border border-[#2a2a2a] bg-[#0d0d0d] px-2 py-0.5 text-[11px] text-[#00d4ff] focus:border-[#ff6a00] focus:outline-none"
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-[#00ff88]">
                  <input
                    type="checkbox"
                    checked={audioAutoChord}
                    onChange={(e) => setAudioAutoChord(e.target.checked)}
                    className="accent-[#00ff88]"
                  />
                  {locale === "zh" ? "自动生成左手和弦伴奏" : "Auto LH Chords"}
                </label>
              </div>
              <span className="text-[10px] text-[#666]">
                {audioSourceMode === "pop-song"
                  ? locale === "zh"
                    ? "立体声居中人声加权 + 180~1350Hz 滤鼓点/贝斯；多乐器混音推荐提取后点「DeepSeek AI 润色」"
                    : "Center-vocal DSP + 180-1350Hz band-pass; heavy mixes benefit from DeepSeek AI polish"
                  : locale === "zh"
                    ? "本地 Web Audio 解码最长分析前 75 秒旋律"
                    : "Decodes locally via Web Audio (up to first 75s)"}
              </span>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-[#2b2b2b] bg-[#080808] p-8 text-center transition-colors hover:border-[#ff6a00]">
              {audioBusy ? (
                <>
                  <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#00ff88]" />
                  <div className="text-sm font-bold text-[#00ff88]">
                    {locale === "zh"
                      ? "正在解码音乐并识别旋律音高与节拍..."
                      : "Decoding audio & transcribing pitches + tempo..."}
                  </div>
                </>
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-[#ff6a00]" />
                  <div className="text-sm font-bold text-[#e0e0e0]">
                    {locale === "zh"
                      ? "点击上传或拖拽：MP3 / WAV / M4A / OGG 音乐文件，或 .MID / .MusicXML"
                      : "Drop .mp3 / .wav / .m4a / .ogg audio files, OR .mid / .musicxml / .json"}
                  </div>
                  <p className="mt-1 text-xs text-[#666]">
                    {locale === "zh"
                      ? "支持从纯钢琴/清唱/器乐录音直接提取简谱+五线谱，完全兼容 Yamaha & Casio 1100 MIDI 曲库"
                      : "Transcribes melody audio offline into Jianpu + Staff, and imports Standard MIDI / MusicXML"}
                  </p>
                </>
              )}
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.aac,.flac,.webm,.mid,.midi,.musicxml,.xml,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
            </label>

            {audioTelemetry && (
              <div className="flex flex-wrap items-center justify-between gap-2 border border-[#00ff88]/40 bg-[#06140c] px-3 py-2.5 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-[#00ff88]">
                    [AUDIO_TRANSCRIBED] {audioTelemetry.analyzedSeconds.toFixed(1)}s /{" "}
                    {audioTelemetry.totalSeconds.toFixed(1)}s · BPM: {audioTelemetry.detectedBpm}
                  </div>
                  <div className="max-w-2xl truncate text-[10px] text-[#88c8a4]">
                    {locale === "zh" ? "简谱草案:" : "Jianpu draft:"} {audioTelemetry.jianpuDraft}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("jianpu")}
                    className="border border-[#00d4ff]/60 bg-[#071820] px-2.5 py-1 text-[10px] font-bold text-[#00d4ff] hover:bg-[#0b2733]"
                  >
                    {locale === "zh" ? "在简谱工作台微调" : "EDIT JIANPU"}
                  </button>
                  <button
                    type="button"
                    disabled={dsBusy}
                    onClick={() =>
                      void callDeepSeekScore({
                        mode: "arrange",
                        prompt: `为上传音频《${previewSong?.title || "Audio"}》优化节奏与左手和弦伴奏`,
                        draftJianpu: audioTelemetry.jianpuDraft,
                        keySignature: previewSong?.keySignature || "C",
                        bpm: audioTelemetry.detectedBpm,
                      })
                    }
                    className="flex items-center gap-1 border border-[#a855f7] bg-[#160a24] px-2.5 py-1 text-[10px] font-bold text-[#d8b4fe] hover:bg-[#24113a] disabled:opacity-50"
                  >
                    {dsBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                    {locale === "zh" ? "DeepSeek AI 润色和弦" : "POLISH WITH DEEPSEEK"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 02: JIANPU STUDIO */}
        {tab === "jianpu" && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-[#666]">{locale === "zh" ? "快速模板:" : "Presets:"}</span>
              {JIANPU_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    setJpTitle(p.name);
                    setJpKey(p.key);
                    setJpBpm(p.bpm);
                    setJpText(p.text);
                  }}
                  className="border border-[#262626] bg-[#0c0c0c] px-2.5 py-1 text-[#00d4ff] hover:border-[#00d4ff]"
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="block border border-[#222] bg-[#080808] p-2.5 sm:col-span-2">
                <span className="block text-[10px] text-[#666]">TITLE</span>
                <input
                  value={jpTitle}
                  onChange={(e) => setJpTitle(e.target.value)}
                  className="mt-1 w-full bg-transparent text-xs text-[#e0e0e0] focus:outline-none"
                />
              </label>
              <label className="block border border-[#222] bg-[#080808] p-2.5">
                <span className="block text-[10px] text-[#666]">KEY (1=?)</span>
                <select
                  value={jpKey}
                  onChange={(e) => setJpKey(e.target.value)}
                  className="mt-1 w-full bg-[#080808] text-xs text-[#00ff88] focus:outline-none"
                >
                  {["C", "G", "D", "F", "Bb", "Eb", "A"].map((k) => (
                    <option key={k} value={k}>
                      1 = {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block border border-[#222] bg-[#080808] p-2.5">
                <span className="block text-[10px] text-[#666]">BPM</span>
                <input
                  type="number"
                  min={40}
                  max={200}
                  value={jpBpm}
                  onChange={(e) => setJpBpm(parseInt(e.target.value || "100", 10))}
                  className="mt-1 w-full bg-transparent text-xs text-[#ff6a00] focus:outline-none"
                />
              </label>
            </div>

            <div className="border border-[#222] bg-[#080808] p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#666]">
                <span>
                  {locale === "zh"
                    ? "语法: 1-7 音符 · 0 休止 · - 延音 · _ 八分音符 · . 低八度 · ' 高八度 · [C]/[Am] 自动生成左手伴奏"
                    : "Syntax: 1-7 notes · 0 rest · - sustain · _ eighth · . low oct · ' high oct · [C] auto LH chord"}
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-[#00ff88]">
                  <input
                    type="checkbox"
                    checked={jpAutoChord}
                    onChange={(e) => setJpAutoChord(e.target.checked)}
                    className="accent-[#00ff88]"
                  />
                  {locale === "zh" ? "自动生成左手和弦伴奏" : "Auto LH Accompaniment"}
                </label>
              </div>
              <textarea
                rows={4}
                value={jpText}
                onChange={(e) => setJpText(e.target.value)}
                className="w-full bg-[#050505] p-2 font-mono text-xs text-[#e0e0e0] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleGenerateJianpu}
                className="pixel-border flex items-center gap-2 bg-[#00d4ff] px-5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#4de1ff]"
              >
                <Wand2 className="h-4 w-4" />
                {locale === "zh" ? "一键自动生成五线谱 & 游戏关卡" : "AUTO-GENERATE SCORE & ARCADE"}
              </button>
              <button
                type="button"
                disabled={dsBusy || !jpText.trim()}
                onClick={() =>
                  void callDeepSeekScore({
                    mode: "arrange",
                    prompt: `帮我为《${jpTitle}》润色节奏并自动配好雅马哈/卡西欧伴奏和弦`,
                    draftJianpu: jpText,
                    keySignature: jpKey,
                    bpm: jpBpm,
                  })
                }
                className="flex items-center gap-2 border border-[#a855f7] bg-[#160a24] px-4 py-2 text-xs font-bold text-[#d8b4fe] hover:bg-[#24113a] disabled:opacity-50"
              >
                {dsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {locale === "zh" ? "DeepSeek AI 配和弦与润色" : "DEEPSEEK AI ARRANGE"}
              </button>
            </div>
          </div>
        )}

        {/* TAB 03: DEEPSEEK AI COMPOSER & ARRANGER */}
        {tab === "deepseek" && (
          <div className="mt-4 space-y-3">
            {/* API Key & Model Config Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border border-[#a855f7]/40 bg-[#12091d] p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#a855f7]" />
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold ${
                    deepSeekReady
                      ? "bg-[#00ff88] text-[#0a0a0a]"
                      : "border border-[#ff6a00]/60 bg-[#211205] text-[#ff6a00]"
                  }`}
                >
                  {serverKeyConfigured
                    ? "ENV: DEEPSEEK_API_KEY READY"
                    : browserApiKey.trim()
                      ? "BROWSER KEY READY"
                      : locale === "zh"
                        ? "未配置 API KEY"
                        : "NO API KEY"}
                </span>
                <select
                  aria-label="DeepSeek Model"
                  value={dsModel}
                  onChange={(e) => setDsModel(e.target.value as DeepSeekModelName)}
                  className="border border-[#2f2144] bg-[#080808] px-2 py-1 text-[11px] text-[#00d4ff] focus:outline-none"
                >
                  <option value="deepseek-chat">deepseek-chat (V3 快速结构化)</option>
                  <option value="deepseek-reasoner">deepseek-reasoner (R1 深度编配)</option>
                </select>
              </div>

              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                <input
                  type="password"
                  aria-label="DeepSeek API Key"
                  placeholder={
                    serverKeyConfigured
                      ? locale === "zh"
                        ? "服务端环境变量已生效（可选填覆盖 Key）"
                        : "Server env key active (optional override)"
                      : locale === "zh"
                        ? "输入 DeepSeek API Key (sk-... 仅存本地浏览器)"
                        : "Paste DeepSeek API Key (sk-... stored locally)"
                  }
                  value={browserApiKey}
                  onChange={(e) => writeDeepSeekKey(e.target.value)}
                  className="min-w-[240px] flex-1 max-w-sm border border-[#2f2144] bg-[#070707] px-2.5 py-1 text-[11px] text-[#e0e0e0] focus:border-[#a855f7] focus:outline-none"
                />
                {browserApiKey && (
                  <button
                    type="button"
                    onClick={() => writeDeepSeekKey("")}
                    className="border border-[#333] px-2 py-1 text-[10px] text-[#888] hover:text-[#ff4444]"
                  >
                    {locale === "zh" ? "清除" : "CLEAR"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-[#666]">{locale === "zh" ? "AI 编曲灵感:" : "AI Prompts:"}</span>
              {DEEPSEEK_PROMPTS.map((item) => (
                <button
                  key={item.labelEn}
                  type="button"
                  onClick={() => {
                    setDsPrompt(item.prompt);
                    setDsKey(item.key);
                    setDsBpm(item.bpm);
                  }}
                  className="border border-[#2b203a] bg-[#0d0a12] px-2.5 py-1 text-[#d8b4fe] hover:border-[#a855f7]"
                >
                  {locale === "zh" ? item.labelZh : item.labelEn}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="block border border-[#222] bg-[#080808] p-2.5 sm:col-span-2">
                <span className="block text-[10px] text-[#666]">
                  {locale === "zh" ? "TARGET KEY (调号偏好)" : "KEY PREFERENCE"}
                </span>
                <select
                  value={dsKey}
                  onChange={(e) => setDsKey(e.target.value)}
                  className="mt-1 w-full bg-[#080808] text-xs text-[#00ff88] focus:outline-none"
                >
                  {["C", "G", "D", "F", "Bb", "Eb", "Am", "Dm"].map((k) => (
                    <option key={k} value={k}>
                      1 = {k}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block border border-[#222] bg-[#080808] p-2.5">
                <span className="block text-[10px] text-[#666]">BPM (速度)</span>
                <input
                  type="number"
                  min={50}
                  max={170}
                  value={dsBpm}
                  onChange={(e) => setDsBpm(parseInt(e.target.value || "92", 10))}
                  className="mt-1 w-full bg-transparent text-xs text-[#ff6a00] focus:outline-none"
                />
              </label>

              <div className="border border-[#222] bg-[#080808] p-2.5">
                <span className="block text-[10px] text-[#666]">HARDWARE</span>
                <div className="mt-1 text-xs font-bold text-[#00d4ff]">{model.toUpperCase()}</div>
              </div>
            </div>

            <div className="border border-[#222] bg-[#080808] p-3">
              <div className="mb-1 text-[10px] text-[#666]">
                {locale === "zh"
                  ? "描述想要的曲风、曲名、难度或练习目标（DeepSeek 会直接生成带 [C]/[Am] 左手和弦的简谱并编译为双谱 + 街机谱）："
                  : "Describe song title, mood, difficulty, or chord progression — DeepSeek outputs Jianpu + Chords compiled directly into Grand Staff & Arcade:"}
              </div>
              <textarea
                rows={3}
                value={dsPrompt}
                onChange={(e) => setDsPrompt(e.target.value)}
                className="w-full bg-[#050505] p-2 font-mono text-xs text-[#e0e0e0] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={dsBusy}
                onClick={() =>
                  void callDeepSeekScore({
                    mode: "compose",
                    prompt: dsPrompt,
                    keySignature: dsKey,
                    bpm: dsBpm,
                  })
                }
                className="pixel-border flex items-center gap-2 bg-[#a855f7] px-5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#c084fc] disabled:opacity-60"
              >
                {dsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                {dsBusy
                  ? locale === "zh"
                    ? "DeepSeek 正在编配生成..."
                    : "GENERATING VIA DEEPSEEK..."
                  : locale === "zh"
                    ? "$ DEEPSEEK AI 生成双谱曲目"
                    : "$ GENERATE SCORE WITH DEEPSEEK AI"}
              </button>
              <span className="text-[10px] text-[#666]">
                {locale === "zh"
                  ? "也可在项目根目录 .env.local 设置 DEEPSEEK_API_KEY 供全站免输入使用"
                  : "Or set DEEPSEEK_API_KEY in .env.local on the server"}
              </span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 border border-[#aa3333] bg-[#220d0d] px-3 py-2 text-xs text-[#ff6666]">
            [ERROR] {errorMsg}
          </div>
        )}

        {savedNotice && (
          <div className="mt-3 flex items-center gap-2 border border-[#00ff88]/50 bg-[#081a10] px-3 py-2 text-xs text-[#00ff88]">
            <CheckCircle2 className="h-4 w-4" />
            {savedNotice}
          </div>
        )}
      </div>

      {/* Live Preview of Generated Score */}
      {previewSong && (
        <div className="mb-6 space-y-3">
          <div className="terminal-box flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#00ff88]">
                <Sparkles className="h-4 w-4" />
                {locale === "zh"
                  ? `解析成功 [${previewSong.sourceFormat.toUpperCase()}] · 已自动生成双谱与练习轨`
                  : `PARSED [${previewSong.sourceFormat.toUpperCase()}] · READY TO PRACTICE`}
              </div>
              <div className="mt-1 text-sm font-bold text-[#e0e0e0]">
                {previewSong.title} ({previewSong.notes.length} notes · Key {previewSong.keySignature} · {previewSong.bpm} BPM)
              </div>
              {dsPayloadNote && (
                <div className="mt-1 text-[11px] text-[#d8b4fe]">
                  [AI TIPS] {dsPayloadNote}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSaveAndPlay(false)}
                className="border border-[#00ff88] bg-[#081910] px-4 py-2 text-xs font-bold text-[#00ff88] hover:bg-[#10301e]"
              >
                {locale === "zh" ? "保存到我的曲库" : "SAVE TO BANK"}
              </button>
              <button
                onClick={() => handleSaveAndPlay(true)}
                className="pixel-border bg-[#ff6a00] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#ff8a33]"
              >
                &gt; {locale === "zh" ? "保存并立即开始街机练琴" : "SAVE & PLAY ARCADE"}
              </button>
            </div>
          </div>

          <SheetMusicView song={previewSong} currentBeat={0} />
        </div>
      )}

      {/* Custom Saved Songs Bank */}
      <div className="terminal-box p-4">
        <div className="mb-3 flex items-center justify-between border-b border-[#1c1c1c] pb-2">
          <span className="flex items-center gap-2 text-xs font-bold text-[#ff6a00]">
            <FileMusic className="h-4 w-4" />
            {locale === "zh"
              ? `我的自定义导入曲库 (${customSongs.length})`
              : `MY IMPORTED SONGS (${customSongs.length})`}
          </span>
        </div>

        {customSongs.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#555]">
            {locale === "zh"
              ? "尚未保存自定义曲目。上传音频/MIDI、输入简谱或使用 DeepSeek AI 生成即可加入！"
              : "No custom songs saved yet. Upload audio/MIDI, paste Jianpu, or generate via DeepSeek AI!"}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {customSongs.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border border-[#222] bg-[#0a0a0a] p-3 text-xs"
              >
                <div>
                  <div className="font-bold text-[#e0e0e0]">{s.title}</div>
                  <div className="mt-0.5 text-[10px] text-[#666]">
                    {s.sourceFormat.toUpperCase()} · {s.notes.length} notes · Key {s.keySignature} · {s.bpm} BPM
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/arcade?song=${encodeURIComponent(s.id)}`)}
                    className="bg-[#ff6a00] px-2.5 py-1 text-[10px] font-bold text-[#0a0a0a]"
                  >
                    PLAY
                  </button>
                  <button
                    onClick={() => {
                      deleteCustomSong(s.id);
                      playSfx("key");
                    }}
                    className="border border-[#2b2b2b] p-1 text-[#777] hover:border-[#ff4444] hover:text-[#ff4444]"
                    title="Delete song"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
