// src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  // Si hay sesión, esto NO es marketing: es app. Lo mandamos directo.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const { data } = await supabase.auth.getSession();
        const hasSession = !!data?.session;

        if (!cancelled && hasSession) {
          router.replace("/summary");
          return;
        }
      } catch {
        // si falla, mostramos landing igual
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingSession) return null;

  const nextAfterAuth = encodeURIComponent("/onboarding/1");

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 18% 12%, rgba(56,189,248,0.18), transparent 40%), radial-gradient(circle at 82% 18%, rgba(34,197,94,0.12), transparent 44%), radial-gradient(circle at 55% 92%, rgba(124,58,237,0.12), transparent 50%), linear-gradient(180deg, #020617 0%, #000 120%)",
        color: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px",
        overflow: "hidden",
      }}
    >
      <div style={{ width: "100%", maxWidth: 980, position: "relative" }}>
        {/* Glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -120,
            background:
              "radial-gradient(circle at 28% 28%, rgba(56,189,248,0.16), transparent 56%), radial-gradient(circle at 72% 30%, rgba(34,197,94,0.12), transparent 58%), radial-gradient(circle at 58% 86%, rgba(124,58,237,0.10), transparent 62%)",
            filter: "blur(18px)",
            opacity: 0.95,
            zIndex: 0,
          }}
        />

        <section
          style={{
            position: "relative",
            zIndex: 1,
            borderRadius: 28,
            border: "1px solid rgba(148,163,184,0.26)",
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.88))",
            boxShadow: "0 30px 80px rgba(15,23,42,0.75)",
            backdropFilter: "blur(14px)",
            padding: "28px 22px",
          }}
        >
          {/* Top bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.28)",
                background: "rgba(2,6,23,0.45)",
                color: "#CBD5E1",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "#22C55E",
                  boxShadow: "0 0 0 6px rgba(34,197,94,0.14)",
                }}
              />
              SyncPlans
              <span style={{ color: "#94A3B8", fontWeight: 700 }}>
                · Para parejas ocupadas
              </span>
            </div>

            <button
              onClick={() => router.push(`/auth/login?next=${nextAfterAuth}`)}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(2,6,23,0.25)",
                color: "#E5E7EB",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Iniciar sesión
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.05fr 0.95fr",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            {/* Left: Hero */}
            <div
              style={{
                borderRadius: 22,
                padding: "18px 16px",
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(2,6,23,0.20)",
              }}
            >
              <h1
                style={{
                  fontSize: 42,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  marginBottom: 12,
                }}
              >
                Compartan su tiempo{" "}
                <span
                  style={{
                    background: "linear-gradient(90deg, #38BDF8, #22C55E)",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  sin discutir por él
                </span>
                .
              </h1>

              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.7,
                  color: "#A3AAB7",
                  marginBottom: 16,
                  maxWidth: 520,
                }}
              >
                SyncPlans detecta choques, organiza decisiones y mantiene{" "}
                <b style={{ color: "#E5E7EB" }}>una sola versión de la verdad</b>
                . Especialmente cuando tu agenda se cruza con la de tu pareja.
              </p>

              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                <ValueRow
                  title="Detecta choques antes de que sean problema"
                  subtitle="Te avisa cuando algo se cruza. Sin sorpresas."
                />
                <ValueRow
                  title="Deciden con claridad, no con discusiones"
                  subtitle="Conservar, reemplazar o ajustar. Todo visible."
                />
                <ValueRow
                  title="Ambos ven lo mismo"
                  subtitle="Menos WhatsApp. Más orden. Cero ambigüedad."
                />
              </div>

              {/* CTA limpio (SIN duplicados) */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() =>
                    router.push(`/auth/register?next=${nextAfterAuth}`)
                  }
                  style={{
                    height: 46,
                    padding: "0 18px",
                    borderRadius: 999,
                    border: "none",
                    background: "linear-gradient(135deg, #2563EB, #22C55E)",
                    color: "#F9FAFB",
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 18px 40px rgba(37,99,235,0.30)",
                    letterSpacing: "0.01em",
                  }}
                >
                  Crear cuenta
                </button>

                <button
                  onClick={() =>
                    router.push(`/onboarding/1?next=${nextAfterAuth}`)
                  }
                  style={{
                    height: 46,
                    padding: "0 16px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.22)",
                    background: "rgba(2,6,23,0.30)",
                    color: "#E5E7EB",
                    fontSize: 14,
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                >
                  Ver cómo funciona
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    color: "#94A3B8",
                    fontSize: 12,
                    fontWeight: 700,
                    marginLeft: 4,
                  }}
                >
                  Toma 60 segundos.
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  color: "#94A3B8",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                También sirve para <b style={{ color: "#CBD5E1" }}>familia</b> y{" "}
                <b style={{ color: "#CBD5E1" }}>grupos</b>. Pero primero: parejas
                ocupadas.
              </div>
            </div>

            {/* Right: Preview */}
            <PreviewCard
              onPrimary={() =>
                router.push(`/auth/register?next=${nextAfterAuth}`)
              }
              onSecondary={() => router.push(`/auth/login?next=${nextAfterAuth}`)}
            />
          </div>

          {/* Bottom micro trust */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(148,163,184,0.12)",
              paddingTop: 14,
              color: "#9CA3AF",
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Chip>✅ Choques visibles</Chip>
              <Chip>✅ Decisiones claras</Chip>
              <Chip>✅ Una sola verdad</Chip>
            </div>
            <div style={{ color: "#94A3B8", fontWeight: 700 }}>
              “Yo pensé que era otro día” — nunca más.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ValueRow(props: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 12px",
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,0.14)",
        background: "rgba(2,6,23,0.22)",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: "#38BDF8",
          boxShadow: "0 0 0 6px rgba(56,189,248,0.12)",
          marginTop: 6,
          flex: "0 0 auto",
        }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#E5E7EB" }}>
          {props.title}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.55, color: "#9CA3AF" }}>
          {props.subtitle}
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.16)",
        background: "rgba(2,6,23,0.25)",
        color: "#CBD5E1",
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function PreviewCard(props: { onPrimary: () => void; onSecondary: () => void }) {
  const days = useMemo(() => ["L", "M", "M", "J", "V", "S", "D"], []);

  return (
    <div
      style={{
        borderRadius: 22,
        padding: 16,
        border: "1px solid rgba(148,163,184,0.18)",
        background:
          "linear-gradient(180deg, rgba(11,18,32,0.92), rgba(2,6,23,0.72))",
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
        <span style={{ fontWeight: 900 }}>Vista rápida</span>
        <span style={{ color: "#94A3B8", fontWeight: 800 }}>
          Pareja · Conflictos
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {days.map((d, i) => (
          <div
            key={i}
            style={{
              height: 34,
              borderRadius: 12,
              background: "rgba(2,6,23,0.30)",
              border: "1px solid rgba(148,163,184,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94A3B8",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <QuickEvent
          title="Cena con Ara"
          time="20:00"
          dot="#F87171"
          bg="rgba(248,113,113,0.12)"
          border="rgba(248,113,113,0.22)"
        />
        <QuickEvent
          title="Entreno"
          time="19:00"
          dot="#FACC15"
          bg="rgba(250,204,21,0.12)"
          border="rgba(250,204,21,0.20)"
        />
        <div
          style={{
            borderRadius: 16,
            padding: 12,
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.18)",
            color: "#CBD5E1",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          ✨ <b style={{ color: "#E5E7EB" }}>SyncPlans detectó un choque</b> y te
          pidió decidir antes de guardar.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={props.onPrimary}
          style={{
            flex: "1 1 160px",
            height: 44,
            padding: "0 14px",
            borderRadius: 999,
            border: "none",
            background: "linear-gradient(135deg, #2563EB, #22C55E)",
            color: "#F9FAFB",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 18px 36px rgba(37,99,235,0.22)",
          }}
        >
          Empezar
        </button>

        <button
          onClick={props.onSecondary}
          style={{
            flex: "1 1 160px",
            height: 44,
            padding: "0 14px",
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.20)",
            background: "rgba(2,6,23,0.30)",
            color: "#E5E7EB",
            fontSize: 13,
            fontWeight: 850,
            cursor: "pointer",
          }}
        >
          Ya tengo cuenta
        </button>
      </div>

      <div
        style={{
          marginTop: 10,
          textAlign: "center",
          color: "#94A3B8",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Entra solo. Invita después.
      </div>
    </div>
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
        <div style={{ fontWeight: 900, fontSize: 13, color: "#E5E7EB" }}>
          {props.title}
        </div>
      </div>

      <div
        style={{
          color: "#E5E7EB",
          fontSize: 12,
          fontWeight: 900,
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