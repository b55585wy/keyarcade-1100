"use client";

import Link from "next/link";
import {
  Camera,
  Download,
  Lightbulb,
  Repeat,
  Volume2,
  X,
} from "lucide-react";
import type {
  ArrangerStyleId,
  HandFilter,
  HitToleranceTier,
  LoopRangeBars,
  ReverbPreset,
  SynthVoiceId,
  YamahaModelId,
} from "@/types/music";
import { SYNTH_VOICES } from "@/lib/music/yamaha-profiles";
import { ARRANGER_STYLES } from "@/lib/music/arranger-styles";
import { TOLERANCE_TIERS } from "@/lib/music/arcade-grading";
import { CamTutorPanel } from "../vision/cam-tutor-panel";
import type { TargetKeyHint } from "../piano/yamaha-keyboard";

interface MobileArcadeOverlaysProps {
  locale: "zh" | "en";
  model: YamahaModelId;
  mobileToolsOpen: boolean;
  onCloseTools: () => void;
  mobileCamOpen: boolean;
  onCloseCam: () => void;
  onOpenCam: () => void;
  handFilter: HandFilter;
  onChangeHandFilter: (h: HandFilter) => void;
  tempoScale: number;
  onChangeTempoScale: (t: number) => void;
  voice: SynthVoiceId;
  onChangeVoice: (v: SynthVoiceId) => void;
  keybedZoom: 1 | 2 | 3;
  onChangeZoom: (z: 1 | 2 | 3) => void;
  metronomeOn: boolean;
  onToggleMetronome: () => void;
  countInEnabled: boolean;
  onToggleCountIn: () => void;
  loopEnabled: boolean;
  loopRangeBars: LoopRangeBars;
  onToggleLoop: () => void;
  autoSpeedUp: boolean;
  onToggleAutoSpeedUp: () => void;
  reverbPreset: ReverbPreset;
  onChangeReverb: (r: ReverbPreset) => void;
  toleranceTier: HitToleranceTier;
  onChangeTolerance: (t: HitToleranceTier) => void;
  arrangerStyle: ArrangerStyleId;
  onChangeArrangerStyle: (s: ArrangerStyleId) => void;
  onExportMidi: () => void;
  keyBarEnabled: boolean;
  onToggleKeyBar: () => void;
  targetHints: TargetKeyHint[];
  activeNotes: Set<number>;
  onAirNoteOn: (midi: number, velocity?: number) => void;
  onAirNoteOff: (midi: number) => void;
}

