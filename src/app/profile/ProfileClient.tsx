// src/app/profile/ProfileClient.tsx
"use client";

import React, { useEffect, useState, type CSSProperties } from "react";
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

import {
  type DashboardStats,
  type AnyProfile,
  buildDashboardStats,
  buildRecommendation,
  getPlanInfo,
} from "@/lib/profileDashboard";

type GroupFilter = "all" | "pair" | "family" | "other";

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

function getRecommendationHref(
  ctaTarget?: "groups_new" | "calendar" | "events_new" | "conflicts" | "invitations"
) {
  switch (ctaTarget) {
    case "groups_new":
      return "/groups";
    case "calendar":
      return "/calendar";
    case "events_new":
      return "/events";
    case "conflicts":
      return "/conflicts/detected";
    case "invitations":
      return "/invitations";
    default:
      return "/panel";
  }
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.15), transparent 58%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.10), transparent 58%), #050816",
    color: "rgba(255,255,255,0.92)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },

  headerRow: { marginBottom: 14 },

  loadingRow: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 0.95fr)",
    gap: 14,
  },

  loadingCard: {
    height: 188,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(90deg, rgba(148,163,184,0.12), rgba(15,23,42,0.7), rgba(148,163,184,0.12))",
    backgroundSize: "200% 100%",
    animation: "sp-skeleton 1.3s linear infinite",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.24fr) minmax(0, 0.96fr)",
    gap: 18,
    alignItems: "flex-start",
  },

  leftCol: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
  },

  rightCol: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
  },

  card: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(15,23,42,0.94))",
    boxShadow: "0 22px 54px rgba(2,6,23,0.24)",
    padding: 18,
  },

  heroCard: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "radial-gradient(900px 360px at 0% 0%, rgba(56,189,248,0.16), transparent 56%), radial-gradient(620px 260px at 100% 0%, rgba(124,58,237,0.12), transparent 56%), rgba(15,23,42,0.95)",
    boxShadow: "0 24px 56px rgba(2,6,23,0.30)",
    padding: 20,
    display: "grid",
    gap: 16,
  },

  heroTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },

  profileRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
    flex: "1 1 420px",
  },

  avatar: {
    width: 66,
    height: 66,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.16)",
    background:
      "radial-gradient(circle at 30% 0%, rgba(250,204,21,0.82), transparent 60%), rgba(15,23,42,0.92)",
    fontWeight: 950,
    fontSize: 20,
    flexShrink: 0,
  },

  identityWrap: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },

  identityEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.75,
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.88)",
  },

  nameRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    minWidth: 0,
    flexWrap: "wrap",
  },

  name: {
    fontSize: 28,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },

  chip: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  email: {
    fontSize: 13,
    opacity: 0.76,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },

  heroActionStack: {
    display: "grid",
    gap: 8,
    minWidth: 180,
  },

  heroPrimaryBtn: {
    padding: "11px 15px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.40)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.28), rgba(124,58,237,0.24))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    fontWeight: 900,
  },

  heroSecondaryBtn: {
    padding: "11px 15px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.88)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },

  heroStrip: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.045)",
    padding: "14px 14px",
    display: "grid",
    gap: 4,
  },

  heroStripLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.88)",
  },

  heroStripText: {
    fontSize: 14,
    lineHeight: 1.56,
    color: "rgba(255,255,255,0.92)",
    fontWeight: 700,
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },

  stat: {
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.84)",
  },

  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    opacity: 0.72,
    fontWeight: 900,
    marginBottom: 4,
  },

  statValue: {
    fontSize: 18,
    fontWeight: 950,
    marginBottom: 4,
    lineHeight: 1.1,
  },

  statHint: {
    fontSize: 11,
    opacity: 0.78,
    lineHeight: 1.5,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.75,
    textTransform: "uppercase",
    opacity: 0.78,
    marginBottom: 6,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: 950,
    lineHeight: 1.08,
    margin: 0,
  },

  sectionSub: {
    fontSize: 13,
    opacity: 0.78,
    marginTop: 6,
    lineHeight: 1.58,
  },

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  smallGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  form: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  label: {
    fontSize: 12,
    opacity: 0.82,
    fontWeight: 800,
  },

  input: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    padding: "10px 12px",
    background: "rgba(15,23,42,0.84)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    outline: "none",
  },

  textarea: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    padding: "10px 12px",
    background: "rgba(15,23,42,0.84)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    outline: "none",
    resize: "vertical",
  },

  select: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    padding: "10px 12px",
    background: "rgba(15,23,42,0.84)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    outline: "none",
  },

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

  primaryBtn: {
    padding: "11px 14px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.35)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.25), rgba(124,58,237,0.25))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    fontWeight: 900,
  },

  planCtaRow: {
    marginTop: 10,
    display: "flex",
    justifyContent: "flex-end",
  },

  planPrimaryBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.55)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.32), rgba(124,58,237,0.28))",
    color: "rgba(255,255,255,0.96)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  statusCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.035)",
    padding: 14,
    display: "grid",
    gap: 10,
  },

  accountStatusRow: {
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
    flexShrink: 0,
  },

  statusTitle: {
    fontSize: 13,
    fontWeight: 900,
  },

  statusHint: {
    fontSize: 12,
    opacity: 0.78,
    lineHeight: 1.52,
  },

  configStatusBox: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.76)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  configStatusTitle: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.86,
  },

  configStatusItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
  },

  configStatusBullet: {
    width: 18,
    textAlign: "center",
    flexShrink: 0,
  },

  recoCard: {
    padding: 13,
    borderRadius: 16,
    border: "1px solid rgba(56,189,248,0.30)",
    background:
      "radial-gradient(600px 400px at 0% 0%, rgba(56,189,248,0.14), transparent 55%), rgba(15,23,42,0.9)",
  },

  recoTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    opacity: 0.85,
    fontWeight: 900,
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
    lineHeight: 1.52,
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

  coordForm: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 8,
  },

  coordGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  coordCol: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.76)",
    padding: 12,
  },

  coordLabel: {
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 8,
    opacity: 0.88,
  },

  checkboxRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 13,
    marginBottom: 8,
  },

  coordFieldBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  coordActions: {
    display: "flex",
    justifyContent: "flex-end",
  },

  digestRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
  },

  digestToggle: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: 13,
  },

  digestHourWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  digestHourLabel: {
    fontSize: 13,
    opacity: 0.82,
  },

  digestSelect: {
    padding: "6px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(5,8,22,0.9)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
  },

  digestHint: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.8,
  },

  digestSavingHint: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.8,
  },

  groupSummaryRow: {
    marginBottom: 10,
    fontSize: 12,
    opacity: 0.84,
    lineHeight: 1.5,
  },

  groupMasterDetail: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 0.92fr) minmax(0, 1.24fr)",
    gap: 12,
    minHeight: 360,
  },

  groupListCol: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
  },

  groupListHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  groupFilterChips: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  groupFilterChip: {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.86)",
    color: "rgba(226,232,240,0.9)",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },

  groupFilterChipActive: {
    border: "1px solid rgba(56,189,248,0.48)",
    background: "rgba(56,189,248,0.14)",
    color: "#E0F2FE",
  },

  groupSearchInput: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    padding: "10px 12px",
    background: "rgba(15,23,42,0.86)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    outline: "none",
  },

  groupListScroll: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 420,
    overflowY: "auto",
    paddingRight: 2,
  },

  groupListEmpty: {
    fontSize: 12,
    opacity: 0.8,
    padding: "10px 4px",
  },

  groupListItem: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.80)",
    padding: 12,
    textAlign: "left",
    cursor: "pointer",
  },

  groupListItemActive: {
    border: "1px solid rgba(56,189,248,0.42)",
    background:
      "radial-gradient(600px 300px at 0% 0%, rgba(56,189,248,0.12), transparent 55%), rgba(15,23,42,0.92)",
  },

  groupListItemTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },

  groupListItemName: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    fontSize: 13,
    fontWeight: 900,
  },

  groupListItemDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    flexShrink: 0,
  },

  groupListItemMeta: {
    marginTop: 6,
    fontSize: 11,
    opacity: 0.76,
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    lineHeight: 1.45,
  },

  groupListItemDirty: {
    color: "#FDE68A",
  },

  badgeTiny: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  groupDetailCol: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(15,23,42,0.92))",
    padding: 14,
    minWidth: 0,
  },

  groupMetaHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  groupMetaTitle: {
    fontSize: 16,
    fontWeight: 950,
    lineHeight: 1.2,
  },

  groupMetaSubtitle: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.78,
    lineHeight: 1.55,
  },

  groupMetaLabel: {
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 6,
    opacity: 0.84,
  },

  groupMetaInput: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    padding: "10px 12px",
    background: "rgba(5,8,22,0.9)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    outline: "none",
  },

  groupMetaTextarea: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    padding: "10px 12px",
    background: "rgba(5,8,22,0.9)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    outline: "none",
    resize: "vertical",
  },

  groupMetaSaveRow: {
    marginTop: 12,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  groupMetaSaveBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.45)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.28), rgba(124,58,237,0.24))",
    color: "rgba(255,255,255,0.96)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  groupMetaCalendarBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "transparent",
    color: "rgba(226,232,240,0.95)",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  smallInfo: {
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 1.55,
  },

  footer: {
    marginTop: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(15,23,42,0.92))",
    padding: "14px 16px",
    fontSize: 13,
    lineHeight: 1.6,
    opacity: 0.82,
  },
};

