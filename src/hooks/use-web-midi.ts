"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface MidiDeviceSummary {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export interface MidiNoteEvent {
  midi: number;
  velocity: number;
  channel: number;
  timestamp: number;
}

interface UseWebMidiOptions {
  onNoteOn?: (ev: MidiNoteEvent) => void;
  onNoteOff?: (midi: number) => void;
  onSustainChange?: (down: boolean) => void;
}

function noopSubscribe() {
  return () => {};
}

export function useWebMidi(opts: UseWebMidiOptions) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
    () => false,
  );
  const [status, setStatus] = useState<"idle" | "ready" | "denied" | "unsupported">("idle");
  const [devices, setDevices] = useState<MidiDeviceSummary[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>("all");
  const [lastVelocity, setLastVelocity] = useState<number>(0);

  const cbRef = useRef(opts);
  const accessRef = useRef<MIDIAccess | null>(null);
  const selectedRef = useRef(selectedInputId);

  useEffect(() => {
    cbRef.current = opts;
    selectedRef.current = selectedInputId;
  });

  const attachListeners = useCallback((access: MIDIAccess) => {
    const list: MidiDeviceSummary[] = [];
    access.inputs.forEach((input) => {
      list.push({
        id: input.id,
        name: input.name || "USB MIDI Keyboard",
        manufacturer: input.manufacturer || "Yamaha / Generic",
        state: input.state,
      });

      input.onmidimessage = (msg: MIDIMessageEvent) => {
        if (selectedRef.current !== "all" && input.id !== selectedRef.current) return;
        const data = msg.data;
        if (!data || data.length < 2) return;
        const statusByte = data[0];
        const cmd = statusByte & 0xf0;
        const channel = statusByte & 0x0f;
        const d1 = data[1];
        const d2 = data.length > 2 ? data[2] : 0;

        if (cmd === 0x90 && d2 > 0) {
          setLastVelocity(d2);
          cbRef.current.onNoteOn?.({
            midi: d1,
            velocity: d2,
            channel,
            timestamp: performance.now(),
          });
        } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
          cbRef.current.onNoteOff?.(d1);
        } else if (cmd === 0xb0 && d1 === 64) {
          cbRef.current.onSustainChange?.(d2 >= 64);
        }
      };
    });
    setDevices(list);
  }, []);

  const connectMidi = useCallback(async () => {
    if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) {
      setStatus("unsupported");
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      setStatus("ready");
      attachListeners(access);
      access.onstatechange = () => attachListeners(access);
    } catch {
      setStatus("denied");
    }
  }, [attachListeners]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) {
      return;
    }
    let cancelled = false;
    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        if (cancelled) return;
        accessRef.current = access;
        setStatus("ready");
        attachListeners(access);
        access.onstatechange = () => attachListeners(access);
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });

    return () => {
      cancelled = true;
      if (accessRef.current) {
        accessRef.current.inputs.forEach((i) => {
          i.onmidimessage = null;
        });
      }
    };
  }, [attachListeners]);

  const yamahaDetected = devices.some((d) =>
    /yamaha|casio|kbp|psr|px-?s?1100|wk-?1100|privia|digital|usb/i.test(
      `${d.name} ${d.manufacturer}`,
    ),
  );

  return {
    supported,
    status: supported ? status : ("unsupported" as const),
    devices,
    selectedInputId,
    setSelectedInputId,
    lastVelocity,
    yamahaDetected,
    connectMidi,
  };
}
