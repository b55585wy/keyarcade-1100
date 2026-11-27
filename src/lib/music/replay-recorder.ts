import type { PlaySessionRecord } from "@/types/music";

/**
 * Renders a crisp high-resolution PNG share poster card (1080x1350) on HTML5 Canvas.
 */
export function generateSessionPosterDataUrl(
  record: PlaySessionRecord,
  options?: {
    modelLabel?: string;
    locale?: "zh" | "en";
    feverReached?: boolean;
  },
): string {
  if (typeof document === "undefined") return "";
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const locale = options?.locale ?? "zh";

  // Obsidian radial background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#090a10");
  bg.addColorStop(0.55, "#110d14");
  bg.addColorStop(1, "#07090e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grid overlay
  ctx.strokeStyle = "rgba(255, 106, 0, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Top frame
  ctx.strokeStyle = "#ff6a00";
  ctx.lineWidth = 4;
  ctx.strokeRect(42, 42, W - 84, H - 84);

  // Brand tag
  ctx.fillStyle = "#ff6a00";
  ctx.font = "bold 28px monospace";
  ctx.fillText("KEYARCADE // YAMAHA 1100 EDITION", 82, 114);

  ctx.fillStyle = "#00d4ff";
  ctx.font = "bold 22px monospace";
  ctx.fillText(
    `${options?.modelLabel ?? "KBP-1100"} · ${record.mode.toUpperCase()} MODE`,
    82,
    154,
  );

  // Song title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px sans-serif";
  const safeTitle =
    record.songTitle.length > 26
      ? `${record.songTitle.slice(0, 25)}...`
      : record.songTitle;
  ctx.fillText(safeTitle, 82, 246);

  // Rank center badge
  const rankColor =
    record.rank === "S+" || record.rank === "S"
      ? "#ff6a00"
      : record.rank === "A"
        ? "#00ff88"
        : "#00d4ff";

  ctx.fillStyle = "rgba(18, 20, 30, 0.9)";
  ctx.fillRect(82, 300, W - 164, 340);
  ctx.strokeStyle = rankColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(82, 300, W - 164, 340);

  ctx.fillStyle = "#8a8a98";
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.fillText(locale === "zh" ? "综合评级 // FINAL RANK" : "FINAL RANK", W / 2, 362);

  ctx.fillStyle = rankColor;
  ctx.font = "bold 170px monospace";
  ctx.fillText(record.rank, W / 2, 535);

  if (options?.feverReached || record.maxCombo >= 15) {
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 24px monospace";
    ctx.fillText("★ NEON FEVER MODE UNLOCKED ★", W / 2, 602);
  }

  // Stats grid 2x2
  ctx.textAlign = "left";
  const cards = [
    { label: locale === "zh" ? "总得分 SCORE" : "SCORE", val: `${record.score}`, color: "#ff6a00" },
    { label: locale === "zh" ? "准度 ACCURACY" : "ACCURACY", val: `${record.accuracy}%`, color: "#00ff88" },
    { label: locale === "zh" ? "最高连击 COMBO" : "MAX COMBO", val: `${record.maxCombo}x`, color: "#00d4ff" },
    { label: locale === "zh" ? "获得经验 XP" : "XP EARNED", val: `+${record.xpEarned}`, color: "#a855f7" },
  ];

  cards.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = 82 + col * 472;
    const cy = 690 + row * 185;
    ctx.fillStyle = "#10121a";
    ctx.fillRect(cx, cy, 444, 155);
    ctx.strokeStyle = "#2b2f3f";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, 444, 155);

    ctx.fillStyle = "#888899";
    ctx.font = "bold 22px monospace";
    ctx.fillText(c.label, cx + 28, cy + 48);

    ctx.fillStyle = c.color;
    ctx.font = "bold 62px monospace";
    ctx.fillText(c.val, cx + 28, cy + 122);
  });

  // Judgement breakdown bar
  const totalJ = Math.max(
    1,
    record.perfectCount + record.greatCount + record.goodCount + record.missCount,
  );
  const bx = 82;
  const by = 1095;
  const bw = W - 164;
  ctx.fillStyle = "#a0a0b0";
  ctx.font = "bold 22px monospace";
  ctx.fillText(
    `PERFECT ${record.perfectCount}   GREAT ${record.greatCount}   GOOD ${record.goodCount}   MISS ${record.missCount}`,
    bx,
    by - 18,
  );

  const segs = [
    { count: record.perfectCount, color: "#00ff88" },
    { count: record.greatCount, color: "#00d4ff" },
    { count: record.goodCount, color: "#f59e0b" },
    { count: record.missCount, color: "#ef4444" },
  ];
  let cursorX = bx;
  for (const seg of segs) {
    const sw = (seg.count / totalJ) * bw;
    if (sw > 0) {
      ctx.fillStyle = seg.color;
      ctx.fillRect(cursorX, by, sw, 26);
      cursorX += sw;
    }
  }

  // Footer
  ctx.fillStyle = "#6e7285";
  ctx.font = "20px monospace";
  const dateText = new Date(record.playedAt).toLocaleString();
  ctx.fillText(`RECORDED AT ${dateText}`, 82, 1215);

  ctx.fillStyle = "#ff8b33";
  ctx.font = "bold 24px monospace";
  ctx.fillText(
    locale === "zh"
      ? "每一键都算数 · USB MIDI / 麦克风 / WebAudio 多模练琴"
      : "EVERY KEY COUNTS · MIDI / MIC / WEBAUDIO PIANO ARCADE",
    82,
    1265,
  );

  return canvas.toDataURL("image/png");
}

/**
 * Triggers a clean browser download for a Blob or Data URL.
 */
export function triggerDownload(urlOrBlob: string | Blob, filename: string) {
  if (typeof document === "undefined") return;
  const isBlob = urlOrBlob instanceof Blob;
  const href = isBlob ? URL.createObjectURL(urlOrBlob) : urlOrBlob;
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (isBlob) {
    window.setTimeout(() => URL.revokeObjectURL(href), 2500);
  }
}

/**
 * Captures the FallingNotesCanvas stream + WebAudio synthesizer into a downloadable .webm clip.
 */
export function startCanvasVideoCapture(
  canvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
): { stop: () => Promise<Blob | null> } | null {
  if (typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
    return null;
  }

  const videoStream = canvas.captureStream(30);
  const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
  if (audioStream) {
    for (const at of audioStream.getAudioTracks()) {
      tracks.push(at);
    }
  }
  const combined = new MediaStream(tracks);
  const mimeCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
  const chunks: Blob[] = [];

  const recorder = mimeType
    ? new MediaRecorder(combined, { mimeType })
    : new MediaRecorder(combined);

  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  recorder.start(200);

  return {
    stop: () =>
      new Promise((resolve) => {
        if (recorder.state === "inactive") {
          resolve(chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || "video/webm" }) : null);
          return;
        }
        recorder.onstop = () => {
          resolve(chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || "video/webm" }) : null);
        };
        recorder.stop();
      }),
  };
}
