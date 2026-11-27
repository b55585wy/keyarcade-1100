"use client";

import type { SynthVoiceId } from "@/types/music";
import { midiToFreq } from "./theory";

interface ActiveVoice {
  stop: () => void;
}

class YamahaAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private active = new Map<number, ActiveVoice>();
  private sustained = new Set<number>();
  private sustainDown = false;
  private voice: SynthVoiceId = "grand-piano";
  private volume = 0.55;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;

      // Subtle studio compressor so chords never clip
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setVoice(voice: SynthVoiceId) {
    this.voice = voice;
  }

  getVoice(): SynthVoiceId {
    return this.voice;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  setSustain(down: boolean) {
    this.sustainDown = down;
    if (!down) {
      for (const midi of this.sustained) {
        this.stopVoiceNow(midi);
      }
      this.sustained.clear();
    }
  }

  noteOn(midi: number, velocity = 96) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    this.sustained.delete(midi);
    this.stopVoiceNow(midi);

    const freq = midiToFreq(midi);
    const velGain = Math.max(0.15, Math.min(1, velocity / 127));
    const now = ctx.currentTime;

    const env = ctx.createGain();
    env.connect(this.master);

    const nodesToStop: OscillatorNode[] = [];

    if (this.voice === "8bit-arcade") {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now);
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.22 * velGain, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.12 * velGain, now + 0.14);
      osc.connect(env);
      osc.start(now);
      nodesToStop.push(osc);
    } else if (this.voice === "guzheng") {
      // Plucked string: bright triangle + 2nd harmonic + sharp decay filter
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(7000, freq * 7), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.8), now + 0.9);
      filter.connect(env);

      const osc1 = ctx.createOscillator();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(freq, now);

      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq * 2, now);

      const g2 = ctx.createGain();
      g2.gain.value = 0.28;
      osc1.connect(filter);
      osc2.connect(g2).connect(filter);

      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.36 * velGain, now + 0.006);
      env.gain.exponentialRampToValueAtTime(0.008, now + 2.2);

      osc1.start(now);
      osc2.start(now);
      nodesToStop.push(osc1, osc2);
    } else if (this.voice === "yamaha-ep") {
      // Classic DX7 bell electric piano using simple 2-op FM synthesis
      const carrier = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      carrier.type = "sine";
      mod.type = "sine";
      carrier.frequency.setValueAtTime(freq, now);
      mod.frequency.setValueAtTime(freq * 3, now);
      modGain.gain.setValueAtTime(freq * 1.8 * velGain, now);
      modGain.gain.exponentialRampToValueAtTime(freq * 0.08, now + 0.6);

      mod.connect(modGain).connect(carrier.frequency);
      carrier.connect(env);

      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.38 * velGain, now + 0.006);
      env.gain.exponentialRampToValueAtTime(0.06 * velGain, now + 1.8);

      carrier.start(now);
      mod.start(now);
      nodesToStop.push(carrier, mod);
    } else {
      // Warm Grand Piano: fundamental + 2nd + 3rd harmonics with velocity-sensitive lowpass
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(8000, freq * (4 + velGain * 4)), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(350, freq * 2), now + 1.4);
      filter.connect(env);

      const o1 = ctx.createOscillator();
      o1.type = "triangle";
      o1.frequency.setValueAtTime(freq, now);

      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.setValueAtTime(freq * 2, now);
      const g2 = ctx.createGain();
      g2.gain.value = 0.32;

      const o3 = ctx.createOscillator();
      o3.type = "sine";
      o3.frequency.setValueAtTime(freq * 3, now);
      const g3 = ctx.createGain();
      g3.gain.value = 0.1;

      o1.connect(filter);
      o2.connect(g2).connect(filter);
      o3.connect(g3).connect(filter);

      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.42 * velGain, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.14 * velGain, now + 0.35);
      env.gain.exponentialRampToValueAtTime(0.02 * velGain, now + 2.8);

      o1.start(now);
      o2.start(now);
      o3.start(now);
      nodesToStop.push(o1, o2, o3);
    }

    this.active.set(midi, {
      stop: () => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        try {
          env.gain.cancelScheduledValues(t);
          env.gain.setValueAtTime(Math.max(0.001, env.gain.value), t);
          env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          for (const osc of nodesToStop) {
            osc.stop(t + 0.16);
          }
        } catch {
          // ignore already stopped nodes
        }
      },
    });
  }

  noteOff(midi: number) {
    if (this.sustainDown) {
      this.sustained.add(midi);
      return;
    }
    this.stopVoiceNow(midi);
  }

  private stopVoiceNow(midi: number) {
    const voice = this.active.get(midi);
    if (voice) {
      voice.stop();
      this.active.delete(midi);
    }
  }

  stopAll() {
    this.sustained.clear();
    for (const midi of [...this.active.keys()]) {
      this.stopVoiceNow(midi);
    }
  }

  playMetronomeClick(accent: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(accent ? 1320 : 880, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(accent ? 0.25 : 0.15, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

export const audioEngine = new YamahaAudioEngine();
