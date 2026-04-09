// src/app/events/new/details/hooks/useEventBoot.ts

import { useEffect, useState } from "react";
import supabase from "@/lib/supabaseClient";
import {
  getMyGroups,
  getSharedGroupBetweenUsers,
} from "@/lib/groupsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import { getEventById } from "@/lib/eventsDb";

type DbGroup = {
  id: string;
  name: string | null;
  type: "family" | "pair" | "other" | string;
};

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

export function useEventBoot({
  router,
  groupIdParam,
  isSharedProposal,
  proposalEventIdParam,
}: {
  router: any;
  groupIdParam: string | null;
  isSharedProposal: boolean;
  proposalEventIdParam: string;
}) {
  const [booting, setBooting] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [groups, setGroups] = useState<DbGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState(groupIdParam || "");
  const [autoSharedGroupId, setAutoSharedGroupId] = useState("");
  const [autoSharedGroupLabel, setAutoSharedGroupLabel] = useState("");
  const [sharedGroupDetectionState, setSharedGroupDetectionState] = useState<
    "idle" | "matched" | "none" | "ambiguous"
  >("idle");

  useEffect(() => {
    let alive = true;

    (async () => {
      setBooting(true);
      setLoadingGroups(true);

      try {
        const [{ data: authData }, gid, g] = await Promise.all([
          supabase.auth.getUser(),
          getActiveGroupIdFromDb().catch(() => null),
          getMyGroups().catch(() => [] as DbGroup[]),
        ]);

        if (!alive) return;

        const uid = authData?.user?.id ?? null;
        setCurrentUserId(uid);

        if (!uid) {
          router.replace("/auth/login");
          return;
        }

        const map = new Map<string, DbGroup>();
        for (const it of g || []) map.set(it.id, it);
        const unique = Array.from(map.values());

        setGroups(unique);
        setActiveGroupId(gid);

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
                  sharedGroupResult.group.name || "Grupo compartido";
                setSharedGroupDetectionState("matched");
              } else if (sharedGroupResult.status === "ambiguous") {
                setSharedGroupDetectionState("ambiguous");
              } else {
                setSharedGroupDetectionState("none");
              }
            } else {
              setSharedGroupDetectionState("none");
            }
          } catch {
            if (!alive) return;
            setSharedGroupDetectionState("ambiguous");
          }
        } else if (isSharedProposal) {
          setSharedGroupDetectionState("none");
        }

        const fallback =
          preferredGroupId ||
          gid ||
          (unique.length ? unique[0].id : "");

        if (preferredGroupId) {
          setAutoSharedGroupId(preferredGroupId);
          setAutoSharedGroupLabel(detectedSharedGroupLabel);
        } else {
          setAutoSharedGroupId("");
          setAutoSharedGroupLabel("");
        }

        if (fallback) setSelectedGroupId(fallback);
      } finally {
        if (!alive) return;
        setLoadingGroups(false);
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, groupIdParam, isSharedProposal, proposalEventIdParam]);

  return {
    booting,
    loadingGroups,
    groups,
    activeGroupId,
    selectedGroupId,
    setSelectedGroupId,
    currentUserId,
    autoSharedGroupId,
    autoSharedGroupLabel,
    sharedGroupDetectionState,
  };
}