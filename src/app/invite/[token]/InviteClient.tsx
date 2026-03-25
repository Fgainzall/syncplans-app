"use client";

import { useEffect, useMemo, useState } from "react";

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

function formatEventDate(start?: string | null, end?: string | null) {
  if (!start) return "Fecha por confirmar";

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;

  const sameDay =
    endDate &&
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  const startLabel = startDate.toLocaleString();
  const endLabel = endDate ? endDate.toLocaleString() : null;

  if (!endLabel) return startLabel;
  if (sameDay) return `${startLabel} — ${endDate!.toLocaleTimeString()}`;

  return `${startLabel} — ${endLabel}`;
}

export default function InviteClient({ token }: Props) {
  const [invite, setInvite] = useState<PublicInviteRow | null>(null);
  const [event, setEvent] = useState<PublicInviteEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [proposedDate, setProposedDate] = useState("");

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
          setInvite(json.invite ?? null);
          setEvent(json.event ?? null);
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

  const statusLabel = useMemo(() => {
    if (!invite) return "";
    if (invite.status === "accepted") return "Aceptada";
    if (invite.status === "rejected") return "Rechazada";
    return "Pendiente";
  }, [invite]);

  async function handleRespond(nextStatus: "accepted" | "rejected") {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/public-invite/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
          message: message.trim() || null,
          proposedDate: proposedDate || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "No se pudo responder la invitación.");
      }

      setInvite(json.invite ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al responder la invitación."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background:
          "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)",
        padding: "24px 16px 40px",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 20px 60px rgba(15,23,42,0.10)",
            border: "1px solid rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: "uppercase",
                color: "#64748b",
                marginBottom: 8,
              }}
            >
              SyncPlans
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 28,
                lineHeight: 1.1,
                color: "#0f172a",
              }}
            >
              Invitación externa
            </h1>

            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 15,
                lineHeight: 1.6,
                color: "#475569",
              }}
            >
              Responde esta invitación aunque no tengas cuenta dentro de la app.
            </p>
          </div>

          {loading ? (
            <div
              style={{
                padding: 18,
                borderRadius: 16,
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
                borderRadius: 16,
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
                borderRadius: 16,
                background: "#fff7ed",
                color: "#9a3412",
                border: "1px solid #fdba74",
              }}
            >
              No encontramos esta invitación.
            </div>
          ) : (
            <>
              {event ? (
                <section
                  style={{
                    borderRadius: 18,
                    padding: 18,
                    background: "#eef2ff",
                    border: "1px solid rgba(99,102,241,0.18)",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: 0.3,
                      textTransform: "uppercase",
                      color: "#6366f1",
                      marginBottom: 8,
                    }}
                  >
                    Evento
                  </div>

                  <strong
                    style={{
                      display: "block",
                      color: "#0f172a",
                      fontSize: 18,
                      lineHeight: 1.3,
                    }}
                  >
                    {event.title || "Evento sin título"}
                  </strong>

                  <div
                    style={{
                      marginTop: 8,
                      color: "#475569",
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    {formatEventDate(event.start, event.end)}
                  </div>
                </section>
              ) : null}

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
                    marginBottom: 10,
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
                      fontWeight: 700,
                      background:
                        invite.status === "accepted"
                          ? "#dcfce7"
                          : invite.status === "rejected"
                          ? "#fee2e2"
                          : "#e2e8f0",
                      color:
                        invite.status === "accepted"
                          ? "#166534"
                          : invite.status === "rejected"
                          ? "#991b1b"
                          : "#334155",
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
                  <div>
                    <strong>Token:</strong> {invite.token}
                  </div>
                  <div>
                    <strong>Contacto:</strong> {invite.contact || "No especificado"}
                  </div>
                  <div>
                    <strong>Creada:</strong>{" "}
                    {new Date(invite.created_at).toLocaleString()}
                  </div>
                </div>
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
                    placeholder="Ej: No puedo ese día, ¿podría ser más tarde?"
                    rows={4}
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
                    Proponer otra fecha (opcional)
                  </label>
                  <input
                    type="datetime-local"
                    value={proposedDate}
                    onChange={(e) => setProposedDate(e.target.value)}
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
                </div>
              </section>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => void handleRespond("accepted")}
                  disabled={submitting}
                  style={{
                    border: "none",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                    fontWeight: 700,
                    background: "#0f172a",
                    color: "#fff",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Procesando..." : "Aceptar"}
                </button>

                <button
                  type="button"
                  onClick={() => void handleRespond("rejected")}
                  disabled={submitting}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                    fontWeight: 700,
                    background: "#fff",
                    color: "#0f172a",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Procesando..." : "Rechazar"}
                </button>
              </div>

              {invite.message ? (
                <div
                  style={{
                    marginTop: 18,
                    padding: 14,
                    borderRadius: 14,
                    background: "#f8fafc",
                    border: "1px solid rgba(15,23,42,0.06)",
                    color: "#475569",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "#0f172a" }}>Último mensaje:</strong>
                  <div style={{ marginTop: 6 }}>{invite.message}</div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}