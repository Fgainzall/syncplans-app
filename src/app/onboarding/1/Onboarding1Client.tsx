// src/app/onboarding/1/Onboarding1Client.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { trackEvent, trackScreenView } from "@/lib/analytics";

const ONBOARDING_KEY = "syncplans_onboarded_v1";

function completeOnboarding() {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {}
}

export default function Onboarding1Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  useEffect(() => {
    void trackScreenView({
      screen: "onboarding_step_1",
      metadata: { flow: "core", step: 1 },
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
            <div style={S.brandMeta}>
              <span style={S.step}>Paso 1 de 4</span>
              <span style={S.stepTitle}>No es otro calendario</span>
            </div>
          </div>

          <button type="button" onClick={() => { void trackEvent({ event: "onboarding_login_clicked", metadata: { screen: "onboarding_step_1", step: 1 } }); router.push(`/auth/login${qsNext}`); }} style={S.topGhost}>
            Ya tengo cuenta
          </button>
        </header>

        <div style={S.heroGrid} className="ob-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>En 2 minutos vas a notar la diferencia</div>
            <h1 style={S.title}>El problema no es agendar.</h1>
            <h2 style={S.titleAccent}>Es coordinar personas sin una verdad compartida.</h2>
            <p style={S.lead}>
              SyncPlans no compite con tu calendario: evita malentendidos, cruces y decisiones tardías cuando hay más de una persona involucrada.
            </p>

            <div style={S.chips}>
              <span style={S.chip}>“Pensé que era otro día”</span>
              <span style={S.chip}>“No vi ese mensaje”</span>
              <span style={S.chip}>“Yo ya tenía otro plan”</span>
            </div>

            <div style={S.actions}>
              <button type="button" onClick={() => { void trackEvent({ event: "onboarding_skipped", metadata: { screen: "onboarding_step_1", step: 1, destination: nextFinal } }); completeOnboarding(); router.replace(nextFinal); }} style={S.secondaryButton}>Saltar</button>
              <button type="button" onClick={() => { void trackEvent({ event: "onboarding_step_advanced", metadata: { from_step: 1, to_step: 2, screen: "onboarding_step_1" } }); router.push(`/onboarding/2${qsNext}`); }} style={S.primaryButton}>Ver por qué funciona</button>
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualTop}>
              <span style={S.visualTag}>Situación real</span>
              <span style={S.visualMini}>Viernes</span>
            </div>

            <div style={S.eventCardStrong}>
              <div>
                <div style={S.eventLabel}>Cena reservada</div>
                <div style={S.eventSub}>Plan confirmado</div>
              </div>
              <div style={S.eventTime}>20:30</div>
            </div>

            <div style={S.eventCardMuted}>
              <div>
                <div style={S.eventLabel}>Salida con amigos</div>
                <div style={S.eventSub}>Otro plan asumido</div>
              </div>
              <div style={S.eventTime}>21:00</div>
            </div>

            <div style={S.alertCard}>
              <div style={S.alertTitle}>Mismo horario. Dos versiones de la misma noche.</div>
              <p style={S.alertBody}>Ese desgaste diario es justo lo que SyncPlans reduce desde el primer uso compartido.</p>
            </div>
          </aside>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050816", color: "#F8FAFC", position: "relative", overflowX: "hidden", padding: "20px 16px 28px" },
  glowA: { position: "absolute", left: -80, top: 120, width: 260, height: 260, borderRadius: 999, background: "rgba(56,189,248,0.16)", filter: "blur(70px)" },
  glowB: { position: "absolute", right: -90, top: -40, width: 280, height: 280, borderRadius: 999, background: "rgba(168,85,247,0.15)", filter: "blur(78px)" },
  shell: { position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", borderRadius: 28, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,14,30,0.78)", backdropFilter: "blur(16px)", padding: 20, display: "grid", gap: 18 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  brandMeta: { display: "grid", gap: 2 },
  step: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94A3B8", fontWeight: 700 },
  stepTitle: { fontSize: 14, color: "#E2E8F0", fontWeight: 700 },
  topGhost: { minHeight: 42, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.03)", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  heroGrid: { display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(320px,0.95fr)", gap: 18, alignItems: "stretch" },
  copyCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(15,23,42,0.86), rgba(15,23,42,0.62))", padding: 24, display: "grid", gap: 14, alignContent: "center" },
  kicker: { display: "inline-flex", width: "fit-content", padding: "8px 12px", borderRadius: 999, background: "rgba(56,189,248,0.11)", border: "1px solid rgba(56,189,248,0.18)", color: "#BAE6FD", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: 44, lineHeight: 0.98, letterSpacing: "-0.05em", fontWeight: 850 },
  titleAccent: { margin: 0, fontSize: 30, lineHeight: 1.02, letterSpacing: "-0.04em", color: "#C4B5FD", fontWeight: 800 },
  lead: { margin: 0, fontSize: 17, lineHeight: 1.65, color: "#CBD5E1", maxWidth: 560 },
  chips: { display: "flex", flexWrap: "wrap", gap: 10 },
  chip: { display: "inline-flex", padding: "10px 14px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.14)", color: "#E2E8F0", fontSize: 14, fontWeight: 600 },
  actions: { display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 4 },
  secondaryButton: { minHeight: 48, padding: "0 18px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "transparent", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  primaryButton: { minHeight: 48, padding: "0 22px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)", color: "#04111D", fontWeight: 900, cursor: "pointer" },
  visualCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(56,189,248,0.09), rgba(15,23,42,0.82))", padding: 20, display: "grid", gap: 14, alignContent: "start" },
  visualTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  visualTag: { display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 700, color: "#E2E8F0" },
  visualMini: { fontSize: 12, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 },
  eventCardStrong: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 16px", borderRadius: 18, background: "rgba(5,10,25,0.78)", border: "1px solid rgba(56,189,248,0.18)" },
  eventCardMuted: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 16px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.14)" },
  eventLabel: { fontSize: 18, fontWeight: 800 },
  eventSub: { fontSize: 13, color: "#94A3B8", marginTop: 4 },
  eventTime: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" },
  alertCard: { borderRadius: 18, padding: 16, background: "rgba(244,63,94,0.10)", border: "1px solid rgba(251,113,133,0.22)", display: "grid", gap: 8 },
  alertTitle: { fontSize: 16, fontWeight: 800, color: "#FECDD3" },
  alertBody: { margin: 0, fontSize: 14, lineHeight: 1.6, color: "#FBCFE8" },
};

const responsiveCss = `
  @media (max-width: 900px) {
    .ob-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .ob-shell { padding: 16px; gap: 16px; }
    .ob-grid { gap: 14px; }
  }
`;