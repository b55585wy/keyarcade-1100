"use client";

import { useEffect, useSyncExternalStore } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function subscribePwaInstall(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getInstallPromptSnapshot(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function usePwaInstallPrompt() {
  const promptEvent = useSyncExternalStore(
    subscribePwaInstall,
    getInstallPromptSnapshot,
    () => null,
  );

  const triggerInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const res = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
    return res.outcome === "accepted";
  };

  return { canInstall: promptEvent !== null, triggerInstall };
}

export function PwaRegister() {
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      notify();
    };
    const onInstalled = () => {
      deferredPrompt = null;
      notify();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration optional when running on non-HTTPS dev origins
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
