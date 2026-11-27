"use client";

// 8-bit chiptune SFX generator in the exact signature of b55585wy/agent-coding.
export type SfxName =
  | "key"
  | "success"
  | "error"
  | "boot"
  | "navigate"
  | "coin"
  | "powerup"
  | "podium_first";

const STORAGE_KEY = "yamaha1100:sfx-muted";
const MUTE_EVENT = "yamaha1100:sfx-mute";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let initialized = false;
let lastKeyTime = 0;

export function initSfx() {
  if (initialized || typeof window === "undefined") return;
  muted = window.localStorage.getItem(STORAGE_KEY) === "1";
  initialized = true;
}

export function isSfxMuted(): boolean {
  if (!initialized) initSfx();
  return muted;
}

export function setSfxMuted(m: boolean) {
  muted = m;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, m ? "1" : "0");
  window.dispatchEvent(new CustomEvent<boolean>(MUTE_EVENT, { detail: m }));
  if (!m) ensureCtx();
}

export function subscribeSfxMute(cb: (m: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  window.addEventListener(MUTE_EVENT, handler);
  return () => window.removeEventListener(MUTE_EVENT, handler);
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.09;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  opts: { type?: OscillatorType; delay?: number; volume?: number } = {},
) {
  if (!ctx || !master) return;
  const { type = "square", delay = 0, volume = 1 } = opts;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function slide(from: number, to: number, duration: number, type: OscillatorType = "square", volume = 0.4) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + duration);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function playSfx(name: SfxName) {
  if (!initialized) initSfx();
  if (muted) return;
  if (!ensureCtx()) return;

  switch (name) {
    case "key": {
      const now = performance.now();
      if (now - lastKeyTime < 35) return;
      lastKeyTime = now;
      tone(860 + Math.random() * 220, 0.025, { volume: 0.25 });
      break;
    }
    case "boot":
      tone(620 + Math.random() * 80, 0.025, { volume: 0.2 });
      break;
    case "navigate":
      slide(420, 840, 0.1, "square", 0.25);
      break;
    case "success":
      tone(523.25, 0.06, { volume: 0.45 });
      tone(659.25, 0.06, { delay: 0.06, volume: 0.45 });
      tone(783.99, 0.12, { delay: 0.12, volume: 0.45 });
      break;
    case "coin":
      tone(987.77, 0.07, { volume: 0.35 });
      tone(1318.51, 0.26, { delay: 0.07, volume: 0.35 });
      break;
    case "error":
      slide(220, 95, 0.22, "sawtooth", 0.35);
      break;
    case "powerup":
      tone(392, 0.05, { volume: 0.4 });
      tone(523.25, 0.05, { delay: 0.05, volume: 0.4 });
      tone(659.25, 0.05, { delay: 0.1, volume: 0.4 });
      tone(783.99, 0.05, { delay: 0.15, volume: 0.4 });
      tone(1046.5, 0.16, { delay: 0.2, volume: 0.45 });
      break;
    case "podium_first":
      tone(587.33, 0.08, { volume: 0.45 });
      tone(739.99, 0.08, { delay: 0.09, volume: 0.45 });
      tone(880, 0.08, { delay: 0.18, volume: 0.45 });
      tone(1174.66, 0.16, { delay: 0.27, volume: 0.5 });
      tone(1760, 0.35, { delay: 0.45, volume: 0.5 });
      break;
  }
}
