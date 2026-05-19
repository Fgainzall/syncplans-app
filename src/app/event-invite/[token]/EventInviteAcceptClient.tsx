// src/app/event-invite/[token]/EventInviteAcceptClient.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import supabase from "@/lib/supabaseClient";
import {
  acceptEventSpecificInvite,
  getEventInvitePreview,
  type EventInvitePreview,
} from "@/lib/eventInvitesDb";
import { trackEventOnce, trackScreenView } from "@/lib/analytics";

type Props = {
  token: string;
};

type SessionUser = {
  id: string;
  email?: string | null;
};

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Horario por confirmar";

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;

  if (Number.isNaN(startDate.getTime())) return "Horario por confirmar";

  const date = startDate.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  const startTime = startDate.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime =
    endDate && !Number.isNaN(endDate.getTime())
      ? endDate.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return endTime ? `${date} · ${startTime} – ${endTime}` : `${date} · ${startTime}`;
}

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export default function EventInviteAcceptClient({ token }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<EventInvitePreview | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptedEventId, setAcceptedEventId] = useState<string | null>(null);

  const safeToken = useMemo(() => String(token ?? "").trim(), [token]);
  const currentEmail = cleanEmail(user?.email);
  const invitedEmail = cleanEmail(preview?.invited_email);
  const emailMismatch = Boolean(
    preview && currentEmail && invitedEmail && currentEmail !== invitedEmail
  );
  const alreadyAccepted = String(preview?.status ?? "").toLowerCase() === "accepted";

  useEffect(() => {
    void trackScreenView({
      screen: "event_invite_accept",
      metadata: { source: "event_invite_link" },
    });
  }, []);

  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        setLoading(true);
        setError(null);

        if (!safeToken) {
          setError("Este link no es válido.");
          return;
        }

        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user ?? null;

        if (!sessionUser) {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          router.replace(`/auth/login?next=${next}`);
          return;
        }

        if (!alive) return;
        setUser({ id: sessionUser.id, email: sessionUser.email ?? null });

        const loadedPreview = await getEventInvitePreview(safeToken);

        if (!alive) return;
        setPreview(loadedPreview);

        if (!loadedPreview) {
          setError("No encontramos esta invitación. Puede haber expirado o sido eliminada.");
        }
      } catch (err: unknown) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar la invitación.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void boot();

    return () => {
      alive = false;
    };
  }, [router, safeToken]);

  useEffect(() => {
    if (!preview?.invite_id) return;

    void trackEventOnce({
      event: "event_specific_invite_opened",
      userId: user?.id ?? undefined,
      entityId: preview.invite_id,
      scope: "session",
      onceKey: `event-specific-invite-opened:${preview.invite_id}`,
      metadata: {
        eventId: preview.event_id,
        status: preview.status,
      },
    });
  }, [preview, user?.id]);

  async function onAccept() {
    try {
      setBusy(true);
      setError(null);

      const result = await acceptEventSpecificInvite(safeToken);
      setAcceptedEventId(result.event_id || preview?.event_id || null);

      if (preview?.invite_id) {
        void trackEventOnce({
          event: "event_specific_invite_accepted",
          userId: user?.id ?? undefined,
          entityId: preview.invite_id,
          scope: "local",
          onceKey: `event-specific-invite-accepted:${preview.invite_id}`,
          metadata: { eventId: result.event_id || preview.event_id },
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo aceptar la invitación.");
    } finally {
      setBusy(false);
    }
  }

  function goToEvent() {
    const eventId = acceptedEventId || preview?.event_id;
    if (eventId) {
      router.push(`/events?focusEventId=${encodeURIComponent(eventId)}`);
      return;
    }

    router.push("/events");
  }

  return (
    <MobileScaffold maxWidth={860} style={S.page}>
      <Section>
        <PremiumHeader
          hideUpgradeCta
          title="Invitación a un plan"
          subtitle="Acceso puntual a un evento específico."
        />

        <Card style={S.card}>
          {loading ? (
            <div style={S.stateBox}>
              <div style={S.kicker}>Cargando invitación</div>
              <h1 style={S.title}>Un momento…</h1>
              <p style={S.body}>Estamos validando el link de este plan.</p>
            </div>
          ) : error && !preview ? (
            <div style={S.stateBox}>
              <div style={S.kicker}>Link no disponible</div>
              <h1 style={S.title}>No pudimos abrir esta invitación</h1>
              <p style={S.body}>{error}</p>
              <button type="button" onClick={() => router.push("/events")} style={S.secondaryBtn}>
                Ir a Eventos
              </button>
            </div>
          ) : acceptedEventId || alreadyAccepted ? (
            <div style={S.stateBox}>
              <div style={S.kicker}>Listo</div>
              <h1 style={S.title}>Ya tienes acceso a este plan</h1>
              <p style={S.body}>
                Este evento ya está vinculado a tu cuenta de SyncPlans. Solo verás este plan, no el calendario completo de la otra persona.
              </p>
              <button type="button" onClick={goToEvent} style={S.primaryBtn}>
                Ver plan
              </button>
            </div>
          ) : preview ? (
            <div style={S.stack}>
              <div>
                <div style={S.kicker}>Te compartieron un plan</div>
                <h1 style={S.title}>{preview.event_title || "Plan compartido"}</h1>
                <p style={S.body}>{formatDateRange(preview.event_start, preview.event_end)}</p>
              </div>

              <div style={S.infoBox}>
                <div style={S.infoTitle}>Qué significa aceptar</div>
                <div style={S.infoBody}>
                  Entrarás solo a este evento. No tendrás acceso a otros planes, grupos ni calendario completo de quien te invitó.
                </div>
              </div>

              {emailMismatch ? (
                <div style={S.errorBox}>
                  Este link fue creado para <strong>{invitedEmail}</strong>, pero estás conectado como <strong>{currentEmail}</strong>. Cierra sesión o entra con el correo correcto.
                </div>
              ) : null}

              {error ? <div style={S.errorBox}>{error}</div> : null}

              <div style={S.actions}>
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={busy || emailMismatch}
                  style={{ ...S.primaryBtn, ...(busy || emailMismatch ? S.disabledBtn : null) }}
                >
                  {busy ? "Aceptando…" : "Aceptar y ver este plan"}
                </button>
                <button type="button" onClick={() => router.push("/events")} style={S.secondaryBtn}>
                  Ahora no
                </button>
              </div>
            </div>
          ) : null}
        </Card>
      </Section>
    </MobileScaffold>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1000px 560px at 15% -10%, rgba(56,189,248,0.14), transparent 60%), radial-gradient(780px 460px at 100% 0%, rgba(124,58,237,0.12), transparent 58%), #050816",
  },
  card: {
    padding: "clamp(18px, 4vw, 28px)",
    borderRadius: 28,
  },
  stack: {
    display: "grid",
    gap: 18,
  },
  stateBox: {
    display: "grid",
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(125,211,252,0.95)",
  },
  title: {
    margin: 0,
    fontSize: "clamp(26px, 6vw, 42px)",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
  },
  body: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(203,213,225,0.86)",
  },
  infoBox: {
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(96,165,250,0.20)",
    background: "rgba(37,99,235,0.10)",
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: 950,
    color: "rgba(219,234,254,0.98)",
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(203,213,225,0.86)",
  },
  errorBox: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(127,29,29,0.20)",
    color: "rgba(254,226,226,0.96)",
    fontSize: 13,
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryBtn: {
    minHeight: 42,
    border: "1px solid rgba(96,165,250,0.34)",
    borderRadius: 999,
    background: "rgba(37,99,235,0.24)",
    color: "rgba(219,234,254,0.98)",
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
  secondaryBtn: {
    minHeight: 42,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    color: "rgba(226,232,240,0.92)",
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  disabledBtn: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
};
