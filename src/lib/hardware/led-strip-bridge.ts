"use client";

import type { YamahaModelId } from "@/types/music";
import { YAMAHA_PROFILES } from "@/lib/music/yamaha-profiles";
import type { TargetKeyHint } from "@/components/piano/yamaha-keyboard";

export const KEYBAR_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dCCA9E".toLowerCase();
export const KEYBAR_RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dCCA9E".toLowerCase();
export const KEYBAR_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dCCA9E".toLowerCase();

export type KeyBarTransport = "preview" | "serial" | "ble";

export interface KeyBarConfig {
  enabled: boolean;
  ledCount: number;
  brightness: number; // 10..220
  reverseOrder: boolean;
  offsetLeds: number;
}

export interface KeyBarLedPixel {
  idx: number;
  r: number;
  g: number;
  b: number;
  role: "right" | "left" | "hit" | "off";
}

export interface KeyBarConnectionState {
  transport: KeyBarTransport;
  connected: boolean;
  deviceLabel: string;
  lastPacket: string;
  lastError: string | null;
}

const STORAGE_KEY = "yamaha1100:keybar-config";
const CHANGE_EVENT = "yamaha1100:keybar-change";

export const DEFAULT_KEYBAR_CONFIG: KeyBarConfig = {
  enabled: false,
  ledCount: 176,
  brightness: 64,
  reverseOrder: false,
  offsetLeds: 0,
};

export const DEFAULT_KEYBAR_CONN_STATE: KeyBarConnectionState = {
  transport: "preview",
  connected: false,
  deviceLabel: "Virtual LED Preview",
  lastPacket: "",
  lastError: null,
};

let cachedRaw: string | null = null;
let cachedConfig: KeyBarConfig = DEFAULT_KEYBAR_CONFIG;

export function readKeyBarConfig(): KeyBarConfig {
  if (typeof window === "undefined") return DEFAULT_KEYBAR_CONFIG;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedConfig;
  cachedRaw = raw;
  if (!raw) {
    cachedConfig = DEFAULT_KEYBAR_CONFIG;
    return cachedConfig;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<KeyBarConfig>;
    cachedConfig = {
      enabled: Boolean(parsed.enabled),
      ledCount: Math.max(16, Math.min(256, Math.round(parsed.ledCount ?? 176))),
      brightness: Math.max(10, Math.min(220, Math.round(parsed.brightness ?? 64))),
      reverseOrder: Boolean(parsed.reverseOrder),
      offsetLeds: Math.max(-24, Math.min(24, Math.round(parsed.offsetLeds ?? 0))),
    };
  } catch {
    cachedConfig = DEFAULT_KEYBAR_CONFIG;
  }
  return cachedConfig;
}

