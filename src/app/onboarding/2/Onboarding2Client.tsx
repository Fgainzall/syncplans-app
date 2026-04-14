"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

const ONBOARDING_KEY = "syncplans_onboarded_v1";
function completeOnboarding() { try { window.localStorage.setItem(ONBOARDING_KEY, "1"); } catch {} }

export default function Onboarding2Client() {
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
            <div style={S.brandMeta}>
              <span style={S.step}>Paso 2 de 4</span>
              <span style={S.stepTitle}>La diferencia</span>
            </div>
          </div>
          <button type="button" onClick={() => { completeOnboarding(); router.replace(nextFinal); }} style={S.topGhost}>Saltar</button>
        </header>

        <div style={S.heroGrid} className="ob-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>Una sola referencia</div>
            <h1 style={S.title}>SyncPlans pone una verdad compartida en el centro.</h1>
            <p style={S.lead}>No reemplaza tu vida. Ordena la coordinación para que nadie tenga que adivinar qué pasa con el tiempo compartido.</p>

            <div style={S.points}>
              <div style={S.point}><span style={S.pointIcon}>✦</span><div><strong>Hace visible lo importante.</strong><br />Lo que se cruza, lo que sigue y lo que todavía está en el aire.</div></div>
              <div style={S.point}><span style={S.pointIcon}>✦</span><div><strong>Reduce ida y vuelta innecesaria.</strong><br />Menos mensajes repetidos. Menos confusión. Menos memoria suelta.</div></div>
              <div style={S.point}><span style={S.pointIcon}>✦</span><div><strong>Te deja decidir mejor.</strong><br />Antes de discutir, ya ves dónde está el problema.</div></div>
            </div>

            <div style={S.actions}>
              <button type="button" onClick={() => router.push(`/onboarding/1${qsNext}`)} style={S.secondaryButton}>Atrás</button>
              <button type="button" onClick={() => router.push(`/onboarding/3${qsNext}`)} style={S.primaryButton}>Seguir</button>
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualTitle}>Lo que cambia</div>
            <div style={S.compareWrap}>
              <div style={S.compareCardMuted}>
                <div style={S.compareEyebrow}>Antes</div>
                <div style={S.compareHeadline}>Cada uno interpreta algo distinto</div>
                <div style={S.compareBody}>Chats, memoria y supuestos mezclados.</div>
              </div>
              <div style={S.compareCardStrong}>
                <div style={S.compareEyebrow}>Con SyncPlans</div>
                <div style={S.compareHeadline}>Todos parten de la misma referencia</div>
                <div style={S.compareBody}>Menos ruido. Más claridad. Mejor coordinación.</div>
              </div>
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
  glowA: { position: "absolute", left: -80, bottom: 30, width: 260, height: 260, borderRadius: 999, background: "rgba(56,189,248,0.16)", filter: "blur(74px)" },
  glowB: { position: "absolute", right: -90, top: 40, width: 280, height: 280, borderRadius: 999, background: "rgba(168,85,247,0.14)", filter: "blur(82px)" },
  shell: { position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", borderRadius: 28, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(9,14,30,0.78)", backdropFilter: "blur(16px)", padding: 20, display: "grid", gap: 18 },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  brandRow: { display: "flex", alignItems: "center", gap: 12 }, brandMeta: { display: "grid", gap: 2 }, step: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94A3B8", fontWeight: 700 }, stepTitle: { fontSize: 14, color: "#E2E8F0", fontWeight: 700 },
  topGhost: { minHeight: 42, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.03)", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  heroGrid: { display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(320px,0.95fr)", gap: 18, alignItems: "stretch" },
  copyCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(15,23,42,0.86), rgba(15,23,42,0.62))", padding: 24, display: "grid", gap: 16, alignContent: "center" },
  kicker: { display: "inline-flex", width: "fit-content", padding: "8px 12px", borderRadius: 999, background: "rgba(56,189,248,0.11)", border: "1px solid rgba(56,189,248,0.18)", color: "#BAE6FD", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.05em", fontWeight: 850, maxWidth: 620 },
  lead: { margin: 0, fontSize: 17, lineHeight: 1.65, color: "#CBD5E1", maxWidth: 600 },
  points: { display: "grid", gap: 12 },
  point: { display: "grid", gridTemplateColumns: "30px minmax(0,1fr)", gap: 12, padding: 14, borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: "rgba(255,255,255,0.03)", color: "#E2E8F0", lineHeight: 1.55, fontSize: 14 },
  pointIcon: { display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 999, background: "rgba(56,189,248,0.12)", color: "#7DD3FC", fontWeight: 800 },
  actions: { display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 4 },
  secondaryButton: { minHeight: 48, padding: "0 18px", borderRadius: 14, border: "1px solid rgba(148,163,184,0.18)", background: "transparent", color: "#E2E8F0", fontWeight: 700, cursor: "pointer" },
  primaryButton: { minHeight: 48, padding: "0 22px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)", color: "#04111D", fontWeight: 900, cursor: "pointer" },
  visualCard: { borderRadius: 24, border: "1px solid rgba(148,163,184,0.14)", background: "linear-gradient(180deg, rgba(129,140,248,0.10), rgba(15,23,42,0.82))", padding: 20, display: "grid", gap: 14, alignContent: "center" },
  visualTitle: { fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4B5FD", fontWeight: 800 },
  compareWrap: { display: "grid", gap: 12 },
  compareCardMuted: { borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)", display: "grid", gap: 8 },
  compareCardStrong: { borderRadius: 18, padding: 18, background: "linear-gradient(180deg, rgba(34,197,94,0.10), rgba(15,23,42,0.82))", border: "1px solid rgba(34,197,94,0.22)", display: "grid", gap: 8 },
  compareEyebrow: { fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94A3B8", fontWeight: 700 },
  compareHeadline: { fontSize: 22, lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: 800 },
  compareBody: { fontSize: 14, lineHeight: 1.6, color: "#CBD5E1" },
};

const responsiveCss = `@media (max-width: 900px){.ob-grid{grid-template-columns:1fr}}`;