// src/app/onboarding/3/Onboarding3Client.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { trackEvent, trackScreenView } from "@/lib/analytics";

const ONBOARDING_KEY = "syncplans_onboarded_v1";
function completeOnboarding() { try { window.localStorage.setItem(ONBOARDING_KEY, "1"); } catch {} }

export default function Onboarding3Client() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  useEffect(() => {
    void trackScreenView({
      screen: "onboarding_step_3",
      metadata: { flow: "core", step: 3 },
    });
  }, []);

  return (
    <main style={S.page}>
      <div style={S.glowA} aria-hidden />
      <div style={S.glowB} aria-hidden />
      <section style={S.shell} className="ob-shell">
        <header style={S.topBar}>
          <div style={S.brandRow}>
            <BrandLogo variant="mark" size={30} />
            <div style={S.brandMeta}><span style={S.step}>Paso 3 de 4</span><span style={S.stepTitle}>Prevenir conflictos</span></div>
          </div>
          <button type="button" onClick={() => { void trackEvent({ event: "onboarding_skipped", metadata: { screen: "onboarding_step_3", step: 3, destination: nextFinal } }); completeOnboarding(); router.replace(nextFinal); }} style={S.topGhost}>Saltar</button>
        </header>

        <div style={S.heroGrid} className="ob-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>Mejor decidir juntos que reaccionar tarde</div>
            <h1 style={S.title}>SyncPlans detecta conflictos temprano y guía una decisión compartida.</h1>
            <p style={S.lead}>Cuando el choque aparece antes, se evita la discusión de último minuto y cada persona entiende el impacto real de cada opción.</p>
            <div style={S.steps}>
              <div style={S.stepCard}><span style={S.stepNum}>1</span><div><strong>Detecta el choque.</strong><br />Antes del problema, no después.</div></div>
              <div style={S.stepCard}><span style={S.stepNum}>2</span><div><strong>Explica el contexto.</strong><br />Qué se cruza, a quién afecta y qué tan urgente es.</div></div>
              <div style={S.stepCard}><span style={S.stepNum}>3</span><div><strong>Ordena la decisión.</strong><br />Mantener, mover o revisar con criterio compartido.</div></div>
            </div>
            <div style={S.actions}>
              <button type="button" onClick={() => { void trackEvent({ event: "onboarding_step_back", metadata: { from_step: 3, to_step: 2, screen: "onboarding_step_3" } }); router.push(`/onboarding/2${qsNext}`); }} style={S.secondaryButton}>Atrás</button>
              <button type="button" onClick={() => { void trackEvent({ event: "onboarding_step_advanced", metadata: { from_step: 3, to_step: 4, screen: "onboarding_step_3" } }); router.push(`/onboarding/4${qsNext}`); }} style={S.primaryButton}>Activar mi espacio</button>
            </div>
          </section>
          <aside style={S.visualCard}>
            <div style={S.visualTag}>Ejemplo</div>
            <div style={S.decisionCard}><div style={S.decisionTitle}>Choque detectado</div><div style={S.decisionBody}>Cena familiar 20:30 · Pádel 20:00</div></div>
            <div style={S.optionStack}>
              <div style={S.optionStrong}>Conservar cena familiar</div>
              <div style={S.optionMuted}>Mover pádel a otro horario</div>
              <div style={S.optionGhost}>Mantener ambos y decidir luego</div>
            </div>
            <div style={S.footerNote}>No es solo ver agenda. Es resolver en conjunto con menos tensión.</div>
          </aside>
        </div>
      </section>
      <style>{responsiveCss}</style>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050816", color: "#F8FAFC", position: "relative", overflowX: "hidden", padding: "20px 16px 28px" },
  glowA: { position: "absolute", left: -90, top: 100, width: 260, height: 260, borderRadius: 999, background: "rgba(56,189,248,0.14)", filter: "blur(74px)" },
  glowB: { position: "absolute", right: -70, bottom: 20, width: 280, height: 280, borderRadius: 999, background: "rgba(168,85,247,0.15)", filter: "blur(82px)" },
  shell: { position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", borderRadius: 28, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,14,30,0.78)", backdropFilter: "blur(16px)", padding: 20, display: "grid", gap: 18 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "center", gap: 12 }, brandMeta: { display: "grid", gap: 2 }, step: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94A3B8", fontWeight: 700 }, stepTitle: { fontSize: 14, color: "#E2E8F0", fontWeight: 700 },
  topGhost: { minHeight: 42, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.03)", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  heroGrid: { display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(320px,0.95fr)", gap: 18, alignItems: "stretch" },
  copyCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(15,23,42,0.86), rgba(15,23,42,0.62))", padding: 24, display: "grid", gap: 16, alignContent: "center" },
  kicker: { display: "inline-flex", width: "fit-content", padding: "8px 12px", borderRadius: 999, background: "rgba(56,189,248,0.11)", border: "1px solid rgba(56,189,248,0.18)", color: "#BAE6FD", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.05em", fontWeight: 850, maxWidth: 620 },
  lead: { margin: 0, fontSize: 17, lineHeight: 1.65, color: "#CBD5E1", maxWidth: 600 },
  steps: { display: "grid", gap: 12 },
  stepCard: { display: "grid", gridTemplateColumns: "34px minmax(0,1fr)", gap: 12, alignItems: "start", padding: 14, borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: "rgba(255,255,255,0.03)", color: "#E2E8F0", fontSize: 14, lineHeight: 1.55 },
  stepNum: { width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(56,189,248,0.12)", color: "#7DD3FC", fontWeight: 800 },
  actions: { display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 4 },
  secondaryButton: { minHeight: 48, padding: "0 18px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "transparent", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  primaryButton: { minHeight: 48, padding: "0 22px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)", color: "#04111D", fontWeight: 900, cursor: "pointer" },
  visualCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(129,140,248,0.10), rgba(15,23,42,0.82))", padding: 20, display: "grid", gap: 12, alignContent: "center" },
  visualTag: { display: "inline-flex", width: "fit-content", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 700 },
  decisionCard: { borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)", display: "grid", gap: 8 },
  decisionTitle: { fontSize: 22, lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: 800 },
  decisionBody: { fontSize: 14, lineHeight: 1.6, color: "#CBD5E1" },
  optionStack: { display: "grid", gap: 10 },
  optionStrong: { padding: "14px 16px", borderRadius: 16, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.22)", fontWeight: 800 },
  optionMuted: { padding: "14px 16px", borderRadius: 16, background: "rgba(59,130,246,0.10)", border: "1px solid rgba(96,165,250,0.20)", fontWeight: 700 },
  optionGhost: { padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", fontWeight: 700, color: "#CBD5E1" },
  footerNote: { fontSize: 14, lineHeight: 1.6, color: "#94A3B8" },
};
const responsiveCss = `@media (max-width: 900px){.ob-grid{grid-template-columns:1fr}}`;