export function MobileArcadeOverlays(props: MobileArcadeOverlaysProps) {
  const {
    locale,
    model,
    mobileToolsOpen,
    onCloseTools,
    mobileCamOpen,
    onCloseCam,
    onOpenCam,
    handFilter,
    onChangeHandFilter,
    tempoScale,
    onChangeTempoScale,
    voice,
    onChangeVoice,
    keybedZoom,
    onChangeZoom,
    metronomeOn,
    onToggleMetronome,
    countInEnabled,
    onToggleCountIn,
    loopEnabled,
    loopRangeBars,
    onToggleLoop,
    autoSpeedUp,
    onToggleAutoSpeedUp,
    reverbPreset,
    onChangeReverb,
    toleranceTier,
    onChangeTolerance,
    arrangerStyle,
    onChangeArrangerStyle,
    onExportMidi,
    keyBarEnabled,
    onToggleKeyBar,
    targetHints,
    activeNotes,
    onAirNoteOn,
    onAirNoteOff,
  } = props;

  return (
    <>
      {mobileToolsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs"
          onClick={onCloseTools}
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
                onClick={onCloseTools}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[#ccc]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
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
                        onClick={() => onChangeHandFilter(h)}
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
                        onClick={() => onChangeTempoScale(sp)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a8a98]">
                    {locale === "zh" ? "雅马哈/卡西欧音色" : "Instrument Voice"}
                  </div>
                  <select
                    aria-label="Mobile Synth Voice"
                    value={voice}
                    onChange={(e) => onChangeVoice(e.target.value as SynthVoiceId)}
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
                        onClick={() => onChangeZoom(z)}
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

              {/* Acoustic Reverb & Hit Tolerance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a8a98]">
                    {locale === "zh" ? "音乐厅空间混响" : "Acoustic Reverb"}
                  </div>
                  <select
                    aria-label="Mobile Acoustic Reverb"
                    value={reverbPreset}
                    onChange={(e) => onChangeReverb(e.target.value as ReverbPreset)}
                    className="w-full rounded-xl border border-white/10 bg-[#181822] px-2.5 py-2 font-semibold text-[#00d4ff] focus:outline-none"
                  >
                    <option value="dry">{locale === "zh" ? "干声 Dry" : "Dry"}</option>
                    <option value="room">{locale === "zh" ? "录音室 Room" : "Studio Room"}</option>
                    <option value="hall">{locale === "zh" ? "音乐厅 Hall" : "Concert Hall"}</option>
                    <option value="lofi">{locale === "zh" ? "复古 Lo-Fi" : "Dusty Lo-Fi"}</option>
                  </select>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a8a98]">
                    {locale === "zh" ? "判定容差档位" : "Hit Tolerance"}
                  </div>
                  <select
                    aria-label="Mobile Hit Tolerance"
                    value={toleranceTier}
                    onChange={(e) => onChangeTolerance(e.target.value as HitToleranceTier)}
                    className="w-full rounded-xl border border-white/10 bg-[#181822] px-2.5 py-2 font-semibold text-[#00ff88] focus:outline-none"
                  >
                    {(Object.keys(TOLERANCE_TIERS) as HitToleranceTier[]).map((tk) => (
                      <option key={tk} value={tk}>
                        {locale === "zh" ? TOLERANCE_TIERS[tk].labelZh : TOLERANCE_TIERS[tk].labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Switches */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onToggleMetronome}
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
                  onClick={onToggleCountIn}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 font-semibold ${
                    countInEnabled
                      ? "border-[#ff6a00]/50 bg-[#ff6a00]/15 text-[#ff8b33]"
                      : "border-white/10 bg-white/5 text-[#8a8a98]"
                  }`}
                >
                  {locale === "zh" ? `预备倒数4拍 · ${countInEnabled ? "开" : "关"}` : "4-Beat CountIn"}
                </button>

                <button
                  type="button"
                  onClick={onToggleLoop}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 font-semibold ${
                    loopEnabled || loopRangeBars
                      ? "border-[#a855f7]/60 bg-[#a855f7]/15 text-[#c084fc]"
                      : "border-white/10 bg-white/5 text-[#8a8a98]"
                  }`}
                >
                  <Repeat className="h-4 w-4" />
                  {locale === "zh" ? `循环练 · ${loopEnabled ? "开" : "关"}` : "Loop"}
                </button>

                <button
                  type="button"
                  onClick={onToggleAutoSpeedUp}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 font-semibold ${
                    autoSpeedUp
                      ? "border-[#00ff88]/60 bg-[#00ff88]/10 text-[#00ff88]"
                      : "border-white/10 bg-white/5 text-[#8a8a98]"
                  }`}
                >
                  {locale === "zh" ? `阶梯提速 +0.1x · ${autoSpeedUp ? "开" : "关"}` : "Auto +0.1x"}
                </button>

                <select
                  aria-label="Sheet Arranger Style"
                  value={arrangerStyle}
                  onChange={(e) => onChangeArrangerStyle(e.target.value as ArrangerStyleId)}
                  className="rounded-xl border border-white/10 bg-[#181822] px-2.5 py-2.5 font-semibold text-[#00d4ff] focus:outline-none"
                >
                  {ARRANGER_STYLES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {locale === "zh" ? `伴奏: ${st.labelZh}` : `Style: ${st.labelEn}`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    onCloseTools();
                    onOpenCam();
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 font-semibold text-[#00d4ff]"
                >
                  <Camera className="h-4 w-4" />
                  {locale === "zh" ? "AI 摄像头指法教练" : "Cam AR Coach"}
                </button>

                <button
                  type="button"
                  onClick={onExportMidi}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 font-semibold text-[#e6e6ec]"
                >
                  <Download className="h-4 w-4" />
                  {locale === "zh" ? "导出 .MID 曲谱" : "Export .MID"}
                </button>

                <button
                  type="button"
                  onClick={onToggleKeyBar}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 font-semibold ${
                    keyBarEnabled
                      ? "border-[#ff6a00]/60 bg-[#211205] text-[#ff8b33]"
                      : "border-white/10 bg-white/5 text-[#e6e6ec]"
                  }`}
                >
                  <Lightbulb className="h-4 w-4" />
                  {locale === "zh" ? `外挂 LED 灯条 · ${keyBarEnabled ? "开" : "关"}` : "LED KeyBar"}
                </button>

                <Link
                  href="/hardware"
                  className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-[#00ff88]/30 bg-[#081a10] py-2.5 font-semibold text-[#00ff88]"
                >
                  <Lightbulb className="h-4 w-4" />
                  {locale === "zh" ? "配置灯条 / 打印琴垫" : "Hardware Setup"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {mobileCamOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-xs"
          onClick={onCloseCam}
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
                onClick={onCloseCam}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CamTutorPanel
              model={model}
              targetHints={targetHints}
              activeNotes={activeNotes}
              onAirNoteOn={onAirNoteOn}
              onAirNoteOff={onAirNoteOff}
              initialAirTrigger
              mobileImmersive
            />
          </div>
        </div>
      )}
    </>
  );
}
