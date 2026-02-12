// src/app/onboarding/4/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function Onboarding4Page() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleLogin() {
    router.push(`/auth/login${qsNext}`);
  }

  function handleCreateAccount() {
    router.push(`/auth/register${qsNext}`);
  }

  function handleBack() {
    router.push(`/onboarding/3${qsNext}`);
  }

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
      <div style={{ maxWidth: 480, width: "100%", position: "relative" }}>
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
                background: "#ECFDF5",
                color: "#166534",
                fontSize: 12,
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
              4 de 4 · Decidir mejor, discutir menos
            </div>

            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 16,
                display: "grid",
                placeItems: "center",
                border: "1px solid #E5E7EB",
                background: "#F9FAFB",
                fontSize: 20,
              }}
            >
              ⚖️
            </div>
          </div>

          <h1
            style={{
              margin: "14px 0 0",
              fontSize: 26,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              color: "#0F172A",
            }}
          >
            Decidir es mejor que{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #0EA5E9, #6366F1)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              discutir
            </span>{" "}
            después
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "#4B5563",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Cuando dos planes se cruzan, SyncPlans no se queda callado. Te muestra
            el choque y te pide una decisión clara, para que exista{" "}
            <strong>una sola versión de la verdad</strong> para ambos.
          </p>

          {/* Opciones de resolución */}
          <div
            style={{
              marginTop: 16,
              borderRadius: 18,
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              padding: 12,
              display: "grid",
              gap: 8,
            }}
          >
            <OptionRow
              index="1"
              title="Conservar uno"
              status="Decisión"
              statusBg="#DCFCE7"
              statusBorder="#BBF7D0"
              copy="Eliges qué plan se queda. El otro se mueve o se cancela. Simple, claro."
            />
            <OptionRow
              index="2"
              title="Conservar ambos"
              status="Acordado"
              statusBg="#DBEAFE"
              statusBorder="#BFDBFE"
              copy="Aceptas que convivan. El choque queda visible, sin autoengaños."
            />
            <OptionRow
              index="3"
              title="Ajustar después"
              status="Pendiente"
              statusBg="#FEF9C3"
              statusBorder="#FEF08A"
              copy="Lo dejas marcado como tema pendiente. Nada se borra. Ambos lo ven."
            />
          </div>

          {/* CTA PRINCIPAL */}
          <button
            style={{
              marginTop: 16,
              width: "100%",
              borderRadius: 999,
              padding: "13px 16px",
              border: "none",
              background: "linear-gradient(90deg, #3B82F6, #22C55E)",
              color: "white",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
            }}
            onClick={handleCreateAccount}
          >
            Crear cuenta
          </button>

          {/* CTA SECUNDARIA */}
          <button
            style={{
              marginTop: 10,
              width: "100%",
              borderRadius: 999,
              padding: "11px 16px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#4B5563",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
            onClick={handleLogin}
          >
            Ya tengo cuenta
          </button>

          <button
            style={{
              marginTop: 8,
              width: "100%",
              borderRadius: 999,
              padding: "11px 16px",
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
              color: "#4B5563",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
            onClick={handleBack}
          >
            Volver
          </button>

          <div
            style={{
              marginTop: 12,
              textAlign: "center",
              fontSize: 12,
              color: "#6B7280",
            }}
          >
            Después de crear tu cuenta podrás{" "}
            <strong>crear un grupo de pareja</strong> e invitar a tu persona.
            (Familia y grupos también existen, pero lo potente empieza en pareja.)
          </div>
        </section>
      </div>
    </main>
  );
}

function OptionRow(props: {
  index: string;
  title: string;
  copy: string;
  status: string;
  statusBg: string;
  statusBorder: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: 10,
        borderRadius: 16,
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          background: "#E5E7EB",
          color: "#111827",
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        {props.index}
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
          {props.title}
        </div>
        <div style={{ fontSize: 12, color: "#4B5563" }}>{props.copy}</div>
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          padding: "6px 10px",
          borderRadius: 999,
          border: `1px solid ${props.statusBorder}`,
          background: props.statusBg,
          color: "#111827",
          whiteSpace: "nowrap",
        }}
      >
        {props.status}
      </div>
    </div>
  );
}