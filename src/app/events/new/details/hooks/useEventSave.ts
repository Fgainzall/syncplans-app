// src/app/events/new/details/hooks/useEventSave.ts
// src/app/events/new/details/hooks/useEventSave.tsx

import { useRef, useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import {
  computeVisibleConflicts,
  fmtRange,
  groupMeta,
  hideEventIdsForCurrentUser,
  ignoreConflictIds,
  type GroupType,
} from "@/lib/conflicts";
import { loadEventsForConflictPreflight } from "@/lib/conflictsDbBridge";
import {
  createEventForGroup,
  deleteEventsByIdsDetailed,
  getEventById,
  updateEvent,
} from "@/lib/eventsDb";
import {
  createConflictAutoAdjustedNotification,
  createConflictDecisionNotification,
  createConflictNotificationForEvent,
} from "@/lib/notificationsDb";
import { createConflictResolutionLog } from "@/lib/conflictResolutionsLogDb";
import { upsertProposalResponse } from "@/lib/proposalResponsesDb";
import { trackEvent, trackEventOnce } from "@/lib/analytics";
import type { NotificationSettings } from "@/lib/settings";

export type PreflightChoice =
  | "edit"
  | "keep_existing"
  | "replace_with_new"
  | "keep_both";

export type PreflightConflict = {
  id: string;
  existingId: string;
  title: string;
  groupLabel: string;
  range: string;
  overlapStart: string;
  overlapEnd: string;
};

type ProposalResponse = "adjust" | "accept" | null;

type ToastValue = {
  title: string;
  subtitle?: string;
};

type PostSaveActionsValue = {
  visible: boolean;
  eventId?: string;
  title?: string;
  isShared?: boolean;
  isProposal?: boolean;
};

type SelectedGroup = {
  id: string;
  type: string | null;
  name?: string | null;
} | null;

type PendingPayload = {
  groupType: GroupType;
  groupId: string | null;
  title: string;
  notes?: string;
  startIso: string;
  endIso: string;
};

type UseEventSaveParams = {
  router: AppRouterInstance;
  sp: ReadonlyURLSearchParams;
  isEditing: boolean;
  eventIdParam: string | null;
  currentUserId: string | null;
  settings: NotificationSettings | null;
  effectiveType: "personal" | "group";
  isSharedProposal: boolean;
  proposalResponse: ProposalResponse;
  selectedGroup: SelectedGroup;
  shouldLearnCurrentSelection: boolean;
  learningInput: string;
  normalizeDbGroupType: (value: unknown) => GroupType;
  learnGroupSelection: (input: {
    title: string;
    groupId: string;
    groupType: "pair" | "family" | "other";
  }) => void;
  currentPostSaveFingerprint: string;
  setToast: React.Dispatch<React.SetStateAction<ToastValue | null>>;
  setPostSaveActions: React.Dispatch<
    React.SetStateAction<PostSaveActionsValue | null>
  >;
  setPostSaveShareUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setPostSaveFingerprint: React.Dispatch<React.SetStateAction<string | null>>;
};

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

function mapDefaultResolutionToChoice(s: NotificationSettings | null): PreflightChoice {
  const def = (s as any)?.conflictDefaultResolution ?? "ask_me";
  if (def === "keep_existing") return "keep_existing";
  if (def === "replace_with_new") return "replace_with_new";
  if (def === "none") return "keep_both";
  return "edit";
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

function emitSyncPlansRefreshSignals() {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(new CustomEvent("sp:events-changed"));
  } catch {}

  try {
    window.dispatchEvent(new Event("focus"));
  } catch {}

  try {
    document.dispatchEvent(new Event("visibilitychange"));
  } catch {}
}

export function useEventSave({
  router,
  sp,
  isEditing,
  eventIdParam,
  currentUserId,
  settings,
  effectiveType,
  isSharedProposal,
  proposalResponse,
  selectedGroup,
  shouldLearnCurrentSelection,
  learningInput,
  normalizeDbGroupType,
  learnGroupSelection,
  currentPostSaveFingerprint,
  setToast,
  setPostSaveActions,
  setPostSaveShareUrl,
  setPostSaveFingerprint,
}: UseEventSaveParams) {
  const [saving, setSaving] = useState(false);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightItems, setPreflightItems] = useState<PreflightConflict[]>([]);
  const [preflightDefaultChoice, setPreflightDefaultChoice] =
    useState<PreflightChoice>("edit");
  const [pendingPayload, setPendingPayload] = useState<PendingPayload | null>(
    null
  );
  const [existingIdsToReplace, setExistingIdsToReplace] = useState<string[]>(
    []
  );

  const saveInFlightRef = useRef(false);
  const preflightChoiceInFlightRef = useRef(false);

  const clearPreflightState = () => {
    setPendingPayload(null);
    setExistingIdsToReplace([]);
    setPreflightItems([]);
  };

  const buildSuccessToast = (options?: { keepBoth?: boolean }): ToastValue => {
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
    payload: PendingPayload;
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

    await Promise.allSettled(writes);
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
      } catch {}
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
    payload: PendingPayload,
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

        if (currentUserId && savedEventId) {
          await trackEvent({
            event: "event_edited",
            userId: currentUserId,
            entityId: savedEventId,
            metadata: {
              screen: "event_details",
              type: payload.groupId ? "group" : "personal",
              group_id: payload.groupId ?? null,
              source: "event_details_edit",
              capture_source: sp.get("capture_source") ?? null,
            },
          });
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

        if (
          savedEventId &&
          isSharedProposal &&
          proposalResponse &&
          currentUserId
        ) {
          await upsertProposalResponse({
            eventId: savedEventId,
            userId: currentUserId,
            response: proposalResponse === "adjust" ? "adjusted" : "accepted",
          });
        }

        if (savedEventId) {
          const createdEventMetadata = {
            screen: "event_details",
            source: "event_details_create",
            type: payload.groupId ? "group" : "personal",
            group_id: payload.groupId ?? null,
            group_type: payload.groupType ?? null,
            capture_source: sp.get("capture_source") ?? null,
            proposal_source: sp.get("proposalSource") ?? null,
            quick_capture: sp.get("qc") === "1",
          };

          await trackEvent({
            event: "event_created",
            userId: currentUserId,
            entityId: savedEventId,
            metadata: createdEventMetadata,
          });

          await trackEventOnce({
            event: "first_event_created",
            userId: currentUserId,
            entityId: savedEventId,
            scope: "local",
            onceKey: currentUserId
              ? `first-event-created:${currentUserId}`
              : "first-event-created",
            metadata: {
              ...createdEventMetadata,
              is_first_time: true,
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

      if (savedEventId) {
        await trackEvent({
          event: "event_saved",
          userId: currentUserId,
          entityId: savedEventId,
          metadata: {
            screen: "event_details",
            source: isEditing ? "event_details_edit" : "event_details_create",
            mode: isEditing ? "edit" : "create",
            type: payload.groupId ? "group" : "personal",
            group_id: payload.groupId ?? null,
            capture_source: sp.get("capture_source") ?? null,
            quick_capture: sp.get("qc") === "1",
          },
        });
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
        } catch {}

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
    } catch (err: unknown) {
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
    payload: PendingPayload
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
            range: otherEvent ? fmtRange(otherEvent.start, otherEvent.end) : "—",
            overlapStart: c.overlapStart,
            overlapEnd: c.overlapEnd,
          };
        })
        .filter(Boolean) as PreflightConflict[];

      setExistingIdsToReplace(
        Array.from(
          new Set(items.map((x) => String(x.existingId)).filter(Boolean))
        )
      );
      setPreflightItems(items);
      setPreflightDefaultChoice(mapDefaultResolutionToChoice(settings));
      setPreflightOpen(true);

      return { ok: false };
    } catch {
      return { ok: true };
    }
  };

  const save = async ({
    canSave,
    errors,
    payload,
    clearPostSaveState,
  }: {
    canSave: boolean;
    errors: string[];
    payload: PendingPayload;
    clearPostSaveState: (options?: { keepToast?: boolean }) => void;
  }) => {
    if (saving || saveInFlightRef.current || preflightChoiceInFlightRef.current) {
      return;
    }

    clearPreflightState();
    clearPostSaveState({ keepToast: true });

    if (!canSave) {
      setToast({
        title: "Revisa el formulario",
        subtitle: errors[0],
      });
      return;
    }

    setPendingPayload(payload);
    const pf = await preflight(payload);
    if (!pf.ok) return;

    await doSave(payload);
  };

  const onPreflightChoose = async (choice: PreflightChoice) => {
    setPreflightOpen(false);

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

      try {
        const ids = itemsSnapshot.map((it) => it.id).filter(Boolean);
        ignoreConflictIds(ids);
      } catch {}

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
        } catch {}

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
            "No se pudieron reemplazar todos los eventos por permisos. Para no romper nada, SyncPlans mantuvo ambos.",
        });

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

      return;
    } catch (err: unknown) {
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

  return {
    saving,
    preflightOpen,
    setPreflightOpen,
    preflightItems,
    preflightDefaultChoice,
    save,
    onPreflightChoose,
    clearPreflightState,
  };
}