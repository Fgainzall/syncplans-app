// src/app/onboarding/3/Onboarding3Client.tsx
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Onboarding3Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleNext() {
    router.push(`/onboarding/4${qsNext}`);
  }

  function handleBack() {
    router.push(`/onboarding/2${qsNext}`);
  }

  function handleSkip() {
    router.replace(nextFinal);
  }

  function handleLogin() {
    router.push(`/auth/login${qsNext}`);
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
                  "radial-gradient(circle at 30% 20%, #22C55E 0, #10B981 35%, #064E3B 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 1px rgba(16,185,129,0.65)",
                fontSize: 16,
                fontWeight: 800,
                color: "#022C22",
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
                Paso 3 de 4
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#E5E7EB",
                  fontWeight: 500,
                }}
              >
                Una sola verdad en el centro.
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
              "radial-gradient(circle at top right, rgba(34,197,94,0.16) 0, rgba(15,23,42,0.98) 42%, #020617 100%)",
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
                      "radial-gradient(circle at 30% 20%, #22C55E 0, #4ADE80 50%, #15803D 100%)",
                    boxShadow:
                      "0 0 0 1px rgba(34,197,94,0.65), 0 0 12px rgba(34,197,94,0.45)",
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
                  Propuesta de valor
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
                SyncPlans pone una sola verdad en el centro para que decidir sea
                más fácil que discutir.
              </h1>

              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#D1D5DB",
                  maxWidth: 520,
                }}
              >
                En vez de que cada uno tenga su calendario y mil chats, todo
                aterriza en un solo lugar que ambos pueden ver. Cuando aparece
                un choque, lo ven juntos antes de que se convierta en problema.
              </p>

              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "4px 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxWidth: 520,
                }}
              >
                <ValueBullet
                  title="Detecta choques automáticamente"
                  text="SyncPlans identifica cuándo dos planes compiten por el mismo tiempo y te lo muestra de forma visual."
                />
                <ValueBullet
                  title="Nada se borra sin verlo antes"
                  text="No hay agendas que desaparecen en el aire. Las decisiones se toman viendo las dos opciones."
                />
                <ValueBullet
                  title="Todos ven lo mismo"
                  text="Tu pareja, tu familia o tu grupo: todos miran la misma versión de la semana, no capturas de pantalla sueltas."
                />
              </ul>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#9CA3AF",
                  maxWidth: 480,
                }}
              >
                SyncPlans no reemplaza tus calendarios. Se conecta a ellos y
                actúa como un <span style={{ color: "#E5E7EB" }}>árbitro
                neutral</span> del tiempo compartido.
              </p>
            </div>

            {/* Right: visual */}
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
                  padding: 14,
                  background:
                    "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(15,23,42,0.65))",
                  border: "1px solid rgba(148,163,184,0.55)",
                  boxShadow:
                    "0 18px 40px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.9)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9CA3AF",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Una sola vista compartida
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: "rgba(15,23,42,0.9)",
                      border: "1px solid rgba(148,163,184,0.65)",
                      fontSize: 11,
                      color: "#E5E7EB",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background:
                          "radial-gradient(circle at 30% 20%, #22C55E 0, #4ADE80 45%, #16A34A 100%)",
                      }}
                    />
                    Personal · Pareja · Familia
                  </div>
                </div>

                <SharedRow
                  scope="Personal"
                  label="Tu calendario de trabajo"
                  status="Conectado"
                  accent="blue"
                />
                <SharedRow
                  scope="Pareja"
                  label="Plan de finde juntos"
                  status="En revisión"
                  accent="amber"
                />
                <SharedRow
                  scope="Familia"
                  label="Cumpleaños y eventos clave"
                  status="Confirmado"
                  accent="green"
                />

                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 8,
                    borderTop: "1px dashed rgba(55,65,81,0.9)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9CA3AF",
                      maxWidth: 190,
                      lineHeight: 1.6,
                    }}
                  >
                    Los choques no se esconden en ningún chat: aparecen aquí
                    para que los decidan juntos.
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#E5E7EB",
                      padding: "4px 9px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.7)",
                      background:
                        "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(22,163,74,0.65))",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Menos sorpresa, más acuerdos
                  </div>
                </div>
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
              onClick={handleNext}
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
              Seguir
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
              onClick={handleSkip}
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
              Saltar y ver directamente mi resumen
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
              <span>Pantalla 3 de 4</span>
              <span
                aria-hidden
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(148,163,184,0.7)",
                }}
              />
              <span>Propuesta · ¿Qué hace diferente a SyncPlans?</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

type ValueBulletProps = {
  title: string;
  text: string;
};

function ValueBullet({ title, text }: ValueBulletProps) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          marginTop: 6,
          background:
            "radial-gradient(circle at 30% 20%, #22C55E 0, #4ADE80 50%, #15803D 100%)",
        }}
      />
      <div>
        <div
          style={{
            fontSize: 13,
            color: "#E5E7EB",
            fontWeight: 500,
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#D1D5DB",
            lineHeight: 1.5,
          }}
        >
          {text}
        </div>
      </div>
    </li>
  );
}

type SharedRowProps = {
  scope: string;
  label: string;
  status: string;
  accent: "blue" | "amber" | "green";
};

function SharedRow({ scope, label, status, accent }: SharedRowProps) {
  const map = {
    blue: {
      dot: "#60A5FA",
      pillBg: "rgba(37,99,235,0.16)",
      pillBorder: "rgba(59,130,246,0.7)",
    },
    amber: {
      dot: "#FBBF24",
      pillBg: "rgba(180,83,9,0.16)",
      pillBorder: "rgba(245,158,11,0.7)",
    },
    green: {
      dot: "#4ADE80",
      pillBg: "rgba(22,101,52,0.18)",
      pillBorder: "rgba(34,197,94,0.7)",
    },
  } as const;

  const cfg = map[accent];

  return (
    <div
      style={{
        borderRadius: 12,
        padding: "8px 10px",
        border: "1px solid rgba(55,65,81,0.9)",
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.8))",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: cfg.dot,
          boxShadow: `0 0 10px ${cfg.dot}`,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#9CA3AF",
          }}
        >
          {scope}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#F9FAFB",
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          padding: "4px 8px",
          borderRadius: 999,
          border: `1px solid ${cfg.pillBorder}`,
          background: cfg.pillBg,
          color: "#E5E7EB",
          whiteSpace: "nowrap",
        }}
      >
        {status}
      </div>
    </div>
  );
}