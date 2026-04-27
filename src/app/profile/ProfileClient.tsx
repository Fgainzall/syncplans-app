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
import { trackEvent, trackEventOnce } from "@/lib/analytics";
import {
  getMyGroups,
  type GroupRow,
} from "@/lib/groupsDb";

import {

/* SYNCPLANS: emphasize groups and coordination role */

  type DashboardStats,
  type AnyProfile,
  buildDashboardStats,
  buildRecommendation,
  getPlanInfo,
} from "@/lib/profileDashboard";

function normalizeCoordPrefs(
  prefs?: Partial<CoordinationPrefs> | null
): CoordinationPrefs {
  return normalizeCoordinationPrefs(
    (prefs ?? null) as CoordinationPrefs | null | undefined
  );
}


function useIsCompactLayout() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsCompact(media.matches);

    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return isCompact;
}

function getRecommendationHref(
  ctaTarget?: "groups_new" | "calendar" | "events_new" | "conflicts" | "invitations"
) {
  switch (ctaTarget) {
    case "groups_new":
      return "/groups/new";
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

  premiumContextCard: {
    borderRadius: 20,
    border: "1px solid rgba(56,189,248,0.22)",
    background:
      "radial-gradient(680px 320px at 0% 0%, rgba(56,189,248,0.12), transparent 58%), radial-gradient(520px 260px at 100% 0%, rgba(124,58,237,0.10), transparent 56%), rgba(15,23,42,0.9)",
    boxShadow: "0 18px 42px rgba(2,6,23,0.22)",
    padding: 16,
    display: "grid",
    gap: 10,
  },

  premiumContextEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.72,
    textTransform: "uppercase",
    color: "rgba(125,211,252,0.92)",
  },

  premiumContextTitle: {
    fontSize: 16,
    lineHeight: 1.26,
    fontWeight: 950,
    color: "rgba(255,255,255,0.96)",
  },

  premiumContextText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: "rgba(226,232,240,0.86)",
  },

  premiumContextRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },

  premiumContextBadge: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 11,
    fontWeight: 900,
    color: "rgba(226,232,240,0.88)",
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
  const isCompact = useIsCompactLayout();

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

  const [coordPrefs, setCoordPrefs] = useState<CoordinationPrefs | null>(null);
  const [savingCoord, setSavingCoord] = useState(false);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [coordOk, setCoordOk] = useState<string | null>(null);

  const [savingDigest, setSavingDigest] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [digestOk, setDigestOk] = useState<string | null>(null);

  const loadingRowStyle: CSSProperties = isCompact
    ? { ...styles.loadingRow, gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }
    : styles.loadingRow;

  const heroCardStyle: CSSProperties = isCompact
    ? { ...styles.heroCard, borderRadius: 22, padding: 14, gap: 14 }
    : styles.heroCard;

  const heroTopStyle: CSSProperties = isCompact
    ? {
        ...styles.heroTop,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 14,
      }
    : styles.heroTop;

  const profileRowStyle: CSSProperties = isCompact
    ? { ...styles.profileRow, flex: "1 1 auto", width: "100%", alignItems: "flex-start" }
    : styles.profileRow;

  const avatarStyle: CSSProperties = isCompact
    ? { ...styles.avatar, width: 54, height: 54, fontSize: 17 }
    : styles.avatar;

  const nameStyle: CSSProperties = isCompact
    ? {
        ...styles.name,
        fontSize: 22,
        lineHeight: 1.12,
        whiteSpace: "normal",
        overflowWrap: "anywhere",
      }
    : styles.name;

  const heroActionStackStyle: CSSProperties = isCompact
    ? { ...styles.heroActionStack, minWidth: 0, width: "100%" }
    : styles.heroActionStack;

  const heroStatsStyle: CSSProperties = isCompact
    ? { ...styles.heroStats, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }
    : styles.heroStats;

  const statStyle: CSSProperties = isCompact
    ? { ...styles.stat, padding: 11, borderRadius: 16, minWidth: 0, overflow: "hidden" }
    : styles.stat;

  const statLabelStyle: CSSProperties = isCompact
    ? { ...styles.statLabel, fontSize: 10, lineHeight: 1.25, overflowWrap: "anywhere" }
    : styles.statLabel;

  const statValueStyle: CSSProperties = isCompact
    ? { ...styles.statValue, fontSize: 16, lineHeight: 1.15, overflowWrap: "anywhere" }
    : styles.statValue;

  const statHintStyle: CSSProperties = isCompact
    ? { ...styles.statHint, fontSize: 10.5, lineHeight: 1.42, overflowWrap: "anywhere" }
    : styles.statHint;

  const mainGridStyle: CSSProperties = isCompact
    ? { ...styles.mainGrid, gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }
    : styles.mainGrid;

  const cardStyle: CSSProperties = isCompact
    ? { ...styles.card, borderRadius: 20, padding: 14 }
    : styles.card;

  const sectionTitleStyle: CSSProperties = isCompact
    ? { ...styles.sectionTitle, fontSize: 19, lineHeight: 1.16 }
    : styles.sectionTitle;

  const formRowStyle: CSSProperties = isCompact
    ? { ...styles.formRow, gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }
    : styles.formRow;

  const smallGridStyle: CSSProperties = isCompact
    ? { ...styles.smallGrid, gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }
    : styles.smallGrid;

  const coordGridStyle: CSSProperties = isCompact
    ? { ...styles.coordGrid, gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }
    : styles.coordGrid;

  const formActionsStyle: CSSProperties = isCompact
    ? { ...styles.formActions, flexDirection: "column", alignItems: "stretch" }
    : styles.formActions;

  const coordActionsStyle: CSSProperties = isCompact
    ? { ...styles.coordActions, justifyContent: "stretch" }
    : styles.coordActions;

  const digestRowStyle: CSSProperties = isCompact
    ? { ...styles.digestRow, flexDirection: "column", alignItems: "stretch", gap: 12 }
    : styles.digestRow;

  const fullWidthButtonStyle: CSSProperties = isCompact
    ? { width: "100%", justifyContent: "center", textAlign: "center" }
    : {};


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

        setStats(buildDashboardStats(events, groupsRows));
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
  }, [profile]);


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

  const totalGroups = stats?.totalGroups ?? 0;
  const eventsLast7 = stats?.eventsLast7 ?? 0;
  const conflictsNow = stats?.conflictsNow ?? 0;

  const safeAnyProfile = (profile ?? {}) as AnyProfile;
  const {
    planLabel: safePlanLabel,
    planHint: safePlanHint,
    planCtaLabel: safePlanCtaLabel,
  } = getPlanInfo(safeAnyProfile);

  const premiumActive =
    String(safePlanLabel).toLowerCase().includes("premium") ||
    String(safePlanLabel).toLowerCase().includes("fundador");
  const premiumContextKey =
    conflictsNow > 0
      ? "conflicts"
      : totalGroups > 0 && eventsLast7 >= 3
        ? "shared_load"
        : totalGroups > 0
          ? "groups"
          : "account";

  useEffect(() => {
    if (!profile?.id || premiumActive) return;

    void trackEventOnce({
      onceKey: `profile-premium-viewed:${premiumContextKey}`,
      scope: "session",
      event: "premium_viewed",
      userId: String(profile.id),
      metadata: {
        screen: "profile",
        area: "account_status",
        context: premiumContextKey,
        total_groups: totalGroups,
        events_last_7: eventsLast7,
        conflicts_now: conflictsNow,
        plan_label: safePlanLabel,
      },
    });
  }, [profile?.id, premiumActive, premiumContextKey, totalGroups, eventsLast7, conflictsNow, safePlanLabel]);

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
            hideUpgradeCta
              title="Cuenta"
              subtitle="Tu identidad, tu plan y la forma en que SyncPlans te representa cuando compartes tu tiempo."
              rightSlot={<LogoutButton />}
              mobileNav="bottom"
            />
          </div>

          <div style={loadingRowStyle}>
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
            hideUpgradeCta
              title="Cuenta"
              subtitle="Tu identidad, tu plan y la forma en que SyncPlans te representa cuando compartes tu tiempo."
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

  const digestEnabled = (profile as any).daily_digest_enabled ?? false;
  const digestHour = (profile as any).daily_digest_hour_local ?? 7;
  const digestTz = (profile as any).daily_digest_timezone ?? "America/Lima";

  const anyProfile = profile as unknown as AnyProfile;
  const planLabel = safePlanLabel;
  const planHint = safePlanHint;
  const planCtaLabel = safePlanCtaLabel;

  const premiumContextTitle = premiumContextKey === "conflicts"
    ? "Premium te ayuda cuando la coordinación ya se está tensando"
    : premiumContextKey === "shared_load"
      ? "Premium gana valor cuando tu semana ya se coordina de verdad"
      : premiumContextKey === "groups"
        ? "Premium se vuelve más útil cuando ya compartes tiempo con otros"
        : "Premium cobra sentido cuando quieres más claridad que solo una cuenta base";

  const premiumContextText = premiumContextKey === "conflicts"
    ? `Ya tienes ${conflictsNow} conflicto${conflictsNow === 1 ? "" : "s"} pendiente${conflictsNow === 1 ? "" : "s"}. Premium suma más contexto para anticipar mejor, decidir más rápido y reducir idas y vueltas cuando el tiempo compartido empieza a chocar.`
    : premiumContextKey === "shared_load"
      ? `Tu cuenta ya mueve ${eventsLast7} eventos visibles en los últimos 7 días y ${totalGroups} grupo${totalGroups === 1 ? "" : "s"}. Premium se siente más lógico cuando SyncPlans deja de ser solo referencia y se vuelve capa real de coordinación.`
      : premiumContextKey === "groups"
        ? `Ya participas en ${totalGroups} grupo${totalGroups === 1 ? "" : "s"}. Premium no añade ruido: añade más claridad, mejores señales y una experiencia más fuerte cuando la coordinación compartida importa de verdad.`
        : "Tu cuenta ya está lista. Premium tiene más sentido cuando quieres una experiencia más completa, más clara y mejor preparada para coordinar con menos fricción.";

  const premiumContextBadge = premiumContextKey === "conflicts"
    ? "Más útil con conflictos"
    : premiumContextKey === "shared_load"
      ? "Más útil con uso real"
      : premiumContextKey === "groups"
        ? "Más útil con grupos"
        : "Más claridad compartida";

  const premiumContextCta = premiumActive ? "Ver tu plan" : (planCtaLabel || "Ver planes");

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
      heroSummary = `Tu cuenta ya participa en ${stats.totalGroups} grupo${
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
            hideUpgradeCta
            title="Cuenta"
            subtitle="Tu identidad, tu plan y la lectura de cuenta que sostiene tu coordinación compartida, sin convertir esta pantalla en otro hub."
            mobileNav="bottom"
          />
        </div>

        <section style={heroCardStyle}>
          <div style={heroTopStyle}>
            <div style={profileRowStyle}>
              <div style={avatarStyle}>{initials || "?"}</div>

              <div style={styles.identityWrap}>
                <div style={styles.identityEyebrow}>Tu cuenta</div>

                <div style={styles.nameRow}>
                  <span style={nameStyle}>
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

            <div style={heroActionStackStyle}>
              <button
                type="button"
                style={{ ...styles.heroPrimaryBtn, ...fullWidthButtonStyle }}
                onClick={() => router.push("/settings")}
              >
                Gestionar cuenta
              </button>

              <button
                type="button"
                style={{ ...styles.heroSecondaryBtn, ...fullWidthButtonStyle }}
                onClick={() => router.push("/panel")}
              >
                Ir al panel
              </button>
            </div>
          </div>

          <div style={styles.heroStrip}>
            <div style={styles.heroStripLabel}>Estado actual</div>
            <div style={styles.heroStripText}>{heroSummary}</div>
          </div>

          <div style={heroStatsStyle}>
            <div style={statStyle}>
              <div style={statLabelStyle}>Plan</div>
              <div style={statValueStyle}>{planLabel}</div>
              <div style={statHintStyle}>{planHint}</div>
            </div>

            <div style={statStyle}>
              <div style={statLabelStyle}>Grupos</div>
              <div style={statValueStyle}>
                {statsLoading ? "…" : stats?.totalGroups ?? 0}
              </div>
              <div style={statHintStyle}>Espacios compartidos donde ya participas.</div>
            </div>

            <div style={statStyle}>
              <div style={statLabelStyle}>Eventos recientes</div>
              <div style={statValueStyle}>
                {statsLoading ? "…" : stats?.eventsLast7 ?? 0}
              </div>
              <div style={statHintStyle}>Eventos visibles en los últimos 7 días.</div>
            </div>

            <div style={statStyle}>
              <div style={statLabelStyle}>Conflictos</div>
              <div style={statValueStyle}>
                {statsLoading ? "…" : stats?.conflictsNow ?? 0}
              </div>
              <div style={statHintStyle}>Choques activos que siguen pendientes.</div>
            </div>
          </div>
        </section>

        <div style={mainGridStyle}>
          <div style={styles.leftCol}>
            <section style={cardStyle}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Perfil</div>
                  <h2 style={sectionTitleStyle}>Tu identidad en SyncPlans</h2>
                  <div style={styles.sectionSub}>
                    Mantén tu nombre y tu información básica al día para que la coordinación compartida tenga una sola verdad visible en toda la app.
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
                <div style={formRowStyle}>
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

                <div style={formActionsStyle}>
                  <div style={styles.smallInfo}>
                    Este nombre se usa para representarte mejor dentro de SyncPlans.
                  </div>

                  <button
                    type="submit"
                    style={{ ...styles.primaryBtn, ...fullWidthButtonStyle }}
                    disabled={savingProfile}
                  >
                    {savingProfile ? "Guardando..." : "Guardar perfil"}
                  </button>
                </div>
              </form>
            </section>

            <section style={cardStyle}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Preferencias</div>
                  <h2 style={sectionTitleStyle}>Cómo prefieres coordinar</h2>
                  <div style={styles.sectionSub}>
                    Estas señales ayudan a SyncPlans a leer mejor tu estilo cuando toca decidir, ceder, proponer o ordenar tiempo compartido.
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
                <div style={coordGridStyle}>
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

                <div style={coordActionsStyle}>
                  <button
                    type="submit"
                    style={{ ...styles.primaryBtn, ...fullWidthButtonStyle }}
                    disabled={savingCoord}
                  >
                    {savingCoord ? "Guardando..." : "Guardar preferencias"}
                  </button>
                </div>
              </form>
            </section>

            <section style={cardStyle}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Espacios compartidos</div>
                  <h2 style={sectionTitleStyle}>Tu estructura compartida</h2>
                  <div style={styles.sectionSub}>
                    Tus grupos siguen formando parte de tu cuenta, pero la operación ya vive en Panel. Aquí solo mantienes una lectura clara de tu estructura para no confundir identidad con administración.
                  </div>
                </div>

                <span
                  style={{
                    ...styles.badgeTiny,
                    borderColor:
                      totalGroups > 0
                        ? "rgba(34,197,94,0.34)"
                        : "rgba(148,163,184,0.28)",
                    background:
                      totalGroups > 0
                        ? "rgba(34,197,94,0.10)"
                        : "rgba(255,255,255,0.04)",
                    color:
                      totalGroups > 0
                        ? "#DCFCE7"
                        : "rgba(226,232,240,0.86)",
                  }}
                >
                  {totalGroups > 0 ? `${totalGroups} activos` : "Sin grupos"}
                </span>
              </div>

              <div style={smallGridStyle}>
                <div style={styles.statusCard}>
                  <div style={styles.accountStatusRow}>
                    <div style={styles.statusIcon}>◎</div>
                    <div>
                      <div style={styles.statusTitle}>
                        {totalGroups > 0
                          ? `${totalGroups} grupo${totalGroups === 1 ? "" : "s"}`
                          : "Sin grupos todavía"}
                      </div>
                      <div style={styles.statusHint}>
                        {totalGroups > 0
                          ? "Tu estructura compartida ya existe. La administración detallada vive en Panel."
                          : "Cuando empieces a compartir tiempo con alguien, aquí verás una lectura simple de esa estructura."}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.statusCard}>
                  <div style={styles.accountStatusRow}>
                    <div style={styles.statusIcon}>↗</div>
                    <div>
                      <div style={styles.statusTitle}>Continuar en Panel</div>
                      <div style={styles.statusHint}>
                        Grupos, invitaciones, miembros e integraciones se gestionan desde tu hub administrativo.
                      </div>
                    </div>
                  </div>

                  <div style={styles.planCtaRow}>
                    <button
                      type="button"
                      style={{ ...styles.planPrimaryBtn, ...fullWidthButtonStyle }}
                      onClick={() => router.push("/panel")}
                    >
                      Abrir panel
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ ...styles.configStatusBox, marginTop: 12 }}>
                <div style={styles.configStatusTitle}>Lectura rápida</div>

                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>•</span>
                  <span>
                    Grupos activos: <strong>{totalGroups}</strong>
                  </span>
                </div>

                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>•</span>
                  <span>
                    Eventos recientes visibles: <strong>{eventsLast7}</strong>
                  </span>
                </div>

                <div style={styles.configStatusItem}>
                  <span style={styles.configStatusBullet}>•</span>
                  <span>
                    Conflictos pendientes: <strong>{conflictsNow}</strong>
                  </span>
                </div>
              </div>
            </section>
          </div>

          <div style={styles.rightCol}>
            <section style={cardStyle}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Cuenta</div>
                  <h2 style={sectionTitleStyle}>Estado de tu cuenta</h2>
                  <div style={styles.sectionSub}>
                    Aquí se consolida tu estado de cuenta, tu plan y tu preparación para coordinar mejor. La operación diaria sigue viviendo en Summary, Events y Panel.
                  </div>
                </div>
              </div>

              <div style={smallGridStyle}>
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
                      style={{ ...styles.planPrimaryBtn, ...fullWidthButtonStyle }}
                      onClick={() => {
                        if (profile?.id) {
                          void trackEvent({
                            event: "premium_cta_clicked",
                            userId: String(profile.id),
                            metadata: {
                              screen: "profile",
                              area: "plan_status",
                              context: premiumActive ? "manage_plan" : premiumContextKey,
                              plan_label: planLabel,
                            },
                          });
                        }
                        router.push("/planes");
                      }}
                    >
                      {premiumContextCta}
                    </button>
                  </div>
                </div>
              </div>

              {!premiumActive ? (
                <>
                  <div style={{ height: 12 }} />

                  <div style={styles.premiumContextCard}>
                    <div style={styles.premiumContextEyebrow}>Premium según tu uso</div>
                    <div style={styles.premiumContextTitle}>{premiumContextTitle}</div>
                    <div style={styles.premiumContextText}>{premiumContextText}</div>

                    <div style={styles.premiumContextRow}>
                      <span style={styles.premiumContextBadge}>{premiumContextBadge}</span>

                      <button
                        type="button"
                        style={{ ...styles.planPrimaryBtn, ...fullWidthButtonStyle }}
                        onClick={() => {
                          if (profile?.id) {
                            void trackEvent({
                              event: "premium_cta_clicked",
                              userId: String(profile.id),
                              metadata: {
                                screen: "profile",
                                area: "premium_context",
                                context: premiumContextKey,
                                total_groups: totalGroups,
                                events_last_7: eventsLast7,
                                conflicts_now: conflictsNow,
                                plan_label: planLabel,
                              },
                            });
                          }
                          router.push("/planes");
                        }}
                      >
                        Ver planes
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

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
                    {totalGroups > 0 ? "✓" : "•"}
                  </span>
                  <span>
                    Estructura compartida {totalGroups > 0 ? "activa" : "todavía no creada"}
                  </span>
                </div>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Recomendación</div>
                  <h2 style={sectionTitleStyle}>Siguiente mejora sugerida</h2>
                  <div style={styles.sectionSub}>
                    Una sola siguiente acción útil para mejorar tu cuenta sin competir con el loop principal del producto.
                  </div>
                </div>
              </div>

              <div style={styles.recoCard}>
                <div style={styles.recoTitle}>Próximo mejor paso</div>
                <div style={styles.recoMain}>{recommendationTitle}</div>
                <div style={styles.recoHint}>{recommendationHint}</div>

                <button
                  type="button"
                  style={{ ...styles.recoBtn, ...fullWidthButtonStyle }}
                  onClick={() => router.push(recommendationHref)}
                >
                  {recommendationCtaLabel}
                </button>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Resumen diario</div>
                  <h2 style={sectionTitleStyle}>Entrega automática por correo</h2>
                  <div style={styles.sectionSub}>
                    Controla si quieres recibir una lectura diaria simple de tu coordinación y a qué hora local prefieres verla en tu correo.
                  </div>
                </div>
              </div>

              <div style={digestRowStyle}>
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

            <section style={cardStyle}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Sesión</div>
                  <h2 style={sectionTitleStyle}>Control de acceso</h2>
                  <div style={styles.sectionSub}>
                    Desde aquí puedes cerrar tu sesión actual. La coordinación diaria sigue viviendo en Resumen, Calendario, Conflictos y Panel.
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
          Tu cuenta define cómo apareces, qué plan tienes y qué señales usa SyncPlans para representarte mejor. La coordinación diaria vive en <strong>Resumen</strong>, <strong>Calendario</strong>, <strong>Conflictos</strong> y <strong>Panel</strong>. Esta pantalla ya no compite con ese flujo: lo ordena y le da contexto.
        </section>
      </MobileScaffold>
    </main>
  );
}