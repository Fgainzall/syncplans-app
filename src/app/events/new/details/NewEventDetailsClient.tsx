"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import EventDetailsHero from "@/components/EventDetailsHero";
import EventDetailsTemplatesSection from "@/components/EventDetailsTemplatesSection";
import PostSaveActionsCard from "@/components/PostSaveActionsCard";
import type { EventTemplate } from "@/lib/eventTemplates";
import { normalizeGroupType as normalizeCanonicalGroupType } from "@/lib/naming";
import ConflictPreflightModal from "@/components/ConflictPreflightModal";
import {
  createConflictNotificationForEvent,
  createConflictDecisionNotification,
  createConflictAutoAdjustedNotification,
} from "@/lib/notificationsDb";
import { trackEvent } from "@/lib/analytics";
import {
  GroupType,
  groupMeta,
  computeVisibleConflicts,
  fmtRange,
  type CalendarEvent,
  ignoreConflictIds,
  hideEventIdsForCurrentUser,
} from "@/lib/conflicts";
import supabase from "@/lib/supabaseClient";
import { getSettingsFromDb, type NotificationSettings } from "@/lib/settings";
import { getLearningSignals } from "@/lib/learningSignals";
import type { LearningSignal } from "@/lib/learningTypes";
// ✅ DB real (RLS)
import {
  getMyGroups,
  getGroupTypeLabel,
  getSharedGroupBetweenUsers,
} from "@/lib/groupsDb";
import { suggestCanonicalGroupWithLearning } from "@/lib/groupSuggestion";
// ✅ DB Source of Truth
import {
  createEventForGroup,
  deleteEventsByIdsDetailed,
  getEventById,
  updateEvent,
} from "@/lib/eventsDb";
import { getOrCreatePublicInvite } from "@/lib/invitationsDb";
// ✅ active group desde DB
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import { loadEventsForConflictPreflight } from "@/lib/conflictsDbBridge";
import { createConflictResolutionLog } from "@/lib/conflictResolutionsLogDb";
import { upsertProposalResponse } from "@/lib/proposalResponsesDb";
import {
  canLearnFromInput,
  getLearnedGroupMatch,
  learnGroupSelection,
} from "@/lib/groupLearning";
import { buildGoogleMapsDirectionsLink, buildWazeLink } from "@/lib/maps";
import {
  getGrantedBrowserOrigin,
  readSmartOriginFromStorage,
  resolveSafeRouteOriginForEta,
  toLatLng,
  writeSmartOriginToStorage,
  type LatLng,
  type SmartOriginSource,
} from "@/lib/smartMobilityOrigin";
import { formatSmartTime } from "@/lib/timeFormat";

/* -------------------------------------------------------------------------- */
/* Helpers locales puros                                                       */
/* -------------------------------------------------------------------------- */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toInputLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
    d.getDate(),
  )}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromInputLocal(s: string) {
  return new Date(s);
}

function addMinutes(d: Date, mins: number) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() + mins);
  return x;
}

function roundToNextQuarterHour(d: Date) {
  const x = new Date(d);
  x.setSeconds(0, 0);

  const m = x.getMinutes();
  const rounded = Math.ceil(m / 15) * 15;

  x.setMinutes(rounded % 60);
  if (rounded >= 60) x.setHours(x.getHours() + 1);

  return x;
}

function getSafeDurationMinutes(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 60;
  return Math.max(15, Math.round(diff / 60000));
}

/* -------------------------------------------------------------------------- */
/* Types locales                                                               */
/* -------------------------------------------------------------------------- */

type DbGroup = {
  id: string;
  name: string | null;
  type: "family" | "pair" | "other" | string;
};

function normalizeDbGroupType(value: unknown): GroupType {
  return normalizeCanonicalGroupType(String(value ?? ""));
}

type NewType = "personal" | "group";

type PreflightChoice =
  | "edit"
  | "keep_existing"
  | "replace_with_new"
  | "keep_both";

type PreflightConflict = {
  id: string;
  existingId: string;
  title: string;
  groupLabel: string;
  range: string;
  overlapStart: string;
  overlapEnd: string;
};

type PostSaveFormFingerprint = string;

type UiTravelMode = "driving" | "walking" | "bicycling" | "transit";

type MapsPlaceSuggestion = {
  label: string;
  address: string;
  lat: number;
  lng: number;
  place_id: string;
  provider: "google";
  type: string;
};

type OriginSource = Extract<SmartOriginSource, "gps" | "stored" | "url" | "missing">;
async function persistLastKnownLocation(point: LatLng) {
  if (typeof window === "undefined") return;
  if (!toLatLng(point.lat, point.lng)) return;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) return;

    await fetch("/api/user/location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lat: point.lat,
        lng: point.lng,
      }),
    });
  } catch {
    // No rompemos el formulario si falla la persistencia de ubicación.
  }
}
type SelectedPlace = {
  location_label: string;
  location_address: string;
  location_lat: number;
  location_lng: number;
  location_provider: "google";
  location_place_id: string;
};

type SavePayload = {
  groupType: GroupType;
  groupId: string | null;
  title: string;
  notes?: string;
  startIso: string;
  endIso: string;
  location_label: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_provider: "google" | null;
  location_place_id: string | null;
  travel_mode: UiTravelMode | null;
  travel_eta_seconds: number | null;
  leave_time: string | null;
};

const MAX_REASONABLE_ETA_SECONDS = 6 * 60 * 60;

function isReasonableEtaSeconds(value: unknown): value is number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= MAX_REASONABLE_ETA_SECONDS;
}

