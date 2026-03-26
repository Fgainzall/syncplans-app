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

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const count = items.length;
  const selected = choiceCopy(choice);

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-[#020617]/82 backdrop-blur-md"
      />

      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.18),transparent_28%),linear-gradient(180deg,rgba(7,11,22,0.98),rgba(5,8,20,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />

            <div className="border-b border-white/10 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-rose-100/90 uppercase">
                  <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.85)]" />
                  Conflicto detectado
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/65">
                  SyncPlans
                </div>
              </div>

              <div className="mt-4 max-w-3xl">
                <h2 className="text-[28px] font-black tracking-[-0.04em] text-white sm:text-[34px]">
                  Antes de guardar, decide cómo quieres manejar este cruce
                </h2>

                <p className="mt-3 text-sm leading-7 text-white/70 sm:text-[15px]">
                  {title ? (
                    <>
                      <span className="font-semibold text-white">“{title}”</span>{" "}
                      se cruza con{" "}
                      <span className="font-semibold text-white">{count}</span>{" "}
                      evento{count === 1 ? "" : "s"} ya visible
                      {count === 1 ? "" : "s"} en tu coordinación.
                    </>
                  ) : (
                    <>
                      Este evento se cruza con{" "}
                      <span className="font-semibold text-white">{count}</span>{" "}
                      evento{count === 1 ? "" : "s"} ya visible
                      {count === 1 ? "" : "s"}.
                    </>
                  )}{" "}
                  Elige ahora si prefieres ajustar, conservar lo actual,
                  reemplazarlo o seguir con ambos.
                </p>
              </div>
            </div>

            <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
              <section className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100/70">
                      Eventos que chocan
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      Revisa qué ya existe antes de decidir.
                    </div>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                    {count} cruce{count === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
                  {items.map((item, idx) => (
                    <article
                      key={item.id}
                      className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-bold tracking-[-0.02em] text-white">
                            {item.title || "Evento existente"}
                          </div>

                          <div className="mt-1 text-sm text-white/60">
                            {item.groupLabel ? `${item.groupLabel} · ` : ""}
                            {item.range || "—"}
                          </div>
                        </div>

                        <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/60">
                          #{idx + 1}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] font-medium text-amber-100/90">
                          <span className="h-2 w-2 rounded-full bg-amber-300" />
                          Cruce detectado
                        </span>

                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/65">
                          {fmt(item.overlapStart)} — {fmt(item.overlapEnd)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                <div className="mb-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100/70">
                    Tu decisión
                  </div>
                  <div className="mt-1 text-sm text-white/60">
                    Elige cómo quieres que SyncPlans actúe ahora.
                  </div>
                </div>

                <div className="grid gap-3">
                  <ChoiceCard
                    active={choice === "edit"}
                    tone="blue"
                    title="Editar antes"
                    desc="Vuelves al formulario para ajustar horario o detalles."
                    onClick={() => setChoice("edit")}
                  />

                  <ChoiceCard
                    active={choice === "keep_existing"}
                    tone="slate"
                    title="Conservar lo existente"
                    desc="No se guarda este nuevo evento."
                    onClick={() => setChoice("keep_existing")}
                  />

                  <ChoiceCard
                    active={choice === "replace_with_new"}
                    tone="violet"
                    title="Reemplazar con el nuevo"
                    desc="El nuevo evento toma prioridad."
                    onClick={() => setChoice("replace_with_new")}
                  />

                  <ChoiceCard
                    active={choice === "keep_both"}
                    tone="amber"
                    title="Mantener ambos"
                    desc="Se guarda igual y el conflicto sigue visible."
                    onClick={() => setChoice("keep_both")}
                  />
                </div>

                <div className="mt-4 rounded-[22px] border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.03))] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100/75">
                    Selección actual
                  </div>

                  <div className="mt-2 text-lg font-bold tracking-[-0.03em] text-white">
                    {selected.title}
                  </div>

                  <div className="mt-1 text-sm font-medium text-cyan-100/70">
                    {selected.eyebrow}
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/68">
                    {selected.desc}
                  </p>
                </div>
              </section>
            </div>

            <div className="border-t border-white/10 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
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

function ChoiceCard({
  active,
  title,
  desc,
  onClick,
  tone,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
  tone: "blue" | "slate" | "violet" | "amber";
}) {
  const toneClasses =
    tone === "blue"
      ? active
        ? "border-cyan-300/45 bg-cyan-300/[0.08] shadow-[0_12px_30px_rgba(34,211,238,0.12)]"
        : "border-white/10 bg-white/[0.03] hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]"
      : tone === "violet"
      ? active
        ? "border-violet-300/40 bg-violet-300/[0.08] shadow-[0_12px_30px_rgba(139,92,246,0.12)]"
        : "border-white/10 bg-white/[0.03] hover:border-violet-300/20 hover:bg-violet-300/[0.04]"
      : tone === "amber"
      ? active
        ? "border-amber-300/40 bg-amber-300/[0.08] shadow-[0_12px_30px_rgba(251,191,36,0.10)]"
        : "border-white/10 bg-white/[0.03] hover:border-amber-300/20 hover:bg-amber-300/[0.04]"
      : active
      ? "border-white/25 bg-white/[0.08] shadow-[0_12px_30px_rgba(255,255,255,0.06)]"
      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group rounded-[22px] border p-4 text-left transition-all",
        toneClasses,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">{title}</div>
          <div className="mt-1 text-xs leading-5 text-white/62">{desc}</div>
        </div>

        <div
          className={[
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
            active
              ? "border-white bg-white"
              : "border-white/20 bg-transparent group-hover:border-white/35",
          ].join(" ")}
        >
          {active ? <div className="h-2 w-2 rounded-full bg-slate-900" /> : null}
        </div>
      </div>
    </button>
  );
}