"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

export type Locale = "zh" | "en";

const STORAGE_KEY = "yamaha1100:locale";
const LOCALE_EVENT = "yamaha1100:locale-change";

const DICT = {
  zh: {
    "nav.subtitle": "YAMAHA & CASIO 1100 · 游戏化电子琴教学终端",
    "nav.home": "[首页]",
    "nav.arcade": "[练琴街机]",
    "nav.scores": "[智能曲谱]",
    "nav.import": "[导入曲库]",
    "nav.drills": "[和弦道场]",
    "nav.rank": "[战绩榜]",
    "hero.badge": "YAMAHA KBP/PSR-1100 · CASIO PX-S1100 / WK-1100 / CTK-1100 // v2.0",
    "hero.line1": "INSERT MIDI · GENERATE SCORE",
    "hero.line2": "PLAY LIKE AN ARCADE.",
    "hero.sub1": "全面适配雅马哈 1100 与卡西欧 1100 全系琴型：USB/蓝牙 MIDI 或麦克风听音实时判音，一键生成五线谱、简谱与落键谱。",
    "hero.sub2": "零基础跟弹等待模式 + 街机节奏连击评分 + AI 视觉指法教练，无 MIDI 口的 CTK-1100 也能用麦克风/摄像头同步判音。",
    "hero.tagline": "Yamaha & Casio 1100 全系适配 · USB/BLE/MIC 判音 · 摄像头视觉指法 · 像素 CD 曲库",
    "cta.arcade": "$ START_ARCADE",
    "cta.import": "$ IMPORT_MIDI",
    "cta.scores": "$ VIEW_SCORES",
    "how.heading": "## 三步开启 1100 系列游戏化练琴",
    "how.01.title": "选择雅马哈 / 卡西欧 1100 琴型",
    "how.01.hint": "支持 KBP-1100 / PSR-1100 与卡西欧 PX-S1100(88键)、WK-1100(76键)、CTK-1100(61键无MIDI可用麦克风听音)。",
    "how.02.title": "导入曲库自动生成双谱",
    "how.02.hint": "内置 38 首含卡西欧 1100 全套内置曲库，或上传 .mid / .musicxml / 简谱生成五线谱、简谱与瀑布流。",
    "how.03.title": "游戏化跟弹与连击闯关",
    "how.03.hint": "支持「跟弹等待」「街机判定」「电脑键盘演奏」「摄像头空手触键」，实时判定 PERFECT / COMBO 升级。",
  },
  en: {
    "nav.subtitle": "YAMAHA & CASIO 1100 · GAMIFIED KEYBOARD ACADEMY",
    "nav.home": "[HOME]",
    "nav.arcade": "[ARCADE]",
    "nav.scores": "[SCORES]",
    "nav.import": "[IMPORT]",
    "nav.drills": "[DRILLS]",
    "nav.rank": "[RANK]",
    "hero.badge": "YAMAHA KBP/PSR-1100 · CASIO PX-S1100 / WK-1100 / CTK-1100 // v2.0",
    "hero.line1": "INSERT MIDI · GENERATE SCORE",
    "hero.line2": "PLAY LIKE AN ARCADE.",
    "hero.sub1": "Built for Yamaha 1100 & Casio 1100 keyboards: grade notes via USB/BLE MIDI or Mic Pitch (for CTK-1100 without MIDI ports).",
    "hero.sub2": "Wait-for-Note tutorial mode + Rhythm Arcade combos + Live Chord LCD + AI Cam Fingering Coach.",
    "hero.tagline": "Yamaha & Casio 1100 Profiles · USB/BLE & Mic Pitch · AI Cam Coach · Playable CD Shelf",
    "cta.arcade": "$ START_ARCADE",
    "cta.import": "$ IMPORT_MIDI",
    "cta.scores": "$ VIEW_SCORES",
    "how.heading": "## THREE-STEP WORKFLOW",
    "how.01.title": "Pick Yamaha or Casio 1100",
    "how.01.hint": "Supports KBP/PSR-1100 plus Casio PX-S1100 (88K BLE/USB), WK-1100 (76K USB), & CTK-1100 (61K Mic/Cam/QWERTY).",
    "how.02.title": "Import Song -> Auto Sheet Music",
    "how.02.hint": "Includes 38 built-in songs (Casio 1100 song bank ready), or import .mid / .musicxml / Jianpu into Grand Staff & Piano Roll.",
    "how.03.title": "Gamified Mastery & Combos",
    "how.03.hint": "Train with Wait Mode, Rhythm Arcade, PC Keyboard Workstation & Air Trigger. Hit PERFECT combos to level up.",
  },
} as const;

type DictKey = keyof typeof DICT.zh;

interface I18nCtxValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: DictKey) => string;
}

const I18nCtx = createContext<I18nCtxValue | null>(null);

function subscribeLocale(cb: () => void) {
  window.addEventListener(LOCALE_EVENT, cb);
  return () => window.removeEventListener(LOCALE_EVENT, cb);
}

function readClientLocale(): Locale {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "en" ? "en" : "zh";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, readClientLocale, () => "zh" as Locale);

  const setLocale = useCallback((l: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, l);
    window.dispatchEvent(new CustomEvent(LOCALE_EVENT));
  }, []);

  const t = useCallback((key: DictKey) => DICT[locale][key] ?? key, [locale]);

  return <I18nCtx.Provider value={{ locale, setLocale, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) {
    return {
      locale: "zh" as Locale,
      setLocale: () => {},
      t: (key: DictKey) => DICT.zh[key],
    };
  }
  return ctx;
}
