"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";

import supabase from "@/lib/supabaseClient";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import {
  getActiveGroupIdFromDb,
  setActiveGroupIdInDb,
} from "@/lib/activeGroup";
import {
  getProfilesByIds,
  getInitials,
  type Profile as UserProfile,
} from "@/lib/profilesDb";

type MemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  created_at: string | null;
  isMe: boolean;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
};

type UiToast = { title: string; subtitle?: string } | null;

export default function MembersClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<UiToast>(null);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 860);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) return;
        setMeId(data.user?.id ?? null);
      } catch {
        setMeId(null);
      }
    })();
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const myGroups = await getMyGroups();
        if (!alive) return;

        setGroups(myGroups);

        if (!myGroups.length) {
          setActiveGroupId(null);
          setMembers([]);
          return;
        }

        let gid = await getActiveGroupIdFromDb().catch(() => null);

        if (!gid || !myGroups.some((g) => String(g.id) === String(gid))) {
          gid = String(myGroups[0].id);
          await setActiveGroupIdInDb(gid).catch(() => undefined);
        }

        if (!alive) return;
        setActiveGroupId(gid);
      } catch (e) {
        console.error(e);
        if (alive) setErrorMsg("No pudimos cargar tus grupos.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!activeGroupId) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const { data, error } = await supabase
          .from("group_members")
          .select("id, group_id, user_id, role, created_at")
          .eq("group_id", activeGroupId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (!alive) return;

        const baseRows: MemberRow[] = (data ?? []).map((m: any) => ({
          id: String(m.id),
          group_id: String(m.group_id),
          user_id: String(m.user_id),
          role: String(m.role ?? "member"),
          created_at: m.created_at ?? null,
          isMe: meId != null && String(m.user_id) === String(meId),
        }));

        let enrichedRows: MemberRow[] = baseRows;

        try {
          const userIds = Array.from(new Set(baseRows.map((m) => m.user_id)));
          if (userIds.length > 0) {
            const profiles: UserProfile[] = await getProfilesByIds(userIds);
            const mapById = new Map<string, UserProfile>(
              profiles.map((p) => [p.id, p])
            );

            enrichedRows = baseRows.map((m) => {
              const p = mapById.get(m.user_id);
              if (!p) return m;
              return {
                ...m,
                display_name: p.display_name ?? null,
                first_name: p.first_name ?? null,
                last_name: p.last_name ?? null,
                avatar_url: p.avatar_url ?? null,
              };
            });
          }
        } catch (e) {
          console.error("Error cargando perfiles para miembros:", e);
        }

        if (!alive) return;
        setMembers(enrichedRows);
      } catch (e) {
        console.error(e);
        if (alive) {
          setErrorMsg("No pudimos cargar los miembros de este grupo.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeGroupId, meId]);

  const activeGroup = useMemo(
    () => groups.find((g) => String(g.id) === String(activeGroupId)) ?? null,
    [groups, activeGroupId]
  );

  const memberCount = members.length;
  const hasAnyGroup = groups.length > 0;
  const hasMembers = memberCount > 0;

  function onChangeGroup(e: React.ChangeEvent<HTMLSelectElement>) {
    const gid = e.target.value || null;
    setActiveGroupId(gid);
    setActiveGroupIdInDb(gid).catch(() => undefined);
  }

  function goToInvite() {
    if (!activeGroupId) {
      router.push("/groups");
      return;
    }
    router.push(`/groups/invite?groupId=${encodeURIComponent(activeGroupId)}`);
  }

  function showToast(title: string, subtitle?: string) {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 2400);
  }

  return (
    <MobileScaffold maxWidth={1120} style={S.page}>
      {toast && (
        <div style={S.toastWrap}>
          <div style={S.toastCard}>
            <div style={S.toastTitle}>{toast.title}</div>
            {toast.subtitle ? (
              <div style={S.toastSub}>{toast.subtitle}</div>
            ) : null}
          </div>
        </div>
      )}

      <Section>
        <PremiumHeader
          title="Miembros"
          subtitle="Quién está dentro de tu grupo y qué rol tiene cada uno."
        />

        {!hasAnyGroup ? (
          <Card>
            <Section>
              <div style={S.kicker}>Miembros</div>
              <h1 style={S.h1}>Todavía no tienes un grupo activo</h1>
              <p style={S.sub}>
                Crea primero un grupo para empezar a invitar personas y ver quién
                participa en la coordinación compartida.
              </p>

              <div style={S.actionButtons}>
                <button
                  type="button"
                  style={S.primaryBtn}
                  onClick={() => router.push("/groups/new")}
                >
                  Crear mi primer grupo
                </button>
                <button
                  type="button"
                  style={S.ghostBtn}
                  onClick={() => router.push("/groups")}
                >
                  Ver grupos
                </button>
              </div>
            </Section>
          </Card>
        ) : (
          <Card>
            <Section>
              <div
                style={{
                  ...S.headerBlock,
                  ...(isMobile ? S.headerBlockMobile : null),
                }}
              >
                <div style={S.headerCopy}>
                  <div style={S.kicker}>Estructura del grupo</div>
                  <h1 style={S.h1}>Miembros</h1>
                  <p style={S.sub}>
                    Revisa quién forma parte de{" "}
                    <b>
                      {activeGroup?.name || nombrePorTipo(activeGroup?.type)}
                    </b>{" "}
                    y qué rol tiene cada persona dentro del espacio compartido.
                  </p>
                </div>

                <div
                  style={{
                    ...S.actionButtons,
                    ...(isMobile ? S.actionButtonsMobile : null),
                  }}
                >
                  <button
                    type="button"
                    style={{
                      ...S.ghostBtn,
                      ...(isMobile ? S.fullBtn : null),
                    }}
                    onClick={() => router.push("/groups")}
                  >
                    Ver grupos
                  </button>
                  <button
                    type="button"
                    style={{
                      ...S.primaryBtn,
                      ...(isMobile ? S.fullBtn : null),
                    }}
                    onClick={goToInvite}
                  >
                    Invitar miembro
                  </button>
                </div>
              </div>

              <Card
                tone="muted"
                style={{
                  ...S.heroCard,
                  ...(isMobile ? S.heroCardMobile : null),
                }}
              >
                <div style={S.heroLeft}>
                  <div style={S.heroPill}>
                    <span style={S.heroDot} />
                    Grupo activo
                  </div>

                  <h2 style={S.heroTitle}>
                    {activeGroup?.name || nombrePorTipo(activeGroup?.type)}
                  </h2>

                  <p style={S.heroText}>
                    Cambia de grupo para revisar sus miembros, confirmar roles y
                    enviar nuevas invitaciones sin salir del flujo administrativo.
                  </p>
                </div>

                <div
                  style={{
                    ...S.heroRight,
                    ...(isMobile ? S.heroRightMobile : null),
                  }}
                >
                  <label style={S.selectLabel}>Grupo</label>
                  <select
                    value={activeGroupId ?? ""}
                    onChange={onChangeGroup}
                    style={S.select}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name || nombrePorTipo(g.type)}
                      </option>
                    ))}
                  </select>

                  <div style={S.summaryMini}>
                    {memberCount} miembro{memberCount === 1 ? "" : "s"} visible
                    {memberCount === 1 ? "" : "s"}
                  </div>
                </div>
              </Card>

              {errorMsg ? (
                <Card tone="muted" style={S.errorCard}>
                  <div style={S.errorTitle}>No se pudo cargar esta vista</div>
                  <div style={S.errorText}>{errorMsg}</div>
                </Card>
              ) : loading && !hasMembers ? (
                <Card tone="muted">
                  <div style={S.loadingRow}>
                    <div style={S.loadingDot} />
                    <div>
                      <div style={S.loadingTitle}>Cargando miembros…</div>
                      <div style={S.loadingSub}>
                        Leyendo grupo activo y perfiles
                      </div>
                    </div>
                  </div>
                </Card>
              ) : !hasMembers ? (
                <Card tone="muted" style={S.emptyCard}>
                  <div style={S.emptyTitle}>
                    Aún no hay más miembros en este grupo
                  </div>
                  <div style={S.emptyText}>
                    En cuanto alguien acepte tu invitación, aparecerá aquí con
                    su rol asignado.
                  </div>
                  <button
                    type="button"
                    style={S.ghostBtn}
                    onClick={() => {
                      showToast("Abriendo invitaciones…");
                      goToInvite();
                    }}
                  >
                    Enviar primera invitación
                  </button>
                </Card>
              ) : (
                <div style={S.list}>
                  {members.map((m) => (
                    <MemberRowView key={m.id} member={m} isMobile={isMobile} />
                  ))}
                </div>
              )}
            </Section>
          </Card>
        )}
      </Section>
    </MobileScaffold>
  );
}

