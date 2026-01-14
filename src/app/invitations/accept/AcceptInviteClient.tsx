"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  acceptInvitation,
  declineInvitation,
  getInvitationById,
  type GroupInvitation,
} from "@/lib/invitationsDb";

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
  return t ? String(t) : "Grupo";
}

function StatusPill({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const meta =
    s === "pending"
      ? { label: "Pendiente", bg: "rgba(251,191,36,0.16)", bd: "rgba(251,191,36,0.28)" }
      : s === "accepted"
      ? { label: "Aceptada", bg: "rgba(34,197,94,0.14)", bd: "rgba(34,197,94,0.28)" }
      : s === "declined"
      ? { label: "Rechazada", bg: "rgba(248,113,113,0.14)", bd: "rgba(248,113,113,0.28)" }
      : { label: status || "Estado", bg: "rgba(255,255,255,0.08)", bd: "rgba(255,255,255,0.12)" };

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
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: dot,
        }}
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

  const inviteId = useMemo(() => sp.get("invite") || sp.get("inviteId") || "", [sp]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const [inv, setInv] = useState<GroupInvitation | null>(null);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(null);

  function showToast(t: { title: string; subtitle?: string }) {
    setToast(t);
    window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!inviteId || !isUuid(inviteId)) {
          setInv(null);
          return;
        }

        setLoading(true);
        const r = await getInvitationById(inviteId);
        if (!alive) return;
        setInv(r ?? null);
      } catch (e: any) {
        if (!alive) return;
        setInv(null);
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
  }, [inviteId]);

  const status = String(inv?.status ?? "").toLowerCase();
  const pending = status === "pending";

  async function onAccept() {
    if (!inviteId || !inv) return;

    setBusy("accept");
    try {
      const res = await acceptInvitation(inviteId);
      if (!res?.ok) throw new Error(res?.error || "No se pudo aceptar.");

      showToast({ title: "✅ Invitación aceptada", subtitle: "Ya eres parte del grupo." });
      setInv((prev) => (prev ? { ...prev, status: "accepted" as any } : prev));
      window.setTimeout(() => router.push("/groups"), 700);
    } catch (e: any) {
      showToast({ title: "No se pudo aceptar", subtitle: e?.message || "Intenta otra vez." });
    } finally {
      setBusy(null);
    }
  }

  async function onDecline() {
    if (!inviteId || !inv) return;

    setBusy("decline");
    try {
      const res = await declineInvitation(inviteId);
      if (!res?.ok) throw new Error(res?.error || "No se pudo rechazar.");

      showToast({ title: "Invitación rechazada", subtitle: "No se agregó el grupo." });
      setInv((prev) => (prev ? { ...prev, status: "declined" as any } : prev));
      window.setTimeout(() => router.push("/groups"), 700);
    } catch (e: any) {
      showToast({ title: "No se pudo rechazar", subtitle: e?.message || "Intenta otra vez." });
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
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75, fontWeight: 650 }}>
                {toast.subtitle}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "22px 18px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
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
              Invitación
            </div>

            <h1 style={{ margin: "10px 0 6px", fontSize: 26, letterSpacing: "-0.6px" }}>
              Aceptar invitación
            </h1>

            {!inviteId || !isUuid(inviteId) ? (
              <div style={{ marginTop: 12, padding: 14, borderRadius: 14, border: "1px dashed rgba(255,255,255,0.16)" }}>
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
                <div style={{ marginTop: 10, opacity: 0.72, fontSize: 13, lineHeight: 1.45, maxWidth: 700 }}>
                  Estás a un click de sincronizar calendarios.
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 18 }}>{inv.group_name || "Grupo"}</div>
                      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
                        Tipo: <b>{labelType(inv.group_type)}</b> · Rol: <b>{inv.role || "member"}</b>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <StatusPill status={status || "pending"} />
                    </div>
                  </div>

                  {!pending ? (
                    <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                      Esta invitación ya no está pendiente. Puedes volver a tus grupos.
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                      Al aceptar, el grupo aparecerá en <b>/groups</b> y podrás ver sus eventos en modo Pareja/Familia.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
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
                      background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
                      color: "rgba(255,255,255,0.95)",
                      cursor: !!busy || !pending ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      minWidth: 220,
                      opacity: pending ? 1 : 0.55,
                    }}
                    title={!pending ? "Esta invitación ya no está pendiente" : ""}
                  >
                    {busy === "accept" ? "Aceptando…" : "Aceptar invitación"}
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
