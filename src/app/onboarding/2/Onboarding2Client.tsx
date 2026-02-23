// src/app/onboarding/2/Onboarding2Client.tsx
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Onboarding2Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleNext() {
    router.push(`/onboarding/3${qsNext}`);
  }

  function handleBack() {
    router.push(`/onboarding/1${qsNext}`);
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
                  "radial-gradient(circle at 30% 20%, #38BDF8 0, #4F46E5 40%, #1D1B4C 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 1px rgba(129,140,248,0.55)",
                fontSize: 16,
                fontWeight: 800,
                color: "#E0F2FE",
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
                Paso 2 de 4
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#E5E7EB",
                  fontWeight: 500,
                }}
              >
                El problema no es el calendario. Es la coordinación.
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
              "radial-gradient(circle at top right, rgba(59,130,246,0.18) 0, rgba(15,23,42,0.98) 42%, #020617 100%)",
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
                      "radial-gradient(circle at 30% 20%, #F97316 0, #FACC15 50%, #854D0E 100%)",
                    boxShadow:
                      "0 0 0 1px rgba(250,204,21,0.65), 0 0 12px rgba(251,191,36,0.45)",
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
                  Fricción reconocible
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
                La mayoría de discusiones no son por el plan, sino por el
                “¿por qué nadie me avisó?”.
              </h1>

              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#D1D5DB",
                  maxWidth: 520,
                }}
              >
                Uno lo tiene en el calendario del trabajo. El otro en su
                calendario personal. A veces solo en un chat. Y cuando todo se
                mezcla, nadie ve la foto completa.
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 4,
                  marginBottom: 4,
                }}
              >
                <DialogueBubble
                  who="Tú"
                  text="Pero si estaba en mi calendario..."
                />
                <DialogueBubble
                  who="Tu pareja"
                  text="Yo nunca vi ese plan ¿dónde lo pusiste?"
                />
                <DialogueBubble
                  who="Ambos"
                  text="¿Y ahora a quién cancelamos?"
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
                No es que falte un calendario más. Lo que falta es una{" "}
                <span style={{ color: "#E5E7EB" }}>versión compartida de la
                realidad</span> donde todos vean lo mismo antes de decir que sí
                a un plan.
              </p>
            </div>

            {/* Right: visual timeline */}
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
                    Cómo se arma el caos
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
                          "radial-gradient(circle at 30% 20%, #F97316 0, #EC4899 45%, #4F46E5 100%)",
                      }}
                    />
                    Versiones distintas
                  </div>
                </div>

                <TimelineRow
                  step="1"
                  label="Plan en el chat"
                  detail="“Domingo almuerzo en casa de mis papás”"
                  type="chat"
                />
                <TimelineRow
                  step="2"
                  label="Evento en tu calendario"
                  detail="“Domingo: almuerzo con suegros”"
                  type="calendar"
                />
                <TimelineRow
                  step="3"
                  label="Evento en su calendario"
                  detail="“Domingo: viaje con amigos”"
                  type="calendar"
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
                    Cada uno miró{" "}
                    <span style={{ color: "#E5E7EB" }}>su propia versión</span>{" "}
                    de la semana. Nadie vio el choque a tiempo.
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#F97316",
                      padding: "4px 9px",
                      borderRadius: 999,
                      border: "1px solid rgba(248,113,113,0.7)",
                      background:
                        "radial-gradient(circle at 30% 10%, rgba(251,113,133,0.96), rgba(127,29,29,0.8))",
                      whiteSpace: "nowrap",
                      boxShadow: "0 0 14px rgba(248,113,113,0.45)",
                    }}
                  >
                    Discusión asegurada
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
              <span>Pantalla 2 de 4</span>
              <span
                aria-hidden
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(148,163,184,0.7)",
                }}
              />
              <span>Fricción · ¿Por qué terminamos discutiendo?</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

type DialogueBubbleProps = {
  who: string;
  text: string;
};

function DialogueBubble({ who, text }: DialogueBubbleProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        background: "rgba(15,23,42,0.88)",
        border: "1px solid rgba(55,65,81,0.9)",
        borderRadius: 16,
        padding: "8px 10px",
        maxWidth: 520,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          background:
            "radial-gradient(circle at 30% 20%, #38BDF8 0, #6366F1 50%, #1D1B4C 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#E0F2FE",
          flexShrink: 0,
        }}
      >
        {who[0]}
      </div>
      <div
        style={{
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
          {who}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#E5E7EB",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

type TimelineRowProps = {
  step: string;
  label: string;
  detail: string;
  type: "chat" | "calendar";
};

function TimelineRow({ step, label, detail, type }: TimelineRowProps) {
  const isChat = type === "chat";
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 20,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 999,
            background: isChat ? "#F97316" : "#4F46E5",
            color: "#F9FAFB",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isChat
              ? "0 0 10px rgba(248,113,113,0.7)"
              : "0 0 10px rgba(129,140,248,0.7)",
          }}
        >
          {step}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          borderRadius: 12,
          padding: "7px 9px",
          border: "1px solid rgba(55,65,81,0.9)",
          background: isChat
            ? "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(251,146,60,0.22))"
            : "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(59,130,246,0.22))",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#E5E7EB",
            fontWeight: 500,
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#CBD5F5" as any,
          }}
        >
          {detail}
        </div>
      </div>
    </div>
  );
}