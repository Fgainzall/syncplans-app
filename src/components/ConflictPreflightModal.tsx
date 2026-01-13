"use client";

import React from "react";

export type PreflightChoice = "edit" | "keep_existing" | "replace_with_new";

export type PreflightConflict = {
  id: string;
  title?: string;
  groupLabel?: string;
  start: string; // ISO
  end: string;   // ISO
  overlapStart?: string; // ISO
  overlapEnd?: string;   // ISO
};

function fmt(dtIso: string) {
  try {
    const d = new Date(dtIso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dtIso;
  }
}

export default function ConflictPreflightModal({
  open,
  conflicts,
  proposedTitle,
  defaultChoice = "edit",
  onClose,
  onChoose,
}: {
  open: boolean;
  conflicts: PreflightConflict[];
  proposedTitle?: string;
  defaultChoice?: PreflightChoice;
  onClose: () => void;
  onChoose: (choice: PreflightChoice) => void;
}) {
  const [choice, setChoice] = React.useState<PreflightChoice>(defaultChoice);

  React.useEffect(() => {
    if (open) setChoice(defaultChoice);
  }, [open, defaultChoice]);

  if (!open) return null;

  const count = conflicts.length;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* backdrop */}
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
      />

      {/* panel */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#050816] shadow-2xl">
        <div className="p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            SyncPlans · Conflictos
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            Antes de guardar, resolvamos esto
          </h2>

          <p className="mt-2 text-sm text-white/60">
            {proposedTitle ? (
              <>
                <span className="font-semibold text-white/75">“{proposedTitle}”</span>{" "}
                se cruza con <span className="font-semibold text-white/75">{count}</span>{" "}
                evento{count === 1 ? "" : "s"}.
              </>
            ) : (
              <>
                Este evento se cruza con{" "}
                <span className="font-semibold text-white/75">{count}</span> evento
                {count === 1 ? "" : "s"}.
              </>
            )}
          </p>
        </div>

        {/* list */}
        <div className="mx-6 mb-6 rounded-2xl border border-white/10 bg-black/30">
          <div className="max-h-[260px] overflow-auto">
            {conflicts.map((c, idx) => (
              <div key={c.id} className={["p-4", idx ? "border-t border-white/10" : ""].join(" ")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white/90">
                      {c.title ?? "Evento existente"}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {c.groupLabel ? `${c.groupLabel} · ` : ""}
                      {fmt(c.start)} — {fmt(c.end)}
                    </div>
                    {c.overlapStart && c.overlapEnd ? (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-100/80">
                        Se cruza: {fmt(c.overlapStart)} — {fmt(c.overlapEnd)}
                      </div>
                    ) : null}
                  </div>

                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                    #{idx + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* choices */}
        <div className="px-6 pb-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Choice
              active={choice === "keep_existing"}
              title="Conservar existente"
              desc="No guardo el nuevo."
              onClick={() => setChoice("keep_existing")}
            />
            <Choice
              active={choice === "replace_with_new"}
              title="Reemplazar por el nuevo"
              desc="El nuevo gana."
              onClick={() => setChoice("replace_with_new")}
            />
            <Choice
              active={choice === "edit"}
              title="Editar antes"
              desc="Ajustar horas/título."
              onClick={() => setChoice("edit")}
            />
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Cancelar
            </button>

            <button
              onClick={() => onChoose(choice)}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Continuar
            </button>
          </div>

          <div className="mt-3 text-xs text-white/50">
            Tip: esto se conecta con tus Settings (warn-before-save + default-resolution).
          </div>
        </div>
      </div>
    </div>
  );
}

function Choice({
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
      className={[
        "rounded-2xl border p-4 text-left transition",
        active ? "border-emerald-400/25 bg-emerald-500/10" : "border-white/10 bg-white/5 hover:bg-white/10",
      ].join(" ")}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-white/60">{desc}</div>
    </button>
  );
}
