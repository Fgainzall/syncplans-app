// src/app/profile/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import {
  getMyProfile,
  getInitials,
  createMyProfile,
  type Profile,
} from "@/lib/profilesDb";
import { getMyEvents, type DbEventRow } from "@/lib/eventsDb";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { computeVisibleConflicts } from "@/lib/conflicts";

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

export default function ProfilePage() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserUI | null>(null);

  // 👇 formulario de nombre/apellido
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  // 📊 stats de uso (eventos, grupos, conflictos)
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

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

        // 👇 Intentar leer perfil real desde la tabla `profiles`
        try {
          const profile: Profile | null = await getMyProfile();
          if (profile) {
            const dn = (
              profile.display_name ??
              `${profile.first_name ?? ""} ${profile.last_name ?? ""}`
            ).trim();

            if (dn) {
              finalName = dn;
            }

            initials = getInitials({
              first_name: profile.first_name,
              last_name: profile.last_name,
              display_name: profile.display_name,
            });

            localFirst = (profile.first_name ?? "").trim();
            localLast = (profile.last_name ?? "").trim();
          } else {
            // Si no hay perfil aún, intentamos inferir del baseName
            const parts = baseName.trim().split(/\s+/);
            if (parts.length >= 2) {
              localFirst = parts[0];
              localLast = parts.slice(1).join(" ");
            } else {
              localFirst = baseName.trim();
              localLast = "";
            }
          }
        } catch (e) {
          console.error("Error leyendo perfil desde DB:", e);
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
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  // 📊 Cargar stats de uso cuando ya tenemos user
  useEffect(() => {
    if (!user) return;
    let alive = true;

    (async () => {
      try {
        setStatsLoading(true);

        const [events, groups] = await Promise.all([
          getMyEvents(),
          getMyGroups(),
        ]);

        if (!alive) return;

        const stats = buildDashboardStats(events, groups);
        setStats(stats);
      } catch (e) {
        console.error("[ProfilePage] Error cargando stats:", e);
        if (!alive) return;
        setStats(null);
      } finally {
        if (!alive) return;
        setStatsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

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
        first_name: profile.first_name,
        last_name: profile.last_name,
        display_name: profile.display_name,
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

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader
            title="Panel"
            subtitle="Tu panel de cuenta en SyncPlans."
            rightSlot={<LogoutButton />}
          />
          <div style={styles.loadingRow}>
            <div style={styles.loadingCard} />
            <div style={styles.loadingCard} />
          </div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const accountStatusLabel = user.verified ? "Cuenta verificada" : "Verifica tu correo";
  const accountStatusHint = user.verified
    ? "Tu correo está confirmado."
    : "Busca el correo de confirmación en tu bandeja o spam.";

  const recommendation: Recommendation | null = useMemo(() => {
    if (!user) return null;

    // 1) Primero la seguridad
    if (!user.verified) {
      return {
        title: "Verifica tu correo",
        hint: "Cerrar el ciclo de verificación protege tus grupos y eventos compartidos.",
      };
    }

    // Si no hay stats todavía, no recomendamos nada concreto
    if (!stats) return null;

    // 2) Sin grupos aún → crea tu primer grupo
    if (stats.totalGroups === 0) {
      return {
        title: "Crea tu primer grupo",
        hint: "Empieza por un grupo de pareja o familia para compartir eventos y conflictos.",
        ctaLabel: "Crear grupo",
        ctaTarget: "groups_new",
      };
    }

    // 3) Con grupos pero sin eventos → crea tu primer evento
    if (stats.totalEvents === 0) {
      return {
        title: "Crea tu primer evento",
        hint: "Agenda algo real — una cena, un viaje o una reunión — y deja que SyncPlans trabaje.",
        ctaLabel: "Nuevo evento",
        ctaTarget: "events_new",
      };
    }

    // 4) Hay conflictos activos → revísalos
    if (stats.conflictsNow > 0) {
      return {
        title: "Tienes conflictos activos",
        hint: "Hay choques de horario detectados. Revísalos y decide qué conservar.",
        ctaLabel: "Revisar conflictos",
        ctaTarget: "conflicts",
      };
    }

    // 5) Caso estable → invitar a alguien más o seguir usando
    if (stats.totalGroups > 0 && stats.totalEvents > 0) {
      return {
        title: "Saca más valor de tus grupos",
        hint: "Invita a alguien nuevo o revisa tu calendario compartido para la próxima semana.",
        ctaLabel: "Invitar a alguien",
        ctaTarget: "invitations",
      };
    }

    return null;
  }, [user, stats]);

  const handleRecommendationClick = (target: Recommendation["ctaTarget"]) => {
    if (!target) return;
    if (target === "groups_new") router.push("/groups/new");
    else if (target === "calendar") router.push("/calendar");
    else if (target === "events_new")
      router.push("/events/new/details?type=personal");
    else if (target === "conflicts") router.push("/conflicts/detected");
    else if (target === "invitations") router.push("/invitations");
  };

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {/* 🧭 Header premium + logout como acción principal */}
        <div style={styles.headerRow}>
          <PremiumHeader
            title="Panel"
            subtitle="Tu estado de cuenta, identidad y atajos clave en un solo lugar."
            rightSlot={<LogoutButton />}
          />
        </div>

        {/* 🧩 GRID PRINCIPAL: izquierda (identidad) / derecha (estado & acciones) */}
        <div style={styles.mainGrid}>
          {/* Columna izquierda: identidad + edición de nombre */}
          <div style={styles.leftCol}>
            {/* Identidad del usuario */}
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
                  value="Demo Premium"
                  hint="Acceso completo mientras pruebas SyncPlans."
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
                      ? `Pareja: ${stats.pairGroups} · Familia: ${stats.familyGroups}`
                      : "Crea un grupo para compartir calendario y conflictos."
                  }
                />
              </div>
            </section>

            {/* Edición de nombre dentro del contexto de identidad */}
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
          </div>

          {/* Columna derecha: estado de cuenta, uso y acciones rápidas */}
          <div style={styles.rightCol}>
            {/* Estado de la cuenta + Próximo paso recomendado */}
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
                        handleRecommendationClick(recommendation.ctaTarget)
                      }
                      style={styles.recoBtn}
                    >
                      {recommendation.ctaLabel}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Uso / valor + acciones rápidas */}
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

        {/* Footer sutil, tipo copy de valor */}
        <div style={styles.footer}>
          SyncPlans está pensado para que tu calendario personal, de pareja y
          familia convivan sin fricciones. Este panel es tu centro de control.
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
  const pairGroups = groups.filter(
    (g) => String(g.type) === "pair" || String(g.type) === "couple"
  ).length;
  const familyGroups = groups.filter(
    (g) => String(g.type) === "family"
  ).length;

  // Para conflictos solo necesitamos start/end; groupType aquí es irrelevante
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
    conflictsNow: conflicts.length,
  };
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
  },
  ok: {
    fontSize: 12,
    color: "rgba(52,211,153,0.95)",
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
};
