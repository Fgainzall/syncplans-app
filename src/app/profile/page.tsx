// src/app/profile/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  type Recommendation,
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

  ghostBtn: {
    padding: "11px 13px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.9)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
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

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "rgba(226,232,240,0.95)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
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

  hubGrid: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  hubCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "radial-gradient(700px 420px at 0% 0%, rgba(56,189,248,0.16), transparent 55%), rgba(15,23,42,0.92)",
    padding: 12,
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gridTemplateRows: "auto auto",
    gap: "4px 8px",
  },

  hubTitle: {
    fontSize: 13,
    fontWeight: 950,
  },

  hubHint: {
    fontSize: 11,
    opacity: 0.82,
    lineHeight: 1.5,
  },

  hubChevron: {
    fontSize: 18,
    opacity: 0.85,
    alignSelf: "center",
  },

  quickActionsGrid: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  quickAction: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "radial-gradient(600px 400px at 0% 0%, rgba(56,189,248,0.16), transparent 55%), rgba(15,23,42,0.9)",
    padding: 10,
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gridTemplateRows: "auto auto",
    gap: "4px 6px",
  },

  quickActionTitle: {
    gridColumn: "1 / span 1",
    fontSize: 13,
    fontWeight: 900,
  },

  quickActionHint: {
    gridColumn: "1 / span 1",
    fontSize: 11,
    opacity: 0.8,
    lineHeight: 1.45,
  },

  quickActionChevron: {
    gridColumn: "2 / span 1",
    gridRow: "1 / span 2",
    alignSelf: "center",
    fontSize: 18,
    opacity: 0.85,
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

  groupMetaSelect: {
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

  const heroSummary = useMemo(() => {
    if (statsLoading || !stats) {
      return "Estamos cargando tu cuenta para darte una lectura más clara de tu estado dentro de SyncPlans.";
    }

    if (stats.conflictsNow > 0) {
      return `Tienes ${stats.conflictsNow} conflicto${
        stats.conflictsNow === 1 ? "" : "s"
      } visible${stats.conflictsNow === 1 ? "" : "s"} y ${stats.totalGroups} grupo${
        stats.totalGroups === 1 ? "" : "s"
      } activo${stats.totalGroups === 1 ? "" : "s"}.`;
    }

    if (stats.totalGroups > 0) {
      return `Tu cuenta ya está conectada a ${stats.totalGroups} grupo${
        stats.totalGroups === 1 ? "" : "s"
      } y SyncPlans está listo para coordinar con menos fricción.`;
    }

    return "Tu cuenta está lista para empezar. El siguiente salto real llega cuando sumas grupos y compartes tiempo con alguien más.";
  }, [stats, statsLoading]);

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
                    {verified ? "Verificada" : "Por verificar"}
                  </span>
                </div>

                <div style={styles.email}>{email}</div>
              </div>
            </div>

            <div style={styles.heroActionStack}>
              <button
                type="button"
                onClick={() => router.push("/planes")}
                style={styles.heroPrimaryBtn}
              >
                {planCtaLabel}
              </button>
              <button
                type="button"
                onClick={() => router.push("/summary")}
                style={styles.heroSecondaryBtn}
              >
                Ver resumen
              </button>
            </div>
          </div>

          <div style={styles.heroStrip}>
            <div style={styles.heroStripLabel}>Estado actual</div>
            <div style={styles.heroStripText}>{heroSummary}</div>
          </div>

          <div style={styles.heroStats} className="spProfileHeroStats">
            <InfoStat
              label="Plan actual"
              value={planLabel}
              hint={planHint}
            />
            <InfoStat
              label="Grupos activos"
              value={
                statsLoading
                  ? "—"
                  : stats
                  ? `${stats.totalGroups}`
                  : "—"
              }
              hint={
                stats && stats.totalGroups > 0
                  ? `Pareja ${stats.pairGroups} · Familia ${stats.familyGroups} · Compartidos ${stats.otherGroups}`
                  : "Todavía no has creado grupos."
              }
            />
            <InfoStat
              label="Eventos"
              value={statsLoading ? "—" : stats ? `${stats.totalEvents}` : "—"}
              hint={
                stats && stats.eventsLast7 > 0
                  ? `${stats.eventsLast7} en los últimos 7 días`
                  : "Sin actividad reciente"
              }
            />
            <InfoStat
              label="Conflictos"
              value={statsLoading ? "—" : stats ? `${stats.conflictsNow}` : "—"}
              hint={
                stats && stats.conflictsNow > 0
                  ? "Hay choques listos para revisar"
                  : "Sin conflictos visibles ahora"
              }
            />
          </div>
        </section>

        <div style={styles.mainGrid} className="spProfileMainGrid">
          <div style={styles.leftCol}>
            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Identidad visible</div>
                  <h2 style={styles.sectionTitle}>Cómo te ve SyncPlans</h2>
                  <div style={styles.sectionSub}>
                    Este nombre se usa en miembros, invitaciones y notificaciones compartidas.
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} style={styles.form}>
                <div style={styles.formRow} className="spProfileTwoCols">
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
                  <button
                    type="button"
                    onClick={() => router.push("/calendar")}
                    style={styles.ghostBtn}
                  >
                    Ir al calendario
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

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Tu rol en los grupos</div>
                  <h2 style={styles.sectionTitle}>Cómo te ve cada grupo</h2>
                  <div style={styles.sectionSub}>
                    No eres la misma persona en todos tus calendarios. Aquí defines cómo te representa cada espacio compartido.
                  </div>
                </div>
              </div>

              {membershipsLoading && (
                <div style={styles.smallInfo}>Cargando tus grupos y roles…</div>
              )}

              {membershipsError && <div style={styles.error}>{membershipsError}</div>}

              {!membershipsLoading && (!memberships || memberships.length === 0) && (
                <div style={styles.smallInfo}>
                  Aún no perteneces a ningún grupo. Empieza creando uno desde la sección de grupos.
                </div>
              )}

              {memberships && memberships.length > 0 && (
                <>
                  <div style={styles.groupSummaryRow}>
                    Tienes <strong>{totalGroupsForRoles}</strong> grupo
                    {totalGroupsForRoles === 1 ? "" : "s"} ·{" "}
                    <strong>{configuredGroupsCount}</strong> con rol configurado ·{" "}
                    <strong>{pendingGroupsCount}</strong> pendiente
                    {pendingGroupsCount === 1 ? "" : "s"}
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
                          <div style={styles.groupListEmpty}>
                            No hay grupos que coincidan con el filtro.
                          </div>
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
                                {groupsById.get(selectedMembership.group_id)?.name ??
                                  "(Grupo sin nombre)"}
                              </div>
                              <div style={styles.groupMetaSubtitle}>
                                Define tu nombre visible, tu rol y un contexto rápido para coordinar contigo.
                              </div>
                            </div>

                            <span style={styles.badgeTiny}>
                              {getGroupTypeLabel(
                                String(
                                  groupsById.get(selectedMembership.group_id)?.type ?? "grupo"
                                )
                              )}
                            </span>
                          </div>

                          <div style={{ marginTop: 6 }}>
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
                            <div style={styles.groupMetaLabel}>
                              Algo que deberían saber al coordinar contigo
                            </div>
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
                              disabled={
                                savingGroupId === selectedMembership.group_id || !hasSelectedDirty
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
                                router.push(`/calendar?group=${selectedMembership.group_id}`)
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

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Preferencias personales</div>
                  <h2 style={styles.sectionTitle}>Cómo sueles organizar tu tiempo</h2>
                  <div style={styles.sectionSub}>
                    Estas preferencias ayudan a SyncPlans a anticipar fricciones y mostrar decisiones más claras cuando se cruzan horarios.
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveCoordPrefs} style={styles.coordForm}>
                <div style={styles.coordGrid} className="spProfileTwoCols">
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

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Resumen diario</div>
                  <h2 style={styles.sectionTitle}>Correo de arranque del día</h2>
                  <div style={styles.sectionSub}>
                    Si lo activas, te enviaremos cada mañana un correo con los eventos del día ordenados por hora.
                  </div>
                </div>
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

              {savingDigest && (
                <div style={styles.digestSavingHint}>Guardando configuración…</div>
              )}
              {digestError && <div style={styles.error}>{digestError}</div>}
              {digestOk && <div style={styles.ok}>{digestOk}</div>}
            </section>
          </div>

          <div style={styles.rightCol}>
            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Estado de cuenta</div>
                  <h2 style={styles.sectionTitle}>Lectura rápida</h2>
                  <div style={styles.sectionSub}>
                    Revisa en segundos cómo va tu configuración dentro de SyncPlans.
                  </div>
                </div>
              </div>

              <div style={styles.statusCard}>
                <div style={styles.accountStatusRow}>
                  <div style={styles.statusIcon}>{verified ? "✅" : "⚠️"}</div>
                  <div>
                    <div style={styles.statusTitle}>{accountStatusLabel}</div>
                    <div style={styles.statusHint}>{accountStatusHint}</div>
                  </div>
                </div>

                <div style={styles.configStatusBox}>
                  <div style={styles.configStatusTitle}>Cómo vas con tu configuración</div>
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
                      {hasGroupMetaGlobal ? "✅" : "⏳"}
                    </span>
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
                          else if (t === "events_new")
                            router.push("/events/new/details?type=personal");
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
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Centro de control</div>
                  <h2 style={styles.sectionTitle}>Accesos rápidos</h2>
                  <div style={styles.sectionSub}>
                    Atajos a lo importante, sin convertir esta pantalla en un archivo interminable.
                  </div>
                </div>
              </div>

              <div style={styles.hubGrid} className="spProfileHubGrid">
                <HubCard
                  title="Grupos"
                  hint="Pareja, familia y compartidos."
                  onClick={() => router.push("/groups")}
                />
                <HubCard
                  title="Miembros"
                  hint="Quién está en tus grupos."
                  onClick={() => router.push("/members")}
                />
                <HubCard
                  title="Invitaciones"
                  hint="Invita y acepta accesos."
                  onClick={() => router.push("/invitations")}
                />
                <HubCard
                  title="Settings"
                  hint="Preferencias del producto."
                  onClick={() => router.push("/settings")}
                />
                <HubCard
                  title="Planes"
                  hint="Ver tu plan y upgrade."
                  onClick={() => router.push("/planes")}
                />
                <HubCard
                  title="Salir"
                  hint="Cerrar sesión."
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.replace("/auth/login");
                  }}
                />
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionLabel}>Uso frecuente</div>
                  <h2 style={styles.sectionTitle}>Lo que más haces</h2>
                  <div style={styles.sectionSub}>
                    Atajos directos a los flujos que más sentido tienen desde tu cuenta.
                  </div>
                </div>
              </div>

              <div style={styles.quickActionsGrid} className="spProfileQuickGrid">
                <QuickAction
                  title="Ir al calendario"
                  hint="Ver tu semana y crear nuevas actividades."
                  onClick={() => router.push("/calendar")}
                />
                <QuickAction
                  title="Revisar conflictos"
                  hint="Detectar conflictos y decidir qué hacer con ellos."
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

        <div style={styles.footer}>
          SyncPlans está pensado para que tu calendario personal, de pareja, familia y grupos compartidos convivan con más claridad y menos fricción. Esta pantalla resume tu cuenta sin recargarla.
        </div>

        <style>{`
          @media (max-width: 900px) {
            .spProfileMainGrid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 780px) {
            .spProfileMasterDetail {
              grid-template-columns: 1fr !important;
              min-height: auto !important;
            }

            .spProfileQuickGrid,
            .spProfileHubGrid,
            .spProfileHeroStats,
            .spProfileTwoCols {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </MobileScaffold>
    </main>
  );
}

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