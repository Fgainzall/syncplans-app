"use client";

import { useRouter } from "next/navigation";

export default function Onboarding2() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 18% 12%, rgba(56,189,248,0.20), transparent 36%), radial-gradient(circle at 82% 18%, rgba(124,58,237,0.18), transparent 40%), radial-gradient(circle at 55% 92%, rgba(34,197,94,0.14), transparent 46%), linear-gradient(180deg, #020617 0%, #000 120%)",
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
              "radial-gradient(circle at 28% 35%, rgba(56,189,248,0.20), transparent 55%), radial-gradient(circle at 78% 28%, rgba(124,58,237,0.18), transparent 55%), radial-gradient(circle at 55% 85%, rgba(34,197,94,0.12), transparent 60%)",
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
          {/* Badge */}
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
            2 de 4 · Conflictos inteligentes
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
            Evita choques{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #38BDF8, #7C3AED)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              antes de que pasen
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
            SyncPlans detecta cruces de horario y te lo muestra claro, con
            sugerencias rápidas para reprogramar sin estrés.
          </p>

          {/* Premium “conflict preview” */}
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
              <span>Hoy</span>
              <span style={{ color: "#94A3B8" }}>Detección en vivo</span>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <EventRow
                pill="Pareja"
                pillBg="rgba(248,113,113,0.12)"
                pillBorder="rgba(248,113,113,0.22)"
                dot="#F87171"
                title="Cena con Ara"
                time="20:00 – 21:30"
              />
              <EventRow
                pill="Personal"
                pillBg="rgba(250,204,21,0.14)"
                pillBorder="rgba(250,204,21,0.25)"
                dot="#FACC15"
                title="Gym"
                time="20:30 – 22:00"
              />

              {/* Conflict callout */}
              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  background: "rgba(59,130,246,0.10)",
                  border: "1px solid rgba(59,130,246,0.22)",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: "rgba(2,6,23,0.55)",
                    border: "1px solid rgba(148,163,184,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                  }}
                >
                  ⚡
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#E5E7EB" }}>
                    Conflicto detectado (30 min)
                  </div>
                  <div style={{ color: "#9CA3AF", fontSize: 12, lineHeight: 1.45 }}>
                    Mueve <b style={{ color: "#E5E7EB" }}>Gym</b> a 19:00 o cambia{" "}
                    <b style={{ color: "#E5E7EB" }}>Cena</b> a 21:30. Tú eliges.
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <MiniAction label="Reprogramar" />
                    <MiniAction label="Ver opciones" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push("/onboarding/3")}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #2563EB, #7C3AED)",
              color: "#F9FAFB",
              fontSize: 16,
              fontWeight: 750,
              cursor: "pointer",
              boxShadow: "0 18px 40px rgba(37,99,235,0.35)",
            }}
          >
            Siguiente
          </button>

          <button
            onClick={() => router.push("/onboarding/1")}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(2,6,23,0.45)",
              color: "#CBD5E1",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 10,
            }}
          >
            Volver
          </button>

          <div
            style={{
              textAlign: "center",
              color: "#94A3B8",
              fontSize: 12,
              marginTop: 10,
            }}
          >
            Tip: los conflictos se ven igual en la agenda.
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
        borderRadius: 16,
        padding: 12,
        background: "rgba(2,6,23,0.35)",
        border: "1px solid rgba(148,163,184,0.16)",
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
        <div>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{props.title}</div>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>{props.time}</div>
        </div>
      </div>

      <span
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          background: props.pillBg,
          border: `1px solid ${props.pillBorder}`,
          color: "#E5E7EB",
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {props.pill}
      </span>
    </div>
  );
}

function MiniAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      style={{
        borderRadius: 999,
        padding: "8px 10px",
        border: "1px solid rgba(148,163,184,0.28)",
        background: "rgba(2,6,23,0.45)",
        color: "#E5E7EB",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
