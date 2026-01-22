// src/components/EventEditModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import supabase from "@/lib/supabaseClient";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import type { GroupType } from "@/lib/conflicts";

type EventEditModalProps = {
  isOpen: boolean;
  onClose: () => void;

  initialEvent?: {
    id?: string;
    title?: string;
    start?: string; // ISO o local
    end?: string;   // ISO o local
    groupType?: GroupType;
    description?: string;
    allDay?: boolean;
  };

  onSaved?: () => void;
};

function IconX(props: { size?: number }) {
  const s = props.size ?? 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash(props: { size?: number }) {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSave(props: { size?: number }) {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M17 21v-8H7v8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 3v5h8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function nowPlusMinutes(min: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + min);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/**
 * Normaliza cualquier string de fecha (ISO o local) a formato
 * "YYYY-MM-DDTHH:mm" compatible con <input type="datetime-local">
 */
function normalizeToLocalInput(src: string | undefined, fallbackMinutes: number) {
  if (!src) return nowPlusMinutes(fallbackMinutes);
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return nowPlusMinutes(fallbackMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toISOFromLocal(local: string) {
  const d = new Date(local);
  return d.toISOString();
}

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

export function EventEditModal({ isOpen, onClose, initialEvent, onSaved }: EventEditModalProps) {
  const isEdit = Boolean(initialEvent?.id);

  const defaultStart = useMemo(
    () => normalizeToLocalInput(initialEvent?.start, 15),
    [initialEvent?.start]
  );
  const defaultEnd = useMemo(
    () => normalizeToLocalInput(initialEvent?.end, 75),
    [initialEvent?.end]
  );

  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [startLocal, setStartLocal] = useState(defaultStart);
  const [endLocal, setEndLocal] = useState(defaultEnd);
  const [groupType, setGroupType] = useState<GroupType>(initialEvent?.groupType ?? "personal");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [allDay, setAllDay] = useState(Boolean(initialEvent?.allDay));
  const [busy, setBusy] = useState<"idle" | "save" | "delete">("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialEvent?.title ?? "");
    setStartLocal(normalizeToLocalInput(initialEvent?.start, 15));
    setEndLocal(normalizeToLocalInput(initialEvent?.end, 75));
    setGroupType(initialEvent?.groupType ?? "personal");
    setDescription(initialEvent?.description ?? "");
    setAllDay(Boolean(initialEvent?.allDay));
    setBusy("idle");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialEvent?.id]);

  if (!isOpen) return null;

  function validate() {
    const t = title.trim();
    if (!t) return "Ponle un título al evento.";
    if (!startLocal || !endLocal) return "Selecciona inicio y fin.";
    const s = new Date(startLocal).getTime();
    const e = new Date(endLocal).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return "Formato de fecha inválido.";
    if (e <= s) return "La hora de fin debe ser posterior al inicio.";
    return "";
  }

  function closeSafely() {
    setError("");
    setBusy("idle");
    onClose();
  }

  async function resolveGroupIdForSave(): Promise<string | null> {
    if (groupType === "personal") return null;

    // ✅ Para pareja/familia usamos el grupo activo en DB
    const gid = await getActiveGroupIdFromDb().catch(() => null);
    if (!gid) {
      throw new Error(
        "No hay grupo activo. Ve a /groups y elige tu grupo antes de crear evento de pareja/familia."
      );
    }
    return gid;
  }

  async function handleSave() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setBusy("save");
    setError("");

    try {
      const uid = await requireUid();
      const groupId = await resolveGroupIdForSave();

      const payload = {
        owner_id: uid,
        title: title.trim(),
        notes: description.trim() || null,
        start: toISOFromLocal(startLocal),
        end: toISOFromLocal(endLocal),
        group_id: groupId,
      };

      if (initialEvent?.id) {
        const { error } = await supabase
          .from("events")
          .update({
            title: payload.title,
            notes: payload.notes,
            start: payload.start,
            end: payload.end,
            group_id: payload.group_id,
          })
          .eq("id", initialEvent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert([payload]);
        if (error) throw error;
      }

      onSaved?.();
      closeSafely();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar.");
    } finally {
      setBusy("idle");
    }
  }

  async function handleDelete() {
    if (!initialEvent?.id) return;

    setBusy("delete");
    setError("");

    try {
      const { error } = await supabase.from("events").delete().eq("id", initialEvent.id);
      if (error) throw error;

      onSaved?.();
      closeSafely();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo eliminar.");
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[28rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 blur-3xl opacity-60" />

        <div className="relative flex items-center justify-between px-6 pt-6">
          <div>
            <div className="text-xs font-semibold tracking-wide text-gray-500">SYNCPLANS</div>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">
              {isEdit ? "Editar evento" : "Nuevo evento"}
            </h2>
          </div>

          <button
            onClick={closeSafely}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50 text-gray-700 hover:bg-gray-100 active:scale-[0.98]"
            aria-label="Cerrar"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="relative px-6 pb-6 pt-5">
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <label className="block">
            <div className="mb-2 text-xs font-semibold text-gray-600">Título</div>
            <input
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              placeholder="Ej: Cena, Reunión, Gym…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-xs font-semibold text-gray-600">Inicio</div>
              <input
                type="datetime-local"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-xs font-semibold text-gray-600">Fin</div>
              <input
                type="datetime-local"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold text-gray-600">Calendario</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { k: "personal", label: "Personal", pill: "bg-yellow-50 text-yellow-800 ring-yellow-200" },
                  { k: "couple", label: "Pareja", pill: "bg-red-50 text-red-700 ring-red-200" },
                  { k: "family", label: "Familia", pill: "bg-blue-50 text-blue-700 ring-blue-200" },
                ] as const
              ).map((g) => {
                const active = groupType === g.k;
                return (
                  <button
                    key={g.k}
                    type="button"
                    onClick={() => setGroupType(g.k)}
                    className={[
                      "rounded-2xl border px-3 py-3 text-left text-sm shadow-sm transition active:scale-[0.99]",
                      active
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{g.label}</div>
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-1 text-[11px] ring-1",
                          g.pill,
                        ].join(" ")}
                      >
                        {active ? "Activo" : "Elegir"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mt-4 block">
            <div className="mb-2 text-xs font-semibold text-gray-600">Notas</div>
            <textarea
              className="min-h-[96px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              placeholder="Detalles, ubicación, lo que sea…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Todo el día</div>
              <div className="text-xs text-gray-600">Útil para viajes, cumpleaños o bloqueos.</div>
            </div>

            <button
              type="button"
              onClick={() => setAllDay((v) => !v)}
              className={[
                "relative inline-flex h-7 w-12 items-center rounded-full transition",
                allDay ? "bg-gray-900" : "bg-gray-300",
              ].join(" ")}
              aria-label="Toggle todo el día"
            >
              <span
                className={[
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                  allDay ? "translate-x-6" : "translate-x-1",
                ].join(" ")}
              />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between">
            {initialEvent?.id ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy !== "idle"}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
              >
                <IconTrash size={16} />
                Eliminar
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== "idle"}
              className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-black disabled:opacity-50"
            >
              <IconSave size={16} />
              {busy === "save" ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
