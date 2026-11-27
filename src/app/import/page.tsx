"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Sparkles, Trash2, CheckCircle2, FileMusic, Wand2 } from "lucide-react";
import type { Song } from "@/types/music";
import { parseMidiArrayBuffer } from "@/lib/music/midi-parser";
import { parseJianpuText, parseMusicXml } from "@/lib/music/score-parsers";
import {
  deleteCustomSong,
  getCustomSongs,
  saveCustomSong,
  subscribeStore,
} from "@/lib/storage/academy-store";
import { SheetMusicView } from "@/components/score/sheet-music-view";
import { useI18n } from "@/lib/i18n";
import { playSfx } from "@/lib/sfx";

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

export default function ImportPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const [tab, setTab] = useState<"file" | "jianpu">("file");
  const [customSongs, setCustomSongs] = useState<Song[]>([]);
  const [previewSong, setPreviewSong] = useState<Song | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Jianpu form state
  const [jpTitle, setJpTitle] = useState("两只老虎 · 自动和弦版");
  const [jpKey, setJpKey] = useState("C");
  const [jpBpm, setJpBpm] = useState(104);
  const [jpAutoChord, setJpAutoChord] = useState(true);
  const [jpText, setJpText] = useState(JIANPU_PRESETS[0].text);

  useEffect(() => {
    const sync = () => setCustomSongs(getCustomSongs());
    sync();
    return subscribeStore(sync);
  }, []);

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setSavedNotice(null);
    try {
      const lower = file.name.toLowerCase();
      let song: Song;
      if (lower.endsWith(".mid") || lower.endsWith(".midi")) {
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
        throw new Error("Unsupported format. Please upload .mid, .midi, .musicxml, .xml, or .json.");
      }
      setPreviewSong(song);
      playSfx("powerup");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to parse song file.");
      playSfx("error");
    }
  };

  const handleGenerateJianpu = () => {
    setErrorMsg(null);
    setSavedNotice(null);
    try {
      const song = parseJianpuText(jpText, {
        title: jpTitle,
        keySignature: jpKey,
        bpm: jpBpm,
        autoAccompaniment: jpAutoChord,
      });
      setPreviewSong(song);
      playSfx("powerup");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to parse Jianpu text.");
      playSfx("error");
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

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 font-mono sm:px-4">
      <div className="mb-4 terminal-box p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f1f1f] pb-3">
          <div>
            <h1 className="text-lg font-bold text-[#ff6a00]">
              &gt; {locale === "zh" ? "曲库导入 & 自动生成琴谱引擎" : "SONG LIBRARY IMPORTER & AUTO-SCORE ENGINE"}
            </h1>
            <p className="mt-1 text-xs text-[#666]">
              {locale === "zh"
                ? "导入雅马哈 .mid / MusicXML 或直接输入简谱，平台自动识别调号、拆分左右手、生成指法与五线谱/简谱/瀑布流。"
                : "Upload .mid / MusicXML or paste Jianpu notation to auto-generate Grand Staff, Jianpu, fingerings & Arcade tracks."}
            </p>
          </div>

          <div className="flex border border-[#222] bg-[#080808] text-xs">
            <button
              onClick={() => setTab("file")}
              className={`px-3 py-1.5 font-bold ${
                tab === "file" ? "bg-[#ff6a00] text-[#0a0a0a]" : "text-[#888] hover:text-[#e0e0e0]"
              }`}
            >
              [01] MIDI / MusicXML
            </button>
            <button
              onClick={() => setTab("jianpu")}
              className={`px-3 py-1.5 font-bold ${
                tab === "jianpu" ? "bg-[#00d4ff] text-[#0a0a0a]" : "text-[#888] hover:text-[#e0e0e0]"
              }`}
            >
              [02] {locale === "zh" ? "简谱文本扒谱" : "JIANPU STUDIO"}
            </button>
          </div>
        </div>

        {tab === "file" ? (
          <div className="mt-4">
            <label className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-[#2b2b2b] bg-[#080808] p-8 text-center transition-colors hover:border-[#ff6a00]">
              <Upload className="mb-2 h-8 w-8 text-[#ff6a00]" />
              <div className="text-sm font-bold text-[#e0e0e0]">
                {locale === "zh"
                  ? "点击选择或拖拽 .mid / .midi / .musicxml / .json 文件"
                  : "Click to select .mid / .midi / .musicxml / .json file"}
              </div>
              <p className="mt-1 text-xs text-[#666]">
                {locale === "zh"
                  ? "完全兼容雅马哈 PSR-1100 / KBP-1100 导出的 SMF 标准 MIDI 曲库"
                  : "Fully compatible with Yamaha PSR-1100 / KBP-1100 Standard MIDI files"}
              </p>
              <input
                type="file"
                accept=".mid,.midi,.musicxml,.xml,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
            </label>
          </div>
        ) : (
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
                <label className="flex items-center gap-1.5 text-[#00ff88] cursor-pointer">
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

            <button
              onClick={handleGenerateJianpu}
              className="pixel-border flex items-center gap-2 bg-[#00d4ff] px-5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#4de1ff]"
            >
              <Wand2 className="h-4 w-4" />
              {locale === "zh" ? "一键自动生成五线谱 & 游戏关卡" : "AUTO-GENERATE SCORE & ARCADE"}
            </button>
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
                {locale === "zh" ? "解析成功 · 已自动生成双谱与练习轨" : "PARSED · READY TO PRACTICE"}
              </div>
              <div className="mt-1 text-sm font-bold text-[#e0e0e0]">
                {previewSong.title} ({previewSong.notes.length} notes · Key {previewSong.keySignature})
              </div>
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
            {locale === "zh" ? `我的自定义导入曲库 (${customSongs.length})` : `MY IMPORTED SONGS (${customSongs.length})`}
          </span>
        </div>

        {customSongs.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#555]">
            {locale === "zh"
              ? "尚未保存自定义曲目。上传 .mid 或使用上方简谱生成器即可加入！"
              : "No custom songs saved yet. Upload a .mid or generate one above!"}
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
