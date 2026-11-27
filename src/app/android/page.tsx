"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  Smartphone,
  Usb,
  Bluetooth,
  Mic,
  Camera,
  Download,
  ShieldCheck,
  Terminal,
  Copy,
  Check,
  Maximize2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useWebMidi } from "@/hooks/use-web-midi";
import { usePwaInstallPrompt } from "@/components/pwa-register";
import { getStoredModel, subscribeStore } from "@/lib/storage/academy-store";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import type { YamahaModelId } from "@/types/music";

interface ClientEnvSnapshot {
  isSecure: boolean;
  hostname: string;
  hasMedia: boolean;
  hasSw: boolean;
  isStandalone: boolean;
  isAndroid: boolean;
  viewportText: string;
}

const SERVER_ENV: ClientEnvSnapshot = {
  isSecure: false,
  hostname: "",
  hasMedia: false,
  hasSw: false,
  isStandalone: false,
  isAndroid: false,
  viewportText: "—",
};

let cachedKey = "";
let cachedSnapshot: ClientEnvSnapshot = SERVER_ENV;

function subscribeClientEnv(cb: () => void) {
  window.addEventListener("resize", cb);
  window.addEventListener("orientationchange", cb);
  return () => {
    window.removeEventListener("resize", cb);
    window.removeEventListener("orientationchange", cb);
  };
}

