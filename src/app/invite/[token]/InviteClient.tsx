"use client";

import { useEffect, useMemo, useState } from "react";
import { trackEvent, trackScreenView } from "@/lib/analytics";

type PublicInviteStatus = "pending" | "accepted" | "rejected";

type PublicInviteRow = {
  id: string;
  event_id: string;
  contact: string | null;
  token: string;
  status: PublicInviteStatus;
  proposed_date: string | null;
  message: string | null;
  created_at: string;
};

type PublicInviteEvent = {
  id: string;
  title: string | null;
  start: string | null;
  end: string | null;
};

type Props = {
  token: string;
};

type ResponseMode = "idle" | "propose";

function formatEventDate(start?: string | null, end?: string | null) {
  if (!start) return "Fecha por confirmar";

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;

  if (Number.isNaN(startDate.getTime())) return "Fecha por confirmar";

  const sameDay =
    endDate &&
    !Number.isNaN(endDate.getTime()) &&
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  const startLabel = startDate.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const endLabel =
    endDate && !Number.isNaN(endDate.getTime())
      ? endDate.toLocaleString([], {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  if (!endLabel) return startLabel;

  if (sameDay) {
    return `${startLabel} — ${endDate!.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return `${startLabel} — ${endLabel}`;
}

function formatCreatedAt(value?: string | null) {
  if (!value) return "No disponible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatProposedDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function getStatusPresentation(invite: PublicInviteRow | null) {
  if (!invite) {
    return {
      label: "",
      description: "",
      tone: "neutral" as const,
    };
  }

  if (invite.status === "pending") {
    return {
      label: "Pendiente",
      description: "Todavía no se ha enviado una respuesta final.",
      tone: "pending" as const,
    };
  }

  if (invite.status === "accepted") {
    return {
      label: "Aceptado",
      description: "Este plan fue confirmado desde el link externo.",
      tone: "accepted" as const,
    };
  }

  if (invite.status === "rejected" && invite.proposed_date) {
    return {
      label: "Propuso nueva fecha",
      description:
        "El horario original fue rechazado, pero se sugirió una nueva opción.",
      tone: "proposed" as const,
    };
  }

  return {
    label: "Rechazado",
    description: "Este plan fue rechazado desde el link externo.",
    tone: "rejected" as const,
  };
}

function getStatusBadgeStyle(
  tone: "neutral" | "pending" | "accepted" | "rejected" | "proposed"
) {
  switch (tone) {
    case "pending":
      return {
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fcd34d",
      };
    case "accepted":
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #86efac",
      };
    case "rejected":
      return {
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      };
    case "proposed":
      return {
        background: "#e0e7ff",
        color: "#3730a3",
        border: "1px solid #c7d2fe",
      };
    default:
      return {
        background: "#e2e8f0",
        color: "#334155",
        border: "1px solid #cbd5e1",
      };
  }
}

async function trackPublicInviteEvent(input: {
  userId?: string | null;
  eventType: "invite_opened" | "invite_accepted" | "invite_declined";
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await trackEvent({
    event: input.eventType,
    userId: input.userId,
    entityId: input.entityId,
    metadata: input.metadata,
  });
}

export default function InviteClient({ token }: Props) {
  const [invite, setInvite] = useState<PublicInviteRow | null>(null);
  const [event, setEvent] = useState<PublicInviteEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState<
    "accepted" | "rejected" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [mode, setMode] = useState<ResponseMode>("idle");

  useEffect(() => {
    void trackScreenView({
      screen: "public_invite",
      metadata: { token_present: Boolean(token) },
    });
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/public-invite/${token}`, {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "No se pudo cargar la invitación.");
        }

        if (!cancelled) {
          const nextInvite = (json?.invite ?? null) as PublicInviteRow | null;
          const nextEvent = (json?.event ?? null) as PublicInviteEvent | null;

          setInvite(nextInvite);
          setEvent(nextEvent);
          setMessage(nextInvite?.message ?? "");
          setProposedDate(toDateTimeLocalValue(nextInvite?.proposed_date));
          setMode("idle");

          if (nextInvite) {
            await trackPublicInviteEvent({
              userId: null,
              eventType: "invite_opened",
              entityId: nextInvite.id ?? nextEvent?.id ?? null,
              metadata: {
                screen: "public_invite",
                source: "public_invite",
                invite_kind: "public_link",
                token_present: true,
                invite_id: nextInvite.id ?? null,
                event_id: nextInvite.event_id ?? nextEvent?.id ?? null,
                invite_status: nextInvite.status ?? null,
                contact: nextInvite.contact ?? null,
                has_message: Boolean(nextInvite.message),
                has_proposed_date: Boolean(nextInvite.proposed_date),
              },
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Ocurrió un error al cargar la invitación."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const statusInfo = useMemo(() => getStatusPresentation(invite), [invite]);

  const hasFinalResponse =
    invite?.status === "accepted" || invite?.status === "rejected";
  const proposedDateLabel = formatProposedDate(invite?.proposed_date);
  const canSubmit = !loading && !!invite && submittingAction === null;
  const canAccept = canSubmit;
  const canReject = canSubmit;
  const canSendProposal = canSubmit && proposedDate.trim().length > 0;

  const inviteeLabel = String(invite?.contact ?? "").trim() || "la persona invitada";
  const eventTitle = String(event?.title ?? "").trim() || "este plan";
  const hasSoftFinalState = invite?.status === "accepted" || invite?.status === "rejected";

  const headerMessage = useMemo(() => {
    if (invite?.status === "accepted") {
      return "Tu respuesta ya quedó guardada. Desde aquí ya no dependes de mensajes sueltos para dejar claro si vas o no vas.";
    }
    if (invite?.status === "rejected" && invite?.proposed_date) {
      return "Ya propusiste una alternativa. Ahora la otra persona podrá revisar una opción concreta en vez de seguir coordinando por fuera.";
    }
    if (invite?.status === "rejected") {
      return "Tu rechazo ya quedó guardado. Así el plan no queda ambiguo ni abierto a confusiones.";
    }
    return "Responde este plan sin tener cuenta y deja una sola respuesta clara para todos.";
  }, [invite?.status, invite?.proposed_date]);

  async function handleRespond(nextStatus: "accepted" | "rejected") {
    try {
      setSubmittingAction(nextStatus);
      setError(null);

      const payload = {
        status: nextStatus,
        message: message.trim() || null,
        proposedDate: null,
      };

      const res = await fetch(`/api/public-invite/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo responder la invitación.");
      }

      const updatedInvite = (json?.invite ?? null) as PublicInviteRow | null;
      setInvite(updatedInvite);
      setMessage(updatedInvite?.message ?? payload.message ?? "");
      setProposedDate(toDateTimeLocalValue(updatedInvite?.proposed_date));
      setMode("idle");

      if (updatedInvite) {
        await trackPublicInviteEvent({
          userId: null,
          eventType:
            nextStatus === "accepted" ? "invite_accepted" : "invite_declined",
          entityId: updatedInvite.id ?? event?.id ?? null,
          metadata: {
            screen: "public_invite",
            source: "public_invite",
            invite_kind: "public_link",
            token_present: true,
            invite_id: updatedInvite.id ?? null,
            event_id: updatedInvite.event_id ?? event?.id ?? null,
            invite_status: nextStatus,
            response_mode: nextStatus,
            contact: updatedInvite.contact ?? null,
            has_message: Boolean(payload.message),
            has_proposed_date: false,
          },
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al responder la invitación."
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handlePropose() {
    if (!proposedDate.trim()) {
      setError("Debes elegir una nueva fecha antes de enviarla.");
      return;
    }

    try {
      setSubmittingAction("rejected");
      setError(null);

      const payload = {
        status: "rejected" as const,
        message: message.trim() || null,
        proposedDate,
      };

      const res = await fetch(`/api/public-invite/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo enviar la propuesta.");
      }

      const updatedInvite = (json?.invite ?? null) as PublicInviteRow | null;
      setInvite(updatedInvite);
      setMessage(updatedInvite?.message ?? payload.message ?? "");
      setProposedDate(toDateTimeLocalValue(updatedInvite?.proposed_date));
      setMode("idle");

      if (updatedInvite) {
        await trackPublicInviteEvent({
          userId: null,
          eventType: "invite_declined",
          entityId: updatedInvite.id ?? event?.id ?? null,
          metadata: {
            screen: "public_invite",
            source: "public_invite",
            invite_kind: "public_link",
            token_present: true,
            invite_id: updatedInvite.id ?? null,
            event_id: updatedInvite.event_id ?? event?.id ?? null,
            invite_status: "rejected",
            response_mode: "propose_new_date",
            contact: updatedInvite.contact ?? null,
            has_message: Boolean(payload.message),
            has_proposed_date: Boolean(payload.proposedDate),
            proposed_date: payload.proposedDate,
          },
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al enviar la propuesta."
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(900px 520px at 10% -10%, rgba(99,102,241,0.12), transparent 48%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        padding: "24px 16px 48px",
      }}
    >
      <div
        style={{
          maxWidth: 620,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.94)",
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 24px 70px rgba(15,23,42,0.10)",
            border: "1px solid rgba(15,23,42,0.06)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.35,
                textTransform: "uppercase",
                color: "#6366f1",
                marginBottom: 8,
              }}
            >
              SyncPlans · respuesta externa
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 30,
                lineHeight: 1.06,
                color: "#0f172a",
                letterSpacing: "-0.03em",
              }}
            >
              Responde este plan sin coordinar por fuera
            </h1>

            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 15,
                lineHeight: 1.65,
                color: "#475569",
                maxWidth: 520,
              }}
            >
              {headerMessage}
            </p>
          </div>

          {loading ? (
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "#f8fafc",
                color: "#475569",
              }}
            >
              Cargando invitación...
            </div>
          ) : error ? (
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
              }}
            >
              {error}
            </div>
          ) : !invite ? (
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "#fff7ed",
                color: "#9a3412",
                border: "1px solid #fdba74",
              }}
            >
              Esta invitación ya no está disponible.
            </div>
          ) : (
            <>
              <section
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)",
                  border: "1px solid rgba(99,102,241,0.16)",
                  marginBottom: 16,
                  display: "grid",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      letterSpacing: 0.35,
                      textTransform: "uppercase",
                      color: "#6366f1",
                    }}
                  >
                    Plan compartido
                  </div>

                  <strong
                    style={{
                      display: "block",
                      color: "#0f172a",
                      fontSize: 20,
                      lineHeight: 1.25,
                    }}
                  >
                    {eventTitle}
                  </strong>

                  <div
                    style={{
                      color: "#475569",
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    {formatEventDate(event?.start, event?.end)}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 16,
                      padding: 12,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: 0.35,
                        textTransform: "uppercase",
                        color: "#64748b",
                        marginBottom: 6,
                      }}
                    >
                      Respuesta clara
                    </div>
                    <div
                      style={{
                        color: "#0f172a",
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      Lo que respondas aquí queda visible para la otra parte sin depender de mensajes sueltos.
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: 16,
                      padding: 12,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: 0.35,
                        textTransform: "uppercase",
                        color: "#64748b",
                        marginBottom: 6,
                      }}
                    >
                      Menos fricción
                    </div>
                    <div
                      style={{
                        color: "#0f172a",
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      Puedes aceptar, rechazar o proponer una nueva fecha desde el mismo enlace.
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: 16,
                      padding: 12,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: 0.35,
                        textTransform: "uppercase",
                        color: "#64748b",
                        marginBottom: 6,
                      }}
                    >
                      Sin cuenta
                    </div>
                    <div
                      style={{
                        color: "#0f172a",
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      Puedes responder ahora mismo aunque todavía no uses SyncPlans dentro de la app.
                    </div>
                  </div>
                </div>
              </section>

              <section
                style={{
                  borderRadius: 18,
                  padding: 18,
                  background: "#f8fafc",
                  border: "1px solid rgba(15,23,42,0.06)",
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <strong style={{ color: "#0f172a", fontSize: 16 }}>
                    Estado actual
                  </strong>

                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      ...getStatusBadgeStyle(statusInfo.tone),
                    }}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                <div
                  style={{
                    color: "#475569",
                    fontSize: 14,
                    lineHeight: 1.6,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div>{statusInfo.description}</div>

                  <div>
                    <strong style={{ color: "#0f172a" }}>Invitación enviada a:</strong>{" "}
                    {inviteeLabel}
                  </div>

                  <div>
                    <strong style={{ color: "#0f172a" }}>Creada:</strong>{" "}
                    {formatCreatedAt(invite.created_at)}
                  </div>

                  {invite.message ? (
                    <div>
                      <strong style={{ color: "#0f172a" }}>Último mensaje:</strong>{" "}
                      {invite.message}
                    </div>
                  ) : null}

                  {proposedDateLabel ? (
                    <div>
                      <strong style={{ color: "#0f172a" }}>Fecha propuesta:</strong>{" "}
                      {proposedDateLabel}
                    </div>
                  ) : null}
                </div>
              </section>

              <section
                style={{
                  borderRadius: 18,
                  padding: 16,
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.14)",
                  marginBottom: 18,
                  color: "#312e81",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {hasSoftFinalState ? (
                  invite?.status === "accepted" ? (
                    <span>
                      Ya confirmaste este plan. La otra parte ahora ve una respuesta clara y no tiene que volver a preguntarte por otro canal.
                    </span>
                  ) : invite?.proposed_date ? (
                    <span>
                      Ya propusiste una nueva fecha. Esto ayuda a convertir un “no puedo” en una alternativa concreta y más fácil de decidir.
                    </span>
                  ) : (
                    <span>
                      Ya rechazaste este plan. Eso evita que el evento quede ambiguo o que alguien asuma que sigues disponible.
                    </span>
                  )
                ) : (
                  <span>
                    Aquí no solo respondes. También dejas una sola versión clara de lo que pasará con este plan.
                  </span>
                )}
              </section>

              <section
                style={{
                  display: "grid",
                  gap: 14,
                  marginBottom: 18,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 8,
                    }}
                  >
                    Mensaje opcional
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ej: No puedo ese día, pero sí más tarde."
                    rows={4}
                    disabled={submittingAction !== null}
                    style={{
                      width: "100%",
                      borderRadius: 14,
                      border: "1px solid #cbd5e1",
                      padding: 12,
                      fontSize: 14,
                      outline: "none",
                      resize: "vertical",
                      boxSizing: "border-box",
                      background: "#fff",
                    }}
                  />
                </div>

                {mode === "propose" ? (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 8,
                      }}
                    >
                      Nueva fecha propuesta
                    </label>

                    <input
                      type="datetime-local"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      disabled={submittingAction !== null}
                      style={{
                        width: "100%",
                        borderRadius: 14,
                        border: "1px solid #cbd5e1",
                        padding: 12,
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                        background: "#fff",
                      }}
                    />

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: "#64748b",
                      }}
                    >
                      Esta acción rechaza el horario original y envía una alternativa concreta para seguir coordinando.
                    </div>
                  </div>
                ) : null}
              </section>

              {mode === "idle" ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void handleRespond("accepted")}
                    disabled={!canAccept}
                    style={{
                      border: "none",
                      borderRadius: 16,
                      padding: "14px 16px",
                      fontSize: 15,
                      fontWeight: 800,
                      background: "#0f172a",
                      color: "#fff",
                      cursor: canAccept ? "pointer" : "not-allowed",
                      opacity: canAccept ? 1 : 0.5,
                    }}
                  >
                    {submittingAction === "accepted" ? "Procesando..." : "Aceptar plan"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("propose");
                      setError(null);
                    }}
                    disabled={!canSubmit}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 16,
                      padding: "14px 16px",
                      fontSize: 15,
                      fontWeight: 800,
                      background: "#fff",
                      color: "#0f172a",
                      cursor: canSubmit ? "pointer" : "not-allowed",
                      opacity: canSubmit ? 1 : 0.7,
                    }}
                  >
                    Proponer fecha
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleRespond("rejected")}
                    disabled={!canReject}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 16,
                      padding: "14px 16px",
                      fontSize: 15,
                      fontWeight: 800,
                      background: "#fff",
                      color: "#0f172a",
                      cursor: canReject ? "pointer" : "not-allowed",
                      opacity: canReject ? 1 : 0.7,
                    }}
                  >
                    {submittingAction === "rejected" ? "Procesando..." : "Rechazar"}
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void handlePropose()}
                    disabled={!canSendProposal}
                    style={{
                      border: "none",
                      borderRadius: 16,
                      padding: "14px 16px",
                      fontSize: 15,
                      fontWeight: 800,
                      background: "#0f172a",
                      color: "#fff",
                      cursor: canSendProposal ? "pointer" : "not-allowed",
                      opacity: canSendProposal ? 1 : 0.5,
                    }}
                  >
                    {submittingAction === "rejected"
                      ? "Enviando..."
                      : "Enviar propuesta"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("idle");
                      setError(null);
                    }}
                    disabled={submittingAction !== null}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 16,
                      padding: "14px 16px",
                      fontSize: 15,
                      fontWeight: 800,
                      background: "#fff",
                      color: "#0f172a",
                      cursor:
                        submittingAction === null ? "pointer" : "not-allowed",
                      opacity: submittingAction === null ? 1 : 0.7,
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {hasFinalResponse ? (
                <div
                  style={{
                    marginTop: 18,
                    padding: 14,
                    borderRadius: 14,
                    background:
                      invite.status === "accepted"
                        ? "#f0fdf4"
                        : invite.proposed_date
                        ? "#eef2ff"
                        : "#fef2f2",
                    border:
                      invite.status === "accepted"
                        ? "1px solid #bbf7d0"
                        : invite.proposed_date
                        ? "1px solid #c7d2fe"
                        : "1px solid #fecaca",
                    color:
                      invite.status === "accepted"
                        ? "#166534"
                        : invite.proposed_date
                        ? "#3730a3"
                        : "#991b1b",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {invite.status === "accepted"
                    ? "Tu respuesta quedó guardada correctamente."
                    : invite.proposed_date
                    ? "Tu propuesta de nueva fecha quedó guardada correctamente."
                    : "Tu rechazo quedó guardado correctamente."}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}