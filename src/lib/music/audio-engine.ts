"use client";

import type { SynthVoiceId } from "@/types/music";
import { midiToFreq } from "./theory";

interface ActiveVoice {
  stop: () => void;
}

class YamahaAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private captureDest: MediaStreamAudioDestinationNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
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
      this.comp = comp;
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Returns a live WebAudio MediaStream combining synth, drums, and metronome for WebM clip export.
   */
  getCaptureStream(): MediaStream | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.comp || typeof ctx.createMediaStreamDestination !== "function") {
      return null;
    }
    if (!this.captureDest) {
      this.captureDest = ctx.createMediaStreamDestination();
      this.comp.connect(this.captureDest);
    }
    return this.captureDest.stream;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
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
    } else if (this.voice === "lofi-tape") {
      // Dusty Lo-Fi Tape: mellow lowpass + subtle wow/flutter LFO
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(1850, freq * 3.1), now);
      filter.Q.value = 1.4;
      filter.connect(env);

      const o1 = ctx.createOscillator();
      o1.type = "triangle";
      o1.frequency.setValueAtTime(freq, now);

      const o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.setValueAtTime(freq * 1.004, now);
      const g2 = ctx.createGain();
      g2.gain.value = 0.35;

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(3.6, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.0045;
      lfo.connect(lfoGain).connect(o1.frequency);

      o1.connect(filter);
      o2.connect(g2).connect(filter);

      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.4 * velGain, now + 0.018);
      env.gain.exponentialRampToValueAtTime(0.11 * velGain, now + 0.45);
      env.gain.exponentialRampToValueAtTime(0.015 * velGain, now + 2.2);

      o1.start(now);
      o2.start(now);
      lfo.start(now);
      nodesToStop.push(o1, o2, lfo);
    } else if (this.voice === "warm-strings") {
      // Lush Ensemble Strings: gentle bowed attack & detuned saw/tri blend
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(3400, freq * 4.5), now);
      filter.connect(env);

      const detunes = [-0.004, 0, 0.0045];
      for (const d of detunes) {
        const osc = ctx.createOscillator();
        osc.type = d === 0 ? "triangle" : "sawtooth";
        osc.frequency.setValueAtTime(freq * (1 + d), now);
        const og = ctx.createGain();
        og.gain.value = d === 0 ? 0.38 : 0.22;
        osc.connect(og).connect(filter);
        osc.start(now);
        nodesToStop.push(osc);
      }

      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.32 * velGain, now + 0.16);
      env.gain.exponentialRampToValueAtTime(0.18 * velGain, now + 1.8);
    } else if (this.voice === "cyber-synth") {
      // Neon SuperSaw + Sub-Bass Lead
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(9000, freq * 8), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 2.5), now + 0.45);
      filter.Q.value = 3.2;
      filter.connect(env);

      for (const mult of [0.994, 1, 1.006, 0.5]) {
        const osc = ctx.createOscillator();
        osc.type = mult === 0.5 ? "sine" : "sawtooth";
        osc.frequency.setValueAtTime(freq * mult, now);
        const og = ctx.createGain();
        og.gain.value = mult === 0.5 ? 0.34 : 0.2;
        osc.connect(og).connect(filter);
        osc.start(now);
        nodesToStop.push(osc);
      }

      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.35 * velGain, now + 0.01);
      env.gain.exponentialRampToValueAtTime(0.16 * velGain, now + 0.3);
      env.gain.exponentialRampToValueAtTime(0.04 * velGain, now + 1.9);
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

  /**
   * Procedural WebAudio percussion synthesizer for the Arranger Rhythm Engine.
   */
  triggerDrumHit(
    drum: "kick" | "snare" | "hihat" | "openhat" | "rim" | "tom",
    level = 0.28,
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    if (drum === "kick") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(132, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.13);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(level * 1.15, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.24);
      return;
    }

    if (drum === "snare") {
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1500, now);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(level * 0.72, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      noise.connect(bp).connect(ng).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.16);

      const body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(190, now);
      body.frequency.exponentialRampToValueAtTime(110, now + 0.08);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(level * 0.45, now);
      bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      body.connect(bg).connect(this.master);
      body.start(now);
      body.stop(now + 0.1);
      return;
    }

    if (drum === "hihat" || drum === "openhat") {
      const dur = drum === "openhat" ? 0.24 : 0.045;
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(6400, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(level * (drum === "openhat" ? 0.42 : 0.28), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      noise.connect(hp).connect(g).connect(this.master);
      noise.start(now);
      noise.stop(now + dur + 0.01);
      return;
    }

    // rim or woodblock/tom
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    const startFreq = drum === "rim" ? 720 : 195;
    osc.frequency.setValueAtTime(startFreq, now);
    if (drum === "tom") osc.frequency.exponentialRampToValueAtTime(125, now + 0.14);
    g.gain.setValueAtTime(level * 0.48, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (drum === "rim" ? 0.04 : 0.16));
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Self-terminating accompaniment tone (bass / comp / arp) separate from interactive keys.
   */
  triggerAccompNote(
    midi: number,
    durationSec: number,
    kind: "bass" | "comp" | "arp" = "bass",
    velocity = 68,
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const freq = midiToFreq(midi);
    const vel = Math.max(0.1, Math.min(1, velocity / 127));
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(
      kind === "bass" ? Math.max(260, freq * 3.2) : kind === "comp" ? 2100 : 3800,
      now,
    );

    const osc = ctx.createOscillator();
    osc.type = kind === "bass" ? "triangle" : kind === "arp" ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, now);

    const g = ctx.createGain();
    const peak = (kind === "bass" ? 0.24 : kind === "comp" ? 0.12 : 0.15) * vel;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, now + Math.max(0.08, durationSec));

    osc.connect(filter).connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + Math.max(0.09, durationSec) + 0.02);
  }
}

export const audioEngine = new YamahaAudioEngine();
