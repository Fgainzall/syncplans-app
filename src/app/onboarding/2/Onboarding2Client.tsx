// src/app/onboarding/2/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function Onboarding2() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 0% 0%, rgba(191,219,254,0.75), transparent 55%), radial-gradient(circle at 100% 0%, rgba(221,214,254,0.75), transparent 55%), linear-gradient(180deg, #F9FAFB 0%, #EEF2FF 100%)",
        color: "#0F172A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "26px",
      }}
    >
      <div style={{ maxWidth: 460, width: "100%", position: "relative" }}>
        <section
          style={{
            position: "relative",
            zIndex: 1,
            borderRadius: 24,
            padding: "22px 18px 18px",
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            boxShadow:
              "0 18px 40px rgba(15,23,42,0.07), 0 0 0 1px rgba(148,163,184,0.08)",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #E5E7EB",
              background: "#EEF2FF",
              color: "#4B5563",
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#0EA5E9",
              }}
            />
            2 de 4 · Situaciones que ya conoces
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 26,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              marginBottom: 10,
              color: "#0F172A",
            }}
          >
            El problema no es el{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #0EA5E9, #6366F1)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              calendario
            </span>
            .<br />
            Es la coordinación.
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#4B5563",
              marginBottom: 12,
            }}
          >
            Los choques casi nunca son por mala intención. Pasa porque cada uno
            termina con su versión del día: en la cabeza, en WhatsApp o en apps
            distintas.
          </p>

          {/* Frases reconocibles */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {["Pensé que era otro día", "No vi ese mensaje", "Ya tenía algo"].map(
              (text) => (
                <div
                  key={text}
                  style={{
                    borderRadius: 999,
                    padding: "7px 12px",
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    fontSize: 12,
                    color: "#374151",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 10px 25px rgba(148,163,184,0.25)",
                  }}
                >
                  <span style={{ fontSize: 14 }}>💬</span>
                  <span>{text}</span>
                </div>
              )
            )}
          </div>

          {/* Conflict preview */}
          <div
            style={{
              borderRadius: 18,
              padding: 14,
              background: "#F9FAFB",
              border: "1px solid #E5E7EB",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#111827",
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <span style={{ fontWeight: 700 }}>Ejemplo real</span>
              <span style={{ color: "#6B7280" }}>Dos planes, misma hora</span>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <EventRow
                pill="Pareja"
                pillBg="#FEF2F2"
                pillBorder="#FECACA"
                dot="#EF4444"
                title="Cena con Ara"
                time="20:00 – 21:30"
              />
              <EventRow
                pill="Tu agenda"
                pillBg="#FFFBEB"
                pillBorder="#FDE68A"
                dot="#F59E0B"
                title="Gym"
                time="20:30 – 22:00"
              />

              <div
                style={{
                  borderRadius: 14,
                  padding: 12,
                  background: "#DBEAFE",
                  border: "1px solid #BFDBFE",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 12,
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                  }}
                >
                  ⚡
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 13,
                      color: "#1F2933",
                    }}
                  >
                    Conflicto típico: nadie lo vio a tiempo
                  </div>
                  <div
                    style={{
                      color: "#374151",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    Uno lo apuntó. El otro lo tenía en la cabeza o en un chat.
                    Resultado: <b style={{ color: "#111827" }}>choque asegurado</b>.
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderRadius: 14,
                  padding: 12,
                  background: "#ECFDF5",
                  border: "1px solid #BBF7D0",
                  color: "#374151",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                SyncPlans existe para que esos choques{" "}
                <b style={{ color: "#111827" }}>se vean antes</b> y se resuelvan
                con una decisión clara.
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push(`/onboarding/3${qsNext}`)}
            style={{
              width: "100%",
              padding: "13px 18px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #3B82F6, #6366F1)",
              color: "#F9FAFB",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Seguir
          </button>

          <button
            onClick={() => router.push(`/onboarding/1${qsNext}`)}
            style={{
              width: "100%",
              padding: "11px 18px",
              borderRadius: 999,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#4B5563",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 10,
            }}
          >
            Volver
          </button>

          <div
            style={{
              textAlign: "center",
              color: "#6B7280",
              fontSize: 12,
              marginTop: 10,
            }}
          >
            Esto pasa en parejas ocupadas todo el tiempo. SyncPlans existe para
            que pase menos.
          </div>
        </section>
      </div>
    </main>
  );
}

function EventRow(props: {
  pill: string;
  pillBg: string;
  pillBorder: string;
  dot: string;
  title: string;
  time: string;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: 10,
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: props.dot,
          }}
        />
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#111827" }}>
            {props.title}
          </div>
          <div style={{ color: "#6B7280", fontSize: 12 }}>{props.time}</div>
        </div>
      </div>

      <span
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          background: props.pillBg,
          border: `1px solid ${props.pillBorder}`,
          color: "#374151",
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        {props.pill}
      </span>
    </div>
  );
}