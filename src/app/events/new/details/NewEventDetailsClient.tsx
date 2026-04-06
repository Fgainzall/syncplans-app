"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import SharedConflictPreflightModal from "@/components/ConflictPreflightModal";
import EventTemplatePicker from "@/components/events/EventTemplatePicker";
import type { EventTemplate } from "@/lib/eventTemplates";
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

// ✅ DB real (RLS)
import {
  getMyGroups,
  getGroupTypeLabel,
  getSharedGroupBetweenUsers,
} from "@/lib/groupsDb";

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
  learnedGroupMatch as readLearnedGroupMatch,
  learnGroupSelection,
} from "@/lib/groupLearning";
/* Helpers */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toInputLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
    d.getDate()
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

type DbGroup = {
  id: string;
  name: string | null;
  type: "family" | "pair" | "other" | string;
};

function normalizeDbGroupType(value: unknown): GroupType {
  const t = String(value ?? "").toLowerCase();

  if (t === "family") return "family";
  if (t === "other" || t === "shared") return "other" as GroupType;
  if (t === "pair" || t === "couple") return "pair";
  return "personal";
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


type GroupSuggestion = {
  type: "pair" | "family" | "other" | null;
  confidence: number;
  reason?: string;
};

const PAIR_KEYWORDS = [
  "cena",
  "salida",
  "salir",
  "date",
  "aniversario",
  "película",
  "pelicula",
  "cine",
  "comer",
  "desayuno juntos",
  "almuerzo juntos",
  "con fer",
  "con ara",
];

const FAMILY_KEYWORDS = [
  "familia",
  "mamá",
  "mama",
  "papá",
  "papa",
  "cumple",
  "cumpleaños",
  "almuerzo familiar",
  "reunión familiar",
  "reunion familiar",
  "abuelos",
  "tíos",
  "tios",
  "primos",
];

const OTHER_KEYWORDS = [
  "pádel",
  "padel",
  "fútbol",
  "futbol",
  "fulbito",
  "amigos",
  "asado",
  "reunión",
  "reunion",
  "partido",
  "after",
  "previa",
];

function scoreSuggestion(text: string, keywords: string[]) {
  let hits = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) hits += 1;
  }
  return hits;
}

function suggestGroupFromText(title: string, notes?: string): GroupSuggestion {
  const text = `${title} ${notes ?? ""}`.toLowerCase().trim();

  if (!text) return { type: null, confidence: 0 };

  const pairScore = scoreSuggestion(text, PAIR_KEYWORDS);
  const familyScore = scoreSuggestion(text, FAMILY_KEYWORDS);
  const otherScore = scoreSuggestion(text, OTHER_KEYWORDS);

  const max = Math.max(pairScore, familyScore, otherScore);

  if (max === 0) {
    return { type: null, confidence: 0 };
  }

  const leaders = [
    { type: "pair" as const, score: pairScore, reason: "Parece un plan de pareja" },
    { type: "family" as const, score: familyScore, reason: "Parece un plan familiar" },
    { type: "other" as const, score: otherScore, reason: "Parece un plan compartido" },
  ].filter((item) => item.score === max);

  if (leaders.length !== 1) {
    return { type: null, confidence: max };
  }

  return {
    type: leaders[0].type,
    confidence: leaders[0].score,
    reason: leaders[0].reason,
  };
}

function getConflictCounterpart(
  conflict: ReturnType<typeof computeVisibleConflicts>[number],
  candidateId: string
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
  s: NotificationSettings | null
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
  choice: Exclude<PreflightChoice, "edit">
): string {
  if (choice === "keep_existing") return "keep_existing";
  if (choice === "replace_with_new") return "replace_with_new";
  return "keep_both";
}

function finalActionFromPreflightChoice(
  choice: Exclude<PreflightChoice, "edit">
): string {
  if (choice === "keep_existing") return "keep_existing";
  if (choice === "replace_with_new") return "replace_with_new";
  return "keep_both";
}

