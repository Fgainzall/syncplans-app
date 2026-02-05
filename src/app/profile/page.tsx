// src/app/profile/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  getMyProfile,
  getInitials,
  createMyProfile,
  updateMyCoordinationPrefs,
  normalizeCoordinationPrefs,
  type CoordinationPrefs,
} from "@/lib/profilesDb";
import { getMyEvents, type DbEventRow } from "@/lib/eventsDb";
import {
  getMyGroups,
  getMyGroupMemberships,
  updateMyGroupMeta,
  getGroupTypeLabel,
  type GroupRow,
  type GroupMemberRow,
} from "@/lib/groupsDb";
import { computeVisibleConflicts } from "@/lib/conflicts";

/* ─────────────────── Tipos de UI ─────────────────── */

type UserUI = {
  name: string;
  email: string;
  verified: boolean;
  initials: string;
};

type DashboardStats = {
  totalEvents: number;
  eventsLast7: number;
  totalGroups: number;
  pairGroups: number;
  familyGroups: number;
  otherGroups: number;
  conflictsNow: number;
};

type Recommendation = {
  title: string;
  hint: string;
  ctaLabel?: string;
  ctaTarget?:
    | "groups_new"
    | "calendar"
    | "events_new"
    | "conflicts"
    | "invitations";
};

type PlanInfo = {
  planTier: string | null;
  planStatus: string | null;
  trialEndsAt: string | null;
};

type GroupFilter = "all" | "pair" | "family" | "other";

/* ─────────────────── Helpers locales ─────────────────── */

function normalizeCoordPrefs(
  prefs?: Partial<CoordinationPrefs> | null
): CoordinationPrefs {
  return normalizeCoordinationPrefs(
    prefs as CoordinationPrefs | null | undefined
  );
}

function buildPlanUi(plan: PlanInfo | null): { value: string; hint: string } {
  if (!plan) {
    return {
      value: "Demo Premium (beta)",
      hint: "Acceso completo mientras probamos SyncPlans.",
    };
  }

  const tier = (plan.planTier ?? "demo_premium").toLowerCase();
  const status = (plan.planStatus ?? "trial").toLowerCase();

  let value: string;
  if (tier === "free") {
    value = "Plan gratuito";
  } else if (tier === "premium") {
    value = status === "trial" ? "Premium (prueba)" : "Premium";
  } else {
    // demo_premium u otros
    value = status === "trial" ? "Demo Premium (prueba)" : "Demo Premium";
  }

  let hint = "Acceso completo mientras pruebas SyncPlans.";

  if (status === "active") {
    if (tier === "free") {
      hint = "Funciones básicas para organizar tu tiempo.";
    } else {
      hint = "Funciones premium activas para tu cuenta.";
    }
  } else if (status === "trial") {
    if (plan.trialEndsAt) {
      const end = new Date(plan.trialEndsAt);
      if (!isNaN(end.getTime())) {
        const today = new Date();
        const msDiff = end.getTime() - today.getTime();
        const daysDiff = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) {
          hint = `Tu prueba termina en aproximadamente ${daysDiff} día${
            daysDiff === 1 ? "" : "s"
          }`;
        } else {
          hint = "Tu periodo de prueba está por terminar.";
        }
      }
    }
  }

  return { value, hint };
}

function membershipHasMeta(m: GroupMemberRow): boolean {
  return (
    !!m.display_name ||
    !!m.relationship_role ||
    !!m.coordination_prefs?.group_note
  );
}

/* ─────────────────── Componente principal ─────────────────── */

