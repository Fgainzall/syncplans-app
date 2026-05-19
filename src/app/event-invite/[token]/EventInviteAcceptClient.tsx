// src/app/event-invite/[token]/EventInviteAcceptClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import {
  acceptEventInvite,
  getEventInvitePreview,
  type EventInvitePreview,
} from "@/lib/eventInvitesDb";

export default function EventInviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<EventInvitePreview | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedEventId, setAcceptedEventId] = useState<string | null>(null);

  const expectedEmail = useMemo(
    () => String(preview?.invited_email ?? "").trim().toLowerCase(),
    [preview]
  );

  const emailMatches = useMemo(() => {
    if (!expectedEmail) return true;
    if (!authEmail) return false;
    return expectedEmail === authEmail.toLowerCase();
  }, [authEmail, expectedEmail]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [previewRes, sessionRes] = await Promise.all([
          getEventInvitePreview(token),
          supabase.auth.getSession(),
        ]);

        if (!alive) return;

        setPreview(previewRes);
        setAuthEmail(
          sessionRes.data.session?.user?.email
            ? String(sessionRes.data.session.user.email).toLowerCase()
            : null
        );
      } catch (err: unknown) {
        if (!alive) return;
        setError(
          err instanceof Error
            ? err.message
            : "No pudimos cargar esta invitación."
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [token]);

  async function handleAccept() {
    try {
      setAccepting(true);
      setError(null);
      const result = await acceptEventInvite(token);
      setAcceptedEventId(result.event_id);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos aceptar esta invitación."
      );
    } finally {
      setAccepting(false);
    }
  }

  function goLogin() {
    const next = `/event-invite/${encodeURIComponent(token)}`;
    router.push(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  function goEvents() {
    const eventId = acceptedEventId ?? preview?.event_id ?? "";
    router.push(eventId ? `/events?focusEventId=${encodeURIComponent(eventId)}` : "/events");
  }

  return (
    <main style={S.page}>
      <section style={S.card}>
        <div style={S.badge}>SyncPlans</div>
        <h1 style={S.title}>Te compartieron un plan</h1>

        {loading ? (
          <p style={S.body}>Cargando invitación…</p>
        ) : error && !preview ? (
          <div style={S.errorBox}>{error}</div>
        ) : preview ? (
          <>
            <div style={S.planBox}>
              <div style={S.planEyebrow}>Plan compartido</div>
              <div style={S.planTitle}>{preview.event_title || "Plan"}</div>
              {preview.event_start ? (
                <div style={S.planDate}>{formatPlanDate(preview.event_start, preview.event_end)}</div>
              ) : null}
            </div>

            <p style={S.body}>
              Esta invitación te da acceso solo a este evento. No verás el calendario completo, grupos ni otros planes de la persona que lo compartió.
            </p>

            {expectedEmail ? (
              <div style={S.emailBox}>
                Invitación para: <strong>{expectedEmail}</strong>
              </div>
            ) : null}

            {!authEmail ? (
              <>
                <p style={S.muted}>Inicia sesión con ese correo para aceptar el plan.</p>
                <button type="button" onClick={goLogin} style={S.primaryButton}>
                  Iniciar sesión para aceptar
                </button>
              </>
            ) : !emailMatches ? (
              <div style={S.errorBox}>
                Estás conectado como {authEmail}, pero este link fue creado para {expectedEmail}. Cierra sesión e ingresa con el correo correcto.
              </div>
            ) : acceptedEventId || preview.status === "accepted" ? (
              <>
                <div style={S.successBox}>Listo. Este plan ya está en tu SyncPlans.</div>
                <button type="button" onClick={goEvents} style={S.primaryButton}>
                  Ver en Eventos
                </button>
              </>
            ) : (
              <>
                {error ? <div style={S.errorBox}>{error}</div> : null}
                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                  style={S.primaryButton}
                >
                  {accepting ? "Aceptando…" : "Aceptar este plan"}
                </button>
              </>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}

function formatPlanDate(startIso: string, endIso?: string | null) {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;

  if (Number.isNaN(start.getTime())) return "Fecha por confirmar";

  const date = start.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = end && !Number.isNaN(end.getTime())
    ? end.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
    : null;

  return endTime ? `${date} · ${startTime} – ${endTime}` : `${date} · ${startTime}`;
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 32%), #020617",
    color: "white",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    width: "min(100%, 520px)",
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.96))",
    boxShadow: "0 32px 90px rgba(0,0,0,0.42)",
    padding: "28px clamp(20px, 5vw, 34px)",
    display: "grid",
    gap: 16,
  },
  badge: {
    width: "fit-content",
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(37,99,235,0.16)",
    color: "rgba(219,234,254,0.98)",
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 950,
  },
  title: {
    margin: 0,
    fontSize: "clamp(28px, 7vw, 42px)",
    lineHeight: 1.02,
    letterSpacing: "-0.045em",
  },
  body: {
    margin: 0,
    color: "rgba(203,213,225,0.86)",
    fontSize: 14,
    lineHeight: 1.55,
  },
  muted: {
    margin: 0,
    color: "rgba(148,163,184,0.95)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  planBox: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.045)",
    padding: 16,
    display: "grid",
    gap: 5,
  },
  planEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 950,
    color: "rgba(125,211,252,0.95)",
  },
  planTitle: {
    fontSize: 19,
    fontWeight: 950,
    color: "rgba(255,255,255,0.97)",
  },
  planDate: {
    fontSize: 13,
    color: "rgba(203,213,225,0.86)",
  },
  emailBox: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.035)",
    padding: 12,
    fontSize: 13,
    color: "rgba(226,232,240,0.94)",
  },
  errorBox: {
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(127,29,29,0.28)",
    color: "rgba(254,226,226,0.98)",
    padding: 13,
    fontSize: 13,
    lineHeight: 1.45,
  },
  successBox: {
    borderRadius: 16,
    border: "1px solid rgba(74,222,128,0.26)",
    background: "rgba(22,101,52,0.22)",
    color: "rgba(220,252,231,0.98)",
    padding: 13,
    fontSize: 13,
    lineHeight: 1.45,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.30)",
    background: "linear-gradient(135deg, rgba(37,99,235,0.98), rgba(14,165,233,0.88))",
    color: "white",
    fontWeight: 950,
    fontSize: 14,
    cursor: "pointer",
    padding: "0 18px",
  },
};
