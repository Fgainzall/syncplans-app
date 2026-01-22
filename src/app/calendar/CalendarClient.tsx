// src/app/calendar/CalendarClient.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import { EventEditModal } from "@/components/EventEditModal";

import { getMyGroups } from "@/lib/groupsDb";
import { getEventsForGroups, deleteEventsByIds } from "@/lib/eventsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";

import {
  type CalendarEvent,
  type GroupType,
  groupMeta,
  computeVisibleConflicts,
} from "@/lib/conflicts";

type Scope = "personal" | "active" | "all";
type Tab = "month" | "agenda";

/* =========================
   Helpers (local, seguros)
========================= */
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday-start
  const x = new Date(d);
  x.setDate(d.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function prettyMonthRange(a: Date, b: Date) {
  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${a.getDate()} ${meses[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${
    meses[b.getMonth()]
  } ${b.getFullYear()}`;
}
function prettyDay(d: Date) {
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${
    meses[d.getMonth()]
  } ${d.getFullYear()}`;
}
function prettyTimeRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const hhmm = (x: Date) =>
    `${String(x.getHours()).padStart(2, "0")}:${String(
      x.getMinutes()
    ).padStart(2, "0")}`;
  const cross = !sameDay(s, e);
  if (cross)
    return `${s.toLocaleDateString()} ${hhmm(
      s
    )} → ${e.toLocaleDateString()} ${hhmm(e)}`;
  return `${hhmm(s)} – ${hhmm(e)}`;
}
function isValidIsoish(v: any) {
  if (!v || typeof v !== "string") return false;
  const t = new Date(v).getTime();
  return !Number.isNaN(t);
}

/**
 * ✅ Normalización para conflictos:
 * El motor de conflictos trabaja con "couple" (no "pair").
 * OJO: En UI/estado guardamos "pair", y SOLO aquí convertimos para el motor.
 */
function normalizeForConflicts(
  gt: GroupType | null | undefined
): GroupType {
  if (!gt) return "personal" as GroupType;
  return (gt === ("pair" as any) ? ("couple" as any) : gt) as GroupType;
}

export default function CalendarClient(props: {
  highlightId: string | null;
  appliedToast: null | {
    deleted: number;
    skipped: number;
    appliedCount: number;
  };
}) {
  const { highlightId, appliedToast } = props;

  const router = useRouter();
  const pathname = usePathname();

  const eventRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setEventRef = (id: string) => (el: HTMLDivElement | null) => {
    eventRefs.current[String(id)] = el;
  };

  const [booting, setBooting] = useState(true);

  const [tab, setTab] = useState<Tab>("month");
  const [scope, setScope] = useState<Scope>("all");

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  // ✅ map: group_id -> type (pair/family) para pintar SIEMPRE bien
  const groupTypeById = useMemo(() => {
    const m = new Map<string, "pair" | "family">();
    for (const g of groups || []) {
      const id = String(g.id);
      const rawType = String(g.type ?? "").toLowerCase();
      m.set(id, rawType === "family" ? "family" : "pair");
    }
    return m;
  }, [groups]);

  const [error, setError] = useState<string | null>(null);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  // ✅ grupo activo real (para scope = "active")
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // ✅ UI sólo maneja: personal/pair/family
  const [enabledGroups, setEnabledGroups] = useState({
    personal: true,
    pair: true,
    family: true,
  });

  const [toast, setToast] = useState<
    null | { title: string; subtitle?: string }
  >(null);

  /* ✏️ Estado para edición */
  const [editingEvent, setEditingEvent] =
    useState<CalendarEvent | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setIsEditOpen(true);
  }, []);

  const monthStart = useMemo(() => startOfMonth(anchor), [anchor]);
  const monthEnd = useMemo(() => endOfMonth(anchor), [anchor]);
  const gridStart = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const gridEnd = useMemo(() => endOfWeek(monthEnd), [monthEnd]);

  const refreshCalendar = useCallback(
    async (opts?: {
      showToast?: boolean;
      toastTitle?: string;
      toastSubtitle?: string;
    }) => {
      const showToast = opts?.showToast ?? false;

      try {
        if (showToast) {
          setToast({
            title: opts?.toastTitle ?? "Sincronizando…",
            subtitle:
              opts?.toastSubtitle ?? "Actualizando desde tus grupos",
          });
        }

        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.user) {
          router.replace("/auth/login");
          return;
        }

        // ✅ grupo activo desde DB
        const active = await getActiveGroupIdFromDb();
        setActiveGroupId(active ? String(active) : null);

        const myGroups = await getMyGroups();
        setGroups(myGroups);

        // si no hay activo pero sí grupos, tomamos el primero
        if (!active && (myGroups?.length ?? 0) > 0) {
          setActiveGroupId(String(myGroups[0].id));
        }

        // ✅ siempre pedir eventos por groupIds (personales + mis grupos)
        const groupIds = (myGroups || []).map((g: any) => String(g.id));
        const rawEvents: any[] = (await getEventsForGroups(
          groupIds
        )) as any[];

        // ✅ mapping group_id -> type UI (pair/family)
        const groupTypeByIdLocal = new Map<string, "family" | "pair">(
          (myGroups || []).map((g: any) => {
            const id = String(g.id);
            const rawType = String(g.type ?? "").toLowerCase();
            const normalized: "family" | "pair" =
              rawType === "family" ? "family" : "pair";
            return [id, normalized];
          })
        );

        // ✅ guardamos eventos con groupType UI (personal/pair/family)
        const enriched: CalendarEvent[] = (rawEvents || [])
          .map((ev: any) => {
            const gid = ev.group_id ?? ev.groupId ?? null;

            let gt: GroupType = "personal" as any;
            if (gid) {
              const t = groupTypeByIdLocal.get(String(gid));
              gt = (t === "family" ? "family" : "pair") as any;
            } else {
              gt = "personal" as any;
            }

            const startRaw = ev.start;
            const endRaw = ev.end;

            if (!isValidIsoish(startRaw) || !isValidIsoish(endRaw))
              return null;

            return {
              id: String(ev.id),
              title: ev.title ?? "Evento",
              start: String(startRaw),
              end: String(endRaw),
              notes: ev.notes ?? undefined,
              groupId: gid ? String(gid) : null,
              groupType: gt,
            } as CalendarEvent;
          })
          .filter(Boolean) as CalendarEvent[];

        setEvents(enriched);
        setEventsLoaded(true);
        setError(null);

        if (showToast) {
          setToast({
            title: "Sincronizado ✅",
            subtitle: "Eventos actualizados con permisos reales.",
          });
          window.setTimeout(() => setToast(null), 2400);
        }
      } catch (e: any) {
        setError(e?.message ?? "Error cargando calendario");
        setEventsLoaded(true);

        if (showToast) {
          setToast({
            title: "No se pudo sincronizar",
            subtitle: e?.message ?? "Revisa tu sesión o conexión.",
          });
          window.setTimeout(() => setToast(null), 2800);
        }
      }
    },
    [router]
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string, title?: string) => {
      const ok = confirm(
        `¿Eliminar el evento${
          title ? ` "${title}"` : ""
        }?\nEsta acción no se puede deshacer.`
      );
      if (!ok) return;

      try {
        setToast({
          title: "Eliminando…",
          subtitle: "Aplicando cambios",
        });

        await deleteEventsByIds([eventId]);

        await refreshCalendar({
          showToast: true,
          toastTitle: "Evento eliminado ✅",
          toastSubtitle: "Tu calendario ya está actualizado.",
        });
      } catch (e: any) {
        setToast({
          title: "No se pudo eliminar",
          subtitle: e?.message ?? "Revisa permisos o conexión.",
        });
        window.setTimeout(() => setToast(null), 2600);
      }
    },
    [refreshCalendar]
  );
