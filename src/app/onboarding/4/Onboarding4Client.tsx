"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

const ONBOARDING_KEY = "syncplans_onboarded_v1";
function completeOnboarding() { try { window.localStorage.setItem(ONBOARDING_KEY, "1"); } catch {} }

export default function Onboarding4Client() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  return (
    <main style={S.page}>
      <div style={S.glowA} aria-hidden />
      <div style={S.glowB} aria-hidden />
      <section style={S.shell} className="ob-shell">
        <header style={S.topBar}>
          <div style={S.brandRow}>
            <BrandLogo variant="mark" size={30} />
            <div style={S.brandMeta}><span style={S.step}>Paso 4 de 4</span><span style={S.stepTitle}>Empezar</span></div>
          </div>
          <button type="button" onClick={() => router.push(`/auth/login${qsNext}`)} style={S.topGhost}>Ya tengo cuenta</button>
        </header>

        <div style={S.heroGrid} className="ob-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>Listo para entrar</div>
            <h1 style={S.title}>SyncPlans se siente mejor cuando el tiempo ya no depende de acordarse de todo.</h1>
            <p style={S.lead}>Puedes empezar solo hoy mismo o crear un grupo y probar el valor compartido desde el primer minuto.</p>

            <div style={S.choiceGrid}>
              <div style={S.choicePrimary}><strong>Crear grupo</strong><span>La forma más clara de ver coordinación real desde el inicio.</span></div>
              <div style={S.choiceSecondary}><strong>Empezar solo</strong><span>Ordena tu semana ahora y suma gente después.</span></div>
            </div>

            <div style={S.actions}>
              <button type="button" onClick={() => router.push(`/onboarding/3${qsNext}`)} style={S.secondaryButton}>Atrás</button>
              <button type="button" onClick={() => { completeOnboarding(); router.replace('/groups/new'); }} style={S.primaryButton}>Crear grupo</button>
              <button type="button" onClick={() => { completeOnboarding(); router.replace(nextFinal); }} style={S.ghostButton}>Empezar solo</button>
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualTitle}>Lo que ganas al entrar</div>
            <div style={S.benefit}>Una vista más clara de qué está confirmado, qué se cruza y qué falta decidir.</div>
            <div style={S.benefit}>Menos mensajes repetidos y menos versiones distintas de la misma semana.</div>
            <div style={S.benefit}>Más sensación de orden, incluso cuando compartes tiempo con otros.</div>
            <div style={S.footerBox}>Empieza simple. Después deja que SyncPlans haga más liviana la coordinación.</div>
          </aside>
        </div>
      </section>
      <style>{responsiveCss}</style>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050816", color: "#F8FAFC", position: "relative", overflowX: "hidden", padding: "20px 16px 28px" },
  glowA: { position: "absolute", left: -90, top: 80, width: 260, height: 260, borderRadius: 999, background: "rgba(56,189,248,0.16)", filter: "blur(78px)" },
  glowB: { position: "absolute", right: -70, bottom: 30, width: 280, height: 280, borderRadius: 999, background: "rgba(168,85,247,0.16)", filter: "blur(82px)" },
  shell: { position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", borderRadius: 28, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,14,30,0.78)", backdropFilter: "blur(16px)", padding: 20, display: "grid", gap: 18 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "center", gap: 12 }, brandMeta: { display: "grid", gap: 2 }, step: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94A3B8", fontWeight: 700 }, stepTitle: { fontSize: 14, color: "#E2E8F0", fontWeight: 700 },
  topGhost: { minHeight: 42, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.03)", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  heroGrid: { display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(320px,0.95fr)", gap: 18, alignItems: "stretch" },
  copyCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(15,23,42,0.86), rgba(15,23,42,0.62))", padding: 24, display: "grid", gap: 16, alignContent: "center" },
  kicker: { display: "inline-flex", width: "fit-content", padding: "8px 12px", borderRadius: 999, background: "rgba(56,189,248,0.11)", border: "1px solid rgba(56,189,248,0.18)", color: "#BAE6FD", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.05em", fontWeight: 850, maxWidth: 640 },
  lead: { margin: 0, fontSize: 17, lineHeight: 1.65, color: "#CBD5E1", maxWidth: 600 },
  choiceGrid: { display: "grid", gap: 12 },
  choicePrimary: { display: "grid", gap: 6, padding: 16, borderRadius: 18, background: "linear-gradient(180deg, rgba(56,189,248,0.10), rgba(129,140,248,0.12))", border: "1px solid rgba(96,165,250,0.22)", color: "#E2E8F0" },
  choiceSecondary: { display: "grid", gap: 6, padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", color: "#CBD5E1" },
  actions: { display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 4 },
  secondaryButton: { minHeight: 48, padding: "0 18px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "transparent", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  primaryButton: { minHeight: 48, padding: "0 22px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)", color: "#04111D", fontWeight: 900, cursor: "pointer" },
  ghostButton: { minHeight: 48, padding: "0 22px", borderRadius: 14, border: "1px solid rgba(56,189,248,0.18)", background: "rgba(56,189,248,0.08)", color: "#BAE6FD", fontWeight: 800, cursor: "pointer" },
  visualCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(129,140,248,0.10), rgba(15,23,42,0.82))", padding: 20, display: "grid", gap: 12, alignContent: "center" },
  visualTitle: { fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4B5FD", fontWeight: 800 },
  benefit: { padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)", color: "#E2E8F0", lineHeight: 1.55, fontSize: 14 },
  footerBox: { padding: 16, borderRadius: 18, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.20)", color: "#DCFCE7", lineHeight: 1.6, fontWeight: 700 },
};
const responsiveCss = `@media (max-width: 900px){.ob-grid{grid-template-columns:1fr}}`;