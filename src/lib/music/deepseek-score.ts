import type { KeyboardModelId, Song } from "@/types/music";
import { parseJianpuText } from "./score-parsers";

export type DeepSeekModelName = "deepseek-chat" | "deepseek-reasoner";
export type DeepSeekScoreMode = "compose" | "arrange";

export interface DeepSeekScoreRequest {
  prompt: string;
  mode?: DeepSeekScoreMode;
  draftJianpu?: string;
  keySignature?: string;
  bpm?: number;
  targetModel?: KeyboardModelId;
  modelName?: DeepSeekModelName;
  apiKey?: string;
}

export interface DeepSeekScorePayload {
  title: string;
  titleZh?: string;
  keySignature: string;
  bpm: number;
  timeSignature?: [number, number];
  difficulty?: 1 | 2 | 3 | 4 | 5;
  jianpu: string;
  arrangementNotes?: string;
}

export function buildDeepSeekMessages(req: DeepSeekScoreRequest): { role: "system" | "user"; content: string }[] {
  const keySig = req.keySignature || "C";
  const bpm = req.bpm || 96;
  const targetModel = req.targetModel || "ctk1100";

  const system = `You are a master piano & electronic keyboard arranger for Yamaha 1100 (KBP-1100 88K / PSR-1100 61K) and Casio 1100 (PX-S1100 88K / WK-1100 76K / CTK-1100 61K).
Output ONLY a valid JSON object (no markdown fences, no commentary outside JSON) matching this schema:
{
  "title": "English title",
  "titleZh": "中文曲名",
  "keySignature": "C",
  "bpm": 96,
  "timeSignature": [4, 4],
  "difficulty": 2,
  "jianpu": "[C] 1 2 3 1 | [G] 2 - ... ",
  "arrangementNotes": "Brief playing tips in Chinese"
}

STRICT Jianpu notation syntax rules (CRITICAL - parser relies on exact tokens separated by spaces):
- Separate bars with " | " and tokens with spaces.
- Scale degrees: 1 2 3 4 5 6 7, rest: 0.
- Accidentals before digit if needed: #4, b7.
- Octave marks AFTER digit: ' for +1 octave (e.g. 1' 2'), . for -1 octave (e.g. 5. 6.).
- Rhythm AFTER octave marks: _ for eighth note (0.5 beat), - for +1 beat sustain, -- for +2 beats, * for dotted. Combine properly: e.g. 5._ 6._ 1 2_ 3_ | 5 - - -
- Left-hand auto-accompaniment chords at bar/phrase starts: prefix token with [C], [Am], [F], [G], [G7], [Dm], [Em], [C7], [Fmaj7], [Am7] (e.g. "[C] 1 2 3 4 | [F] 6 5 4 3").
- Generate complete, musical 8 to 24 bars suitable for ${targetModel.toUpperCase()}, keeping melody strictly playable within comfortable keyboard range.`;

  const user =
    req.mode === "arrange" && req.draftJianpu
      ? `用户通过音频提取得到一份粗略简谱草案，请保持主旋律轮廓并润色拍子、修正明显杂音跳度、按小节配上合理和谐的雅马哈/卡西欧伴奏和弦标记（如 [C] [Am] [F] [G7]）。
参考需求：${req.prompt || "流行钢琴伴奏编配"}
期望调号：1=${keySig}，期望速度：${bpm} BPM
原始简谱草案：
${req.draftJianpu}`
      : `请根据以下要求生成可直接上琴练习的简谱+和弦完整钢琴谱：
需求描述：${req.prompt}
目标琴型：${targetModel.toUpperCase()}
调号偏好：1=${keySig}
速度偏好：${bpm} BPM`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function normalizeAiJianpuString(raw: string): string {
  return raw
    .replace(/\r?\n/g, " | ")
    .replace(/\|+/g, " | ")
    .replace(/(\[[A-G][#b]?(?:maj7|m7|m|7|dim|aug|sus4|sus2|6)?\])\s+/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDeepSeekScorePayload(rawContent: string): DeepSeekScorePayload {
  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("DeepSeek 未返回有效的 JSON 曲谱结构。");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<DeepSeekScorePayload>;
  if (!parsed.jianpu || typeof parsed.jianpu !== "string") {
    throw new Error("DeepSeek 返回结果缺少 jianpu 简谱字段。");
  }

  const bpm = typeof parsed.bpm === "number" && parsed.bpm >= 40 && parsed.bpm <= 200 ? Math.round(parsed.bpm) : 96;
  const diff = parsed.difficulty && parsed.difficulty >= 1 && parsed.difficulty <= 5 ? parsed.difficulty : 2;
  const ts: [number, number] =
    Array.isArray(parsed.timeSignature) && parsed.timeSignature.length === 2
      ? [Number(parsed.timeSignature[0]) || 4, Number(parsed.timeSignature[1]) || 4]
      : [4, 4];

  const rawKey = (parsed.keySignature?.trim() || "C")
    .replace(/\s*major$/i, "")
    .replace(/\s*minor$/i, "m")
    .replace(/^1\s*=\s*/i, "");

  return {
    title: parsed.title?.trim() || "DeepSeek AI Composition",
    titleZh: parsed.titleZh?.trim() || parsed.title?.trim() || "DeepSeek AI 生成曲谱",
    keySignature: rawKey || "C",
    bpm,
    timeSignature: ts,
    difficulty: diff as 1 | 2 | 3 | 4 | 5,
    jianpu: normalizeAiJianpuString(parsed.jianpu),
    arrangementNotes: parsed.arrangementNotes?.trim(),
  };
}

export function buildSongFromAiPayload(
  payload: DeepSeekScorePayload,
  recommendedModel: KeyboardModelId = "kbp1100",
): Song {
  const song = parseJianpuText(payload.jianpu, {
    title: payload.titleZh || payload.title,
    composer: "DeepSeek AI Arranger",
    keySignature: payload.keySignature,
    bpm: payload.bpm,
    timeSignature: payload.timeSignature ?? [4, 4],
    autoAccompaniment: true,
    recommendedModel,
  });

  song.id = `ai-${Date.now()}`;
  song.title = payload.title || payload.titleZh || "DeepSeek AI Score";
  song.titleZh = payload.titleZh || payload.title;
  song.difficulty = payload.difficulty ?? 2;
  song.sourceFormat = "ai";
  song.descriptionZh =
    payload.arrangementNotes ||
    `DeepSeek AI 自动编配 · 1=${song.keySignature} · ${song.bpm} BPM · ${song.notes.length} 音符`;
  song.descriptionEn = `DeepSeek AI arranged score · Key ${song.keySignature} · ${song.bpm} BPM`;
  return song;
}
