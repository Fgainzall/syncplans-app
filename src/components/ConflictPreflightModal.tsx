"use client";

import React from "react";

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

function fmt(dtIso?: string) {
  if (!dtIso) return "—";

  try {
    const d = new Date(dtIso);
    if (Number.isNaN(d.getTime())) return dtIso;

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
  title,
  items,
  defaultChoice = "edit",
  onClose,
  onChoose,
}: {
  open: boolean;
  title?: string;
  items: PreflightConflict[];
  defaultChoice?: PreflightChoice;
  onClose: () => void;
  onChoose: (choice: PreflightChoice) => void;
}) {
  const [choice, setChoice] = React.useState<PreflightChoice>(defaultChoice);

  React.useEffect(() => {
    if (open) setChoice(defaultChoice);
  }, [open, defaultChoice]);

  if (!open) return null;

  const count = items.length;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
      />

      <div className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#07111f] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-6 py-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] font-medium text-rose-100/85">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            SyncPlans · Conflicto detectado
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            Antes de guardar, resolvamos esto
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            {title ? (
              <>
                <span className="font-semibold text-white/85">“{title}”</span>{" "}
                se cruza con{" "}
                <span className="font-semibold text-white/85">{count}</span>{" "}
                evento{count === 1 ? "" : "s"}.
              </>
            ) : (
              <>
                Este evento se cruza con{" "}
                <span className="font-semibold text-white/85">{count}</span>{" "}
                evento{count === 1 ? "" : "s"}.
              </>
            )}{" "}
            Decide ahora si prefieres editar, conservar lo existente, reemplazar
            o mantener ambos.
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-[24px] border border-white/10 bg-black/25">
            <div className="max-h-[280px] overflow-auto">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={[
                    "p-4 sm:p-5",
                    idx ? "border-t border-white/10" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white/90">
                        {item.title || "Evento existente"}
                      </div>

                      <div className="mt-1 text-xs text-white/60">
                        {item.groupLabel ? `${item.groupLabel} · ` : ""}
                        {item.range || "—"}
                      </div>

                      <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-100/85">
                        <span className="font-medium">Cruce detectado</span>
                        <span className="opacity-60">·</span>
                        <span>
                          {fmt(item.overlapStart)} — {fmt(item.overlapEnd)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                      #{idx + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ChoiceCard
              active={choice === "keep_existing"}
              title="Conservar existente"
              desc="No guardo el nuevo evento."
              onClick={() => setChoice("keep_existing")}
            />

            <ChoiceCard
              active={choice === "replace_with_new"}
              title="Reemplazar"
              desc="El nuevo evento toma prioridad."
              onClick={() => setChoice("replace_with_new")}
            />

            <ChoiceCard
              active={choice === "keep_both"}
              title="Mantener ambos"
              desc="Guardar igual y dejar el conflicto visible."
              onClick={() => setChoice("keep_both")}
            />

            <ChoiceCard
              active={choice === "edit"}
              title="Editar antes"
              desc="Ajusto horario o detalles."
              onClick={() => setChoice("edit")}
            />
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Cerrar
            </button>

            <button
              onClick={() => onChoose(choice)}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:scale-[1.01]"
            >
              Continuar
            </button>
          </div>
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
      type="button"
      onClick={onClick}
      className={[
        "rounded-[22px] border p-4 text-left transition",
        active
          ? "border-white/30 bg-white/10 shadow-[0_10px_30px_rgba(255,255,255,0.06)]"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs leading-5 text-white/60">{desc}</div>
        </div>

        <div
          className={[
            "mt-0.5 h-4 w-4 rounded-full border",
            active
              ? "border-white bg-white"
              : "border-white/25 bg-transparent",
          ].join(" ")}
        />
      </div>
    </button>
  );
}