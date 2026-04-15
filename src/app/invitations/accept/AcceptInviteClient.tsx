// src/app/invitations/accept/AcceptInviteClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createConflictNotificationForGroup } from "@/lib/notificationsDb";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import supabase from "@/lib/supabaseClient";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";

import {
  acceptInvitation,
  declineInvitation,
  getInvitationById,
  type GroupInvitation,
} from "@/lib/invitationsDb";
import { getMyProfile, type Profile } from "@/lib/profilesDb";
import { hasPremiumAccess } from "@/lib/premium";
import { trackEvent, trackScreenView } from "@/lib/analytics";

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x
  );
}

function labelType(t?: string | null) {
  const s = String(t ?? "").toLowerCase();
  if (s === "pair" || s === "couple") return "Pareja";
  if (s === "family") return "Familia";
  if (s === "solo" || s === "personal") return "Personal";
  if (s === "other" || s === "shared") return "Compartido";
  return t ? String(t) : "Grupo";
}

function StatusPill({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const meta =
    s === "pending"
      ? {
          label: "Pendiente",
          bg: "rgba(251,191,36,0.16)",
          bd: "rgba(251,191,36,0.28)",
        }
      : s === "accepted"
      ? {
          label: "Aceptada",
          bg: "rgba(34,197,94,0.14)",
          bd: "rgba(34,197,94,0.28)",
        }
      : s === "declined"
      ? {
          label: "Rechazada",
          bg: "rgba(248,113,113,0.14)",
          bd: "rgba(248,113,113,0.28)",
        }
      : {
          label: status || "Estado",
          bg: "rgba(255,255,255,0.08)",
          bd: "rgba(255,255,255,0.12)",
        };

  const dot =
    s === "pending"
      ? "rgba(251,191,36,0.95)"
      : s === "accepted"
      ? "rgba(34,197,94,0.95)"
      : s === "declined"
      ? "rgba(248,113,113,0.95)"
      : "rgba(255,255,255,0.7)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${meta.bd}`,
        background: meta.bg,
        fontSize: 12,
        fontWeight: 900,
        opacity: 0.95,
      }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: 999, background: dot }}
      />
      {meta.label}
    </span>
  );
}

function Glow() {
  return (
    <div
      style={{
        position: "absolute",
        inset: -2,
        borderRadius: 18,
        background:
          "radial-gradient(600px 240px at 18% 0%, rgba(248,113,113,0.18), transparent 55%), radial-gradient(520px 240px at 88% 20%, rgba(96,165,250,0.18), transparent 55%), radial-gradient(520px 240px at 40% 120%, rgba(251,191,36,0.14), transparent 55%)",
        filter: "blur(14px)",
        pointerEvents: "none",
        opacity: 0.95,
      }}
    />
  );
}

