"use client";

import { useRouter } from "next/navigation";

export default function Onboarding3() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 10%, rgba(56,189,248,0.22), transparent 35%), radial-gradient(circle at 80% 15%, rgba(34,197,94,0.18), transparent 40%), radial-gradient(circle at 50% 90%, rgba(37,99,235,0.14), transparent 45%), linear-gradient(180deg, #020617 0%, #000 120%)",
        color: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "26px",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 460, width: "100%", position: "relative" }}>
        {/* Glow detrás del card */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -60,
            background:
              "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.22), transparent 55%), radial-gradient(circle at 70% 40%, rgba(34,197,94,0.18), transparent 55%)",
            filter: "blur(18px)",
            opacity: 0.9,
            zIndex: 0,
          }}
        />

        {/* Card principal */}
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
                background: "#22C55E",
                boxShadow: "0 0 0 6px rgba(34,197,94,0.16)",
              }}
            />
            3 de 4 · Capas de tu vida
          </div>

          {/* Título */}
          <h1
            style={{
              fontSize: 28,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            Organización para{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #38BDF8, #22C55E)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              ti, tu pareja y tu familia
            </span>
          </h1>

          {/* Subtítulo */}
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#9CA3AF",
              marginBottom: 18,
            }}
          >
            SyncPlans separa tus planes en capas para que entiendas todo de un
            vistazo y evites choques antes de que ocurran.
          </p>

          {/* Mini “preview” tipo agenda */}
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
                color: "#CBD5E1",
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <span>Hoy</span>
              <span style={{ color: "#94A3B8" }}>Vista rápida</span>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <LayerCard
                title="Personal"
                subtitle="Tus cosas"
                dot="#FACC15"
                bg="rgba(250,204,21,0.14)"
                border="rgba(250,204,21,0.25)"
                icon="🟡"
              />
              <LayerCard
                title="Pareja"
                subtitle="Planes compartidos"
                dot="#F87171"
                bg="rgba(248,113,113,0.12)"
                border="rgba(248,113,113,0.22)"
                icon="🔴"
              />
              <LayerCard
                title="Familia"
                subtitle="Todos alineados"
                dot="#60A5FA"
                bg="rgba(96,165,250,0.12)"
                border="rgba(96,165,250,0.22)"
                icon="🔵"
              />
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push("/onboarding/4")} // cambia a una ruta que exista
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #2563EB, #22C55E)",
              color: "#F9FAFB",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 18px 40px rgba(37,99,235,0.35)",
            }}
          >
            Siguiente
          </button>

          <button
            onClick={() => router.push("/onboarding/2")}
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
            Tip: verás colores consistentes en toda la app.
          </div>
        </section>
      </div>
    </main>
  );
}

function LayerCard(props: {
  title: string;
  subtitle: string;
  dot: string;
  bg: string;
  border: string;
  icon: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 12px",
        borderRadius: 16,
        background: props.bg,
        border: `1px solid ${props.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          {props.icon}
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{props.title}</div>
          <div style={{ color: "#CBD5E1", fontSize: 12 }}>{props.subtitle}</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#94A3B8",
          fontSize: 12,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: props.dot,
            boxShadow: `0 0 0 6px ${props.dot}22`,
          }}
        />
        Capa
      </div>
    </div>
  );
}
