"use client";

import React, { useEffect, useMemo, useState } from "react";

type PreflightChoice =
  | "edit"
  | "keep_existing"
  | "replace_with_new"
  | "keep_both";

type PreflightItem = {
  id: string;
  existingId: string;
  title: string;
  groupLabel: string;
  range: string;
  overlapStart: string;
  overlapEnd: string;
  incomingTitle?: string;
  incomingGroupLabel?: string;
  incomingRange?: string;
  overlapRange?: string;
  isLikelyDuplicate?: boolean;
};

type Props = {
  open: boolean;
  title: string;
  items: PreflightItem[];
  defaultChoice?: PreflightChoice;
  onClose: () => void;
  onChoose: (choice: PreflightChoice) => void;
};

function plural(count: number, singular: string, pluralText: string) {
  return count === 1 ? singular : pluralText;
}

function actionLabel(choice: PreflightChoice, hasDuplicate: boolean) {
  if (choice === "edit") return "Ajustar antes de guardar";
  if (choice === "keep_existing") {
    return hasDuplicate ? "No guardar duplicado" : "Conservar evento existente";
  }
  if (choice === "replace_with_new") return "Reemplazar existente";
  return "Guardar igual";
}

export default function ConflictPreflightModal({
  open,
  title,
  items,
  defaultChoice = "edit",
  onClose,
  onChoose,
}: Props) {
  const hasDuplicate = useMemo(
    () => items.some((item) => Boolean(item.isLikelyDuplicate)),
    [items],
  );

  const recommendedChoice: PreflightChoice = hasDuplicate
    ? "keep_existing"
    : defaultChoice || "edit";

  const [selectedChoice, setSelectedChoice] =
    useState<PreflightChoice>(recommendedChoice);

useEffect(() => {
  if (!open) return;

  const timer = window.setTimeout(() => {
    setSelectedChoice(recommendedChoice);
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [open, recommendedChoice]);

  if (!open) return null;

  const firstItem = items[0] ?? null;
  const visibleTitle = String(title || firstItem?.incomingTitle || "Nuevo plan").trim();
  const incomingRange = firstItem?.incomingRange ?? "Revisa la fecha y hora";
  const incomingGroupLabel = firstItem?.incomingGroupLabel ?? "Plan nuevo";
  const count = items.length;

  return (
    <div className="sp-conflictOverlay" role="presentation">
      <div
        className="sp-conflictBackdrop"
        role="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
      />

      <section
        className="sp-conflictSheet"
        role="dialog"
        aria-modal="true"
        aria-label="Conflicto detectado antes de guardar"
      >
        <div className="sp-conflictHandle" />

        <div className="sp-conflictHeader">
          <div className="sp-conflictTopline">
            <span className="sp-conflictPill danger">Conflicto detectado</span>
            <span className="sp-conflictPill neutral">SyncPlans</span>
          </div>

          <h2 className="sp-conflictTitle">Antes de guardar, revisa este cruce</h2>
          <p className="sp-conflictLead">
            <strong>“{visibleTitle}”</strong> se cruza con {count}{" "}
            {plural(count, "evento ya guardado", "eventos ya guardados")}. Mira ambos lados antes de decidir.
          </p>
        </div>

        <div className="sp-conflictBody">
          {hasDuplicate ? (
            <div className="sp-duplicateAlert">
              <div className="sp-duplicateEyebrow">Posible duplicado</div>
              <div className="sp-duplicateText">
                Parece el mismo evento que ya se guardó antes. Probablemente se volvió a tocar <strong>Guardar</strong>. Para no duplicarlo, elige <strong>No guardar duplicado</strong>.
              </div>
            </div>
          ) : null}

          <div className="sp-sectionLabel">Plan que estás guardando</div>
          <div className="sp-eventCard incoming">
            <div className="sp-cardHead">
              <div className="sp-eventTitle">{visibleTitle}</div>
              <span className="sp-tag blue">Nuevo</span>
            </div>
            <div className="sp-eventMeta">{incomingGroupLabel} · {incomingRange}</div>
          </div>

          <div className="sp-sectionLabel">Se cruza con</div>
          <div className="sp-conflictList">
            {items.map((item) => (
              <div key={item.id || item.existingId} className="sp-eventCard existing">
                <div className="sp-cardHead">
                  <div className="sp-eventTitle">{item.title || "Evento existente"}</div>
                  <span className={item.isLikelyDuplicate ? "sp-tag amber" : "sp-tag pink"}>
                    {item.isLikelyDuplicate ? "Ya guardado" : "Existente"}
                  </span>
                </div>
                <div className="sp-eventMeta">{item.groupLabel || "Calendario"} · {item.range || "Fecha no disponible"}</div>
                <div className="sp-overlapChip">
                  Cruce exacto: {item.overlapRange || item.range || "revisa el horario"}
                </div>
              </div>
            ))}
          </div>

          <div className="sp-sectionLabel">Tu decisión</div>
          <div className="sp-optionsGrid">
            {hasDuplicate ? (
              <button
                type="button"
                className={selectedChoice === "keep_existing" ? "sp-option selected recommended" : "sp-option recommended"}
                onClick={() => setSelectedChoice("keep_existing")}
              >
                <span>No guardar duplicado</span>
                <small>Conserva el evento que ya existe</small>
              </button>
            ) : null}

            <button
              type="button"
              className={selectedChoice === "edit" ? "sp-option selected" : "sp-option"}
              onClick={() => setSelectedChoice("edit")}
            >
              <span>Ajustar horario</span>
              <small>Vuelves a editar antes de guardar</small>
            </button>

            {!hasDuplicate ? (
              <button
                type="button"
                className={selectedChoice === "replace_with_new" ? "sp-option selected" : "sp-option"}
                onClick={() => setSelectedChoice("replace_with_new")}
              >
                <span>Reemplazar existente</span>
                <small>Guarda este plan y quita el anterior si tienes permiso</small>
              </button>
            ) : null}

            <button
              type="button"
              className={selectedChoice === "keep_both" ? "sp-option selected danger" : "sp-option danger"}
              onClick={() => setSelectedChoice("keep_both")}
            >
              <span>{hasDuplicate ? "Guardar duplicado igual" : "Guardar ambos"}</span>
              <small>{hasDuplicate ? "Solo úsalo si realmente son dos eventos distintos" : "Mantiene los dos planes visibles"}</small>
            </button>
          </div>
        </div>

        <div className="sp-conflictFooter">
          <button type="button" className="sp-closeBtn" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="sp-primaryBtn"
            onClick={() => onChoose(selectedChoice)}
          >
            {actionLabel(selectedChoice, hasDuplicate)}
          </button>
        </div>
      </section>

      <style>{`
        .sp-conflictOverlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          color: rgba(255,255,255,0.94);
        }

        .sp-conflictBackdrop {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(700px 420px at 30% 8%, rgba(56,189,248,0.18), transparent 65%),
            radial-gradient(680px 420px at 82% 18%, rgba(168,85,247,0.18), transparent 62%),
            rgba(2,6,23,0.78);
          backdrop-filter: blur(16px);
        }

        .sp-conflictSheet {
          position: relative;
          width: min(620px, 100%);
          max-height: min(88vh, 760px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 30px;
          border: 1px solid rgba(255,255,255,0.12);
          background:
            linear-gradient(180deg, rgba(15,23,42,0.97), rgba(3,7,18,0.98)),
            #050816;
          box-shadow: 0 32px 90px rgba(0,0,0,0.58);
        }

        .sp-conflictHandle {
          display: none;
          width: 68px;
          height: 5px;
          border-radius: 999px;
          margin: 12px auto 0;
          background: rgba(148,163,184,0.34);
        }

        .sp-conflictHeader {
          padding: 28px 30px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .sp-conflictTopline {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .sp-conflictPill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.12);
        }

        .sp-conflictPill.danger {
          color: #fecdd3;
          border-color: rgba(244,63,94,0.30);
          background: rgba(244,63,94,0.13);
        }

        .sp-conflictPill.neutral {
          color: rgba(226,232,240,0.82);
          background: rgba(255,255,255,0.05);
        }

        .sp-conflictTitle {
          margin: 0;
          font-size: clamp(30px, 7vw, 48px);
          line-height: 0.98;
          letter-spacing: -0.055em;
          font-weight: 950;
        }

        .sp-conflictLead {
          margin: 16px 0 0;
          max-width: 54ch;
          color: rgba(226,232,240,0.82);
          font-size: 15px;
          line-height: 1.55;
          font-weight: 650;
        }

        .sp-conflictLead strong {
          color: #fff;
          font-weight: 900;
        }

        .sp-conflictBody {
          padding: 22px 30px 18px;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        }

        .sp-sectionLabel {
          margin: 20px 0 9px;
          color: rgba(186,230,253,0.86);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .sp-sectionLabel:first-of-type {
          margin-top: 0;
        }

        .sp-eventCard {
          border-radius: 22px;
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(15,23,42,0.72);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .sp-eventCard.incoming {
          border-color: rgba(56,189,248,0.26);
          background: linear-gradient(135deg, rgba(8,47,73,0.72), rgba(15,23,42,0.78));
        }

        .sp-eventCard.existing {
          border-color: rgba(244,63,94,0.20);
          background: linear-gradient(135deg, rgba(76,29,149,0.26), rgba(15,23,42,0.78));
        }

        .sp-cardHead {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        .sp-eventTitle {
          min-width: 0;
          overflow-wrap: anywhere;
          font-size: 19px;
          line-height: 1.12;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .sp-eventMeta {
          margin-top: 9px;
          color: rgba(203,213,225,0.78);
          font-size: 13px;
          font-weight: 650;
          line-height: 1.45;
        }

        .sp-tag {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 7px 9px;
          font-size: 11px;
          font-weight: 950;
          line-height: 1;
          border: 1px solid rgba(255,255,255,0.12);
          white-space: nowrap;
        }

        .sp-tag.blue {
          color: #bae6fd;
          background: rgba(14,165,233,0.14);
          border-color: rgba(14,165,233,0.28);
        }

        .sp-tag.pink {
          color: #fecdd3;
          background: rgba(244,63,94,0.13);
          border-color: rgba(244,63,94,0.24);
        }

        .sp-tag.amber {
          color: #fde68a;
          background: rgba(245,158,11,0.14);
          border-color: rgba(245,158,11,0.28);
        }

        .sp-conflictList {
          display: grid;
          gap: 10px;
        }

        .sp-overlapChip {
          display: inline-flex;
          margin-top: 12px;
          border-radius: 999px;
          padding: 8px 11px;
          max-width: 100%;
          color: rgba(255,255,255,0.84);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .sp-duplicateAlert {
          margin-bottom: 20px;
          border-radius: 22px;
          border: 1px solid rgba(245,158,11,0.30);
          background: linear-gradient(135deg, rgba(245,158,11,0.16), rgba(15,23,42,0.82));
          padding: 15px;
        }

        .sp-duplicateEyebrow {
          color: #fde68a;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 7px;
        }

        .sp-duplicateText {
          color: rgba(255,251,235,0.88);
          font-size: 13px;
          line-height: 1.5;
          font-weight: 700;
        }

        .sp-optionsGrid {
          display: grid;
          gap: 10px;
        }

        .sp-option {
          width: 100%;
          text-align: left;
          border-radius: 19px;
          padding: 15px 16px;
          border: 1px solid rgba(148,163,184,0.16);
          background: rgba(15,23,42,0.72);
          color: rgba(255,255,255,0.90);
          cursor: pointer;
          transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
        }

        .sp-option:hover {
          transform: translateY(-1px);
          border-color: rgba(56,189,248,0.35);
        }

        .sp-option.selected {
          border-color: rgba(56,189,248,0.74);
          background: linear-gradient(135deg, rgba(8,47,73,0.92), rgba(15,23,42,0.84));
          box-shadow: 0 0 0 1px rgba(56,189,248,0.12) inset;
        }

        .sp-option.recommended.selected {
          border-color: rgba(34,197,94,0.64);
          background: linear-gradient(135deg, rgba(20,83,45,0.60), rgba(15,23,42,0.86));
        }

        .sp-option.danger.selected {
          border-color: rgba(244,63,94,0.50);
          background: linear-gradient(135deg, rgba(127,29,29,0.44), rgba(15,23,42,0.86));
        }

        .sp-option span {
          display: block;
          font-size: 16px;
          font-weight: 950;
          letter-spacing: -0.01em;
        }

        .sp-option small {
          display: block;
          margin-top: 5px;
          color: rgba(203,213,225,0.76);
          font-size: 12px;
          font-weight: 650;
          line-height: 1.35;
        }

        .sp-conflictFooter {
          display: grid;
          grid-template-columns: 0.9fr 1.35fr;
          gap: 12px;
          padding: 16px 30px 24px;
          border-top: 1px solid rgba(255,255,255,0.08);
          background: rgba(2,6,23,0.78);
        }

        .sp-closeBtn,
        .sp-primaryBtn {
          min-height: 54px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.10);
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
        }

        .sp-closeBtn {
          color: rgba(226,232,240,0.9);
          background: rgba(15,23,42,0.82);
        }

        .sp-primaryBtn {
          color: white;
          border-color: rgba(96,165,250,0.28);
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          box-shadow: 0 16px 38px rgba(59,130,246,0.22);
        }

        @media (max-width: 680px) {
          .sp-conflictOverlay {
            align-items: flex-end;
            padding: 0;
          }

          .sp-conflictSheet {
            width: 100%;
            max-height: 94vh;
            border-radius: 30px 30px 0 0;
            border-left: 0;
            border-right: 0;
            border-bottom: 0;
          }

          .sp-conflictHandle {
            display: block;
          }

          .sp-conflictHeader {
            padding: 18px 24px 18px;
          }

          .sp-conflictTitle {
            font-size: clamp(34px, 10vw, 48px);
          }

          .sp-conflictLead {
            font-size: 15px;
          }

          .sp-conflictBody {
            padding: 18px 24px 16px;
          }

          .sp-eventCard {
            border-radius: 21px;
            padding: 15px;
          }

          .sp-cardHead {
            gap: 10px;
          }

          .sp-eventTitle {
            font-size: 18px;
          }

          .sp-conflictFooter {
            grid-template-columns: 1fr;
            padding: 14px 24px max(20px, env(safe-area-inset-bottom));
          }

          .sp-primaryBtn {
            order: -1;
          }
        }
      `}</style>
    </div>
  );
}
