"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

export default function Onboarding3Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleNext() {
    router.push(`/onboarding/4${qsNext}`);
  }

  function handleBack() {
    router.push(`/onboarding/2${qsNext}`);
  }

  function handleLogin() {
    router.push(`/auth/login${qsNext}`);
  }

  return (
    <main style={styles.page}>
      <div style={styles.glowA} aria-hidden />
      <div style={styles.glowB} aria-hidden />

      <section style={styles.shell} className="ob-shell">
        <header style={styles.topBar} className="ob-topBar">
          <div style={styles.brandRow}>
            <BrandLogo variant="mark" size={30} />
            <div style={styles.brandMeta}>
              <span style={styles.step}>Paso 3 de 4</span>
              <span style={styles.stepTitle}>Cómo se siente</span>
            </div>
          </div>

          <button type="button" onClick={handleLogin} style={styles.ghostButtonTop}>
            Ya tengo cuenta
          </button>
        </header>

        <div style={styles.progressRow}>
          <span style={{ ...styles.progressDot, opacity: 0.42 }} />
          <span style={{ ...styles.progressDot, opacity: 0.42 }} />
          <span style={{ ...styles.progressDot, opacity: 1 }} />
          <span style={styles.progressDot} />
        </div>

        <div style={styles.grid} className="ob-grid">
          <section style={styles.copyCard}>
            <div style={styles.kicker}>Más simple de lo que parece</div>
            <h1 style={styles.title} className="ob-title">
              Entrar rápido. Entender rápido. <span style={styles.titleAccent}>Coordinar mejor.</span>
            </h1>
            <p style={styles.lead}>
              El objetivo no es enseñarte todas las funciones. Es llevarte al punto donde ya puedes crear algo útil y sentir por qué invitar a otra persona sí cambia la experiencia.
            </p>

            <div style={styles.steps}>
              <div style={styles.stepCard}>
                <div style={styles.stepNumber}>1</div>
                <div>
                  <div style={styles.stepCardTitle}>Crea o entra a un espacio compartido</div>
                  <div style={styles.stepCardBody}>Empieza con pareja, familia o el grupo con el que sí te organizas de verdad.</div>
                </div>
              </div>
              <div style={styles.stepCard}>
                <div style={styles.stepNumber}>2</div>
                <div>
                  <div style={styles.stepCardTitle}>Anota un plan en una línea</div>
                  <div style={styles.stepCardBody}>No necesitas montar todo. Basta con escribir algo simple para llevarlo directo a revisión.</div>
                </div>
              </div>
              <div style={styles.stepCard}>
                <div style={styles.stepNumber}>3</div>
                <div>
                  <div style={styles.stepCardTitle}>Resuelve antes de que se vuelva roce</div>
                  <div style={styles.stepCardBody}>Si algo se cruza, SyncPlans lo hace visible cuando todavía es fácil decidir mejor.</div>
                </div>
              </div>
            </div>

            <div style={styles.actions} className="ob-actions">
              <button type="button" onClick={handleBack} style={styles.secondaryButton}>
                Atrás
              </button>
              <button type="button" onClick={handleNext} style={styles.primaryButton}>
                Seguir
              </button>
            </div>
          </section>

          <aside style={styles.previewCard}>
            <div style={styles.previewTag}>Primer valor</div>
            <h2 style={styles.previewHeading}>No necesitas aprender una app completa para sentir el cambio.</h2>
            <p style={styles.previewBody}>
              Lo importante es llegar rápido a una coordinación más clara: menos ambigüedad, menos mensajes cruzados y más sensación de orden compartido.
            </p>
            <div style={styles.finalCard}>Lo siguiente es elegir cómo empezar: solo o creando tu primer grupo compartido.</div>
          </aside>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

const responsiveCss = `
  @media (max-width: 980px) {
    .ob-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 640px) {
    .ob-shell {
      padding: 18px !important;
      border-radius: 22px !important;
    }

    .ob-topBar {
      align-items: flex-start !important;
      flex-direction: column !important;
    }

    .ob-title {
      font-size: 36px !important;
      line-height: 1 !important;
      letter-spacing: -0.05em !important;
    }

    .ob-actions {
      flex-direction: column !important;
    }

    .ob-actions button {
      width: 100% !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050816", color: "#F8FAFC", position: "relative", overflow: "hidden", padding: "18px 14px 24px" },
  glowA: { position: "absolute", inset: "auto auto -10% -10%", width: 420, height: 420, borderRadius: 999, background: "rgba(56,189,248,0.10)", filter: "blur(88px)", pointerEvents: "none" },
  glowB: { position: "absolute", inset: "-10% -5% auto auto", width: 360, height: 360, borderRadius: 999, background: "rgba(168,85,247,0.12)", filter: "blur(88px)", pointerEvents: "none" },
  shell: { position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", borderRadius: 28, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(9,14,30,0.88) 0%, rgba(6,10,24,0.94) 100%)", backdropFilter: "blur(16px)", padding: 24, display: "grid", gap: 18, overflow: "hidden" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  brandMeta: { display: "grid", gap: 2 },
  step: { fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 800 },
  stepTitle: { fontSize: 15, fontWeight: 800, color: "#E2E8F0" },
  ghostButtonTop: { minHeight: 42, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(56,189,248,0.18)", background: "rgba(56,189,248,0.08)", color: "#BAE6FD", fontWeight: 700, cursor: "pointer" },
  progressRow: { display: "flex", gap: 8, alignItems: "center" },
  progressDot: { width: 26, height: 6, borderRadius: 999, background: "linear-gradient(135deg, rgba(129,140,248,0.92), rgba(56,189,248,0.92))", opacity: 0.26 },
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)", gap: 18 },
  copyCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(15,23,42,0.64)", padding: 22, display: "grid", gap: 18 },
  kicker: { display: "inline-flex", width: "fit-content", borderRadius: 999, padding: "8px 12px", background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.18)", color: "#C7D2FE", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: 48, lineHeight: 0.98, letterSpacing: "-0.055em", maxWidth: 720, fontWeight: 850 },
  titleAccent: { color: "#C7D2FE" },
  lead: { margin: 0, fontSize: 17, lineHeight: 1.72, color: "#CBD5E1", maxWidth: 650 },
  steps: { display: "grid", gap: 12 },
  stepCard: { borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.03)", padding: 18, display: "grid", gridTemplateColumns: "44px minmax(0,1fr)", gap: 14, alignItems: "start" },
  stepNumber: { width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(129,140,248,0.22))", color: "#F8FAFC", fontSize: 18, fontWeight: 800 },
  stepCardTitle: { fontSize: 15, fontWeight: 800, color: "#F8FAFC", marginBottom: 6 },
  stepCardBody: { fontSize: 14, lineHeight: 1.65, color: "#CBD5E1" },
  actions: { display: "flex", gap: 12, flexWrap: "wrap" },
  secondaryButton: { minHeight: 48, padding: "0 18px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "transparent", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  primaryButton: { minHeight: 48, padding: "0 20px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)", color: "#04111D", fontWeight: 800, cursor: "pointer" },
  previewCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(129,140,248,0.10) 0%, rgba(15,23,42,0.76) 100%)", padding: 22, display: "grid", gap: 14, alignContent: "start" },
  previewTag: { display: "inline-flex", width: "fit-content", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#E2E8F0", fontSize: 12, fontWeight: 700 },
  previewHeading: { margin: 0, fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.03em" },
  previewBody: { margin: 0, fontSize: 15, lineHeight: 1.72, color: "#CBD5E1" },
  finalCard: { borderRadius: 18, padding: 18, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.04)", color: "#E2E8F0", lineHeight: 1.68, fontWeight: 700 },
};