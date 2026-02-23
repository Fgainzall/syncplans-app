// src/app/groups/invite/GroupInviteClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { inviteToGroup } from "@/lib/invitationsDb";
import { fetchMyGroups, type GroupRow } from "@/lib/groupsStore";

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

function Glow() {
  return (
    <div
      style={{
        position: "absolute",
        inset: -2,
        borderRadius: 18,
        background:
          "radial-gradient(600px 240px at 20% 0%, rgba(56,189,248,0.22), transparent 55%), radial-gradient(520px 240px at 90% 20%, rgba(124,58,237,0.18), transparent 55%), radial-gradient(520px 240px at 40% 120%, rgba(248,113,113,0.14), transparent 55%)",
        filter: "blur(14px)",
        pointerEvents: "none",
        opacity: 0.9,
      }}
    />
  );
}

export default function GroupInviteClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const groupIdFromUrl = useMemo(() => sp.get("groupId") || "", [sp]);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(groupIdFromUrl);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(
    null
  );

  // ✅ Premium: link visible + copiar manual
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function showToast(t: { title: string; subtitle?: string }) {
    setToast(t);
    window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingGroups(true);
      try {
        const g = await fetchMyGroups();
        if (!alive) return;

        setGroups(g);

        if (!selectedGroupId && g.length) {
          setSelectedGroupId(g[0].id);
        }
      } catch (e: any) {
        showToast({
          title: "No se pudieron cargar grupos",
          subtitle: e?.message || "Intenta otra vez.",
        });
      } finally {
        if (alive) setLoadingGroups(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const emailOk = useMemo(() => isValidEmail(email), [email]);

  const canInvite =
    !busy && !!selectedGroupId && isUuid(selectedGroupId) && emailOk;

  async function copyLink(link: string) {
    setCopied(false);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showToast({
        title: "Copiado ✅",
        subtitle: "Listo. Pégalo en WhatsApp / iMessage.",
      });
    } catch {
      showToast({
        title: "No pude copiar automático",
        subtitle: "Copia el link manualmente (abajo).",
      });
    }
  }

  async function onInvite() {
    if (!canInvite) {
      showToast({
        title: "Revisa",
        subtitle: "Elige grupo y escribe un email válido.",
      });
      return;
    }

    setBusy(true);
    try {
      const res = await inviteToGroup({
        groupId: selectedGroupId,
        email: email.trim(),
        role,
      });

      if (!res?.ok) {
        const msg = (res?.error || "No se pudo crear la invitación.").toString();

        // errores humanos típicos
        const lower = msg.toLowerCase();
        if (lower.includes("already") || lower.includes("duplicate")) {
          throw new Error("Ese email ya está invitado (o ya es miembro).");
        }
        if (lower.includes("permission") || lower.includes("rls")) {
          throw new Error("No tienes permisos para invitar a este grupo.");
        }
        throw new Error(msg);
      }

      const inviteId = res.invite_id || res.id;
      const invitedEmail = (res.invited_email || email.trim().toLowerCase()).toString();

      const link = inviteId
        ? `${window.location.origin}/invitations/accept?invite=${inviteId}`
        : null;

      setEmail("");
      setInviteLink(link);
      setCopied(false);

      showToast({
        title: "✅ Invitación creada",
        subtitle: `A: ${invitedEmail}${link ? " · Link listo" : ""}`,
      });

      if (link) {
        // intentamos copiar automáticamente, pero igual lo mostramos siempre
        await copyLink(link);
      }
    } catch (e: any) {
      showToast({
        title: "No se pudo invitar",
        subtitle: e?.message || "Intenta otra vez.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
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

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "22px 18px 56px" }}>
        {/* 🔹 Header premium consistente con el resto de la app */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <PremiumHeader
            title="Invitar a grupo"
            subtitle="Envía una invitación para que alguien se una al grupo correcto."
          />
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
              Invitar a grupo
            </div>

            <h1
              style={{ margin: "10px 0 6px", fontSize: 26, letterSpacing: "-0.6px" }}
            >
              Comparte tu calendario sin fricción
            </h1>

            <div
              style={{
                opacity: 0.72,
                fontSize: 13,
                lineHeight: 1.45,
                maxWidth: 650,
              }}
            >
              Envía una invitación. La otra persona acepta y se vuelve miembro
              del grupo automáticamente (con RLS seguro).
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {/* Grupo */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>
                  Grupo
                </div>

                {loadingGroups ? (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: "1px dashed rgba(255,255,255,0.16)",
                      opacity: 0.75,
                    }}
                  >
                    Cargando grupos…
                  </div>
                ) : groups.length === 0 ? (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: "1px dashed rgba(255,255,255,0.16)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>No tienes grupos</div>
                    <div
                      style={{
                        opacity: 0.75,
                        fontSize: 12,
                        marginTop: 6,
                      }}
                    >
                      Crea uno para poder invitar.
                    </div>

                    <button
                      onClick={() => router.push("/groups/new")}
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background:
                          "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
                        color: "rgba(255,255,255,0.95)",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Crear grupo
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(6,10,20,0.55)",
                        color: "rgba(255,255,255,0.92)",
                        outline: "none",
                        fontSize: 14,
                      }}
                    >
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}{" "}
                          (
                          {g.type === "family"
                            ? "Familia"
                            : g.type === "pair"
                            ? "Pareja"
                            : g.type}
                          )
                        </option>
                      ))}
                    </select>

                    {selected ? (
                      <div style={{ fontSize: 12, opacity: 0.72 }}>
                        Seleccionado: <b>{selected.name}</b> · tipo{" "}
                        <b>
                          {selected.type === "family"
                            ? "Familia"
                            : selected.type === "pair"
                            ? "Pareja"
                            : selected.type}
                        </b>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              {/* Email */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>
                  Email
                </div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej: ara@gmail.com"
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 14,
                    border: `1px solid ${
                      email.length === 0
                        ? "rgba(255,255,255,0.10)"
                        : emailOk
                        ? "rgba(34,197,94,0.40)"
                        : "rgba(248,113,113,0.45)"
                    }`,
                    background: "rgba(6,10,20,0.55)",
                    color: "rgba(255,255,255,0.92)",
                    outline: "none",
                    fontSize: 14,
                  }}
                />
                {email.length > 0 && !emailOk ? (
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.75,
                      color: "rgba(248,113,113,0.95)",
                    }}
                  >
                    Email inválido
                  </div>
                ) : null}
              </div>

              {/* Rol */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>
                  Rol
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setRole("member")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background:
                        role === "member"
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.92)",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Miembro
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background:
                        role === "admin"
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.92)",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Admin
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                <button
                  type="button"
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
                  type="button"
                  onClick={onInvite}
                  disabled={!canInvite}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background:
                      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
                    color: "rgba(255,255,255,0.95)",
                    cursor: canInvite ? "pointer" : "not-allowed",
                    fontWeight: 900,
                    minWidth: 220,
                    opacity: canInvite ? 1 : 0.55,
                  }}
                >
                  {busy ? "Enviando…" : "Enviar invitación"}
                </button>
              </div>

              {/* Link premium */}
              {inviteLink ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.22)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.8,
                      fontWeight: 900,
                    }}
                  >
                    Link de invitación
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      fontFamily: "ui-monospace",
                      wordBreak: "break-all",
                      opacity: 0.95,
                      lineHeight: 1.4,
                    }}
                  >
                    {inviteLink}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => copyLink(inviteLink)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.95)",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {copied ? "Copiado ✅" : "Copiar link"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInviteLink(null);
                        setCopied(false);
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.92)",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 10,
                    opacity: 0.6,
                    fontSize: 12,
                  }}
                >
                  Tip: el link se arma así:{" "}
                  <span style={{ marginLeft: 6, fontFamily: "ui-monospace" }}>
                    /invitations/accept?invite=UUID
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}