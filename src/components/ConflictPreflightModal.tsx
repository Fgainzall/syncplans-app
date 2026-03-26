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

function choiceCopy(choice: PreflightChoice) {
  switch (choice) {
    case "keep_existing":
      return {
        eyebrow: "Conservar lo actual",
        title: "No guardar este nuevo evento",
        desc: "Mantienes intacto el evento que ya existe y cancelas este guardado.",
      };
    case "replace_with_new":
      return {
        eyebrow: "Dar prioridad al nuevo",
        title: "Reemplazar el evento existente",
        desc: "El nuevo evento toma prioridad y el otro deja de ser el plan principal.",
      };
    case "keep_both":
      return {
        eyebrow: "Aceptar el cruce",
        title: "Guardar ambos y revisar luego",
        desc: "Se guarda igual. El conflicto seguirá visible para decidirlo más adelante.",
      };
    case "edit":
    default:
      return {
        eyebrow: "Ajustar antes",
        title: "Volver a editar este evento",
        desc: "Cambias horario o detalles antes de guardar para evitar el cruce.",
      };
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

  React.useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const count = items.length;
  const selected = choiceCopy(choice);
  const first = items[0];

  return (
    <div className="fixed inset-0 z-[120]">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-[#020617]/84 backdrop-blur-md"
      />

      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-t-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_32%),linear-gradient(180deg,rgba(6,10,24,0.98),rgba(4,8,20,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:rounded-[30px]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />

            <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-rose-100/90 uppercase">
                  <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.85)]" />
                  Conflicto detectado
                </div>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/65">
                  SyncPlans
                </div>
              </div>

              <div className="mt-4 max-w-2xl">
                <h2 className="text-[24px] font-black tracking-[-0.05em] text-white sm:text-[34px]">
                  Antes de guardar, elige una salida simple
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-white/72">
                  {title ? (
                    <>
                      <span className="font-semibold text-white">“{title}”</span> se cruza con{' '}
                      <span className="font-semibold text-white">{count}</span> evento{count === 1 ? '' : 's'} ya visible{count === 1 ? '' : 's'}.
                    </>
                  ) : (
                    <>
                      Este evento se cruza con <span className="font-semibold text-white">{count}</span> evento{count === 1 ? '' : 's'} ya visible{count === 1 ? '' : 's'}.
                    </>
                  )} Decide ahora qué prefieres hacer.
                </p>
              </div>
            </div>

            <div className="border-y border-white/8 bg-white/[0.02] px-4 py-4 sm:px-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100/72">Cruce principal</div>
                  <div className="mt-1 text-sm text-white/58">Lo que ya existe y está chocando con este guardado.</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/68">{count} cruce{count === 1 ? '' : 's'}</div>
              </div>

              {first ? (
                <article className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[22px] font-black tracking-[-0.04em] text-white">{first.title || 'Evento existente'}</div>
                      <div className="mt-1 text-sm text-white/62">{first.groupLabel ? `${first.groupLabel} · ` : ''}{first.range || '—'}</div>
                    </div>
                    <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/62">#{1}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] font-medium text-amber-100/90">
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      Cruce detectado
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/65">{fmt(first.overlapStart)} — {fmt(first.overlapEnd)}</span>
                  </div>
                </article>
              ) : null}
            </div>

            <div className="px-4 py-4 sm:px-6 sm:py-5">
              <div className="mb-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100/72">Tu decisión</div>
                <div className="mt-1 text-sm text-white/58">Toca una opción. La idea es resolverlo sin fricción.</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <QuickChoice
                  active={choice === "edit"}
                  title="Ajustar horario"
                  subtitle="Vuelves a editar antes de guardar"
                  color="blue"
                  onClick={() => setChoice("edit")}
                />
                <QuickChoice
                  active={choice === "keep_existing"}
                  title="Quedarme con el actual"
                  subtitle="No guardo este nuevo evento"
                  color="gray"
                  onClick={() => setChoice("keep_existing")}
                />
                <QuickChoice
                  active={choice === "replace_with_new"}
                  title="Priorizar este"
                  subtitle="El nuevo reemplaza al existente"
                  color="purple"
                  onClick={() => setChoice("replace_with_new")}
                />
                <QuickChoice
                  active={choice === "keep_both"}
                  title="Mantener ambos"
                  subtitle="Guardar igual y decidir después"
                  color="amber"
                  onClick={() => setChoice("keep_both")}
                />
              </div>

              <div className="mt-4 rounded-[22px] border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.03))] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100/75">Selección actual</div>
                <div className="mt-2 text-xl font-black tracking-[-0.04em] text-white">{selected.title}</div>
                <div className="mt-1 text-sm font-medium text-cyan-100/70">{selected.eyebrow}</div>
                <p className="mt-3 text-sm leading-6 text-white/68">{selected.desc}</p>
              </div>
            </div>

            <div className="border-t border-white/10 bg-[rgba(5,8,20,0.88)] px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white/72 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={() => onChoose(choice)}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(59,130,246,0.98),rgba(124,58,237,0.98))] px-5 text-sm font-bold text-white shadow-[0_16px_40px_rgba(59,130,246,0.28)] transition hover:scale-[1.01]"
                >
                  Continuar con esta decisión
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickChoice({
  active,
  title,
  subtitle,
  onClick,
  color,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
  color: "blue" | "gray" | "purple" | "amber";
}) {
  const tones = {
    blue: active
      ? "border-cyan-400/70 bg-cyan-400/12 shadow-[0_12px_30px_rgba(34,211,238,0.12)]"
      : "border-white/10 bg-white/[0.03] hover:border-cyan-300/25 hover:bg-cyan-300/[0.04]",
    gray: active
      ? "border-white/35 bg-white/10 shadow-[0_12px_30px_rgba(255,255,255,0.06)]"
      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
    purple: active
      ? "border-violet-400/70 bg-violet-400/12 shadow-[0_12px_30px_rgba(139,92,246,0.12)]"
      : "border-white/10 bg-white/[0.03] hover:border-violet-300/25 hover:bg-violet-300/[0.04]",
    amber: active
      ? "border-amber-400/70 bg-amber-400/12 shadow-[0_12px_30px_rgba(251,191,36,0.10)]"
      : "border-white/10 bg-white/[0.03] hover:border-amber-300/25 hover:bg-amber-300/[0.04]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[22px] border p-4 text-left transition-all ${tones[color]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-black tracking-[-0.03em] text-white">{title}</div>
          <div className="mt-1 text-sm leading-6 text-white/62">{subtitle}</div>
        </div>
        <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? 'border-white bg-white' : 'border-white/20 bg-transparent'}`}>
          {active ? <div className="h-2 w-2 rounded-full bg-slate-900" /> : null}
        </div>
      </div>
    </button>
  );
}