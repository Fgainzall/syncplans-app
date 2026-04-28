// src/app/events/new/details/hooks/useEventForm.tsx

import { useMemo, useState } from "react";
import type { EventTemplate } from "@/lib/eventTemplates";
function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toInputLocal(date: Date) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromInputLocal(value: string) {
  return new Date(value);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}
type SelectedGroup = {
  id: string;
  name: string | null;
  type: string;
} | null;

export type UseEventFormParams = {
  initialStart: Date;
  typeParam: "personal" | "group";
  selectedGroupId: string;
  selectedGroup: SelectedGroup;
  loadingGroups: boolean;
  isEditing: boolean;
  bootingEvent: boolean;
};

export function useEventForm({
  initialStart,
  typeParam,
  selectedGroupId,
  selectedGroup,
  loadingGroups,
  isEditing,
  bootingEvent,
}: UseEventFormParams) {
  const [title, setTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [startLocal, setStartLocal] = useState<string>(() =>
    toInputLocal(initialStart)
  );

  const [endLocal, setEndLocal] = useState<string>(() =>
    toInputLocal(addMinutes(initialStart, 60))
  );

  const [selectedTemplate, setSelectedTemplate] =
    useState<EventTemplate | null>(null);

  const startDate = useMemo(() => fromInputLocal(startLocal), [startLocal]);
  const endDate = useMemo(() => fromInputLocal(endLocal), [endLocal]);

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

  const errors = useMemo(() => {
    const e: string[] = [];

    if (!title.trim()) e.push("Escribe un título.");

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      e.push("Fecha/hora inválida.");
    }

    if (endDate.getTime() <= startDate.getTime()) {
      e.push("La hora de fin debe ser posterior al inicio.");
    }

    if (typeParam === "group") {
      if (loadingGroups) e.push("Cargando grupos…");
      if (!selectedGroupId) e.push("Elige un grupo.");
      if (selectedGroupId && !selectedGroup) e.push("Grupo inválido.");
    }

    if (bootingEvent && isEditing) {
      e.push("Cargando evento…");
    }

    return e;
  }, [
    title,
    startDate,
    endDate,
    typeParam,
    loadingGroups,
    selectedGroupId,
    selectedGroup,
    bootingEvent,
    isEditing,
  ]);

  const canSave = errors.length === 0;

  const onAutoEnd = () => {
    const s = fromInputLocal(startLocal);
    const e = fromInputLocal(endLocal);

    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;

    if (e.getTime() <= s.getTime()) {
      setEndLocal(toInputLocal(addMinutes(s, 60)));
    }
  };

  return {
    title,
    setTitle,
    notes,
    setNotes,

    startLocal,
    setStartLocal,
    endLocal,
    setEndLocal,

    startDate,
    endDate,

    durationLabel,
    errors,
    canSave,

    selectedTemplate,
    setSelectedTemplate,

    onAutoEnd,
  };
}