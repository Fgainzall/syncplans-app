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
import { trackEvent, trackEventOnce, trackScreenView } from "@/lib/analytics";

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

function labelRole(role?: string | null) {
  const s = String(role ?? "member").toLowerCase();
  if (s === "owner") return "Owner";
  if (s === "admin") return "Admin";
  return "Miembro";
}

function getValueBullets(inv: GroupInvitation | null) {
  const type = String(inv?.group_type ?? "").toLowerCase();

  if (type === "pair" || type === "couple") {
    return [
      "Ambos ven el mismo contexto y dejan de coordinar desde mensajes sueltos.",
      "Los planes compartidos dejan de depender de interpretaciones distintas.",
      "Si algo ya choca con tu agenda, SyncPlans te lo muestra apenas entras.",
    ];
  }

  if (type === "family") {
    return [
      "Todos parten de la misma versión de lo que ya quedó acordado.",
      "Las agendas nuevas no se suman a ciegas: entran con contexto.",
      "Si hay cruces importantes, el sistema te lleva directo a revisarlos.",
    ];
  }

  return [
    "Entras al mismo espacio que ya están usando los demás.",
    "Los próximos planes dejan de quedar repartidos entre mensajes, memoria y supuestos.",
    "Si tu llegada genera un choque real, SyncPlans lo hace visible desde el inicio.",
  ];
}

function getHeroTitle(inv: GroupInvitation | null, pending: boolean) {
  const groupName = String(inv?.group_name ?? "").trim();

  if (!inv) return "Entra al mismo espacio que el resto";
  if (!pending) {
    return groupName
      ? `Ya tienes acceso a ${groupName}`
      : "Esta invitación ya fue respondida";
  }

  return groupName
    ? `Entra a ${groupName} sin coordinar desde fuera`
    : "Entra al mismo espacio que el resto";
}

