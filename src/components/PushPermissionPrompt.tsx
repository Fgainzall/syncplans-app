"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ensurePushSubscription,
  getExistingPushSubscription,
  getPushPermissionStatus,
  isPushPromptSnoozed,
  markPushPromptDenied,
  refreshPushSubscriptionIfGranted,
  snoozePushPrompt,
  type PushPermissionStatus,
} from "@/lib/pushNotifications";
import { colors } from "@/styles/design-tokens";

export default function PushPermissionPrompt() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<PushPermissionStatus>("unknown");

  const enabled = useMemo(() => {
    return process.env.NEXT_PUBLIC_ENABLE_PUSH_PROMPT !== "false";
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !enabled || done) return;

    let cancelled = false;

    async function checkPushPermission() {
      const current = getPushPermissionStatus();

      if (cancelled) return;
      setStatus(current);

      if (current === "unsupported") return;

      if (current === "granted") {
        await refreshPushSubscriptionIfGranted();
        return;
      }

      if (current === "denied") {
        markPushPromptDenied();
        return;
      }

      if (isPushPromptSnoozed()) return;

      const existing = await getExistingPushSubscription().catch(() => null);
      if (cancelled) return;

      if (existing) return;

      window.setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, 1800);
    }

    void checkPushPermission();

    return () => {
      cancelled = true;
    };
  }, [mounted, enabled, done]);

  async function handleAllow() {
    setBusy(true);

    try {
      await ensurePushSubscription();
      setDone(true);
      setVisible(false);
      setStatus("granted");
    } catch {
      const current = getPushPermissionStatus();
      setStatus(current);

      if (current === "denied") {
        markPushPromptDenied();
        setDone(true);
        setVisible(false);
      } else {
        snoozePushPrompt(3);
        setDone(true);
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleLater() {
    snoozePushPrompt(7);
    setDone(true);
    setVisible(false);
  }

  function handleNoThanks() {
    markPushPromptDenied();
    setDone(true);
    setVisible(false);
  }

  if (!mounted || !visible) return null;
  if (status === "unsupported" || status === "denied") return null;

  return (
    <div className="sp-push-prompt" role="dialog" aria-live="polite">
      <div className="sp-push-card">
        <div className="sp-push-icon">🔔</div>

        <div className="sp-push-copy">
          <p className="sp-push-kicker">Alertas de salida</p>
          <h2>Recibe el aviso aunque no estés usando la app</h2>
          <p>
            Activa notificaciones para que SyncPlans pueda avisarte cuando sea
            momento de salir hacia tu próximo plan.
          </p>
          <small>
            Solo las usamos para avisos importantes: salidas, conflictos y cambios
            relevantes.
          </small>
        </div>

        <div className="sp-push-actions">
          <button
            type="button"
            className="sp-push-primary"
            onClick={handleAllow}
            disabled={busy}
          >
            {busy ? "Activando..." : "Activar notificaciones"}
          </button>

          <button
            type="button"
            className="sp-push-secondary"
            onClick={handleLater}
            disabled={busy}
          >
            Luego
          </button>

          <button
            type="button"
            className="sp-push-ghost"
            onClick={handleNoThanks}
            disabled={busy}
          >
            No por ahora
          </button>
        </div>
      </div>

      <style jsx>{`
        .sp-push-prompt {
          position: fixed;
          left: 50%;
          right: auto;
          bottom: max(24px, env(safe-area-inset-bottom));
          transform: translateX(-50%);
          z-index: 121;
          display: flex;
          justify-content: center;
          pointer-events: none;
          padding: 0 16px;
          width: min(100vw, 760px);
        }

        .sp-push-card {
          width: min(100%, 720px);
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          pointer-events: auto;
          border: 1px solid rgba(125, 211, 252, 0.18);
          border-radius: 24px;
          background: rgba(7, 17, 38, 0.97);
          color: ${colors.textPrimary};
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
          padding: 16px;
        }

        .sp-push-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(125, 211, 252, 0.12);
          font-size: 20px;
        }

        .sp-push-copy {
          min-width: 0;
        }

        .sp-push-kicker {
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

        .sp-push-actions {
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

        .sp-push-primary {
          padding: 10px 14px;
          background: #ffffff;
          color: #071126;
        }

        .sp-push-secondary {
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.1);
          color: ${colors.textPrimary};
        }

        .sp-push-ghost {
          padding: 10px 8px;
          background: transparent;
          color: ${colors.textSecondary};
        }

        @media (max-width: 760px) {
          .sp-push-prompt {
            width: 100%;
            bottom: max(96px, calc(env(safe-area-inset-bottom) + 92px));
            padding: 0 14px;
          }

          .sp-push-card {
            grid-template-columns: auto minmax(0, 1fr);
            align-items: start;
            border-radius: 24px;
            padding: 15px;
          }

          .sp-push-actions {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
          }

          .sp-push-primary {
            grid-column: 1 / -1;
          }

          .sp-push-ghost {
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}