export default function AcceptInviteClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const inviteId = useMemo(
    () => sp.get("invite") || sp.get("inviteId") || "",
    [sp]
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [inv, setInv] = useState<GroupInvitation | null>(null);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(
    null
  );
  const [profile, setProfile] = useState<Profile | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const navTimerRef = useRef<number | null>(null);

  function clearTimers() {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (navTimerRef.current) {
      window.clearTimeout(navTimerRef.current);
      navTimerRef.current = null;
    }
  }

  function showToast(t: { title: string; subtitle?: string }) {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(t);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2600);
  }

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!inviteId || !isUuid(inviteId)) {
          setInv(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setLoading(true);

        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          const next = encodeURIComponent(
            window.location.pathname + window.location.search
          );
          router.replace(`/auth/login?next=${next}`);
          return;
        }

        const [r, fetchedProfile] = await Promise.all([
          getInvitationById(inviteId),
          getMyProfile().catch(() => null),
        ]);

        if (!alive) return;

        setInv(r ?? null);
        setProfile(fetchedProfile ?? null);
      } catch (e: any) {
        if (!alive) return;
        setInv(null);
        setProfile(null);
        showToast({
          title: "No se pudo cargar la invitación",
          subtitle: e?.message || "Intenta otra vez.",
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [inviteId, router]);

  useEffect(() => {
    if (!inviteId) return;
    void trackScreenView({ screen: "invitation_accept", metadata: { area: "invitations", invite_id: inviteId } });
  }, [inviteId]);

  const status = String(inv?.status ?? "").toLowerCase();
  const pending = status === "pending";
  const hasPremium = hasPremiumAccess(profile);
  const shouldShowExternalNudge = !hasPremium && pending;

  async function onAccept() {
    if (!inviteId || !inv || busy) return;

    setBusy("accept");

    try {
      const res = await acceptInvitation(inviteId);
      if (!res?.ok) {
        throw new Error(res?.error || "No se pudo aceptar.");
      }

      void trackEvent({
        event: "invite_accepted",
        entityId: inviteId,
        metadata: {
          screen: "invitation_accept",
          source: "invitation_accept",
          group_id: inv.group_id,
          group_type: inv.group_type ?? null,
        },
      });

      setInv((prev) => (prev ? { ...prev, status: "accepted" as any } : prev));

      try {
        await setActiveGroupIdInDb(inv.group_id);
      } catch {
        // best-effort
      }

      try {
        window.dispatchEvent(
          new CustomEvent("sp:invite-accepted", {
            detail: { groupId: inv.group_id, inviteId },
          })
        );
      } catch {
        // ignore
      }

      const conflictResult = await createConflictNotificationForGroup(
        inv.group_id
      ).catch(() => ({
        created: 0,
        conflictCount: 0,
        targetEventId: null,
      }));

      if (conflictResult.conflictCount > 0) {
        showToast({
          title: "⚠️ Entraste justo donde ya hay choques por revisar",
          subtitle: "Te llevo directo para que la llegada no se quede a medias.",
        });

        const qp = new URLSearchParams();
        if (conflictResult.targetEventId) {
          qp.set("eventId", conflictResult.targetEventId);
        }
        qp.set("from", "invite_accept");
        qp.set("groupId", inv.group_id);

        navTimerRef.current = window.setTimeout(() => {
          router.push(`/conflicts/detected?${qp.toString()}`);
        }, 700);

        return;
      }

      showToast({
        title: "✅ Ya entraste al mismo espacio",
        subtitle: "Desde aquí ya no dependes de mensajes sueltos para entender qué quedó acordado.",
      });

      navTimerRef.current = window.setTimeout(() => {
        router.push(
          `/groups?joined=${encodeURIComponent(
            inv.group_id
          )}&accepted=1&activeGroup=${encodeURIComponent(inv.group_id)}`
        );
      }, 700);
    } catch (e: any) {
      showToast({
        title: "No se pudo aceptar",
        subtitle: e?.message || "Intenta otra vez.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function onDecline() {
    if (!inviteId || !inv || busy) return;

    setBusy("decline");
    try {
      const res = await declineInvitation(inviteId);
      if (!res?.ok) throw new Error(res?.error || "No se pudo rechazar.");

      void trackEvent({
        event: "invite_declined",
        entityId: inviteId,
        metadata: {
          screen: "invitation_accept",
          source: "invitation_accept",
          group_id: inv.group_id,
          group_type: inv.group_type ?? null,
        },
      });

      setInv((prev) => (prev ? { ...prev, status: "declined" as any } : prev));

      showToast({
        title: "Invitación rechazada",
        subtitle: "No se agregó el grupo.",
      });

      navTimerRef.current = window.setTimeout(() => {
        router.push("/groups?declined=1");
      }, 700);
    } catch (e: any) {
      showToast({
        title: "No se pudo rechazar",
        subtitle: e?.message || "Intenta otra vez.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1100px 600px at 10% -10%, rgba(248,113,113,0.16), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(96,165,250,0.14), transparent 60%), #050816",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      {toast && (
        <div style={{ position: "fixed", top: 18, right: 18, zIndex: 50 }}>
          <div
            style={{
              minWidth: 260,
              maxWidth: 380,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(7,11,22,0.72)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
              backdropFilter: "blur(14px)",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 13 }}>{toast.title}</div>
            {toast.subtitle ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  opacity: 0.75,
                  fontWeight: 650,
                }}
              >
                {toast.subtitle}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "22px 18px 56px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <PremiumHeader />
          <LogoutButton />
        </div>

        <section
          style={{
            position: "relative",
            marginTop: 14,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
            padding: 16,
            boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          <Glow />

          <div style={{ position: "relative" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                fontWeight: 900,
                opacity: 0.8,
              }}
            >
              Segundo usuario
            </div>

            <h1
              style={{
                margin: "10px 0 6px",
                fontSize: 26,
                letterSpacing: "-0.6px",
              }}
            >
              Entra al mismo espacio que el resto
            </h1>

            {!inviteId || !isUuid(inviteId) ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px dashed rgba(255,255,255,0.16)",
                }}
              >
                <div style={{ fontWeight: 900 }}>Link inválido</div>
                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                  Falta el parámetro <b>?invite=UUID</b>.
                </div>

                <button
                  onClick={() => router.push("/groups")}
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.95)",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Ir a grupos
                </button>
              </div>
            ) : loading ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px dashed rgba(255,255,255,0.16)",
                  opacity: 0.75,
                }}
              >
                Cargando invitación…
              </div>
            ) : !inv ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(248,113,113,0.22)",
                  background: "rgba(248,113,113,0.08)",
                }}
              >
                <div style={{ fontWeight: 900 }}>Invitación no encontrada</div>
                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                  Puede que haya expirado, ya fue aceptada, o no tienes acceso.
                </div>

                <button
                  onClick={() => router.push("/groups")}
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.95)",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Ir a grupos
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginTop: 10,
                    opacity: 0.72,
                    fontSize: 13,
                    lineHeight: 1.45,
                    maxWidth: 700,
                  }}
                >
                  Aceptar esta invitación no solo te deja entrar. Hace que empieces a ver el mismo grupo, los mismos planes y las mismas decisiones que ya están moviendo los demás.
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  }}
                >
                  {[
                    "Ves el mismo contexto que el resto",
                    "Los próximos planes dejan de quedar en el aire",
                    "Si ya existe un choque, te llevamos directo a resolverlo",
                  ].map((item) => (
                    <div
                      key={item}
                      style={{
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.03)",
                        padding: "12px 12px",
                        fontSize: 12,
                        lineHeight: 1.45,
                        fontWeight: 800,
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>

                {shouldShowExternalNudge ? (
                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: 18,
                      border: "1px solid rgba(56,189,248,0.25)",
                      background:
                        "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(124,58,237,0.10))",
                      padding: 14,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        opacity: 0.8,
                      }}
                    >
                      Premium
                    </div>

                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      Aceptar una invitación es solo el inicio. El valor real aparece cuando ambos empiezan a decidir y responder dentro.
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.78, lineHeight: 1.55 }}>
                      Premium te ayuda a convertir esta nueva coordinación en una sola verdad compartida, con más contexto para anticipar choques, menos fricción para decidir y una llegada mucho más clara para cada persona que entra.
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 6,
                        marginTop: 2,
                        fontSize: 12,
                        opacity: 0.78,
                      }}
                    >
                      <div>• Anticipa conflictos cuando entra una agenda nueva.</div>
                      <div>• Da más claridad cuando entra una persona nueva y la coordinación se vuelve compartida.</div>
                      <div>• Evita interpretar manualmente qué cambió y qué no.</div>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={() => { void trackEvent({ event: "premium_cta_clicked", metadata: { screen: "invitation_accept", source: "external_nudge", target: "/planes" } }); router.push("/planes"); }}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background:
                            "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
                          color: "white",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        Entender cómo funciona
                      </button>

                      <button
                        onClick={() => router.push("/groups")}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(255,255,255,0.04)",
                          color: "white",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        Seguir por ahora
                      </button>
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 950,
                          fontSize: 18,
                        }}
                      >
                        {inv.group_name || "Grupo"}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          opacity: 0.75,
                          fontSize: 13,
                        }}
                      >
                        Tipo: <b>{labelType(inv.group_type)}</b> · Rol: <b>{inv.role || "member"}</b>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <StatusPill status={status || "pending"} />
                    </div>
                  </div>

                  {!pending ? (
                    <div
                      style={{
                        marginTop: 10,
                        opacity: 0.75,
                        fontSize: 12,
                      }}
                    >
                      Esta invitación ya no está pendiente. Puedes volver a tus grupos y seguir activando la coordinación desde ahí.
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: 10,
                        opacity: 0.75,
                        fontSize: 12,
                      }}
                    >
                      Al aceptar, este grupo quedará activo y SyncPlans revisará si sus eventos chocan con tu agenda actual para que la llegada de esta nueva coordinación no se quede a medias.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 14,
                  }}
                >
                  <button
                    onClick={() => router.push("/groups")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.92)",
                      cursor: "pointer",
                      fontWeight: 900,
                      minWidth: 220,
                    }}
                  >
                    ← Volver
                  </button>

                  <button
                    onClick={onDecline}
                    disabled={!!busy || !pending}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(248,113,113,0.14)",
                      color: "rgba(255,255,255,0.95)",
                      cursor: !!busy || !pending ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      minWidth: 220,
                      opacity: pending ? 1 : 0.55,
                    }}
                    title={!pending ? "Esta invitación ya no está pendiente" : ""}
                  >
                    {busy === "decline" ? "Rechazando…" : "Rechazar"}
                  </button>

                  <button
                    onClick={onAccept}
                    disabled={!!busy || !pending}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background:
                        "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
                      color: "rgba(255,255,255,0.95)",
                      cursor: !!busy || !pending ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      minWidth: 220,
                      opacity: pending ? 1 : 0.55,
                    }}
                    title={!pending ? "Esta invitación ya no está pendiente" : ""}
                  >
                    {busy === "accept" ? "Aceptando…" : "Aceptar y entrar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}