function getClientEnvSnapshot(): ClientEnvSnapshot {
  const isSecure =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const hostname = window.location.origin;
  const hasMedia = Boolean(navigator.mediaDevices?.getUserMedia);
  const hasSw = "serviceWorker" in navigator;
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const isAndroid = /android/i.test(navigator.userAgent);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const orient = w >= h ? "LANDSCAPE" : "PORTRAIT";
  const viewportText = `${w}x${h} (${orient})`;

  const key = `${isSecure}|${hostname}|${hasMedia}|${hasSw}|${isStandalone}|${isAndroid}|${viewportText}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedSnapshot = { isSecure, hostname, hasMedia, hasSw, isStandalone, isAndroid, viewportText };
  }
  return cachedSnapshot;
}

export default function AndroidPage() {
  const { locale } = useI18n();
  const webMidi = useWebMidi({});
  const { canInstall, triggerInstall } = usePwaInstallPrompt();
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<string | null>(null);

  const model = useSyncExternalStore<YamahaModelId>(
    subscribeStore,
    getStoredModel,
    () => "kbp1100",
  );
  const env = useSyncExternalStore(subscribeClientEnv, getClientEnvSnapshot, () => SERVER_ENV);
  const profile = YAMAHA_PROFILES[model];

  const copyCommand = async (id: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 1600);
    } catch {
      // clipboard blocked
    }
  };

  const handleInstallClick = async () => {
    const ok = await triggerInstall();
    setInstallResult(
      ok
        ? locale === "zh"
          ? "已请求安装到安卓桌面！"
          : "Install prompt accepted!"
        : locale === "zh"
          ? "请在 Chrome 右上角菜单点击「添加到主屏幕 / 安装应用」"
          : "Use Chrome Menu -> Install App / Add to Home Screen",
    );
  };

  const adbCmd = "adb reverse tcp:3030 tcp:3030";
  const capCmd = "pnpm run cap:apk && adb install -r android/app/build/outputs/apk/debug/app-debug.apk";

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 font-mono sm:px-4 sm:py-8">
      {/* Header Box */}
      <div className="terminal-box p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1f1f1f] pb-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 bg-[#00ff88] px-2.5 py-0.5 text-[10px] font-bold text-[#0a0a0a]">
              <Smartphone className="h-3.5 w-3.5" />
              ANDROID COMPANION &amp; PWA CONSOLE
            </div>
            <h1 className="text-xl font-bold text-[#e0e0e0] sm:text-2xl">
              &gt;{" "}
              {locale === "zh"
                ? "安卓手机 / 平板练琴工作台指南"
                : "ANDROID PHONE & TABLET COMPANION"}
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-[#777]">
              {locale === "zh"
                ? "专为安卓 Chrome / 平板优化：多指滑奏触屏琴键、1x/2x/3x 瀑布流同步缩放、USB-OTG & 蓝牙 MIDI 直连、以及 CTK-1100 后置相机/麦克风判音。"
                : "Tuned for Android Chrome & Tablets: Multi-touch glissando keybed, synchronized 1x/2x/3x roll zoom, USB-OTG & BLE MIDI, and PWA standalone install."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleInstallClick()}
              className={`pixel-border flex items-center gap-1.5 px-4 py-2 text-xs font-bold ${
                canInstall
                  ? "bg-[#00ff88] text-[#0a0a0a] hover:bg-[#4dffad]"
                  : "bg-[#151515] text-[#00d4ff] hover:border-[#00d4ff]"
              }`}
            >
              <Download className="h-4 w-4" />
              {canInstall
                ? locale === "zh"
                  ? "立即安装安卓 App"
                  : "INSTALL ANDROID APP"
                : locale === "zh"
                  ? "PWA 安装引导"
                  : "PWA INSTALL GUIDE"}
            </button>
            <Link
              href="/arcade"
              className="pixel-border bg-[#ff6a00] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#ff8a33]"
            >
              &gt; {locale === "zh" ? "进街机试弹触屏" : "OPEN ARCADE"}
            </Link>
          </div>
        </div>

        {installResult && (
          <div className="mt-3 border border-[#00d4ff]/50 bg-[#071820] px-3 py-2 text-xs text-[#00d4ff]">
            [PWA] {installResult}
          </div>
        )}

        {/* Live Telemetry Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-xs">
          <div className="border border-[#222] bg-[#080808] p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-[#666]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#00ff88]" />
              SECURE_CONTEXT
            </div>
            <div className={`mt-1 font-bold ${env.isSecure ? "text-[#00ff88]" : "text-[#ff6a00]"}`}>
              {env.isSecure ? "HTTPS / LOCALHOST OK" : "HTTP LAN (LIMITED)"}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-[#555]">{env.hostname || "SSR"}</div>
          </div>

          <div className="border border-[#222] bg-[#080808] p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-[#666]">
              <Usb className="h-3.5 w-3.5 text-[#00d4ff]" />
              ANDROID_WEB_MIDI
            </div>
            <div className={`mt-1 font-bold ${webMidi.supported ? "text-[#00ff88]" : "text-[#ff6a00]"}`}>
              {webMidi.devices.length > 0
                ? `${webMidi.devices.length} DEVICE(S)`
                : webMidi.supported
                  ? "API READY"
                  : "UNSUPPORTED"}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-[#555]">
              {webMidi.devices[0]?.name || "OTG / BLE Standby"}
            </div>
          </div>

          <div className="border border-[#222] bg-[#080808] p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-[#666]">
              <Mic className="h-3.5 w-3.5 text-[#a855f7]" />
              CAM_&_MIC_API
            </div>
            <div className={`mt-1 font-bold ${env.hasMedia ? "text-[#00ff88]" : "text-[#ff6a00]"}`}>
              {env.hasMedia ? "READY" : "REQUIRES HTTPS"}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-[#555]">Rear Cam + Mic Pitch</div>
          </div>

          <div className="border border-[#222] bg-[#080808] p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-[#666]">
              <Maximize2 className="h-3.5 w-3.5 text-[#ff6a00]" />
              VIEWPORT_&_PWA
            </div>
            <div className="mt-1 font-bold text-[#e0e0e0]">{env.viewportText}</div>
            <div className="mt-0.5 truncate text-[10px] text-[#00d4ff]">
              {env.isStandalone ? "STANDALONE APP" : env.isAndroid ? "ANDROID BROWSER" : "DESKTOP / SIM"}
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Matrix for Android */}
      <div className="mt-5 terminal-box p-4 sm:p-6">
        <h2 className="text-sm font-bold tracking-wider text-[#ff6a00]">
          {locale === "zh"
            ? `## 雅马哈 & 卡西欧 1100 安卓连接方案 (当前琴型: ${profile.shortName})`
            : `## ANDROID CONNECTION MATRIX (${profile.shortName})`}
        </h2>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="border border-[#242424] bg-[#0a0a0a] p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#ff6a00]">
              <Usb className="h-4 w-4" />
              USB-OTG 有线直连 (KBP-1100 / PSR-1100 / WK-1100)
            </div>
            <p className="mt-2 leading-relaxed text-[#888]">
              {locale === "zh"
                ? "使用「Type-C 转 USB-B 方口 OTG 线」（或 Type-C 转接头 + 打印机方口线）直连电子琴与安卓手机/平板。用安卓 Chrome 打开本页面并开启 MIDI 权限，零延迟同步瀑布流与指法判定。"
                : "Connect keyboard USB Type-B to Android phone/tablet via a USB-C OTG adapter. Chrome Android Web MIDI detects notes with ultra-low latency."}
            </p>
          </div>

          <div className="border border-[#242424] bg-[#0a0a0a] p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#00d4ff]">
              <Bluetooth className="h-4 w-4" />
              蓝牙无线 MIDI (Casio PX-S1100 + WU-BT10)
            </div>
            <p className="mt-2 leading-relaxed text-[#888]">
              {locale === "zh"
                ? "在 PX-S1100 插入随附的 WU-BT10 蓝牙适配器，在安卓设置或 MIDI Connect 中配对，刷新 Chrome 页面即可无线识别 88 键键盘。"
                : "Plug the bundled WU-BT10 into Casio PX-S1100, pair via Android Bluetooth MIDI, and reload Chrome to play wirelessly."}
            </p>
          </div>

          <div className="border border-[#242424] bg-[#0a0a0a] p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#a855f7]">
              <Mic className="h-4 w-4" />
              无 MIDI 口听音方案 (Casio CTK-1100 专用)
            </div>
            <p className="mt-2 leading-relaxed text-[#888]">
              {locale === "zh"
                ? "把安卓手机/平板架在 CTK-1100 谱架上，进街机页开启顶部 [MIC 听音判音]，直接用手机麦克风拾音完成跟弹判定；也可开启 CAM 后置摄像头双保险校正指法。"
                : "Place your Android tablet on the CTK-1100 music rest and enable [MIC PITCH] in Arcade to grade acoustic notes directly via phone microphone."}
            </p>
          </div>

          <div className="border border-[#242424] bg-[#0a0a0a] p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#00ff88]">
              <Camera className="h-4 w-4" />
              手机触屏滑奏 + 缩放钢琴键盘 (无琴练习)
            </div>
            <p className="mt-2 leading-relaxed text-[#888]">
              {locale === "zh"
                ? "在练琴界面键盘右上角切换 [1x | 2x | 3x] 放大倍数，配合拖动滑条同步平移上方瀑布流与下方琴键；支持多指同时按和弦及手指滑动 glissando 连续发声。"
                : "Switch [1x | 2x | 3x] keybed zoom in Arcade to enlarge keys for Android touchscreens. Multi-touch chords & finger-slide glissando sync 1:1 with falling notes."}
            </p>
          </div>
        </div>
      </div>

      {/* ADB & APK Packaging Console */}
      <div className="mt-5 terminal-box p-4 sm:p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-[#00ff88]">
          <Terminal className="h-4 w-4" />
          {locale === "zh" ? "## USB 真机调试 (ADB) 与 APK 原生壳命令" : "## ADB LIVE DEBUG & CAPACITOR APK COMMANDS"}
        </div>

        <div className="mt-3 space-y-3 text-xs">
          <div className="border border-[#222] bg-[#080808] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#00d4ff] font-bold">
                {locale === "zh"
                  ? "1) USB 数据线真机直接跑 localhost:3030（解锁摄像头/麦克风/Web MIDI）"
                  : "1) Forward port 3030 over USB ADB (unlocks Secure Context on Android Chrome)"}
              </span>
              <button
                type="button"
                onClick={() => void copyCommand("adb", adbCmd)}
                className="flex items-center gap-1 border border-[#333] px-2 py-0.5 text-[10px] text-[#e0e0e0] hover:border-[#00ff88]"
              >
                {copiedCmd === "adb" ? <Check className="h-3 w-3 text-[#00ff88]" /> : <Copy className="h-3 w-3" />}
                {copiedCmd === "adb" ? "COPIED" : "COPY"}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto bg-[#040404] p-2 text-[#00ff88]">{adbCmd}</pre>
            <p className="mt-1.5 text-[11px] text-[#666]">
              {locale === "zh"
                ? "手机开启「USB 调试」连电脑后运行上面命令，然后在手机 Chrome 访问 http://localhost:3030 即可直接「安装应用」。"
                : "Connect phone with USB Debugging enabled, run the command above, and open http://localhost:3030 in Android Chrome."}
            </p>
          </div>

          <div className="border border-[#222] bg-[#080808] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#a855f7] font-bold">
                {locale === "zh"
                  ? "2) 本仓库已内置 Capacitor 原生 Android 工程（android/），一键编译调试 APK 并推装手机"
                  : "2) Built-in Capacitor Android project (android/) — build debug APK & install via ADB"}
              </span>
              <button
                type="button"
                onClick={() => void copyCommand("cap", capCmd)}
                className="flex items-center gap-1 border border-[#333] px-2 py-0.5 text-[10px] text-[#e0e0e0] hover:border-[#a855f7]"
              >
                {copiedCmd === "cap" ? <Check className="h-3 w-3 text-[#00ff88]" /> : <Copy className="h-3 w-3" />}
                {copiedCmd === "cap" ? "COPIED" : "COPY"}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto bg-[#040404] p-2 text-[#d8b4fe]">{capCmd}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
