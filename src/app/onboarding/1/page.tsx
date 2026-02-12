// src/app/onboarding/1/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function OnboardingIntro() {
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
          {/* Top row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
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
              1 de 4 · Por qué existe SyncPlans
            </div>

            <button
              onClick={() => router.push(`/auth/login${qsNext}`)}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 999,
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                color: "#4B5563",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Saltar
            </button>
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
            Coordinar con tu pareja{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #0EA5E9, #22C55E)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              no debería ser un problema
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#4B5563",
              marginBottom: 16,
            }}
          >
            El caos no es “el calendario”. Es la coordinación: alguien no vio el
            mensaje, pensó que era otro día… o ya tenía algo encima.
          </p>

          {/* Mini calendar preview (soft) */}
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
              <span style={{ fontWeight: 700 }}>Semana real</span>
              <span style={{ color: "#6B7280" }}>Todo mezclado</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <div
                  key={i}
                  style={{
                    height: 34,
                    borderRadius: 10,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6B7280",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <QuickEvent
                title="Reunión (trabajo)"
                time="09:30"
                dot="#F59E0B"
                bg="#FFFBEB"
                border="#FDE68A"
              />
              <QuickEvent
                title="Cena (pareja)"
                time="20:00"
                dot="#EF4444"
                bg="#FEF2F2"
                border="#FECACA"
              />
              <QuickEvent
                title="Plan compartido"
                time="19:30"
                dot="#3B82F6"
                bg="#EFF6FF"
                border="#BFDBFE"
              />
            </div>

            <div
              style={{
                marginTop: 12,
                borderRadius: 14,
                padding: 12,
                background: "#ECFDF5",
                border: "1px solid #BBF7D0",
                color: "#374151",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              💬 <b style={{ color: "#111827" }}>Hoy suele verse así:</b> un poco
              en el calendario, un poco en WhatsApp, un poco en notas.
              <br />
              SyncPlans pone{" "}
              <b style={{ color: "#111827" }}>una sola versión de la verdad</b>{" "}
              en el centro.
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push(`/onboarding/2${qsNext}`)}
            style={{
              width: "100%",
              padding: "13px 18px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #3B82F6, #22C55E)",
              color: "#F9FAFB",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Seguir
          </button>

          <div
            style={{
              textAlign: "center",
              color: "#6B7280",
              fontSize: 12,
              marginTop: 10,
            }}
          >
            En 60 segundos verás cómo SyncPlans actúa como{" "}
            <b>árbitro neutral</b> del tiempo compartido.
          </div>
        </section>
      </div>
    </main>
  );
}

function QuickEvent(props: {
  title: string;
  time: string;
  dot: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: 10,
        background: props.bg,
        border: `1px solid ${props.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: props.dot,
          }}
        />
        <div style={{ fontWeight: 800, fontSize: 13, color: "#111827" }}>
          {props.title}
        </div>
      </div>

      <div
        style={{
          color: "#111827",
          fontSize: 12,
          fontWeight: 800,
          padding: "5px 10px",
          borderRadius: 999,
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          whiteSpace: "nowrap",
        }}
      >
        {props.time}
      </div>
    </div>
  );
}