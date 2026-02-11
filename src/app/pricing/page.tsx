// src/app/pricing/page.tsx
import React from "react";
import Link from "next/link";
import PremiumHeader from "@/components/PremiumHeader";

const featuresFree = [
  "Calendario personal básico",
  "Uno o pocos grupos para probar (pareja / familia / otros)",
  "Detección de conflictos al guardar planes",
  "Sin tarjeta ni pagos durante la beta",
];

const featuresMonthly = [
  "Todos los grupos que necesites (pareja, familia, amigos, equipos)",
  "Detección avanzada de conflictos entre calendarios compartidos",
  "Resumen diario por email con tus planes del día",
  "Resumen semanal con próximos planes importantes",
  "Notificaciones de cambios relevantes en tu pareja / familia",
];

const featuresYearly = [
  "Todo lo del plan mensual",
  "Precio fundador garantizado mientras mantengas el plan",
  "Equivale a pagar ~10 meses y tener ~2 gratis",
];

export default function PricingPage() {
  return (
    <main style={S.page}>
      <div style={S.shell}>
        <PremiumHeader
          title="Planes"
          subtitle="SyncPlans no es otro calendario: es el árbitro neutral de tu tiempo compartido."
        />

        <div style={S.content}>
          {/* Cinta demo premium */}
          <div style={S.banner}>
            <span style={S.bannerStrong}>Demo Premium activo · </span>
            <span>
              Estás en la beta privada de SyncPlans. Hoy todos los usuarios
              tienen acceso a funciones Premium sin costo ni tarjeta. Cuando
              activemos los pagos, podrás elegir si quedarte en el plan Gratis
              o pasar a Premium (mensual o anual) con total claridad de precios.
            </span>
          </div>

          {/* Hero centrado */}
          <section style={S.hero}>
            <p style={S.heroKicker}>PLANES DE SYNCPLANS</p>
            <h1 style={S.heroTitle}>
              Coordinar horarios no debería ser un motivo de pelea.
            </h1>
            <p style={S.heroCopy}>
              SyncPlans no compite con tu calendario de siempre. Lo que hace es
              poner en un solo lugar los planes compartidos y mostrar los
              choques antes de que se transformen en un “yo pensé que era otro
              día” o “nunca vi ese mensaje”.
            </p>
          </section>

          {/* Etiquetas arriba de los precios */}
          <section style={S.ribbonRow}>
            <div style={S.recommendedPill}>
              <span style={S.recommendedTag}>RECOMENDADO</span>
              <span style={S.recommendedText}>
                Plan anual: ~2 meses gratis frente al mensual ☕
              </span>
            </div>
            <div style={S.pricesHint}>
              Precios en <strong>USD</strong> · impuestos pueden variar según tu
              país
            </div>
          </section>

          {/* FILA DE PLANES, CENTRADA */}
          <section style={S.plansRow}>
            {/* Gratis */}
            <article style={S.card}>
              <div style={S.cardHeaderLine}>GRATIS</div>
              <h2 style={S.cardTitle}>Plan Básico</h2>
              <p style={S.cardCopy}>
                Para probar la idea con tu pareja o familia, sin compromiso y
                usando tus planes reales del día a día.
              </p>

              <div style={S.priceRow}>
                <span style={S.priceMain}>US$0</span>
                <span style={S.priceSuffix}>/ mes</span>
              </div>

              <ul style={S.featuresList}>
                {featuresFree.map((item) => (
                  <li key={item} style={S.featureItem}>
                    <span style={S.featureDot} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div style={S.cardFooter}>
                <Link href="/register" style={S.cardGhostButton}>
                  Empezar gratis
                </Link>
              </div>
            </article>

            {/* Mensual */}
            <article style={{ ...S.card, ...S.cardHighlight }}>
              <div style={S.cardHeadRow}>
                <div style={{ ...S.cardHeaderLine, color: "#fecaca" }}>
                  PREMIUM
                </div>
                <div style={S.cardBadge}>PLAN PRINCIPAL</div>
              </div>

              <h2 style={{ ...S.cardTitle, color: "#fee2e2" }}>
                Plan Mensual
              </h2>
              <p style={{ ...S.cardCopy, color: "rgba(254,226,226,0.85)" }}>
                Para parejas, familias y grupos que de verdad usan SyncPlans
                como su lugar oficial para coordinar.
              </p>

              <div style={S.priceRow}>
                <span style={{ ...S.priceMain, color: "#fee2e2" }}>
                  US$6.90
                </span>
                <span style={{ ...S.priceSuffix, color: "#fee2e2" }}>
                  / mes
                </span>
              </div>
              <p style={S.priceNote}>
                Menos que una salida simple al mes a cambio de tener paz con tu
                agenda compartida y menos fricción en las conversaciones.
              </p>

              <ul style={{ ...S.featuresList, color: "rgba(254,226,226,0.92)" }}>
                {featuresMonthly.map((item) => (
                  <li key={item} style={S.featureItem}>
                    <span
                      style={{ ...S.featureDot, background: "#fecaca" }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div style={S.cardFooter}>
                {/* CTA listo para futuro Paddle: de momento deshabilitado */}
                <button type="button" style={S.cardPrimaryButton} disabled>
                  Demo Premium activo
                </button>
                <p style={S.betaHint}>
                  Durante la beta no se te cobrará nada. Cuando lancemos, desde
                  aquí podrás activar tu suscripción mensual con un clic.
                </p>
              </div>
            </article>

            {/* Anual */}
            <article style={{ ...S.card, ...S.cardAnnual }}>
              <div style={S.cardHeadRow}>
                <div style={{ ...S.cardHeaderLine, color: "#bae6fd" }}>
                  PREMIUM
                </div>
                <div style={S.cardBadgeSky}>~2 MESES GRATIS</div>
              </div>

              <h2 style={{ ...S.cardTitle, color: "#e0f2fe" }}>Plan Anual</h2>
              <p style={{ ...S.cardCopy, color: "rgba(224,242,254,0.90)" }}>
                Para quienes ya vieron el valor y prefieren pagar una vez al
                año, olvidarse del cobro mensual y asegurar el precio.
              </p>

              <div style={S.priceRow}>
                <span style={{ ...S.priceMain, color: "#e0f2fe" }}>
                  US$69
                </span>
                <span style={{ ...S.priceSuffix, color: "#e0f2fe" }}>
                  / año
                </span>
              </div>

              <p style={S.priceNoteSky}>
                Equivalente a ~US$5.75 al mes. Aproximadamente 2 meses gratis
                frente al plan mensual y un compromiso claro con cómo coordinas
                tu tiempo.
              </p>

              <ul style={{ ...S.featuresList, color: "rgba(224,242,254,0.92)" }}>
                {featuresYearly.map((item) => (
                  <li key={item} style={S.featureItem}>
                    <span
                      style={{ ...S.featureDot, background: "#7dd3fc" }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div style={S.cardFooter}>
                {/* También listo para futuro Paddle / founder yearly */}
                <button type="button" style={S.cardOutlineButton} disabled>
                  Disponible después de la beta
                </button>
                <p style={S.betaHintSky}>
                  Cuando lancemos oficialmente, este será el plan recomendado
                  para parejas y familias que usan SyncPlans todos los días.
                </p>
              </div>
            </article>
          </section>

          {/* Bloques cortos explicativos */}
          <section style={S.infoGrid}>
            <div style={S.infoCard}>
              <h3 style={S.infoTitle}>¿Para quién es SyncPlans?</h3>
              <p style={S.infoText}>
                Para personas que coordinan con otros: parejas que ya no quieren
                discusiones por horarios, familias que hacen malabares con cole,
                trabajo y viajes, y grupos de amigos o equipos que quieren
                mantener vivos los planes sin 200 mensajes cruzados.
              </p>
            </div>

            <div style={S.infoCard}>
              <h3 style={S.infoTitle}>
                ¿Por qué no basta con WhatsApp y un calendario normal?
              </h3>
              <p style={S.infoText}>
                WhatsApp sirve para hablar, pero no para ver el impacto de un
                cambio en todo el grupo. Un calendario individual solo ve tu
                agenda. SyncPlans cruza las agendas compartidas, detecta choques
                al guardar y te obliga a decidir antes de que el problema llegue
                a la conversación.
              </p>
            </div>

            <div style={S.infoCard}>
              <h3 style={S.infoTitle}>Beta, Premium y grupo fundador</h3>
              <p style={S.infoText}>
                Durante la beta, usas SyncPlans con acceso Premium completo y
                precio US$0. Cuando lancemos, podrás quedarte en el plan Gratis
                o pasar al Premium mensual (US$6.90) o anual (US$69). Si
                Fernando te invitó como parte del grupo fundador, verás un
                precio especial de aproximadamente US$3.90/mes o US$39/año
                mientras mantengas el plan activo: es nuestra forma de agradecer
                a quienes ayudaron a construir la versión real del producto.
              </p>
            </div>
          </section>

          {/* CTA final */}
          <section style={S.cta}>
            <div style={S.ctaTextCol}>
              <h3 style={S.ctaTitle}>Empieza ahora, sin tarjeta.</h3>
              <p style={S.ctaCopy}>
                Crea tu cuenta, invita a tu pareja o familia y mete los planes
                reales de las próximas semanas. El verdadero valor se siente
                cuando aparece el primer conflicto que ves a tiempo y la
                conversación cambia de “por qué no me avisaste” a “qué hacemos
                con esto”.
              </p>
            </div>
            <div style={S.ctaActions}>
              <Link href="/register" style={S.ctaPrimary}>
                Crear cuenta gratis
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050816",
    color: "rgba(248,250,252,0.98)",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
  },
  shell: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 48px",
  },
  content: {
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  // Banner
  banner: {
    borderRadius: 18,
    padding: "10px 14px",
    border: "1px solid rgba(251,191,36,0.45)",
    background:
      "linear-gradient(90deg, rgba(245,158,11,0.18), rgba(15,23,42,0.95))",
    fontSize: 12,
    color: "#fef3c7",
  },
  bannerStrong: {
    fontWeight: 800,
  },

  // Hero
  hero: {
    textAlign: "center",
    maxWidth: 640,
    margin: "4px auto 0",
  },
  heroKicker: {
    fontSize: 11,
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color: "#94a3b8",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 1.24,
    fontWeight: 900,
    margin: 0,
  },
  heroCopy: {
    marginTop: 8,
    fontSize: 13,
    color: "#cbd5f5",
    fontWeight: 500,
  },

  // Ribbons
  ribbonRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  recommendedPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 10px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(148,163,184,0.7)",
  },
  recommendedTag: {
    padding: "3px 8px",
    borderRadius: 999,
    background: "rgba(16,185,129,0.9)",
    color: "#022c22",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  recommendedText: {
    fontSize: 11,
    color: "#e5e7eb",
    fontWeight: 600,
  },
  pricesHint: {
    fontSize: 11,
    color: "#9ca3af",
  },

  // Planes
  plansRow: {
    marginTop: 10,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "stretch",
    gap: 16,
  },
  card: {
    flex: "1 1 260px",
    maxWidth: 340,
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(15,23,42,0.95)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
  },
  cardHighlight: {
    border: "1px solid rgba(248,113,113,0.85)",
    background:
      "linear-gradient(145deg, rgba(248,113,113,0.25), rgba(15,23,42,0.98))",
    boxShadow: "0 18px 45px rgba(127,29,29,0.55)",
  },
  cardAnnual: {
    border: "1px solid rgba(56,189,248,0.75)",
    background:
      "linear-gradient(145deg, rgba(56,189,248,0.18), rgba(15,23,42,0.98))",
    boxShadow: "0 18px 45px rgba(12,74,110,0.55)",
  },
  cardHeaderLine: {
    fontSize: 11,
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 6,
    fontWeight: 700,
  },
  cardHeadRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardBadge: {
    padding: "3px 8px",
    borderRadius: 999,
    background: "rgba(248,113,113,0.25)",
    color: "#fee2e2",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  cardBadgeSky: {
    padding: "3px 8px",
    borderRadius: 999,
    background: "rgba(56,189,248,0.25)",
    color: "#e0f2fe",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 800,
    marginTop: 4,
    marginBottom: 6,
  },
  cardCopy: {
    fontSize: 12,
    color: "#cbd5f5",
    marginBottom: 10,
  },
  priceRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 4,
  },
  priceMain: {
    fontSize: 24,
    fontWeight: 900,
  },
  priceSuffix: {
    fontSize: 11,
    color: "#9ca3af",
  },
  priceNote: {
    fontSize: 11,
    color: "rgba(254,226,226,0.92)",
    marginBottom: 10,
  },
  priceNoteSky: {
    fontSize: 11,
    color: "rgba(224,242,254,0.95)",
    marginBottom: 10,
  },
  featuresList: {
    listStyle: "none",
    padding: 0,
    margin: "4px 0 12px",
    fontSize: 12,
  },
  featureItem: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 4,
  },
  featureDot: {
    marginTop: 5,
    width: 5,
    height: 5,
    borderRadius: 999,
    background: "#9ca3af",
  },
  cardFooter: {
    marginTop: "auto",
  },
  cardGhostButton: {
    display: "inline-flex",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.8)",
    background: "rgba(15,23,42,0.95)",
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
    cursor: "pointer",
  },
  cardPrimaryButton: {
    display: "inline-flex",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 14,
    border: "none",
    background: "rgba(248,113,113,1)",
    color: "#111827",
    fontSize: 13,
    fontWeight: 900,
    cursor: "not-allowed",
  },
  cardOutlineButton: {
    display: "inline-flex",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.9)",
    background: "rgba(15,23,42,0.98)",
    color: "#e0f2fe",
    fontSize: 13,
    fontWeight: 800,
    cursor: "not-allowed",
  },
  betaHint: {
    marginTop: 6,
    fontSize: 10,
    color: "rgba(254,226,226,0.85)",
  },
  betaHintSky: {
    marginTop: 6,
    fontSize: 10,
    color: "rgba(224,242,254,0.9)",
  },

  // Info blocks
  infoGrid: {
    marginTop: 6,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  infoCard: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(15,23,42,0.96)",
    padding: 14,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: "#cbd5f5",
  },

  // CTA final
  cta: {
    marginTop: 10,
    borderRadius: 20,
    border: "1px solid rgba(96,165,250,0.7)",
    background:
      "radial-gradient(circle at 0 0, rgba(59,130,246,0.35), transparent 55%), rgba(15,23,42,0.98)",
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  ctaTextCol: {
    flex: "1 1 260px",
    minWidth: 0,
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: 900,
    marginBottom: 6,
  },
  ctaCopy: {
    fontSize: 12,
    color: "#dbeafe",
  },
  ctaActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "flex-end",
    flex: "0 0 auto",
  },
  ctaPrimary: {
    display: "inline-flex",
    padding: "8px 16px",
    borderRadius: 999,
    border: "1px solid rgba(191,219,254,0.9)",
    background: "#f97316",
    color: "#111827",
    fontSize: 13,
    fontWeight: 900,
    textDecoration: "none",
    cursor: "pointer",
  },
};
