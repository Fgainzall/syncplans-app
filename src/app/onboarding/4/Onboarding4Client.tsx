// src/app/onboarding/4/Onboarding4Client.tsx
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Onboarding4Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleLogin() {
    router.push(`/auth/login${qsNext}`);
  }

  function handleCreateGroup() {
    router.push("/groups/new");
  }

  function handleStartSolo() {
    router.replace(nextFinal);
  }

  function handleBack() {
    router.push(`/onboarding/3${qsNext}`);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "18px 14px 24px",
        background:
          "radial-gradient(circle at top left, #1D2538 0, #020617 52%, #020617 100%)",
        color: "#E5E7EB",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background:
                  "radial-gradient(circle at 30% 20%, #F97316 0, #FACC15 40%, #92400E 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 1px rgba(248,171,34,0.7)",
                fontSize: 16,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              S
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#9CA3AF",
                  fontWeight: 600,
                }}
              >
                Paso 4 de 4
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#E5E7EB",
                  fontWeight: 500,
                }}
              >
                Decidir juntos es mejor que discutir.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#E5E7EB",
              background: "transparent",
              border: "1px solid rgba(148,163,184,0.4)",
              borderRadius: 999,
              padding: "6px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <span>Ya tengo cuenta</span>
            <span
              aria-hidden
              style={{
                fontSize: 14,
                opacity: 0.9,
              }}
            >
              →
            </span>
          </button>
        </div>

        {/* Content card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            borderRadius: 24,
            border: "1px solid rgba(148,163,184,0.3)",
            background:
              "radial-gradient(circle at top right, rgba(249,115,22,0.22) 0, rgba(15,23,42,0.98) 42%, #020617 100%)",
            boxShadow:
              "0 18px 40px rgba(15,23,42,0.85), 0 0 0 1px rgba(15,23,42,0.9)",
            padding: "22px 18px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column-reverse",
              gap: 24,
            }}
          >
            {/* Left: text */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.55)",
                  background:
                    "linear-gradient(90deg, rgba(15,23,42,0.9), rgba(15,23,42,0.3))",
                  width: "fit-content",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background:
                      "radial-gradient(circle at 30% 20%, #F97316 0, #FACC15 50%, #EA580C 100%)",
                    boxShadow:
                      "0 0 0 1px rgba(248,171,34,0.75), 0 0 12px rgba(248,171,34,0.55)",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#F9FAFB",
                    opacity: 0.9,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Decisión vs discusión
                </span>
              </div>

              <h1
                style={{
                  fontSize: 24,
                  lineHeight: 1.2,
                  fontWeight: 700,
                  color: "#F9FAFB",
                }}
              >
                El conflicto no es malo. El problema es cuando nadie ve qué se
                está decidiendo.
              </h1>

              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#D1D5DB",
                  maxWidth: 520,
                }}
              >
                Cuando SyncPlans detecta un choque, no toma partido por nadie.
                Te muestra las opciones, te deja elegir y registra la decisión.
                Así todos saben qué se priorizó y por qué.
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginTop: 4,
                  maxWidth: 520,
                }}
              >
                <DecisionRow
                  mode="discutir"
                  title="Discutir"
                  text="“Siempre priorizas tus planes”, “nunca avisas nada”, “no me tomas en cuenta”."
                />
                <DecisionRow
                  mode="decidir"
                  title="Decidir"
                  text="“Tenemos dos planes en el mismo horario. ¿Qué queremos priorizar esta vez y por qué?”"
                />
              </div>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#9CA3AF",
                  maxWidth: 480,
                }}
              >
                SyncPlans está diseñado para empujar la conversación hacia la
                decisión, no hacia el reproche. Y eso empieza creando tu primer
                espacio compartido.
              </p>
            </div>

            {/* Right: activation card */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 360,
                  borderRadius: 20,
                  padding: 16,
                  background:
                    "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(15,23,42,0.65))",
                  border: "1px solid rgba(148,163,184,0.55)",
                  boxShadow:
                    "0 18px 40px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.9)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#9CA3AF",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    marginBottom: 2,
                  }}
                >
                  ¿Cómo quieres empezar?
                </div>

                <ActivationCard
                  label="Crear un grupo"
                  chip="Pareja · Familia · Amigos"
                  text="Ideal si ya compartes muchos planes con alguien más y quieren ver los choques juntos."
                  accent="green"
                  onClick={handleCreateGroup}
                  cta="Crear un grupo ahora"
                />

                <ActivationCard
                  label="Empezar solo"
                  chip="Tu calendario + choques futuros"
                  text="Puedes usar SyncPlans para ordenar tu semana y luego invitar a quien quieras más adelante."
                  accent="blue"
                  onClick={handleStartSolo}
                  cta="Empezar solo y ver mi resumen"
                />
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={handleCreateGroup}
              style={{
                width: "100%",
                borderRadius: 999,
                border: "none",
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                background:
                  "linear-gradient(135deg, #22C55E, #16A34A, #15803D)",
                color: "#022C22",
                boxShadow:
                  "0 18px 32px rgba(22,163,74,0.65), 0 0 0 1px rgba(5,46,22,0.95)",
              }}
            >
              Crear mi primer grupo
            </button>

            <button
              type="button"
              onClick={handleBack}
              style={{
                width: "100%",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.6)",
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                background: "transparent",
                color: "#D1D5DB",
              }}
            >
              Volver al paso anterior
            </button>

            <button
              type="button"
              onClick={handleStartSolo}
              style={{
                marginTop: 2,
                width: "100%",
                borderRadius: 999,
                border: "none",
                padding: "6px 16px",
                fontSize: 12,
                fontWeight: 400,
                cursor: "pointer",
                background: "transparent",
                color: "#9CA3AF",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
              }}
            >
              Ir directo a mi resumen sin crear grupo
            </button>

            <div
              style={{
                marginTop: 2,
                display: "flex",
                justifyContent: "center",
                gap: 6,
                alignItems: "center",
                fontSize: 11,
                color: "#9CA3AF",
              }}
            >
              <span>Pantalla 4 de 4</span>
              <span
                aria-hidden
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(148,163,184,0.7)",
                }}
              />
              <span>Decisión · ¿Cómo quieres empezar con SyncPlans?</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

