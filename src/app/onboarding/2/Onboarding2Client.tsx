"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

const ONBOARDING_KEY = "syncplans_onboarded_v1";

function completeOnboarding() {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {}
}

export default function Onboarding2Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleNext() {
    router.push(`/onboarding/3${qsNext}`);
  }

  function handleBack() {
    router.push(`/onboarding/1${qsNext}`);
  }

  function handleSkip() {
    completeOnboarding();
    router.replace(nextFinal);
  }

  return (
    <main style={S.page}>
      <div style={S.glowA} aria-hidden />
      <div style={S.glowB} aria-hidden />

      <section style={S.shell} className="ob-shell">
        <header style={S.topBar}>
          <div style={S.brandRow}>
            <BrandLogo variant="mark" size={30} />
            <div style={S.brandMeta}>
              <span style={S.step}>Paso 2 de 4</span>
              <span style={S.stepTitle}>La diferencia</span>
            </div>
          </div>

          <button type="button" onClick={handleSkip} style={S.ghostTopButton}>
            Saltar
          </button>
        </header>

        <div style={S.hero} className="ob-hero">
          <section style={S.mainCard}>
            <div style={S.kicker}>La propuesta de valor</div>
            <h1 style={S.title}>
              SyncPlans no agrega ruido.
              <br />
              <span style={S.titleAccent}>Quita ambigüedad.</span>
            </h1>
            <p style={S.lead}>
              Cuando todos parten de la misma referencia, es más fácil decidir,
              ajustar y evitar fricción innecesaria.
            </p>

            <div style={S.benefitGrid}>
              <Benefit title="Más claridad" body="Todos ven lo mismo, no versiones distintas de la semana." />
              <Benefit title="Menos fricción" body="Los cruces aparecen antes de convertirse en problema." />
              <Benefit title="Más control" body="Es más fácil decidir qué mantener, mover o ajustar." />
            </div>

            <div style={S.actions} className="ob-actions">
              <button type="button" onClick={handleBack} style={S.secondaryButton}>
                Atrás
              </button>
              <button type="button" onClick={handleNext} style={S.primaryButton}>
                Seguir
              </button>
            </div>
          </section>

          <aside style={S.sideCard}>
            <div style={S.compareLabel}>Antes</div>
            <div style={S.beforeCard}>Mensajes sueltos, recuerdos distintos, decisiones tardías.</div>
            <div style={S.compareLabel}>Después</div>
            <div style={S.afterCard}>Una sola referencia compartida para coordinar mejor.</div>
          </aside>
        </div>

        <footer style={S.footer}>
          <Dots active={1} />
          <span style={S.footerText}>Ahora: entender por qué se siente distinto.</span>
        </footer>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

function Benefit({ title, body }: { title: string; body: string }) {
  return (
    <div style={S.benefitCard}>
      <div style={S.benefitTitle}>{title}</div>
      <div style={S.benefitBody}>{body}</div>
    </div>
  );
}

function Dots({ active }: { active: number }) {
  return (
    <div style={S.dots}>
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          style={{ ...S.dot, opacity: index === active ? 1 : 0.35, transform: index === active ? "scale(1)" : "scale(0.9)" }}
        />
      ))}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050816", color: "#F8FAFC", position: "relative", overflow: "hidden", padding: "20px 14px", display: "grid", alignItems: "center" },
  glowA: { position: "absolute", left: -120, top: -80, width: 300, height: 300, borderRadius: 999, background: "rgba(16,185,129,0.12)", filter: "blur(72px)" },
  glowB: { position: "absolute", right: -120, bottom: -80, width: 320, height: 320, borderRadius: 999, background: "rgba(56,189,248,0.10)", filter: "blur(72px)" },
  shell: { position: "relative", zIndex: 1, width: "100%", maxWidth: 1100, margin: "0 auto", borderRadius: 28, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,14,30,0.84)", backdropFilter: "blur(14px)", padding: 20, display: "grid", gap: 16 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  brandMeta: { display: "grid", gap: 2 },
  step: { fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" },
  stepTitle: { fontSize: 15, fontWeight: 800, color: "#E2E8F0" },
  ghostTopButton: { minHeight: 42, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.22)", background: "rgba(255,255,255,0.02)", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  hero: { display: "grid", gridTemplateColumns: "minmax(0,1.08fr) minmax(280px,0.92fr)", gap: 16, alignItems: "stretch" },
  mainCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(15,23,42,0.68)", padding: 22, display: "grid", gap: 16, alignContent: "center" },
  kicker: { display: "inline-flex", width: "fit-content", padding: "8px 12px", borderRadius: 999, background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.18)", color: "#A7F3D0", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" },
  title: { margin: 0, fontSize: 42, lineHeight: 1.02, letterSpacing: "-0.05em", fontWeight: 850, maxWidth: 620 },
  titleAccent: { color: "#A7F3D0" },
  lead: { margin: 0, fontSize: 17, lineHeight: 1.65, color: "#CBD5E1", maxWidth: 580 },
  benefitGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 },
  benefitCard: { borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.03)", padding: 16, display: "grid", gap: 6 },
  benefitTitle: { fontSize: 15, fontWeight: 800, color: "#F8FAFC" },
  benefitBody: { fontSize: 13, lineHeight: 1.6, color: "#CBD5E1" },
  actions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 },
  secondaryButton: { minHeight: 48, padding: "0 18px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "transparent", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  primaryButton: { minHeight: 48, padding: "0 20px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #34D399 0%, #38BDF8 100%)", color: "#04111D", fontWeight: 800, cursor: "pointer" },
  sideCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(16,185,129,0.10) 0%, rgba(15,23,42,0.8) 100%)", padding: 20, display: "grid", gap: 12, alignContent: "center" },
  compareLabel: { fontSize: 12, fontWeight: 800, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" },
  beforeCard: { borderRadius: 18, padding: 18, border: "1px solid rgba(248,113,113,0.18)", background: "rgba(248,113,113,0.10)", color: "#FECACA", lineHeight: 1.6, fontWeight: 600 },
  afterCard: { borderRadius: 18, padding: 18, border: "1px solid rgba(16,185,129,0.18)", background: "rgba(16,185,129,0.10)", color: "#D1FAE5", lineHeight: 1.6, fontWeight: 700 },
  footer: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  footerText: { fontSize: 13, color: "#94A3B8" },
  dots: { display: "flex", gap: 8, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 999, background: "#34D399" },
};

const responsiveCss = `
  @media (max-width: 900px) {
    .ob-hero {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .ob-shell {
      padding: 16px;
      border-radius: 24px;
    }

    .ob-actions > button {
      flex: 1 1 0;
    }
  }
`;