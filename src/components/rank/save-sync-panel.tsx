"use client";

import { useState } from "react";
import { Upload, Download, Copy, Check, RefreshCw } from "lucide-react";
import {
  encodeCurrentLocalBackup,
  importFullBackupCode,
} from "@/lib/storage/save-sync";
import { playSfx } from "@/lib/sfx";

interface SaveSyncPanelProps {
  locale: "zh" | "en";
}

export function SaveSyncPanel({ locale }: SaveSyncPanelProps) {
  const [pasteCode, setPasteCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleCopyBackup = async () => {
    try {
      const code = encodeCurrentLocalBackup();
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setStatusMsg(
        locale === "zh"
          ? "已复制跨设备存档码 (K1100-SAVE:...)，在平板或手机粘贴即可同步 XP、音色与自建曲库！"
          : "Backup code copied! Paste on your tablet/phone to sync XP, voices & songs.",
      );
      playSfx("coin");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setStatusMsg(locale === "zh" ? "剪贴板访问受限，可点击下载 .json 文件备份" : "Clipboard blocked; use JSON export");
    }
  };

  const handleDownloadJson = () => {
    const code = encodeCurrentLocalBackup();
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keyarcade-backup-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    playSfx("success");
  };

  const handleRestore = (mode: "merge" | "replace") => {
    const res = importFullBackupCode(pasteCode, mode);
    if (!res) {
      setStatusMsg(
        locale === "zh"
          ? "无效的 K1100-SAVE 存档码或 JSON 格式，请检查后重试。"
          : "Invalid backup code format.",
      );
      playSfx("error");
      return;
    }
    setPasteCode("");
    setStatusMsg(
      locale === "zh"
        ? `恢复成功！当前 LV.${res.level} (${res.totalXp} XP) · 自建曲库 ${res.songsCount} 首`
        : `Restored! LV.${res.level} (${res.totalXp} XP) · ${res.songsCount} custom songs`,
    );
    playSfx("powerup");
  };

  return (
    <div className="mt-5 terminal-box p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1d1d1d] pb-2.5">
        <div>
          <h2 className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#00d4ff]">
            <RefreshCw className="h-4 w-4" />
            {locale === "zh"
              ? "07 // 跨设备零后端存档同步 (电脑 ↔ 平板 ↔ APK)"
              : "07 // CROSS-DEVICE SAVE SYNC (K1100-SAVE)"}
          </h2>
          <p className="mt-0.5 text-[11px] text-[#777]">
            {locale === "zh"
              ? "无需登录账号：一键复制全站存档码（包含 XP、RPG 关卡、解锁音色及所有 AI/自建曲谱）并在另一台设备粘贴合并。"
              : "Zero-login sync: export your stats, unlocked voices, and custom scores as one portable code."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={handleCopyBackup}
            className="flex items-center gap-1.5 border border-[#00ff88]/50 bg-[#081b12] px-3 py-1.5 font-bold text-[#00ff88] hover:bg-[#102d1e]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? (locale === "zh" ? "已复制存档码" : "COPIED") : locale === "zh" ? "复制全站存档码" : "COPY BACKUP CODE"}
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 border border-[#00d4ff]/50 bg-[#071820] px-3 py-1.5 font-bold text-[#00d4ff] hover:bg-[#0d2836]"
          >
            <Download className="h-3.5 w-3.5" />
            {locale === "zh" ? "导出存档文件" : "DOWNLOAD FILE"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <input
          type="text"
          value={pasteCode}
          onChange={(e) => setPasteCode(e.target.value)}
          placeholder={
            locale === "zh"
              ? "粘贴另一台设备导出的 K1100-SAVE:... 存档码"
              : "Paste K1100-SAVE:... code from another device"
          }
          className="min-w-[200px] flex-1 border border-[#2a2a2a] bg-[#07070b] px-3 py-1.5 text-white focus:border-[#00d4ff] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => handleRestore("merge")}
          className="flex items-center gap-1 bg-[#ff6a00] px-3 py-1.5 font-bold text-[#0a0a0a]"
        >
          <Upload className="h-3.5 w-3.5" />
          {locale === "zh" ? "智能合并恢复" : "MERGE RESTORE"}
        </button>
      </div>

      {statusMsg && (
        <div className="mt-2.5 text-[11px] font-bold text-[#00ff88]">{statusMsg}</div>
      )}
    </div>
  );
}
