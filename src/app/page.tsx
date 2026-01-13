"use client";

import { useRouter } from "next/navigation";

export default function Onboarding1() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 10%, rgba(56,189,248,0.20), transparent 36%), radial-gradient(circle at 85% 18%, rgba(34,197,94,0.14), transparent 42%), radial-gradient(circle at 55% 92%, rgba(124,58,237,0.14), transparent 48%), linear-gradient(180deg, #020617 0%, #000 120%)",
        color: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "26px",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 460, width: "100%", position: "relative" }}>
        {/* Glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -70,
            background:
              "radial-gradient(circle at 28% 28%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at 72% 30%, rgba(34,197,94,0.14), transparent 58%), radial-gradient(circle at 55% 85%, rgba(124,58,237,0.12), transparent 62%)",
            filter: "blur(18px)",
            opacity: 0.95,
            zIndex: 0,
          }}
        />

        <section
          style={{
            position: "relative",
            zIndex: 1,
            borderRadius: 26,
            padding: "22px 18px 18px",
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.88))",
            border: "1px solid rgba(148,163,184,0.28)",
            boxShadow: "0 22px 60px rgba(15,23,42,0.75)",
            backdropFilter: "blur(14px)",
          }}
        >
          {/* Top row */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.32)",
                background: "rgba(2,6,23,0.55)",
                color: "#9CA3AF",
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#38BDF8",
                  boxShadow: "0 0 0 6px rgba(56,189,248,0.16)",
                }}
              />
              1 de 4 · Bienvenido
            </div>

            <button
              onClick={() => router.push("/login")} // cambia si tu ruta es otra
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.26)",
                background: "rgba(2,6,23,0.35)",
                color: "#CBD5E1",
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
              fontSize: 28,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            Tu agenda,{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #38BDF8, #22C55E)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              sin choques de horario
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#9CA3AF",
              marginBottom: 16,
            }}
          >
            SyncPlans organiza tu vida en un solo lugar y te ayuda a evitar
            conflictos entre tus planes personales, de pareja y de familia.
          </p>

          {/* Premium mini calendar preview */}
          <div
            style={{
              borderRadius: 18,
              padding: 14,
              background:
                "linear-gradient(180deg, rgba(11,18,32,0.9), rgba(2,6,23,0.7))",
              border: "1px solid rgba(148,163,184,0.22)",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#CBD5E1",
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <span>Semana</span>
              <span style={{ color: "#94A3B8" }}>Vista inteligente</span>
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
                    borderRadius: 12,
                    background: "rgba(2,6,23,0.35)",
                    border: "1px solid rgba(148,163,184,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94A3B8",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <QuickEvent
                title="Reunión (Personal)"
                time="09:30"
                dot="#FACC15"
                bg="rgba(250,204,21,0.14)"
                border="rgba(250,204,21,0.25)"
              />
              <QuickEvent
                title="Almuerzo (Pareja)"
                time="13:00"
                dot="#F87171"
                bg="rgba(248,113,113,0.12)"
                border="rgba(248,113,113,0.22)"
              />
              <QuickEvent
                title="Cumpleaños (Familia)"
                time="19:30"
                dot="#60A5FA"
                bg="rgba(96,165,250,0.12)"
                border="rgba(96,165,250,0.22)"
              />
            </div>

            <div
              style={{
                marginTop: 12,
                borderRadius: 16,
                padding: 12,
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.18)",
                color: "#CBD5E1",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              ✨ <b style={{ color: "#E5E7EB" }}>Resultado:</b> claridad inmediata
              por colores + alertas cuando algo se cruza.
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push("/onboarding/2")}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #2563EB, #22C55E)",
              color: "#F9FAFB",
              fontSize: 16,
              fontWeight: 750,
              cursor: "pointer",
              boxShadow: "0 18px 40px rgba(37,99,235,0.35)",
            }}
          >
            Siguiente
          </button>

          <div
            style={{
              textAlign: "center",
              color: "#94A3B8",
              fontSize: 12,
              marginTop: 10,
            }}
          >
            Tip: puedes empezar solo y luego invitar a tu pareja/familia.
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
        borderRadius: 16,
        padding: 12,
        background: props.bg,
        border: `1px solid ${props.border}`,
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
            boxShadow: `0 0 0 6px ${props.dot}22`,
          }}
        />
        <div style={{ fontWeight: 800, fontSize: 13 }}>{props.title}</div>
      </div>

      <div
        style={{
          color: "#E5E7EB",
          fontSize: 12,
          fontWeight: 800,
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(2,6,23,0.45)",
          border: "1px solid rgba(148,163,184,0.18)",
          whiteSpace: "nowrap",
        }}
      >
        {props.time}
      </div>
    </div>
  );
}