function formatEtaLabel(etaSeconds: number | null) {
  if (!isReasonableEtaSeconds(etaSeconds)) return null;

  const minutes = Math.max(1, Math.round(etaSeconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function getTravelStatusLabel(input: {
  isLoadingEta: boolean;
  etaLabel: string | null;
  etaError: string | null;
}) {
  if (input.isLoadingEta) return "Calculando ruta…";
  if (input.etaLabel) return "Ruta lista";
  if (input.etaError) return "Usamos una estimación aproximada";
  return "Esperando ubicación";
}

function getLeaveTimeLabel(leaveTimePreview: Date | null) {
  if (!leaveTimePreview) return "Aparecerá cuando la ruta esté lista";

  return formatSmartTime(leaveTimePreview, "Aparecerá cuando la ruta esté lista");
}

function getSafeRouteDepartureTime(startIso: string | null): string | null {
  if (!startIso) return null;

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;

  const minFuture = Date.now() + 5 * 60 * 1000;

  if (start.getTime() <= minFuture) {
    return new Date(minFuture).toISOString();
  }

  return start.toISOString();
}

function safeIsoFromLocalDateInput(localValue: string): string | null {
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function getConflictCounterpart(
  conflict: ReturnType<typeof computeVisibleConflicts>[number],
  candidateId: string,
) {
  const existingId = String(conflict.existingEventId ?? "");
  const incomingId = String(conflict.incomingEventId ?? "");

  if (existingId === candidateId) {
    return {
      otherId: incomingId,
      otherEvent: conflict.incomingEvent ?? conflict.incoming ?? null,
    };
  }

  if (incomingId === candidateId) {
    return {
      otherId: existingId,
      otherEvent: conflict.existingEvent ?? conflict.existing ?? null,
    };
  }

  return null;
}

function mapDefaultResolutionToChoice(
  s: NotificationSettings | null,
): PreflightChoice {
  const def = (s as any)?.conflictDefaultResolution ?? "ask_me";
  if (def === "keep_existing") return "keep_existing";
  if (def === "replace_with_new") return "replace_with_new";
  if (def === "none") return "keep_both";
  return "edit";
}

function emitSyncPlansRefreshSignals() {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(new CustomEvent("sp:events-changed"));
  } catch {
    // no-op
  }

  try {
    window.dispatchEvent(new Event("focus"));
  } catch {
    // no-op
  }

  try {
    document.dispatchEvent(new Event("visibilitychange"));
  } catch {
    // no-op
  }
}

function buildPostSaveFingerprint(input: {
  effectiveType: NewType;
  selectedGroupId: string;
  title: string;
  notes: string;
  startLocal: string;
  endLocal: string;
}): PostSaveFormFingerprint {
  return JSON.stringify({
    effectiveType: input.effectiveType,
    selectedGroupId: input.selectedGroupId || "",
    title: input.title.trim(),
    notes: input.notes.trim(),
    startLocal: input.startLocal,
    endLocal: input.endLocal,
  });
}

function decisionTypeFromPreflightChoice(
  choice: Exclude<PreflightChoice, "edit">,
): string {
  if (choice === "keep_existing") return "keep_existing";
  if (choice === "replace_with_new") return "replace_with_new";
  return "keep_both";
}

function finalActionFromPreflightChoice(
  choice: Exclude<PreflightChoice, "edit">,
): string {
  if (choice === "keep_existing") return "keep_existing";
  if (choice === "replace_with_new") return "replace_with_new";
  return "keep_both";
}

function humanizeActionError(err: unknown, fallback = "Intenta nuevamente.") {
  const message =
    err instanceof Error ? err.message.trim() : String(err ?? "").trim();

  if (!message) return fallback;

  const lowered = message.toLowerCase();

  if (lowered.includes("abort")) {
    return "La operación tardó demasiado o se interrumpió. Vuelve a intentarlo.";
  }

  if (
    lowered.includes("fetch") ||
    lowered.includes("network") ||
    lowered.includes("networkerror") ||
    lowered.includes("failed to fetch")
  ) {
    return "Parece un problema de red. Revisa tu conexión e inténtalo otra vez.";
  }

  return message;
}

function safeTitle(value?: string | null) {
  const v = String(value ?? "").trim();
  return v || "Evento sin título";
}

function normalizeFreeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function resolveEventOwnerId(event: any): string | null {
  const candidate =
    event?.owner_id ??
    event?.ownerId ??
    event?.created_by ??
    event?.createdBy ??
    event?.user_id ??
    event?.userId ??
    null;

  const normalized = String(candidate ?? "").trim();
  return normalized || null;
}

async function syncAcceptedResponsesForSavedEvent(input: {
  eventId: string;
  currentUserId: string | null;
  groupId: string | null;
}) {
  const eventId = String(input.eventId ?? "").trim();
  if (!eventId) return;

  const fallbackUserId = String(input.currentUserId ?? "").trim();
  const groupId = String(input.groupId ?? "").trim() || null;

  let userIds: string[] = [];

  if (groupId) {
    const { data: members, error } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (error) {
      console.error(
        "group_members fetch failed while syncing responses",
        error,
      );
    }

    userIds = Array.from(
      new Set(
        (members ?? [])
          .map((row: any) => String(row?.user_id ?? "").trim())
          .filter(Boolean),
      ),
    );
  }

  if (!userIds.length && fallbackUserId) {
    userIds = [fallbackUserId];
  }

  if (!userIds.length) return;

  const rows = userIds.map((userId) => ({
    event_id: eventId,
    user_id: userId,
    group_id: groupId,
    response_status: "accepted",
    comment: null,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("event_responses")
    .upsert(rows, { onConflict: "event_id,user_id" });

  if (upsertError) {
    console.error("event_responses upsert failed", upsertError);
  }
}
export default function NewEventDetailsClient() {
  return (
    <Suspense fallback={<main style={styles.page} />}>
      <NewEventDetailsInner />
    </Suspense>
  );
}

function NewEventDetailsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const proposedStartParam = sp.get("proposedStart");
  const proposedEndParam = sp.get("proposedEnd");
  const quickCaptureParam = sp.get("qc");
  const quickCaptureTitleParam = sp.get("title");
  const quickCaptureDurationParam = sp.get("duration");
  const quickCaptureNotesParam = sp.get("notes");
  const captureSourceParam = sp.get("capture_source");
  const rawTextParam = sp.get("raw_text");
  const intentParam = sp.get("intent");
  const proposalParam = sp.get("proposal");
  const proposalResponseParam = sp.get("proposal_response");
  const originLatParam = sp.get("originLat");
  const originLngParam = sp.get("originLng");
  const locationQueryParam = sp.get("location_query");
  const proposalEventIdParam =
    sp.get("proposal_event_id") || sp.get("proposalEventId") || "";

  const eventIdParam = sp.get("eventId") || sp.get("edit") || sp.get("id");
  const isEditing = !!eventIdParam;

  const typeParam = (sp.get("type") || "personal") as NewType;
  const dateParam = sp.get("date");
  const timeParam = sp.get("time");
  const groupIdParam = sp.get("groupId");
  const wowParam = sp.get("wow");
  const fromParam = sp.get("from");
  const isFirstWowMomentFlow =
    wowParam === "1" || fromParam === "first-group" || fromParam === "summary";
  const hasExplicitGroupParam = !!String(groupIdParam ?? "").trim();

  const initialStart = useMemo(() => {
    const base = dateParam ? new Date(dateParam) : new Date();
    const d = new Date(base);
    d.setSeconds(0, 0);

    const timeMatch = String(timeParam ?? "").match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        d.setHours(hours, minutes, 0, 0);
        return d;
      }
    }

    const m = d.getMinutes();
    const rounded = Math.ceil(m / 15) * 15;
    d.setMinutes(rounded % 60);
    if (rounded >= 60) d.setHours(d.getHours() + 1);
    return d;
  }, [dateParam, timeParam]);

  const [selectedTemplate, setSelectedTemplate] =
    useState<EventTemplate | null>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState<
    MapsPlaceSuggestion[]
  >([]);
  const [isLoadingAutocomplete, setIsLoadingAutocomplete] = useState(false);
  const [autocompleteError, setAutocompleteError] = useState<string | null>(
    null,
  );
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(
    null,
  );
  const [travelMode, setTravelMode] = useState<UiTravelMode>("driving");
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [isLoadingEta, setIsLoadingEta] = useState(false);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [startLocal, setStartLocal] = useState(() =>
    toInputLocal(initialStart),
  );
  const [endLocal, setEndLocal] = useState(() =>
    toInputLocal(addMinutes(initialStart, 60)),
  );
  const autocompleteRequestRef = useRef(0);
  const etaRequestRef = useRef(0);
  const locationSessionTokenRef = useRef(
    `sp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const originPointRef = useRef<LatLng | null>(null);
  const [originPointVersion, setOriginPointVersion] = useState(0);
  const [originSource, setOriginSource] = useState<OriginSource>("missing");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<null | {
    title: string;
    subtitle?: string;
  }>(null);
  const [postSaveActions, setPostSaveActions] = useState<null | {
    visible: boolean;
    eventId?: string;
    title?: string;
    isShared?: boolean;
    isProposal?: boolean;
  }>(null);
  const [sharingPostSave, setSharingPostSave] = useState(false);
  const saveInFlightRef = useRef(false);
  const preflightChoiceInFlightRef = useRef(false);
  const [postSaveShareUrl, setPostSaveShareUrl] = useState<string | null>(null);
  const [postSaveFingerprint, setPostSaveFingerprint] =
    useState<PostSaveFormFingerprint | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [externalProposalActive, setExternalProposalActive] = useState(false);
  const quickCaptureHydratedRef = useRef(false);
  const isSharedProposal =
    !isEditing && (intentParam === "shared" || proposalParam === "1");
  const proposalResponse =
    proposalResponseParam === "adjust"
      ? "adjust"
      : proposalResponseParam === "accept"
        ? "accept"
        : null;

  const [booting, setBooting] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groups, setGroups] = useState<DbGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    hasExplicitGroupParam ? String(groupIdParam) : "",
  );
  const [autoSharedGroupId, setAutoSharedGroupId] = useState<string>("");
  const [autoSharedGroupLabel, setAutoSharedGroupLabel] = useState<string>("");
  const [sharedGroupDetectionState, setSharedGroupDetectionState] = useState<
    "idle" | "matched" | "none" | "ambiguous"
  >("idle");
  const [suggestedPreselectedGroupId, setSuggestedPreselectedGroupId] =
    useState<string>("");
  const groupManualSelectionRef = useRef(false);

  const [bootingEvent, setBootingEvent] = useState<boolean>(isEditing);
  const loadedEditingEventIdRef = useRef<string | null>(null);

  const uniqueGroups = useMemo(() => {
    const map = new Map<string, DbGroup>();
    for (const g of groups || []) map.set(g.id, g);
    return Array.from(map.values());
  }, [groups]);
  const [learningSignals, setLearningSignals] = useState<LearningSignal[]>([]);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightItems, setPreflightItems] = useState<PreflightConflict[]>([]);
  const [preflightDefaultChoice, setPreflightDefaultChoice] =
    useState<PreflightChoice>("edit");
  const [pendingPayload, setPendingPayload] = useState<null | SavePayload>(
    null,
  );
  const [existingIdsToReplace, setExistingIdsToReplace] = useState<string[]>(
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSettingsFromDb();
        if (!alive) return;
        setSettings(s);
      } catch {
        // ok
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyOrigin = (
      point: LatLng,
      persist = false,
      source: OriginSource = "stored",
    ) => {
      if (cancelled || !toLatLng(point.lat, point.lng)) return;

      originPointRef.current = point;
      setOriginPointVersion((current) => current + 1);
      setOriginSource(source);

      if (persist) {
        writeSmartOriginToStorage({ point, source });
        void persistLastKnownLocation(point);
      }
    };

    const paramOrigin = toLatLng(originLatParam, originLngParam);

    if (paramOrigin) {
      applyOrigin(paramOrigin, true, "url");
      return () => {
        cancelled = true;
      };
    }

    const storedOrigin = readSmartOriginFromStorage();
    if (storedOrigin?.point && storedOrigin.usableForEta) {
      applyOrigin(storedOrigin.point, false, "stored");
    } else {
      originPointRef.current = null;
      setOriginSource("missing");
      setOriginPointVersion((current) => current + 1);
    }

    void (async () => {
      const gpsOrigin = await getGrantedBrowserOrigin({
        enableHighAccuracy: true,
        timeoutMs: 6000,
        maximumAgeMs: 3 * 60 * 1000,
      });

      if (!gpsOrigin?.point || cancelled) return;

      applyOrigin(gpsOrigin.point, true, "gps");
    })();

    return () => {
      cancelled = true;
    };
  }, [originLatParam, originLngParam]);
  useEffect(() => {
    if (isEditing) return;

    const incoming = String(locationQueryParam ?? "").trim();
    if (!incoming) return;

    setLocationInput((current) => (current.trim() ? current : incoming));
  }, [locationQueryParam, isEditing]);
  const startDate = useMemo(() => fromInputLocal(startLocal), [startLocal]);
  const endDate = useMemo(() => fromInputLocal(endLocal), [endLocal]);
  const leaveTimePreview = useMemo(() => {
    if (!etaSeconds || !Number.isFinite(startDate.getTime())) return null;
    const LEAVE_BUFFER_SECONDS = 5 * 60;
    const leaveAt = new Date(
      startDate.getTime() - etaSeconds * 1000 - LEAVE_BUFFER_SECONDS * 1000,
    );
    if (Number.isNaN(leaveAt.getTime())) return null;
    return leaveAt;
  }, [etaSeconds, startDate]);
  const etaLabel = useMemo(() => formatEtaLabel(etaSeconds), [etaSeconds]);

  const travelStatusLabel = useMemo(
    () =>
      getTravelStatusLabel({
        isLoadingEta,
        etaLabel,
        etaError,
      }),
    [isLoadingEta, etaLabel, etaError],
  );

  const leaveTimeLabel = useMemo(
    () => getLeaveTimeLabel(leaveTimePreview),
    [leaveTimePreview],
  );

  const originSourceLabel = useMemo(() => {
    if (originSource === "gps") return "Desde tu ubicación actual";
    if (originSource === "stored") return "Desde tu última ubicación guardada";
    if (originSource === "url") return "Desde el punto enviado";
    return "Activa ubicación para calcular la salida";
  }, [originSource]);

  const mapsLinks = useMemo(() => {
    if (!selectedPlace || !originPointRef.current) return null;

    const destination = {
      lat: Number(selectedPlace.location_lat),
      lng: Number(selectedPlace.location_lng),
    };

    try {
      return {
        google: buildGoogleMapsDirectionsLink(
          originPointRef.current,
          destination,
          travelMode,
        ),
        waze: buildWazeLink(destination.lat, destination.lng),
      };
    } catch {
      return null;
    }
  }, [selectedPlace, travelMode, originPointVersion]);

  const selectedGroup = useMemo(
    () => uniqueGroups.find((g) => g.id === selectedGroupId) || null,
    [uniqueGroups, selectedGroupId],
  );

  function buildUrl(
    nextType: NewType,
    nextDateIso: string,
    nextGroupId?: string | null,
  ) {
    const params = new URLSearchParams();
    params.set("type", nextType);
    params.set("date", nextDateIso);

    if (nextType === "group") {
      const gid = nextGroupId || selectedGroupId || activeGroupId || "";
      if (gid) params.set("groupId", gid);
    }

    if (isEditing && eventIdParam) {
      params.set("eventId", String(eventIdParam));
    }

    const lockParam = sp.get("lock");
    if (lockParam) params.set("lock", lockParam);

    const fromParam = sp.get("from");
    if (fromParam) params.set("from", fromParam);

    const wowParam = sp.get("wow");
    if (wowParam) params.set("wow", wowParam);

    if (quickCaptureParam === "1") params.set("qc", "1");
    if (quickCaptureTitleParam) params.set("title", quickCaptureTitleParam);
    if (quickCaptureDurationParam)
      params.set("duration", quickCaptureDurationParam);
    if (quickCaptureNotesParam) params.set("notes", quickCaptureNotesParam);
    if (timeParam) params.set("time", timeParam);
    if (captureSourceParam) params.set("capture_source", captureSourceParam);
    if (rawTextParam) params.set("raw_text", rawTextParam);
    if (originLatParam) params.set("originLat", originLatParam);
    if (originLngParam) params.set("originLng", originLngParam);

    if (intentParam) params.set("intent", intentParam);
    if (proposalParam) params.set("proposal", proposalParam);
    if (proposalResponseParam) {
      params.set("proposal_response", proposalResponseParam);
    }
    if (proposalEventIdParam) {
      params.set("proposal_event_id", proposalEventIdParam);
    }

    return `/events/new/details?${params.toString()}`;
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setBooting(true);
      setLoadingGroups(true);
      try {
        const [{ data: authData }, gid, g] = await Promise.all([
          supabase.auth.getUser(),
          getActiveGroupIdFromDb().catch(() => null),
          getMyGroups().catch(() => [] as any),
        ]);
        if (!alive) return;

        const uid = authData?.user?.id ?? null;
        setCurrentUserId(uid);

        if (!uid) {
          router.replace("/auth/login");
          return;
        }

        const list: DbGroup[] = Array.isArray(g) ? (g as DbGroup[]) : [];
        const map = new Map<string, DbGroup>();
        for (const it of list || []) map.set(it.id, it);
        const unique = Array.from(map.values());

        setActiveGroupId(gid);
        setGroups(unique);

        let preferredGroupId = hasExplicitGroupParam
          ? String(groupIdParam)
          : "";
        let detectedSharedGroupLabel = "";

        if (!preferredGroupId && isSharedProposal && proposalEventIdParam) {
          try {
            const proposalEvent = await getEventById(proposalEventIdParam);
            const proposalOwnerId = resolveEventOwnerId(proposalEvent);

            if (proposalOwnerId && proposalOwnerId !== uid) {
              const sharedGroupResult = await getSharedGroupBetweenUsers(
                proposalOwnerId,
                uid,
              );

              if (
                sharedGroupResult.status === "matched" &&
                sharedGroupResult.group?.id
              ) {
                preferredGroupId = sharedGroupResult.group.id;
                detectedSharedGroupLabel =
                  sharedGroupResult.group.name ||
                  getGroupTypeLabel(sharedGroupResult.group.type);
                setSharedGroupDetectionState("matched");
              } else if (sharedGroupResult.status === "ambiguous") {
                setSharedGroupDetectionState("ambiguous");
              } else {
                setSharedGroupDetectionState("none");
              }
            } else {
              setSharedGroupDetectionState("none");
            }
          } catch (sharedGroupError) {
            console.warn(
              "[NewEventDetails] shared group auto-detect failed",
              sharedGroupError,
            );
            setSharedGroupDetectionState("ambiguous");
          }
        } else if (isSharedProposal) {
          setSharedGroupDetectionState("none");
        }

        const fallbackGroupId = hasExplicitGroupParam
          ? preferredGroupId
          : preferredGroupId ||
            gid ||
            (unique && unique.length ? unique[0].id : "");

        if (preferredGroupId) {
          setAutoSharedGroupId(preferredGroupId);
          setAutoSharedGroupLabel(detectedSharedGroupLabel);
          setSharedGroupDetectionState("matched");
        } else {
          setAutoSharedGroupId("");
          setAutoSharedGroupLabel("");
        }

        if (hasExplicitGroupParam) {
          if (preferredGroupId) setSelectedGroupId(preferredGroupId);
        } else if (fallbackGroupId) {
          setSelectedGroupId(fallbackGroupId);
        }

        const shouldAutoRouteToGroup =
          (!hasExplicitGroupParam && typeParam === "group" && !groupIdParam) ||
          (!hasExplicitGroupParam &&
            !!preferredGroupId &&
            isSharedProposal &&
            typeParam !== "group");

        if (shouldAutoRouteToGroup) {
          const next = buildUrl(
            "group",
            new Date(startDate).toISOString(),
            fallbackGroupId,
          );
          router.replace(next);
        }
      } catch (err: any) {
        if (!alive) return;
        setToast({
          title: "No se pudo inicializar",
          subtitle: humanizeActionError(err, "Intenta nuevamente."),
        });
      } finally {
        if (!alive) return;
        setLoadingGroups(false);
        setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditing || !eventIdParam) return;

    let alive = true;

    (async () => {
      try {
        const ev = await getEventById(eventIdParam);
        if (!alive) return;
        const evRecord = ev as Record<string, unknown>;

        setTitle(ev.title ?? "");
        setNotes(ev.notes ?? "");

        const existingLabel = String(evRecord.location_label ?? "").trim();
        const existingAddress = String(evRecord.location_address ?? "").trim();
        const existingLat = Number(evRecord.location_lat);
        const existingLng = Number(evRecord.location_lng);
        const existingPlaceId = String(evRecord.location_place_id ?? "").trim();
        const existingProvider = String(
          evRecord.location_provider ?? "",
        ).trim();
        const existingTravelMode = String(evRecord.travel_mode ?? "").trim();
        const existingEta = Number(evRecord.travel_eta_seconds);

        if (existingLabel || existingAddress) {
          setLocationInput(existingLabel || existingAddress);
        }

        if (
          Number.isFinite(existingLat) &&
          Number.isFinite(existingLng) &&
          (existingLabel || existingAddress)
        ) {
          setSelectedPlace({
            location_label: existingLabel || existingAddress,
            location_address: existingAddress || existingLabel || "",
            location_lat: existingLat,
            location_lng: existingLng,
            location_provider:
              existingProvider === "google" ? "google" : "google",
            location_place_id: existingPlaceId,
          });
        } else {
          setSelectedPlace(null);
        }

        if (
          existingTravelMode === "walking" ||
          existingTravelMode === "bicycling" ||
          existingTravelMode === "transit"
        ) {
          setTravelMode(existingTravelMode);
        } else {
          setTravelMode("driving");
        }

        setEtaSeconds(
          Number.isFinite(existingEta)
            ? Math.max(0, Math.round(existingEta))
            : null,
        );

        const s = new Date(ev.start);
        const e = new Date(ev.end);

        if (!Number.isNaN(s.getTime())) {
          setStartLocal(toInputLocal(s));
        }

        if (!Number.isNaN(e.getTime())) {
          setEndLocal(toInputLocal(e));
        }

        const gid = ev.group_id ? String(ev.group_id) : "";
        if (gid) {
          setSelectedGroupId(gid);

          const next = buildUrl("group", new Date(ev.start).toISOString(), gid);
          const current = `/events/new/details?${sp.toString()}`;

          if (current !== next) {
            router.replace(next);
          }
        }
      } catch (err: any) {
        if (!alive) return;

        setToast({
          title: "No se pudo cargar el evento",
          subtitle: humanizeActionError(err, "Intenta nuevamente."),
        });
      } finally {
        if (!alive) return;
        setBootingEvent(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isEditing, eventIdParam, router, sp]);

  useEffect(() => {
    if (!proposedStartParam || !proposedEndParam) return;

    try {
      const s = new Date(proposedStartParam);
      const e = new Date(proposedEndParam);

      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        setStartLocal(toInputLocal(s));
        setEndLocal(toInputLocal(e));
        setExternalProposalActive(true);

        setToast({
          title: "Propuesta recibida 📩",
          subtitle: "Revisa la nueva fecha sugerida.",
        });
      }
    } catch {
      // ignore
    }
  }, [proposedStartParam, proposedEndParam]);

  useEffect(() => {
    const trimmed = String(locationInput ?? "").trim();

    if (!trimmed) {
      setAutocompleteResults([]);
      setAutocompleteError(null);
      setIsLoadingAutocomplete(false);
      return;
    }

    if (
      selectedPlace &&
      trimmed.toLowerCase() ===
        String(selectedPlace.location_label ?? "")
          .trim()
          .toLowerCase()
    ) {
      setAutocompleteResults([]);
      setAutocompleteError(null);
      setIsLoadingAutocomplete(false);
      return;
    }

    if (trimmed.length < 3) {
      setAutocompleteResults([]);
      setAutocompleteError(null);
      setIsLoadingAutocomplete(false);
      return;
    }

    let cancelled = false;
    const requestId = ++autocompleteRequestRef.current;
    setIsLoadingAutocomplete(true);
    setAutocompleteError(null);

    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/maps/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            limit: 5,
            sessionToken: locationSessionTokenRef.current,
          }),
        });

        const data = await res.json().catch(() => null);

        if (cancelled || requestId !== autocompleteRequestRef.current) return;

        if (!res.ok) {
          setAutocompleteResults([]);
          setAutocompleteError(
            String(data?.error ?? "No pudimos buscar ubicaciones ahora."),
          );
          return;
        }

        const predictions = Array.isArray(data?.predictions)
          ? (data.predictions as MapsPlaceSuggestion[])
          : [];
        setAutocompleteResults(predictions);
        setAutocompleteError(null);
      } catch {
        if (cancelled || requestId !== autocompleteRequestRef.current) return;
        setAutocompleteResults([]);
        setAutocompleteError("No pudimos conectar con mapas ahora.");
      } finally {
        if (cancelled || requestId !== autocompleteRequestRef.current) return;
        setIsLoadingAutocomplete(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [locationInput, selectedPlace]);

  useEffect(() => {
    const destination = selectedPlace;
    const origin = originPointRef.current;
    const startIso = safeIsoFromLocalDateInput(startLocal);

    if (
      !destination ||
      !origin ||
      !Number.isFinite(origin.lat) ||
      !Number.isFinite(origin.lng) ||
      !startIso
    ) {
      setIsLoadingEta(false);
      setEtaError(null);
      return;
    }

    let cancelled = false;
    const requestId = ++etaRequestRef.current;
    setIsLoadingEta(true);
    setEtaError(null);

    (async () => {
      try {
        const destinationPoint = {
          lat: Number(destination.location_lat),
          lng: Number(destination.location_lng),
        };

        const routeOrigin = resolveSafeRouteOriginForEta({
          origin,
          destination: destinationPoint,
        });

        if (!routeOrigin.canCalculateEta || !routeOrigin.origin) {
          setEtaSeconds(null);
          setEtaError(
            routeOrigin.reason === "event_too_far"
              ? "Tu ubicación parece demasiado lejos del destino. Actualízala para calcular una ruta confiable."
              : "Activa o actualiza tu ubicación para calcular cuándo salir.",
          );
          return;
        }

        const res = await fetch("/api/maps/route-eta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: routeOrigin.origin,
            destination: destinationPoint,
            travelMode,
            departureTime: getSafeRouteDepartureTime(startIso),
          }),
        });

        const data = await res.json().catch(() => null);
        if (cancelled || requestId !== etaRequestRef.current) return;

        if (!res.ok) {
          setEtaError(String(data?.error ?? "No pudimos estimar el trayecto."));
          setEtaSeconds(null);
          return;
        }

        const eta = Number(data?.etaSeconds);

        if (!isReasonableEtaSeconds(eta)) {
          setEtaSeconds(null);
          setEtaError(
            "No pudimos calcular una ruta razonable para este trayecto.",
          );
          return;
        }

        setEtaSeconds(Math.round(eta));
        setEtaError(null);
      } catch {
        if (cancelled || requestId !== etaRequestRef.current) return;
        setEtaError("No pudimos calcular la duración en este momento.");
        setEtaSeconds(null);
      } finally {
        if (cancelled || requestId !== etaRequestRef.current) return;
        setIsLoadingEta(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlace, travelMode, startLocal, originPointVersion]);
useEffect(() => {
  if (!selectedPlace || !originPointRef.current) return;

  const destinationPoint = {
    lat: Number(selectedPlace.location_lat),
    lng: Number(selectedPlace.location_lng),
  };

  if (!toLatLng(destinationPoint.lat, destinationPoint.lng)) return;

  writeSmartOriginToStorage({
    point: originPointRef.current,
    source: originSource === "missing" ? "stored" : originSource,
  });
  void persistLastKnownLocation(originPointRef.current);
}, [selectedPlace, originPointVersion]);
  useEffect(() => {
    if (isEditing) return;
    if (quickCaptureHydratedRef.current) return;
    if (quickCaptureParam !== "1") return;

    const incomingTitle = String(quickCaptureTitleParam ?? "").trim();
    const incomingDuration = Number(quickCaptureDurationParam ?? "60");
    const safeDuration =
      Number.isFinite(incomingDuration) && incomingDuration > 0
        ? Math.round(incomingDuration)
        : 60;

    if (incomingTitle) {
      setTitle((current) => (current.trim() ? current : incomingTitle));
    }

    const incomingNotes = String(quickCaptureNotesParam ?? "").trim();
    if (incomingNotes) {
      setNotes((current) => (current.trim() ? current : incomingNotes));
    }

    const parsedDate = dateParam ? new Date(dateParam) : null;
    const timeMatch = String(timeParam ?? "").match(/^(\d{1,2}):(\d{2})$/);

    if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
      if (timeMatch) {
        parsedDate.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
      }
      setStartLocal(toInputLocal(parsedDate));
      setEndLocal(toInputLocal(addMinutes(parsedDate, safeDuration)));
    } else if (timeMatch) {
      const nextStart = fromInputLocal(startLocal);
      if (!Number.isNaN(nextStart.getTime())) {
        nextStart.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
        setStartLocal(toInputLocal(nextStart));
        setEndLocal(toInputLocal(addMinutes(nextStart, safeDuration)));
      }
    } else {
      setEndLocal((current) => {
        const start = fromInputLocal(startLocal);
        if (Number.isNaN(start.getTime())) return current;
        return toInputLocal(addMinutes(start, safeDuration));
      });
    }

    quickCaptureHydratedRef.current = true;
  }, [
    isEditing,
    quickCaptureParam,
    quickCaptureTitleParam,
    quickCaptureDurationParam,
    quickCaptureNotesParam,
    dateParam,
    timeParam,
    startLocal,
  ]);

  const lockedToActiveGroup = useMemo(() => {
    if (typeParam !== "group") return false;
    return sp.get("lock") === "1";
  }, [typeParam, sp]);

  const effectiveType: NewType = useMemo(() => {
    if (lockedToActiveGroup) return "group";
    return typeParam;
  }, [lockedToActiveGroup, typeParam]);

  useEffect(() => {
    if (!lockedToActiveGroup) return;
    if (!activeGroupId) return;
    if (selectedGroupId !== activeGroupId) setSelectedGroupId(activeGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedToActiveGroup, activeGroupId]);

  useEffect(() => {
    if (effectiveType !== "group") return;
    if (!autoSharedGroupId) return;
    if (lockedToActiveGroup) return;
    if (hasExplicitGroupParam) return;
    if (selectedGroupId === autoSharedGroupId) return;
    setSelectedGroupId(autoSharedGroupId);
  }, [
    effectiveType,
    autoSharedGroupId,
    lockedToActiveGroup,
    hasExplicitGroupParam,
    selectedGroupId,
  ]);

  useEffect(() => {
    if (effectiveType !== "group") return;
    if (!selectedGroupId) return;
    const next = buildUrl(
      "group",
      new Date(startDate).toISOString(),
      selectedGroupId,
    );
    const current = `/events/new/details?${sp.toString()}`;
    if (current !== next) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveType, selectedGroupId]);

  const groupType: GroupType = useMemo(() => {
    if (effectiveType !== "group") return "personal";
    if (!selectedGroup) return "pair";
    return normalizeDbGroupType(selectedGroup.type);
  }, [effectiveType, selectedGroup]);

  const meta = useMemo(() => groupMeta(groupType), [groupType]);

  const theme = useMemo(() => {
    if (effectiveType === "group") {
      return {
        label: lockedToActiveGroup
          ? `Evento compartido (${meta.label})`
          : "Evento de grupo",
        border:
          groupType === "family"
            ? "rgba(96,165,250,0.28)"
            : groupType === ("other" as GroupType)
              ? "rgba(168,85,247,0.28)"
              : "rgba(248,113,113,0.28)",
        soft:
          groupType === "family"
            ? "rgba(96,165,250,0.14)"
            : groupType === ("other" as GroupType)
              ? "rgba(168,85,247,0.14)"
              : "rgba(248,113,113,0.12)",
      };
    }
    return {
      label: "Evento personal",
      border: "rgba(250,204,21,0.28)",
      soft: "rgba(250,204,21,0.14)",
    };
  }, [effectiveType, lockedToActiveGroup, meta.label, groupType]);

  const durationLabel = useMemo(() => {
    const diffMs = endDate.getTime() - startDate.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return null;

    const totalMinutes = Math.round(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) return `${hours} h ${minutes} min`;
    if (hours > 0) return `${hours} h`;
    return `${minutes} min`;
  }, [startDate, endDate]);

  const summaryLine = useMemo(() => {
    if (isSharedProposal && proposalResponse === "adjust") {
      return "Estás ajustando una propuesta compartida antes de dejarla lista.";
    }

    if (isSharedProposal) {
      return "Alguien te propuso este plan. Puedes aceptarlo tal cual o ajustarlo antes de guardarlo.";
    }

    if (effectiveType === "group") {
      const groupName = selectedGroup?.name ?? "Grupo";
      return `Esto se verá con ${groupName}. Si no es el lugar correcto, puedes cambiarlo.`;
    }

    return "Esto solo lo verás tú.";
  }, [effectiveType, selectedGroup, isSharedProposal, proposalResponse]);

  const quickCaptureReview = useMemo(() => {
    const fromQuickCapture = quickCaptureParam === "1" && !isEditing;
    if (!fromQuickCapture) return null;

    const normalizedTitle = normalizeFreeText(title);
    const normalizedRaw = normalizeFreeText(rawTextParam || "");
    const normalizedNotes = normalizeFreeText(notes);
    const hasValidStart = Number.isFinite(startDate.getTime());
    const hasValidEnd =
      Number.isFinite(endDate.getTime()) &&
      endDate.getTime() > startDate.getTime();

    const titleNeedsReview =
      !normalizedTitle ||
      normalizedTitle.length < 3 ||
      (normalizedRaw && normalizedTitle === normalizedRaw);

    const notesNeedsReview =
      !normalizedNotes ||
      (normalizedRaw && normalizedNotes && normalizedNotes === normalizedRaw);

    const missingDateOrTime = !hasValidStart || !hasValidEnd;

    const reviewItems: string[] = [];
    if (!hasValidStart) {
      reviewItems.push("Falta fecha/hora válida en el formulario.");
    }
    if (hasValidStart && !hasValidEnd) {
      reviewItems.push(
        "Revisa la duración: la hora de fin debe ser posterior al inicio.",
      );
    }
    if (titleNeedsReview) {
      reviewItems.push(
        "Revisa el título: puede estar incompleto o muy genérico.",
      );
    }
    if (notesNeedsReview) {
      reviewItems.push("Revisa notas/contexto para evitar ambigüedad.");
    }

    return {
      fromQuickCapture,
      titleNeedsReview,
      notesNeedsReview,
      missingDateOrTime,
      hasIssues: reviewItems.length > 0,
      reviewItems,
    };
  }, [
    quickCaptureParam,
    isEditing,
    title,
    rawTextParam,
    notes,
    startDate,
    endDate,
  ]);
  const learningInput = useMemo(() => {
    const raw = String(rawTextParam ?? "").trim();
    if (raw) return raw;
    return `${title} ${notes}`.trim();
  }, [rawTextParam, title, notes]);

  const learnedGroupMatch = useMemo(() => {
    if (effectiveType !== "group") return null;
    if (autoSharedGroupId) return null;
    if (sharedGroupDetectionState === "matched") return null;
    if (!learningInput || learningInput.trim().length < 4) return null;

    return getLearnedGroupMatch({
      title: learningInput,
      availableGroupIds: uniqueGroups.map((group) => group.id),
    });
  }, [
    effectiveType,
    autoSharedGroupId,
    sharedGroupDetectionState,
    learningInput,
    uniqueGroups,
  ]);

  const learnedGroupCandidate = useMemo(() => {
    if (!learnedGroupMatch?.groupId) return null;

    return (
      uniqueGroups.find((group) => group.id === learnedGroupMatch.groupId) ||
      null
    );
  }, [learnedGroupMatch, uniqueGroups]);

  const candidateGroupOptions = useMemo(
    () =>
      uniqueGroups.map((group) => ({
        id: group.id,
        type: group.type ?? null,
      })),
    [uniqueGroups],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateLearningSignals() {
      try {
        const signals = await getLearningSignals({ daysBack: 120 });

        if (!cancelled) {
          setLearningSignals(Array.isArray(signals) ? signals : []);
        }
      } catch {
        if (!cancelled) {
          setLearningSignals([]);
        }
      }
    }

    void hydrateLearningSignals();

    return () => {
      cancelled = true;
    };
  }, []);

  const canonicalGroupSuggestion = useMemo(() => {
    if (effectiveType !== "group") return null;
    if (autoSharedGroupId) return null;
    if (sharedGroupDetectionState === "matched") return null;

    const suggestion = suggestCanonicalGroupWithLearning({
      title,
      notes,
      signals: learningSignals,
      candidateGroups: candidateGroupOptions,
    });

    if (!suggestion.type || suggestion.mode === "none") return null;

    return suggestion;
  }, [
    effectiveType,
    autoSharedGroupId,
    sharedGroupDetectionState,
    title,
    notes,
    learningSignals,
    candidateGroupOptions,
  ]);

  const suggestedGroupCandidate = useMemo(() => {
    if (
      canonicalGroupSuggestion?.mode === "auto_apply" &&
      canonicalGroupSuggestion.groupId
    ) {
      return (
        uniqueGroups.find(
          (group) => group.id === String(canonicalGroupSuggestion.groupId),
        ) || null
      );
    }

    if (
      canonicalGroupSuggestion?.mode === "suggest_only" &&
      canonicalGroupSuggestion.type
    ) {
      const compatibleGroups = uniqueGroups.filter(
        (group) =>
          normalizeDbGroupType(group.type) === canonicalGroupSuggestion.type,
      );

      if (!compatibleGroups.length) return null;

      return (
        compatibleGroups.find((group) => group.id === activeGroupId) ||
        compatibleGroups[0] ||
        null
      );
    }

    // legacy = solo referencia pasiva
    if (!canonicalGroupSuggestion?.type && learnedGroupCandidate?.id) {
      return learnedGroupCandidate;
    }

    return null;
  }, [
    canonicalGroupSuggestion,
    uniqueGroups,
    activeGroupId,
    learnedGroupCandidate,
  ]);

  useEffect(() => {
    if (effectiveType !== "group") {
      setSuggestedPreselectedGroupId("");
      return;
    }
    if (lockedToActiveGroup) {
      setSuggestedPreselectedGroupId("");
      return;
    }
    if (hasExplicitGroupParam) {
      setSuggestedPreselectedGroupId("");
      return;
    }
    if (autoSharedGroupId || sharedGroupDetectionState === "matched") {
      setSuggestedPreselectedGroupId("");
      return;
    }
    if (!suggestedGroupCandidate?.id) {
      setSuggestedPreselectedGroupId("");
      return;
    }
    if (groupManualSelectionRef.current) return;

    const canAutoPreselect = canonicalGroupSuggestion?.mode === "auto_apply";

    if (!canAutoPreselect) {
      setSuggestedPreselectedGroupId("");
      return;
    }

    setSuggestedPreselectedGroupId(suggestedGroupCandidate.id);

    if (selectedGroupId !== suggestedGroupCandidate.id) {
      setSelectedGroupId(suggestedGroupCandidate.id);
    }
  }, [
    effectiveType,
    lockedToActiveGroup,
    hasExplicitGroupParam,
    autoSharedGroupId,
    sharedGroupDetectionState,
    suggestedGroupCandidate,
    selectedGroupId,
    canonicalGroupSuggestion,
  ]);

  const dateRangeLabel = useMemo(() => {
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "";
    return fmtRange(startDate.toISOString(), endDate.toISOString());
  }, [startDate, endDate]);

  const currentPostSaveFingerprint = useMemo(
    () =>
      buildPostSaveFingerprint({
        effectiveType,
        selectedGroupId,
        title,
        notes,
        startLocal,
        endLocal,
      }),
    [effectiveType, selectedGroupId, title, notes, startLocal, endLocal],
  );

  const shouldLearnCurrentSelection = useMemo(() => {
    if (effectiveType !== "group") return false;
    if (!selectedGroup?.id) return false;
    if (!canLearnFromInput(learningInput)) return false;

    const normalizedType = normalizeDbGroupType(selectedGroup.type);
    return (
      normalizedType === "pair" ||
      normalizedType === "family" ||
      normalizedType === "other"
    );
  }, [effectiveType, selectedGroup, learningInput]);

  const clearPostSaveState = (options?: { keepToast?: boolean }) => {
    setPostSaveActions(null);
    setPostSaveShareUrl(null);
    setPostSaveFingerprint(null);
    if (!options?.keepToast) setToast(null);
  };

  const clearPreflightState = () => {
    setPendingPayload(null);
    setExistingIdsToReplace([]);
    setPreflightItems([]);
  };

  const errors = useMemo(() => {
    const e: string[] = [];

    if (!title.trim()) e.push("Escribe un título.");
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
      e.push("Fecha/hora inválida.");
    if (endDate.getTime() <= startDate.getTime())
      e.push("La hora de fin debe ser posterior al inicio.");

    if (effectiveType === "group") {
      if (loadingGroups) e.push("Cargando grupos…");
      if (!selectedGroupId) e.push("Elige un grupo.");
      if (selectedGroupId && !selectedGroup) e.push("Grupo inválido.");
    }

    if (bootingEvent) e.push("Cargando evento…");

    return e;
  }, [
    title,
    startDate,
    endDate,
    effectiveType,
    loadingGroups,
    selectedGroupId,
    selectedGroup,
    bootingEvent,
  ]);

  const canSave = errors.length === 0 && !saving && !bootingEvent;

  useEffect(() => {
    if (!postSaveActions?.visible) return;
    if (!postSaveFingerprint) return;
    if (currentPostSaveFingerprint === postSaveFingerprint) return;

    clearPostSaveState({ keepToast: true });
  }, [
    currentPostSaveFingerprint,
    postSaveFingerprint,
    postSaveActions?.visible,
  ]);

  const goBack = () => router.push("/calendar");

  const handleReviewProposalLater = () => {
    setToast({
      title: "Propuesta pendiente",
      subtitle:
        "No guardamos nada. Puedes volver más tarde desde el link compartido.",
    });

    window.setTimeout(() => {
      router.push("/summary");
    }, 500);
  };

  const onAutoEnd = () => {
    const s = fromInputLocal(startLocal);
    const e = fromInputLocal(endLocal);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    if (e.getTime() <= s.getTime())
      setEndLocal(toInputLocal(addMinutes(s, 60)));
  };
  const applyTemplateSelection = (template: EventTemplate) => {
    setSelectedTemplate(template);
    setTitle(template.title);
    setNotes(template.defaultNotes ?? "");

    const start = fromInputLocal(startLocal);
    if (!isNaN(start.getTime())) {
      const nextEnd = addMinutes(start, template.defaultDurationMinutes);
      setEndLocal(toInputLocal(nextEnd));
    }
  };

  const clearTemplateSelection = () => {
    setSelectedTemplate(null);
    setTitle("");
    setNotes("");
  };

  const buildSuccessToast = (options?: { keepBoth?: boolean }) => {
    const isSharedEvent = effectiveType === "group";

    if (isSharedProposal) {
      if (options?.keepBoth) {
        return {
          title:
            proposalResponse === "adjust"
              ? "Propuesta ajustada ✅"
              : "Propuesta aceptada ✅",
          subtitle:
            proposalResponse === "adjust"
              ? "Guardamos tu versión ajustada y conservamos ambos horarios para que puedas revisarlos con calma."
              : "Guardamos el plan y conservamos ambos horarios para que puedas revisarlos con calma.",
        };
      }

      return {
        title:
          proposalResponse === "adjust"
            ? "Propuesta ajustada ✅"
            : "Propuesta aceptada ✅",
        subtitle:
          proposalResponse === "adjust"
            ? "Tu versión ajustada ya quedó guardada y puedes seguir afinándola cuando quieras."
            : "Ya quedó en tu calendario y puedes seguir ajustándola cuando quieras.",
      };
    }

    if (options?.keepBoth) {
      return {
        title: isSharedEvent
          ? isEditing
            ? "Plan compartido actualizado ✅"
            : "Plan compartido creado ✅"
          : isEditing
            ? "Evento personal actualizado ✅"
            : "Evento personal creado ✅",
        subtitle: isSharedEvent
          ? "Conservamos ambos planes para que puedas decidirlo después con más calma."
          : "Conservamos ambos eventos para que puedas decidirlo después con más calma.",
      };
    }

    if (isSharedEvent) {
      if (!isEditing && isFirstWowMomentFlow) {
        return {
          title: "Primer plan listo ✅",
          subtitle:
            "Ya activaste la coordinación compartida en SyncPlans. Desde aquí ya pueden ordenar algo real juntos.",
        };
      }

      return {
        title: isEditing
          ? "Plan compartido actualizado ✅"
          : "Plan compartido creado ✅",
        subtitle: isEditing
          ? "El grupo ya verá esta versión actualizada."
          : "Ya quedó listo en el calendario del grupo.",
      };
    }

    return {
      title: isEditing
        ? "Evento personal actualizado ✅"
        : "Evento personal creado ✅",
      subtitle: isEditing
        ? "Tus cambios ya quedaron guardados."
        : "Ya quedó listo en tu calendario.",
    };
  };

  const writePreflightResolutionLogs = async (input: {
    items: PreflightConflict[];
    payload: SavePayload;
    choice: Exclude<PreflightChoice, "edit">;
    finalAction: string;
    savedEventId?: string | null;
    blockedIds?: string[];
    reason?: string | null;
  }) => {
    if (!currentUserId || !input.items.length) return;

    const writes = input.items
      .filter((it) => String(it.id ?? "").trim())
      .map((it) =>
        createConflictResolutionLog({
          conflictId: String(it.id),
          groupId: input.payload.groupId ?? null,
          decidedBy: currentUserId,
          decisionType: decisionTypeFromPreflightChoice(input.choice),
          finalAction: input.finalAction,
          reason: input.reason ?? null,
          metadata: {
            existing_event_id: String(it.existingId ?? ""),
            incoming_event_id: input.savedEventId ?? null,
            blocked_event_ids: input.blockedIds ?? [],
            fallback_applied: input.finalAction === "fallback_keep_both",
            source: "event_preflight",
            incoming_draft: {
              title: input.payload.title,
              notes: input.payload.notes ?? null,
              start: input.payload.startIso,
              end: input.payload.endIso,
              group_id: input.payload.groupId ?? null,
              group_type: input.payload.groupType,
            },
          },
        }),
      );

    const settled = await Promise.allSettled(writes);

    for (const item of settled) {
      if (item.status === "rejected") {
        console.error("preflight conflict log insert failed", item.reason);
      }
    }
  };

  const writePreflightDecisionNotifications = async (input: {
    items: PreflightConflict[];
    choice: Exclude<PreflightChoice, "edit">;
    finalAction: string;
    savedEventId?: string | null;
    payload: {
      title: string;
      groupId: string | null;
    };
  }) => {
    if (!currentUserId || !input.items.length) return 0;
    if (input.choice !== "replace_with_new") return 0;

    const rows: Array<{
      user_id: string;
      actor_user_id: string;
      conflict_id: string;
      decision_type: string;
      final_action: string;
      affected_event_id: string;
      affected_event_title: string;
      kept_event_id: string | null;
      kept_event_title: string | null;
      group_id: string | null;
      source: string;
    }> = [];

    for (const item of input.items) {
      try {
        const existingEvent = await getEventById(String(item.existingId));
        const targetUserId = resolveEventOwnerId(existingEvent);

        if (!targetUserId || targetUserId === currentUserId) continue;

        rows.push({
          user_id: targetUserId,
          actor_user_id: currentUserId,
          conflict_id: String(item.id),
          decision_type: decisionTypeFromPreflightChoice(input.choice),
          final_action: input.finalAction,
          affected_event_id: String(item.existingId),
          affected_event_title: safeTitle(
            (existingEvent as any)?.title ?? item.title,
          ),
          kept_event_id: input.savedEventId ?? null,
          kept_event_title: safeTitle(input.payload.title),
          group_id: input.payload.groupId ?? null,
          source: "event_preflight",
        });
      } catch {
        // no rompemos el flujo por una notificación
      }
    }

    if (rows.length === 0) return 0;

    let created = 0;

    for (const row of rows) {
      const decisionLabel =
        row.final_action === "fallback_keep_both"
          ? `Se intentó resolver el conflicto con “${row.affected_event_title ?? "evento"}”, pero no se pudo eliminar. SyncPlans mantuvo ambos eventos automáticamente.`
          : row.final_action === "replace_with_new"
            ? `Se reemplazó “${row.affected_event_title ?? "evento"}” por “${row.kept_event_title ?? "el nuevo evento"}”.`
            : row.final_action === "keep_existing"
              ? `Se conservó “${row.affected_event_title ?? "el evento existente"}”.`
              : `Se tomó una decisión sobre un conflicto que involucraba “${row.affected_event_title ?? "un evento"}”.`;

      if (row.final_action === "fallback_keep_both") {
        await createConflictAutoAdjustedNotification({
          userId: row.user_id,
          decisionLabel,
          entityId: row.affected_event_id ?? null,
          payload: {
            actor_user_id: row.actor_user_id,
            conflict_id: row.conflict_id,
            decision_type: row.decision_type,
            final_action: row.final_action,
            affected_event_id: row.affected_event_id,
            affected_event_title: row.affected_event_title,
            kept_event_id: row.kept_event_id,
            kept_event_title: row.kept_event_title,
            group_id: row.group_id,
            source: row.source,
          },
        });
      } else {
        await createConflictDecisionNotification({
          userId: row.user_id,
          decisionLabel,
          entityId: row.affected_event_id ?? null,
          payload: {
            actor_user_id: row.actor_user_id,
            conflict_id: row.conflict_id,
            decision_type: row.decision_type,
            final_action: row.final_action,
            affected_event_id: row.affected_event_id,
            affected_event_title: row.affected_event_title,
            kept_event_id: row.kept_event_id,
            kept_event_title: row.kept_event_title,
            group_id: row.group_id,
            source: row.source,
          },
        });
      }

      created += 1;
    }

    return created;
  };

  const persistEvent = async (payload: SavePayload) => {
    let savedEventId: string | null = null;

    if (isEditing && eventIdParam) {
      await updateEvent({
        id: eventIdParam,
        title: payload.title,
        notes: payload.notes,
        start: payload.startIso,
        end: payload.endIso,
        groupId: payload.groupId,
        location_label: payload.location_label,
        location_address: payload.location_address,
        location_lat: payload.location_lat,
        location_lng: payload.location_lng,
        location_provider: payload.location_provider,
        location_place_id: payload.location_place_id,
        travel_mode: payload.travel_mode,
        travel_eta_seconds: payload.travel_eta_seconds,
        leave_time: payload.leave_time,
      });
      savedEventId = String(eventIdParam);

      if (savedEventId) {
        await syncAcceptedResponsesForSavedEvent({
          eventId: savedEventId,
          currentUserId,
          groupId: payload.groupId ?? null,
        });
      }

      if (currentUserId && savedEventId) {
        const analyticsPayload = {
          user_id: currentUserId,
          event_type: "event_edited",
          entity_id: savedEventId,
          metadata: {
            type: payload.groupId ? "group" : "personal",
          },
        };

        const { error: analyticsError } = await supabase
          .from("events_analytics")
          .insert(analyticsPayload);

        if (analyticsError) {
          console.error("event_edited analytics insert failed", analyticsError);
        }
      }

      const proposalSource = sp.get("proposalSource");
      const proposalIntent = sp.get("proposalIntent");

      if (proposalSource === "public_invite" && savedEventId) {
        const creatorResponse =
          proposalIntent === "accept"
            ? "accepted"
            : proposalIntent === "reject"
              ? "rejected"
              : null;

        if (creatorResponse) {
          await supabase
            .from("public_invites")
            .update({ creator_response: creatorResponse })
            .eq("event_id", savedEventId);
        }
      }
    } else {
      const created = await createEventForGroup({
        title: payload.title,
        notes: payload.notes,
        start: payload.startIso,
        end: payload.endIso,
        groupId: payload.groupId,
        location_label: payload.location_label,
        location_address: payload.location_address,
        location_lat: payload.location_lat,
        location_lng: payload.location_lng,
        location_provider: payload.location_provider,
        location_place_id: payload.location_place_id,
        travel_mode: payload.travel_mode,
        travel_eta_seconds: payload.travel_eta_seconds,
        leave_time: payload.leave_time,
      });
      savedEventId = created?.id ? String(created.id) : null;

      if (savedEventId) {
        await syncAcceptedResponsesForSavedEvent({
          eventId: savedEventId,
          currentUserId,
          groupId: payload.groupId ?? null,
        });
      }

      if (
        savedEventId &&
        isSharedProposal &&
        proposalResponse &&
        currentUserId
      ) {
        try {
          await upsertProposalResponse({
            eventId: savedEventId,
            userId: currentUserId,
            response: proposalResponse === "adjust" ? "adjusted" : "accepted",
          });
        } catch (err) {
          console.error("proposal response persist failed", err);
        }
      }

      if (savedEventId) {
        await trackEvent({
          event: "event_created",
          userId: currentUserId,
          entityId: savedEventId,
          metadata: {
            type: payload.groupId ? "group" : "personal",
          },
        });
      }
    }

    if (savedEventId && shouldLearnCurrentSelection && selectedGroup?.id) {
      learnGroupSelection({
        title: learningInput,
        groupId: selectedGroup.id,
        groupType: normalizeDbGroupType(selectedGroup.type) as
          | "pair"
          | "family"
          | "other",
      });
    }

    emitSyncPlansRefreshSignals();
    return savedEventId;
  };

  const showPostSaveCard = (
    savedEventId: string | null,
    payload: SavePayload,
    options?: { keepBoth?: boolean },
  ) => {
    setToast(
      buildSuccessToast(options?.keepBoth ? { keepBoth: true } : undefined),
    );
    setPostSaveShareUrl(null);
    setPostSaveFingerprint(currentPostSaveFingerprint);
    setPostSaveActions({
      visible: true,
      eventId: savedEventId ?? undefined,
      title: payload.title,
      isShared: effectiveType === "group",
      isProposal: isSharedProposal,
    });
  };

  const finalizeKeepBothRedirect = async (
    savedEventId: string,
    payload: SavePayload,
  ) => {
    try {
      const pf = await loadEventsForConflictPreflight({
        candidate: {
          id: savedEventId,
          title: payload.title,
          start: payload.startIso,
          end: payload.endIso,
          groupId: payload.groupId,
          groupType: payload.groupType,
          notes: payload.notes,
        },
      });

      const combined = [...pf.baseEvents, pf.candidateEvent];
      const related = computeVisibleConflicts(combined).filter((c) => {
        const currentSavedId = String(savedEventId);
        return (
          String(c.existingEventId) === currentSavedId ||
          String(c.incomingEventId) === currentSavedId
        );
      });

      if (related.length > 0) {
        ignoreConflictIds(related.map((c) => c.id).filter(Boolean));
      }
    } catch {
      // ok
    }

    setToast(buildSuccessToast({ keepBoth: true }));

    const qp = new URLSearchParams();
    qp.set("from", "conflicts");
    qp.set("fallbackKeepBoth", "1");
    qp.set("eventId", String(savedEventId));
    if (payload.groupId) qp.set("groupId", String(payload.groupId));

    window.setTimeout(() => {
      router.push(`/summary?${qp.toString()}`);
    }, 500);
  };

  const runConflictNotificationForSavedEvent = async (savedEventId: string) => {
    return createConflictNotificationForEvent(savedEventId).catch(() => ({
      created: 0,
      conflictCount: 0,
      targetEventId: savedEventId,
    }));
  };

  const handleSelectPlace = (item: MapsPlaceSuggestion) => {
    const normalized: SelectedPlace = {
      location_label:
        String(item.label ?? "").trim() || String(item.address ?? "").trim(),
      location_address:
        String(item.address ?? "").trim() || String(item.label ?? "").trim(),
      location_lat: Number(item.lat),
      location_lng: Number(item.lng),
      location_provider: "google",
      location_place_id: String(item.place_id ?? "").trim(),
    };

    setSelectedPlace(normalized);
    setLocationInput(normalized.location_label);
    setAutocompleteResults([]);
    setAutocompleteError(null);
    locationSessionTokenRef.current = `sp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  };

  const clearSelectedPlace = () => {
    setSelectedPlace(null);
    setLocationInput("");
    setAutocompleteResults([]);
    setAutocompleteError(null);
    setEtaError(null);
    setEtaSeconds(null);
    locationSessionTokenRef.current = `sp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  };

  const buildSavePayload = (): SavePayload => ({
    groupType,
    groupId: effectiveType === "group" ? selectedGroupId : null,
    title: title.trim(),
    notes: notes.trim() ? notes.trim() : undefined,
    startIso: new Date(startDate).toISOString(),
    endIso: new Date(endDate).toISOString(),
    location_label: selectedPlace?.location_label ?? null,
    location_address: selectedPlace?.location_address ?? null,
    location_lat: selectedPlace?.location_lat ?? null,
    location_lng: selectedPlace?.location_lng ?? null,
    location_provider: selectedPlace?.location_provider ?? null,
    location_place_id: selectedPlace?.location_place_id ?? null,
    travel_mode: selectedPlace ? travelMode : null,
    travel_eta_seconds:
      selectedPlace && isReasonableEtaSeconds(etaSeconds)
        ? Math.round(Number(etaSeconds))
        : null,
    leave_time:
      selectedPlace && isReasonableEtaSeconds(etaSeconds) && leaveTimePreview
        ? leaveTimePreview.toISOString()
        : null,
  });

  const doSave = async (
    payload: SavePayload,
    options?: {
      keepBothRedirect?: boolean;
      skipConflictDetection?: boolean;
    },
  ) => {
    if (saveInFlightRef.current) return null;

    saveInFlightRef.current = true;
    setSaving(true);

    try {
      const savedEventId = await persistEvent(payload);
      if (!savedEventId) {
        throw new Error("No se pudo obtener el id del evento guardado.");
      }

      if (options?.keepBothRedirect) {
        const conflictResult =
          await runConflictNotificationForSavedEvent(savedEventId);

        if (conflictResult.conflictCount > 0) {
          await finalizeKeepBothRedirect(savedEventId, payload);
          return savedEventId;
        }

        showPostSaveCard(savedEventId, payload, { keepBoth: true });
        return savedEventId;
      }

      if (options?.skipConflictDetection) {
        return savedEventId;
      }

      const conflictResult =
        await runConflictNotificationForSavedEvent(savedEventId);

      if (conflictResult.conflictCount > 0) {
        setToast({
          title: "⚠️ Conflicto detectado",
          subtitle: "Te llevo a revisarlo ahora…",
        });

        const qp = new URLSearchParams();
        if (conflictResult.targetEventId) {
          qp.set("eventId", String(conflictResult.targetEventId));
        }
        if (payload.groupId) {
          qp.set("groupId", String(payload.groupId));
        }
        qp.set("from", isEditing ? "event_edit" : "event_create");

        window.setTimeout(() => {
          router.push(`/conflicts/detected?${qp.toString()}`);
        }, 500);
        return savedEventId;
      }

      showPostSaveCard(savedEventId, payload);
      return savedEventId;
    } catch (err: any) {
      setToast({
        title: "No se pudo guardar",
        subtitle: humanizeActionError(err, "Intenta nuevamente."),
      });
      window.setTimeout(() => setToast(null), 2800);
      return null;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  const preflight = async (
    payload: SavePayload,
  ): Promise<{ ok: true } | { ok: false }> => {
    const warn = (settings as any)?.conflictWarnBeforeSave ?? true;
    if (!warn) return { ok: true };

    try {
      const pf = await loadEventsForConflictPreflight({
        candidate: {
          id: isEditing && eventIdParam ? String(eventIdParam) : null,
          title: payload.title,
          start: payload.startIso,
          end: payload.endIso,
          groupId: payload.groupId,
          groupType: payload.groupType,
          notes: payload.notes,
        },
      });

      const combined = [...pf.baseEvents, pf.candidateEvent];
      const all = computeVisibleConflicts(combined);

      const candidateId = String(pf.candidateEvent.id);

      const conflicts = all.filter((c) => {
        const touchesCandidate =
          String(c.existingEventId) === candidateId ||
          String(c.incomingEventId) === candidateId;

        if (!touchesCandidate) return false;

        const counterpart = getConflictCounterpart(c, candidateId);
        if (!counterpart?.otherId) return false;

        if (
          isEditing &&
          eventIdParam &&
          String(counterpart.otherId) === String(eventIdParam)
        ) {
          return false;
        }

        return true;
      });

      if (!conflicts.length) {
        clearPreflightState();
        return { ok: true };
      }

      const items: PreflightConflict[] = conflicts
        .map((c) => {
          const counterpart = getConflictCounterpart(c, candidateId);
          if (!counterpart?.otherId) return null;

          const otherEvent = counterpart.otherEvent;
          const gm = groupMeta(otherEvent?.groupType ?? "personal");

          return {
            id: c.id,
            existingId: String(counterpart.otherId),
            title: otherEvent?.title ?? "Evento existente",
            groupLabel: gm.label,
            range: otherEvent
              ? fmtRange(otherEvent.start, otherEvent.end)
              : "—",
            overlapStart: c.overlapStart,
            overlapEnd: c.overlapEnd,
          };
        })
        .filter(Boolean) as PreflightConflict[];

      setExistingIdsToReplace(
        Array.from(
          new Set(items.map((x) => String(x.existingId)).filter(Boolean)),
        ),
      );
      setPreflightItems(items);
      setPreflightDefaultChoice(mapDefaultResolutionToChoice(settings));
      setPreflightOpen(true);

      return { ok: false };
    } catch {
      return { ok: true };
    }
  };

  const save = async () => {
    if (saving || saveInFlightRef.current || preflightChoiceInFlightRef.current)
      return;

    clearPreflightState();
    clearPostSaveState({ keepToast: true });

    if (!canSave) {
      setToast({
        title: "Revisa el formulario",
        subtitle: errors[0],
      });
      return;
    }

    const payload = buildSavePayload();

    setPendingPayload(payload);
    const pf = await preflight(payload);
    if (!(pf as any).ok) return;

    await doSave(payload);
  };

  const onPreflightChoose = async (choice: PreflightChoice) => {
    if (preflightChoiceInFlightRef.current) return;
    preflightChoiceInFlightRef.current = true;
    setPreflightOpen(false);

    try {
      if (choice === "edit") {
        clearPreflightState();
        setToast({
          title: "Perfecto",
          subtitle: "Ajusta lo que necesites y vuelve a guardar.",
        });
        return;
      }

      if (choice === "keep_existing") {
        const itemsSnapshot = [...preflightItems];
        const payloadSnapshot = pendingPayload;

        if (payloadSnapshot) {
          await writePreflightResolutionLogs({
            items: itemsSnapshot,
            payload: payloadSnapshot,
            choice: "keep_existing",
            finalAction: finalActionFromPreflightChoice("keep_existing"),
            savedEventId: null,
            blockedIds: [],
            reason:
              "El usuario decidió conservar los eventos existentes y no guardar el nuevo evento.",
          });
        }

        clearPreflightState();
        setToast({
          title: "No se guardó",
          subtitle: "Conservamos tus eventos existentes.",
        });
        return;
      }

      if (!pendingPayload) {
        clearPreflightState();
        setToast({
          title: "Ups",
          subtitle: "No encontré el evento pendiente. Intenta otra vez.",
        });
        return;
      }

      if (choice === "keep_both") {
        const itemsSnapshot = [...preflightItems];
        const payloadToSave = pendingPayload;

        clearPreflightState();

        const savedEventId = await doSave(payloadToSave, {
          keepBothRedirect: true,
        });

        if (savedEventId) {
          try {
            const ids = itemsSnapshot.map((it) => it.id).filter(Boolean);
            if (ids.length > 0) ignoreConflictIds(ids);
          } catch {
            // ok
          }

          await writePreflightResolutionLogs({
            items: itemsSnapshot,
            payload: payloadToSave,
            choice: "keep_both",
            finalAction: finalActionFromPreflightChoice("keep_both"),
            savedEventId: savedEventId ?? null,
            blockedIds: [],
            reason: null,
          });
        }

        return;
      }

      setSaving(true);

      const payloadToSave = pendingPayload;
      const itemsSnapshot = [...preflightItems];
      const idsToReplaceSnapshot = [...existingIdsToReplace];

      clearPreflightState();

      const savedEventId = await doSave(payloadToSave, {
        skipConflictDetection: true,
      });

      if (!savedEventId) {
        return;
      }

      const deleteResult =
        await deleteEventsByIdsDetailed(idsToReplaceSnapshot);

      const blockedIds = Array.isArray(deleteResult?.blockedIds)
        ? deleteResult.blockedIds.map((id) => String(id)).filter(Boolean)
        : [];

      const didDeleteAll =
        Number(deleteResult?.deletedCount ?? 0) === idsToReplaceSnapshot.length;

      if (blockedIds.length > 0 || !didDeleteAll) {
        try {
          const conflictIds = itemsSnapshot.map((it) => it.id).filter(Boolean);

          if (blockedIds.length > 0) {
            hideEventIdsForCurrentUser(blockedIds);
          }

          if (conflictIds.length > 0) {
            ignoreConflictIds(conflictIds);
          }
        } catch {
          // no rompemos el flujo por el fallback
        }

        setToast({
          title: "Aplicado con ajuste automático",
          subtitle:
            "No pudimos reemplazar todos los eventos por permisos. Mantuvimos ambos para evitar inconsistencias.",
        });
        window.setTimeout(() => setToast(null), 3200);

        await finalizeKeepBothRedirect(savedEventId, payloadToSave);

        await writePreflightResolutionLogs({
          items: itemsSnapshot,
          payload: payloadToSave,
          choice: "replace_with_new",
          finalAction: "fallback_keep_both",
          savedEventId: savedEventId ?? null,
          blockedIds,
          reason:
            "No se pudieron reemplazar todos los eventos por permisos. Para no romper nada, SyncPlans mantuvo ambos.",
        });

        try {
          await writePreflightDecisionNotifications({
            items: itemsSnapshot,
            choice: "replace_with_new",
            finalAction: "fallback_keep_both",
            savedEventId: savedEventId ?? null,
            payload: {
              title: payloadToSave.title,
              groupId: payloadToSave.groupId ?? null,
            },
          });
        } catch (error) {
          console.error(
            "preflight conflict decision notifications failed",
            error,
          );
        }
        return;
      }

      showPostSaveCard(savedEventId, payloadToSave);

      await writePreflightResolutionLogs({
        items: itemsSnapshot,
        payload: payloadToSave,
        choice: "replace_with_new",
        finalAction: finalActionFromPreflightChoice("replace_with_new"),
        savedEventId: savedEventId ?? null,
        blockedIds: [],
        reason: null,
      });

      try {
        await writePreflightDecisionNotifications({
          items: itemsSnapshot,
          choice: "replace_with_new",
          finalAction: finalActionFromPreflightChoice("replace_with_new"),
          savedEventId: savedEventId ?? null,
          payload: {
            title: payloadToSave.title,
            groupId: payloadToSave.groupId ?? null,
          },
        });
      } catch (error) {
        console.error(
          "preflight conflict decision notifications failed",
          error,
        );
      }
    } catch (err: any) {
      setToast({
        title: "No se pudo aplicar",
        subtitle: humanizeActionError(err, "Intenta nuevamente."),
      });
      window.setTimeout(() => setToast(null), 2800);
    } finally {
      preflightChoiceInFlightRef.current = false;
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  const handleSharePostSave = async () => {
    if (sharingPostSave) return;

    try {
      if (!postSaveActions?.eventId) {
        setToast({
          title: "Todavía no se puede compartir",
          subtitle: "Aún no encontré el evento que acabas de guardar.",
        });
        return;
      }

      setSharingPostSave(true);

      const invite = await getOrCreatePublicInvite({
        eventId: postSaveActions.eventId,
      });

      const token =
        typeof invite === "string"
          ? invite
          : invite?.token || invite?.id || null;

      if (!token) {
        throw new Error("No se pudo generar el link.");
      }

      const shareUrl = `${window.location.origin}/invite/${token}`;
      setPostSaveShareUrl(shareUrl);

      if (navigator.share) {
        try {
          await navigator.share({
            title: postSaveActions.title || "Evento compartido",
            text: postSaveActions.title
              ? `Te comparto este plan: ${postSaveActions.title}`
              : "Te comparto este plan.",
            url: shareUrl,
          });

          return;
        } catch (shareErr: any) {
          if (shareErr?.name === "AbortError") {
            return;
          }
        }
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setToast({
          title: "Link copiado ✅",
          subtitle: "Ya puedes compartirlo donde quieras.",
        });
      } else {
        setToast({
          title: "Link listo ✅",
          subtitle: "Cópialo manualmente desde la caja de abajo.",
        });
      }
    } catch (err: any) {
      setToast({
        title: "No se pudo compartir",
        subtitle: humanizeActionError(err, "Intenta nuevamente."),
      });
    } finally {
      setSharingPostSave(false);
    }
  };

  const handleCreateAnotherSimilar = () => {
    const durationMinutes = getSafeDurationMinutes(startDate, endDate);
    const nextStart = roundToNextQuarterHour(new Date());
    const nextEnd = addMinutes(nextStart, durationMinutes);

    setPostSaveActions(null);
    setToast(null);
    setPostSaveShareUrl(null);
    setPostSaveFingerprint(null);

    if (isEditing) {
      const nextUrl = buildUrl(
        effectiveType,
        nextStart.toISOString(),
        effectiveType === "group"
          ? selectedGroupId || activeGroupId || null
          : null,
      );

      const nextParams = new URLSearchParams(nextUrl.split("?")[1] || "");
      nextParams.delete("eventId");

      router.replace(`/events/new/details?${nextParams.toString()}`);
      return;
    }

    setStartLocal(toInputLocal(nextStart));
    setEndLocal(toInputLocal(nextEnd));
  };
  if (!hydrated) {
    return <main style={styles.page} />;
  }
  return (
    <main style={styles.page}>
      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? (
              <div style={styles.toastSub}>{toast.subtitle}</div>
            ) : null}
          </div>
        </div>
      )}

      <ConflictPreflightModal
        open={preflightOpen}
        title={title.trim() || (isEditing ? "Editar evento" : "Nuevo evento")}
        items={preflightItems}
        defaultChoice={preflightDefaultChoice}
        onClose={() => {
          setPreflightOpen(false);
          clearPreflightState();
        }}
        onChoose={onPreflightChoose}
      />

      <div style={styles.shell}>
        <div style={styles.topRow}>
          <PremiumHeader />
          <div style={styles.topActions}>
            <LogoutButton />
          </div>
        </div>

        <EventDetailsHero
          themeLabel={theme.label}
          themeBorder={theme.border}
          themeSoft={theme.soft}
          metaLabel={meta.label}
          metaDot={meta.dot}
          isEditing={isEditing}
          isSharedProposal={isSharedProposal}
          proposalResponse={proposalResponse}
          summaryLine={summaryLine}
          durationLabel={durationLabel}
          lockedToActiveGroup={lockedToActiveGroup}
          canSave={canSave}
          saving={saving}
          onPrimaryClick={save}
          onSecondaryClick={
            isSharedProposal ? handleReviewProposalLater : goBack
          }
        />

        {isFirstWowMomentFlow && !isEditing ? (
          <section
            style={{
              ...styles.card,
              borderColor: "rgba(56,189,248,0.24)",
              background:
                "linear-gradient(180deg, rgba(56,189,248,0.10), rgba(255,255,255,0.03))",
              gap: 10,
            }}
          >
            <div style={styles.sectionIntro}>
              <div style={styles.sectionEyebrow}>Ruta guiada</div>
              <div style={styles.sectionTitle}>
                Tu primer plan compartido empieza aquí
              </div>
              <div style={styles.sectionSub}>
                Guárdalo una vez y desde aquí podrán coordinar mejor, detectar
                cruces a tiempo y decidir sobre algo real sin depender de
                mensajes sueltos.
              </div>
            </div>
          </section>
        ) : null}

        <section style={styles.card}>
          <div style={styles.primaryStack}>
            <div style={styles.sectionIntro}>
              <div style={styles.sectionEyebrow}>Lo esencial</div>
              <div style={styles.sectionTitle}>
                {isFirstWowMomentFlow && !isEditing
                  ? "Lo mínimo para activar el primer plan"
                  : "Primero, lo importante"}
              </div>
              <div style={styles.sectionSub}>
                {isFirstWowMomentFlow && !isEditing
                  ? "Empieza por título, horario y contexto. Lo demás puede esperar: el objetivo ahora es crear algo real y compartido lo más rápido posible."
                  : "Título, horario y contexto. Lo esencial primero; el resto queda a mano sin meter ruido."}
              </div>
            </div>

            {!isEditing ? (
              <EventDetailsTemplatesSection
                selectedTemplate={selectedTemplate}
                onSelectTemplate={applyTemplateSelection}
                onClearTemplate={clearTemplateSelection}
              />
            ) : null}

            <div style={styles.field}>
              <div style={styles.fieldLabel}>Título</div>
              {quickCaptureReview?.titleNeedsReview ? (
                <div style={styles.qcInlineWarn}>
                  El título llegó con baja claridad. Ajusta una versión más
                  específica.
                </div>
              ) : null}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Cena viernes / Pádel / Médico"
                style={
                  quickCaptureReview?.titleNeedsReview
                    ? {
                        ...styles.inputLg,
                        border: "1px solid rgba(245, 158, 11, 0.36)",
                      }
                    : styles.inputLg
                }
              />
            </div>

            <div style={styles.grid2Tight}>
              <div style={styles.field}>
                <div style={styles.fieldLabel}>Inicio</div>
                {quickCaptureReview?.missingDateOrTime ? (
                  <div style={styles.qcInlineWarn}>
                    Revisa fecha/hora antes de guardar para evitar confusiones.
                  </div>
                ) : null}
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  onBlur={onAutoEnd}
                  style={
                    quickCaptureReview?.missingDateOrTime
                      ? {
                          ...styles.input,
                          border: "1px solid rgba(245, 158, 11, 0.34)",
                        }
                      : styles.input
                  }
                />
              </div>

              <div style={styles.field}>
                <div style={styles.fieldLabel}>Fin</div>
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.field}>
              <div style={styles.fieldLabel}>Ubicación</div>
              <div style={styles.locationInputRow}>
                <input
                  value={locationInput}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLocationInput(next);

                    if (
                      selectedPlace &&
                      next.trim().toLowerCase() !==
                        selectedPlace.location_label.trim().toLowerCase()
                    ) {
                      setSelectedPlace(null);
                      setEtaSeconds(null);
                    }
                  }}
                  placeholder="Busca una dirección o lugar"
                  style={styles.input}
                />
                {(locationInput || selectedPlace) && (
                  <button
                    type="button"
                    onClick={clearSelectedPlace}
                    style={styles.templateClearBtn}
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {isLoadingAutocomplete ? (
                <div style={styles.locationHint}>Buscando sugerencias…</div>
              ) : null}

              {autocompleteError ? (
                <div style={styles.locationError}>{autocompleteError}</div>
              ) : null}

              {!isLoadingAutocomplete &&
              !autocompleteError &&
              locationInput.trim().length >= 3 &&
              autocompleteResults.length === 0 &&
              !selectedPlace ? (
                <div style={styles.locationHint}>
                  No encontramos resultados para ese texto.
                </div>
              ) : null}

              {autocompleteResults.length > 0 ? (
                <div style={styles.locationResultsWrap}>
                  {autocompleteResults.map((item) => {
                    const key = `${item.place_id}-${item.lat}-${item.lng}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectPlace(item)}
                        style={styles.locationResultBtn}
                      >
                        <span style={styles.locationResultLabel}>
                          {item.label}
                        </span>
                        <span style={styles.locationResultAddress}>
                          {item.address}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {selectedPlace ? (
                <div style={styles.locationSelectedBox}>
                  <div style={styles.locationSelectedTitle}>
                    {selectedPlace.location_label}
                  </div>
                  <div style={styles.locationSelectedSub}>
                    {selectedPlace.location_address}
                  </div>
                </div>
              ) : null}
            </div>

            {selectedPlace ? (
              <div style={styles.field}>
                <div style={styles.fieldLabel}>Modo de viaje</div>
                <div style={styles.chips}>
                  {(
                    [
                      { key: "driving", label: "Auto" },
                      { key: "walking", label: "A pie" },
                      { key: "bicycling", label: "Bici" },
                      { key: "transit", label: "Transporte" },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setTravelMode(mode.key)}
                      style={{
                        ...styles.chip,
                        background:
                          travelMode === mode.key
                            ? "rgba(56,189,248,0.18)"
                            : "rgba(255,255,255,0.03)",
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedPlace ? (
              <div style={styles.travelMetaCard}>
                <div style={styles.travelMetaRow}>
                  <span style={styles.travelMetaLabel}>Estado de ruta</span>
                  <span style={styles.travelMetaValue}>
                    {travelStatusLabel}
                  </span>
                </div>

                <div style={styles.travelMetaRow}>
                  <span style={styles.travelMetaLabel}>Origen usado</span>
                  <span style={styles.travelMetaValue}>
                    {originSourceLabel}
                  </span>
                </div>

                <div style={styles.travelMetaRow}>
                  <span style={styles.travelMetaLabel}>Duración estimada</span>
                  <span style={styles.travelMetaValue}>
                    {isLoadingEta ? "Calculando…" : etaLabel || "Pendiente"}
                  </span>
                </div>

                <div style={styles.travelMetaRow}>
                  <span style={styles.travelMetaLabel}>Salida sugerida</span>
                  <span style={styles.travelMetaValue}>{leaveTimeLabel}</span>
                </div>

                {etaError ? (
                  <div style={styles.locationHint}>
                    Si Google no confirma la ruta, SyncPlans usa una estimación
                    segura para no romper el plan.
                  </div>
                ) : null}

                {mapsLinks ? (
                  <div style={styles.travelActionsRow}>
                    <a
                      href={mapsLinks.google}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.secondaryButton}
                    >
                      Google Maps
                    </a>

                    <a
                      href={mapsLinks.waze}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.secondaryButton}
                    >
                      Waze
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            {externalProposalActive && (
              <div
                style={{
                  marginBottom: 10,
                  borderRadius: 14,
                  border: "1px solid rgba(56,189,248,0.28)",
                  background: "rgba(56,189,248,0.10)",
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Nueva fecha sugerida desde fuera de la app
              </div>
            )}

            <div style={styles.quickSummary}>
              <div style={styles.quickSummaryTitle}>
                {isFirstWowMomentFlow && !isEditing
                  ? "Vista rápida antes de crear"
                  : "Así se ve ahora"}
              </div>
              <div style={styles.quickSummaryRow}>
                <span style={styles.quickSummaryPill}>
                  {isSharedProposal
                    ? proposalResponse === "adjust"
                      ? "Ajustando propuesta"
                      : "Propuesta compartida"
                    : effectiveType === "group"
                      ? "Plan compartido"
                      : "Plan personal"}
                </span>
                {durationLabel ? (
                  <span style={styles.quickSummaryPill}>{durationLabel}</span>
                ) : null}
                {dateRangeLabel ? (
                  <span style={styles.quickSummaryPill}>{dateRangeLabel}</span>
                ) : null}
                {quickCaptureReview?.missingDateOrTime ? (
                  <span
                    style={{
                      ...styles.quickSummaryPill,
                      border: "1px solid rgba(245, 158, 11, 0.30)",
                      background: "rgba(245, 158, 11, 0.10)",
                    }}
                  >
                    Revisar fecha/hora
                  </span>
                ) : null}
                {quickCaptureReview?.titleNeedsReview ? (
                  <span
                    style={{
                      ...styles.quickSummaryPill,
                      border: "1px solid rgba(245, 158, 11, 0.30)",
                      background: "rgba(245, 158, 11, 0.10)",
                    }}
                  >
                    Revisar título
                  </span>
                ) : null}
                {quickCaptureReview?.notesNeedsReview ? (
                  <span
                    style={{
                      ...styles.quickSummaryPill,
                      border: "1px solid rgba(148, 163, 184, 0.26)",
                      background: "rgba(148, 163, 184, 0.10)",
                    }}
                  >
                    Revisar notas
                  </span>
                ) : null}
              </div>

              {quickCaptureReview?.hasIssues ? (
                <div style={styles.qcReviewBox}>
                  <div style={styles.qcReviewTitle}>
                    Lo entendimos, pero conviene revisar esto antes de guardar:
                  </div>
                  <ul style={styles.qcReviewList}>
                    {quickCaptureReview.reviewItems.map((item) => (
                      <li key={item} style={styles.qcReviewItem}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div style={styles.secondaryCard}>
            <div style={styles.row}>
              <div style={styles.label}>Tipo de evento</div>
              <div style={styles.chips}>
                <button
                  type="button"
                  onClick={() => {
                    router.push(
                      buildUrl(
                        "personal",
                        new Date(startDate).toISOString(),
                        null,
                      ),
                    );
                  }}
                  style={{
                    ...styles.chip,
                    background:
                      effectiveType === "personal"
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.03)",
                  }}
                >
                  <span
                    style={{
                      ...styles.chipDot,
                      background: "rgba(250,204,21,0.95)",
                    }}
                  />
                  Personal
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const gid =
                      selectedGroupId ||
                      activeGroupId ||
                      (uniqueGroups[0]?.id ?? "");
                    router.push(
                      buildUrl(
                        "group",
                        new Date(startDate).toISOString(),
                        gid || null,
                      ),
                    );
                  }}
                  style={{
                    ...styles.chip,
                    background:
                      effectiveType === "group"
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.03)",
                  }}
                >
                  <span
                    style={{
                      ...styles.chipDot,
                      background: "rgba(96,165,250,0.95)",
                    }}
                  />
                  Grupo
                </button>
              </div>
            </div>

            {effectiveType === "group" && (
              <div style={{ ...styles.field, marginTop: 12 }}>
                <div style={styles.fieldLabel}>Grupo</div>
                {loadingGroups || booting ? (
                  <div style={styles.skeleton}>Cargando grupos…</div>
                ) : uniqueGroups.length === 0 ? (
                  <div style={styles.emptyInline}>
                    <div style={styles.emptyInlineTitle}>No tienes grupos</div>
                    <div style={styles.emptyInlineSub}>
                      El primer valor compartido empieza creando el grupo.
                      Después vuelves aquí y guardas el primer plan para activar
                      la coordinación real.
                    </div>
                    <button
                      onClick={() => router.push("/groups/new")}
                      style={styles.primaryBtnSmall}
                    >
                      Crear un grupo
                    </button>
                  </div>
                ) : (
                  <>
                    {autoSharedGroupId &&
                    !hasExplicitGroupParam &&
                    !lockedToActiveGroup ? (
                      <div
                        style={{
                          marginBottom: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(96,165,250,0.28)",
                          background: "rgba(96,165,250,0.10)",
                          padding: "10px 12px",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        Usaremos este grupo automáticamente:{" "}
                        <b>
                          {autoSharedGroupLabel ||
                            selectedGroup?.name ||
                            "Grupo compartido"}
                        </b>
                        {selectedGroup ? (
                          <>
                            {" "}
                            · tipo{" "}
                            <b>{getGroupTypeLabel(selectedGroup.type)}</b>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    {!autoSharedGroupId &&
                    isSharedProposal &&
                    !hasExplicitGroupParam &&
                    !lockedToActiveGroup &&
                    sharedGroupDetectionState === "none" ? (
                      <div
                        style={{
                          marginBottom: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.04)",
                          padding: "10px 12px",
                          fontSize: 12,
                          lineHeight: 1.45,
                          color: "rgba(255,255,255,0.82)",
                        }}
                      >
                        No encontramos un grupo compartido claro para esta
                        propuesta. Puedes elegir abajo dónde quieres guardar
                        este plan.
                      </div>
                    ) : null}

                    {!autoSharedGroupId &&
                    isSharedProposal &&
                    !groupIdParam &&
                    !lockedToActiveGroup &&
                    sharedGroupDetectionState === "ambiguous" ? (
                      <div
                        style={{
                          marginBottom: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(250,204,21,0.18)",
                          background: "rgba(250,204,21,0.08)",
                          padding: "10px 12px",
                          fontSize: 12,
                          lineHeight: 1.45,
                          color: "rgba(255,248,220,0.88)",
                        }}
                      >
                        Encontramos más de una opción posible. Para no asumir
                        mal, elige tú el grupo correcto para este plan.
                      </div>
                    ) : null}

                    {learnedGroupCandidate?.id &&
                    !canonicalGroupSuggestion?.type &&
                    !autoSharedGroupId &&
                    !groupIdParam &&
                    !lockedToActiveGroup ? (
                      <div
                        style={{
                          marginBottom: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(34,197,94,0.22)",
                          background: "rgba(34,197,94,0.10)",
                          padding: "10px 12px",
                          fontSize: 12,
                          lineHeight: 1.45,
                          color: "rgba(235,255,241,0.90)",
                        }}
                      >
                        🧠 Referencia por historial: en planes parecidos
                        normalmente terminas usando{" "}
                        <b>
                          {learnedGroupCandidate.name ||
                            getGroupTypeLabel(learnedGroupCandidate.type)}
                        </b>
                        . Te lo mostramos como ayuda, sin forzarlo.
                      </div>
                    ) : null}

                    {canonicalGroupSuggestion?.type &&
                    !autoSharedGroupId &&
                    !groupIdParam &&
                    !lockedToActiveGroup ? (
                      <div
                        style={{
                          marginBottom: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(56,189,248,0.20)",
                          background: "rgba(56,189,248,0.08)",
                          padding: "10px 12px",
                          fontSize: 12,
                          lineHeight: 1.45,
                          color: "rgba(226,242,255,0.88)",
                        }}
                      >
                        {canonicalGroupSuggestion.mode === "auto_apply" &&
                        suggestedPreselectedGroupId &&
                        selectedGroup?.id === suggestedPreselectedGroupId ? (
                          <>
                            ✨ Preseleccionamos{" "}
                            <b>
                              {canonicalGroupSuggestion.type === "pair"
                                ? "Pareja"
                                : canonicalGroupSuggestion.type === "family"
                                  ? "Familia"
                                  : "Compartido"}
                            </b>{" "}
                            porque la sugerencia es suficientemente clara. Si
                            esta vez no aplica, puedes cambiarlo abajo.
                          </>
                        ) : canonicalGroupSuggestion.mode === "suggest_only" ? (
                          <>
                            💡 Sugerencia: este plan parece encajar mejor en{" "}
                            <b>
                              {canonicalGroupSuggestion.type === "pair"
                                ? "Pareja"
                                : canonicalGroupSuggestion.type === "family"
                                  ? "Familia"
                                  : "Compartido"}
                            </b>
                            . Te lo mostramos como sugerencia, sin forzarlo.
                          </>
                        ) : (
                          <>
                            🤔 Hay señales, pero no son lo bastante fuertes para
                            decidir solas. Revísalo antes de guardar.
                          </>
                        )}
                      </div>
                    ) : null}

                    <select
                      value={selectedGroupId}
                      disabled={
                        lockedToActiveGroup ||
                        (!!autoSharedGroupId && !hasExplicitGroupParam)
                      }
                      onChange={(e) => {
                        groupManualSelectionRef.current = true;
                        setSuggestedPreselectedGroupId("");
                        setSelectedGroupId(e.target.value);
                      }}
                      style={{
                        ...styles.select,
                        opacity:
                          lockedToActiveGroup ||
                          (!!autoSharedGroupId && !hasExplicitGroupParam)
                            ? 0.7
                            : 1,
                        cursor:
                          lockedToActiveGroup ||
                          (!!autoSharedGroupId && !hasExplicitGroupParam)
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {uniqueGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name ?? "Grupo"} ({getGroupTypeLabel(g.type)})
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {selectedGroup ? (
                  <div style={styles.hint}>
                    Seleccionado: <b>{selectedGroup.name ?? "Grupo"}</b> · tipo{" "}
                    <b>{getGroupTypeLabel(selectedGroup.type)}</b>
                    {lockedToActiveGroup ? (
                      <span style={{ marginLeft: 8, opacity: 0.9 }}>
                        · (grupo activo)
                      </span>
                    ) : autoSharedGroupId && !hasExplicitGroupParam ? (
                      <span style={{ marginLeft: 8, opacity: 0.9 }}>
                        · (detectado automáticamente)
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            <div style={styles.field}>
              <div style={styles.fieldLabel}>Notas (opcional)</div>
              {quickCaptureReview?.notesNeedsReview ? (
                <div style={styles.qcInlineWarnSoft}>
                  Si agregas una línea de contexto, el plan queda más claro para
                  todos.
                </div>
              ) : null}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={
                  quickCaptureReview?.notesNeedsReview
                    ? {
                        ...styles.textarea,
                        border: "1px solid rgba(148, 163, 184, 0.30)",
                      }
                    : styles.textarea
                }
                rows={3}
                placeholder="Añade un poco de contexto si realmente ayuda."
              />
            </div>
          </div>

          {errors.length > 0 && (
            <div style={styles.errorBox}>
              <div style={styles.errorTitle}>Antes de guardar:</div>
              <ul style={styles.errorList}>
                {errors.map((e) => (
                  <li key={e} style={styles.errorItem}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {postSaveActions?.visible ? (
            <PostSaveActionsCard
              visible={postSaveActions.visible}
              isProposal={postSaveActions.isProposal}
              isShared={postSaveActions.isShared}
              title={postSaveActions.title}
              proposalResponse={proposalResponse}
              sharingPostSave={sharingPostSave}
              postSaveShareUrl={postSaveShareUrl}
              onViewCalendar={() => router.push("/calendar")}
              onShare={handleSharePostSave}
              onCreateAnother={handleCreateAnotherSimilar}
              onCopyLink={async () => {
                if (!postSaveShareUrl) return;
                try {
                  await navigator.clipboard.writeText(postSaveShareUrl);
                  setToast({
                    title: "Link copiado ✅",
                    subtitle: "Ya puedes compartirlo donde quieras.",
                  });
                } catch {
                  setToast({
                    title: "No se pudo copiar",
                    subtitle: "Cópialo manualmente desde aquí.",
                  });
                }
              }}
              onCloseShareUrl={() => setPostSaveShareUrl(null)}
            />
          ) : null}
        </section>

        <section style={styles.footerRow}>
          <button
            onClick={isSharedProposal ? handleReviewProposalLater : goBack}
            style={styles.ghostBtnWide}
          >
            {isSharedProposal ? "Revisar luego" : "← Volver"}
          </button>
          <button
            onClick={save}
            style={{ ...styles.primaryBtnWide, opacity: canSave ? 1 : 0.6 }}
            disabled={!canSave}
          >
            {saving
              ? "Guardando…"
              : isEditing
                ? "Guardar cambios"
                : isSharedProposal
                  ? proposalResponse === "adjust"
                    ? "Guardar propuesta ajustada"
                    : "Aceptar propuesta"
                  : effectiveType === "group"
                    ? isFirstWowMomentFlow && !isEditing
                      ? "Crear primer plan compartido"
                      : "Guardar plan compartido"
                    : "Guardar plan"}
          </button>
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
  shell: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "22px 18px 48px",
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
    minWidth: 260,
    maxWidth: 360,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.72)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: {
    fontWeight: 900,
    fontSize: 13,
  },
  toastSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 650,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  hero: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 12,
  },
  heroLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  heroKicker: {
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
  heroTitleRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  h1: {
    margin: 0,
    fontSize: 28,
    letterSpacing: "-0.6px",
  },
  heroSub: {
    fontSize: 13,
    opacity: 0.75,
    maxWidth: 520,
    lineHeight: 1.4,
  },
  heroMetaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },
  heroMetaPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(255,255,255,0.88)",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    fontSize: 12,
    fontWeight: 900,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  heroRight: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  proposalBanner: {
    marginBottom: 12,
    padding: "14px 16px",
    borderRadius: 18,
    border: "1px solid rgba(56,189,248,0.22)",
    background: "rgba(56,189,248,0.10)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
  },
  proposalBannerEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 900,
    color: "rgba(125,211,252,0.95)",
  },
  proposalBannerTitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: "rgba(226,242,255,0.96)",
  },
  proposalBannerSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.82)",
  },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
  },
  primaryStack: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  sectionIntro: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  sectionEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.65,
    fontWeight: 900,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  sectionSub: {
    fontSize: 13,
    opacity: 0.72,
    lineHeight: 1.45,
    maxWidth: 560,
  },
  templatePreview: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.025)",
    padding: 12,
    display: "grid",
    gap: 6,
  },
  templatePreviewLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.68,
    fontWeight: 900,
  },
  templatePreviewTitle: {
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.2,
  },
  templatePreviewMeta: {
    fontSize: 13,
    lineHeight: 1.4,
    opacity: 0.78,
  },
  secondaryCard: {
    marginTop: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.025)",
    padding: 14,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  label: {
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 800,
  },
  chips: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    cursor: "pointer",
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: 900,
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  field: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    width: "100%",
  },
  fieldLabel: {
    fontSize: 12,
    opacity: 0.8,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    fontSize: 14,
  },
  inputLg: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "14px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(6,10,20,0.62)",
    color: "rgba(255,255,255,0.95)",
    outline: "none",
    fontSize: 15,
    fontWeight: 700,
  },
  locationInputRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  locationHint: {
    fontSize: 12,
    opacity: 0.72,
  },
  locationError: {
    fontSize: 12,
    color: "rgba(248,113,113,0.95)",
    fontWeight: 700,
  },
  locationResultsWrap: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.68)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  locationResultBtn: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "transparent",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    textAlign: "left" as const,
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  locationResultLabel: {
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  locationResultAddress: {
    fontSize: 12,
    opacity: 0.74,
    lineHeight: 1.35,
  },
  locationSelectedBox: {
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.26)",
    background: "rgba(56,189,248,0.10)",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  locationSelectedTitle: {
    fontSize: 13,
    fontWeight: 900,
  },
  locationSelectedSub: {
    fontSize: 12,
    opacity: 0.82,
  },
  travelMetaCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  travelMetaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  travelMetaLabel: {
    fontSize: 12,
    opacity: 0.74,
    fontWeight: 800,
  },
  travelMetaValue: {
    fontSize: 13,
    fontWeight: 900,
  },
  travelActionsRow: {
    display: "flex",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  secondaryButton: {
    flex: 1,
    minWidth: 130,
    textAlign: "center",
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 13,
    fontWeight: 900,
    textDecoration: "none",
  },
  textarea: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    fontSize: 14,
    resize: "vertical",
  },
  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    fontSize: 14,
  },
  skeleton: {
    padding: 14,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.02)",
    opacity: 0.75,
    fontSize: 13,
  },
  emptyInline: {
    padding: 14,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.02)",
  },
  emptyInlineTitle: {
    fontWeight: 900,
    fontSize: 13,
  },
  emptyInlineSub: {
    marginTop: 6,
    opacity: 0.75,
    fontSize: 12,
  },
  primaryBtnSmall: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },
  hint: {
    fontSize: 12,
    opacity: 0.72,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  grid2Tight: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
    width: "100%",
  },
  quickSummary: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.025)",
    padding: 12,
  },
  quickSummaryTitle: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.78,
    marginBottom: 10,
  },
  quickSummaryRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  quickSummaryPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 12,
    fontWeight: 850,
  },
  errorBox: {
    marginTop: 14,
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(248,113,113,0.10)",
    padding: 12,
  },
  errorTitle: {
    fontWeight: 900,
    fontSize: 12,
    marginBottom: 8,
  },
  errorList: {
    margin: 0,
    paddingLeft: 16,
  },
  errorItem: {
    fontSize: 12,
    opacity: 0.9,
    marginBottom: 4,
  },
  footerRow: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 800,
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
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
  },
  primaryBtnWide: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 240,
  },
  templatePreviewTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  templateClearBtn: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.86)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },
};