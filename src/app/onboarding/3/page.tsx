// src/app/onboarding/3/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function Onboarding3() {
  const router = useRouter();

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
              background: "#ECFDF5",
              color: "#166534",
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
              }}
            />
            3 de 4 · Una sola verdad compartida
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
            SyncPlans pone{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #0EA5E9, #22C55E)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              una sola verdad
            </span>{" "}
            en el centro
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#4B5563",
              marginBottom: 10,
            }}
          >
            En vez de tener versiones distintas en la cabeza, en chats o en
            capturas, todos miran el mismo calendario. SyncPlans detecta
            conflictos y te obliga a decidir antes, no cuando ya es tarde.
          </p>

          {/* Layers preview */}
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
                color: "#111827",
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <span>Hoy · Vista compartida</span>
              <span style={{ color: "#6B7280" }}>Capas sobre la misma agenda</span>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <LayerCard
                title="Personal"
                subtitle="Tus cosas"
                dot="#F59E0B"
                bg="#FFFBEB"
                border="#FDE68A"
                icon="🙂"
              />
              <LayerCard
                title="Pareja"
                subtitle="Planes compartidos"
                dot="#EF4444"
                bg="#FEF2F2"
                border="#FECACA"
                icon="❤️"
              />
              <LayerCard
                title="Familia"
                subtitle="Todos alineados"
                dot="#3B82F6"
                bg="#EFF6FF"
                border="#BFDBFE"
                icon="👨‍👩‍👧‍👦"
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
              ⚖️{" "}
              <b style={{ color: "#111827" }}>
                Piensa en SyncPlans como un árbitro neutral:
              </b>{" "}
              todos juegan en el mismo campo, con las mismas líneas y las mismas
              reglas de tiempo.
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push("/onboarding/4")}
            style={{
              width: "100%",
              padding: "13px 18px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #3B82F6, #22C55E)",
              color: "#F9FAFB",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Siguiente
          </button>

          <button
            onClick={() => router.push("/onboarding/2")}
            style={{
              width: "100%",
              padding: "11px 18px",
              borderRadius: 999,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#4B5563",
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
              color: "#6B7280",
              fontSize: 12,
              marginTop: 10,
            }}
          >
            En la siguiente pantalla verás cómo SyncPlans te obliga a{" "}
            <b>decidir</b> cuando hay conflicto, en vez de discutir después.
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
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          {props.icon}
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
            {props.title}
          </div>
          <div style={{ color: "#6B7280", fontSize: 12 }}>
            {props.subtitle}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#6B7280",
          fontSize: 12,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: props.dot,
          }}
        />
        Capa
      </div>
    </div>
  );
}