function labelForRole(role: string | null | undefined): string {
  if (!role) return "Miembro";
  switch (role) {
    case "owner":
      return "Admin";
    case "admin":
      return "Admin";
    default:
      return "Miembro";
  }
}

function memberDisplayName(member: MemberRow): string {
  if (member.isMe) return "Tú";
  const full = (
    member.display_name ?? `${member.first_name ?? ""} ${member.last_name ?? ""}`
  ).trim();
  return full || "Miembro";
}

function MemberRowView({
  member,
  isMobile,
}: {
  member: MemberRow;
  isMobile: boolean;
}) {
  const roleLabel = labelForRole(member.role);
  const isOwner = member.role === "owner";
  const isAdmin = member.role === "admin";

  let avatarText = member.isMe ? "Tú" : roleLabel.charAt(0);
  if (member.display_name || member.first_name || member.last_name) {
    avatarText = getInitials({
      first_name: member.first_name,
      last_name: member.last_name,
      display_name: member.display_name,
    });
  }

  return (
    <Card
      tone="muted"
      style={{
        ...S.memberCard,
        ...(isMobile ? S.memberCardMobile : null),
      }}
    >
      <div style={S.memberMain}>
        <div style={S.avatarCircle}>{avatarText}</div>
        <div style={S.memberCopy}>
          <div style={S.memberName}>{memberDisplayName(member)}</div>
          <div style={S.memberSub}>
            {member.isMe
              ? "Este eres tú dentro del grupo."
              : "Miembro que comparte este grupo contigo."}
          </div>
        </div>
      </div>

      <span
        style={{
          ...S.roleBadge,
          ...(isOwner ? S.roleOwner : isAdmin ? S.roleAdmin : S.roleMember),
        }}
      >
        {roleLabel}
      </span>
    </Card>
  );
}

