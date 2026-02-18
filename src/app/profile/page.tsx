// src/app/profile/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import MobileScaffold from "@/components/MobileScaffold";

import {
  getMyProfile,
  createMyProfile,
  getInitials,
  updateMyCoordinationPrefs,
  normalizeCoordinationPrefs,
  updateDailyDigestSettings,
  type CoordinationPrefs,
  type Profile,
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

import { isPremiumUser, isTrialActive } from "@/lib/premium";
import { computeVisibleConflicts } from "@/lib/conflicts";

/* ─────────────────── Tipos UI ─────────────────── */

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

type GroupFilter = "all" | "pair" | "family" | "other";

type AnyProfile = {
  plan_tier?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  daily_digest_enabled?: boolean | null;
  daily_digest_hour_local?: number | null;
  daily_digest_timezone?: string | null;
};

/* ─────────────────── Helpers ─────────────────── */

function hasGroupMeta(m: GroupMemberRow) {
  return (
    !!m.display_name ||
    !!m.relationship_role ||
    !!m.coordination_prefs?.group_note
  );
}

function normalizeCoordPrefs(
  prefs?: Partial<CoordinationPrefs> | null
): CoordinationPrefs {
  return normalizeCoordinationPrefs(
    (prefs ?? null) as CoordinationPrefs | null | undefined
  );
}

function buildDashboardStats(events: DbEventRow[], groups: GroupRow[]): DashboardStats {
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

  // ✅ FIX: groupType coherente con conflictos (group vs personal)
  const eventsForConflicts = events.map((e) => ({
    id: e.id,
    title: e.title ?? "(Sin título)",
    start: e.start,
    end: e.end,
    groupType: e.group_id ? ("group" as const) : ("personal" as const),
    groupId: e.group_id ?? null,
  }));

  const conflicts = computeVisibleConflicts(eventsForConflicts as any);

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

function buildRecommendation(verified: boolean, stats: DashboardStats | null): Recommendation | null {
  if (!stats) return null;

  if (!verified) {
    return {
      title: "Verifica tu correo",
      hint: "Cerrar el ciclo de verificación protege tus grupos y eventos compartidos.",
    };
  }

  if (stats.totalGroups === 0) {
    return {
      title: "Crea tu primer grupo",
      hint: "Empieza por un grupo de pareja o familia para compartir eventos y conflictos. Luego suma grupos compartidos como amigos o equipos.",
      ctaLabel: "Crear grupo",
      ctaTarget: "groups_new",
    };
  }

  if (stats.totalEvents === 0) {
    return {
      title: "Crea tu primer evento",
      hint: "Agenda algo real — una cena, un viaje o una reunión — y deja que SyncPlans trabaje.",
      ctaLabel: "Nuevo evento",
      ctaTarget: "events_new",
    };
  }

  if (stats.conflictsNow > 0) {
    return {
      title: "Tienes conflictos activos",
      hint: "Hay conflictos de horario detectados. Revísalos y decide qué conservar.",
      ctaLabel: "Revisar conflictos",
      ctaTarget: "conflicts",
    };
  }

  return {
    title: "Saca más valor de tus grupos",
    hint: "Invita a alguien nuevo o revisa tu calendario compartido para la próxima semana.",
    ctaLabel: "Invitar a alguien",
    ctaTarget: "invitations",
  };
}

/**
 * Lógica central de plan actual (free / trial / premium / founder / fallback demo).
 */
function getPlanInfo(profile: AnyProfile | null) {
  const tierRaw = profile?.plan_tier ?? "free";
  const tier = tierRaw.toLowerCase();
  const premiumActive = isPremiumUser(profile as any);
  const trialActive = isTrialActive(profile as any);

  let planLabel = "";
  let planHint = "";
  let planCtaLabel = "";

  if (premiumActive && tier.startsWith("founder_")) {
    if (tier === "founder_yearly") {
      planLabel = "Plan fundador (anual)";
      planHint =
        "Formas parte del grupo fundador de SyncPlans con plan anual y precio especial mientras mantengas la suscripción.";
    } else {
      planLabel = "Plan fundador (mensual)";
      planHint =
        "Formas parte de la beta privada con un precio especial mientras mantengas el plan.";
    }
    planCtaLabel = "Pronto podrás gestionar tu suscripción";
    return { planLabel, planHint, planCtaLabel };
  }

  if (premiumActive) {
    if (tier === "premium_yearly") {
      planLabel = "Premium anual";
      planHint = "Tu suscripción anual Premium (US$69) está activa.";
      planCtaLabel = "Gestionar suscripción";
      return { planLabel, planHint, planCtaLabel };
    }
    planLabel = "Premium mensual";
    planHint = "Tu suscripción mensual Premium (US$6.90) está activa.";
    planCtaLabel = "Gestionar suscripción";
    return { planLabel, planHint, planCtaLabel };
  }

  if (trialActive) {
    planLabel = "Demo Premium activa";
    planHint =
      "Estás usando todas las funciones Premium sin costo como parte de la beta privada. El precio público será US$6.90/mes o US$69/año.";
    planCtaLabel = "Ver planes y precios";
    return { planLabel, planHint, planCtaLabel };
  }

  if (tier === "free") {
    planLabel = "Plan gratuito";
    planHint =
      "Estás usando SyncPlans en modo básico. Puedes pasar a Premium mensual (US$6.90) o anual (US$69) cuando quieras. Durante la beta no se te cobrará nada.";
    planCtaLabel = "Ver planes Premium";
    return { planLabel, planHint, planCtaLabel };
  }

  if (tier.includes("premium")) {
    planLabel = "Premium (pendiente)";
    planHint =
      (profile?.subscription_status ?? "").toLowerCase() === "canceled"
        ? "Tu suscripción Premium se canceló. Puedes reactivarla en cualquier momento."
        : "Tu suscripción Premium aún no está activa. Revisa tu método de pago o finaliza el proceso.";
    planCtaLabel = "Revisar suscripción";
    return { planLabel, planHint, planCtaLabel };
  }

  planLabel = "Demo Premium (beta)";
  planHint =
    "Estás en la beta privada de SyncPlans con acceso extendido a funciones Premium.";
  planCtaLabel = "Ver opciones de plan";
  return { planLabel, planHint, planCtaLabel };
}

/* ─────────────────────────── ESTILOS ─────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
 shell: {
  // ✅ MobileScaffold ahora controla el padding y maxWidth
  maxWidth: 1120,
  margin: "0 auto",
  padding: 0,
},
  headerRow: { marginBottom: 16 },

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
  leftCol: { display: "flex", flexDirection: "column", gap: 12 },
  rightCol: { display: "flex", flexDirection: "column", gap: 12 },

  card: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 16,
  },

    hubGrid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  hubCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "radial-gradient(700px 420px at 0% 0%, rgba(56,189,248,0.18), transparent 55%), rgba(15,23,42,0.92)",
    padding: 12,
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gridTemplateRows: "auto auto",
    gap: "4px 8px",
  } as React.CSSProperties,

  hubTitle: { fontSize: 13, fontWeight: 950 },
  hubHint: { fontSize: 11, opacity: 0.8 },
  hubChevron: { fontSize: 18, opacity: 0.85, alignSelf: "center" },

  sectionLabel: {
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    opacity: 0.8,
    marginBottom: 4,
  },
  sectionSub: { fontSize: 12, opacity: 0.75, marginBottom: 10 },

  profileRow: { display: "flex", gap: 14, alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.16)",
    background:
      "radial-gradient(circle at 30% 0%, rgba(250,204,21,0.85), transparent 60%), rgba(15,23,42,0.92)",
    fontWeight: 950,
    fontSize: 18,
  },
  nameRow: { display: "flex", gap: 8, alignItems: "center", minWidth: 0 },
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

  divider: { margin: "12px 0", borderBottom: "1px solid rgba(148,163,184,0.35)" },

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
  statValue: { fontSize: 13, fontWeight: 900, marginBottom: 2 },
  statHint: { fontSize: 11, opacity: 0.75 },

  form: { marginTop: 8, display: "flex", flexDirection: "column", gap: 10 },
  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12, opacity: 0.8, fontWeight: 700 },
  input: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "8px 10px",
    background: "rgba(15,23,42,0.85)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    outline: "none",
  } as React.CSSProperties,

  error: { fontSize: 12, color: "rgba(248,113,113,0.95)", marginTop: 2 },
  ok: { fontSize: 12, color: "rgba(52,211,153,0.95)", marginTop: 2 },

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

  planCtaRow: { marginTop: 10, display: "flex", justifyContent: "flex-end" },
  planPrimaryBtn: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.7)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.35), rgba(124,58,237,0.35))",
    color: "rgba(255,255,255,0.96)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
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
  statusTitle: { fontSize: 13, fontWeight: 850 },
  statusHint: { fontSize: 12, opacity: 0.78 },

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
  recoMain: { fontSize: 14, fontWeight: 900, marginBottom: 3 },
  recoHint: { fontSize: 12, opacity: 0.8, marginBottom: 8 },
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
};
// Continuación estilos
Object.assign(styles, {
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

  coordForm: { display: "flex", flexDirection: "column", gap: 10 },
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
  coordLabel: { fontSize: 12, fontWeight: 700, opacity: 0.85, marginBottom: 6 },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    opacity: 0.85,
    marginBottom: 4,
  } as React.CSSProperties,
  coordFieldBlock: { marginTop: 8, display: "flex", flexDirection: "column", gap: 4 },
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
  coordActions: { marginTop: 4, display: "flex", justifyContent: "flex-end" },

  configStatusBox: {
    marginTop: 10,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.85)",
    padding: 10,
    fontSize: 12,
  },
  configStatusTitle: { fontWeight: 800, marginBottom: 4, opacity: 0.9 },
  configStatusItem: { display: "flex", alignItems: "center", gap: 6, marginTop: 2 },
  configStatusBullet: { fontSize: 13 },

  smallInfo: { fontSize: 12, opacity: 0.8, marginBottom: 6 },

  groupSummaryRow: { fontSize: 12, opacity: 0.85, marginBottom: 8 },

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

  groupListHeader: { display: "flex", flexDirection: "column", gap: 6 },
  groupFilterChips: { display: "flex", gap: 6, flexWrap: "wrap" },
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

  // ✅ feel de app
  WebkitOverflowScrolling: "touch",
},
  groupListEmpty: { fontSize: 11, opacity: 0.7, padding: 6 },

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
  groupListItemDirty: { color: "rgba(251,191,36,0.95)" },

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
  groupMetaSubtitle: { fontSize: 11, opacity: 0.8, marginTop: 2 },

  badgeTiny: {
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.85,
  } as React.CSSProperties,

  groupMetaLabel: { fontSize: 11, opacity: 0.8, fontWeight: 700 },
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
    cursor: "pointer",
  } as React.CSSProperties,
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
  } as React.CSSProperties,

  digestRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
  },
  digestToggle: { display: "inline-flex", alignItems: "center", fontSize: 13 },
  digestHourWrap: { display: "inline-flex", alignItems: "center", gap: 8 },
  digestHourLabel: { fontSize: 13, opacity: 0.8 },
  digestSelect: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(5,8,22,0.9)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
  } as React.CSSProperties,
  digestHint: { marginTop: 6, fontSize: 12, opacity: 0.8 },
  digestSavingHint: { marginTop: 6, fontSize: 12, opacity: 0.8 },
});
/* ─────────────────── Componente principal ─────────────────── */

export default function ProfilePage() {
  const router = useRouter();

  // Carga base
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("—");
  const [verified, setVerified] = useState(false);
  const [initials, setInitials] = useState<string>("");

  // Nombre / apellido
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Grupos / memberships
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [memberships, setMemberships] = useState<GroupMemberRow[] | null>(null);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [membershipsError, setMembershipsError] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [groupSearch, setGroupSearch] = useState("");
  const [dirtyGroups, setDirtyGroups] = useState<Set<string>>(new Set());
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [groupSaveMessage, setGroupSaveMessage] = useState<string | null>(null);
  const [groupSaveError, setGroupSaveError] = useState<string | null>(null);

  // Preferencias globales
  const [coordPrefs, setCoordPrefs] = useState<CoordinationPrefs | null>(null);
  const [savingCoord, setSavingCoord] = useState(false);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [coordOk, setCoordOk] = useState<string | null>(null);

  // Resumen diario
  const [savingDigest, setSavingDigest] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [digestOk, setDigestOk] = useState<string | null>(null);

  /* ── 1) Cargar sesión + perfil ── */
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
        setEmail(u.email ?? "—");
        setVerified(!!u.email_confirmed_at);

        let p = await getMyProfile();
        if (!p) {
          p = await createMyProfile({ first_name: "", last_name: "" });
        }

        if (!p) {
          if (!alive) return;
          console.error("[ProfilePage] No se pudo obtener/crear perfil");
          return;
        }

        if (!alive) return;

        setProfile(p);

        const f = (p.first_name ?? "").trim();
        const l = (p.last_name ?? "").trim();
        setFirstName(f);
        setLastName(l);

        setCoordPrefs(
          normalizeCoordPrefs(p.coordination_prefs as CoordinationPrefs | null)
        );

        setInitials(
          getInitials({
            first_name: p.first_name ?? undefined,
            last_name: p.last_name ?? undefined,
            display_name: (p as any).display_name ?? undefined,
          })
        );
      } catch (e) {
        console.error("[ProfilePage] Error cargando perfil:", e);
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  /* ── 2) Cargar stats + grupos ── */
  useEffect(() => {
    if (!profile) return;
    let alive = true;

    (async () => {
      try {
        setStatsLoading(true);
        const [events, groupsRows] = await Promise.all([
          getMyEvents().catch(() => [] as DbEventRow[]),
          getMyGroups().catch(() => [] as GroupRow[]),
        ]);

        if (!alive) return;

        setGroups(groupsRows);
        setStats(buildDashboardStats(events, groupsRows));
      } catch (e) {
        console.error("[ProfilePage] Error cargando stats:", e);
        if (!alive) return;
        setGroups(null);
        setStats(null);
      } finally {
        if (!alive) return;
        setStatsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile]);

  /* ── 3) Cargar memberships ── */
  useEffect(() => {
    if (!profile) return;
    let alive = true;

    (async () => {
      try {
        setMembershipsLoading(true);
        setMembershipsError(null);

        const ms = await getMyGroupMemberships();
        if (!alive) return;
        setMemberships(ms);
      } catch (e: any) {
        console.error("[ProfilePage] Error cargando memberships:", e);
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
  }, [profile]);

  /* ── 3b) Selección por defecto de grupo ── */
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

  /* ── 4) Guardar nombre / apellido ── */
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileOk(null);

    const fn = firstName.trim();
    const ln = lastName.trim();

    if (!fn || !ln) {
      setProfileError("Nombre y apellido son obligatorios.");
      return;
    }

    try {
      setSavingProfile(true);

      // ✅ Mantengo tu enfoque (createMyProfile actúa como upsert en tu proyecto)
      const updated = await createMyProfile({
        first_name: fn,
        last_name: ln,
      });

      setProfile(updated);
      setInitials(
        getInitials({
          first_name: updated.first_name ?? undefined,
          last_name: updated.last_name ?? undefined,
          display_name: (updated as any).display_name ?? undefined,
        })
      );

      setProfileOk("Perfil actualizado correctamente.");
    } catch (e: any) {
      console.error("[ProfilePage] Error guardando perfil:", e);
      setProfileError(
        typeof e?.message === "string"
          ? e.message
          : "No se pudo actualizar tu perfil. Intenta de nuevo."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  /* ── 5) Guardar preferencias globales ── */
  async function handleSaveCoordPrefs(e: React.FormEvent) {
    e.preventDefault();
    if (!coordPrefs) return;

    setCoordError(null);
    setCoordOk(null);

    try {
      setSavingCoord(true);
      await updateMyCoordinationPrefs(coordPrefs);
      setCoordOk("Preferencias guardadas correctamente.");
    } catch (e: any) {
      console.error("[ProfilePage] Error guardando preferencias:", e);
      setCoordError(
        typeof e?.message === "string"
          ? e.message
          : "No se pudieron guardar tus preferencias. Intenta de nuevo."
      );
    } finally {
      setSavingCoord(false);
    }
  }

  /* ── 6) Manejo local de metadata de grupo ── */
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
      if (field === "display_name") return { ...m, display_name: value };
      if (field === "relationship_role") return { ...m, relationship_role: value };
      if (field === "group_note") {
        const nextPrefs = { ...(m.coordination_prefs ?? {}), group_note: value };
        return { ...m, coordination_prefs: nextPrefs };
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
    } catch (e: any) {
      console.error("[ProfilePage] Error guardando metadata de grupo:", e);
      setGroupSaveError(
        typeof e?.message === "string"
          ? e.message
          : "No se pudieron guardar los cambios. Intenta de nuevo."
      );
    } finally {
      setSavingGroupId(null);
    }
  }

  /* ── 7) Resumen diario ── */
  const handleToggleDigest = async (enabled: boolean) => {
    if (!profile) return;
    setDigestError(null);
    setDigestOk(null);

    try {
      setSavingDigest(true);
      const hour = (profile as any).daily_digest_hour_local ?? 7;
      const tz = (profile as any).daily_digest_timezone ?? "America/Lima";

      await updateDailyDigestSettings({
        daily_digest_enabled: enabled,
        daily_digest_hour_local: hour,
        daily_digest_timezone: tz,
      });

      setProfile({
        ...profile,
        ...(profile as any),
        daily_digest_enabled: enabled,
        daily_digest_hour_local: hour,
        daily_digest_timezone: tz,
      } as any);

      setDigestOk("Resumen diario actualizado.");
    } catch (e: any) {
      console.error(e);
      setDigestError(
        typeof e?.message === "string"
          ? e.message
          : "No se pudo actualizar el resumen diario. Inténtalo de nuevo."
      );
    } finally {
      setSavingDigest(false);
    }
  };

  const handleChangeDigestHour = async (hour: number) => {
    if (!profile) return;
    setDigestError(null);
    setDigestOk(null);

    try {
      setSavingDigest(true);
      const enabled = (profile as any).daily_digest_enabled ?? true;
      const tz = (profile as any).daily_digest_timezone ?? "America/Lima";

      await updateDailyDigestSettings({
        daily_digest_enabled: enabled,
        daily_digest_hour_local: hour,
        daily_digest_timezone: tz,
      });

      setProfile({
        ...profile,
        ...(profile as any),
        daily_digest_enabled: enabled,
        daily_digest_hour_local: hour,
        daily_digest_timezone: tz,
      } as any);

      setDigestOk("Hora del resumen actualizada.");
    } catch (e: any) {
      console.error(e);
      setDigestError(
        typeof e?.message === "string"
          ? e.message
          : "No se pudo actualizar la hora del resumen. Inténtalo de nuevo."
      );
    } finally {
      setSavingDigest(false);
    }
  };

  /* ── 8) Loading / sin perfil ── */
  if (booting) {
    return (
      <main style={styles.page}>
  <MobileScaffold
    maxWidth={1120}
    paddingDesktop="22px 18px 48px"
    paddingMobile="14px 12px 18px"
    mobileBottomSafe={120} // ✅ un poco más para que jamás tape BottomNav
    className="spProfileShell"
  >
          <div style={styles.headerRow}>
            <PremiumHeader
              mobileNav="bottom"
              title="Panel"
              subtitle="Tu panel de cuenta en SyncPlans."
              rightSlot={<LogoutButton />}
            />
          </div>
          <div style={styles.loadingRow}>
            <div style={styles.loadingCard} />
            <div style={styles.loadingCard} />
          </div>

          <style>{`
            @keyframes sp-skeleton {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
          </MobileScaffold>
</main>
    );
  }

  if (!profile) {
    return (
      <main style={styles.page}>
  <MobileScaffold
    maxWidth={1120}
    paddingDesktop="22px 18px 48px"
    paddingMobile="14px 12px 18px"
    mobileBottomSafe={120} // ✅ un poco más para que jamás tape BottomNav
    className="spProfileShell"
  >
          <div style={styles.headerRow}>
            <PremiumHeader
              mobileNav="bottom"
              title="Panel"
              subtitle="Tu panel de cuenta en SyncPlans."
              rightSlot={<LogoutButton />}
            />
          </div>
          <div style={styles.error}>
            No se pudo cargar tu perfil. Vuelve a iniciar sesión.
          </div>
          </MobileScaffold>
</main>
    );
  }

  /* ── 9) Derivados de UI ── */

  const accountStatusLabel = verified ? "Cuenta verificada" : "Verifica tu correo";
  const accountStatusHint = verified
    ? "Tu correo está confirmado."
    : "Busca el correo de confirmación en tu bandeja o spam.";

  const recommendation = buildRecommendation(verified, stats);

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

  const hasGroupMetaGlobal =
    memberships &&
    memberships.length > 0 &&
    memberships.some((m) => hasGroupMeta(m));

  const searchTerm = groupSearch.trim().toLowerCase();
  const membershipsFiltered = membershipsSorted.filter((m) => {
    const g = groupsById.get(m.group_id);
    const typeStr = String(g?.type ?? "").toLowerCase();

    if (groupFilter === "pair" && !(typeStr === "pair" || typeStr === "couple")) return false;
    if (groupFilter === "family" && typeStr !== "family") return false;
    if (groupFilter === "other" && (typeStr === "pair" || typeStr === "family" || typeStr === "couple"))
      return false;

    if (!searchTerm) return true;

    const name = (g?.name ?? "").toLowerCase();
    const displayName = (m.display_name ?? "").toLowerCase();
    return name.includes(searchTerm) || displayName.includes(searchTerm) || typeStr.includes(searchTerm);
  });

  const selectedMembership: GroupMemberRow | null =
    membershipsFiltered.find((m) => m.group_id === selectedGroupId) ??
    membershipsFiltered[0] ??
    null;

  const totalGroupsForRoles = memberships ? memberships.length : 0;
  const configuredGroupsCount = memberships ? memberships.filter((m) => hasGroupMeta(m)).length : 0;
  const pendingGroupsCount = Math.max(0, totalGroupsForRoles - configuredGroupsCount);

  const hasSelectedDirty = selectedMembership && dirtyGroups.has(selectedMembership.group_id);

  const digestEnabled = (profile as any).daily_digest_enabled ?? false;
  const digestHour = (profile as any).daily_digest_hour_local ?? 7;
  const digestTz = (profile as any).daily_digest_timezone ?? "America/Lima";

  const anyProfile = profile as unknown as AnyProfile;
  const { planLabel, planHint, planCtaLabel } = getPlanInfo(anyProfile);
    return (
    <main style={styles.page}>
  <MobileScaffold
    maxWidth={1120}
    paddingDesktop="22px 18px 48px"
    paddingMobile="14px 12px 18px"
    mobileBottomSafe={120} // ✅ un poco más para que jamás tape BottomNav
    className="spProfileShell"
  >
        <div style={styles.headerRow}>
       <PremiumHeader
  mobileNav="bottom"
  title="Panel"
  subtitle="Tu centro de control."
/>
        </div>

        <div style={styles.mainGrid} className="spProfileMainGrid">
          {/* Columna izquierda */}
          <div style={styles.leftCol}>
            <section style={styles.card} className="spProfileHideMobile">
              <div style={styles.sectionLabel}>Identidad</div>

              <div style={styles.profileRow}>
                <div style={styles.avatar}>{initials || "?"}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.nameRow}>
                    <span style={styles.name}>
                      {(profile as any).display_name ||
                        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                        "(Sin nombre)"}
                    </span>

                    <span
                      style={{
                        ...styles.chip,
                        borderColor: verified
                          ? "rgba(34,197,94,0.40)"
                          : "rgba(250,204,21,0.40)",
                        background: verified
                          ? "rgba(34,197,94,0.10)"
                          : "rgba(250,204,21,0.12)",
                      }}
                    >
                      {verified ? "Verificada" : "Por verificar"}
                    </span>
                  </div>
                  <div style={styles.email}>{email}</div>
                </div>
              </div>

              <div style={styles.divider} />

              <div style={styles.smallGrid}>
                <InfoStat label="Plan actual" value={planLabel} hint={planHint} />
                <InfoStat
                  label="Grupos activos"
                  value={
                    statsLoading
                      ? "—"
                      : stats
                      ? `${stats.totalGroups} grupo${stats.totalGroups === 1 ? "" : "s"}`
                      : "—"
                  }
                  hint={
                    stats && stats.totalGroups > 0
                      ? `Pareja: ${stats.pairGroups} · Familia: ${stats.familyGroups} · Compartidos: ${stats.otherGroups}`
                      : "Crea un grupo para compartir calendario y conflictos."
                  }
                />
              </div>

              <div style={styles.planCtaRow}>
                <button
                  type="button"
                  onClick={() => router.push("/pricing")}
                  style={styles.planPrimaryBtn}
                >
                  {planCtaLabel}
                </button>
              </div>
            </section>
<section style={styles.card} className="spProfileHideMobile">
  <div style={styles.sectionLabel}>Centro de control</div>
  <div style={styles.sectionSub}>Accesos rápidos a lo importante.</div>

  <div style={styles.hubGrid} className="spProfileHubGrid">
    <HubCard title="Grupos" hint="Pareja, familia y compartidos." onClick={() => router.push("/groups")} />
    <HubCard title="Miembros" hint="Quién está en tus grupos." onClick={() => router.push("/members")} />
    <HubCard title="Invitaciones" hint="Invita y acepta accesos." onClick={() => router.push("/invitations")} />
    <HubCard title="Settings" hint="Preferencias del producto." onClick={() => router.push("/settings")} />
    <HubCard title="Planes" hint="Ver tu plan y upgrade." onClick={() => router.push("/pricing")} />
    <HubCard title="Salir" hint="Cerrar sesión." onClick={async () => { await supabase.auth.signOut(); router.replace("/auth/login"); }} />
  </div>
</section>
            {/* Cómo te ve el resto */}
            <section style={styles.card} className="spProfileHideMobile">
              <div style={styles.sectionLabel}>Cómo te ve el resto</div>
              <div style={styles.sectionSub}>
                Este nombre se usa en miembros, invitaciones y notificaciones compartidas.
              </div>

              <form onSubmit={handleSaveProfile} style={styles.form}>
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

                {profileError && <div style={styles.error}>{profileError}</div>}
                {profileOk && <div style={styles.ok}>{profileOk}</div>}

                <div style={styles.formActions}>
                  <button type="button" onClick={() => router.push("/summary")} style={styles.ghostBtn}>
                    Ver resumen semanal
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    style={{
                      ...styles.primaryBtn,
                      opacity: savingProfile ? 0.7 : 1,
                      cursor: savingProfile ? "progress" : "pointer",
                    }}
                  >
                    {savingProfile ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </section>

            {/* Preferencias */}
            <section style={styles.card} className="spProfileHideMobile">
              <div style={styles.sectionLabel}>Cómo sueles organizar tu tiempo</div>
              <div style={styles.sectionSub}>
                Estas preferencias ayudan a SyncPlans a anticipar fricciones y mostrar mejores decisiones cuando hay conflictos de horario.
              </div>

              <form onSubmit={handleSaveCoordPrefs} style={styles.coordForm}>
                <div style={styles.coordGrid}>
                  <div style={styles.coordCol}>
                    <div style={styles.coordLabel}>Ritmo del día</div>
                    <label style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={coord.prefers_mornings}
                        onChange={(e) =>
                          setCoordPrefs((prev) =>
                            normalizeCoordPrefs({ ...(prev ?? {}), prefers_mornings: e.target.checked })
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
                            normalizeCoordPrefs({ ...(prev ?? {}), prefers_evenings: e.target.checked })
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
                            normalizeCoordPrefs({ ...(prev ?? {}), prefers_weekdays: e.target.checked })
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
                            normalizeCoordPrefs({ ...(prev ?? {}), prefers_weekends: e.target.checked })
                          )
                        }
                      />
                      <span>Fines de semana</span>
                    </label>
                  </div>
                </div>

                <div style={styles.coordFieldBlock}>
                  <div style={styles.coordLabel}>Horarios que casi siempre tienes ocupados</div>
                  <textarea
                    style={styles.textarea}
                    rows={3}
                    value={coord.blocked_note}
                    onChange={(e) =>
                      setCoordPrefs((prev) =>
                        normalizeCoordPrefs({ ...(prev ?? {}), blocked_note: e.target.value })
                      )
                    }
                    placeholder="Ej: Lunes y miércoles de 7 a 9 pm entreno."
                  />
                </div>

                <div style={styles.coordFieldBlock}>
                  <div style={styles.coordLabel}>Cuando hay conflictos de horario, normalmente prefieres…</div>
                  <select
                    style={styles.select}
                    value={coord.decision_style ?? "depends"}
                    onChange={(e) =>
                      setCoordPrefs((prev) =>
                        normalizeCoordPrefs({
                          ...(prev ?? {}),
                          decision_style: e.target.value as CoordinationPrefs["decision_style"],
                        })
                      )
                    }
                  >
                    <option value="decide_fast">Decidir rápido y seguir</option>
                    <option value="discuss">Hablarlo con calma</option>
                    <option value="depends">Depende del evento</option>
                  </select>
                </div>

                {coordError && <div style={styles.error}>{coordError}</div>}
                {coordOk && <div style={styles.ok}>{coordOk}</div>}

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

            {/* Resumen diario */}
            <section style={styles.card} className="spProfileHideMobile">
              <div style={styles.sectionLabel}>Resumen diario por correo</div>
              <div style={styles.sectionSub}>
                Si lo activas, te enviaremos cada mañana un correo con los eventos que tienes para el día, ordenados por hora.
              </div>

              <div style={styles.digestRow}>
                <label style={styles.digestToggle}>
                  <input
                    type="checkbox"
                    checked={digestEnabled}
                    onChange={(e) => handleToggleDigest(e.target.checked)}
                    disabled={savingDigest}
                  />
                  <span style={{ marginLeft: 8 }}>Activar resumen diario</span>
                </label>

                <div style={styles.digestHourWrap}>
                  <span style={styles.digestHourLabel}>Hora local:</span>
                  <select
                    value={digestHour}
                    disabled={!digestEnabled || savingDigest}
                    onChange={(e) => handleChangeDigestHour(Number(e.target.value) || 7)}
                    style={styles.digestSelect}
                  >
                    <option value={6}>6:00</option>
                    <option value={7}>7:00</option>
                    <option value={8}>8:00</option>
                    <option value={9}>9:00</option>
                  </select>
                </div>
              </div>

              <div style={styles.digestHint}>
                Zona horaria: <strong>{digestTz}</strong>
              </div>

              {savingDigest && <div style={styles.digestSavingHint}>Guardando configuración…</div>}
              {digestError && <div style={styles.error}>{digestError}</div>}
              {digestOk && <div style={styles.ok}>{digestOk}</div>}
            </section>
          </div>

          {/* Columna derecha */}
          <div style={styles.rightCol}>
           <section style={styles.card} className="spProfileHideMobile">
              <div style={styles.sectionLabel}>Estado general</div>
              <div style={styles.sectionSub}>Revisa de un vistazo cómo está tu cuenta en SyncPlans.</div>

              <div style={styles.accountStatusRow}>
                <div style={styles.statusIcon}>{verified ? "✅" : "⚠️"}</div>
                <div>
                  <div style={styles.statusTitle}>{accountStatusLabel}</div>
                  <div style={styles.statusHint}>{accountStatusHint}</div>
                </div>
              </div>

              <div style={styles.smallGrid}>
                <InfoStat
                  label="Eventos creados"
                  value={statsLoading ? "—" : stats ? `${stats.totalEvents}` : "—"}
                  hint={
                    stats && stats.eventsLast7 > 0
                      ? `${stats.eventsLast7} en los últimos 7 días.`
                      : "Empieza creando tu primer evento en el calendario."
                  }
                />
                <InfoStat
                  label="Conflictos detectados"
                  value={statsLoading ? "—" : stats ? `${stats.conflictsNow}` : "—"}
                  hint={
                    stats && stats.conflictsNow > 0
                      ? "Tienes conflictos activos listos para revisar."
                      : "Detectamos conflictos en el momento en que guardas eventos."
                  }
                />
              </div>

              <div style={styles.configStatusBox}>
                <div style={styles.configStatusTitle}>Cómo vas con tu configuración</div>
                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>{hasNameCompleted ? "✅" : "⏳"}</span>
                  <span>Nombre y apellido definidos</span>
                </div>
                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>{hasCoordPrefsMeaningful ? "✅" : "⏳"}</span>
                  <span>Preferencias de tiempo configuradas</span>
                </div>
                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>{hasGroupMetaGlobal ? "✅" : "⏳"}</span>
                  <span>Roles y nombres en grupos configurados</span>
                </div>
              </div>

              {recommendation && (
                <div style={styles.recoCard}>
                  <div style={styles.recoTitle}>Próximo paso recomendado</div>
                  <div style={styles.recoMain}>{recommendation.title}</div>
                  <div style={styles.recoHint}>{recommendation.hint}</div>
                  {recommendation.ctaLabel && recommendation.ctaTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        const t = recommendation.ctaTarget!;
                        if (t === "groups_new") router.push("/groups/new");
                        else if (t === "calendar") router.push("/calendar");
                        else if (t === "events_new") router.push("/events/new/details?type=personal");
                        else if (t === "conflicts") router.push("/conflicts/detected");
                        else if (t === "invitations") router.push("/invitations");
                      }}
                      style={styles.recoBtn}
                    >
                      {recommendation.ctaLabel}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Tu rol en los grupos (tu UI original) */}
            <section style={styles.card} className="spProfileHideMobile">
              <div style={styles.sectionLabel}>Tu rol en los grupos</div>
              <div style={styles.sectionSub}>
                No eres la misma persona en todos tus calendarios. Aquí defines cómo te ve cada grupo.
              </div>

              {membershipsLoading && <div style={styles.smallInfo}>Cargando tus grupos y roles…</div>}
              {membershipsError && <div style={styles.error}>{membershipsError}</div>}

              {!membershipsLoading && (!memberships || memberships.length === 0) && (
                <div style={styles.smallInfo}>
                  Aún no perteneces a ningún grupo. Empieza creando uno desde la sección de grupos.
                </div>
              )}

              {memberships && memberships.length > 0 && (
                <>
                  <div style={styles.groupSummaryRow}>
                    <span>
                      Tienes <strong>{totalGroupsForRoles}</strong> grupo{totalGroupsForRoles === 1 ? "" : "s"} ·{" "}
                      <strong>{configuredGroupsCount}</strong> con rol configurado ·{" "}
                      <strong>{pendingGroupsCount}</strong> pendiente{pendingGroupsCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div style={styles.groupMasterDetail} className="spProfileMasterDetail">
                    <div style={styles.groupListCol}>
                      <div style={styles.groupListHeader}>
                        <div style={styles.groupFilterChips}>
                          <button
                            type="button"
                            onClick={() => setGroupFilter("all")}
                            style={{
                              ...styles.groupFilterChip,
                              ...(groupFilter === "all" ? styles.groupFilterChipActive : {}),
                            }}
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroupFilter("pair")}
                            style={{
                              ...styles.groupFilterChip,
                              ...(groupFilter === "pair" ? styles.groupFilterChipActive : {}),
                            }}
                          >
                            Pareja
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroupFilter("family")}
                            style={{
                              ...styles.groupFilterChip,
                              ...(groupFilter === "family" ? styles.groupFilterChipActive : {}),
                            }}
                          >
                            Familia
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroupFilter("other")}
                            style={{
                              ...styles.groupFilterChip,
                              ...(groupFilter === "other" ? styles.groupFilterChipActive : {}),
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
                          <div style={styles.groupListEmpty}>No hay grupos que coincidan con el filtro.</div>
                        )}

                        {membershipsFiltered.map((m) => {
                          const g = groupsById.get(m.group_id);
                          const groupName = g?.name ?? "(Grupo sin nombre)";
                          const typeLabel = getGroupTypeLabel(String(g?.type ?? "grupo"));
                          const isSelected = m.group_id === selectedGroupId;
                          const isDirty = dirtyGroups.has(m.group_id);

                          return (
                            <button
                              key={m.group_id}
                              type="button"
                              onClick={() => setSelectedGroupId(m.group_id)}
                              style={{
                                ...styles.groupListItem,
                                ...(isSelected ? styles.groupListItemActive : {}),
                              }}
                            >
                              <div style={styles.groupListItemTitleRow}>
                                <div style={styles.groupListItemName}>
                                  <span style={styles.groupListItemDot} />
                                  <span>{groupName}</span>
                                </div>
                                <span style={styles.badgeTiny}>{typeLabel}</span>
                              </div>

                              <div style={styles.groupListItemMeta}>
                                <span>{hasGroupMeta(m) ? "Rol configurado" : "Sin rol todavía"}</span>
                                {isDirty && <span style={styles.groupListItemDirty}>· Cambios sin guardar</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={styles.groupDetailCol}>
                      {!selectedMembership ? (
                        <div style={styles.smallInfo}>
                          Selecciona un grupo de la lista de la izquierda para definir cómo te ven en ese calendario.
                        </div>
                      ) : (
                        <>
                          <div style={styles.groupMetaHeader}>
                            <div>
                              <div style={styles.groupMetaTitle}>
                                {groupsById.get(selectedMembership.group_id)?.name ?? "(Grupo sin nombre)"}
                              </div>
                              <div style={styles.groupMetaSubtitle}>
                                Define tu nombre visible, tu rol y un contexto rápido para coordinar contigo.
                              </div>
                            </div>
                            <span style={styles.badgeTiny}>
                              {getGroupTypeLabel(String(groupsById.get(selectedMembership.group_id)?.type ?? "grupo"))}
                            </span>
                          </div>

                          <div style={{ marginTop: 4 }}>
                            <div style={styles.groupMetaLabel}>Nombre visible en este grupo</div>
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

                          <div style={{ marginTop: 10 }}>
                            <div style={styles.groupMetaLabel}>Rol en este grupo</div>
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
                              <option value="padre_madre">Padre / Madre</option>
                              <option value="hijo_hija">Hijo / Hija</option>
                              <option value="tutor">Tutor</option>
                              <option value="otro">Otro</option>
                            </select>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <div style={styles.groupMetaLabel}>Algo que deberían saber al coordinar contigo</div>
                            <textarea
                              style={styles.groupMetaTextarea}
                              rows={2}
                              value={selectedMembership.coordination_prefs?.group_note ?? ""}
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

                          {groupSaveError && <div style={styles.error}>{groupSaveError}</div>}
                          {groupSaveMessage && <div style={styles.ok}>{groupSaveMessage}</div>}

                          <div style={styles.groupMetaSaveRow}>
                            <button
                              type="button"
                              onClick={() => handleSaveGroupMeta(selectedMembership.group_id)}
                              disabled={savingGroupId === selectedMembership.group_id || !hasSelectedDirty}
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
                              {savingGroupId === selectedMembership.group_id ? "Guardando…" : "Guardar cambios en este grupo"}
                            </button>

                            <button
                              type="button"
                              onClick={() => router.push(`/calendar?group=${selectedMembership.group_id}`)}
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

            {/* Acciones rápidas */}
            <section style={styles.card} className="spProfileHideMobile">
              <div style={styles.sectionLabel}>Uso y acciones rápidas</div>
              <div style={styles.sectionSub}>Atajos a lo que normalmente haces desde SyncPlans.</div>

              <div style={styles.quickActionsGrid} className="spProfileQuickGrid">
                <QuickAction title="Ir al calendario" hint="Ver tu semana y crear nuevas actividades." onClick={() => router.push("/calendar")} />
                <QuickAction title="Revisar conflictos" hint="Detectar conflictos y decidir qué hacer con ellos." onClick={() => router.push("/conflicts/detected")} />
                <QuickAction title="Gestionar grupos" hint="Pareja, familia o grupos con los que organizas tu tiempo." onClick={() => router.push("/groups")} />
                <QuickAction title="Invitar a alguien" hint="Envía invitaciones para compartir eventos y conflictos." onClick={() => router.push("/invitations")} />
              </div>
            </section>
          </div>
        </div>

        <div style={styles.footer}>
          SyncPlans está pensado para que tu calendario personal, de pareja, familia y grupos compartidos convivan sin fricciones. Este panel es tu centro de control.
        </div>

<style>{`
  /* ✅ Mobile: Panel como app real */
  @media (max-width: 780px) {
    .spProfileMainGrid { grid-template-columns: 1fr !important; }
/* En móvil, el hub manda: lo demás baja de prioridad */
.spProfileHideMobile {
  display: none !important;
}
    /* Master-detail (grupos) pasa a stack */
    .spProfileMasterDetail {
      grid-template-columns: 1fr !important;
      min-height: auto !important;
    }

    /* Lista de grupos: no “cuadro chico”, sino bloque cómodo */
    .spProfileMasterDetail > div:first-child {
      max-height: none !important;
    }

    /* Scroll natural y bonito */
    .spProfileMasterDetail [style*="maxHeight: 260px"] {
      max-height: 240px !important;
    }

    /* Quick actions: 1 columna en móvil chico (más pro) */
    .spProfileQuickGrid {
      grid-template-columns: 1fr !important;
    }
  }
`}</style>
<style>{`
  /* ✅ Mobile: Panel como app real */
  @media (max-width: 780px) {
    .spProfileMainGrid { grid-template-columns: 1fr !important; }
    ...
  }

  /* ✅ Mobile pequeño: el hub pasa a 1 columna */
  @media (max-width: 520px) {
    .spProfileHubGrid {
      grid-template-columns: 1fr !important;
    }
  }
`}</style>
        </MobileScaffold>
</main>
  );
} // ✅ IMPORTANTÍSIMO: aquí cerramos ProfilePage correctamente

/* ───────────────────── COMPONENTES DE APOYO ───────────────────── */

function InfoStat(props: { label: string; value: string; hint?: string }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statLabel}>{props.label}</div>
      <div style={styles.statValue}>{props.value}</div>
      {props.hint && <div style={styles.statHint}>{props.hint}</div>}
    </div>
  );
}
function HubCard(props: { title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={props.onClick} style={styles.hubCard}>
      <div style={styles.hubTitle}>{props.title}</div>
      <div style={styles.hubHint}>{props.hint}</div>
      <div style={styles.hubChevron}>→</div>
    </button>
  );
}
function QuickAction(props: { title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={props.onClick} style={styles.quickAction}>
      <div style={styles.quickActionTitle}>{props.title}</div>
      <div style={styles.quickActionHint}>{props.hint}</div>
      <div style={styles.quickActionChevron}>→</div>
    </button>
  );
}