function humanizeActionError(
  err: unknown,
  fallback = "Intenta nuevamente."
) {
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
  const proposalEventIdParam =
    sp.get("proposal_event_id") || sp.get("proposalEventId") || "";

  const eventIdParam = sp.get("eventId") || sp.get("edit") || sp.get("id");
  const isEditing = !!eventIdParam;

  const typeParam = (sp.get("type") || "personal") as NewType;
  const dateParam = sp.get("date");
  const groupIdParam = sp.get("groupId");

  const initialStart = useMemo(() => {
    const base = dateParam ? new Date(dateParam) : new Date();
    const d = new Date(base);
    d.setSeconds(0, 0);
    const m = d.getMinutes();
    const rounded = Math.ceil(m / 15) * 15;
    d.setMinutes(rounded % 60);
    if (rounded >= 60) d.setHours(d.getHours() + 1);
    return d;
  }, [dateParam]);

  const [selectedTemplate, setSelectedTemplate] =
    useState<EventTemplate | null>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startLocal, setStartLocal] = useState(() => toInputLocal(initialStart));
  const [endLocal, setEndLocal] = useState(() =>
    toInputLocal(addMinutes(initialStart, 60))
  );

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
    groupIdParam || ""
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

  const uniqueGroups = useMemo(() => {
    const map = new Map<string, DbGroup>();
    for (const g of groups || []) map.set(g.id, g);
    return Array.from(map.values());
  }, [groups]);

  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightItems, setPreflightItems] = useState<PreflightConflict[]>([]);
  const [preflightDefaultChoice, setPreflightDefaultChoice] =
    useState<PreflightChoice>("edit");
  const [pendingPayload, setPendingPayload] = useState<null | {
    groupType: GroupType;
    groupId: string | null;
    title: string;
    notes?: string;
    startIso: string;
    endIso: string;
  }>(null);
  const [existingIdsToReplace, setExistingIdsToReplace] = useState<string[]>(
    []
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

  const startDate = useMemo(() => fromInputLocal(startLocal), [startLocal]);
  const endDate = useMemo(() => fromInputLocal(endLocal), [endLocal]);

  const selectedGroup = useMemo(
    () => uniqueGroups.find((g) => g.id === selectedGroupId) || null,
    [uniqueGroups, selectedGroupId]
  );

  function buildUrl(
    nextType: NewType,
    nextDateIso: string,
    nextGroupId?: string | null
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

    if (quickCaptureParam === "1") params.set("qc", "1");
    if (quickCaptureTitleParam) params.set("title", quickCaptureTitleParam);
    if (quickCaptureDurationParam) params.set("duration", quickCaptureDurationParam);
    if (quickCaptureNotesParam) params.set("notes", quickCaptureNotesParam);
    if (captureSourceParam) params.set("capture_source", captureSourceParam);
    if (rawTextParam) params.set("raw_text", rawTextParam);

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

        let preferredGroupId = groupIdParam || "";
        let detectedSharedGroupLabel = "";

        if (!preferredGroupId && isSharedProposal && proposalEventIdParam) {
          try {
            const proposalEvent = await getEventById(proposalEventIdParam);
            const proposalOwnerId = resolveEventOwnerId(proposalEvent);

            if (proposalOwnerId && proposalOwnerId !== uid) {
              const sharedGroupResult = await getSharedGroupBetweenUsers(
                proposalOwnerId,
                uid
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
              sharedGroupError
            );
            setSharedGroupDetectionState("ambiguous");
          }
        } else if (isSharedProposal) {
          setSharedGroupDetectionState("none");
        }

        const fallbackGroupId =
          preferredGroupId || gid || (unique && unique.length ? unique[0].id : "");

        if (preferredGroupId) {
          setAutoSharedGroupId(preferredGroupId);
          setAutoSharedGroupLabel(detectedSharedGroupLabel);
          setSharedGroupDetectionState("matched");
        } else {
          setAutoSharedGroupId("");
          setAutoSharedGroupLabel("");
        }

        if (fallbackGroupId) setSelectedGroupId(fallbackGroupId);

        const shouldAutoRouteToGroup =
          (typeParam === "group" && !groupIdParam) ||
          (!!preferredGroupId && isSharedProposal && typeParam !== "group");

        if (shouldAutoRouteToGroup) {
          const next = buildUrl(
            "group",
            new Date(startDate).toISOString(),
            fallbackGroupId
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

      setTitle(ev.title ?? "");
      setNotes(ev.notes ?? "");

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
    if (isEditing) return;
    if (quickCaptureHydratedRef.current) return;
    if (quickCaptureParam !== "1") return;

    const incomingTitle = String(quickCaptureTitleParam ?? "").trim();
    const incomingDuration = Number(quickCaptureDurationParam ?? "60");
    const safeDuration = Number.isFinite(incomingDuration) && incomingDuration >= 15
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
    if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
      setStartLocal(toInputLocal(parsedDate));
      setEndLocal(toInputLocal(addMinutes(parsedDate, safeDuration)));
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
    if (groupIdParam) return;
    if (selectedGroupId === autoSharedGroupId) return;
    setSelectedGroupId(autoSharedGroupId);
  }, [
    effectiveType,
    autoSharedGroupId,
    lockedToActiveGroup,
    groupIdParam,
    selectedGroupId,
  ]);

  useEffect(() => {
    if (effectiveType !== "group") return;
    if (!selectedGroupId) return;
    const next = buildUrl(
      "group",
      new Date(startDate).toISOString(),
      selectedGroupId
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
      return "Estás ajustando una propuesta compartida antes de guardarla.";
    }

    if (isSharedProposal) {
      return "Estás respondiendo a una propuesta compartida. Puedes aceptarla tal cual o ajustarla antes de guardarla.";
    }

    if (effectiveType === "group") {
      const groupName = selectedGroup?.name ?? "Grupo";
      return `Se compartirá con ${groupName}.`;
    }
    return "Solo aparecerá en tu calendario.";
  }, [effectiveType, selectedGroup, isSharedProposal, proposalResponse]);

const learnedGroupMatch = useMemo(() => {
  if (effectiveType !== "group") return null;
  if (autoSharedGroupId) return null;
  if (sharedGroupDetectionState === "matched") return null;

  const match = readLearnedGroupMatch(title);
  if (!match?.groupId) return null;

  const existsInAvailableGroups = uniqueGroups.some(
    (group) => group.id === match.groupId
  );

  if (!existsInAvailableGroups) return null;

  return match;
}, [
  effectiveType,
  autoSharedGroupId,
  sharedGroupDetectionState,
  title,
  uniqueGroups,
]);

  const learnedGroupCandidate = useMemo(() => {
    if (!learnedGroupMatch?.groupId) return null;

    return (
      uniqueGroups.find((group) => group.id === learnedGroupMatch.groupId) || null
    );
  }, [learnedGroupMatch, uniqueGroups]);

  const groupSuggestion = useMemo(() => {
    if (effectiveType !== "group") return null;
    if (autoSharedGroupId) return null;
    if (sharedGroupDetectionState === "matched") return null;
    if (learnedGroupCandidate?.id) return null;

    const suggestion = suggestGroupFromText(title, notes);
    if (!suggestion.type || suggestion.confidence <= 0) return null;

    return suggestion;
  }, [
    effectiveType,
    autoSharedGroupId,
    sharedGroupDetectionState,
    learnedGroupCandidate,
    title,
    notes,
  ]);

  const suggestedGroupCandidate = useMemo(() => {
    if (learnedGroupCandidate?.id) return learnedGroupCandidate;
    if (!groupSuggestion?.type) return null;

    const compatibleGroups = uniqueGroups.filter(
      (group) => normalizeDbGroupType(group.type) === groupSuggestion.type
    );

    if (!compatibleGroups.length) return null;

    return (
      compatibleGroups.find((group) => group.id === activeGroupId) ||
      compatibleGroups[0] ||
      null
    );
  }, [learnedGroupCandidate, groupSuggestion, uniqueGroups, activeGroupId]);

  useEffect(() => {
    if (effectiveType !== "group") {
      setSuggestedPreselectedGroupId("");
      return;
    }
    if (lockedToActiveGroup) {
      setSuggestedPreselectedGroupId("");
      return;
    }
    if (groupIdParam) {
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

    setSuggestedPreselectedGroupId(suggestedGroupCandidate.id);

    if (selectedGroupId !== suggestedGroupCandidate.id) {
      setSelectedGroupId(suggestedGroupCandidate.id);
    }
  }, [
    effectiveType,
    lockedToActiveGroup,
    groupIdParam,
    autoSharedGroupId,
    sharedGroupDetectionState,
    suggestedGroupCandidate,
    selectedGroupId,
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
    [effectiveType, selectedGroupId, title, notes, startLocal, endLocal]
  );

  const shouldLearnCurrentSelection = useMemo(() => {
    if (effectiveType !== "group") return false;
    if (!selectedGroup?.id) return false;
    if (!title.trim()) return false;

    const normalizedType = normalizeDbGroupType(selectedGroup.type);
    return (
      normalizedType === "pair" ||
      normalizedType === "family" ||
      normalizedType === "other"
    );
  }, [effectiveType, selectedGroup, title]);

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
  }, [currentPostSaveFingerprint, postSaveFingerprint, postSaveActions?.visible]);

  const goBack = () => router.push("/calendar");

  const handleReviewProposalLater = () => {
    setToast({
      title: "Propuesta pendiente",
      subtitle: "No guardamos nada. Puedes volver más tarde desde el link compartido.",
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
              ? "Guardamos tu versión ajustada y conservamos ambos horarios para que puedas revisarlos luego."
              : "Se guardó el plan y conservamos ambos horarios para que puedas revisarlos luego.",
        };
      }

      return {
        title:
          proposalResponse === "adjust"
            ? "Propuesta ajustada ✅"
            : "Propuesta aceptada ✅",
        subtitle:
          proposalResponse === "adjust"
            ? "Ya guardaste tu versión ajustada del plan y puedes seguir afinándola cuando quieras."
            : "Ya la llevaste a tu calendario y puedes seguir ajustándola cuando quieras.",
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
          ? "Conservamos ambos planes y volvemos al calendario."
          : "Conservamos ambos eventos y volvemos al calendario.",
      };
    }

    if (isSharedEvent) {
      return {
        title: isEditing
          ? "Plan compartido actualizado ✅"
          : "Plan compartido creado ✅",
        subtitle: isEditing
          ? "El grupo ya verá la versión actualizada."
          : "Ya está en el calendario del grupo.",
      };
    }

    return {
      title: isEditing
        ? "Evento personal actualizado ✅"
        : "Evento personal creado ✅",
      subtitle: isEditing
        ? "Tus cambios ya quedaron guardados."
        : "Ya quedó en tu calendario.",
    };
  };

  const writePreflightResolutionLogs = async (input: {
    items: PreflightConflict[];
    payload: {
      groupType: GroupType;
      groupId: string | null;
      title: string;
      notes?: string;
      startIso: string;
      endIso: string;
    };
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
        })
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
            (existingEvent as any)?.title ?? item.title
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

  const doSave = async (
    payload: {
      groupType: GroupType;
      groupId: string | null;
      title: string;
      notes?: string;
      startIso: string;
      endIso: string;
    },
    options?: { suppressConflictRedirect?: boolean }
  ) => {
    if (saveInFlightRef.current) return null;

    saveInFlightRef.current = true;
    setSaving(true);

    try {
      let savedEventId: string | null = null;

if (isEditing && eventIdParam) {
  await updateEvent({
    id: eventIdParam,
    title: payload.title,
    notes: payload.notes,
    start: payload.startIso,
    end: payload.endIso,
    groupId: payload.groupId,
  });

  savedEventId = String(eventIdParam);

  console.log("EVENT EDITED ID", savedEventId);

  if (currentUserId && savedEventId) {
    const analyticsPayload = {
      user_id: currentUserId,
      event_type: "event_edited",
      entity_id: savedEventId,
      metadata: {
        type: payload.groupId ? "group" : "personal",
      },
    };

    console.log("TRACK EVENT EDITED DIRECT", analyticsPayload);

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
  });
  savedEventId = created?.id ? String(created.id) : null;

  console.log("EVENT CREATED ID", created?.id);
  console.log("TRACK EVENT CREATED", payload);

  if (savedEventId && isSharedProposal && proposalResponse && currentUserId) {
    try {
      await upsertProposalResponse({
        eventId: savedEventId,
        userId: currentUserId,
        response: proposalResponse === "adjust" ? "adjusted" : "accepted",
      });

      console.log("PROPOSAL RESPONSE SAVED", {
        eventId: savedEventId,
        userId: currentUserId,
        response: proposalResponse,
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
  learnGroupSelection(
    title,
    selectedGroup.id,
    normalizeDbGroupType(selectedGroup.type) as "pair" | "family" | "other"
  );
}

      emitSyncPlansRefreshSignals();

      const conflictResult = savedEventId
        ? await createConflictNotificationForEvent(savedEventId).catch(() => ({
            created: 0,
            conflictCount: 0,
            targetEventId: savedEventId,
          }))
        : {
            created: 0,
            conflictCount: 0,
            targetEventId: null,
          };

      if (options?.suppressConflictRedirect && savedEventId) {
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
            const savedId = String(savedEventId);
            return (
              String(c.existingEventId) === savedId ||
              String(c.incomingEventId) === savedId
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
        if (savedEventId) qp.set("eventId", String(savedEventId));
        if (payload.groupId) qp.set("groupId", String(payload.groupId));

        window.setTimeout(() => {
          router.push(`/summary?${qp.toString()}`);
        }, 500);

        return savedEventId;
      }

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

      setToast(buildSuccessToast());
      setPostSaveShareUrl(null);
      setPostSaveFingerprint(currentPostSaveFingerprint);
      setPostSaveActions({
        visible: true,
        eventId: savedEventId ?? undefined,
        title: payload.title,
        isShared: effectiveType === "group",
        isProposal: isSharedProposal,
      });

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

  const preflight = async (payload: {
    groupType: GroupType;
    groupId: string | null;
    title: string;
    notes?: string;
    startIso: string;
    endIso: string;
  }): Promise<{ ok: true } | { ok: false }> => {
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
            range: otherEvent ? fmtRange(otherEvent.start, otherEvent.end) : "—",
            overlapStart: c.overlapStart,
            overlapEnd: c.overlapEnd,
          };
        })
        .filter(Boolean) as PreflightConflict[];

      setExistingIdsToReplace(
        Array.from(new Set(items.map((x) => String(x.existingId)).filter(Boolean)))
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
    if (saving || saveInFlightRef.current || preflightChoiceInFlightRef.current) return;

    clearPreflightState();
    clearPostSaveState({ keepToast: true });

    if (!canSave) {
      setToast({
        title: "Revisa el formulario",
        subtitle: errors[0],
      });
      return;
    }

    const payload = {
      groupType,
      groupId: effectiveType === "group" ? selectedGroupId : null,
      title: title.trim(),
      notes: notes.trim() ? notes.trim() : undefined,
      startIso: new Date(startDate).toISOString(),
      endIso: new Date(endDate).toISOString(),
    };

    setPendingPayload(payload);
    const pf = await preflight(payload);
    if (!(pf as any).ok) return;

    await doSave(payload);
  };

  const onPreflightChoose = async (choice: PreflightChoice) => {
    setPreflightOpen(false);

    if (choice === "edit") {
      clearPreflightState();
      setToast({
        title: "Ok",
        subtitle: "Ajusta horario/título y vuelve a guardar.",
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

      try {
        const ids = itemsSnapshot.map((it) => it.id).filter(Boolean);
        ignoreConflictIds(ids);
      } catch {
        // ok
      }

      clearPreflightState();

      const savedEventId = await doSave(payloadToSave, {
        suppressConflictRedirect: true,
      });

      await writePreflightResolutionLogs({
        items: itemsSnapshot,
        payload: payloadToSave,
        choice: "keep_both",
        finalAction: finalActionFromPreflightChoice("keep_both"),
        savedEventId: savedEventId ?? null,
        blockedIds: [],
        reason: null,
      });

      return;
    }

    setSaving(true);
    try {
      const payloadToSave = pendingPayload;
      const itemsSnapshot = [...preflightItems];
      const idsToReplaceSnapshot = [...existingIdsToReplace];
      const deleteResult = await deleteEventsByIdsDetailed(idsToReplaceSnapshot);

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

        clearPreflightState();

        setToast({
          title: "Aplicado con ajuste automático",
          subtitle:
            "No pudimos reemplazar todos los eventos por permisos. Mantuvimos ambos para evitar inconsistencias.",
        });
        window.setTimeout(() => setToast(null), 3200);

        const savedEventId = await doSave(payloadToSave, {
          suppressConflictRedirect: true,
        });

        await writePreflightResolutionLogs({
          items: itemsSnapshot,
          payload: payloadToSave,
          choice: "replace_with_new",
          finalAction: "fallback_keep_both",
          savedEventId: savedEventId ?? null,
          blockedIds,
          reason:
            "No se pudieron eliminar todos los eventos en conflicto por permisos. SyncPlans aplicó fallback automático y mantuvo ambos.",
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
          console.error("preflight conflict decision notifications failed", error);
        }
        return;
      }

      clearPreflightState();

      const savedEventId = await doSave(payloadToSave);

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
        console.error("preflight conflict decision notifications failed", error);
      }
      return;
    } catch (err: any) {
      setToast({
        title: "No se pudo aplicar",
        subtitle: humanizeActionError(err, "Intenta nuevamente."),
      });
      window.setTimeout(() => setToast(null), 2800);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  const handleSharePostSave = async () => {
    if (sharingPostSave) return;

    try {
      if (!postSaveActions?.eventId) {
        setToast({
          title: "No se pudo compartir",
          subtitle: "Todavía no encontré el evento que acabas de guardar.",
        });
        return;
      }

      setSharingPostSave(true);

      const invite = await getOrCreatePublicInvite({
        eventId: postSaveActions.eventId,
      });

      const token =
        typeof invite === "string" ? invite : invite?.token || invite?.id || null;

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
          : null
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

        <section
          style={{
            ...styles.hero,
            borderColor: theme.border,
            background: `linear-gradient(180deg, ${theme.soft}, rgba(255,255,255,0.03))`,
          }}
        >
          <div style={styles.heroLeft}>
            <div style={styles.heroKicker}>{isEditing ? "Editar" : "Nuevo"}</div>
            <div style={styles.heroTitleRow}>
              <h1 style={styles.h1}>{theme.label}</h1>
              <span style={styles.pill}>
                <span style={{ ...styles.pillDot, background: meta.dot }} />
                {meta.label}
              </span>
            </div>
            <div style={styles.heroSub}>
              {isSharedProposal
                ? proposalResponse === "adjust"
                  ? "Estás ajustando una propuesta compartida antes de guardarla. Revisa los detalles y deja tu versión final lista."
                  : "Estás revisando una propuesta compartida. Puedes aceptarla tal cual o ajustarla antes de guardarla."
                : "Crea el evento en pocos segundos. SyncPlans revisa conflictos antes de guardarlo para que no pierdas el hilo."}
              <div style={styles.heroMetaRow}>
                <span style={styles.heroMetaPill}>{summaryLine}</span>
                {isSharedProposal ? (
                  <span style={styles.heroMetaPill}>
                    {proposalResponse === "adjust"
                      ? "Ajustando propuesta"
                      : "Propuesta compartida"}
                  </span>
                ) : null}
                {durationLabel ? (
                  <span style={styles.heroMetaPill}>Duración: {durationLabel}</span>
                ) : null}
              </div>
              {lockedToActiveGroup ? (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                  Este evento se compartirá automáticamente con tu grupo activo.
                </div>
              ) : null}
            </div>
          </div>

          <div style={styles.heroRight}>
            {isSharedProposal ? (
              <button onClick={handleReviewProposalLater} style={styles.ghostBtn}>
                Revisar luego
              </button>
            ) : (
              <button onClick={goBack} style={styles.ghostBtn}>
                Cancelar
              </button>
            )}
            <button
              onClick={save}
              style={{ ...styles.primaryBtn, opacity: canSave ? 1 : 0.6 }}
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
                : "Guardar"}
            </button>
          </div>
        </section>

        {isSharedProposal ? (
          <section style={styles.proposalBanner}>
            <div style={styles.proposalBannerEyebrow}>
              {proposalResponse === "adjust"
                ? "Ajustando propuesta"
                : "Propuesta compartida"}
            </div>
            <div style={styles.proposalBannerTitle}>
              {proposalResponse === "adjust"
                ? "Estás preparando tu versión ajustada de esta propuesta"
                : "Estás respondiendo a una idea que te compartieron"}
            </div>
            <div style={styles.proposalBannerSub}>
              {proposalResponse === "adjust"
                ? "Cambia título, horario o notas y guarda tu versión final del plan."
                : "Revisa título, horario y notas. Si te cuadra, acéptala y guárdala; si no, ajústala antes de crear el plan."}
            </div>
          </section>
        ) : null}

        <section style={styles.card}>
          <div style={styles.primaryStack}>
            <div style={styles.sectionIntro}>
              <div style={styles.sectionEyebrow}>Lo esencial</div>
              <div style={styles.sectionTitle}>Primero, lo importante</div>
              <div style={styles.sectionSub}>
                Título, horario y guardar. Lo demás queda visible pero sin meter
                ruido.
              </div>
            </div>

            {!isEditing ? (
              <>
                <EventTemplatePicker
                  selectedTemplateId={selectedTemplate?.id ?? null}
                  onSelect={applyTemplateSelection}
                />
                {selectedTemplate ? (
                  <div style={styles.templatePreview}>
                    <div style={styles.templatePreviewTop}>
                      <div style={styles.templatePreviewLabel}>
                        Template elegido
                      </div>

                      <button
                        type="button"
                        onClick={clearTemplateSelection}
                        style={styles.templateClearBtn}
                      >
                        Empezar desde cero
                      </button>
                    </div>

                    <div style={styles.templatePreviewTitle}>
                      {selectedTemplate.emoji} {selectedTemplate.title}
                    </div>

                    <div style={styles.templatePreviewMeta}>
                      Duración sugerida: {selectedTemplate.defaultDurationMinutes} min
                      {selectedTemplate.defaultNotes
                        ? ` · ${selectedTemplate.defaultNotes}`
                        : ""}
                      {" · "}El formulario ya fue precargado y puedes ajustarlo libremente.
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            <div style={styles.field}>
              <div style={styles.fieldLabel}>Título</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Cena / Pádel / Médico"
                style={styles.inputLg}
              />
            </div>

            <div style={styles.grid2Tight}>
              <div style={styles.field}>
                <div style={styles.fieldLabel}>Inicio</div>
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  onBlur={onAutoEnd}
                  style={styles.input}
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
                Nueva fecha sugerida desde invitación externa
              </div>
            )}

            <div style={styles.quickSummary}>
              <div style={styles.quickSummaryTitle}>Resumen rápido</div>
              <div style={styles.quickSummaryRow}>
                <span style={styles.quickSummaryPill}>
                  {isSharedProposal
                    ? proposalResponse === "adjust"
                      ? "Propuesta ajustándose"
                      : "Propuesta"
                    : effectiveType === "group"
                    ? "Compartido"
                    : "Personal"}
                </span>
                {durationLabel ? (
                  <span style={styles.quickSummaryPill}>{durationLabel}</span>
                ) : null}
                {dateRangeLabel ? (
                  <span style={styles.quickSummaryPill}>{dateRangeLabel}</span>
                ) : null}
              </div>
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
                        null
                      )
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
                        gid || null
                      )
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
                      Crea uno para poder hacer eventos compartidos.
                    </div>
                    <button
                      onClick={() => router.push("/groups/new")}
                      style={styles.primaryBtnSmall}
                    >
                      Crear grupo
                    </button>
                  </div>
                ) : (
                  <>
{autoSharedGroupId && !groupIdParam && !lockedToActiveGroup ? (
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
        {" "}· tipo <b>{getGroupTypeLabel(selectedGroup.type)}</b>
      </>
    ) : null}
  </div>
) : null}

{!autoSharedGroupId &&
isSharedProposal &&
!groupIdParam &&
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
    No encontramos un grupo compartido claro para esta propuesta. Puedes
    elegir abajo dónde quieres guardar este plan.
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
    Encontramos más de una opción posible. Para no asumir mal, elige tú el
    grupo correcto para este plan.
  </div>
) : null}

{learnedGroupCandidate?.id &&
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
    {suggestedPreselectedGroupId && selectedGroup?.id === suggestedPreselectedGroupId ? (
      <>
        🧠 Preseleccionamos <b>{learnedGroupCandidate.name || getGroupTypeLabel(learnedGroupCandidate.type)}</b> porque en planes parecidos normalmente eliges ese grupo. Puedes cambiarlo abajo si esta vez prefieres otro.
      </>
    ) : (
      <>
        🧠 Aprendizaje activo: en planes parecidos normalmente eliges <b>{learnedGroupCandidate.name || getGroupTypeLabel(learnedGroupCandidate.type)}</b>. Puedes usarlo abajo si te hace sentido.
      </>
    )}
  </div>
) : null}

{groupSuggestion?.type &&
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
    {suggestedPreselectedGroupId && selectedGroup?.id === suggestedPreselectedGroupId ? (
      <>
        ✨ Preseleccionamos{' '}
        <b>
          {groupSuggestion.type === "pair"
            ? "Pareja"
            : groupSuggestion.type === "family"
            ? "Familia"
            : "Compartido"}
        </b>{' '}
        porque este plan parece encajar mejor ahí. Puedes cambiarlo abajo si prefieres otro grupo.
      </>
    ) : (
      <>
        💡 Sugerencia: este plan parece encajar mejor en{' '}
        <b>
          {groupSuggestion.type === "pair"
            ? "Pareja"
            : groupSuggestion.type === "family"
            ? "Familia"
            : "Compartido"}
        </b>
        . Puedes seleccionarlo abajo si tiene sentido para ti.
      </>
    )}
  </div>
) : null}

                    <select
                      value={selectedGroupId}
                      disabled={
                        lockedToActiveGroup || (!!autoSharedGroupId && !groupIdParam)
                      }
                      onChange={(e) => {
                        groupManualSelectionRef.current = true;
                        setSuggestedPreselectedGroupId("");
                        setSelectedGroupId(e.target.value);
                      }}
                      style={{
                        ...styles.select,
                        opacity:
                          lockedToActiveGroup || (!!autoSharedGroupId && !groupIdParam)
                            ? 0.7
                            : 1,
                        cursor:
                          lockedToActiveGroup || (!!autoSharedGroupId && !groupIdParam)
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
                    ) : autoSharedGroupId && !groupIdParam ? (
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
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={styles.textarea}
                rows={3}
                placeholder="Añade contexto si realmente te suma."
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
            <div
              style={{
                marginTop: 14,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 900 }}>
                  {postSaveActions.isProposal
                    ? proposalResponse === "adjust"
                      ? "Propuesta ajustada"
                      : "Propuesta aceptada"
                    : postSaveActions.isShared
                    ? "Plan compartido guardado"
                    : "Evento guardado"}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>
                  {postSaveActions.isProposal
                    ? proposalResponse === "adjust"
                      ? postSaveActions.title
                        ? `"${postSaveActions.title}" ya quedó ajustada y guardada como plan. ¿Qué quieres hacer ahora?`
                        : "La propuesta ya quedó ajustada y guardada como plan. ¿Qué quieres hacer ahora?"
                      : postSaveActions.title
                      ? `"${postSaveActions.title}" ya quedó aceptada y convertida en plan. ¿Qué quieres hacer ahora?`
                      : "La propuesta ya quedó aceptada y convertida en plan. ¿Qué quieres hacer ahora?"
                    : postSaveActions.title
                    ? `"${postSaveActions.title}" ya quedó listo. ¿Qué quieres hacer ahora?`
                    : "Tu evento ya quedó listo. ¿Qué quieres hacer ahora?"}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => router.push("/calendar")}
                  style={styles.ghostBtn}
                >
                  {postSaveActions.isProposal ? "Ver plan en calendario" : "Ver calendario"}
                </button>

                {postSaveActions?.isShared && postSaveActions?.eventId ? (
                  <button
                    type="button"
                    onClick={handleSharePostSave}
                    disabled={sharingPostSave}
                    style={{
                      ...styles.ghostBtn,
                      opacity: sharingPostSave ? 0.7 : 1,
                    }}
                  >
                    {sharingPostSave ? "Compartiendo…" : "Compartir"}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleCreateAnotherSimilar}
                  style={styles.primaryBtn}
                >
                  {postSaveActions.isProposal
                    ? proposalResponse === "adjust"
                      ? "Crear otra propuesta para ajustar"
                      : "Crear otra propuesta similar"
                    : "Crear otro similar"}
                </button>
              </div>

              {postSaveShareUrl ? (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.72 }}>
                    Link listo para compartir
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      wordBreak: "break-all",
                      opacity: 0.9,
                    }}
                  >
                    {postSaveShareUrl}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={async () => {
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
                      style={styles.ghostBtn}
                    >
                      Copiar link
                    </button>

                    <button
                      type="button"
                      onClick={() => setPostSaveShareUrl(null)}
                      style={styles.ghostBtn}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
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
              : "Guardar evento"}
          </button>
        </section>
      </div>
    </main>
  );
}

/* ===================== Modal (premium) ===================== */

function ConflictPreflightModal({
  open,
  title,
  items,
  defaultChoice,
  onClose,
  onChoose,
}: {
  open: boolean;
  title: string;
  items: PreflightConflict[];
  defaultChoice: PreflightChoice;
  onClose: () => void;
  onChoose: (c: PreflightChoice) => void;
}) {
  return (
    <SharedConflictPreflightModal
      open={open}
      title={title}
      items={items}
      defaultChoice={defaultChoice}
      onClose={onClose}
      onChoose={onChoose}
    />
  );
}

function ChoiceCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...modalStyles.choice,
        borderColor: active
          ? "rgba(52,211,153,0.22)"
          : "rgba(255,255,255,0.12)",
        background: active
          ? "rgba(52,211,153,0.08)"
          : "rgba(255,255,255,0.05)",
      }}
    >
      <div style={modalStyles.choiceTitle}>{title}</div>
      <div style={modalStyles.choiceDesc}>{desc}</div>
    </button>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.70)",
    backdropFilter: "blur(2px)",
    border: "none",
    cursor: "pointer",
  },
  card: {
    position: "relative",
    width: "min(860px, 100%)",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.88)",
    boxShadow: "0 30px 100px rgba(0,0,0,0.55)",
    backdropFilter: "blur(16px)",
    overflow: "hidden",
  },
  header: {
    padding: 18,
  },
  badge: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
  },
  badgeDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
    background: "rgba(248,113,113,0.95)",
  },
  h2: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.2px",
  },
  p: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 1.4,
  },
  listBox: {
    padding: "0 18px 14px",
  },
  listInner: {
    maxHeight: 260,
    overflow: "auto",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.28)",
  },
  item: {
    padding: 14,
  },
  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 700,
  },
  overlapPill: {
    marginTop: 8,
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.22)",
    background: "rgba(248,113,113,0.10)",
    fontSize: 11,
    opacity: 0.9,
    fontWeight: 800,
  },
  idxPill: {
    flexShrink: 0,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
  },
  choices: {
    padding: "0 18px 14px",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  choice: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
    color: "rgba(255,255,255,0.92)",
  },
  choiceTitle: {
    fontSize: 13,
    fontWeight: 950,
  },
  choiceDesc: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 700,
  },
  footer: {
    padding: "0 18px 16px",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  ghost: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.90)",
    cursor: "pointer",
    fontWeight: 900,
  },
  primary: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(124,58,237,0.18))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 950,
  },
  tip: {
    padding: "0 18px 16px",
    fontSize: 11,
    opacity: 0.55,
    fontWeight: 700,
  },
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: {
    maxWidth: 900,
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