function nombrePorTipo(type?: GroupRow["type"] | null): string {
  const t = String(type ?? "").toLowerCase();
  if (t === "pair" || t === "couple") return "Pareja";
  if (t === "family") return "Familia";
  return "Compartido";
}

const S: Record<string, React.CSSProperties> = {
  page: {
    background:
      "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },

  toastWrap: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 50,
    pointerEvents: "none",
  },
  toastCard: {
    pointerEvents: "auto",
    minWidth: 240,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.92)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: { fontWeight: 900, fontSize: 13 },
  toastSub: { marginTop: 4, fontSize: 12, opacity: 0.75, fontWeight: 650 },

  headerBlock: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 4,
  },
  headerBlockMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    maxWidth: 760,
  },

  kicker: {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.95)",
    fontWeight: 800,
    marginBottom: 6,
  },
  h1: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "-0.03em",
    fontWeight: 950,
  },
  sub: {
    marginTop: 8,
    marginBottom: 0,
    fontSize: 14,
    color: "rgba(209,213,219,0.96)",
    maxWidth: 760,
    lineHeight: 1.7,
    whiteSpace: "normal",
    wordBreak: "normal",
    overflowWrap: "break-word",
  },

  actionButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
  },
  actionButtonsMobile: {
    width: "100%",
    justifyContent: "stretch",
    flexDirection: "column",
  },
  fullBtn: {
    width: "100%",
  },

  heroCard: {
    display: "flex",
    gap: 18,
    alignItems: "stretch",
    justifyContent: "space-between",
    flexWrap: "nowrap",
  },
  heroCardMobile: {
    flexDirection: "column",
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
  },
  heroPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(191,219,254,0.9)",
    background: "rgba(15,23,42,0.9)",
    fontSize: 11,
    color: "rgba(219,234,254,0.98)",
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(59,130,246,0.98)",
  },
  heroTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },
  heroText: {
    marginTop: 8,
    marginBottom: 0,
    fontSize: 13,
    lineHeight: 1.7,
    color: "rgba(226,232,240,0.96)",
  },
  heroRight: {
    width: 280,
    minWidth: 280,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 8,
  },
  heroRightMobile: {
    width: "100%",
    minWidth: 0,
  },

  selectLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(191,219,254,0.98)",
  },
  select: {
    width: "100%",
    minWidth: 0,
    height: 44,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.7)",
    background: "rgba(15,23,42,0.9)",
    color: "#E5E7EB",
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 700,
  },
  summaryMini: {
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
    lineHeight: 1.5,
  },

  loadingRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 20px rgba(56,189,248,0.70)",
  },
  loadingTitle: {
    fontSize: 13,
    fontWeight: 900,
  },
  loadingSub: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(209,213,219,0.96)",
  },

  errorCard: {
    border: "1px solid rgba(248,113,113,0.22)",
    background: "rgba(248,113,113,0.08)",
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#ffe6e6",
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    color: "#ffe6e6",
    lineHeight: 1.55,
  },

  emptyCard: {
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 950,
  },
  emptyText: {
    marginTop: 6,
    color: "rgba(209,213,219,0.96)",
    fontSize: 13,
    lineHeight: 1.65,
    marginBottom: 14,
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  memberCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  memberCardMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  memberMain: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flex: 1,
  },
  memberCopy: {
    minWidth: 0,
    flex: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 999,
    background: "rgba(37,99,235,0.18)",
    border: "1px solid rgba(59,130,246,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    color: "#E5E7EB",
    flexShrink: 0,
  },
  memberName: {
    fontSize: 14,
    fontWeight: 900,
    color: "#E5E7EB",
  },
  memberSub: {
    marginTop: 3,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
    lineHeight: 1.5,
  },

  roleBadge: {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    fontSize: 11,
    fontWeight: 800,
    flexShrink: 0,
    alignSelf: "center",
  },
  roleOwner: {
    borderColor: "rgba(249,115,22,0.9)",
    background: "rgba(248,113,113,0.12)",
    color: "#FED7AA",
  },
  roleAdmin: {
    borderColor: "rgba(59,130,246,0.9)",
    background: "rgba(59,130,246,0.12)",
    color: "#BFDBFE",
  },
  roleMember: {
    borderColor: "rgba(148,163,184,0.9)",
    background: "rgba(148,163,184,0.12)",
    color: "#E5E7EB",
  },

  primaryBtn: {
    padding: "11px 16px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.85)",
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(56,189,248,0.95))",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  ghostBtn: {
    padding: "11px 16px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(226,232,240,0.98)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
  },
};