function getHeroSubtitle(inv: GroupInvitation | null, pending: boolean) {
  const groupLabel = labelType(inv?.group_type);

  if (!inv) {
    return "Aceptar esta invitación te mete al mismo flujo, los mismos planes y las mismas decisiones que ya están moviendo los demás.";
  }

  if (!pending) {
    return "La invitación ya no está pendiente. Desde aquí puedes volver al grupo y seguir coordinando con el mismo contexto que el resto.";
  }

  return `Te están abriendo la puerta a un espacio ${groupLabel.toLowerCase()} compartido. Aceptar no es solo entrar: es dejar de depender de mensajes sueltos para entender qué sigue, qué cambió y qué ya quedó acordado.`;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

        setCurrentUserId(data.session.user.id);

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
    void trackScreenView({
      screen: "invitation_accept",
      userId: currentUserId ?? undefined,
      metadata: { area: "invitations", invite_id: inviteId },
    });
  }, [inviteId, currentUserId]);

  useEffect(() => {
    if (!inviteId || !inv) return;

    void trackEventOnce({
      event: "invite_opened",
      userId: currentUserId ?? undefined,
      entityId: inviteId,
      scope: "session",
      onceKey: `funnel:invite_opened:${inviteId}`,
      metadata: {
        screen: "invitation_accept",
        source: "invitation_accept",
        invite_kind: "group_internal",
        invite_id: inviteId,
        group_id: inv.group_id,
        group_type: inv.group_type ?? null,
        role: inv.role ?? null,
        status: String(inv.status ?? "pending").toLowerCase(),
      },
    });
  }, [inviteId, inv, currentUserId]);

  const status = String(inv?.status ?? "").toLowerCase();
  const pending = status === "pending";
  const hasPremium = hasPremiumAccess(profile);
  const shouldShowExternalNudge = !hasPremium && pending;
  const valueBullets = useMemo(() => getValueBullets(inv), [inv]);

  useEffect(() => {
    if (!shouldShowExternalNudge || !inviteId || !inv) return;

    void trackEventOnce({
      event: "premium_viewed",
      userId: currentUserId ?? undefined,
      entityId: inviteId,
      scope: "session",
      onceKey: `premium_viewed:invitation_accept:${inviteId}`,
      metadata: {
        screen: "invitation_accept",
        source: "invitation_accept_nudge",
        group_id: inv.group_id,
        group_type: inv.group_type ?? null,
        invite_kind: "group_internal",
      },
    });
  }, [shouldShowExternalNudge, inviteId, inv, currentUserId]);

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
        userId: currentUserId ?? undefined,
        entityId: inviteId,
        metadata: {
          screen: "invitation_accept",
          source: "invitation_accept",
          invite_kind: "group_internal",
          group_id: inv.group_id,
          group_type: inv.group_type ?? null,
          role: inv.role ?? null,
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
          title: "⚠️ Entraste y ya hay algo importante por revisar",
          subtitle: "Te llevo directo al choque para que tu llegada empiece con claridad, no con ruido.",
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
        title: "✅ Ya entraste al mismo contexto que el resto",
        subtitle: "Ahora te llevo al grupo para que veas los planes y lo que ya está en movimiento.",
      });

      navTimerRef.current = window.setTimeout(() => {
        router.push(
          `/groups/${encodeURIComponent(inv.group_id)}?accepted=1&from=invite_accept`
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
        userId: currentUserId ?? undefined,
        entityId: inviteId,
        metadata: {
          screen: "invitation_accept",
          source: "invitation_accept",
          invite_kind: "group_internal",
          group_id: inv.group_id,
          group_type: inv.group_type ?? null,
          role: inv.role ?? null,
        },
      });

      setInv((prev) => (prev ? { ...prev, status: "declined" as any } : prev));

      showToast({
        title: "Invitación rechazada",
        subtitle: "No te agregamos al grupo. Puedes volver a tus grupos cuando quieras.",
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
            flexWrap: "wrap",
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
                fontSize: 28,
                letterSpacing: "-0.7px",
                lineHeight: 1.08,
                maxWidth: 760,
              }}
            >
              {getHeroTitle(inv, pending)}
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
                    opacity: 0.76,
                    fontSize: 14,
                    lineHeight: 1.55,
                    maxWidth: 760,
                  }}
                >
                  {getHeroSubtitle(inv, pending)}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 20 }}>
                        {inv.group_name || "Grupo"}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          opacity: 0.75,
                          fontSize: 13,
                          lineHeight: 1.45,
                        }}
                      >
                        Entrar aquí te suma a un espacio <b>{labelType(inv.group_type).toLowerCase()}</b> como <b>{labelRole(inv.role)}</b>.
                        {pending
                          ? " Si aceptas hoy, este grupo quedará activo para que empieces a ver lo mismo que los demás desde ya."
                          : " Desde aquí ya puedes volver al grupo y seguir coordinando dentro del mismo contexto compartido."}
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
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  {valueBullets.map((item) => (
                    <div
                      key={item}
                      style={{
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.03)",
                        padding: "13px 12px",
                        fontSize: 12.5,
                        lineHeight: 1.52,
                        fontWeight: 800,
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>

                {pending ? (
                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.09)",
                      background: "rgba(255,255,255,0.03)",
                      padding: 14,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontWeight: 900,
                        opacity: 0.76,
                      }}
                    >
                      Qué pasa después de aceptar
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>
                      No te soltamos en una pantalla fría.
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.78, lineHeight: 1.55 }}>
                      Si al entrar ya existe un choque importante, te llevamos directo a revisarlo. Si no, entras al grupo para ver el contexto compartido y empezar a coordinar desde dentro.
                    </div>
                  </div>
                ) : null}

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
                      Entrar al grupo resuelve el acceso. Premium mejora lo que pasa después: más claridad compartida, menos fricción y mejor anticipación cuando la coordinación crece.
                    </div>

                    <div style={{ fontSize: 13, opacity: 0.78, lineHeight: 1.55 }}>
                      Es la capa que hace que una nueva persona no entre a interpretar a ciegas qué cambió, qué choca y qué merece atención primero.
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
                      <div>• Da más contexto cuando la coordinación deja de ser individual.</div>
                      <div>• Reduce el esfuerzo de interpretar manualmente qué pasó.</div>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          void trackEvent({
                            event: "premium_cta_clicked",
                            userId: currentUserId ?? undefined,
                            entityId: inviteId || undefined,
                            metadata: {
                              screen: "invitation_accept",
                              source: "external_nudge",
                              target: "/planes",
                              invite_kind: "group_internal",
                              group_id: inv?.group_id ?? null,
                              group_type: inv?.group_type ?? null,
                            },
                          });
                          router.push("/planes");
                        }}
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
                        Ver cómo ayuda
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

                {!pending ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                      fontSize: 13,
                      lineHeight: 1.55,
                      opacity: 0.82,
                    }}
                  >
                    {status === "accepted"
                      ? "Ya formas parte de este grupo. Vuelve a entrar para seguir coordinando con el mismo contexto que los demás."
                      : "Esta invitación ya no está pendiente. Puedes volver a tus grupos cuando quieras."}
                  </div>
                ) : null}

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
                      minWidth: 260,
                      opacity: pending ? 1 : 0.55,
                    }}
                    title={!pending ? "Esta invitación ya no está pendiente" : ""}
                  >
                    {busy === "accept" ? "Aceptando…" : "Aceptar y entrar al grupo"}
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