// src/components/EventEditModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import supabase from "@/lib/supabaseClient";
import type { GroupType } from "@/lib/conflicts";

type EditableGroupType = "personal" | "couple" | "family";

type EditEventShape = {
  id?: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  groupType?: EditableGroupType | GroupType | null;
  groupId?: string | null; // 🔥 NUEVO
};
type EventEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialEvent?: EditEventShape;
  onSaved?: () => void | Promise<void>;
  groups?: { id: string; type: string }[]; // 🔥 NUEVO
};

// Helpers para datetime-local
function isoToLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function localInputToIso(v: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

const groupLabels: { key: EditableGroupType; label: string; hint: string }[] = [
  { key: "personal", label: "Personal", hint: "Sólo tú" },
  { key: "couple", label: "Pareja", hint: "Calendario compartido" },
  { key: "family", label: "Familia", hint: "Todos los miembros" },
];

export function EventEditModal({
  isOpen,
  onClose,
  initialEvent,
  onSaved,
  groups, // 🔥 NUEVO
}: EventEditModalProps) {
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [description, setDescription] = useState("");
  const [groupType, setGroupType] = useState<EditableGroupType>("personal");
  const [allDay, setAllDay] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasId = !!initialEvent?.id;

  // Cargar datos cuando abre o cambia initialEvent
  useEffect(() => {
    if (!isOpen) return;

    const ie = initialEvent;
    if (!ie) {
      setTitle("");
      setStartLocal("");
      setEndLocal("");
      setDescription("");
      setGroupType("personal");
      setAllDay(false);
      setError(null);
      return;
    }

    setTitle(ie.title ?? "");
    setStartLocal(isoToLocalInput(ie.start));
    setEndLocal(isoToLocalInput(ie.end));
    setDescription(ie.description ?? "");

    const gtRaw = (ie.groupType ?? "personal") as any;
    const normalized: EditableGroupType =
      gtRaw === "family" ? "family" : gtRaw === "couple" || gtRaw === "pair"
      ? "couple"
      : "personal";
    setGroupType(normalized);

    // all day guess: si empieza a las 00:00 y termina a las 23:59 o 23:00
    const s = new Date(ie.start);
    const e = new Date(ie.end);
    const isAllDayGuess =
      s.getHours() === 0 &&
      s.getMinutes() === 0 &&
      e.getHours() >= 23;
    setAllDay(isAllDayGuess);

    setError(null);
  }, [isOpen, initialEvent]);

  const canSave = useMemo(() => {
    return (
      !!title.trim() &&
      !!startLocal &&
      !!endLocal &&
      !saving &&
      !deleting
    );
  }, [title, startLocal, endLocal, saving, deleting]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (saving || deleting) return;
    onClose();
  };

  const handleToggleAllDay = () => {
    if (!startLocal) {
      // si no hay fecha aún, nada
      return;
    }
    const d = new Date(startLocal);
    if (Number.isNaN(d.getTime())) return;

    if (!allDay) {
      // Activar "Todo el día" → 00:00 a 23:59 del mismo día
      const pad = (n: number) => String(n).padStart(2, "0");
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      setStartLocal(`${yyyy}-${mm}-${dd}T00:00`);
      setEndLocal(`${yyyy}-${mm}-${dd}T23:59`);
      setAllDay(true);
    } else {
      // Desactivar: mantenemos fechas actuales, sólo cambiamos flag
      setAllDay(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const startIso = localInputToIso(startLocal);
      const endIso = localInputToIso(endLocal);

      if (!startIso || !endIso) {
        setError("Fechas inválidas.");
        setSaving(false);
        return;
      }

      if (!hasId) {
        // No permitimos crear desde aquí: sólo edición
        setError("No se encontró el ID del evento.");
        setSaving(false);
        return;
      }
let newGroupId: string | null = null;

if (groupType !== "personal" && groups?.length) {
  const targetType =
    groupType === "couple" ? "pair" : "family";

  const match = groups.find(
    (g: { id: string; type: string }) =>
      g.type === targetType || g.type === groupType
  );

  newGroupId = match?.id ?? null;
}
      const { error: dbError } = await supabase
        .from("events")
        .update({
  title: title.trim(),
  start: startIso,
  end: endIso,
  notes: description.trim() || null,
  group_id: newGroupId,
})
        .eq("id", initialEvent!.id);

      if (dbError) {
        console.error(dbError);
        setError(dbError.message ?? "No se pudo guardar el evento.");
        setSaving(false);
        return;
      }

      if (onSaved) {
        await onSaved();
      }
      setSaving(false);
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Error inesperado al guardar.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!hasId || deleting) return;

    const ok = confirm(
      `¿Eliminar el evento"${title ? ` "${title}"` : ""}"?\nEsta acción no se puede deshacer.`
    );
    if (!ok) return;

    setDeleting(true);
    setError(null);

    try {
      const { error: dbError } = await supabase
        .from("events")
        .delete()
        .eq("id", initialEvent!.id);

      if (dbError) {
        console.error(dbError);
        setError(dbError.message ?? "No se pudo eliminar el evento.");
        setDeleting(false);
        return;
      }

      if (onSaved) {
        await onSaved();
      }
      setDeleting(false);
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Error inesperado al eliminar.");
      setDeleting(false);
    }
  };

  return (
    <div style={overlayStyles} onClick={handleClose}>
      <div
        style={modalStyles}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div style={headerStyles}>
          <div>
            <div style={badgeStyles}>SYNCPLANS</div>
            <h2 style={titleStyles}>
              {hasId ? "Editar evento" : "Nuevo evento"}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={closeBtnStyles}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div style={formStyles}>
          {/* Título */}
          <div style={fieldStyles}>
            <label style={labelStyles}>Título</label>
            <input
              style={inputStyles}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Corre, cumple, viaje…"
            />
          </div>

          {/* Inicio / Fin */}
          <div style={{ ...fieldStyles, gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyles}>Inicio</label>
              <input
                type="datetime-local"
                style={inputStyles}
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyles}>Fin</label>
              <input
                type="datetime-local"
                style={inputStyles}
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
              />
            </div>
          </div>

          {/* Calendario */}
          <div style={fieldStyles}>
            <label style={labelStyles}>Calendario</label>
            <div style={groupRowStyles}>
              {groupLabels.map((g) => {
                const on = groupType === g.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGroupType(g.key)}
                    style={{
                      ...groupChipStyles,
                      borderColor: on
                        ? "rgba(255,255,255,0.35)"
                        : "rgba(255,255,255,0.12)",
                      background: on
                        ? "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))"
                        : "rgba(15,23,42,0.65)",
                      opacity: on ? 1 : 0.75,
                    }}
                  >
<div
  style={{
    width: 10,
    height: 10,
    borderRadius: 999,
    background:
      g.key === "personal"
        ? "rgba(250,204,21,1)"              // Amarillo (personal)
        : g.key === "couple"
        ? "rgba(248,113,113,0.95)"          // Rojo (pareja)
        : "rgba(59,130,246,0.95)",          // Azul (familia)
  }}
/>

                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {g.label}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.7,
                          lineHeight: 1.2,
                        }}
                      >
                        {g.hint}
                      </div>
                    </div>
                    {on && ( 
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 999,
                          border: "1px solid rgba(129,140,248,0.6)",
                          color: "rgba(191,219,254,0.95)",
                        }}
                      >
                        Activo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas */}
          <div style={fieldStyles}>
            <label style={labelStyles}>Notas</label>
            <textarea
              style={textareaStyles}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles, ubicación, lo que sea…"
              rows={4}
            />
          </div>

          {/* Todo el día */}
          <div style={allDayRowStyles}>
            <div>
              <div style={allDayTitleStyles}>Todo el día</div>
              <div style={allDayHintStyles}>
                Útil para viajes, cumpleaños o bloqueos.
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleAllDay}
              style={{
                ...switchStyles,
                background: allDay
                  ? "rgba(56,189,248,0.85)"
                  : "rgba(15,23,42,1)",
                justifyContent: allDay ? "flex-end" : "flex-start",
              }}
            >
              <div style={switchThumbStyles} />
            </button>
          </div>

          {error && <div style={errorStyles}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={footerStyles}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!hasId || deleting || saving}
            style={{
              ...dangerBtnStyles,
              opacity: !hasId || deleting ? 0.65 : 1,
              cursor:
                !hasId || deleting || saving ? "default" : "pointer",
            }}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving || deleting}
              style={secondaryBtnStyles}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                ...primaryBtnStyles,
                opacity: canSave ? 1 : 0.6,
                cursor: canSave ? "pointer" : "default",
              }}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Styles inline (premium)
   ========================= */

