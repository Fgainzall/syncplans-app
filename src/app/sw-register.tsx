"use client";

import { useEffect } from "react";

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const registerServiceWorker = () => {
      if (cancelled) return;

      navigator.serviceWorker.register("/sw.js").catch(() => {
        // El service worker no debe bloquear ni ensuciar el arranque.
      });
    };

    const win = window as WindowWithIdleCallback;

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(registerServiceWorker, { timeout: 2200 });
    } else {
      timeoutId = window.setTimeout(registerServiceWorker, 1600);
    }

    return () => {
      cancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
    };
  }, []);

  return null;
}
