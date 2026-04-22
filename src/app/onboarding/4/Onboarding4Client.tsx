// src/app/onboarding/4/Onboarding4Client.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { trackEvent, trackScreenView } from "@/lib/analytics";
import { markMyOnboardingCompleted } from "@/lib/profilesDb";

type CtaState = "idle" | "loading";

const OPTIONS = [
  {
    title: "Crear grupo",
    body: "La mejor forma de empezar si compartes tiempo con pareja, familia o amigos.",
    href: "/groups/new",
  },
  {
    title: "Empezar solo",
    body: "Usa SyncPlans como tu centro personal y luego suma a otros cuando quieras.",
    href: "/summary",
  },
  {
    title: "Conectar Google",
    body: "Trae tu agenda actual para tener más contexto desde el primer día.",
    href: "/settings",
  },
] as const;

export default function Onboarding4Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const [ctaState, setCtaState] = useState<CtaState>("idle");

  const nextFinal = useMemo(() => {
    const nextRaw = sp.get("next");
    return nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  }, [sp]);

  useEffect(() => {
    void trackScreenView({
      screen: "onboarding_step_4",
      metadata: { flow: "core", step: 4 },
    });

    void trackEvent({
      event: "onboarding_step_viewed",
      metadata: { flow: "core", step: 4, screen: "onboarding_step_4" },
    });
  }, []);

  async function completeAndGo(target: string) {
    if (ctaState === "loading") return;

    setCtaState("loading");

    try {
      void trackEvent({
        event: "onboarding_completed",
        metadata: {
          screen: "onboarding_step_4",
          destination: target,
        },
      });

      await markMyOnboardingCompleted();
      router.replace(target);
    } catch {
      setCtaState("idle");
    }
  }

  function handleBack() {
    router.push(`/onboarding/3?next=${encodeURIComponent(nextFinal)}`);
  }

  return (
    <main style={S.page}>
      <div style={S.ambientTop} aria-hidden />
      <div style={S.ambientLeft} aria-hidden />
      <div style={S.ambientRight} aria-hidden />
      <div style={S.gridGlow} aria-hidden />

      <section style={S.shell} className="ob-shell">
        <header style={S.topBar}>
          <div style={S.brandRow}>
            <div style={S.logoWrap}>
              <BrandLogo variant="mark" size={30} />
            </div>

            <div style={S.brandMeta}>
              <span style={S.step}>Paso 4 de 4</span>
              <span style={S.stepTitle}>Empieza como más te convenga</span>
            </div>
          </div>

          <button type="button" onClick={handleBack} style={S.topGhost}>
            Atrás
          </button>
        </header>

        <div style={S.heroGrid} className="ob-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>Todo listo</div>

            <div style={S.titleBlock}>
              <h1 style={S.title}>Ahora elige tu mejor primer paso.</h1>
              <p style={S.lead}>
                SyncPlans funciona mejor cuando se adapta a tu realidad. Puedes
                empezar compartiendo, empezar solo o conectar lo que ya usas hoy.
              </p>
            </div>

            <div style={S.options}>
              {OPTIONS.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => completeAndGo(item.href)}
                  style={S.optionCard}
                  disabled={ctaState === "loading"}
                >
                  <div style={S.optionTop}>
                    <span style={S.optionTitle}>{item.title}</span>
                    <span style={S.optionArrow}>→</span>
                  </div>

                  <span style={S.optionBody}>{item.body}</span>
                </button>
              ))}
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualTag}>Lo que desbloqueas</div>

            <div style={S.metricCard}>
              <div style={S.metricValue}>1 sola verdad</div>
              <div style={S.metricLabel}>
                para eventos compartidos, cambios y decisiones
              </div>
            </div>

            <div style={S.metricList}>
              <div style={S.metricRow}>✓ Menos cruces evitables</div>
              <div style={S.metricRow}>✓ Menos mensajes repetidos</div>
              <div style={S.metricRow}>✓ Más claridad diaria</div>
              <div style={S.metricRow}>✓ Mejor coordinación real</div>
            </div>

            <div style={S.finalNote}>
              No necesitas aprender “otro sistema”. Solo necesitas una mejor
              forma de coordinar.
            </div>
          </aside>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    position: "relative",
    overflowX: "hidden",
    background:
      "radial-gradient(circle at top, rgba(15,23,42,0.94) 0%, #040816 42%, #030712 100%)",
    color: "#F8FAFC",
    padding: "20px 16px 28px",
  },

  ambientTop: {
    position: "absolute",
    inset: "0 0 auto 0",
    height: 220,
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0) 100%)",
  },

  ambientLeft: {
    position: "absolute",
    left: -120,
    top: 120,
    width: 320,
    height: 320,
    borderRadius: 999,
    background: "rgba(56,189,248,0.14)",
    filter: "blur(86px)",
  },

  ambientRight: {
    position: "absolute",
    right: -120,
    bottom: 0,
    width: 340,
    height: 340,
    borderRadius: 999,
    background: "rgba(168,85,247,0.14)",
    filter: "blur(92px)",
  },

  gridGlow: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.035) 1px, transparent 1px)",
    backgroundSize: "34px 34px",
    maskImage:
      "linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.08), transparent)",
  },

  shell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1160,
    margin: "0 auto",
    borderRadius: 32,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(6,11,24,0.82), rgba(8,13,28,0.72))",
    backdropFilter: "blur(22px)",
    boxShadow:
      "0 30px 80px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
    padding: 22,
    display: "grid",
    gap: 20,
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  logoWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.15), rgba(59,130,246,0.08))",
    border: "1px solid rgba(125,211,252,0.18)",
  },

  brandMeta: {
    display: "grid",
    gap: 3,
  },

  step: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#94A3B8",
    fontWeight: 800,
  },

  stepTitle: {
    fontSize: 14,
    color: "#E2E8F0",
    fontWeight: 700,
  },

  topGhost: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "#E2E8F0",
    fontWeight: 700,
    cursor: "pointer",
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1.05fr) minmax(360px,0.95fr)",
    gap: 20,
  },

  copyCard: {
    borderRadius: 28,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(15,23,42,0.68))",
    padding: 28,
    display: "grid",
    gap: 18,
    alignContent: "center",
  },

  kicker: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(56,189,248,0.11)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "#BAE6FD",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  titleBlock: {
    display: "grid",
    gap: 12,
  },

  title: {
    margin: 0,
    fontSize: 48,
    lineHeight: 0.97,
    letterSpacing: "-0.05em",
    fontWeight: 900,
  },

  lead: {
    margin: 0,
    fontSize: 17,
    lineHeight: 1.72,
    color: "#CBD5E1",
  },

  options: {
    display: "grid",
    gap: 12,
  },

  optionCard: {
    textAlign: "left",
    padding: "18px 18px",
    borderRadius: 22,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "grid",
    gap: 8,
    cursor: "pointer",
  },

  optionTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  optionTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#F8FAFC",
  },

  optionArrow: {
    fontSize: 18,
    color: "#BAE6FD",
    fontWeight: 900,
  },

  optionBody: {
    fontSize: 14,
    lineHeight: 1.62,
    color: "#CBD5E1",
  },

  visualCard: {
    borderRadius: 28,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.08), rgba(15,23,42,0.86))",
    padding: 22,
    display: "grid",
    gap: 16,
    alignContent: "start",
  },

  visualTag: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.12)",
    fontSize: 12,
    fontWeight: 800,
    color: "#E2E8F0",
  },

  metricCard: {
    borderRadius: 24,
    padding: 20,
    background:
      "linear-gradient(180deg, rgba(8,47,73,0.72), rgba(15,23,42,0.86))",
    border: "1px solid rgba(56,189,248,0.18)",
    display: "grid",
    gap: 8,
  },

  metricValue: {
    fontSize: 32,
    lineHeight: 0.95,
    fontWeight: 900,
    letterSpacing: "-0.05em",
    color: "#E0F2FE",
  },

  metricLabel: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#CFFAFE",
  },

  metricList: {
    display: "grid",
    gap: 10,
  },

  metricRow: {
    padding: "14px 16px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: 700,
  },

  finalNote: {
    borderRadius: 18,
    padding: 16,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 1.65,
  },
};

const responsiveCss = `
  @media (max-width: 980px) {
    .ob-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .ob-shell {
      padding: 16px;
      gap: 16px;
      border-radius: 24px;
    }
  }
`;