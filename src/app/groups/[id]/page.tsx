// src/app/groups/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
const AnyPremiumHeader = PremiumHeader as React.ComponentType<any>;
import { setActiveGroupIdInDb } from "@/lib/activeGroup";
import { inviteToGroup } from "@/lib/invitationsDb";
import { getProfilesByIds, type Profile as UserProfile } from "@/lib/profilesDb";
import {
  updateGroupMeta,
  deleteGroup,
  leaveGroup,
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
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(
    null
  );
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

  // 🔕 Mute de grupo (por usuario)
  const [muted, setMuted] = useState(false);
  const [updatingMute, setUpdatingMute] = useState(false);

  // 🧨 Eliminar / salir
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // 🔗 Último link de invitación generado
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  function showToast(title: string, subtitle?: string) {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  }

  const typeLabel = useMemo(() => labelGroupType(group?.type ?? null), [group]);

  const isOwner = useMemo(() => {
    if (!group?.owner_id || !currentUserId) return false;
    return String(group.owner_id) === String(currentUserId);
  }, [group?.owner_id, currentUserId]);

  const isMember = useMemo(() => {
    if (!currentUserId) return false;
    return members.some((m) => String(m.user_id) === String(currentUserId));
  }, [members, currentUserId]);

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
          profilesById.set(p.id, { display_name: p.display_name ?? null });
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

    // ✅ IMPORTANT: al entrar al detalle, seteamos este grupo como activo
    try {
      await setActiveGroupIdInDb(groupId);
    } catch {
      // no bloquea
    }

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id,name,type,owner_id,created_at")
      .eq("id", groupId)
      .single();

    if (gErr) throw gErr;

    const typedGroup = g as Group;
    setGroup(typedGroup);

    setEditName(typedGroup.name ?? "");
    setEditType((typedGroup.type as GroupType) ?? "family");

    const { data: ns, error: nsErr } = await supabase
      .from("group_notification_settings")
      .select("muted")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .maybeSingle();

    if (nsErr) throw nsErr;
    setMuted(Boolean(ns?.muted));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const trimmedEmail = email.trim().toLowerCase();
  const canSend = trimmedEmail.includes("@") && trimmedEmail.length >= 6 && !sending;

  async function sendInvite() {
    if (!group) return;

    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@") || trimmed.length < 6) {
      showToast("Revisa el email", "Escribe un correo válido.");
      return;
    }

    try {
      setSending(true);
      setLastInviteLink(null);

      const res = await inviteToGroup({
        groupId: group.id,
        email: trimmed,
        role: "member",
      });

      if (!res?.ok) throw new Error(res?.error || "No se pudo invitar.");

      const inviteId = res.id ?? null;

      let link: string | null = null;
      if (inviteId && typeof window !== "undefined") {
        link = `${window.location.origin}/invitations/accept?invite=${inviteId}`;
        setLastInviteLink(link);
      }

      const emailSent = typeof res?.email_sent === "boolean" ? res.email_sent : null;
      const emailErr = res?.email_error ? String(res.email_error) : "";
      const invitedEmail = res.invited_email || trimmed;

      if (emailSent === true) {
        showToast(
          "Invitación enviada ✅",
          link
            ? `Correo enviado a ${invitedEmail}. También puedes compartir el link directo.`
            : `Correo enviado a ${invitedEmail}.`
        );
      } else if (emailSent === false) {
        showToast(
          "Invitación creada (sin email)",
          link
            ? "No se pudo enviar el correo. Usa el link de invitación para compartirlo directamente."
            : emailErr
            ? `Error enviando correo: ${emailErr}`
            : "No se pudo enviar el correo."
        );
      } else {
        showToast(
          "Invitación creada ✅",
          link
            ? `Se invitó a ${invitedEmail}. También puedes compartir el link directo.`
            : `Se invitó a ${invitedEmail}.`
        );
      }

      setEmail("");
      await loadMembers(group.id, currentUserId);
    } catch (e: any) {
      showToast("No se pudo invitar", e?.message || "Intenta nuevamente.");
    } finally {
      setSending(false);
    }
  }

  async function copyInviteLink() {
    if (!lastInviteLink) return;
    try {
      await navigator.clipboard.writeText(lastInviteLink);
      showToast("Link copiado ✅", "Pégalo en WhatsApp, correo, donde quieras.");
    } catch {
      showToast("No se pudo copiar", "Cópialo manualmente desde el texto.");
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
        .insert([{ group_id: group.id, author_id: currentUserId, content: trimmed }])
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

      const meMember = members.find((m) => String(m.user_id) === String(currentUserId));
      const display_name = meMember?.profiles?.display_name ?? "Tú";

      const appended: GroupMessage = {
        ...row,
        profile: { display_name },
        isMe: true,
      };

      setMessages((prev) => [...prev, appended]);
      setNewMessage("");

      // 🔔 Notificaciones para otros miembros (respetando mute)
      try {
        const others = members.filter((m) => String(m.user_id) !== String(currentUserId));
        if (others.length === 0) return;

        let recipients = others;

        try {
          const ids = others.map((m) => m.user_id);
          const { data: prefs, error: prefsError } = await supabase
            .from("group_notification_settings")
            .select("user_id, muted")
            .eq("group_id", group.id)
            .in("user_id", ids);

          if (!prefsError) {
            const rows = (prefs ?? []) as Array<{ user_id: string; muted: boolean | null }>;
            const mutedSet = new Set(rows.filter((r) => r.muted).map((r) => r.user_id));
            recipients = others.filter((m) => !mutedSet.has(m.user_id));
          }
        } catch {
          // ignore
        }

        if (recipients.length === 0) return;

        const snippet = trimmed.length > 80 ? trimmed.slice(0, 77) + "…" : trimmed;
        const title = `Nuevo mensaje en ${group.name || typeLabel}`;

        const rowsToInsert = recipients.map((m) => ({
          user_id: m.user_id,
          type: "group_message" as const,
          title,
          body: snippet,
          entity_id: group.id,
        }));

        await supabase.from("notifications").insert(rowsToInsert);
      } catch {
        // ignore
      }
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
      if (trimmedName !== (g.name ?? "")) patch.name = trimmedName || null;

      const baseType = (g.type as GroupType) ?? "family";
      if (editType !== baseType) patch.type = editType;

      const updated = await updateGroupMeta(g.id, patch);
      setGroup(updated as Group);

      showToast("Grupo actualizado ✅", "Todos verán el nuevo nombre y tipo.");
    } catch (e: any) {
      showToast("No se pudo actualizar el grupo", e?.message || "Intenta nuevamente.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function toggleMute(next: boolean) {
    if (!currentUserId || !groupId) return;

    try {
      setUpdatingMute(true);
      setMuted(next);

      const { error } = await supabase
        .from("group_notification_settings")
        .upsert({ user_id: currentUserId, group_id: groupId, muted: next }, { onConflict: "user_id,group_id" });

      if (error) throw error;

      showToast(
        next ? "Grupo silenciado 🔕" : "Notificaciones activas 🔔",
        next
          ? "No verás nuevas notificaciones de mensajes para este grupo."
          : "Volverás a ver notificaciones de mensajes para este grupo."
      );
    } catch (e: any) {
      setMuted((prev) => !next);
      showToast("No se pudo actualizar notificaciones", e?.message || "Intenta nuevamente.");
    } finally {
      setUpdatingMute(false);
    }
  }

  async function handleDeleteGroup() {
    if (!group) return;
    if (!isOwner) {
      showToast("Solo el owner puede eliminar el grupo");
      return;
    }

    const ok = window.confirm("Vas a eliminar este grupo, sus eventos y mensajes para todos. ¿Seguro?");
    if (!ok) return;

    try {
      setDeleting(true);
      await deleteGroup(group.id);
      showToast("Grupo eliminado ✅", "Ya no aparecerá en tus grupos.");
      router.push("/groups");
    } catch (e: any) {
      showToast("No se pudo eliminar el grupo", e?.message || "Intenta nuevamente.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLeaveGroup() {
    if (!group) return;
    if (!currentUserId) return;

    if (isOwner) {
      showToast("Eres el owner", "El owner no puede salir del grupo; puede eliminarlo.");
      return;
    }

    if (!isMember) {
      showToast("No estás en este grupo", "No hay nada que salir.");
      return;
    }

    const ok = window.confirm("Vas a salir de este grupo y dejarás de ver sus eventos y mensajes. ¿Seguro?");
    if (!ok) return;

    try {
      setLeaving(true);
      await leaveGroup(group.id);
      showToast("Saliste del grupo ✅");
      router.push("/groups");
    } catch (e: any) {
      showToast("No se pudo salir del grupo", e?.message || "Intenta nuevamente.");
    } finally {
      setLeaving(false);
    }
  }

  const trimmedMessage = newMessage.trim();
  const canSendMessage = trimmedMessage.length > 0 && !sendingMessage;

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <AnyPremiumHeader />
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
          <AnyPremiumHeader />
          <div style={styles.card}>
            <div style={styles.h1}>Grupo no encontrado</div>
            <div style={styles.sub}>Puede ser que no seas miembro o que el grupo ya no exista.</div>
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
      {/* MOBILE ULTRA PREMIUM */}
      <style jsx global>{`
        @media (max-width: 680px) {
          .sp-group-shell {
            padding: 16px 14px 44px !important;
          }

          .sp-group-hero {
            padding: 14px !important;
            gap: 10px !important;
          }

          .sp-group-heroActions {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .sp-group-heroActions button {
            width: 100% !important;
          }

          .sp-group-idline {
            display: none !important;
          }

          .sp-group-inputRow {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .sp-group-inputRow input,
          .sp-group-inputRow textarea,
          .sp-group-inputRow button {
            width: 100% !important;
            min-width: 0 !important;
          }

          .sp-group-tableHeader,
          .sp-group-tableRow {
            grid-template-columns: 1fr 90px !important;
          }

          .sp-group-messagesWrap {
            max-height: 320px !important;
          }

          .sp-group-typePills {
            gap: 8px !important;
          }
          .sp-group-typePills button {
            flex: 1 1 auto !important;
            min-width: 140px !important;
          }
        }

        @media (hover: hover) {
          .sp-tap:hover {
            filter: brightness(1.04);
          }
        }
        .sp-tap:active {
          transform: translateY(1px);
        }
      `}</style>

      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      )}

      <div className="sp-group-shell" style={styles.shell}>
        <div style={styles.topRow}>
          <AnyPremiumHeader />
          <div style={styles.topActions}>
            <LogoutButton />
          </div>
        </div>

        <section className="sp-group-hero" style={styles.hero}>
          <div>
            <div style={styles.kicker}>Grupo</div>
            <h1 style={styles.h1}>{group.name || typeLabel}</h1>
            <div style={styles.sub}>
              Este es el grupo con el que compartes tu calendario. Tipo: <b>{typeLabel}</b>
              <span className="sp-group-idline">
                {" "}
                · ID: <span style={{ opacity: 0.85 }}>{group.id}</span>
              </span>
            </div>
          </div>

          <div className="sp-group-heroActions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="sp-tap" onClick={() => router.push("/groups")} style={styles.ghostBtn}>
                ← Volver
              </button>
              <button className="sp-tap" onClick={goCalendar} style={styles.primaryBtn}>
                Ir al calendario →
              </button>
            </div>
          </div>
        </section>

        {/* Configuración del grupo */}
        <section style={styles.card}>
          <div style={styles.sectionTitle}>Configurar grupo</div>
          <div style={styles.smallNote}>
            Cambia el nombre o el tipo del grupo. El cambio aplica para todos los miembros.
            {isOwner ? " Solo el owner puede guardar cambios." : " No puedes editar este grupo porque no eres el owner."}
          </div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={styles.fieldLabel}>Nombre del grupo</div>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ej. Familia Gainza Llosa"
                disabled={!isOwner}
                style={{ ...styles.input, marginTop: 6, opacity: isOwner ? 1 : 0.6 }}
              />
            </div>

            <div>
              <div style={styles.fieldLabel}>Tipo de grupo</div>
              <div className="sp-group-typePills" style={styles.typePillRow}>
                {groupTypeOptions.map((opt) => {
                  const active = editType === opt.value;
                  return (
                    <button
                      className="sp-tap"
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

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
              <button
                className="sp-tap"
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

            {/* Zona peligrosa */}
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px dashed rgba(248,113,113,0.5)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.75, fontWeight: 800 }}>
                Zona peligrosa
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {isOwner ? (
                  <button
                    className="sp-tap"
                    type="button"
                    onClick={handleDeleteGroup}
                    disabled={deleting}
                    style={{ ...styles.dangerBtn, opacity: deleting ? 0.7 : 1 }}
                  >
                    {deleting ? "Eliminando…" : "Eliminar grupo"}
                  </button>
                ) : (
                  <button
                    className="sp-tap"
                    type="button"
                    onClick={handleLeaveGroup}
                    disabled={leaving}
                    style={{ ...styles.dangerBtn, opacity: leaving ? 0.7 : 1 }}
                  >
                    {leaving ? "Saliendo…" : "Salir del grupo"}
                  </button>
                )}
              </div>

              <div style={{ fontSize: 11, opacity: 0.75 }}>
                {isOwner
                  ? "Se borrará el grupo, sus eventos y mensajes para todos los miembros."
                  : "Dejarás de ver este calendario compartido y sus mensajes. Siempre podrás volver si te invitan de nuevo."}
              </div>
            </div>
          </div>
        </section>

        {/* Miembros */}
        <section style={styles.card}>
          <div style={styles.sectionTitle}>Miembros</div>
          <div style={styles.smallNote}>
            Personas que ven este calendario compartido. Cuando alguien acepta una invitación, aparecerá aquí automáticamente.
          </div>

          <div style={styles.table}>
            <div className="sp-group-tableHeader" style={styles.tableHeader}>
              <div>Usuario</div>
              <div>Rol</div>
            </div>

            {membersLoading ? (
              <div style={{ padding: 12, opacity: 0.75, fontSize: 12 }}>Cargando miembros…</div>
            ) : members.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.75, fontSize: 12 }}>
                Aún no hay miembros visibles. Invita a alguien para empezar a compartir horarios.
              </div>
            ) : (
              members.map((m) => {
                const baseName = m.profiles?.display_name || "Usuario";
                const label = m.isMe ? "Tú" : baseName;
                return (
                  <div className="sp-group-tableRow" key={m.user_id} style={styles.tableRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={styles.avatarCircle}>{initials(baseName)}</div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{label}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>{m.role || "member"}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Mensajes */}
        <section style={styles.card}>
          <div style={styles.sectionTitleRow}>
            <div style={styles.sectionTitle}>Mensajes del grupo</div>
            <button
              className="sp-tap"
              type="button"
              onClick={() => toggleMute(!muted)}
              disabled={updatingMute}
              style={{
                ...styles.ghostBtn,
                fontSize: 11,
                padding: "6px 10px",
                opacity: updatingMute ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {muted ? "🔕 Silenciado" : "🔔 Notificaciones activas"}
            </button>
          </div>

          <div style={styles.smallNote}>
            Un espacio ligero para coordinar detalles sobre planes con este grupo. No reemplaza WhatsApp, solo acompaña al calendario.
          </div>

          <div className="sp-group-messagesWrap" style={styles.messagesWrap}>
            {messagesLoading ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Cargando mensajes…</div>
            ) : messages.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Aún no hay mensajes. Escribe el primero para coordinar algo rápido.
              </div>
            ) : (
              messages.map((msg) => {
                const name = msg.isMe ? "Tú" : msg.profile?.display_name || "Miembro";
                const colorOpacity = msg.isMe ? 1 : 0.85;
                return (
                  <div key={msg.id} style={styles.messageRow}>
                    <div style={styles.messageAvatar}>{initials(name)}</div>
                    <div style={styles.messageBubble}>
                      <div style={styles.messageHeader}>
                        <span style={{ ...styles.messageAuthor, opacity: colorOpacity }}>{name}</span>
                        <span style={styles.messageTime}>{formatTimeShort(msg.created_at)}</span>
                      </div>
                      <div style={styles.messageContent}>{msg.content}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="sp-group-inputRow" style={styles.messageInputRow}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje corto para este grupo…"
              rows={2}
              style={styles.messageInput}
            />
            <button
              className="sp-tap"
              onClick={sendMessage}
              disabled={!canSendMessage}
              style={{
                ...styles.primaryBtn,
                opacity: canSendMessage ? 1 : 0.55,
                alignSelf: "flex-end",
                whiteSpace: "nowrap",
              }}
            >
              {sendingMessage ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </section>

        {/* Invitaciones */}
        <section style={styles.card}>
          <div style={styles.sectionTitle}>Invitar</div>
          <div style={styles.smallNote}>
            Escribe el email del invitado. Se creará una invitación <b>pending</b> y, cuando la acepte, se agregará automáticamente como miembro.
          </div>

          <div className="sp-group-inputRow" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" style={styles.input} />
            <button
              className="sp-tap"
              onClick={sendInvite}
              disabled={!canSend}
              style={{ ...styles.primaryBtn, opacity: canSend ? 1 : 0.6 }}
            >
              {sending ? "Enviando…" : "Enviar invitación"}
            </button>
          </div>

          {lastInviteLink && (
            <div
              style={{
                marginTop: 10,
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.5)",
                background: "rgba(15,23,42,0.9)",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.85 }}>
                Link de invitación listo para compartir
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <code
                  style={{
                    fontSize: 11,
                    padding: "6px 8px",
                    borderRadius: 10,
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(148,163,184,0.5)",
                    maxWidth: "100%",
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {lastInviteLink}
                </code>

                <button
                  className="sp-tap"
                  type="button"
                  onClick={copyInviteLink}
                  style={{ ...styles.ghostBtn, fontSize: 11, padding: "8px 10px", whiteSpace: "nowrap" }}
                >
                  Copiar link
                </button>
              </div>

              <div style={{ fontSize: 11, opacity: 0.7 }}>
                Compártelo por WhatsApp o correo. Al abrirlo, verá la pantalla para aceptar la invitación.
              </div>
            </div>
          )}
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
  h1: { margin: "10px 0 0", fontSize: 28, letterSpacing: "-0.6px", fontWeight: 950 },
  sub: { marginTop: 8, fontSize: 13, opacity: 0.75, maxWidth: 720 },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    marginTop: 12,
  },

  sectionTitle: { fontWeight: 950, fontSize: 14 },
  sectionTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  smallNote: { marginTop: 6, fontSize: 12, opacity: 0.72 },

  fieldLabel: { fontSize: 12, fontWeight: 800, opacity: 0.9 },

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

  typePillRow: { marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 },
  typePill: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8,12,24,0.85)",
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 120,
    cursor: "pointer",
  },
  typePillActive: {
    border: "1px solid rgba(255,255,255,0.85)",
    background: "rgba(255,255,255,0.08)",
    boxShadow: "0 0 18px rgba(56,189,248,0.35)",
  },
  typePillLabel: { fontSize: 12, fontWeight: 900 },
  typePillHint: { fontSize: 10, opacity: 0.7, marginTop: 2 },

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

  dangerBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.85)",
    background: "radial-gradient(circle at 0% 0%, rgba(248,113,113,0.22), transparent 55%)",
    color: "rgba(254,242,242,0.97)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
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
  messageRow: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 },
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
  messageHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  messageAuthor: { fontWeight: 800, fontSize: 11 },
  messageTime: { fontSize: 10, opacity: 0.65 },
  messageContent: { marginTop: 3, fontSize: 12, opacity: 0.94, whiteSpace: "pre-wrap", wordBreak: "break-word" },

  messageInputRow: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" },
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