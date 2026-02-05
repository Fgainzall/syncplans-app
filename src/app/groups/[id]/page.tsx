// src/app/groups/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";
import { inviteToGroup } from "@/lib/invitationsDb";
import {
  getProfilesByIds,
  type Profile as UserProfile,
} from "@/lib/profilesDb";
import {
  updateGroupMeta,
  type GroupType,
} from "@/lib/groupsDb";

type Group = {
  id: string;
  name: string | null;
  type: "pair" | "family" | "solo" | "personal" | "other" | string;
  owner_id: string | null;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  role: string | null;
  created_at: string | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  isMe: boolean;
};

type GroupMessage = {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profile: {
    display_name: string | null;
  } | null;
  isMe: boolean;
};

const groupTypeOptions: { value: GroupType; label: string; hint: string }[] = [
  { value: "solo", label: "Personal", hint: "Solo tú" },
  { value: "pair", label: "Pareja", hint: "2 personas" },
  { value: "family", label: "Familia", hint: "Varios" },
  { value: "other", label: "Compartido", hint: "Amigos, equipos" },
];

function labelGroupType(t?: string | null) {
  const x = (t || "").toLowerCase();
  if (x === "family") return "Familia";
  if (x === "pair" || x === "couple") return "Pareja";
  if (x === "solo" || x === "personal") return "Personal";
  if (x === "other") return "Compartido";
  return t ? String(t) : "Grupo";
}

