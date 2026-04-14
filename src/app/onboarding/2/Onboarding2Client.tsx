// src/app/onboarding/2/Onboarding2Client.tsx
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
    <main style={styles.page}>
      <div style={styles.glowA} aria-hidden />
      <div style={styles.glowB} aria-hidden />

      <section style={styles.shell}>
        <header style={styles.topBar}>
          <div style={styles.brandRow}>
            <BrandLogo variant="mark" size={30} />
            <div style={styles.brandMeta}>
              <span style={styles.step}>Paso 2 de 4</span>
              <span style={styles.stepTitle}>El beneficio</span>
            </div>
          </div>

          <button type="button" onClick={handleSkip} style={styles.ghostTopButton}>
            Saltar
          </button>
        </header>

        <div style={styles.grid}>
          <section style={styles.copyCard}>
            <div style={styles.kicker}>Lo que cambia cuando todos parten de la misma referencia</div>
            <h1 style={styles.title}>SyncPlans reduce fricción antes de que se vuelva discusión.</h1>
            <p style={styles.lead}>
              No se trata de llenar más pantallas. Se trata de que dos o más personas
              tengan claridad compartida para decidir mejor su tiempo.
            </p>

            <div style={styles.benefitList}>
              <div style={styles.benefitItem}>
                <div style={styles.benefitTitle}>Menos confusión</div>
                <div style={styles.benefitBody}>Todos parten de la misma información, no de recuerdos distintos.</div>
              </div>
              <div style={styles.benefitItem}>
                <div style={styles.benefitTitle}>Menos fricción</div>
                <div style={styles.benefitBody}>Los cruces se hacen visibles antes de convertirse en problema.</div>
              </div>
              <div style={styles.benefitItem}>
                <div style={styles.benefitTitle}>Mejores acuerdos</div>
                <div style={styles.benefitBody}>Se vuelve más fácil decidir juntos qué mantener, mover o ajustar.</div>
              </div>
            </div>

            <div style={styles.actions}>
              <button type="button" onClick={handleBack} style={styles.secondaryButton}>
                Atrás
              </button>
              <button type="button" onClick={handleNext} style={styles.primaryButton}>
                Ver cómo funciona
              </button>
            </div>
          </section>

          <aside style={styles.previewCard}>
            <div style={styles.previewTitle}>Antes</div>
            <div style={styles.beforeCard}>Cada uno recuerda una versión distinta de lo que se habló.</div>
            <div style={styles.previewTitle}>Después</div>
            <div style={styles.afterCard}>La coordinación se apoya en una sola referencia compartida.</div>
            <div style={styles.noteCard}>
              SyncPlans no intenta complicarte más. Intenta que ponerse de acuerdo sea más simple.
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050816", color: "#F8FAFC", position: "relative", overflow: "hidden", padding: "24px 16px" },
  glowA: { position: "absolute", inset: "-5% auto auto -10%", width: 380, height: 380, borderRadius: 999, background: "rgba(56,189,248,0.12)", filter: "blur(84px)" },
  glowB: { position: "absolute", inset: "auto -10% -5% auto", width: 420, height: 420, borderRadius: 999, background: "rgba(168,85,247,0.10)", filter: "blur(84px)" },
  shell: { position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", borderRadius: 28, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,14,30,0.82)", backdropFilter: "blur(14px)", padding: 24, display: "grid", gap: 20 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  brandMeta: { display: "grid", gap: 2 },
  step: { fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" },
  stepTitle: { fontSize: 14, fontWeight: 700, color: "#E2E8F0" },
  ghostTopButton: { minHeight: 42, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.22)", background: "transparent", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(300px, 0.9fr)", gap: 18 },
  copyCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(15,23,42,0.64)", padding: 24, display: "grid", gap: 18 },
  kicker: { display: "inline-flex", width: "fit-content", borderRadius: 999, padding: "8px 12px", background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.18)", color: "#A7F3D0", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: 40, lineHeight: 1.04, letterSpacing: "-0.04em", maxWidth: 650, fontWeight: 800 },
  lead: { margin: 0, fontSize: 17, lineHeight: 1.7, color: "#CBD5E1", maxWidth: 650 },
  benefitList: { display: "grid", gap: 12 },
  benefitItem: { borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.03)", padding: 18, display: "grid", gap: 6 },
  benefitTitle: { fontSize: 15, fontWeight: 800, color: "#F8FAFC" },
  benefitBody: { fontSize: 14, lineHeight: 1.65, color: "#CBD5E1" },
  actions: { display: "flex", gap: 12, flexWrap: "wrap" },
  secondaryButton: { minHeight: 48, padding: "0 18px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "transparent", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  primaryButton: { minHeight: 48, padding: "0 20px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)", color: "#04111D", fontWeight: 800, cursor: "pointer" },
  previewCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.76) 100%)", padding: 24, display: "grid", gap: 14, alignContent: "start" },
  previewTitle: { fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94A3B8" },
  beforeCard: { borderRadius: 18, padding: 18, border: "1px solid rgba(248,113,113,0.18)", background: "rgba(248,113,113,0.10)", color: "#FECACA", lineHeight: 1.7 },
  afterCard: { borderRadius: 18, padding: 18, border: "1px solid rgba(16,185,129,0.18)", background: "rgba(16,185,129,0.10)", color: "#D1FAE5", lineHeight: 1.7 },
  noteCard: { borderRadius: 18, padding: 18, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.04)", color: "#CBD5E1", lineHeight: 1.7 },
};