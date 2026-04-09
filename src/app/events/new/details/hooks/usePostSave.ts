// src/app/events/new/details/hooks/usePostSave.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { getOrCreatePublicInvite } from "@/lib/invitationsDb";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toInputLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
    d.getDate()
  )}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fromInputLocal(s: string) {
  return new Date(s);
}

export function addMinutes(d: Date, mins: number) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() + mins);
  return x;
}

export function roundToNextQuarterHour(d: Date) {
  const x = new Date(d);
  x.setSeconds(0, 0);

  const m = x.getMinutes();
  const rounded = Math.ceil(m / 15) * 15;

  x.setMinutes(rounded % 60);
  if (rounded >= 60) x.setHours(x.getHours() + 1);

  return x;
}

export function getSafeDurationMinutes(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 60;
  return Math.max(15, Math.round(diff / 60000));
}

export type PostSaveFormFingerprint = string;
export type EventFormType = "personal" | "group";

export type PostSaveToast = {
  title: string;
  subtitle?: string;
};

export type PostSaveActionsState = {
  visible: boolean;
  eventId?: string;
  title?: string;
  isShared?: boolean;
  isProposal?: boolean;
};

export type BuildEventDetailsUrl = (
  nextType: EventFormType,
  nextDateIso: string,
  nextGroupId?: string | null
) => string;

export function buildPostSaveFingerprint(input: {
  effectiveType: EventFormType;
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

function humanizeActionError(err: unknown, fallback = "Intenta nuevamente.") {
  const message =
    err instanceof Error ? err.message.trim() : String(err ?? "").trim();

  if (!message) return fallback;

  const lowered = message.toLowerCase();

  if (
    lowered.includes("fetch") ||
    lowered.includes("network") ||
    lowered.includes("networkerror") ||
    lowered.includes("failed to fetch")
  ) {
    return "Parece un problema de red. Revisa tu conexión e inténtalo otra vez.";
  }

  if (lowered.includes("abort")) {
    return "La operación se interrumpió. Intenta de nuevo.";
  }

  return message;
}

type UsePostSaveParams = {
  router: AppRouterInstance;
  isEditing: boolean;
  effectiveType: EventFormType;
  selectedGroupId: string;
  activeGroupId: string | null;
  title: string;
  notes: string;
  startLocal: string;
  endLocal: string;
  startDate: Date;
  endDate: Date;
  buildUrl: BuildEventDetailsUrl;
  setStartLocal: React.Dispatch<React.SetStateAction<string>>;
  setEndLocal: React.Dispatch<React.SetStateAction<string>>;
};

export function usePostSave({
  router,
  isEditing,
  effectiveType,
  selectedGroupId,
  activeGroupId,
  title,
  notes,
  startLocal,
  endLocal,
  startDate,
  endDate,
  buildUrl,
  setStartLocal,
  setEndLocal,
}: UsePostSaveParams) {
  const [toast, setToast] = useState<PostSaveToast | null>(null);

  const [postSaveActions, setPostSaveActions] =
    useState<PostSaveActionsState | null>(null);

  const [sharingPostSave, setSharingPostSave] = useState(false);
  const [postSaveShareUrl, setPostSaveShareUrl] = useState<string | null>(null);
  const [postSaveFingerprint, setPostSaveFingerprint] =
    useState<PostSaveFormFingerprint | null>(null);

  const shareInFlightRef = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

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

  const clearPostSaveState = (options?: { keepToast?: boolean }) => {
    setPostSaveActions(null);
    setPostSaveShareUrl(null);
    setPostSaveFingerprint(null);
    if (!options?.keepToast) setToast(null);
  };

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

  const handleSharePostSave = async () => {
    if (shareInFlightRef.current || sharingPostSave) return;

    try {
      if (!postSaveActions?.eventId) {
        setToast({
          title: "Todavía no se puede compartir",
          subtitle: "Aún no encontré el evento que acabas de guardar.",
        });
        return;
      }

      shareInFlightRef.current = true;
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
        } catch (shareErr: unknown) {
          if (
            typeof shareErr === "object" &&
            shareErr !== null &&
            "name" in shareErr &&
            (shareErr as { name?: string }).name === "AbortError"
          ) {
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
    } catch (err: unknown) {
      setToast({
        title: "No se pudo compartir",
        subtitle: humanizeActionError(err, "Intenta nuevamente."),
      });
    } finally {
      shareInFlightRef.current = false;
      setSharingPostSave(false);
    }
  };

  const handleCopyPostSaveLink = async () => {
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

  return {
    toast,
    setToast,
    postSaveActions,
    setPostSaveActions,
    sharingPostSave,
    postSaveShareUrl,
    setPostSaveShareUrl,
    postSaveFingerprint,
    setPostSaveFingerprint,
    currentPostSaveFingerprint,
    clearPostSaveState,
    handleSharePostSave,
    handleCopyPostSaveLink,
    handleCreateAnotherSimilar,
  };
}