import { computeKeyboardLayout } from "@/lib/music/keyboard-layout";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import { midiToName } from "@/lib/music/theory";
import type { YamahaModelId } from "@/types/music";

export type ArMatPresetId = YamahaModelId | "desk37";

export interface ArMatSpec {
  id: ArMatPresetId;
  titleZh: string;
  titleEn: string;
  minMidi: number;
  maxMidi: number;
  physicalWidthMm: number;
  physicalHeightMm: number;
  printSizeLabel: string;
}

export const AR_MAT_SPECS: Record<ArMatPresetId, ArMatSpec> = {
  kbp1100: {
    id: "kbp1100",
    titleZh: "88 键全尺寸钢琴桌面垫 (Yamaha KBP-1100 / 通用)",
    titleEn: "Full 88-Key Studio Desk Mat",
    minMidi: YAMAHA_PROFILES.kbp1100.minMidi,
    maxMidi: YAMAHA_PROFILES.kbp1100.maxMidi,
    physicalWidthMm: 1220,
    physicalHeightMm: 220,
    printSizeLabel: "1220 × 220 mm（专业桌垫 1:1 比例）",
  },
  pxs1100: {
    id: "pxs1100",
    titleZh: "88 键纤薄桌垫 (Casio PX-S1100 比例)",
    titleEn: "Compact 88-Key Desk Mat",
    minMidi: YAMAHA_PROFILES.pxs1100.minMidi,
    maxMidi: YAMAHA_PROFILES.pxs1100.maxMidi,
    physicalWidthMm: 1200,
    physicalHeightMm: 220,
    printSizeLabel: "1200 × 220 mm",
  },
  wk1100: {
    id: "wk1100",
    titleZh: "76 键流行键盘桌面垫 (Casio WK-1100)",
    titleEn: "76-Key Desk Mat",
    minMidi: YAMAHA_PROFILES.wk1100.minMidi,
    maxMidi: YAMAHA_PROFILES.wk1100.maxMidi,
    physicalWidthMm: 1060,
    physicalHeightMm: 220,
    printSizeLabel: "1060 × 220 mm",
  },
  psr1100: {
    id: "psr1100",
    titleZh: "61 键桌面标准垫 (Yamaha PSR-1100)",
    titleEn: "61-Key Desk Mat (Yamaha PSR-1100)",
    minMidi: YAMAHA_PROFILES.psr1100.minMidi,
    maxMidi: YAMAHA_PROFILES.psr1100.maxMidi,
    physicalWidthMm: 900,
    physicalHeightMm: 240,
    printSizeLabel: "900 × 240 mm（鼠标垫厂最常见标准大号规格）",
  },
  ctk1100: {
    id: "ctk1100",
    titleZh: "61 键入门桌面垫 (Casio CTK-1100)",
    titleEn: "61-Key Starter Mat (Casio CTK-1100)",
    minMidi: YAMAHA_PROFILES.ctk1100.minMidi,
    maxMidi: YAMAHA_PROFILES.ctk1100.maxMidi,
    physicalWidthMm: 900,
    physicalHeightMm: 240,
    printSizeLabel: "900 × 240 mm（鼠标垫厂最常见标准大号规格）",
  },
  desk37: {
    id: "desk37",
    titleZh: "37 键便携试用垫 (C3–C6 · 双 A4 拼接 / 迷你桌垫)",
    titleEn: "37-Key Portable Desk Mat (C3–C6)",
    minMidi: 48,
    maxMidi: 84,
    physicalWidthMm: 520,
    physicalHeightMm: 210,
    printSizeLabel: "520 × 210 mm（刚好用两张横向 A4 纸拼贴打印）",
  },
};

const JIANPU_NUM_BY_PC: Record<number, string> = {
  0: "1",
  2: "2",
  4: "3",
  5: "4",
  7: "5",
  9: "6",
  11: "7",
};

/**
 * Generates an exact print-ready, factory-compatible SVG of the AR Desk Piano Mat,
 * complete with corner fiducial alignment markers (+ CAL LEFT / + CAL RIGHT) for CamTutorPanel.
 */
