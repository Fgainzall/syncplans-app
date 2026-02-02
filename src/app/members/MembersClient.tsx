// src/app/members/MembersClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import supabase from "@/lib/supabaseClient";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import {
  getActiveGroupIdFromDb,
  setActiveGroupIdInDb,
} from "@/lib/activeGroup";
import {
  getProfilesByIds,
  getInitials,
  type Profile,
} from "@/lib/profilesDb";

type MemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  created_at: string | null;
  isMe: boolean;
  profile: Profile | null;
  displayName: string;
  initials: string;
};

export default function MembersClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);

  // Cargar usuario actual (para marcar "Tú")
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

  // Cargar grupos + activeGroup
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

        // Intentar leer el group activo; si no hay, usar el primero
        let gid = await getActiveGroupIdFromDb().catch(() => null);

        if (!gid || !myGroups.some((g) => String(g.id) === String(gid))) {
          gid = String(myGroups[0].id);
          await setActiveGroupIdInDb(gid).catch(() => undefined);
        }

        if (!alive) return;
        setActiveGroupId(gid);
      } catch (e: any) {
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

  // Cargar miembros cuando cambia el grupo activo
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

        // Base rows sin info de perfil todavía
        const baseRows = (data ?? []).map((m: any) => ({
          id: String(m.id),
          group_id: String(m.group_id),
          user_id: String(m.user_id),
          role: String(m.role ?? "member"),
          created_at: m.created_at ?? null,
          isMe: meId != null && String(m.user_id) === String(meId),
        }));

        // Obtener perfiles para todos los user_id del grupo
        const userIds = Array.from(
          new Set(baseRows.map((m) => m.user_id).filter(Boolean))
        );

        let profilesById = new Map<string, Profile>();
        if (userIds.length > 0) {
          try {
            const profs = await getProfilesByIds(userIds);
            profs.forEach((p) => profilesById.set(p.id, p));
          } catch (e) {
            console.error("Error getProfilesByIds:", e);
          }
        }

        const enriched: MemberRow[] = baseRows.map((m) => {
          const p = profilesById.get(m.user_id) ?? null;
          const nameFromProfile = p
            ? `${p.first_name} ${p.last_name}`.trim()
            : null;

          const displayName = m.isMe
            ? "Tú"
            : nameFromProfile || "Miembro";

          const initials = p
            ? getInitials(p)
            : m.isMe
            ? "Tú"
            : (nameFromProfile ?? "Miembro")
                .charAt(0)
                .toUpperCase();

          return {
            ...m,
            profile: p,
            displayName,
            initials,
          };
        });

        if (!alive) return;
        setMembers(enriched);
      } catch (e: any) {
        console.error(e);
        if (alive)
          setErrorMsg("No pudimos cargar los miembros de este grupo.");
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

  const hasAnyGroup = groups.length > 0;
  const hasMembers = members.length > 0;

  return (
    <main style={S.page}>
      <div style={S.shell}>
        <PremiumHeader
          title="Miembros"
          subtitle="Quién está dentro de tu grupo y qué rol tiene cada uno."
        />

        {errorMsg && <div style={S.errorBox}>{errorMsg}</div>}

        {!hasAnyGroup ? (
          <section style={S.emptyWrap}>
            <div style={S.emptyCard}>
              <div style={S.emptyTitle}>Aún no tienes grupos</div>
              <div style={S.emptyText}>
                Crea un grupo de <strong>Pareja</strong> o{" "}
                <strong>Familia</strong> para empezar a invitar personas y
                compartir tu calendario.
              </div>
              <button
                type="button"
                style={S.primaryBtn}
                onClick={() => router.push("/groups/new")}
              >
                Crear mi primer grupo
              </button>
            </div>
          </section>
        ) : (
          <section style={S.card}>
            <div style={S.cardHeader}>
              <div>
                <h2 style={S.cardTitle}>Miembros del grupo</h2>
                <p style={S.cardSub}>
                  Gestiona quién forma parte de este grupo y revisa sus roles.
                </p>
                {activeGroup && (
                  <p style={S.cardGroupName}>
                    Grupo activo:{" "}
                    <strong>
                      {activeGroup.name || nombrePorTipo(activeGroup.type)}
                    </strong>
                  </p>
                )}
              </div>

              <div style={S.cardHeaderRight}>
                <div style={S.selectWrap}>
                  <label style={S.selectLabel}>Grupo activo</label>
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
                </div>

                <button type="button" style={S.secondaryBtn} onClick={goToInvite}>
                  Invitar miembro
                </button>
              </div>
            </div>

            {loading && !hasMembers ? (
              <div style={S.loadingText}>Cargando miembros…</div>
            ) : !hasMembers ? (
              <div style={S.membersEmpty}>
                <div style={S.membersEmptyTitle}>
                  Aún no hay más miembros en este grupo
                </div>
                <div style={S.membersEmptyText}>
                  En cuanto alguien acepte tu invitación, aparecerá aquí con su
                  rol asignado.
                </div>
                <button
                  type="button"
                  style={S.ghostBtn}
                  onClick={goToInvite}
                >
                  Enviar primera invitación
                </button>
              </div>
            ) : (
              <div style={S.list}>
                {members.map((m) => (
                  <MemberRowView key={m.id} member={m} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function labelForRole(role: string | null | undefined): string {
  if (!role) return "Miembro";

  switch (role) {
    case "owner":
      return "Admin"; // antes “Propietario”
    case "admin":
      return "Admin";
    case "member":
    default:
      return "Miembro";
  }
}

function MemberRowView({ member }: { member: MemberRow }) {
  const roleLabel = labelForRole(member.role);
  const isOwner = member.role === "owner";
  const isAdmin = member.role === "admin";

  return (
    <div style={S.row}>
      <div style={S.rowMain}>
        <div style={S.avatarCircle}>{member.initials}</div>
        <div>
          <div style={S.rowTitle}>{member.displayName}</div>
          <div style={S.rowSub}>
            {member.isMe
              ? "Este eres tú dentro del grupo."
              : "Miembro que comparte este grupo contigo."}
          </div>
        </div>
      </div>

      <div style={S.rowRight}>
        <span
          style={{
            ...S.roleBadge,
            ...(isOwner ? S.roleOwner : isAdmin ? S.roleAdmin : S.roleMember),
          }}
        >
          {roleLabel}
        </span>
      </div>
    </div>
  );
}

function nombrePorTipo(type: GroupRow["type"]): string {
  const t = String(type).toLowerCase();
  if (t === "pair" || t === "couple") return "Pareja";
  if (t === "family") return "Familia";
  return "Personal";
}

/* ────────────── Estilos ────────────── */

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050816",
    color: "rgba(248,250,252,0.98)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  shell: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 48px",
  },

  errorBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.7)",
    background: "rgba(127,29,29,0.75)",
    fontSize: 12,
  },

  emptyWrap: {
    marginTop: 18,
  },
  emptyCard: {
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.96)",
    padding: 18,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 900,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(148,163,184,0.96)",
    maxWidth: 460,
  },
  primaryBtn: {
    marginTop: 12,
    padding: "10px 16px",
    borderRadius: 999,
    border: "1px solid rgba(244,244,245,0.18)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.34), rgba(124,58,237,0.6))",
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },

  card: {
    marginTop: 18,
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.96)",
    padding: 16,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 900,
  },
  cardSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
  },
  cardGroupName: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(203,213,225,0.96)",
  },
  cardHeaderRight: {
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },

  selectWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  selectLabel: {
    fontSize: 11,
    color: "rgba(148,163,184,0.96)",
    fontWeight: 700,
  },
  select: {
    minWidth: 190,
    height: 34,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    background: "rgba(15,23,42,0.9)",
    color: "#E5E7EB",
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 600,
  },

  secondaryBtn: {
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    background: "rgba(15,23,42,0.9)",
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },

  loadingText: {
    marginTop: 14,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
  },

  membersEmpty: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    border: "1px dashed rgba(148,163,184,0.65)",
    background: "rgba(15,23,42,0.9)",
  },
  membersEmptyTitle: {
    fontSize: 13,
    fontWeight: 900,
  },
  membersEmptyText: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
  },
  ghostBtn: {
    marginTop: 10,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    background: "transparent",
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },

  list: {
    marginTop: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 18,
    border: "1px solid rgba(51,65,85,0.9)",
    background: "rgba(15,23,42,0.9)",
  },
  rowMain: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    background: "rgba(37,99,235,0.18)",
    border: "1px solid rgba(59,130,246,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    color: "#E5E7EB",
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#E5E7EB",
  },
  rowIdHint: {
    fontSize: 11,
    color: "rgba(148,163,184,0.9)",
    marginLeft: 4,
  },
  rowSub: {
    marginTop: 2,
    fontSize: 11,
    color: "rgba(148,163,184,0.96)",
  },
  rowRight: {},
  roleBadge: {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    fontSize: 11,
    fontWeight: 750,
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
};
