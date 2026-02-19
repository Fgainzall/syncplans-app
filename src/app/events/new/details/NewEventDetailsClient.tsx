// src/app/events/new/details/NewEventDetailsClient.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
const AnyPremiumHeader = PremiumHeader as React.ComponentType<any>;
import {
  GroupType,
  groupMeta,
  computeVisibleConflicts,
  fmtRange,
  type CalendarEvent,
  ignoreConflictIds,
} from "@/lib/conflicts";

import { getSettingsFromDb, type NotificationSettings } from "@/lib/settings";

// ✅ DB real (RLS)
import { getMyGroups } from "@/lib/groupsDb";

// ✅ DB Source of Truth
import {
  createEventForGroup,
  deleteEventsByIds,
  getMyEvents,
  getEventById,
  updateEvent,
} from "@/lib/eventsDb";

// ✅ active group desde DB
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";

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

type DbGroup = {
  id: string;
  name: string | null;
  type: "family" | "pair" | string;
};

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

function mapDefaultResolutionToChoice(
  s: NotificationSettings | null
): PreflightChoice {
  const def = (s as any)?.conflictDefaultResolution ?? "ask_me";
  if (def === "keep_existing") return "keep_existing";
  if (def === "replace_with_new") return "replace_with_new";
  if (def === "none") return "keep_both"; // ← mantener ambos
  // "ask_me" u otros → te mando a editar
  return "edit";
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

  // 🔑 Soporte edición: leemos eventId/id desde la URL
  const eventIdParam = sp.get("eventId") || sp.get("id");
  const isEditing = !!eventIdParam;

  // URL params
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

  // Settings
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  // Active group desde DB
  const [booting, setBooting] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Groups
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groups, setGroups] = useState<DbGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    groupIdParam || ""
  );

  // Boot de evento (modo edición)
  const [bootingEvent, setBootingEvent] = useState<boolean>(isEditing);

  // ✅ DEDUPE: lista única de grupos por id
  const uniqueGroups = useMemo(() => {
    const map = new Map<string, DbGroup>();
    for (const g of groups || []) map.set(g.id, g);
    return Array.from(map.values());
  }, [groups]);

  // Preflight modal
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

  // Toast auto hide
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Load settings
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
    // No añadimos eventId aquí a propósito: ese param solo nos sirve
    // para entrar en modo edición, no es necesario mantenerlo siempre.
    return `/events/new/details?${params.toString()}`;
  }

  // Boot: active group + grupos (✅ DB real)
  useEffect(() => {
    let alive = true;
    (async () => {
      setBooting(true);
      setLoadingGroups(true);
      try {
        const [gid, g] = await Promise.all([
          getActiveGroupIdFromDb().catch(() => null),
          getMyGroups().catch(() => [] as any),
        ]);
        if (!alive) return;

        const list: DbGroup[] = Array.isArray(g) ? (g as DbGroup[]) : [];
        const map = new Map<string, DbGroup>();
        for (const it of list || []) map.set(it.id, it);
        const unique = Array.from(map.values());

        setActiveGroupId(gid);
        setGroups(unique);

        const fallbackGroupId =
          groupIdParam || gid || (unique && unique.length ? unique[0].id : "");
        if (fallbackGroupId) setSelectedGroupId(fallbackGroupId);

        // ✅ Si URL dice group pero NO trae groupId, la arreglamos (replace)
        if (typeParam === "group" && !groupIdParam) {
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
          subtitle: err?.message || "Intenta nuevamente.",
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

  // 🆕 Boot del evento en modo edición
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
        if (!Number.isNaN(s.getTime())) setStartLocal(toInputLocal(s));
        if (!Number.isNaN(e.getTime())) setEndLocal(toInputLocal(e));

        const gid = ev.group_id ? String(ev.group_id) : "";
        if (gid) setSelectedGroupId(gid);
      } catch (err: any) {
        if (!alive) return;
        setToast({
          title: "No se pudo cargar el evento",
          subtitle: err?.message || "Intenta nuevamente.",
        });
      } finally {
        if (!alive) return;
        setBootingEvent(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isEditing, eventIdParam]);

  const lockedToActiveGroup = useMemo(() => {
    if (typeParam !== "group") return false;
    return sp.get("lock") === "1";
  }, [typeParam, sp]);

  const effectiveType: NewType = useMemo(() => {
    if (lockedToActiveGroup) return "group";
    return typeParam;
  }, [lockedToActiveGroup, typeParam]);

  // Si estamos bloqueados, el grupo seleccionado debe ser el activo
  useEffect(() => {
    if (!lockedToActiveGroup) return;
    if (!activeGroupId) return;
    if (selectedGroupId !== activeGroupId) setSelectedGroupId(activeGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedToActiveGroup, activeGroupId]);

  // ✅ Si cambia selectedGroupId estando en "group", mantenemos URL coherente
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
    return selectedGroup.type === "family" ? "family" : "pair";
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
            : "rgba(248,113,113,0.28)",
        soft:
          groupType === "family"
            ? "rgba(96,165,250,0.14)"
            : "rgba(248,113,113,0.12)",
      };
    }
    return {
      label: "Evento personal",
      border: "rgba(250,204,21,0.28)",
      soft: "rgba(250,204,21,0.14)",
    };
  }, [effectiveType, lockedToActiveGroup, meta.label, groupType]);

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

  const goBack = () => router.push("/calendar");

  const onAutoEnd = () => {
    const s = fromInputLocal(startLocal);
    const e = fromInputLocal(endLocal);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    if (e.getTime() <= s.getTime())
      setEndLocal(toInputLocal(addMinutes(s, 60)));
  };

  const doSave = async (payload: {
    groupType: GroupType;
    groupId: string | null;
    title: string;
    notes?: string;
    startIso: string;
    endIso: string;
  }) => {
    setSaving(true);
    try {
      if (isEditing && eventIdParam) {
        // 📝 MODO EDICIÓN
        await updateEvent({
          id: eventIdParam,
          title: payload.title,
          notes: payload.notes,
          start: payload.startIso,
          end: payload.endIso,
          groupId: payload.groupId,
        });
      } else {
        // 🆕 MODO CREACIÓN
        await createEventForGroup({
          title: payload.title,
          notes: payload.notes,
          start: payload.startIso,
          end: payload.endIso,
          groupId: payload.groupId,
        });
      }

      setToast({
        title: isEditing ? "Evento actualizado ✅" : "Evento creado ✅",
        subtitle: "Volviendo al calendario…",
      });
      window.setTimeout(() => router.push("/calendar"), 450);
    } catch (err: any) {
      setToast({
        title: "No se pudo guardar",
        subtitle: err?.message || "Intenta nuevamente.",
      });
      window.setTimeout(() => setToast(null), 2800);
    } finally {
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

    // 1) Traemos eventos desde la DB (DbEventRow[])
    let existing: CalendarEvent[] = [];
    try {
      const raw = await getMyEvents(); // DbEventRow[]

      // 2) Map → CalendarEvent (solo necesitamos lo básico + groupType)
      existing = (raw ?? []).map((e: any) => {
        const gid = e.group_id ?? e.groupId ?? null;
        const groupType: GroupType = gid ? "pair" : "personal";

        return {
          id: String(e.id),
          title: e.title ?? "Evento",
          start: String(e.start),
          end: String(e.end),
          notes: e.notes ?? undefined,
          groupId: gid ? String(gid) : null,
          groupType,
        } as CalendarEvent;
      });
    } catch {
      // Si algo falla cargando eventos, no bloqueamos el guardado
      return { ok: true };
    }

    // 3) Inyectamos el evento "nuevo" como si ya existiera
    const incomingId = `incoming_${Date.now().toString(16)}`;

    const incoming: CalendarEvent = {
      id: incomingId,
      title: payload.title || "Nuevo evento",
      start: payload.startIso,
      end: payload.endIso,
      groupType: payload.groupType,
      groupId: payload.groupId ?? null,
      notes: payload.notes,
    } as any;

    const combined = [...existing, incoming];

    // 4) Calculamos conflictos visibles:
    //    - relacionados con el "incoming"
    //    - y, si estamos editando, ignoramos el conflicto contra el propio evento.
    const all = computeVisibleConflicts(combined);
    const conflicts = all.filter((c) => {
      if (isEditing && eventIdParam && c.existingEventId === eventIdParam) {
        return false;
      }
      return c.incomingEventId === incomingId;
    });

    if (!conflicts.length) return { ok: true };

    const items: PreflightConflict[] = conflicts.map((c) => {
      const ex = c.existing;
      const gm = groupMeta(ex?.groupType ?? "personal");

      return {
        id: c.id,
        existingId: c.existingEventId,
        title: ex?.title ?? "Evento existente",
        groupLabel: gm.label,
        range: ex ? fmtRange(ex.start, ex.end) : "—",
        overlapStart: c.overlapStart,
        overlapEnd: c.overlapEnd,
      };
    });

    setExistingIdsToReplace(
      Array.from(new Set(items.map((x) => x.existingId)))
    );
    setPreflightItems(items);
    setPreflightDefaultChoice(mapDefaultResolutionToChoice(settings));
    setPreflightOpen(true);

    return { ok: false };
  };

  const save = async () => {
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

    // 👇 Opción "Editar antes"
    if (choice === "edit") {
      setToast({
        title: "Ok",
        subtitle: "Ajusta horario/título y vuelve a guardar.",
      });
      return;
    }

    // 👇 Opción "Conservar existente" → no guardamos el nuevo
    if (choice === "keep_existing") {
      setToast({
        title: "No se guardó",
        subtitle: "Conservamos tus eventos existentes.",
      });
      return;
    }

    if (!pendingPayload) {
      setToast({
        title: "Ups",
        subtitle: "No encontré el evento pendiente. Intenta otra vez.",
      });
      return;
    }

    // 🆕 Opción "Conservar ambos": guardo el nuevo,
    // NO borro nada, y marco estos conflictos como ignorados.
    if (choice === "keep_both") {
      try {
        const ids = preflightItems.map((it) => it.id).filter(Boolean);
        ignoreConflictIds(ids);
      } catch {
        // si falla localStorage, igual seguimos
      }
      await doSave(pendingPayload);
      return;
    }

    // 👇 Opción "Reemplazar por el nuevo"
    setSaving(true);
    try {
      const deleted = await deleteEventsByIds(existingIdsToReplace);
      await doSave(pendingPayload);
      setToast({
        title: "Listo ✅",
        subtitle:
          deleted > 0
            ? `Reemplacé ${deleted} evento(s) en conflicto.`
            : "Guardé el nuevo evento.",
      });
      window.setTimeout(() => router.push("/calendar"), 550);
    } catch (err: any) {
      setToast({
        title: "No se pudo aplicar",
        subtitle: err?.message || "Intenta nuevamente.",
      });
      window.setTimeout(() => setToast(null), 2800);
    } finally {
      setSaving(false);
    }
  };

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
        onClose={() => setPreflightOpen(false)}
        onChoose={onPreflightChoose}
      />

      <div style={styles.shell}>
        <div style={styles.topRow}>
           <AnyPremiumHeader />
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
              Antes de guardar, SyncPlans revisa choques. Si hay conflicto, tú
              decides.
              {lockedToActiveGroup ? (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                  Este evento se compartirá automáticamente con tu grupo activo.
                </div>
              ) : null}
            </div>
          </div>

          <div style={styles.heroRight}>
            <button onClick={goBack} style={styles.ghostBtn}>
              Cancelar
            </button>
            <button
              onClick={save}
              style={{ ...styles.primaryBtn, opacity: canSave ? 1 : 0.6 }}
              disabled={!canSave}
            >
              {saving
                ? "Guardando…"
                : isEditing
                ? "Guardar cambios"
                : "Guardar"}
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.row}>
            <div style={styles.label}>Tipo</div>
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
                <select
                  value={selectedGroupId}
                  disabled={lockedToActiveGroup}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  style={{
                    ...styles.select,
                    opacity: lockedToActiveGroup ? 0.7 : 1,
                    cursor: lockedToActiveGroup ? "not-allowed" : "pointer",
                  }}
                >
                  {uniqueGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name ?? "Grupo"} (
                      {g.type === "family" ? "Familia" : "Pareja"})
                    </option>
                  ))}
                </select>
              )}

              {selectedGroup ? (
                <div style={styles.hint}>
                  Seleccionado: <b>{selectedGroup.name ?? "Grupo"}</b> · tipo{" "}
                  <b>{selectedGroup.type === "family" ? "Familia" : "Pareja"}</b>
                  {lockedToActiveGroup ? (
                    <span style={{ marginLeft: 8, opacity: 0.9 }}>
                      · (grupo activo)
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          <div style={styles.field}>
            <div style={styles.fieldLabel}>Título</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cena / Gym / Médico"
              style={styles.input}
            />
          </div>

          <div style={styles.grid2}>
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

          <div style={styles.field}>
            <div style={styles.fieldLabel}>Notas (opcional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={styles.textarea}
              rows={4}
            />
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
        </section>

        <section style={styles.footerRow}>
          <button onClick={goBack} style={styles.ghostBtnWide}>
            ← Volver
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
  const [choice, setChoice] = useState<PreflightChoice>(defaultChoice);

  useEffect(() => {
    if (open) setChoice(defaultChoice);
  }, [open, defaultChoice]);

  if (!open) return null;

  const count = items.length;

  return (
    <div style={modalStyles.wrap}>
      <button
        style={modalStyles.backdrop}
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div style={modalStyles.card}>
        <div style={modalStyles.header}>
          <div style={modalStyles.badge}>
            <span style={modalStyles.badgeDot} />
            SyncPlans · Conflictos
          </div>
          <div style={modalStyles.h2}>Antes de guardar, resolvamos esto</div>
          <div style={modalStyles.p}>
            <b style={{ opacity: 0.9 }}>“{title}”</b> se cruza con{" "}
            <b style={{ opacity: 0.9 }}>{count}</b> evento
            {count === 1 ? "" : "s"}.
          </div>
        </div>

        <div style={modalStyles.listBox}>
          <div style={modalStyles.listInner}>
            {items.map((it, idx) => (
              <div
                key={it.id}
                style={{
                  ...modalStyles.item,
                  borderTop: idx
                    ? "1px solid rgba(255,255,255,0.10)"
                    : "none",
                }}
              >
                <div style={modalStyles.itemTop}>
                  <div style={{ minWidth: 0 }}>
                    <div style={modalStyles.itemTitle}>{it.title}</div>
                    <div style={modalStyles.itemSub}>
                      {it.groupLabel} · {it.range}
                    </div>
                    <div style={modalStyles.overlapPill}>
                      Se cruza:{" "}
                      {new Date(it.overlapStart).toLocaleString()} —{" "}
                      {new Date(it.overlapEnd).toLocaleString()}
                    </div>
                  </div>
                  <div style={modalStyles.idxPill}>#{idx + 1}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={modalStyles.choices}>
          <ChoiceCard
            active={choice === "keep_existing"}
            title="Conservar existente"
            desc="No guardo el nuevo."
            onClick={() => setChoice("keep_existing")}
          />
          <ChoiceCard
            active={choice === "replace_with_new"}
            title="Reemplazar por el nuevo"
            desc="El nuevo gana (borro los existentes)."
            onClick={() => setChoice("replace_with_new")}
          />
          <ChoiceCard
            active={choice === "keep_both"}
            title="Conservar ambos"
            desc="Guardo el nuevo y mantengo los existentes (el conflicto queda)."
            onClick={() => setChoice("keep_both")}
          />
          <ChoiceCard
            active={choice === "edit"}
            title="Editar antes"
            desc="Ajustar horas o título."
            onClick={() => setChoice("edit")}
          />
        </div>

        <div style={modalStyles.footer}>
          <button style={modalStyles.ghost} onClick={onClose}>
            Cancelar
          </button>
          <button style={modalStyles.primary} onClick={() => onChoose(choice)}>
            Continuar
          </button>
        </div>

        <div style={modalStyles.tip}>
          Tip: esto respeta tus Settings (warn-before-save + default-resolution).
        </div>
      </div>
    </div>
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

/* ===================== Styles (igual que tu versión) ===================== */

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
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
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
  },
  fieldLabel: {
    fontSize: 12,
    opacity: 0.8,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    fontSize: 14,
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
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 8,
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
};