const overlayStyles: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.72)",
  backdropFilter: "blur(18px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 80,
};

const modalStyles: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  borderRadius: 24,
  border: "1px solid rgba(148,163,184,0.35)",
  background:
    "radial-gradient(circle at 0% 0%, rgba(244,114,182,0.12), transparent 55%), radial-gradient(circle at 100% 0%, rgba(56,189,248,0.16), transparent 60%), rgba(15,23,42,0.98)",
  boxShadow: "0 30px 120px rgba(0,0,0,0.65)",
  padding: "18px 20px 16px",
  color: "rgba(248,250,252,0.96)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const headerStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const badgeStyles: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(148,163,184,0.9)",
  marginBottom: 4,
};

const titleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  letterSpacing: "-0.02em",
};

const closeBtnStyles: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.55)",
  background: "rgba(15,23,42,0.9)",
  color: "rgba(248,250,252,0.9)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
};

const formStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginTop: 4,
};

const fieldStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyles: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "rgba(148,163,184,0.95)",
};

const inputBase: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.55)",
  background: "rgba(15,23,42,0.92)",
  color: "rgba(248,250,252,0.96)",
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
};

const inputStyles: React.CSSProperties = {
  ...inputBase,
};

const textareaStyles: React.CSSProperties = {
  ...inputBase,
  resize: "vertical",
  minHeight: 80,
};