function initials(name?: string | null) {
  const s = (name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

function formatTimeShort(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = String((params as any)?.id || "");

  const [booting, setBooting] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Edición de grupo (nombre + tipo)
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<GroupType>("family");
  const [savingMeta, setSavingMeta] = useState(false);

  // Mensajes del grupo
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  function showToast(title: string, subtitle?: string) {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  }

  const typeLabel = useMemo(() => labelGroupType(group?.type ?? null), [group]);

  const isOwner = useMemo(() => {
    if (!group?.owner_id || !currentUserId) return false;
    return String(group.owner_id) === String(currentUserId);
  }, [group?.owner_id, currentUserId]);

  const hasGroupMetaChanges = useMemo(() => {
    if (!group) return false;
    const baseName = group.name ?? "";
    const baseType = (group.type as GroupType) ?? "family";
    return baseName !== editName.trim() || baseType !== editType;
  }, [group, editName, editType]);

  async function loadMembers(gid: string, userId: string | null) {
    setMembersLoading(true);
    try {
      const { data: ms, error: mErr } = await supabase
        .from("group_members")
        .select("user_id,role,created_at")
        .eq("group_id", gid)
        .order("created_at", { ascending: true });

      if (mErr) throw mErr;

      const rawMembers = (ms ?? []) as Array<{
        user_id: string;
        role: string | null;
        created_at: string | null;
      }>;

      const ids = Array.from(new Set(rawMembers.map((m) => m.user_id).filter(Boolean)));

      let profilesById = new Map<string, { display_name: string | null; avatar_url: string | null }>();

      if (ids.length > 0) {
        const profiles: UserProfile[] = await getProfilesByIds(ids);
        profiles.forEach((p) => {
          profilesById.set(p.id, {
            display_name: p.display_name ?? null,
            avatar_url: p.avatar_url ?? null,
          });
        });
      }

      const merged: MemberRow[] = rawMembers.map((m) => ({
        ...m,
        profiles: profilesById.get(m.user_id) ?? null,
        isMe: userId != null && String(m.user_id) === String(userId),
      }));

      setMembers(merged);
    } finally {
      setMembersLoading(false);
    }
  }

  async function loadMessages(gid: string, userId: string | null) {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from("group_messages")
        .select("id, group_id, author_id, content, created_at")
        .eq("group_id", gid)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const raw = (data ?? []) as Array<{
        id: string;
        group_id: string;
        author_id: string;
        content: string;
        created_at: string;
      }>;

      const authorIds = Array.from(new Set(raw.map((m) => m.author_id).filter(Boolean)));

      let profilesById = new Map<string, { display_name: string | null }>();

      if (authorIds.length > 0) {
        const profiles: UserProfile[] = await getProfilesByIds(authorIds);
        profiles.forEach((p) => {
          profilesById.set(p.id, {
            display_name: p.display_name ?? null,
          });
        });
      }

      const merged: GroupMessage[] = raw.map((m) => ({
        ...m,
        profile: profilesById.get(m.author_id) ?? null,
        isMe: userId != null && String(m.author_id) === String(userId),
      }));

      setMessages(merged);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function loadAll() {
    if (!groupId) throw new Error("Group id missing");

    const { data: ses, error: sesErr } = await supabase.auth.getSession();
    if (sesErr) throw sesErr;

    if (!ses.session?.user) {
      router.replace("/auth/login");
      return;
    }

    const userId = ses.session.user.id;
    setCurrentUserId(userId);

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id,name,type,owner_id,created_at")
      .eq("id", groupId)
      .single();

    if (gErr) throw gErr;

    const typedGroup = g as Group;
    setGroup(typedGroup);

    // Inicializar formulario de edición
    setEditName(typedGroup.name ?? "");
    setEditType((typedGroup.type as GroupType) ?? "family");

    await loadMembers(groupId, userId);
    await loadMessages(groupId, userId);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);
        await loadAll();
      } catch (e: any) {
        if (!alive) return;
        showToast("No se pudo cargar", e?.message || "Intenta nuevamente.");
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmedEmail = email.trim().toLowerCase();
  const canSend = trimmedEmail.includes("@") && trimmedEmail.length >= 6 && !sending;

  async function sendInvite() {
    if (!group) return;

    if (!canSend) {
      showToast("Revisa el email", "Escribe un correo válido.");
      return;
    }

    try {
      setSending(true);

      const res: any = await inviteToGroup({
        groupId: group.id,
        email: trimmedEmail,
        role: "member",
      });

      if (!res?.ok) {
        throw new Error(res?.error || "No se pudo invitar.");
      }

      const emailSent = typeof res?.email_sent === "boolean" ? res.email_sent : null;
      const emailErr = res?.email_error ? String(res.email_error) : "";

      if (emailSent === true) {
        showToast("Invitación enviada ✅", `Correo enviado a ${res.invited_email || trimmedEmail}`);
      } else if (emailSent === false) {
        showToast(
          "Invitación creada (sin email)",
          emailErr ? `Error enviando correo: ${emailErr}` : "No se pudo enviar el correo."
        );
      } else {
        showToast("Invitación creada ✅", `Se invitó a ${res.invited_email || trimmedEmail}`);
      }

      setEmail("");
      await loadMembers(group.id, currentUserId);
    } catch (e: any) {
      showToast("No se pudo invitar", e?.message || "Intenta nuevamente.");
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    const trimmed = newMessage.trim();
    if (!group || !trimmed || sendingMessage) return;

    if (!currentUserId) {
      showToast("Sesión no encontrada", "Vuelve a iniciar sesión.");
      return;
    }

    try {
      setSendingMessage(true);

      const { data, error } = await supabase
        .from("group_messages")
        .insert({
          group_id: group.id,
          content: trimmed,
        })
        .select("id, group_id, author_id, content, created_at")
        .single();

      if (error) throw error;

      const row = data as {
        id: string;
        group_id: string;
        author_id: string;
        content: string;
        created_at: string;
      };

      // Usa el perfil del miembro si lo tenemos ya cargado
      const meMember = members.find((m) => String(m.user_id) === String(currentUserId));
      const display_name = meMember?.profiles?.display_name ?? "Tú";

      const appended: GroupMessage = {
        ...row,
        profile: { display_name },
        isMe: true,
      };

      setMessages((prev) => [...prev, appended]);
      setNewMessage("");
    } catch (e: any) {
      showToast("No se pudo enviar el mensaje", e?.message || "Intenta nuevamente.");
    } finally {
      setSendingMessage(false);
    }
  }

  async function goCalendar() {
    try {
      await setActiveGroupIdInDb(groupId);
    } catch {
      // ignore
    }
    router.push("/calendar");
  }

  async function handleSaveMeta() {
    const g = group;
    if (!g) return;

    if (!isOwner) {
      showToast("Solo el owner puede editar el grupo");
      return;
    }

    if (!hasGroupMetaChanges) {
      showToast("Sin cambios por guardar");
      return;
    }

    try {
      setSavingMeta(true);

      const patch: { name?: string | null; type?: GroupType } = {};
      const trimmedName = editName.trim();

      if (trimmedName !== (g.name ?? "")) {
        // si el input queda vacío, mandamos null
        patch.name = trimmedName || null;
      }

      const baseType = (g.type as GroupType) ?? "family";
      if (editType !== baseType) {
        patch.type = editType;
      }

      const updated = await updateGroupMeta(g.id, patch);

      setGroup(updated as Group);
      showToast("Grupo actualizado ✅", "Todos verán el nuevo nombre y tipo.");
    } catch (e: any) {
      showToast(
        "No se pudo actualizar el grupo",
        e?.message || "Intenta nuevamente."
      );
    } finally {
      setSavingMeta(false);
    }
  }

  const trimmedMessage = newMessage.trim();
  const canSendMessage = trimmedMessage.length > 0 && !sendingMessage;

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando grupo…</div>
              <div style={styles.loadingSub}>Miembros e invitaciones</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!group) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <div style={styles.card}>
            <div style={styles.h1}>Grupo no encontrado</div>
            <div style={styles.sub}>
              Puede ser que no seas miembro o que el grupo ya no exista.
            </div>
            <button onClick={() => router.push("/groups")} style={styles.ghostBtnWide}>
              ← Volver a grupos
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      )}

      <div style={styles.shell}>
        <div style={styles.topRow}>
          <PremiumHeader />
          <div style={styles.topActions}>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div>
            <div style={styles.kicker}>Grupo</div>
            <h1 style={styles.h1}>{group.name || typeLabel}</h1>
            <div style={styles.sub}>
              Este es el grupo con el que compartes tu calendario. Tipo:{" "}
              <b>{typeLabel}</b> · ID:{" "}
              <span style={{ opacity: 0.85 }}>{group.id}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => router.push("/groups")} style={styles.ghostBtn}>
              ← Volver
            </button>
            <button onClick={goCalendar} style={styles.primaryBtn}>
              Ir al calendario →</button>
          </div>
        </section>

        {/* Configuración del grupo: nombre + tipo */}
        <section style={styles.card}>
          <div style={styles.sectionTitle}>Configurar grupo</div>
          <div style={styles.smallNote}>
            Cambia el nombre o el tipo del grupo. El cambio aplica para todos los miembros.
            {isOwner
              ? " Solo el owner puede guardar cambios."
              : " No puedes editar este grupo porque no eres el owner."}
          </div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={styles.fieldLabel}>Nombre del grupo</div>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ej. Familia Gainza Llosa"
                disabled={!isOwner}
                style={{
                  ...styles.input,
                  marginTop: 6,
                  opacity: isOwner ? 1 : 0.6,
                }}
              />
            </div>

            <div>
              <div style={styles.fieldLabel}>Tipo de grupo</div>
              <div style={styles.typePillRow}>
                {groupTypeOptions.map((opt) => {
                  const active = editType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!isOwner}
                      onClick={() => isOwner && setEditType(opt.value)}
                      style={{
                        ...styles.typePill,
                        ...(active ? styles.typePillActive : {}),
                        ...(isOwner ? {} : { opacity: 0.6, cursor: "default" }),
                      }}
                    >
                      <div style={styles.typePillLabel}>{opt.label}</div>
                      <div style={styles.typePillHint}>{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <button
                onClick={handleSaveMeta}
                disabled={!isOwner || !hasGroupMetaChanges || savingMeta}
                style={{
                  ...styles.primaryBtn,
                  opacity: !isOwner || !hasGroupMetaChanges ? 0.55 : 1,
                }}
              >
                {savingMeta ? "Guardando…" : "Guardar cambios"}
              </button>
              {hasGroupMetaChanges && isOwner && (
                <span style={{ fontSize: 11, opacity: 0.8 }}>
                  Se actualizará el nombre y/o tipo del grupo para todos.
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Miembros */}
        <section style={styles.card}>
          <div style={styles.sectionTitle}>Miembros</div>
          <div style={styles.smallNote}>
            Personas que ven este calendario compartido. Cuando alguien acepta una
            invitación, aparecerá aquí automáticamente.
          </div>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div>Usuario</div>
              <div>Rol</div>
            </div>

            {membersLoading ? (
              <div style={{ padding: 12, opacity: 0.75, fontSize: 12 }}>
                Cargando miembros…
              </div>
            ) : members.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.75, fontSize: 12 }}>
                Aún no hay miembros visibles. Invita a alguien para empezar a
                compartir horarios.
              </div>
            ) : (
              members.map((m) => {
                const baseName = m.profiles?.display_name || "Usuario";
                const label = m.isMe ? "Tú" : baseName;

                return (
                  <div key={m.user_id} style={styles.tableRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={styles.avatarCircle}>{initials(baseName)}</div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{label}</div>
                      </div>
                    </div>

                    <div style={{ fontWeight: 900, fontSize: 12 }}>
                      {m.role || "member"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Mensajes del grupo */}
        <section style={styles.card}>
          <div style={styles.sectionTitle}>Mensajes del grupo</div>
          <div style={styles.smallNote}>
            Un espacio ligero para coordinar detalles sobre planes con este grupo.
            Los mensajes solo los ven los miembros; no reemplaza tu WhatsApp, solo
            acompaña al calendario compartido.
          </div>

          <div style={styles.messagesWrap}>
            {messagesLoading ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Cargando mensajes…</div>
            ) : messages.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Aún no hay mensajes. Escribe el primero para coordinar algo rápido
                (horarios, lugar, quién trae qué, etc.).
              </div>
            ) : (
              messages.map((msg) => {
                const name =
                  msg.isMe
                    ? "Tú"
                    : msg.profile?.display_name || "Miembro";
                const colorOpacity = msg.isMe ? 1 : 0.85;

                return (
                  <div key={msg.id} style={styles.messageRow}>
                    <div style={styles.messageAvatar}>
                      {initials(name)}
                    </div>
                    <div style={styles.messageBubble}>
                      <div style={styles.messageHeader}>
                        <span
                          style={{
                            ...styles.messageAuthor,
                            opacity: colorOpacity,
                          }}
                        >
                          {name}
                        </span>
                        <span style={styles.messageTime}>
                          {formatTimeShort(msg.created_at)}
                        </span>
                      </div>
                      <div style={styles.messageContent}>{msg.content}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={styles.messageInputRow}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje corto para este grupo…"
              rows={2}
              style={styles.messageInput}
            />
            <button
              onClick={sendMessage}
              disabled={!canSendMessage}
              style={{
                ...styles.primaryBtn,
                opacity: canSendMessage ? 1 : 0.55,
                alignSelf: "flex-end",
                whiteSpace: "nowrap",
              }}
            >
              {sendingMessage ? "Enviando…" : "Enviar mensaje"}
            </button>
          </div>
        </section>

        {/* Invitaciones */}
        <section style={styles.card}>
          <div style={styles.sectionTitle}>Invitar</div>
          <div style={styles.smallNote}>
            Escribe el email del invitado. Se creará una invitación{" "}
            <b>pending</b> y, cuando la acepte, se agregará automáticamente como
            miembro de este grupo.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              style={styles.input}
            />
            <button
              onClick={sendInvite}
              disabled={!canSend}
              style={{ ...styles.primaryBtn, opacity: canSend ? 1 : 0.6 }}
            >
              {sending ? "Enviando…" : "Enviar invitación"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { maxWidth: 980, margin: "0 auto", padding: "22px 18px 48px" },

  toastWrap: { position: "fixed", top: 18, right: 18, zIndex: 50, pointerEvents: "none" },
  toastCard: {
    pointerEvents: "auto",
    minWidth: 260,
    maxWidth: 380,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.72)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: { fontWeight: 900, fontSize: 13 },
  toastSub: { marginTop: 4, fontSize: 12, opacity: 0.75, fontWeight: 650 },

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  topActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  hero: {
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 12,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  kicker: {
    alignSelf: "flex-start",
    fontSize: 11,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    opacity: 0.9,
    fontWeight: 900,
  },
  h1: { margin: "10px 0 0", fontSize: 28, letterSpacing: "-0.6px" },
  sub: { marginTop: 8, fontSize: 13, opacity: 0.75, maxWidth: 720 },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    marginTop: 12,
  },
  sectionTitle: { fontWeight: 950, fontSize: 14 },
  smallNote: { marginTop: 6, fontSize: 12, opacity: 0.72 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.9,
  },

  input: {
    flex: 1,
    minWidth: 260,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    fontSize: 14,
  },

  typePillRow: {
    marginTop: 8,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  typePill: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,12,24,0.85)",
    padding: "7px 10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 110,
    cursor: "pointer",
  },
  typePillActive: {
    border: "1px solid rgba(255,255,255,0.85)",
    background: "rgba(255,255,255,0.08)",
    boxShadow: "0 0 18px rgba(56,189,248,0.35)",
  },
  typePillLabel: {
    fontSize: 12,
    fontWeight: 900,
  },
  typePillHint: {
    fontSize: 10,
    opacity: 0.7,
    marginTop: 2,
  },

  table: {
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 120px",
    gap: 10,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 120px",
    gap: 10,
    padding: "10px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    alignItems: "center",
  },

  avatarCircle: {
    height: 34,
    width: 34,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
    fontSize: 12,
  },

  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  },
  ghostBtnWide: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 240,
    marginTop: 12,
  },
  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },

  loadingCard: {
    marginTop: 18,
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 24px rgba(56,189,248,0.55)",
  },
  loadingTitle: { fontWeight: 900 },
  loadingSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },

  // Mensajes
  messagesWrap: {
    marginTop: 10,
    maxHeight: 260,
    padding: "8px 4px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 12,
  },
  messageAvatar: {
    height: 28,
    width: 28,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 11,
    flexShrink: 0,
  },
  messageBubble: {
    flex: 1,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.95)",
    padding: "6px 9px",
  },
  messageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  messageAuthor: {
    fontWeight: 800,
    fontSize: 11,
  },
  messageTime: {
    fontSize: 10,
    opacity: 0.65,
  },
  messageContent: {
    marginTop: 3,
    fontSize: 12,
    opacity: 0.94,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  messageInputRow: {
    marginTop: 10,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  messageInput: {
    flex: 1,
    minWidth: 260,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    fontSize: 13,
    resize: "vertical",
  },
};