export default function ProfilePage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("—");
  const [verified, setVerified] = useState(false);
  const [initials, setInitials] = useState<string>("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

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

  const [coordPrefs, setCoordPrefs] = useState<CoordinationPrefs | null>(null);
  const [savingCoord, setSavingCoord] = useState(false);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [coordOk, setCoordOk] = useState<string | null>(null);

  const [savingDigest, setSavingDigest] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [digestOk, setDigestOk] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);
        const { data, error } = await supabase.auth.getUser();
        if (!alive) return;

        if (error || !data.user) {
          router.replace("/auth/login?next=/profile");
          return;
        }

        const u = data.user;
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

  if (booting) {
    return (
      <main style={styles.page}>
        <MobileScaffold
          maxWidth={1120}
          paddingDesktop="22px 18px 48px"
          paddingMobile="14px 12px 18px"
          mobileBottomSafe={120}
        >
          <div style={styles.headerRow}>
            <PremiumHeader
              title="Cuenta"
              subtitle="Tu cuenta, tus preferencias y tu forma de coordinar dentro de SyncPlans."
              rightSlot={<LogoutButton />}
              mobileNav="bottom"
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
          mobileBottomSafe={120}
        >
          <div style={styles.headerRow}>
            <PremiumHeader
              title="Cuenta"
              subtitle="Tu cuenta, tus preferencias y tu forma de coordinar dentro de SyncPlans."
              rightSlot={<LogoutButton />}
              mobileNav="bottom"
            />
          </div>
          <div style={styles.error}>
            No se pudo cargar tu perfil. Vuelve a iniciar sesión.
          </div>
        </MobileScaffold>
      </main>
    );
  }

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

    if (groupFilter === "pair" && !(typeStr === "pair" || typeStr === "couple")) {
      return false;
    }
    if (groupFilter === "family" && typeStr !== "family") return false;
    if (
      groupFilter === "other" &&
      (typeStr === "pair" || typeStr === "family" || typeStr === "couple")
    ) {
      return false;
    }

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
    ? memberships.filter((m) => hasGroupMeta(m)).length
    : 0;
  const pendingGroupsCount = Math.max(0, totalGroupsForRoles - configuredGroupsCount);

  const hasSelectedDirty =
    !!selectedMembership && dirtyGroups.has(selectedMembership.group_id);

  const digestEnabled = (profile as any).daily_digest_enabled ?? false;
  const digestHour = (profile as any).daily_digest_hour_local ?? 7;
  const digestTz = (profile as any).daily_digest_timezone ?? "America/Lima";

  const anyProfile = profile as unknown as AnyProfile;
  const { planLabel, planHint, planCtaLabel } = getPlanInfo(anyProfile);

  let heroSummary =
    "Estamos cargando tu cuenta para darte una lectura más clara de tu estado dentro de SyncPlans.";

  if (!statsLoading && stats) {
    if (stats.conflictsNow > 0) {
      heroSummary = `Tienes ${stats.conflictsNow} conflicto${
        stats.conflictsNow === 1 ? "" : "s"
      } visible${stats.conflictsNow === 1 ? "" : "s"} y ${stats.totalGroups} grupo${
        stats.totalGroups === 1 ? "" : "s"
      } activo${stats.totalGroups === 1 ? "" : "s"}.`;
    } else if (stats.totalGroups > 0) {
      heroSummary = `Tu cuenta ya está conectada a ${stats.totalGroups} grupo${
        stats.totalGroups === 1 ? "" : "s"
      } y SyncPlans está listo para coordinar con menos fricción.`;
    } else {
      heroSummary =
        "Tu cuenta está lista para empezar. El siguiente salto real llega cuando sumas grupos y compartes tiempo con alguien más.";
    }
  }

  const recommendationTitle =
    recommendation?.title ?? "Tu cuenta ya está bien encaminada";
  const recommendationHint =
    recommendation?.hint ??
    "La base de tu cuenta está en orden. Cuando quieras operar, vuelve a Panel, Calendario o Conflictos.";
  const recommendationCtaLabel = recommendation?.ctaLabel ?? "Ir al panel";
  const recommendationHref = getRecommendationHref(recommendation?.ctaTarget);

  return (
    <main style={styles.page}>
      <MobileScaffold
        maxWidth={1120}
        paddingDesktop="22px 18px 48px"
        paddingMobile="14px 12px 18px"
        mobileBottomSafe={120}
      >
        <div style={styles.headerRow}>
          <PremiumHeader
            title="Cuenta"
            subtitle="Tu identidad, tus preferencias y cómo SyncPlans te representa cuando compartes tu tiempo."
            mobileNav="bottom"
          />
        </div>

        <section style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div style={styles.profileRow}>
              <div style={styles.avatar}>{initials || "?"}</div>

              <div style={styles.identityWrap}>
                <div style={styles.identityEyebrow}>Tu cuenta</div>

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
                    {accountStatusLabel}
                  </span>
                </div>

                <div style={styles.email}>{email}</div>
              </div>
            </div>

            <div style={styles.heroActionStack}>
              <button
                type="button"
                style={styles.heroPrimaryBtn}
                onClick={() => router.push("/settings")}
              >
                Abrir ajustes
              </button>

              <button
                type="button"
                style={styles.heroSecondaryBtn}
                onClick={() => router.push("/panel")}
              >
                Volver al panel
              </button>
            </div>
          </div>

          <div style={styles.heroStrip}>
            <div style={styles.heroStripLabel}>Estado actual</div>
            <div style={styles.heroStripText}>{heroSummary}</div>
          </div>

          <div style={styles.heroStats}>
            <div style={styles.stat}>
              <div style={styles.statLabel}>Plan</div>
              <div style={styles.statValue}>{planLabel}</div>
              <div style={styles.statHint}>{planHint}</div>
            </div>

            <div style={styles.stat}>
              <div style={styles.statLabel}>Grupos</div>
              <div style={styles.statValue}>
                {statsLoading ? "…" : stats?.totalGroups ?? 0}
              </div>
              <div style={styles.statHint}>Espacios compartidos donde ya participas.</div>
            </div>

            <div style={styles.stat}>
              <div style={styles.statLabel}>Eventos recientes</div>
              <div style={styles.statValue}>
                {statsLoading ? "…" : stats?.eventsLast7 ?? 0}
              </div>
              <div style={styles.statHint}>Eventos visibles en los últimos 7 días.</div>
            </div>

            <div style={styles.stat}>
              <div style={styles.statLabel}>Conflictos</div>
              <div style={styles.statValue}>
                {statsLoading ? "…" : stats?.conflictsNow ?? 0}
              </div>
              <div style={styles.statHint}>Choques activos que siguen pendientes.</div>
            </div>
          </div>
        </section>

        <div style={styles.mainGrid}>
          <div style={styles.leftCol}>
            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Perfil</div>
                  <h2 style={styles.sectionTitle}>Tu identidad en SyncPlans</h2>
                  <div style={styles.sectionSub}>
                    Mantén tu nombre y tu información básica al día para que la
                    coordinación compartida se vea clara y consistente en toda la app.
                  </div>
                </div>

                <span
                  style={{
                    ...styles.badgeTiny,
                    borderColor: hasNameCompleted
                      ? "rgba(34,197,94,0.34)"
                      : "rgba(250,204,21,0.34)",
                    background: hasNameCompleted
                      ? "rgba(34,197,94,0.10)"
                      : "rgba(250,204,21,0.10)",
                    color: hasNameCompleted ? "#DCFCE7" : "#FEF3C7",
                  }}
                >
                  {hasNameCompleted ? "Completo" : "Pendiente"}
                </span>
              </div>

              <form style={styles.form} onSubmit={handleSaveProfile}>
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
                      placeholder="Gainza"
                    />
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Correo</label>
                  <input style={styles.input} value={email} disabled />
                </div>

                {profileError ? <div style={styles.error}>{profileError}</div> : null}
                {profileOk ? <div style={styles.ok}>{profileOk}</div> : null}

                <div style={styles.formActions}>
                  <div style={styles.smallInfo}>
                    Este nombre se usa para representarte mejor dentro de SyncPlans.
                  </div>

                  <button
                    type="submit"
                    style={styles.primaryBtn}
                    disabled={savingProfile}
                  >
                    {savingProfile ? "Guardando..." : "Guardar perfil"}
                  </button>
                </div>
              </form>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Preferencias</div>
                  <h2 style={styles.sectionTitle}>Cómo prefieres coordinar</h2>
                  <div style={styles.sectionSub}>
                    Estas señales ayudan a SyncPlans a entender mejor tu estilo
                    cuando compartes decisiones, tiempos y disponibilidad.
                  </div>
                </div>

                <span
                  style={{
                    ...styles.badgeTiny,
                    borderColor: hasCoordPrefsMeaningful
                      ? "rgba(34,197,94,0.34)"
                      : "rgba(148,163,184,0.28)",
                    background: hasCoordPrefsMeaningful
                      ? "rgba(34,197,94,0.10)"
                      : "rgba(255,255,255,0.04)",
                    color: hasCoordPrefsMeaningful
                      ? "#DCFCE7"
                      : "rgba(226,232,240,0.86)",
                  }}
                >
                  {hasCoordPrefsMeaningful ? "Configurado" : "Base"}
                </span>
              </div>

              <form style={styles.coordForm} onSubmit={handleSaveCoordPrefs}>
                <div style={styles.coordGrid}>
                  <div style={styles.coordCol}>
                    <div style={styles.coordLabel}>Momentos preferidos</div>

                    <label style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={coord.prefers_mornings}
                        onChange={(e) =>
                          setCoordPrefs({
                            ...coord,
                            prefers_mornings: e.target.checked,
                          })
                        }
                      />
                      Prefiero coordinar por la mañana
                    </label>

                    <label style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={coord.prefers_evenings}
                        onChange={(e) =>
                          setCoordPrefs({
                            ...coord,
                            prefers_evenings: e.target.checked,
                          })
                        }
                      />
                      Prefiero coordinar por la tarde / noche
                    </label>

                    <label style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={coord.prefers_weekdays}
                        onChange={(e) =>
                          setCoordPrefs({
                            ...coord,
                            prefers_weekdays: e.target.checked,
                          })
                        }
                      />
                      Me acomodo mejor entre semana
                    </label>

                    <label style={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={coord.prefers_weekends}
                        onChange={(e) =>
                          setCoordPrefs({
                            ...coord,
                            prefers_weekends: e.target.checked,
                          })
                        }
                      />
                      Me acomodo mejor fines de semana
                    </label>
                  </div>

                  <div style={styles.coordCol}>
                    <div style={styles.coordFieldBlock}>
                      <label style={styles.label}>Estilo para decidir</label>
                      <select
                        style={styles.select}
                        value={coord.decision_style}
                        onChange={(e) =>
                          setCoordPrefs({
                            ...coord,
                            decision_style: e.target
                              .value as CoordinationPrefs["decision_style"],
                          })
                        }
                      >
                        <option value="depends">Depende del caso</option>
                        <option value="fast">Prefiero decidir rápido</option>
                        <option value="balanced">Prefiero evaluar bien</option>
                        <option value="careful">Prefiero decidir con calma</option>
                      </select>
                    </div>

                    <div style={{ ...styles.coordFieldBlock, marginTop: 10 }}>
                      <label style={styles.label}>Notas o límites importantes</label>
                      <textarea
                        style={{ ...styles.textarea, minHeight: 110 }}
                        value={coord.blocked_note ?? ""}
                        onChange={(e) =>
                          setCoordPrefs({
                            ...coord,
                            blocked_note: e.target.value,
                          })
                        }
                        placeholder="Ej. Prefiero evitar reuniones muy tarde entre semana."
                      />
                    </div>
                  </div>
                </div>

                {coordError ? <div style={styles.error}>{coordError}</div> : null}
                {coordOk ? <div style={styles.ok}>{coordOk}</div> : null}

                <div style={styles.coordActions}>
                  <button
                    type="submit"
                    style={styles.primaryBtn}
                    disabled={savingCoord}
                  >
                    {savingCoord ? "Guardando..." : "Guardar preferencias"}
                  </button>
                </div>
              </form>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Grupos</div>
                  <h2 style={styles.sectionTitle}>Cómo te representas en cada grupo</h2>
                  <div style={styles.sectionSub}>
                    Ajusta tu nombre visible, tu rol y notas específicas para cada
                    relación compartida, sin convertir esta pantalla en un segundo hub.
                  </div>
                </div>

                <span
                  style={{
                    ...styles.badgeTiny,
                    borderColor: hasGroupMetaGlobal
                      ? "rgba(34,197,94,0.34)"
                      : "rgba(148,163,184,0.28)",
                    background: hasGroupMetaGlobal
                      ? "rgba(34,197,94,0.10)"
                      : "rgba(255,255,255,0.04)",
                    color: hasGroupMetaGlobal
                      ? "#DCFCE7"
                      : "rgba(226,232,240,0.86)",
                  }}
                >
                  {configuredGroupsCount}/{totalGroupsForRoles} configurados
                </span>
              </div>

              <div style={styles.groupSummaryRow}>
                {membershipsLoading
                  ? "Estamos cargando tus grupos..."
                  : membershipsError
                  ? membershipsError
                  : totalGroupsForRoles === 0
                  ? "Todavía no formas parte de grupos compartidos."
                  : pendingGroupsCount > 0
                  ? `Tienes ${pendingGroupsCount} grupo${
                      pendingGroupsCount === 1 ? "" : "s"
                    } pendiente${pendingGroupsCount === 1 ? "" : "s"} de configurar.`
                  : "Tu representación por grupo ya está configurada."}
              </div>

              <div style={styles.groupMasterDetail}>
                <div style={styles.groupListCol}>
                  <div style={styles.groupListHeader}>
                    <div style={styles.groupFilterChips}>
                      {[
                        { key: "all", label: "Todos" },
                        { key: "pair", label: "Pareja" },
                        { key: "family", label: "Familia" },
                        { key: "other", label: "Compartido" },
                      ].map((item) => {
                        const active = groupFilter === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            style={{
                              ...styles.groupFilterChip,
                              ...(active ? styles.groupFilterChipActive : {}),
                            }}
                            onClick={() => setGroupFilter(item.key as GroupFilter)}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      style={styles.groupSearchInput}
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="Buscar grupo..."
                    />
                  </div>

                  <div style={styles.groupListScroll}>
                    {membershipsFiltered.length === 0 ? (
                      <div style={styles.groupListEmpty}>
                        No encontramos grupos con ese filtro.
                      </div>
                    ) : (
                      membershipsFiltered.map((m) => {
                        const group = groupsById.get(m.group_id);
                        const selected = selectedMembership?.group_id === m.group_id;
                        const dirty = dirtyGroups.has(m.group_id);

                        return (
                          <button
                            key={m.group_id}
                            type="button"
                            onClick={() => setSelectedGroupId(m.group_id)}
                            style={{
                              ...styles.groupListItem,
                              ...(selected ? styles.groupListItemActive : {}),
                            }}
                          >
                            <div style={styles.groupListItemTitleRow}>
                              <div style={styles.groupListItemName}>
                                <span style={styles.groupListItemDot} />
                                <span
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {group?.name ?? "Grupo"}
                                </span>
                              </div>

                              <span style={styles.badgeTiny}>
                                {getGroupTypeLabel(group?.type)}
                              </span>
                            </div>

                            <div style={styles.groupListItemMeta}>
                              <span>{m.display_name?.trim() || "Sin nombre visible"}</span>
                              <span>•</span>
                              <span>{m.relationship_role?.trim() || "Sin rol definido"}</span>
                              {dirty ? (
                                <>
                                  <span>•</span>
                                  <span style={styles.groupListItemDirty}>
                                    Cambios sin guardar
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div style={styles.groupDetailCol}>
                  {!selectedMembership ? (
                    <div style={styles.smallInfo}>
                      Selecciona un grupo para ajustar cómo te representas dentro de
                      ese espacio compartido.
                    </div>
                  ) : (
                    (() => {
                      const group = groupsById.get(selectedMembership.group_id);

                      return (
                        <>
                          <div style={styles.groupMetaHeader}>
                            <div>
                              <div style={styles.groupMetaTitle}>
                                {group?.name ?? "Grupo"}
                              </div>
                              <div style={styles.groupMetaSubtitle}>
                                {getGroupTypeLabel(group?.type)} · Ajustes visibles solo
                                para mejorar cómo SyncPlans te presenta dentro de este grupo.
                              </div>
                            </div>

                            <button
                              type="button"
                              style={styles.groupMetaCalendarBtn}
                              onClick={() => router.push(`/groups/${selectedMembership.group_id}`)}
                            >
                              Ver grupo
                            </button>
                          </div>

                          <div style={{ height: 12 }} />

                          <div style={styles.field}>
                            <label style={styles.groupMetaLabel}>Nombre visible</label>
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
                              placeholder="Ej. Fer"
                            />
                          </div>

                          <div style={{ height: 10 }} />

                          <div style={styles.field}>
                            <label style={styles.groupMetaLabel}>Tu rol o vínculo</label>
                            <input
                              style={styles.groupMetaInput}
                              value={selectedMembership.relationship_role ?? ""}
                              onChange={(e) =>
                                handleMembershipFieldChange(
                                  selectedMembership.group_id,
                                  "relationship_role",
                                  e.target.value
                                )
                              }
                              placeholder="Ej. Pareja, hermano, organizador"
                            />
                          </div>

                          <div style={{ height: 10 }} />

                          <div style={styles.field}>
                            <label style={styles.groupMetaLabel}>Nota contextual</label>
                            <textarea
                              style={{ ...styles.groupMetaTextarea, minHeight: 130 }}
                              value={
                                selectedMembership.coordination_prefs?.group_note ?? ""
                              }
                              onChange={(e) =>
                                handleMembershipFieldChange(
                                  selectedMembership.group_id,
                                  "group_note",
                                  e.target.value
                                )
                              }
                              placeholder="Ej. En este grupo suelo priorizar fines de semana o reuniones más cortas."
                            />
                          </div>

                          {groupSaveError ? (
                            <div style={{ ...styles.error, marginTop: 10 }}>
                              {groupSaveError}
                            </div>
                          ) : null}

                          {groupSaveMessage && hasSelectedDirty === false ? (
                            <div style={{ ...styles.ok, marginTop: 10 }}>
                              {groupSaveMessage}
                            </div>
                          ) : null}

                          <div style={styles.groupMetaSaveRow}>
                            <div style={styles.smallInfo}>
                              Estos ajustes refinan tu representación. La operación
                              diaria de grupos sigue viviendo en Panel.
                            </div>

                            <button
                              type="button"
                              style={styles.groupMetaSaveBtn}
                              disabled={savingGroupId === selectedMembership.group_id}
                              onClick={() =>
                                handleSaveGroupMeta(selectedMembership.group_id)
                              }
                            >
                              {savingGroupId === selectedMembership.group_id
                                ? "Guardando..."
                                : "Guardar grupo"}
                            </button>
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>
              </div>
            </section>
          </div>

          <div style={styles.rightCol}>
            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Cuenta</div>
                  <h2 style={styles.sectionTitle}>Estado de tu cuenta</h2>
                  <div style={styles.sectionSub}>
                    Lo esencial para entender cómo está tu cuenta hoy, sin convertir
                    esta pantalla en otro centro operativo.
                  </div>
                </div>
              </div>

              <div style={styles.smallGrid}>
                <div style={styles.statusCard}>
                  <div style={styles.accountStatusRow}>
                    <div style={styles.statusIcon}>{verified ? "✓" : "!"}</div>
                    <div>
                      <div style={styles.statusTitle}>{accountStatusLabel}</div>
                      <div style={styles.statusHint}>{accountStatusHint}</div>
                    </div>
                  </div>
                </div>

                <div style={styles.statusCard}>
                  <div style={styles.accountStatusRow}>
                    <div style={styles.statusIcon}>★</div>
                    <div>
                      <div style={styles.statusTitle}>{planLabel}</div>
                      <div style={styles.statusHint}>{planHint}</div>
                    </div>
                  </div>

                  <div style={styles.planCtaRow}>
                    <button
                      type="button"
                      style={styles.planPrimaryBtn}
                      onClick={() => router.push("/planes")}
                    >
                      {planCtaLabel}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div style={styles.configStatusBox}>
                <div style={styles.configStatusTitle}>Lectura rápida de configuración</div>

                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>
                    {hasNameCompleted ? "✓" : "•"}
                  </span>
                  <span>
                    Perfil {hasNameCompleted ? "completo" : "pendiente de completar"}
                  </span>
                </div>

                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>
                    {hasCoordPrefsMeaningful ? "✓" : "•"}
                  </span>
                  <span>
                    Preferencias{" "}
                    {hasCoordPrefsMeaningful
                      ? "configuradas"
                      : "todavía en estado base"}
                  </span>
                </div>

                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>
                    {configuredGroupsCount > 0 ? "✓" : "•"}
                  </span>
                  <span>
                    Representación por grupos{" "}
                    {configuredGroupsCount > 0
                      ? `configurada en ${configuredGroupsCount}`
                      : "sin configurar"}
                  </span>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Recomendación</div>
                  <h2 style={styles.sectionTitle}>Siguiente mejora sugerida</h2>
                  <div style={styles.sectionSub}>
                    Una recomendación concreta para mejorar tu cuenta sin distraerte
                    del flujo principal del producto.
                  </div>
                </div>
              </div>

              <div style={styles.recoCard}>
                <div style={styles.recoTitle}>{recommendationTitle}</div>
                <div style={styles.recoMain}>{recommendationTitle}</div>
                <div style={styles.recoHint}>{recommendationHint}</div>

                <button
                  type="button"
                  style={styles.recoBtn}
                  onClick={() => router.push(recommendationHref)}
                >
                  {recommendationCtaLabel}
                </button>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Resumen diario</div>
                  <h2 style={styles.sectionTitle}>Entrega automática por correo</h2>
                  <div style={styles.sectionSub}>
                    Controla si quieres recibir un resumen diario de tu coordinación
                    y a qué hora local prefieres recibirlo.
                  </div>
                </div>
              </div>

              <div style={styles.digestRow}>
                <label style={styles.digestToggle}>
                  <input
                    type="checkbox"
                    checked={digestEnabled}
                    disabled={savingDigest}
                    onChange={(e) => handleToggleDigest(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  Activar resumen diario
                </label>

                <div style={styles.digestHourWrap}>
                  <span style={styles.digestHourLabel}>Hora</span>
                  <select
                    style={styles.digestSelect}
                    value={String(digestHour)}
                    disabled={savingDigest}
                    onChange={(e) => handleChangeDigestHour(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                      <option key={hour} value={hour}>
                        {hour.toString().padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.digestHint}>
                Zona horaria actual: <strong>{digestTz}</strong>
              </div>

              {savingDigest ? (
                <div style={styles.digestSavingHint}>Guardando cambios...</div>
              ) : null}

              {digestError ? <div style={styles.error}>{digestError}</div> : null}
              {digestOk ? <div style={styles.ok}>{digestOk}</div> : null}
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Sesión</div>
                  <h2 style={styles.sectionTitle}>Control de acceso</h2>
                  <div style={styles.sectionSub}>
                    Desde aquí puedes cerrar tu sesión actual. Para operar en la app,
                    usa Resumen, Calendario, Conflictos o Panel.
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <LogoutButton />
              </div>
            </section>
          </div>
        </div>

        <section style={styles.footer}>
          Tu cuenta define cómo apareces y cómo prefieres coordinar dentro de
          SyncPlans. La operación diaria vive en <strong>Resumen</strong>,{" "}
          <strong>Calendario</strong>, <strong>Conflictos</strong> y{" "}
          <strong>Panel</strong>. Esta pantalla ya no compite con ese flujo: lo
          complementa.
        </section>
      </MobileScaffold>
    </main>
  );
}