const groupRowStyles: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const groupChipStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.55)",
  background: "rgba(15,23,42,0.9)",
  cursor: "pointer",
  minWidth: 0,
  flex: "1 1 0",
};

const allDayRowStyles: React.CSSProperties = {
  marginTop: 6,
  paddingTop: 8,
  borderTop: "1px solid rgba(51,65,85,0.9)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const allDayTitleStyles: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const allDayHintStyles: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.75,
};

const switchStyles: React.CSSProperties = {
  width: 44,
  height: 24,
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,1)",
  background: "rgba(15,23,42,1)",
  padding: 2,
  display: "flex",
  alignItems: "center",
  transition: "all 0.18s ease-out",
};

const switchThumbStyles: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  background: "white",
  boxShadow: "0 4px 10px rgba(15,23,42,0.55)",
};

const errorStyles: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "rgba(248,113,113,0.96)",
};

const footerStyles: React.CSSProperties = {
  marginTop: 4,
  paddingTop: 10,
  borderTop: "1px solid rgba(30,64,175,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const baseBtn: React.CSSProperties = {
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 14px",
  border: "1px solid transparent",
  cursor: "pointer",
};

const dangerBtnStyles: React.CSSProperties = {
  ...baseBtn,
  borderColor: "rgba(248,113,113,0.5)",
  background: "rgba(127,29,29,0.85)",
  color: "rgba(254,242,242,0.96)",
};

const secondaryBtnStyles: React.CSSProperties = {
  ...baseBtn,
  borderColor: "rgba(148,163,184,0.7)",
  background: "rgba(15,23,42,0.9)",
  color: "rgba(226,232,240,0.96)",
};

const primaryBtnStyles: React.CSSProperties = {
  ...baseBtn,
  borderColor: "rgba(56,189,248,0.75)",
  background:
    "linear-gradient(135deg, rgba(56,189,248,0.95), rgba(129,140,248,0.85))",
  color: "white",
};