export function buildArMatSvg(presetId: ArMatPresetId, showJianpu = true): string {
  const spec = AR_MAT_SPECS[presetId];
  const layout = computeKeyboardLayout(spec.minMidi, spec.maxMidi);

  const W = spec.physicalWidthMm;
  const H = spec.physicalHeightMm;
  const padX = 24;
  const padTop = 36;
  const padBottom = 18;
  const keyW = W - padX * 2;
  const keyH = H - padTop - padBottom;
  const blackH = keyH * 0.58;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`,
  );
  // Matte obsidian factory background
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#0a0a0c"/>`);
  parts.push(
    `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="6" fill="none" stroke="#ff6a00" stroke-width="0.9" stroke-opacity="0.55"/>`,
  );

  // Header brand + AR calibration instructions
  parts.push(
    `<text x="${W / 2}" y="14" text-anchor="middle" fill="#ff6a00" font-family="monospace" font-size="7.5" font-weight="bold">KEYARCADE_1100 // AR DESK PIANO MAT (${spec.id.toUpperCase()} · ${midiToName(spec.minMidi)}–${midiToName(spec.maxMidi)})</text>`,
  );
  parts.push(
    `<text x="${W / 2}" y="23" text-anchor="middle" fill="#8a8a98" font-family="sans-serif" font-size="4.8">打开 App 摄像头 -&gt; 开启 AIR TRIGGER 视觉触键 -&gt; 依次点击左右绿十字完成 2 点校准</text>`,
  );

  // Corner AR Fiducial Targets (exact top edge alignment of keybed)
  const drawCalTarget = (cx: number, cy: number, label: string, align: "start" | "end") => {
    parts.push(`<circle cx="${cx}" cy="${cy}" r="6.5" fill="#071f13" stroke="#00ff88" stroke-width="1.2"/>`);
    parts.push(`<line x1="${cx - 4.5}" y1="${cy}" x2="${cx + 4.5}" y2="${cy}" stroke="#00ff88" stroke-width="1"/>`);
    parts.push(`<line x1="${cx}" y1="${cy - 4.5}" x2="${cx}" y2="${cy + 4.5}" stroke="#00ff88" stroke-width="1"/>`);
    const tx = align === "start" ? cx + 9 : cx - 9;
    parts.push(
      `<text x="${tx}" y="${cy + 1.8}" text-anchor="${align}" fill="#00ff88" font-family="monospace" font-size="5.2" font-weight="bold">${label}</text>`,
    );
  };

  drawCalTarget(padX, padTop - 10, "CAL-1 (LEFT)", "start");
  drawCalTarget(W - padX, padTop - 10, "CAL-2 (RIGHT)", "end");

  // Subtle top LED reference rail
  parts.push(`<rect x="${padX}" y="${padTop - 3}" width="${keyW}" height="2.2" fill="#182b22"/>`);

  // White keys
  for (const k of layout.whiteKeys) {
    const x = padX + k.x * keyW;
    const w = k.w * keyW;
    const isMiddleC = k.midi === 60;
    const isC = k.midi % 12 === 0;
    const pc = k.midi % 12;
    const jianpu = JIANPU_NUM_BY_PC[pc] ?? "";

    parts.push(
      `<rect x="${x.toFixed(2)}" y="${padTop}" width="${Math.max(1, w - 0.5).toFixed(2)}" height="${keyH}" rx="1.6" fill="${
        isMiddleC ? "#fff2e6" : "#f2f2f5"
      }" stroke="#22222c" stroke-width="0.6"/>`,
    );

    if (showJianpu && jianpu) {
      parts.push(
        `<text x="${(x + w / 2).toFixed(2)}" y="${(padTop + keyH - 13).toFixed(2)}" text-anchor="middle" fill="${
          isMiddleC ? "#d95500" : "#222"
        }" font-family="sans-serif" font-size="6.4" font-weight="bold">${jianpu}</text>`,
      );
    }

    if (isC) {
      parts.push(
        `<text x="${(x + w / 2).toFixed(2)}" y="${(padTop + keyH - 4.5).toFixed(2)}" text-anchor="middle" fill="${
          isMiddleC ? "#ff6a00" : "#0099cc"
        }" font-family="monospace" font-size="5" font-weight="bold">${midiToName(k.midi)}</text>`,
      );
    }
  }

  // Black keys
  for (const k of layout.blackKeys) {
    const x = padX + k.x * keyW;
    const w = k.w * keyW;
    parts.push(
      `<rect x="${x.toFixed(2)}" y="${padTop}" width="${w.toFixed(2)}" height="${blackH.toFixed(2)}" rx="1.2" fill="#141418" stroke="#000" stroke-width="0.6"/>`,
    );
    parts.push(
      `<rect x="${(x + w * 0.22).toFixed(2)}" y="${padTop + 2}" width="${(w * 0.56).toFixed(2)}" height="${(blackH - 8).toFixed(2)}" rx="0.8" fill="#1f1f26"/>`,
    );
  }

  // Footer print ruler / scale check (10cm scale verify)
  parts.push(
    `<line x1="${padX}" y1="${H - 7}" x2="${padX + 100}" y2="${H - 7}" stroke="#00d4ff" stroke-width="0.8"/>`,
  );
  parts.push(
    `<text x="${padX + 104}" y="${H - 5.5}" fill="#00d4ff" font-family="monospace" font-size="4.4">100 mm SCALE VERIFY (${spec.printSizeLabel})</text>`,
  );

  parts.push(`</svg>`);
  return parts.join("\n");
}
