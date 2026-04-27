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
          // No bloqueamos la app.
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
    } catch (error) {
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
          <p className="sp-location-kicker">Salidas inteligentes</p>
          <h2>Activa tu ubicación</h2>
          <p>
            SyncPlans puede calcular mejor cuándo salir según tu ubicación real,
            el tráfico y la dirección del evento.
          </p>
          <small>
            La usamos solo para mejorar ETA y alertas de salida. Puedes cambiarlo
            luego en Ajustes.
          </small>
        </div>

        <div className="sp-location-actions">
          <button
            type="button"
            className="sp-location-primary"
            onClick={handleAllow}
            disabled={busy}
          >
            {busy ? "Activando..." : "Activar ubicación"}
          </button>

          <button
            type="button"
            className="sp-location-secondary"
            onClick={handleLater}
            disabled={busy}
          >
            Ahora no
          </button>

          <button
            type="button"
            className="sp-location-ghost"
            onClick={handleNoThanks}
            disabled={busy}
          >
            No, gracias
          </button>
        </div>
      </div>

      <style jsx>{`
        .sp-location-prompt {
          position: fixed;
          left: 0;
          right: 0;
          bottom: max(16px, env(safe-area-inset-bottom));
          z-index: 80;
          display: flex;
          justify-content: center;
          pointer-events: none;
          padding: 0 14px;
        }

        .sp-location-card {
          width: min(100%, 720px);
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          pointer-events: auto;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          background: rgba(7, 17, 38, 0.96);
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
          background: rgba(255, 255, 255, 0.1);
          font-size: 20px;
        }

        .sp-location-copy {
          min-width: 0;
        }

        .sp-location-kicker {
          margin: 0 0 3px;
          color: ${colors.textSecondary};
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        h2 {
          margin: 0 0 4px;
          font-size: 16px;
          line-height: 1.2;
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
          color: rgba(255, 255, 255, 0.5);
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
          font-weight: 700;
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
            bottom: max(78px, calc(env(safe-area-inset-bottom) + 76px));
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