export function writeKeyBarConfig(patch: Partial<KeyBarConfig>): KeyBarConfig {
  const next = { ...readKeyBarConfig(), ...patch };
  if (typeof window !== "undefined") {
    const serialized = JSON.stringify(next);
    cachedRaw = serialized;
    cachedConfig = next;
    window.localStorage.setItem(STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
  return next;
}

export function subscribeKeyBarConfig(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

/**
 * Maps MIDI note number onto LED strip indices proportionally across the physical keybed width.
 * Accounts for reverse wiring and fine alignment offset.
 */
export function midiToKeyBarIndices(
  midi: number,
  model: YamahaModelId,
  cfg: KeyBarConfig,
): number[] {
  const profile = YAMAHA_PROFILES[model];
  if (midi < profile.minMidi || midi > profile.maxMidi) return [];

  const totalSpan = Math.max(1, profile.maxMidi - profile.minMidi);
  const norm = (midi - profile.minMidi) / totalSpan;
  const directed = cfg.reverseOrder ? 1 - norm : norm;
  const centerIdx = Math.round(directed * (cfg.ledCount - 1)) + cfg.offsetLeds;

  const out: number[] = [];
  for (const idx of [centerIdx]) {
    if (idx >= 0 && idx < cfg.ledCount) out.push(idx);
  }
  return out;
}

/**
 * Builds active LED list & compact `KEY:...` command payload from target hints + active pressed keys.
 */
export function buildKeyBarFrame(
  model: YamahaModelId,
  cfg: KeyBarConfig,
  targetHints: TargetKeyHint[],
  activeNotes: Set<number>,
): { pixels: KeyBarLedPixel[]; command: string } {
  const map = new Map<number, KeyBarLedPixel>();

  for (const hint of targetHints) {
    const isRight = hint.hand === "right";
    for (const idx of midiToKeyBarIndices(hint.midi, model, cfg)) {
      map.set(idx, {
        idx,
        r: isRight ? 255 : 0,
        g: isRight ? 106 : 212,
        b: isRight ? 0 : 255,
        role: isRight ? "right" : "left",
      });
    }
  }

  for (const midi of activeNotes) {
    for (const idx of midiToKeyBarIndices(midi, model, cfg)) {
      map.set(idx, {
        idx,
        r: 0,
        g: 255,
        b: 136,
        role: "hit",
      });
    }
  }

  const pixels = Array.from(map.values()).sort((a, b) => a.idx - b.idx);
  const command =
    pixels.length === 0
      ? "CLR"
      : `KEY:${pixels.map((p) => `${p.idx}:${p.r},${p.g},${p.b}`).join(";")}`;

  return { pixels, command };
}

interface SerialPortLike {
  open: (opts: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  writable?: WritableStream<Uint8Array>;
}

interface BluetoothDeviceLike {
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<{
      getPrimaryService: (uuid: string) => Promise<{
        getCharacteristic: (uuid: string) => Promise<{
          writeValue?: (val: BufferSource) => Promise<void>;
          writeValueWithoutResponse?: (val: BufferSource) => Promise<void>;
        }>;
      }>;
    }>;
    disconnect: () => void;
  };
}

class KeyBarHardwareManager {
  private transport: KeyBarTransport = "preview";
  private deviceLabel = "Virtual LED Preview";
  private serialPort: SerialPortLike | null = null;
  private serialWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private bleDevice: BluetoothDeviceLike | null = null;
  private bleRxChar: {
    writeValue?: (val: BufferSource) => Promise<void>;
    writeValueWithoutResponse?: (val: BufferSource) => Promise<void>;
  } | null = null;
  private encoder = new TextEncoder();
  private lastSentCommand = "";
  private lastError: string | null = null;
  private listeners = new Set<() => void>();
  private writeQueue: Promise<void> = Promise.resolve();
  private cachedState: KeyBarConnectionState = DEFAULT_KEYBAR_CONN_STATE;

  constructor() {
    if (typeof window !== "undefined") {
      subscribeKeyBarConfig(() => this.emit());
    }
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private refreshSnapshot() {
    const nextConnected =
      this.transport === "preview"
        ? readKeyBarConfig().enabled
        : this.transport === "serial"
          ? Boolean(this.serialWriter)
          : Boolean(this.bleDevice?.gatt?.connected && this.bleRxChar);

    const prev = this.cachedState;
    if (
      prev.transport === this.transport &&
      prev.connected === nextConnected &&
      prev.deviceLabel === this.deviceLabel &&
      prev.lastPacket === this.lastSentCommand &&
      prev.lastError === this.lastError
    ) {
      return;
    }

    this.cachedState = {
      transport: this.transport,
      connected: nextConnected,
      deviceLabel: this.deviceLabel,
      lastPacket: this.lastSentCommand,
      lastError: this.lastError,
    };
  }

  private emit() {
    this.refreshSnapshot();
    for (const cb of this.listeners) cb();
  }

  getState(): KeyBarConnectionState {
    this.refreshSnapshot();
    return this.cachedState;
  }

  async connectSerial(cfg: KeyBarConfig): Promise<void> {
    const nav = navigator as Navigator & {
      serial?: { requestPort: (opts?: unknown) => Promise<SerialPortLike> };
    };
    if (!nav.serial) {
      this.lastError = "当前浏览器不支持 Web Serial（请使用桌面 Chrome / Edge USB 连接或改用蓝牙 BLE）";
      this.emit();
      return;
    }

    try {
      await this.disconnect();
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 115200 });
      if (!port.writable) throw new Error("串口不可写");
      this.serialPort = port;
      this.serialWriter = port.writable.getWriter();
      this.transport = "serial";
      this.deviceLabel = "USB KeyBar (115200)";
      this.lastError = null;
      writeKeyBarConfig({ enabled: true });
      await this.sendCommand(`CFG:${cfg.ledCount}:${cfg.brightness}`);
      await this.sendCommand("DEMO");
      this.emit();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : "USB 串口连接失败";
      this.emit();
    }
  }

  async connectBle(cfg: KeyBarConfig): Promise<void> {
    const nav = navigator as Navigator & {
      bluetooth?: { requestDevice: (opts: unknown) => Promise<BluetoothDeviceLike> };
    };
    if (!nav.bluetooth) {
      this.lastError = "当前环境不支持 Web Bluetooth（可在桌面/安卓 Chrome HTTPS 中配对 KEYARCADE-BAR）";
      this.emit();
      return;
    }

    try {
      await this.disconnect();
      const device = await nav.bluetooth.requestDevice({
        filters: [{ namePrefix: "KEYARCADE" }, { services: [KEYBAR_SERVICE_UUID] }],
        optionalServices: [KEYBAR_SERVICE_UUID],
      });
      const server = await device.gatt?.connect();
      if (!server) throw new Error("GATT 连接失败");
      const svc = await server.getPrimaryService(KEYBAR_SERVICE_UUID);
      const rxChar = await svc.getCharacteristic(KEYBAR_RX_CHAR_UUID);
      this.bleDevice = device;
      this.bleRxChar = rxChar;
      this.transport = "ble";
      this.deviceLabel = device.name || "KEYARCADE-BAR (BLE)";
      this.lastError = null;
      writeKeyBarConfig({ enabled: true });
      await this.sendCommand(`CFG:${cfg.ledCount}:${cfg.brightness}`);
      await this.sendCommand("DEMO");
      this.emit();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : "蓝牙配对取消或失败";
      this.emit();
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.sendCommand("CLR");
    } catch {
      // Ignore cleanup flush error
    }
    try {
      await this.serialWriter?.close();
    } catch {
      // Ignore close error
    }
    try {
      await this.serialPort?.close();
    } catch {
      // Ignore close error
    }
    try {
      this.bleDevice?.gatt?.disconnect();
    } catch {
      // Ignore BLE disconnect error
    }
    this.serialWriter = null;
    this.serialPort = null;
    this.bleRxChar = null;
    this.bleDevice = null;
    this.transport = "preview";
    this.deviceLabel = "Virtual LED Preview";
    this.emit();
  }

  async sendCommand(line: string, deduplicate = false): Promise<void> {
    if (deduplicate && line === this.lastSentCommand) return;
    this.lastSentCommand = line;

    const bytes = this.encoder.encode(`${line}\n`);
    if (this.transport === "serial" && this.serialWriter) {
      const writer = this.serialWriter;
      this.writeQueue = this.writeQueue
        .then(() => writer.write(bytes))
        .catch(() => {});
    } else if (this.transport === "ble" && this.bleRxChar) {
      const ch = this.bleRxChar;
      this.writeQueue = this.writeQueue
        .then(async () => {
          if (ch.writeValueWithoutResponse) {
            await ch.writeValueWithoutResponse(bytes);
          } else if (ch.writeValue) {
            await ch.writeValue(bytes);
          }
        })
        .catch(() => {});
    }
    this.emit();
  }
}

export const keyBarManager = new KeyBarHardwareManager();
