"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Bluetooth,
  Usb,
  Lightbulb,
  Printer,
  Download,
  Sparkles,
  FileCode2,
  Package,
  Power,
  Play,
  Sliders,
} from "lucide-react";
import {
  buildKeyBarFrame,
  DEFAULT_KEYBAR_CONFIG,
  DEFAULT_KEYBAR_CONN_STATE,
  keyBarManager,
  readKeyBarConfig,
  subscribeKeyBarConfig,
  writeKeyBarConfig,
} from "@/lib/hardware/led-strip-bridge";
import { AR_MAT_SPECS, buildArMatSvg, type ArMatPresetId } from "@/lib/hardware/ar-mat-generator";
import { KeyBarPreviewStrip } from "@/components/hardware/keybar-preview-strip";
import { getStoredModel, subscribeStore } from "@/lib/storage/academy-store";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import { chordToMidiNotes } from "@/lib/music/theory";
import type { TargetKeyHint } from "@/components/piano/yamaha-keyboard";
import type { YamahaModelId } from "@/types/music";
import { useI18n } from "@/lib/i18n";
import { playSfx } from "@/lib/sfx";

export default function HardwarePage() {
  const { locale } = useI18n();
  const [tab, setTab] = useState<"keybar" | "armat" | "bom">("keybar");
  const [model, setModel] = useState<YamahaModelId>("kbp1100");
  const [matPreset, setMatPreset] = useState<ArMatPresetId>("psr1100");
  const [showJianpu, setShowJianpu] = useState(true);
  const [demoChord, setDemoChord] = useState<"C" | "G7" | "Am" | "F" | "clear">("C");

  const cfg = useSyncExternalStore(
    subscribeKeyBarConfig,
    readKeyBarConfig,
    () => DEFAULT_KEYBAR_CONFIG,
  );

  const connState = useSyncExternalStore(
    (cb) => keyBarManager.subscribe(cb),
    () => keyBarManager.getState(),
    () => DEFAULT_KEYBAR_CONN_STATE,
  );

  useEffect(() => {
    const sync = () => setModel(getStoredModel());
    sync();
    return subscribeStore(sync);
  }, []);

  const demoHints = useMemo<TargetKeyHint[]>(() => {
    if (demoChord === "clear") return [];
    const rhNotes = chordToMidiNotes(demoChord, 4);
    const lhNotes = chordToMidiNotes(demoChord, 3).slice(0, 2);
    return [
      ...rhNotes.map((m) => ({ midi: m, hand: "right" as const })),
      ...lhNotes.map((m) => ({ midi: m, hand: "left" as const })),
    ];
  }, [demoChord]);

  const demoFrame = useMemo(
    () => buildKeyBarFrame(model, cfg, demoHints, new Set()),
    [cfg, demoHints, model],
  );

  const arMatSvg = useMemo(() => buildArMatSvg(matPreset, showJianpu), [matPreset, showJianpu]);
  const matSpec = AR_MAT_SPECS[matPreset];
  const profile = YAMAHA_PROFILES[model];

  const handleDownloadSvg = () => {
    const blob = new Blob([arMatSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keyarcade-ar-mat-${matPreset}-${matSpec.physicalWidthMm}x${matSpec.physicalHeightMm}mm.svg`;
    a.click();
    URL.revokeObjectURL(url);
    playSfx("success");
  };

  return (
    <div className="mx-auto max-w-7xl px-3.5 py-5 font-sans sm:px-4">
      {/* Header Banner */}
      <div className="terminal-box p-4 sm:p-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6a00]/15 px-3 py-0.5 font-mono text-[10px] font-bold text-[#ff8b33]">
              <Sparkles className="h-3 w-3" />
              RETROFIT HARDWARE COMPANION // ESP32-S3 + AR DESK MAT
            </div>
            <h1 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              {locale === "zh"
                ? "旧琴智能化改造硬件中心（外挂灯条 & 可打印 AR 桌垫）"
                : "Retrofit Hardware Lab (LED KeyBar & Printable AR Mat)"}
            </h1>
            <p className="mt-1 text-xs text-[#8a8a98] sm:text-sm">
              {locale === "zh"
                ? "无需重金开模造整台钢琴：用 ¥50 级通用外挂 LED 灯条改造任意老式电钢琴，或用桌垫+手机支架让新手无琴即弹。"
                : "Turn any legacy digital piano into a light-guided arcade with an ESP32 WS2812B bar or a 1:1 printable AR desk mat."}
            </p>
          </div>

          <Link
            href="/arcade"
            className="flex items-center gap-1.5 rounded-xl bg-[#ff6a00] px-4 py-2 text-xs font-bold text-[#0a0a0a] shadow hover:bg-[#ff8533]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {locale === "zh" ? "进街机测试实时亮灯" : "Test Live in Arcade"}
          </Link>
        </div>

        {/* Section Tabs */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
          {(
            [
              ["keybar", Lightbulb, locale === "zh" ? "1. 外挂 LED 灯条控制台 & 固件" : "1. LED KeyBar Bridge"],
              ["armat", Printer, locale === "zh" ? "2. 可打印 1:1 AR 桌面琴垫导出" : "2. Printable AR Desk Mat"],
              ["bom", Package, locale === "zh" ? "3. 硬件 BOM 成本与商用变现清单" : "3. BOM & Launch Plan"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                playSfx("key");
              }}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                tab === id
                  ? "border-[#ff6a00] bg-[#ff6a00] text-[#0a0a0a]"
                  : "border-white/10 bg-[#14141d] text-[#9a9aa8] hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Universal LED KeyBar Hardware Console */}
      {tab === "keybar" && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12 print:hidden">
          {/* Left: Connection, Calibration & Hardware Digital Twin */}
          <div className="space-y-4 lg:col-span-7">
            <div className="terminal-box p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {locale === "zh" ? "通用外挂 LED 跟弹灯条连接" : "KeyBar Hardware Connection"}
                  </h2>
                  <p className="text-xs text-[#8a8a98]">
                    {locale === "zh"
                      ? `当前匹配琴型：${profile.name} (${profile.keys}键)`
                      : `Matched Profile: ${profile.name}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => writeKeyBarConfig({ enabled: !cfg.enabled })}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                    cfg.enabled
                      ? "bg-[#00ff88] text-[#0a0a0a]"
                      : "border border-white/15 bg-white/5 text-[#ccc]"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {cfg.enabled
                    ? locale === "zh"
                      ? "练琴实时同步: 开"
                      : "Arcade Sync: ON"
                    : locale === "zh"
                      ? "开启练琴灯条同步"
                      : "Enable Arcade Sync"}
                </button>
              </div>

              {/* USB Serial / BLE / Disconnect buttons */}
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => void keyBarManager.connectSerial(cfg)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#00ff88]/40 bg-[#091c12] px-3 py-2.5 text-xs font-bold text-[#00ff88] hover:bg-[#102d1d]"
                >
                  <Usb className="h-4 w-4" />
                  {locale === "zh" ? "USB 串口连灯条" : "USB WebSerial"}
                </button>
                <button
                  type="button"
                  onClick={() => void keyBarManager.connectBle(cfg)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#00d4ff]/40 bg-[#071822] px-3 py-2.5 text-xs font-bold text-[#00d4ff] hover:bg-[#0d2838]"
                >
                  <Bluetooth className="h-4 w-4" />
                  {locale === "zh" ? "BLE 蓝牙无线配对" : "BLE Bluetooth"}
                </button>
                <button
                  type="button"
                  onClick={() => void keyBarManager.disconnect()}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-[#aaa] hover:text-white"
                >
                  {locale === "zh" ? "断开 / 仅看虚拟预览" : "Disconnect / Preview"}
                </button>
              </div>

              {connState.lastError && (
                <div className="mt-3 rounded-xl border border-[#ff6a00]/40 bg-[#1f1208] px-3 py-2 text-xs text-[#ffb178]">
                  {connState.lastError}
                </div>
              )}

              {/* Live Digital Twin LED Strip */}
              <div className="mt-4">
                <KeyBarPreviewStrip
                  ledCount={cfg.ledCount}
                  pixels={demoFrame.pixels}
                  label={`${connState.deviceLabel} · ${cfg.ledCount} LEDs`}
                />
              </div>

              {/* Interactive Chord Light Testing Bar */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[#8a8a98]">{locale === "zh" ? "点亮测试：" : "Test:"}</span>
                  {(["C", "G7", "Am", "F", "clear"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setDemoChord(c);
                        const nextFrame = buildKeyBarFrame(
                          model,
                          cfg,
                          c === "clear"
                            ? []
                            : chordToMidiNotes(c, 4).map((m) => ({ midi: m, hand: "right" as const })),
                          new Set(),
                        );
                        void keyBarManager.sendCommand(nextFrame.command);
                        playSfx("key");
                      }}
                      className={`rounded-lg border px-2.5 py-1 font-mono font-bold ${
                        demoChord === c
                          ? "border-[#ff6a00] bg-[#ff6a00] text-[#0a0a0a]"
                          : "border-white/10 bg-[#14141d] text-[#ccc]"
                      }`}
                    >
                      {c === "clear" ? (locale === "zh" ? "全灭" : "CLR") : `${c} 和弦`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void keyBarManager.sendCommand("DEMO")}
                    className="rounded-lg border border-[#00d4ff]/40 bg-[#071820] px-2.5 py-1 font-semibold text-[#00d4ff]"
                  >
                    {locale === "zh" ? "跑马灯自检" : "LED SWEEP"}
                  </button>
                </div>
              </div>

              {/* Protocol Output Readout */}
              <div className="mt-3 rounded-xl border border-white/10 bg-[#07070b] px-3 py-2 font-mono text-[11px]">
                <div className="text-[#666]">LIVE SERIAL / BLE PACKET:</div>
                <div className="mt-0.5 truncate text-[#00ff88]">
                  {connState.lastPacket || demoFrame.command}
                </div>
              </div>
            </div>

            {/* Calibration Controls */}
            <div className="terminal-box p-4 sm:p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <Sliders className="h-4 w-4 text-[#ff8b33]" />
                {locale === "zh" ? "灯珠数量与物理琴键对齐校准" : "Strip Length & Key Alignment"}
              </h3>

              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {[
                  { label: "61键 · 0.85m (122灯)", count: 122 },
                  { label: "76键 · 1.05m (152灯)", count: 152 },
                  { label: "88键 · 1.22m (176灯)", count: 176 },
                ].map((preset) => (
                  <button
                    key={preset.count}
                    type="button"
                    onClick={() => {
                      const next = writeKeyBarConfig({ ledCount: preset.count });
                      void keyBarManager.sendCommand(`CFG:${next.ledCount}:${next.brightness}`);
                    }}
                    className={`rounded-lg border px-2.5 py-1.5 font-semibold ${
                      cfg.ledCount === preset.count
                        ? "border-[#00d4ff] bg-[#071820] text-[#00d4ff]"
                        : "border-white/10 bg-[#14141d] text-[#9a9aa8]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
                <label className="space-y-1">
                  <div className="flex justify-between text-[#9a9aa8]">
                    <span>灯珠数量</span>
                    <span className="font-mono font-bold text-white">{cfg.ledCount}</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={220}
                    value={cfg.ledCount}
                    onChange={(e) => writeKeyBarConfig({ ledCount: Number(e.target.value) })}
                    className="w-full accent-[#ff6a00]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between text-[#9a9aa8]">
                    <span>LED 亮度</span>
                    <span className="font-mono font-bold text-[#00ff88]">{cfg.brightness}</span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={180}
                    value={cfg.brightness}
                    onChange={(e) => {
                      const next = writeKeyBarConfig({ brightness: Number(e.target.value) });
                      void keyBarManager.sendCommand(`CFG:${next.ledCount}:${next.brightness}`);
                    }}
                    className="w-full accent-[#00ff88]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between text-[#9a9aa8]">
                    <span>左右偏移微调</span>
                    <span className="font-mono font-bold text-[#00d4ff]">{cfg.offsetLeds}</span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    value={cfg.offsetLeds}
                    onChange={(e) => writeKeyBarConfig({ offsetLeds: Number(e.target.value) })}
                    className="w-full accent-[#00d4ff]"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => writeKeyBarConfig({ reverseOrder: !cfg.reverseOrder })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    cfg.reverseOrder
                      ? "border-[#a855f7] bg-[#1a0d29] text-[#c084fc]"
                      : "border-white/10 bg-[#14141d] text-[#9a9aa8]"
                  }`}
                >
                  {cfg.reverseOrder ? "接线方向：从高音向低音走线（反向）" : "接线方向：从左低音向右走线（正向）"}
                </button>
              </div>
            </div>
          </div>

          {/* Right: ESP32 Wiring + Firmware Guide */}
          <div className="terminal-box flex flex-col justify-between p-4 sm:p-5 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#00ff88]">
                  <FileCode2 className="h-4 w-4" />
                  ESP32-S3 / C3 硬件固件与接线
                </h2>
                <span className="rounded bg-[#081a10] px-2 py-0.5 font-mono text-[10px] text-[#00ff88]">
                  115200 / BLE
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-[#08080e] p-3 font-mono text-[11px] leading-relaxed text-[#c6c6d4]">
                <div className="text-[#ff8b33]">{"// 开源灯条硬件引脚接线："}</div>
                <div>ESP32 GPIO4 ──[330Ω]──▶ WS2812B DIN</div>
                <div>USB-C 5V 3A ──────────▶ WS2812B VCC (+1000µF电容)</div>
                <div>Common GND  ──────────▶ ESP32 GND + 灯条 GND</div>
                <div className="mt-2 text-[#00d4ff]">{"// 广播与波特率："}</div>
                <div>BLE 蓝牙广播名: KEYARCADE-BAR</div>
                <div>BLE UART UUID : 6E400001-B5A3-F393-E0A9-E50E24DCCA9E</div>
                <div>USB 串口速率  : 115200 bps</div>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-[#08080e] p-3 font-mono text-[11px] text-[#9a9aa8]">
                <div className="font-bold text-white">串口 / 蓝牙文本指令格式：</div>
                <div className="mt-1 space-y-1">
                  <div><span className="text-[#00ff88]">KEY:idx:r,g,b;...</span> — 刷新对应琴键灯珠</div>
                  <div><span className="text-[#00ff88]">CFG:176:64</span> — 设置灯珠数与亮度</div>
                  <div><span className="text-[#00ff88]">CLR</span> / <span className="text-[#00ff88]">DEMO</span> — 全灭 / 自检扫灯</div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs">
              <div className="text-[#8a8a98]">
                开源固件文件位于{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[#ff8b33]">
                  public/firmware/keyarcade_keybar.ino
                </code>
              </div>
              <a
                href="/firmware/keyarcade_keybar.ino"
                download="keyarcade_keybar.ino"
                onClick={() => playSfx("success")}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2 font-semibold text-white hover:border-[#00ff88]"
              >
                <Download className="h-3.5 w-3.5 text-[#00ff88]" />
                {locale === "zh" ? "下载 ESP32-S3 开源固件 (.ino)" : "Download ESP32 Firmware (.ino)"}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Printable 1:1 AR Desk Mat Studio */}
      {tab === "armat" && (
        <div className="mt-5 space-y-4">
          <div className="terminal-box p-4 sm:p-5 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  {locale === "zh"
                    ? "1:1 物理尺寸 AR 桌面钢琴垫生成器（带双绿十字校准靶点）"
                    : "1:1 Printable AR Desk Mat Generator"}
                </h2>
                <p className="mt-0.5 text-xs text-[#8a8a98]">
                  {locale === "zh"
                    ? "导出 SVG 直接发给淘宝鼠标垫厂热转印打印（零开模费），或选 37 键试用版用家里 A4 纸打印拼贴配合手机 AR 摄像头弹奏。"
                    : "Export exact millimeter SVG for desk-mat printing or print cleanly on A4 paper."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00ff88] px-3.5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#33ff9e]"
                >
                  <Download className="h-3.5 w-3.5" />
                  {locale === "zh" ? "导出工厂印刷 SVG" : "Download Factory SVG"}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl border border-[#00d4ff]/50 bg-[#071820] px-3.5 py-2 text-xs font-bold text-[#00d4ff]"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {locale === "zh" ? "打印 / 存为 PDF" : "Print / PDF"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(AR_MAT_SPECS) as ArMatPresetId[]).map((pid) => (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => setMatPreset(pid)}
                    className={`rounded-lg border px-2.5 py-1.5 font-semibold ${
                      matPreset === pid
                        ? "border-[#ff6a00] bg-[#ff6a00] text-[#0a0a0a]"
                        : "border-white/10 bg-[#14141d] text-[#9a9aa8] hover:text-white"
                    }`}
                  >
                    {pid.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowJianpu((v) => !v)}
                className={`rounded-lg border px-3 py-1.5 font-semibold ${
                  showJianpu
                    ? "border-[#00ff88]/50 bg-[#081a10] text-[#00ff88]"
                    : "border-white/10 bg-[#14141d] text-[#8a8a98]"
                }`}
              >
                {showJianpu ? "琴垫印制简谱数字 1–7：开" : "仅黑白键与音名"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-2 text-xs text-[#9a9aa8]">
              <span>{matSpec.titleZh}</span>
              <span className="font-mono font-bold text-[#00d4ff]">{matSpec.printSizeLabel}</span>
            </div>
          </div>

          {/* Visual Preview + Clean Print Output Container */}
          <div className="terminal-box overflow-hidden p-3 sm:p-5 print:border-0 print:bg-white print:p-0 print:shadow-none">
            <Image
              alt={matSpec.titleEn}
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(arMatSvg)}`}
              width={matSpec.physicalWidthMm}
              height={matSpec.physicalHeightMm}
              unoptimized
              className="h-auto w-full rounded-xl border border-white/10"
            />
          </div>
        </div>
      )}

      {/* TAB 3: Hardware BOM & Go-To-Market Blueprint */}
      {tab === "bom" && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2 print:hidden">
          <div className="terminal-box p-5">
            <div className="font-mono text-[10px] font-bold text-[#ff8b33]">SKU #1 · HARDWARE + SUBSCRIPTION</div>
            <h2 className="mt-1 text-lg font-extrabold text-white">
              通用外挂式 LED 跟弹灯条（适配存量老电钢）
            </h2>
            <p className="mt-1 text-xs text-[#8a8a98]">
              直接卖给手里已有旧雅马哈/卡西欧但没有亮灯和游戏化教学的存量琴友，无需做任何机械按键模具。
            </p>

            <div className="mt-4 space-y-2 text-xs">
              {[
                ["ESP32-S3 / C3 Type-C 控制主板", "¥10 – ¥16"],
                ["WS2812B 144灯/米 5V 黑底灯带 (1.25m)", "¥18 – ¥24"],
                ["分段磁吸亚克力柔光灯槽 + 硅胶贴", "¥8 – ¥12"],
                ["330Ω 电阻 + 1000µF 电容 + 小黑盒外壳/彩盒", "¥10 – ¥14"],
              ].map(([name, cost]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-2"
                >
                  <span className="text-[#d4d4df]">{name}</span>
                  <span className="font-mono font-bold text-[#00ff88]">{cost}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#ff6a00]/30 bg-[#1a110a] p-3 text-center">
              <div>
                <div className="text-[11px] text-[#9a9aa8]">小批量 BOM 成本</div>
                <div className="font-mono text-lg font-extrabold text-white">¥46 – ¥66</div>
              </div>
              <div>
                <div className="text-[11px] text-[#9a9aa8]">建议零售价（含 App 会员）</div>
                <div className="font-mono text-lg font-extrabold text-[#ff8b33]">¥199 – ¥299</div>
              </div>
            </div>
          </div>

          <div className="terminal-box p-5">
            <div className="font-mono text-[10px] font-bold text-[#00d4ff]">SKU #2 · ZERO-ELECTRONICS KIT</div>
            <h2 className="mt-1 text-lg font-extrabold text-white">
              AR 桌面钢琴琴垫 + 手机俯拍支架套装
            </h2>
            <p className="mt-1 text-xs text-[#8a8a98]">
              配合你已落地的手机端「AR 桌面虚拟琴」和「AIR TRIGGER 视觉触键」，无电子元件、极低退货率。
            </p>

            <div className="mt-4 space-y-2 text-xs">
              {[
                ["3mm 橡胶鼠标垫热转印琴垫 (900×240 / 1220×220mm)", "¥16 – ¥26"],
                ["C 型夹桌面手机俯拍悬臂支架 (1688 现货)", "¥12 – ¥18"],
                ["像素说明卡 + 激活码卡片包装盒", "¥4 – ¥6"],
                ["配套固件 / 开模费", "¥0（鼠标垫厂直接打样）"],
              ].map(([name, cost]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b0b10] px-3 py-2"
                >
                  <span className="text-[#d4d4df]">{name}</span>
                  <span className="font-mono font-bold text-[#00d4ff]">{cost}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#00d4ff]/30 bg-[#071820] p-3 text-center">
              <div>
                <div className="text-[11px] text-[#9a9aa8]">小批量打包成本</div>
                <div className="font-mono text-lg font-extrabold text-white">¥32 – ¥48</div>
              </div>
              <div>
                <div className="text-[11px] text-[#9a9aa8]">建议零售价（含季卡激活码）</div>
                <div className="font-mono text-lg font-extrabold text-[#00d4ff]">¥129 – ¥169</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
