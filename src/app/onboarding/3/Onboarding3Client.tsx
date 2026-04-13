// src/app/onboarding/3/Onboarding3Client.tsx
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

export default function Onboarding3Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleBack() {
    router.push(`/onboarding/2${qsNext}`);
  }

  function handleRegister() {
    completeOnboarding();
    router.push(`/auth/register${qsNext}`);
  }

  function handleLogin() {
    completeOnboarding();
    router.push(`/auth/login${qsNext}`);
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
              <span style={styles.step}>Paso 3 de 3</span>
              <span style={styles.stepTitle}>Cómo funciona</span>
            </div>
          </div>
        </header>

        <div style={styles.grid}>
          <section style={styles.copyCard}>
            <div style={styles.kicker}>Simple, directo y compartido</div>
            <h1 style={styles.title}>Una sola verdad para coordinar mejor.</h1>
            <p style={styles.lead}>
              Así se entiende SyncPlans en segundos: no viene a complicarte, viene a
              ayudarte a ponerte de acuerdo.
            </p>

            <div style={styles.steps}>
              <div style={styles.stepCard}>
                <div style={styles.stepNumber}>1</div>
                <div>
                  <div style={styles.stepCardTitle}>Comparte con quien importa</div>
                  <div style={styles.stepCardBody}>Empieza con las personas con las que realmente coordinas tiempo.</div>
                </div>
              </div>
              <div style={styles.stepCard}>
                <div style={styles.stepNumber}>2</div>
                <div>
                  <div style={styles.stepCardTitle}>Organiza planes en un mismo lugar</div>
                  <div style={styles.stepCardBody}>Todos parten de la misma referencia, no de mensajes sueltos.</div>
                </div>
              </div>
              <div style={styles.stepCard}>
                <div style={styles.stepNumber}>3</div>
                <div>
                  <div style={styles.stepCardTitle}>Decidan con claridad cuando algo se cruza</div>
                  <div style={styles.stepCardBody}>En vez de discutir tarde, pueden resolver antes y mejor.</div>
                </div>
              </div>
            </div>

            <div style={styles.actions}>
              <button type="button" onClick={handleBack} style={styles.secondaryButton}>
                Atrás
              </button>
              <button type="button" onClick={handleRegister} style={styles.primaryButton}>
                Crear cuenta
              </button>
              <button type="button" onClick={handleLogin} style={styles.ghostButton}>
                Ya tengo cuenta
              </button>
            </div>
          </section>

          <aside style={styles.previewCard}>
            <div style={styles.previewTag}>Resultado</div>
            <h2 style={styles.previewHeading}>Menos suposiciones. Más acuerdos.</h2>
            <p style={styles.previewBody}>
              Esa es la idea central del producto. Si esa frase se entiende, el valor de
              SyncPlans ya se siente antes de usarlo a fondo.
            </p>
            <div style={styles.finalCard}>
              El siguiente paso ya no es explicarlo. Es empezar a usarlo.
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050816", color: "#F8FAFC", position: "relative", overflow: "hidden", padding: "24px 16px" },
  glowA: { position: "absolute", inset: "auto auto -10% -10%", width: 420, height: 420, borderRadius: 999, background: "rgba(56,189,248,0.10)", filter: "blur(88px)" },
  glowB: { position: "absolute", inset: "-10% -5% auto auto", width: 360, height: 360, borderRadius: 999, background: "rgba(168,85,247,0.12)", filter: "blur(88px)" },
  shell: { position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", borderRadius: 28, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,14,30,0.82)", backdropFilter: "blur(14px)", padding: 24, display: "grid", gap: 20 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  brandMeta: { display: "grid", gap: 2 },
  step: { fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" },
  stepTitle: { fontSize: 14, fontWeight: 700, color: "#E2E8F0" },
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)", gap: 18 },
  copyCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(15,23,42,0.64)", padding: 24, display: "grid", gap: 18 },
  kicker: { display: "inline-flex", width: "fit-content", borderRadius: 999, padding: "8px 12px", background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.18)", color: "#C7D2FE", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: 40, lineHeight: 1.04, letterSpacing: "-0.04em", maxWidth: 650, fontWeight: 800 },
  lead: { margin: 0, fontSize: 17, lineHeight: 1.7, color: "#CBD5E1", maxWidth: 650 },
  steps: { display: "grid", gap: 12 },
  stepCard: { borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.03)", padding: 18, display: "grid", gridTemplateColumns: "44px minmax(0,1fr)", gap: 14, alignItems: "start" },
  stepNumber: { width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(129,140,248,0.22))", color: "#F8FAFC", fontSize: 18, fontWeight: 800 },
  stepCardTitle: { fontSize: 15, fontWeight: 800, color: "#F8FAFC", marginBottom: 6 },
  stepCardBody: { fontSize: 14, lineHeight: 1.65, color: "#CBD5E1" },
  actions: { display: "flex", gap: 12, flexWrap: "wrap" },
  secondaryButton: { minHeight: 48, padding: "0 18px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "transparent", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  primaryButton: { minHeight: 48, padding: "0 20px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)", color: "#04111D", fontWeight: 800, cursor: "pointer" },
  ghostButton: { minHeight: 48, padding: "0 18px", borderRadius: 14, border: "1px solid rgba(56,189,248,0.18)", background: "rgba(56,189,248,0.08)", color: "#BAE6FD", fontWeight: 700, cursor: "pointer" },
  previewCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(129,140,248,0.10) 0%, rgba(15,23,42,0.76) 100%)", padding: 24, display: "grid", gap: 14, alignContent: "start" },
  previewTag: { display: "inline-flex", width: "fit-content", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#E2E8F0", fontSize: 12, fontWeight: 700 },
  previewHeading: { margin: 0, fontSize: 28, lineHeight: 1.08, letterSpacing: "-0.03em" },
  previewBody: { margin: 0, fontSize: 15, lineHeight: 1.7, color: "#CBD5E1" },
  finalCard: { borderRadius: 18, padding: 18, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.04)", color: "#E2E8F0", lineHeight: 1.65, fontWeight: 700 },
};