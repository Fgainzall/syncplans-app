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

export default function Onboarding1Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleNext() {
    router.push(`/onboarding/2${qsNext}`);
  }

  function handleSkip() {
    completeOnboarding();
    router.replace(nextFinal);
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
              <span style={styles.step}>Paso 1 de 4</span>
              <span style={styles.stepTitle}>El problema</span>
            </div>
          </div>

          <button type="button" onClick={handleLogin} style={styles.ghostTopButton}>
            Ya tengo cuenta
          </button>
        </header>

        <div style={styles.progressRow}>
          <span style={{ ...styles.progressDot, opacity: 1 }} />
          <span style={styles.progressDot} />
          <span style={styles.progressDot} />
          <span style={styles.progressDot} />
        </div>

        <div style={styles.grid} className="ob-grid">
          <section style={styles.copyCard}>
            <div style={styles.kicker}>Coordinar no debería sentirse pesado</div>

            <div style={styles.copyStack}>
              <h1 style={styles.title} className="ob-title">
                El problema no es el tiempo. <span style={styles.titleAccent}>Es ponerse de acuerdo.</span>
              </h1>

              <p style={styles.lead}>
                Entre trabajo, pareja, familia, amigos y pendientes, es muy fácil que dos
                personas entiendan la misma semana de formas distintas.
              </p>
            </div>

            <div style={styles.quoteBox}>
              <div style={styles.quoteLabel}>Lo que suele pasar</div>
              <div style={styles.quoteList}>
                <span style={styles.quote}>Pensé que era otro día</span>
                <span style={styles.quote}>No vi ese mensaje</span>
                <span style={styles.quote}>Yo ya tenía algo</span>
              </div>
            </div>

            <p style={styles.support}>
              Cuando la coordinación falla, el problema casi nunca empieza grande.
              Empieza con pequeñas ambigüedades que terminan convirtiéndose en roce.
            </p>

            <div style={styles.actions} className="ob-actions">
              <button type="button" onClick={handleSkip} style={styles.secondaryButton}>
                Saltar
              </button>
              <button type="button" onClick={handleNext} style={styles.primaryButton}>
                Ver por qué
              </button>
            </div>
          </section>

          <aside style={styles.previewCard}>
            <div style={styles.previewBadge}>Situación real</div>

            <div style={styles.timeline}>
              <div style={styles.timelineItemStrong}>
                <div>
                  <div style={styles.timelineDay}>Viernes</div>
                  <div style={styles.timelineTitle}>Cena reservada</div>
                </div>
                <div style={styles.timelineTime}>20:30</div>
              </div>

              <div style={styles.timelineItemMuted}>
                <div>
                  <div style={styles.timelineDay}>Viernes</div>
                  <div style={styles.timelineTitle}>Salida con amigos</div>
                </div>
                <div style={styles.timelineTime}>21:00</div>
              </div>
            </div>

            <div style={styles.alertCard}>
              <div style={styles.alertTitle}>Mismo horario. Distintas expectativas.</div>
              <div style={styles.alertBody}>
                El problema empieza cuando nadie ve el cruce a tiempo y cada uno ya dio por hecho algo distinto.
              </div>
            </div>

            <div style={styles.previewFoot}>
              SyncPlans existe para que esa conversación llegue antes, con más claridad y menos fricción.
            </div>
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
      font-size: 38px !important;
      line-height: 0.98 !important;
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
  page: {
    minHeight: "100dvh",
    background: "#050816",
    color: "#F8FAFC",
    position: "relative",
    overflow: "hidden",
    padding: "18px 14px 24px",
  },
  glowA: {
    position: "absolute",
    left: "-12%",
    bottom: "-4%",
    width: 380,
    height: 380,
    borderRadius: 999,
    background: "rgba(56,189,248,0.14)",
    filter: "blur(84px)",
    pointerEvents: "none",
  },
  glowB: {
    position: "absolute",
    right: "-10%",
    top: "-8%",
    width: 320,
    height: 320,
    borderRadius: 999,
    background: "rgba(168,85,247,0.12)",
    filter: "blur(82px)",
    pointerEvents: "none",
  },
  shell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1120,
    margin: "0 auto",
    borderRadius: 28,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "linear-gradient(180deg, rgba(9,14,30,0.88) 0%, rgba(6,10,24,0.94) 100%)",
    backdropFilter: "blur(16px)",
    padding: 24,
    display: "grid",
    gap: 18,
    overflow: "hidden",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  brandMeta: { display: "grid", gap: 2 },
  step: {
    fontSize: 11,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 800,
  },
  stepTitle: { fontSize: 15, fontWeight: 800, color: "#E2E8F0" },
  ghostTopButton: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.03)",
    color: "#E2E8F0",
    fontWeight: 700,
    cursor: "pointer",
  },
  progressRow: { display: "flex", gap: 8, alignItems: "center" },
  progressDot: {
    width: 26,
    height: 6,
    borderRadius: 999,
    background: "linear-gradient(135deg, rgba(56,189,248,0.92), rgba(129,140,248,0.92))",
    opacity: 0.28,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(300px, 0.9fr)",
    gap: 18,
    alignItems: "stretch",
  },
  copyCard: {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(15,23,42,0.64)",
    padding: 22,
    display: "grid",
    gap: 18,
  },
  kicker: {
    display: "inline-flex",
    width: "fit-content",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(56,189,248,0.10)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "#BAE6FD",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  copyStack: { display: "grid", gap: 14 },
  title: {
    margin: 0,
    fontSize: 56,
    lineHeight: 0.96,
    letterSpacing: "-0.06em",
    maxWidth: 720,
    fontWeight: 850,
  },
  titleAccent: { color: "#C7D2FE" },
  lead: { margin: 0, fontSize: 17, lineHeight: 1.7, color: "#CBD5E1", maxWidth: 640 },
  quoteBox: {
    borderRadius: 20,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(255,255,255,0.03)",
    padding: 18,
    display: "grid",
    gap: 12,
  },
  quoteLabel: { fontSize: 13, fontWeight: 800, color: "#94A3B8" },
  quoteList: { display: "flex", flexWrap: "wrap", gap: 10 },
  quote: {
    display: "inline-flex",
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(8,15,30,0.86)",
    border: "1px solid rgba(148,163,184,0.16)",
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: 600,
  },
  support: { margin: 0, fontSize: 15, lineHeight: 1.72, color: "#94A3B8", maxWidth: 640 },
  actions: { display: "flex", gap: 12, flexWrap: "wrap" },
  secondaryButton: {
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "transparent",
    color: "#E2E8F0",
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryButton: {
    minHeight: 48,
    padding: "0 20px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)",
    color: "#04111D",
    fontWeight: 800,
    cursor: "pointer",
  },
  previewCard: {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "linear-gradient(180deg, rgba(56,189,248,0.09) 0%, rgba(15,23,42,0.78) 100%)",
    padding: 22,
    display: "grid",
    gap: 16,
    alignContent: "start",
  },
  previewBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: 700,
  },
  timeline: { display: "grid", gap: 12 },
  timelineItemStrong: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    background: "rgba(8,15,30,0.82)",
    border: "1px solid rgba(56,189,248,0.22)",
  },
  timelineItemMuted: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(148,163,184,0.14)",
  },
  timelineDay: { fontSize: 12, color: "#94A3B8", marginBottom: 4 },
  timelineTitle: { fontSize: 15, fontWeight: 800, color: "#F8FAFC" },
  timelineTime: { fontSize: 14, fontWeight: 800, color: "#CBD5E1" },
  alertCard: {
    borderRadius: 20,
    padding: 18,
    background: "rgba(248,113,113,0.10)",
    border: "1px solid rgba(248,113,113,0.18)",
    display: "grid",
    gap: 8,
  },
  alertTitle: { fontSize: 15, fontWeight: 800, color: "#FCA5A5" },
  alertBody: { fontSize: 14, lineHeight: 1.68, color: "#FECACA" },
  previewFoot: { fontSize: 14, lineHeight: 1.7, color: "#CBD5E1" },
};