export default function ProfilePage() {
  const router = useRouter();

  // 🔹 Estado base
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserUI | null>(null);

  // 🔹 Formulario de nombre/apellido
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  // 🔹 Stats de uso
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // 🔹 Plan / monetización (solo lectura de momento)
  const [plan, setPlan] = useState<PlanInfo | null>(null);

  // 🔹 Grupos y memberships (para “Tu rol en los grupos”)
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [memberships, setMemberships] = useState<GroupMemberRow[] | null>(null);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [membershipsError, setMembershipsError] = useState<string | null>(null);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [groupSaveMessage, setGroupSaveMessage] = useState<string | null>(null);
  const [groupSaveError, setGroupSaveError] = useState<string | null>(null);

  // 🔹 Master–detail de grupos
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [groupSearch, setGroupSearch] = useState("");
  const [dirtyGroups, setDirtyGroups] = useState<Set<string>>(new Set());

  // 🔹 Preferencias de coordinación globales
  const [coordPrefs, setCoordPrefs] = useState<CoordinationPrefs | null>(null);
  const [savingCoord, setSavingCoord] = useState(false);
  const [saveCoordError, setSaveCoordError] = useState<string | null>(null);
  const [saveCoordOk, setSaveCoordOk] = useState<string | null>(null);

  // ── 1) Cargar sesión + perfil + nombre visual + plan ──
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error || !data.session?.user) {
          router.replace("/auth/login?next=/profile");
          return;
        }

        const u = data.session.user;

        // Nombre base desde metadata o email
        let baseName =
          (u.user_metadata?.full_name as string) ||
          (u.user_metadata?.name as string) ||
          (u.email ? u.email.split("@")[0] : "Usuario");

        const email = u.email ?? "—";
        const verified = !!u.email_confirmed_at;

        let finalName = baseName;
        let initials =
          baseName && baseName.length > 0
            ? baseName.charAt(0).toUpperCase()
            : "U";

        let localFirst = "";
        let localLast = "";
        let localCoordPrefs: CoordinationPrefs | null = null;
        let localPlan: PlanInfo | null = null;

        // Intentar leer perfil real desde la tabla `profiles`
        try {
          const profile = await getMyProfile();
          if (profile) {
            const dn = (
              profile.display_name ??
              `${profile.first_name ?? ""} ${profile.last_name ?? ""}`
            ).trim();

            if (dn) {
              finalName = dn;
            }

            initials = getInitials({
              first_name: profile.first_name ?? undefined,
              last_name: profile.last_name ?? undefined,
              display_name: profile.display_name ?? undefined,
            });

            localFirst = (profile.first_name ?? "").trim();
            localLast = (profile.last_name ?? "").trim();
            localCoordPrefs = normalizeCoordPrefs(
              profile.coordination_prefs ?? null
            );

            localPlan = {
              planTier: profile.plan_tier ?? null,
              planStatus: profile.plan_status ?? null,
              trialEndsAt: profile.trial_ends_at ?? null,
            };
          } else {
            // Inferir de baseName si no hay perfil
            const parts = baseName.trim().split(/\s+/);
            if (parts.length >= 2) {
              localFirst = parts[0];
              localLast = parts.slice(1).join(" ");
            } else {
              localFirst = baseName.trim();
              localLast = "";
            }
            localCoordPrefs = normalizeCoordPrefs(null);
            localPlan = {
              planTier: "demo_premium",
              planStatus: "trial",
              trialEndsAt: null,
            };
          }
        } catch (e) {
          console.error("Error leyendo perfil desde DB:", e);
          localCoordPrefs = normalizeCoordPrefs(null);
          localPlan = {
            planTier: "demo_premium",
            planStatus: "trial",
            trialEndsAt: null,
          };
        }

        if (!alive) return;

        setUser({
          name: finalName,
          email,
          verified,
          initials,
        });

        setFirstName(localFirst);
        setLastName(localLast);
        setCoordPrefs(localCoordPrefs);
        setPlan(localPlan);
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  // ── 2) Cargar stats de uso + grupos ──
  useEffect(() => {
    if (!user) return;
    let alive = true;

    (async () => {
      try {
        setStatsLoading(true);
        const [events, groupsRows] = await Promise.all([
          getMyEvents(),
          getMyGroups(),
        ]);
        if (!alive) return;

        const nextStats = buildDashboardStats(events, groupsRows);
        setStats(nextStats);
        setGroups(groupsRows);
      } catch (e) {
        console.error("[ProfilePage] Error cargando stats:", e);
        if (!alive) return;
        setStats(null);
        setGroups(null);
      } finally {
        if (!alive) return;
        setStatsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  // ── 3) Cargar memberships para “Tu rol en los grupos” ──
  useEffect(() => {
    if (!user) return;
    let alive = true;

    (async () => {
      try {
        setMembershipsLoading(true);
        setMembershipsError(null);
        const ms = await getMyGroupMemberships();
        if (!alive) return;
        setMemberships(ms);
      } catch (err: any) {
        console.error("[ProfilePage] Error cargando memberships:", err);
        if (!alive) return;
        setMemberships(null);
        setMembershipsError(
          "No pudimos cargar tus roles en los grupos. Intenta recargar la página."
        );
      } finally {
        if (!alive) return;
        setMembershipsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  // ── 3b) Elegir grupo seleccionado por defecto (pareja > primero) ──
  useEffect(() => {
    if (!memberships || memberships.length === 0) {
      setSelectedGroupId(null);
      return;
    }

    setSelectedGroupId((prev) => {
      if (prev) return prev;

      if (groups && groups.length > 0) {
        const byId = new Map<string, GroupRow>();
        groups.forEach((g) => byId.set(g.id, g));

        const pairMembership = memberships.find((m) => {
          const g = byId.get(m.group_id);
          const t = String(g?.type ?? "").toLowerCase();
          return t === "pair" || t === "couple";
        });

        if (pairMembership) return pairMembership.group_id;
      }

      return memberships[0].group_id;
    });
  }, [memberships, groups]);

  // ── 4) Guardar perfil (nombre / apellido) ──
  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveOk(null);

    const fn = firstName.trim();
    const ln = lastName.trim();

    if (!fn || !ln) {
      setSaveError("Nombre y apellido son obligatorios.");
      return;
    }

    try {
      setSaving(true);
      const profile = await createMyProfile({
        first_name: fn,
        last_name: ln,
      });

      const baseDisplay = (
        profile.display_name ??
        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`
      ).trim();

      const newDisplay: string = baseDisplay || user?.name || "Usuario";

      const newInitials = getInitials({
        first_name: profile.first_name ?? undefined,
        last_name: profile.last_name ?? undefined,
        display_name: profile.display_name ?? undefined,
      });

      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: newDisplay,
              initials: newInitials,
            }
          : prev
      );

      setSaveOk("Perfil actualizado correctamente.");
    } catch (err: any) {
      console.error("Error guardando perfil:", err);
      setSaveError(
        typeof err?.message === "string"
          ? err.message
          : "No se pudo actualizar tu perfil. Intenta de nuevo."
      );
    } finally {
      setSaving(false);
    }
  }

  // ── 5) Guardar preferencias de coordinación ──
  async function onSaveCoordPrefs(e: React.FormEvent) {
    e.preventDefault();
    if (!coordPrefs) return;
    setSaveCoordError(null);
    setSaveCoordOk(null);

    try {
      setSavingCoord(true);

      const profile = await getMyProfile();
      if (!profile || !profile.display_name) {
        setSaveCoordError(
          "Antes de guardar tus preferencias, completa tu nombre y apellido arriba."
        );
        return;
      }

      await updateMyCoordinationPrefs(coordPrefs);
      setSaveCoordOk("Preferencias guardadas correctamente.");
    } catch (err: any) {
      console.error("Error guardando preferencias de coordinación:", err);
      setSaveCoordError(
        typeof err?.message === "string"
          ? err.message
          : "No se pudieron guardar tus preferencias. Intenta de nuevo."
      );
    } finally {
      setSavingCoord(false);
    }
  }

  // ── 6) Editar metadata de membership (estado local) ──
  function updateMembershipLocal(
    groupId: string,
    updater: (prev: GroupMemberRow) => GroupMemberRow
  ) {
    setMemberships((prev) => {
      if (!prev) return prev;
      return prev.map((m) => (m.group_id === groupId ? updater(m) : m));
    });

    setDirtyGroups((prev) => {
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });
  }

  function handleMembershipFieldChange(
    groupId: string,
    field: "display_name" | "relationship_role" | "group_note",
    value: string
  ) {
    updateMembershipLocal(groupId, (m) => {
      if (field === "display_name") {
        return { ...m, display_name: value };
      }
      if (field === "relationship_role") {
        return { ...m, relationship_role: value };
      }
      if (field === "group_note") {
        const nextPrefs = {
          ...(m.coordination_prefs ?? {}),
          group_note: value,
        };
        return {
          ...m,
          coordination_prefs: nextPrefs,
        };
      }
      return m;
    });
  }

  async function handleSaveGroupMeta(groupId: string) {
    if (!memberships) return;
    const m = memberships.find((mm) => mm.group_id === groupId);
    if (!m) return;

    setGroupSaveMessage(null);
    setGroupSaveError(null);
    setSavingGroupId(groupId);

    try {
      await updateMyGroupMeta(groupId, {
        display_name: m.display_name ?? null,
        relationship_role: m.relationship_role ?? null,
        coordination_prefs: m.coordination_prefs ?? null,
      });

      setGroupSaveMessage("Cambios guardados para este grupo.");

      setDirtyGroups((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    } catch (err: any) {
      console.error("Error guardando metadata de grupo:", err);
      setGroupSaveError(
        typeof err?.message === "string"
          ? err.message
          : "No se pudieron guardar los cambios. Intenta de nuevo."
      );
    } finally {
      setSavingGroupId(null);
    }
  }

  // ── 7) Pantallas de carga / sin user ──
  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.headerRow}>
            <PremiumHeader
              title="Panel"
              subtitle="Tu panel de cuenta en SyncPlans."
              rightSlot={<LogoutButton />}
            />
          </div>
          <div style={styles.loadingRow}>
            <div style={styles.loadingCard} />
            <div style={styles.loadingCard} />
          </div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  // ── 8) Derivados de UI (sin hooks) ──
  const accountStatusLabel = user.verified
    ? "Cuenta verificada"
    : "Verifica tu correo";
  const accountStatusHint = user.verified
    ? "Tu correo está confirmado."
    : "Busca el correo de confirmación en tu bandeja o spam.";

  const recommendation: Recommendation | null = buildRecommendation(
    user,
    stats
  );

  const coord = normalizeCoordPrefs(coordPrefs);
  const hasCoordPrefsMeaningful =
    coord.prefers_mornings ||
    coord.prefers_evenings ||
    coord.prefers_weekdays ||
    coord.prefers_weekends ||
    !!coord.blocked_note?.trim() ||
    coord.decision_style !== "depends";

  const hasNameCompleted = !!firstName.trim() && !!lastName.trim();

  const groupsById = new Map<string, GroupRow>();
  (groups ?? []).forEach((g) => groupsById.set(g.id, g));

  const membershipsSorted: GroupMemberRow[] =
    memberships && groups
      ? [...memberships].sort((a, b) => {
          const ga = groupsById.get(a.group_id);
          const gb = groupsById.get(b.group_id);
          return (ga?.name ?? "").localeCompare(gb?.name ?? "");
        })
      : memberships ?? [];

  const hasGroupMeta =
    memberships &&
    memberships.length > 0 &&
    memberships.some((m) => membershipHasMeta(m));

  const planUi = buildPlanUi(plan);

  function handleRecommendationClick(target: Recommendation["ctaTarget"]) {
    if (!target) return;
    if (target === "groups_new") router.push("/groups/new");
    else if (target === "calendar") router.push("/calendar");
    else if (target === "events_new")
      router.push("/events/new/details?type=personal");
    else if (target === "conflicts") router.push("/conflicts/detected");
    else if (target === "invitations") router.push("/invitations");
  }

  // Filtro + búsqueda para lista de grupos
  const searchTerm = groupSearch.trim().toLowerCase();
  const membershipsFiltered = membershipsSorted.filter((m) => {
    const g = groupsById.get(m.group_id);
    const typeRaw = String(g?.type ?? "");
    const typeStr = typeRaw.toLowerCase();

    if (groupFilter === "pair" && !(typeStr === "pair" || typeStr === "couple"))
      return false;
    if (groupFilter === "family" && typeStr !== "family") return false;
    if (
      groupFilter === "other" &&
      (typeStr === "pair" || typeStr === "family" || typeStr === "couple")
    )
      return false;

    if (!searchTerm) return true;

    const name = (g?.name ?? "").toLowerCase();
    const displayName = (m.display_name ?? "").toLowerCase();
    return (
      name.includes(searchTerm) ||
      displayName.includes(searchTerm) ||
      typeStr.includes(searchTerm)
    );
  });

  const selectedMembership: GroupMemberRow | null =
    membershipsFiltered.find((m) => m.group_id === selectedGroupId) ??
    membershipsFiltered[0] ??
    null;

  const totalGroupsForRoles = memberships ? memberships.length : 0;
  const configuredGroupsCount = memberships
    ? memberships.filter(membershipHasMeta).length
    : 0;
  const pendingGroupsCount =
    totalGroupsForRoles - configuredGroupsCount >= 0
      ? totalGroupsForRoles - configuredGroupsCount
      : 0;

  const hasSelectedDirty =
    selectedMembership && dirtyGroups.has(selectedMembership.group_id);

  // ── 9) Render principal ──
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {/* Header premium + logout */}
        <div style={styles.headerRow}>
          <PremiumHeader
            title="Panel"
            subtitle="Tu estado de cuenta, identidad y atajos clave en un solo lugar."
            rightSlot={<LogoutButton />}
          />
        </div>

        {/* GRID: Izquierda (identidad) / Derecha (estado & acciones) */}
        <div style={styles.mainGrid}>
          {/* Columna izquierda */}
          <div style={styles.leftCol}>
            {/* Identidad */}
            <section style={styles.card}>
              <div style={styles.sectionLabel}>Identidad</div>

              <div style={styles.profileRow}>
                <div style={styles.avatar}>{user.initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.nameRow}>
                    <span style={styles.name}>{user.name}</span>
                    <span
                      style={{
                        ...styles.chip,
                        borderColor: user.verified
                          ? "rgba(34,197,94,0.40)"
                          : "rgba(250,204,21,0.40)",
                        background: user.verified
                          ? "rgba(34,197,94,0.10)"
                          : "rgba(250,204,21,0.12)",
                      }}
                    >
                      {user.verified ? "Verificada" : "Por verificar"}
                    </span>
                  </div>
                  <div style={styles.email}>{user.email}</div>
                </div>
              </div>

              <div style={styles.divider} />

              <div style={styles.smallGrid}>
                <InfoStat
                  label="Plan actual"
                  value={planUi.value}
                  hint={planUi.hint}
                />
                <InfoStat
                  label="Grupos activos"
                  value={
                    statsLoading
                      ? "—"
                      : stats
                      ? `${stats.totalGroups} grupo${
                          stats.totalGroups === 1 ? "" : "s"
                        }`
                      : "—"
                  }
                  hint={
                    stats && stats.totalGroups > 0
                      ? `Pareja: ${stats.pairGroups} · Familia: ${stats.familyGroups} · Compartidos: ${stats.otherGroups}`
                      : "Crea un grupo para compartir calendario y conflictos."
                  }
                />
              </div>
            </section>

            {/* Edición de nombre */}
            <section style={styles.card}>
              <div style={styles.sectionLabel}>Cómo te ve el resto</div>
              <div style={styles.sectionSub}>
                Este nombre se usa en miembros, invitaciones y notificaciones
                compartidas.
              </div>

              <form onSubmit={onSaveProfile} style={styles.form}>
                <div style={styles.formRow}>
                  <div style={styles.field}>
                    <label style={styles.label}>Nombre</label>
                    <input
                      style={styles.input}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Fernando"
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Apellido</label>
                    <input
                      style={styles.input}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Gainza Llosa"
                    />
                  </div>
                </div>

                {saveError && <div style={styles.error}>{saveError}</div>}
                {saveOk && <div style={styles.ok}>{saveOk}</div>}

                <div style={styles.formActions}>
                  <button
                    type="button"
                    onClick={() => router.push("/summary")}
                    style={styles.ghostBtn}
                  >
                    Ver resumen semanal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      ...styles.primaryBtn,
                      opacity: saving ? 0.7 : 1,
                      cursor: saving ? "progress" : "pointer",
                    }}
                  >
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </section>

            {/* Preferencias de coordinación */}
            <section style={styles.card}>
              <div style={styles.sectionLabel}>
                Cómo sueles organizar tu tiempo
              </div>
              <div style={styles.sectionSub}>
                Estas preferencias ayudan a SyncPlans a anticipar fricciones y
                mostrar mejores decisiones cuando hay choques de horario.
              </div>

              <form onSubmit={onSaveCoordPrefs} style={styles.coordForm}>
                <div style={styles.coordGrid}>
                  <div style={styles.coordCol}>
                    <div style={styles.coordLabel}>Ritmo del día</div>
                    <label style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={coord.prefers_mornings}
                        onChange={(e) =>
                          setCoordPrefs((prev) =>
                            normalizeCoordPrefs({
                              ...(prev ?? {}),
                              prefers_mornings: e.target.checked,
                            })
                          )
                        }
                      />
                      <span>Soy más de madrugar</span>
                    </label>
                    <label style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={coord.prefers_evenings}
                        onChange={(e) =>
                          setCoordPrefs((prev) =>
                            normalizeCoordPrefs({
                              ...(prev ?? {}),
                              prefers_evenings: e.target.checked,
                            })
                          )
                        }
                      />
                      <span>Soy más nocturno</span>
                    </label>
                  </div>

                  <div style={styles.coordCol}>
                    <div style={styles.coordLabel}>Cuándo prefieres planear</div>
                    <label style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={coord.prefers_weekdays}
                        onChange={(e) =>
                          setCoordPrefs((prev) =>
                            normalizeCoordPrefs({
                              ...(prev ?? {}),
                              prefers_weekdays: e.target.checked,
                            })
                          )
                        }
                      />
                      <span>Entre semana</span>
                    </label>
                    <label style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={coord.prefers_weekends}
                        onChange={(e) =>
                          setCoordPrefs((prev) =>
                            normalizeCoordPrefs({
                              ...(prev ?? {}),
                              prefers_weekends: e.target.checked,
                            })
                          )
                        }
                      />
                      <span>Fines de semana</span>
                    </label>
                  </div>
                </div>

                <div style={styles.coordFieldBlock}>
                  <div style={styles.coordLabel}>
                    Horarios que casi siempre tienes ocupados
                  </div>
                  <textarea
                    style={styles.textarea}
                    rows={3}
                    value={coord.blocked_note}
                    onChange={(e) =>
                      setCoordPrefs((prev) =>
                        normalizeCoordPrefs({
                          ...(prev ?? {}),
                          blocked_note: e.target.value,
                        })
                      )
                    }
                    placeholder="Ej: Lunes y miércoles de 7 a 9 pm entreno."
                  />
                </div>

                <div style={styles.coordFieldBlock}>
                  <div style={styles.coordLabel}>
                    Cuando hay conflictos de horario, normalmente prefieres…
                  </div>
                  <select
                    style={styles.select}
                    value={coord.decision_style ?? "depends"}
                    onChange={(e) =>
                      setCoordPrefs((prev) =>
                        normalizeCoordPrefs({
                          ...(prev ?? {}),
                          decision_style:
                            e.target.value as CoordinationPrefs["decision_style"],
                        })
                      )
                    }
                  >
                    <option value="decide_fast">Decidir rápido y seguir</option>
                    <option value="discuss">Hablarlo con calma</option>
                    <option value="depends">Depende del evento</option>
                  </select>
                </div>

                {saveCoordError && (
                  <div style={styles.error}>{saveCoordError}</div>
                )}
                {saveCoordOk && <div style={styles.ok}>{saveCoordOk}</div>}

                <div style={styles.coordActions}>
                  <button
                    type="submit"
                    disabled={savingCoord}
                    style={{
                      ...styles.primaryBtn,
                      opacity: savingCoord ? 0.7 : 1,
                      cursor: savingCoord ? "progress" : "pointer",
                    }}
                  >
                    {savingCoord ? "Guardando…" : "Guardar preferencias"}
                  </button>
                </div>
              </form>
            </section>
          </div>

          {/* Columna derecha */}
          <div style={styles.rightCol}>
            {/* Estado general */}
            <section style={styles.card}>
              <div style={styles.sectionLabel}>Estado general</div>
              <div style={styles.sectionSub}>
                Revisa de un vistazo cómo está tu cuenta en SyncPlans.
              </div>

              <div style={styles.accountStatusRow}>
                <div style={styles.statusIcon}>
                  {user.verified ? "✅" : "⚠️"}
                </div>
                <div>
                  <div style={styles.statusTitle}>{accountStatusLabel}</div>
                  <div style={styles.statusHint}>{accountStatusHint}</div>
                </div>
              </div>

              <div style={styles.smallGrid}>
                <InfoStat
                  label="Eventos creados"
                  value={
                    statsLoading
                      ? "—"
                      : stats
                      ? `${stats.totalEvents}`
                      : "—"
                  }
                  hint={
                    stats && stats.eventsLast7 > 0
                      ? `${stats.eventsLast7} en los últimos 7 días.`
                      : "Empieza creando tu primer evento en el calendario."
                  }
                />
                <InfoStat
                  label="Conflictos detectados"
                  value={
                    statsLoading
                      ? "—"
                      : stats
                      ? `${stats.conflictsNow}`
                      : "—"
                  }
                  hint={
                    stats && stats.conflictsNow > 0
                      ? "Tienes choques activos listos para revisar."
                      : "Detectamos conflictos en el momento en que guardas eventos."
                  }
                />
              </div>

              {/* Estado de configuración */}
              <div style={styles.configStatusBox}>
                <div style={styles.configStatusTitle}>
                  Cómo vas con tu configuración
                </div>
                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>
                    {hasNameCompleted ? "✅" : "⏳"}
                  </span>
                  <span>Nombre y apellido definidos</span>
                </div>
                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>
                    {hasCoordPrefsMeaningful ? "✅" : "⏳"}
                  </span>
                  <span>Preferencias de tiempo configuradas</span>
                </div>
                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>
                    {hasGroupMeta ? "✅" : "⏳"}
                  </span>
                  <span>Roles y nombres en grupos configurados</span>
                </div>
              </div>

              {/* Próximo paso recomendado */}
              {recommendation && (
                <div style={styles.recoCard}>
                  <div style={styles.recoTitle}>
                    Próximo paso recomendado
                  </div>
                  <div style={styles.recoMain}>{recommendation.title}</div>
                  <div style={styles.recoHint}>{recommendation.hint}</div>
                  {recommendation.ctaLabel && recommendation.ctaTarget && (
                    <button
                      type="button"
                      onClick={() =>
                        handleRecommendationClick(
                          recommendation.ctaTarget!
                        )
                      }
                      style={styles.recoBtn}
                    >
                      {recommendation.ctaLabel}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Tu rol en los grupos – Master–Detail */}
            <section style={styles.card}>
              <div style={styles.sectionLabel}>Tu rol en los grupos</div>
              <div style={styles.sectionSub}>
                No eres la misma persona en todos tus calendarios. Aquí defines
                cómo te ve cada grupo.
              </div>

              {membershipsLoading && (
                <div style={styles.smallInfo}>
                  Cargando tus grupos y roles…
                </div>
              )}

              {membershipsError && (
                <div style={styles.error}>{membershipsError}</div>
              )}

              {!membershipsLoading &&
                (!memberships || memberships.length === 0) && (
                  <div style={styles.smallInfo}>
                    Aún no perteneces a ningún grupo. Empieza creando uno desde
                    la sección de grupos.
                  </div>
                )}

              {memberships && memberships.length > 0 && (
                <>
                  {/* Resumen */}
                  <div style={styles.groupSummaryRow}>
                    <span>
                      Tienes{" "}
                      <strong>{totalGroupsForRoles}</strong> grupo
                      {totalGroupsForRoles === 1 ? "" : "s"} ·{" "}
                      <strong>{configuredGroupsCount}</strong> con rol
                      configurado ·{" "}
                      <strong>{pendingGroupsCount}</strong> pendiente
                      {pendingGroupsCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div style={styles.groupMasterDetail}>
                    {/* Columna izquierda: lista de grupos */}
                    <div style={styles.groupListCol}>
                      <div style={styles.groupListHeader}>
                        <div style={styles.groupFilterChips}>
                          <button
                            type="button"
                            onClick={() => setGroupFilter("all")}
                            style={{
                              ...styles.groupFilterChip,
                              ...(groupFilter === "all"
                                ? styles.groupFilterChipActive
                                : {}),
                            }}
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroupFilter("pair")}
                            style={{
                              ...styles.groupFilterChip,
                              ...(groupFilter === "pair"
                                ? styles.groupFilterChipActive
                                : {}),
                            }}
                          >
                            Pareja
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroupFilter("family")}
                            style={{
                              ...styles.groupFilterChip,
                              ...(groupFilter === "family"
                                ? styles.groupFilterChipActive
                                : {}),
                            }}
                          >
                            Familia
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroupFilter("other")}
                            style={{
                              ...styles.groupFilterChip,
                              ...(groupFilter === "other"
                                ? styles.groupFilterChipActive
                                : {}),
                            }}
                          >
                            Compartidos
                          </button>
                        </div>
                        <input
                          style={styles.groupSearchInput}
                          placeholder="Buscar grupo…"
                          value={groupSearch}
                          onChange={(e) => setGroupSearch(e.target.value)}
                        />
                      </div>

                      <div style={styles.groupListScroll}>
                        {membershipsFiltered.length === 0 && (
                          <div style={styles.groupListEmpty}>
                            No hay grupos que coincidan con el filtro.
                          </div>
                        )}

                        {membershipsFiltered.map((m) => {
                          const g = groupsById.get(m.group_id);
                          const groupName =
                            g?.name ?? "(Grupo sin nombre)";
                          const typeRaw = String(g?.type ?? "grupo");
                          const typeLabel = getGroupTypeLabel(typeRaw);
                          const isSelected = m.group_id === selectedGroupId;
                          const isConfigured = membershipHasMeta(m);
                          const isDirty = dirtyGroups.has(m.group_id);

                          return (
                            <button
                              key={m.group_id}
                              type="button"
                              onClick={() => setSelectedGroupId(m.group_id)}
                              style={{
                                ...styles.groupListItem,
                                ...(isSelected
                                  ? styles.groupListItemActive
                                  : {}),
                              }}
                            >
                              <div style={styles.groupListItemTitleRow}>
                                <div style={styles.groupListItemName}>
                                  <span style={styles.groupListItemDot} />
                                  <span>{groupName}</span>
                                </div>
                                <span style={styles.badgeTiny}>
                                  {typeLabel}
                                </span>
                              </div>
                              <div style={styles.groupListItemMeta}>
                                <span style={styles.groupListItemStatus}>
                                  {isConfigured
                                    ? "Rol configurado"
                                    : "Sin rol todavía"}
                                </span>
                                {isDirty && (
                                  <span style={styles.groupListItemDirty}>
                                    · Cambios sin guardar
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Columna derecha: detalle del grupo seleccionado */}
                    <div style={styles.groupDetailCol}>
                      {!selectedMembership ? (
                        <div style={styles.smallInfo}>
                          Selecciona un grupo de la lista de la izquierda para
                          definir cómo te ven en ese calendario.
                        </div>
                      ) : (
                        <>
                          <div style={styles.groupMetaHeader}>
                            <div>
                              <div style={styles.groupMetaTitle}>
                                {groupsById.get(selectedMembership.group_id)
                                  ?.name ?? "(Grupo sin nombre)"}
                              </div>
                              <div style={styles.groupMetaSubtitle}>
                                Define tu nombre visible, tu rol y un contexto
                                rápido para coordinar contigo.
                              </div>
                            </div>
                            <span style={styles.badgeTiny}>
                              {getGroupTypeLabel(
                                String(
                                  groupsById.get(
                                    selectedMembership.group_id
                                  )?.type ?? "grupo"
                                )
                              )}
                            </span>
                          </div>

                          <div style={styles.groupMetaFieldRow}>
                            <div style={styles.groupMetaField}>
                              <div style={styles.groupMetaLabel}>
                                Nombre visible en este grupo
                              </div>
                              <input
                                style={styles.groupMetaInput}
                                value={selectedMembership.display_name ?? ""}
                                onChange={(e) =>
                                  handleMembershipFieldChange(
                                    selectedMembership.group_id,
                                    "display_name",
                                    e.target.value
                                  )
                                }
                                placeholder="Ej: Fer, Papá, Fernando"
                              />
                            </div>
                          </div>

                          <div style={styles.groupMetaFieldRow}>
                            <div style={styles.groupMetaField}>
                              <div style={styles.groupMetaLabel}>
                                Rol en este grupo
                              </div>
                              <select
                                style={styles.groupMetaSelect}
                                value={selectedMembership.relationship_role ?? ""}
                                onChange={(e) =>
                                  handleMembershipFieldChange(
                                    selectedMembership.group_id,
                                    "relationship_role",
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">(Sin especificar)</option>
                                <option value="pareja">Pareja</option>
                                <option value="padre_madre">
                                  Padre / Madre
                                </option>
                                <option value="hijo_hija">Hijo / Hija</option>
                                <option value="tutor">Tutor</option>
                                <option value="otro">Otro</option>
                              </select>
                            </div>
                          </div>

                          <div style={styles.groupMetaFieldRow}>
                            <div style={styles.groupMetaField}>
                              <div style={styles.groupMetaLabel}>
                                Algo que deberían saber al coordinar contigo
                              </div>
                              <textarea
                                style={styles.groupMetaTextarea}
                                rows={2}
                                value={
                                  selectedMembership.coordination_prefs
                                    ?.group_note ?? ""
                                }
                                onChange={(e) =>
                                  handleMembershipFieldChange(
                                    selectedMembership.group_id,
                                    "group_note",
                                    e.target.value
                                  )
                                }
                                placeholder="Ej: Los domingos casi siempre priorizo familia."
                              />
                            </div>
                          </div>

                          {groupSaveError && (
                            <div style={styles.error}>{groupSaveError}</div>
                          )}
                          {groupSaveMessage && (
                            <div style={styles.ok}>{groupSaveMessage}</div>
                          )}

                          <div style={styles.groupMetaSaveRow}>
                            <button
                              type="button"
                              onClick={() =>
                                handleSaveGroupMeta(
                                  selectedMembership.group_id
                                )
                              }
                              disabled={
                                savingGroupId === selectedMembership.group_id ||
                                !hasSelectedDirty
                              }
                              style={{
                                ...styles.groupMetaSaveBtn,
                                opacity:
                                  savingGroupId === selectedMembership.group_id
                                    ? 0.7
                                    : hasSelectedDirty
                                    ? 1
                                    : 0.55,
                                cursor:
                                  savingGroupId === selectedMembership.group_id
                                    ? "progress"
                                    : hasSelectedDirty
                                    ? "pointer"
                                    : "default",
                              }}
                            >
                              {savingGroupId === selectedMembership.group_id
                                ? "Guardando…"
                                : "Guardar cambios en este grupo"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/calendar?group=${selectedMembership.group_id}`
                                )
                              }
                              style={styles.groupMetaCalendarBtn}
                            >
                              Ver calendario de este grupo
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Uso / acciones rápidas */}
            <section style={styles.card}>
              <div style={styles.sectionLabel}>Uso y acciones rápidas</div>
              <div style={styles.sectionSub}>
                Atajos a lo que normalmente haces desde SyncPlans.
              </div>

              <div style={styles.quickActionsGrid}>
                <QuickAction
                  title="Ir al calendario"
                  hint="Ver tu semana y crear nuevas actividades."
                  onClick={() => router.push("/calendar")}
                />
                <QuickAction
                  title="Revisar conflictos"
                  hint="Detectar choques y decidir qué hacer con ellos."
                  onClick={() => router.push("/conflicts/detected")}
                />
                <QuickAction
                  title="Gestionar grupos"
                  hint="Pareja, familia o grupos con los que organizas tu tiempo."
                  onClick={() => router.push("/groups")}
                />
                <QuickAction
                  title="Invitar a alguien"
                  hint="Envía invitaciones para compartir eventos y conflictos."
                  onClick={() => router.push("/invitations")}
                />
              </div>
            </section>
          </div>
        </div>

        {/* Footer de valor */}
        <div style={styles.footer}>
          SyncPlans está pensado para que tu calendario personal, de pareja,
          familia y grupos compartidos convivan sin fricciones. Este panel es tu
          centro de control.
        </div>
      </div>
    </main>
  );
}

/* ───────────────────── HELPERS DE STATS ───────────────────── */

function buildDashboardStats(
  events: DbEventRow[],
  groups: GroupRow[]
): DashboardStats {
  const totalEvents = events.length;

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const eventsLast7 = events.filter((e) => {
    const t = new Date(e.start).getTime();
    return Number.isFinite(t) && t >= sevenDaysAgo;
  }).length;

  const totalGroups = groups.length;
  const pairGroups = groups.filter((g) => {
    const t = String(g.type).toLowerCase();
    return t === "pair" || t === "couple";
  }).length;
  const familyGroups = groups.filter((g) => {
    const t = String(g.type).toLowerCase();
    return t === "family";
  }).length;
  const otherGroups = groups.filter((g) => {
    const t = String(g.type).toLowerCase();
    return t !== "pair" && t !== "couple" && t !== "family";
  }).length;

  const eventsForConflicts = events.map((e) => ({
    id: e.id,
    title: e.title ?? "(Sin título)",
    start: e.start,
    end: e.end,
    groupType: e.group_id ? ("family" as const) : ("personal" as const),
    groupId: e.group_id,
  }));

  const conflicts = computeVisibleConflicts(eventsForConflicts);

  return {
    totalEvents,
    eventsLast7,
    totalGroups,
    pairGroups,
    familyGroups,
    otherGroups,
    conflictsNow: conflicts.length,
  };
}

/* ───────────────────── RECOMENDACIÓN ───────────────────── */

function buildRecommendation(
  user: UserUI | null,
  stats: DashboardStats | null
): Recommendation | null {
  if (!user) return null;

  // 1) Primero seguridad
  if (!user.verified) {
    return {
      title: "Verifica tu correo",
      hint: "Cerrar el ciclo de verificación protege tus grupos y eventos compartidos.",
    };
  }

  if (!stats) return null;

  // 2) Sin grupos
  if (stats.totalGroups === 0) {
    return {
      title: "Crea tu primer grupo",
      hint: "Empieza por un grupo de pareja o familia para compartir eventos y conflictos. Luego suma grupos compartidos como amigos o equipos.",
      ctaLabel: "Crear grupo",
      ctaTarget: "groups_new",
    };
  }

  // 3) Con grupos pero sin eventos
  if (stats.totalEvents === 0) {
    return {
      title: "Crea tu primer evento",
      hint: "Agenda algo real — una cena, un viaje o una reunión — y deja que SyncPlans trabaje.",
      ctaLabel: "Nuevo evento",
      ctaTarget: "events_new",
    };
  }

  // 4) Conflictos activos
  if (stats.conflictsNow > 0) {
    return {
      title: "Tienes conflictos activos",
      hint: "Hay choques de horario detectados. Revísalos y decide qué conservar.",
      ctaLabel: "Revisar conflictos",
      ctaTarget: "conflicts",
    };
  }

  // 5) Caso estable
  if (stats.totalGroups > 0 && stats.totalEvents > 0) {
    return {
      title: "Saca más valor de tus grupos",
      hint: "Invita a alguien nuevo o revisa tu calendario compartido para la próxima semana.",
      ctaLabel: "Invitar a alguien",
      ctaTarget: "invitations",
    };
  }

  return null;
}

/* ───────────────────── COMPONENTES DE APOYO ───────────────────── */

function InfoStat(props: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div style={styles.stat}>
      <div style={styles.statLabel}>{props.label}</div>
      <div style={styles.statValue}>{props.value}</div>
      {props.hint && <div style={styles.statHint}>{props.hint}</div>}
    </div>
  );
}

function QuickAction(props: {
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={props.onClick} style={styles.quickAction}>
      <div style={styles.quickActionTitle}>{props.title}</div>
      <div style={styles.quickActionHint}>{props.hint}</div>
      <div style={styles.quickActionChevron}>→</div>
    </button>
  );
}

/* ─────────────────────────── ESTILOS ─────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { maxWidth: 1120, margin: "0 auto", padding: "22px 18px 48px" },

  headerRow: {
    marginBottom: 16,
  },

  loadingRow: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.6fr)",
    gap: 12,
  },
  loadingCard: {
    height: 180,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(90deg, rgba(148,163,184,0.12), rgba(15,23,42,0.7), rgba(148,163,184,0.12))",
    backgroundSize: "200% 100%",
    animation: "sp-skeleton 1.3s linear infinite",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.6fr)",
    gap: 14,
    alignItems: "flex-start",
  },
  leftCol: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  rightCol: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  card: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 16,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    opacity: 0.8,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 10,
  },

  profileRow: { display: "flex", gap: 14, alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.85)",
    fontWeight: 950,
    fontSize: 18,
  },
  nameRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    minWidth: 0,
  },
  name: {
    fontSize: 18,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chip: {
    padding: "4px 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  } as React.CSSProperties,
  email: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.72,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  divider: {
    margin: "12px 0",
    borderBottom: "1px solid rgba(148,163,184,0.35)",
  },

  smallGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  stat: {
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.85)",
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.7,
    fontWeight: 800,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 2,
  },
  statHint: {
    fontSize: 11,
    opacity: 0.75,
  },

  form: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontSize: 12,
    opacity: 0.8,
    fontWeight: 700,
  },
  input: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "8px 10px",
    background: "rgba(15,23,42,0.85)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    outline: "none",
  } as React.CSSProperties,
  error: {
    fontSize: 12,
    color: "rgba(248,113,113,0.95)",
    marginTop: 2,
  },
  ok: {
    fontSize: 12,
    color: "rgba(52,211,153,0.95)",
    marginTop: 2,
  },

  formActions: {
    marginTop: 4,
    display: "flex",
    gap: 10,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.9)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.35)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.25), rgba(124,58,237,0.25))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    fontWeight: 900,
  },

  accountStatusRow: {
    marginTop: 10,
    marginBottom: 10,
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(255,255,255,0.16)",
    fontSize: 18,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: 850,
  },
  statusHint: {
    fontSize: 12,
    opacity: 0.78,
  },

  recoCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(56,189,248,0.35)",
    background:
      "radial-gradient(600px 400px at 0% 0%, rgba(56,189,248,0.14), transparent 55%), rgba(15,23,42,0.9)",
  },
  recoTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    opacity: 0.85,
    fontWeight: 800,
    marginBottom: 4,
  },
  recoMain: {
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 3,
  },
  recoHint: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 8,
  },
  recoBtn: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.5)",
    background: "rgba(8,47,73,0.95)",
    color: "#E0F2FE",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  quickActionsGrid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  quickAction: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "radial-gradient(600px 400px at 0% 0%, rgba(56,189,248,0.18), transparent 55%), rgba(15,23,42,0.9)",
    padding: 10,
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gridTemplateRows: "auto auto",
    gap: "4px 6px",
  } as React.CSSProperties,
  quickActionTitle: {
    gridColumn: "1 / span 1",
    fontSize: 13,
    fontWeight: 900,
  },
  quickActionHint: {
    gridColumn: "1 / span 1",
    fontSize: 11,
    opacity: 0.8,
  },
  quickActionChevron: {
    gridColumn: "2 / span 1",
    gridRow: "1 / span 2",
    alignSelf: "center",
    fontSize: 18,
    opacity: 0.85,
  },

  footer: {
    marginTop: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.25)",
    padding: 12,
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 650,
  },

  /* Preferencias de coordinación */
  coordForm: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  coordGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  coordCol: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.85)",
    padding: 10,
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.85,
    marginBottom: 6,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    opacity: 0.85,
    marginBottom: 4,
  } as React.CSSProperties,
  coordFieldBlock: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  textarea: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "8px 10px",
    background: "rgba(15,23,42,0.85)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 12,
    resize: "vertical",
    minHeight: 52,
  } as React.CSSProperties,
  select: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "8px 10px",
    background: "rgba(15,23,42,0.95)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 12,
  } as React.CSSProperties,
  coordActions: {
    marginTop: 4,
    display: "flex",
    justifyContent: "flex-end",
  },

  /* Estado de configuración */
  configStatusBox: {
    marginTop: 10,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.85)",
    padding: 10,
    fontSize: 12,
  },
  configStatusTitle: {
    fontWeight: 800,
    marginBottom: 4,
    opacity: 0.9,
  },
  configStatusItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  configStatusBullet: {
    fontSize: 13,
  },

  /* Roles en grupos – Master–Detail */
  smallInfo: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 6,
  },

  groupSummaryRow: {
    fontSize: 12,
    opacity: 0.85,
    marginBottom: 8,
  },

  groupMasterDetail: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.5fr)",
    gap: 10,
    alignItems: "stretch",
    minHeight: 220,
  },

  groupListCol: {
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(15,23,42,0.9)",
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  groupDetailCol: {
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(15,23,42,0.9)",
    padding: 10,
  },

  groupListHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  groupFilterChips: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  groupFilterChip: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "transparent",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    opacity: 0.8,
    cursor: "pointer",
  } as React.CSSProperties,
  groupFilterChipActive: {
    borderColor: "rgba(56,189,248,0.9)",
    background: "rgba(8,47,73,0.9)",
    opacity: 1,
  } as React.CSSProperties,
  groupSearchInput: {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.45)",
    padding: "5px 9px",
    fontSize: 11,
    background: "rgba(15,23,42,0.95)",
    color: "rgba(248,250,252,0.96)",
    outline: "none",
  } as React.CSSProperties,

  groupListScroll: {
    marginTop: 4,
    maxHeight: 260,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  groupListEmpty: {
    fontSize: 11,
    opacity: 0.7,
    padding: 6,
  },

  groupListItem: {
    width: "100%",
    textAlign: "left",
    borderRadius: 10,
    border: "1px solid rgba(51,65,85,0.9)",
    background: "rgba(15,23,42,0.9)",
    padding: "6px 8px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  } as React.CSSProperties,
  groupListItemActive: {
    borderColor: "rgba(56,189,248,0.9)",
    boxShadow: "0 0 0 1px rgba(56,189,248,0.45)",
  } as React.CSSProperties,
  groupListItemTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  groupListItemName: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    overflow: "hidden",
  },
  groupListItemDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background:
      "radial-gradient(circle at 30% 30%, rgba(248,250,252,1), rgba(56,189,248,0.9))",
    flexShrink: 0,
  },
  groupListItemMeta: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    opacity: 0.8,
  },
  groupListItemStatus: {},
  groupListItemDirty: {
    color: "rgba(251,191,36,0.95)",
  },

  groupMetaHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 8,
  },
  groupMetaTitle: {
    fontSize: 13,
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  groupMetaSubtitle: {
    fontSize: 11,
    opacity: 0.8,
    marginTop: 2,
  },

  badgeTiny: {
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.85,
  } as React.CSSProperties,
  groupMetaFieldRow: {
    marginTop: 4,
  },
  groupMetaField: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  groupMetaLabel: {
    fontSize: 11,
    opacity: 0.8,
    fontWeight: 700,
  },
  groupMetaInput: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "7px 9px",
    background: "rgba(15,23,42,0.85)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 12,
  } as React.CSSProperties,
  groupMetaTextarea: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "7px 9px",
    background: "rgba(15,23,42,0.85)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 12,
    resize: "vertical",
    minHeight: 46,
  } as React.CSSProperties,
  groupMetaSelect: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "7px 9px",
    background: "rgba(15,23,42,0.95)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 12,
  } as React.CSSProperties,
  groupMetaSaveRow: {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  groupMetaSaveBtn: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.5)",
    background: "rgba(8,47,73,0.95)",
    color: "#E0F2FE",
    fontSize: 11,
    fontWeight: 900,
  },
  groupMetaCalendarBtn: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "transparent",
    color: "rgba(226,232,240,0.95)",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