type DecisionRowProps = {
  mode: "discutir" | "decidir";
  title: string;
  text: string;
};

function DecisionRow({ mode, title, text }: DecisionRowProps) {
  const isDecidir = mode === "decidir";
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "9px 11px",
        border: isDecidir
          ? "1px solid rgba(34,197,94,0.7)"
          : "1px solid rgba(248,113,113,0.7)",
        background: isDecidir
          ? "linear-gradient(135deg, rgba(6,95,70,0.9), rgba(6,78,59,0.7))"
          : "linear-gradient(135deg, rgba(127,29,29,0.9), rgba(153,27,27,0.7))",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#F9FAFB",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>{title}</span>
        <span
          style={{
            padding: "2px 8px",
            fontSize: 10,
            borderRadius: 999,
            border: "1px solid rgba(249,250,251,0.26)",
            background: "rgba(15,23,42,0.36)",
          }}
        >
          {isDecidir ? "Lo que buscamos" : "Lo que queremos evitar"}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#F9FAFB",
          lineHeight: 1.6,
        }}
      >
        {text}
      </div>
    </div>
  );
}

type ActivationCardProps = {
  label: string;
  chip: string;
  text: string;
  accent: "green" | "blue";
  cta: string;
  onClick: () => void;
};

function ActivationCard({
  label,
  chip,
  text,
  accent,
  cta,
  onClick,
}: ActivationCardProps) {
  const cfg =
    accent === "green"
      ? {
          border: "rgba(34,197,94,0.7)",
          bg: "rgba(6,95,70,0.3)",
          dot: "#4ADE80",
        }
      : {
          border: "rgba(59,130,246,0.7)",
          bg: "rgba(37,99,235,0.28)",
          dot: "#60A5FA",
        };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        borderRadius: 16,
        border: `1px solid ${cfg.border}`,
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.96), " + cfg.bg + ")",
        padding: "10px 11px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: cfg.dot,
            boxShadow: `0 0 10px ${cfg.dot}`,
          }}
        />
        <div
          style={{
            fontSize: 13,
            color: "#F9FAFB",
            fontWeight: 600,
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#9CA3AF",
        }}
      >
        {chip}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#E5E7EB",
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#E5E7EB",
          marginTop: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>{cta}</span>
        <span
          aria-hidden
          style={{
            fontSize: 14,
            transform: "translateY(0.5px)",
          }}
        >
          →
        </span>
      </div>
    </button>
  );
}