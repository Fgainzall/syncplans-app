"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getCurrentBrowserPosition,
  isLocationPromptSnoozed,
  markLocationPromptDenied,
  persistLocationFromBrowser,
  persistLocationPromptStatus,
  snoozeLocationPrompt,
  wasLocationPromptDenied,
} from "@/lib/locationPermission";
import { colors } from "@/styles/design-tokens";

type PermissionStateValue = "granted" | "denied" | "prompt" | "unknown";

const LOCATION_PROMPT_VISIBLE_KEY = "syncplans:location_prompt_visible";
const LOCATION_PROMPT_LAST_SHOWN_KEY = "syncplans:location_prompt_last_shown_at";

function setLocationPromptVisible(value: boolean) {
  try {
    if (value) {
      window.localStorage.setItem(LOCATION_PROMPT_VISIBLE_KEY, "1");
      window.localStorage.setItem(LOCATION_PROMPT_LAST_SHOWN_KEY, String(Date.now()));
      return;
    }

    window.localStorage.removeItem(LOCATION_PROMPT_VISIBLE_KEY);
  } catch {
    // No bloqueamos UI por localStorage.
  }
}

export default function LocationPermissionPrompt() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const enabled = useMemo(() => {
    return process.env.NEXT_PUBLIC_ENABLE_LOCATION_PROMPT !== "false";
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocationPromptVisible(visible);

    return () => {
      if (visible) setLocationPromptVisible(false);
    };
  }, [visible]);

  useEffect(() => {
    if (!mounted || !enabled || done) return;

    let cancelled = false;

    async function checkPermission() {
      if (typeof window === "undefined") return;
      if (!("geolocation" in navigator)) return;
      if (isLocationPromptSnoozed()) return;
      if (wasLocationPromptDenied()) return;

      let state: PermissionStateValue = "unknown";

      try {
        if ("permissions" in navigator) {
          const result = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });
          state = result.state as PermissionStateValue;
        }
      } catch {
        state = "unknown";
      }

      if (cancelled) return;

      if (state === "granted") {
        try {
          const point = await getCurrentBrowserPosition();
          await persistLocationFromBrowser(point);
          await persistLocationPromptStatus("granted");
        } catch {
          // No bloqueamos la app si el navegador falla al refrescar ubicación.
        }
        return;
      }

      if (state === "denied") {
        markLocationPromptDenied();
        await persistLocationPromptStatus("denied");
        return;
      }

      window.setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, 1200);
    }

    void checkPermission();

    return () => {
      cancelled = true;
    };
  }, [mounted, enabled, done]);

  async function handleAllow() {
    setBusy(true);

    try {
      const point = await getCurrentBrowserPosition();
      await persistLocationFromBrowser(point);
      await persistLocationPromptStatus("granted");

      setDone(true);
      setVisible(false);
    } catch {
      markLocationPromptDenied();
      await persistLocationPromptStatus("denied");

      setDone(true);
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleLater() {
    snoozeLocationPrompt(7);
    await persistLocationPromptStatus("dismissed");
    setDone(true);
    setVisible(false);
  }

  async function handleNoThanks() {
    markLocationPromptDenied();
    await persistLocationPromptStatus("denied");
    setDone(true);
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  return (
    <div className="sp-location-prompt" role="dialog" aria-live="polite">
      <div className="sp-location-card">
        <div className="sp-location-icon">↗</div>

        <div className="sp-location-copy">
          <p className="sp-location-kicker">Smart Mobility</p>
          <h2>Avísame cuándo salir con más precisión</h2>
          <p>
            SyncPlans usa tu ubicación actual para calcular rutas, tráfico y la
            hora ideal de salida hacia tus eventos con dirección.
          </p>
          <small>
            No es seguimiento constante. Se usa para mejorar ETA y alertas de
            salida. Puedes cambiarlo luego en Ajustes.
          </small>
        </div>

        <div className="sp-location-actions">
          <button
            type="button"
            className="sp-location-primary"
            onClick={handleAllow}
            disabled={busy}
          >
            {busy ? "Activando…" : "Usar mi ubicación"}
          </button>

          <button
            type="button"
            className="sp-location-secondary"
            onClick={handleLater}
            disabled={busy}
          >
            Luego
          </button>

          <button
            type="button"
            className="sp-location-ghost"
            onClick={handleNoThanks}
            disabled={busy}
          >
            No por ahora
          </button>
        </div>
      </div>

      <style jsx>{`
        .sp-location-prompt {
          position: fixed;
          left: 50%;
          right: auto;
          bottom: max(24px, env(safe-area-inset-bottom));
          transform: translateX(-50%);
          z-index: 120;
          display: flex;
          justify-content: center;
          pointer-events: none;
          padding: 0 16px;
          width: min(100vw, 760px);
        }

        .sp-location-card {
          width: min(100%, 720px);
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          pointer-events: auto;
          border: 1px solid rgba(125, 211, 252, 0.2);
          border-radius: 24px;
          background: rgba(7, 17, 38, 0.97);
          color: ${colors.textPrimary};
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
          padding: 16px;
        }

        .sp-location-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(125, 211, 252, 0.12);
          color: rgba(224, 242, 254, 0.98);
          font-size: 20px;
          font-weight: 900;
        }

        .sp-location-copy {
          min-width: 0;
        }

        .sp-location-kicker {
          margin: 0 0 3px;
          color: rgba(125, 211, 252, 0.9);
          font-size: 12px;
          font-weight: 850;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        h2 {
          margin: 0 0 4px;
          font-size: 16px;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }

        p {
          margin: 0;
          color: ${colors.textSecondary};
          font-size: 14px;
          line-height: 1.4;
        }

        small {
          display: block;
          margin-top: 5px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          line-height: 1.35;
        }

        .sp-location-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }

        button {
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          font-weight: 800;
          transition:
            transform 160ms ease,
            opacity 160ms ease;
        }

        button:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        button:not(:disabled):active {
          transform: scale(0.98);
        }

        .sp-location-primary {
          padding: 10px 14px;
          background: #ffffff;
          color: #071126;
        }

        .sp-location-secondary {
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.1);
          color: ${colors.textPrimary};
        }

        .sp-location-ghost {
          padding: 10px 8px;
          background: transparent;
          color: ${colors.textSecondary};
        }

        @media (max-width: 760px) {
          .sp-location-prompt {
            width: 100%;
            bottom: max(96px, calc(env(safe-area-inset-bottom) + 92px));
            padding: 0 14px;
          }

          .sp-location-card {
            grid-template-columns: auto minmax(0, 1fr);
            align-items: start;
            border-radius: 24px;
            padding: 15px;
          }

          .sp-location-actions {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
          }

          .sp-location-primary {
            grid-column: 1 / -1;
          }

          .sp-location-ghost {
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}