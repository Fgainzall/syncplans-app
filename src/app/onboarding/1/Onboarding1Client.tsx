// src/app/onboarding/1/Onboarding1Client.tsx
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Onboarding1Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleNext() {
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
                  "radial-gradient(circle at 30% 20%, #4ADE80 0, #22C55E 35%, #14532D 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 1px rgba(34,197,94,0.35)",
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
                Paso 1 de 4
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#E5E7EB",
                  fontWeight: 500,
                }}
              >
                Coordinar el tiempo no debería doler.
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
              "radial-gradient(circle at top right, rgba(59,130,246,0.16) 0, rgba(15,23,42,0.98) 42%, #020617 100%)",
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
                  El problema de fondo
                </span>
              </div>

              <h1
                style={{
                  fontSize: 26,
                  lineHeight: 1.15,
                  fontWeight: 700,
                  color: "#F9FAFB",
                }}
              >
                Coordinar horarios no debería ser tan complicado.
              </h1>

              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#D1D5DB",
                  maxWidth: 520,
                }}
              >
                Entre trabajo, familia, amigos y tiempo para ti, es normal que
                las agendas se crucen. Lo que no debería ser normal es que
                contratar una cena o un viaje termine en discusión.
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
                <OnboardingChip text="“Pensé que era otro día.”" />
                <OnboardingChip text="“No vi ese mensaje.”" />
                <OnboardingChip text="“Yo ya tenía algo ese sábado.”" />
              </div>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#9CA3AF",
                  maxWidth: 480,
                }}
              >
                SyncPlans existe para algo muy simple: que hablar de tiempo no
                se sienta como discutir, sino como decidir juntos.
              </p>
            </div>

            {/* Right: visual card */}
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
                    "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(15,23,42,0.65))",
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
                    Semana típica
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
                    Choques ocultos
                  </div>
                </div>

                {/* Fake calendar rows */}
                <FakeRow
                  label="Cena con amigos"
                  tag="Pareja"
                  tone="amber"
                  conflict
                />
                <FakeRow
                  label="Reunión de trabajo"
                  tag="Personal"
                  tone="blue"
                  conflict
                />
                <FakeRow
                  label="Cumpleaños de la mamá"
                  tag="Familia"
                  tone="green"
                  conflict={false}
                />
                <FakeRow
                  label="Entrenamiento"
                  tag="Personal"
                  tone="violet"
                  conflict={false}
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
                      maxWidth: 180,
                      lineHeight: 1.6,
                    }}
                  >
                    Cuando cada uno mira{" "}
                    <span style={{ color: "#E5E7EB" }}>un calendario
                    distinto</span>, los choques se vuelven inevitables.
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#E5E7EB",
                      padding: "4px 9px",
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.7)",
                      background:
                        "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,64,175,0.65))",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Una sola verdad
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
              onClick={handleSkip}
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
              Saltar introducción y ver mi resumen
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
              <span>Pantalla 1 de 4</span>
              <span
                aria-hidden
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(148,163,184,0.7)",
                }}
              />
              <span>Problema · ¿Por qué duele coordinar?</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

type FakeRowProps = {
  label: string;
  tag: "Personal" | "Pareja" | "Familia";
  tone: "amber" | "blue" | "green" | "violet";
  conflict?: boolean;
};

function FakeRow({ label, tag, tone, conflict }: FakeRowProps) {
  const toneMap: Record<
    FakeRowProps["tone"],
    { bg: string; border: string; text: string }
  > = {
    amber: {
      bg: "rgba(180,83,9,0.16)",
      border: "rgba(245,158,11,0.6)",
      text: "#FBBF24",
    },
    blue: {
      bg: "rgba(30,64,175,0.18)",
      border: "rgba(59,130,246,0.65)",
      text: "#60A5FA",
    },
    green: {
      bg: "rgba(22,101,52,0.18)",
      border: "rgba(34,197,94,0.65)",
      text: "#4ADE80",
    },
    violet: {
      bg: "rgba(91,33,182,0.18)",
      border: "rgba(129,140,248,0.7)",
      text: "#A855F7",
    },
  };

  const t = toneMap[tone];

  return (
    <div
      style={{
        borderRadius: 12,
        padding: "8px 10px",
        border: `1px solid ${t.border}`,
        background: `linear-gradient(135deg, rgba(15,23,42,0.96), ${t.bg})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#F9FAFB",
            fontWeight: 500,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#9CA3AF",
          }}
        >
          {tag}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {conflict && (
          <div
            style={{
              fontSize: 10,
              color: "#F97316",
              padding: "3px 7px",
              borderRadius: 999,
              border: "1px solid rgba(248,113,113,0.65)",
              background:
                "radial-gradient(circle at 30% 10%, rgba(248,250,252,0.96), rgba(185,28,28,0.7))",
              boxShadow: "0 0 14px rgba(248,113,113,0.45)",
              whiteSpace: "nowrap",
            }}
          >
            Choque
          </div>
        )}
      </div>
    </div>
  );
}

type ChipProps = {
  text: string;
};

function OnboardingChip({ text }: ChipProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(15,23,42,0.88)",
        border: "1px solid rgba(55,65,81,0.9)",
        width: "fit-content",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background:
            "radial-gradient(circle at 30% 20%, #F97316 0, #FACC15 50%, #EA580C 100%)",
          boxShadow: "0 0 10px rgba(234,88,12,0.55)",
        }}
      />
      <span
        style={{
          fontSize: 12,
          color: "#E5E7EB",
        }}
      >
        {text}
      </span>
    </div>
  );
}