"use client";

import { useRouter } from "next/navigation";

const BRAND = {
  bg: "#0b1020",
  card: "rgba(15,23,42,0.92)",
  border: "rgba(148,163,184,0.35)",
  text: "rgba(248,250,252,0.96)",
  sub: "rgba(148,163,184,0.85)",
  ok: "#86EFAC",
  accent: "#7DD3FC",
  warn: "#FBBF24",
};

export default function Onboarding4Page() {
  const router = useRouter();

  function handleLogin() {
    router.push("/auth/login");
  }

  function handleCreateAccount() {
    router.push("/auth/register");
  }

  function handleBack() {
    router.push("/onboarding/3");
  }

  return (
    <main style={styles.main}>
      <div style={styles.shell}>
        <section style={styles.card}>
          <div style={styles.topRow}>
            <div style={styles.progressPill}>
              <span style={{ ...styles.dot, background: BRAND.ok }} />
              4 de 4 · Decidir mejor, discutir menos
            </div>

            <div style={styles.iconWrap}>⚖️</div>
          </div>

          <h1 style={styles.h1}>
            Decidir es mejor que{" "}
            <span style={{ color: BRAND.accent }}>discutir</span>{" "}
            <span style={{ color: BRAND.ok }}>después</span>
          </h1>

          <p style={styles.p}>
            Cuando dos planes se cruzan, SyncPlans no se queda callado. Marca el
            conflicto, te muestra todo lo que está en juego y te pide una
            decisión clara, para que haya{" "}
            <strong>una sola versión de la verdad</strong> y nadie se lleve la
            sorpresa a último minuto.
          </p>

          <div style={styles.list}>
            <div style={styles.item}>
              <div style={styles.check}>1</div>
              <div style={styles.itemText}>
                <div style={styles.itemTitle}>Conservar uno</div>
                <div style={styles.itemSub}>
                  Eliges qué plan se queda y cuál se mueve o se cancela. Una
                  decisión, una sola historia que todos comparten.
                </div>
              </div>
              <div style={styles.status}>Decisión</div>
            </div>

            <div style={styles.item}>
              <div style={styles.check}>2</div>
              <div style={styles.itemText}>
                <div style={styles.itemTitle}>Conservar ambos</div>
                <div style={styles.itemSub}>
                  Aceptas que convivan (por ejemplo, ver un partido mientras
                  cocinan en familia). El conflicto se mantiene visible para
                  todos, sin engaños.
                </div>
              </div>
              <div style={styles.status}>Acordado</div>
            </div>

            <div style={styles.item}>
              <div style={styles.check}>3</div>
              <div style={styles.itemText}>
                <div style={styles.itemTitle}>Ajustar después</div>
                <div style={styles.itemSub}>
                  Dejas marcado que hay un tema pendiente. No se borra nada, y
                  todos ven que hay algo por resolver más adelante.
                </div>
              </div>
              <div style={styles.status}>Pendiente</div>
            </div>
          </div>

          {/* CTA PRINCIPAL: crear espacio (registro) */}
          <button style={styles.primary} onClick={handleCreateAccount}>
            Crear mi espacio en SyncPlans
          </button>

          {/* CTA SECUNDARIA: login para los que ya tienen cuenta */}
          <button style={styles.login} onClick={handleLogin}>
            Ya tengo cuenta, iniciar sesión
          </button>

          <button style={styles.secondary} onClick={handleBack}>
            Volver
          </button>

          <div style={styles.tip}>
            Después de crear tu cuenta, verás un{" "}
            <strong>resumen claro de tus próximos planes</strong> y de los
            conflictos que podrías tener. SyncPlans funciona mejor cuando no
            estás solo: luego podrás invitar a tu pareja o familia y compartir
            la misma verdad sobre la agenda.
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: `radial-gradient(900px 450px at 15% 10%, rgba(125,211,252,0.18), transparent 60%),
                 radial-gradient(900px 450px at 85% 20%, rgba(134,239,172,0.16), transparent 60%),
                 ${BRAND.bg}`,
    color: BRAND.text,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px 16px",
  },
  shell: { width: "100%", display: "flex", justifyContent: "center" },
  card: {
    width: "100%",
    maxWidth: 520,
    background: BRAND.card,
    border: `1px solid ${BRAND.border}`,
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 30px 80px rgba(15,23,42,0.75)",
    backdropFilter: "blur(12px)",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${BRAND.border}`,
    background: "rgba(15,23,42,0.85)",
    fontSize: 12,
    color: BRAND.sub,
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    border: `1px solid ${BRAND.border}`,
    background: "rgba(15,23,42,0.85)",
    fontSize: 18,
  },
  h1: {
    margin: "14px 0 0",
    fontSize: 32,
    lineHeight: 1.1,
    letterSpacing: -0.5,
  },
  p: {
    margin: "10px 0 0",
    color: BRAND.sub,
    fontSize: 14,
    lineHeight: 1.6,
  },
  list: {
    marginTop: 16,
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15,23,42,0.90)",
    padding: 12,
    display: "grid",
    gap: 10,
  },
  item: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.26)",
    background: "rgba(15,23,42,0.95)",
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "rgba(134,239,172,0.14)",
    border: "1px solid rgba(134,239,172,0.30)",
    color: "rgba(248,250,252,0.96)",
    fontWeight: 800,
    fontSize: 13,
  },
  itemText: { display: "grid", gap: 2 },
  itemTitle: { fontSize: 14, fontWeight: 800 },
  itemSub: { fontSize: 12, color: BRAND.sub },
  status: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(134,239,172,0.35)",
    background: "rgba(134,239,172,0.14)",
    color: "rgba(248,250,252,0.96)",
  },

  primary: {
    marginTop: 16,
    width: "100%",
    borderRadius: 18,
    padding: "14px 16px",
    border: "1px solid rgba(125,211,252,0.35)",
    background: "linear-gradient(90deg, #60A5FA, #86EFAC)",
    color: "white",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 18px 36px rgba(37,99,235,0.28)",
  },

  login: {
    marginTop: 10,
    width: "100%",
    borderRadius: 18,
    padding: "12px 16px",
    border: "1px solid rgba(148,163,184,0.40)",
    background: "rgba(15,23,42,0.90)",
    color: BRAND.text,
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },

  secondary: {
    marginTop: 10,
    width: "100%",
    borderRadius: 18,
    padding: "12px 16px",
    border: `1px solid ${BRAND.border}`,
    background: "rgba(15,23,42,0.90)",
    color: BRAND.text,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
  tip: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    color: "rgba(148,163,184,0.85)",
  },
};
