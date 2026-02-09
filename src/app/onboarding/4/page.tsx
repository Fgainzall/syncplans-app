"use client";

import { useRouter } from "next/navigation";

const BRAND = {
  bg: "#F9FAFB",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#0F172A",
  sub: "#4B5563",
  ok: "#22C55E",
  accent: "#3B82F6",
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

          {/* CTA PRINCIPAL */}
          <button style={styles.primary} onClick={handleCreateAccount}>
            Crear mi espacio en SyncPlans
          </button>

          {/* CTA SECUNDARIA */}
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
    background:
      "radial-gradient(circle at 0% 0%, rgba(191,219,254,0.7), transparent 55%), radial-gradient(circle at 100% 0%, rgba(221,214,254,0.7), transparent 55%), linear-gradient(180deg, #F9FAFB 0%, #EFF6FF 100%)",
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
    borderRadius: 24,
    padding: 22,
    boxShadow:
      "0 18px 40px rgba(15,23,42,0.07), 0 0 0 1px rgba(148,163,184,0.10)",
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
    background: "#F3F4FF",
    fontSize: 12,
    color: BRAND.sub,
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    border: `1px solid ${BRAND.border}`,
    background: "#FFFFFF",
    fontSize: 18,
  },
  h1: {
    margin: "14px 0 0",
    fontSize: 26,
    lineHeight: 1.2,
    letterSpacing: -0.5,
    color: BRAND.text,
  },
  p: {
    margin: "10px 0 0",
    color: BRAND.sub,
    fontSize: 14,
    lineHeight: 1.6,
  },
  list: {
    marginTop: 16,
    borderRadius: 18,
    border: "1px solid #E5E7EB",
    background: "#F9FAFB",
    padding: 12,
    display: "grid",
    gap: 10,
  },
  item: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "#ECFDF5",
    border: "1px solid #BBF7D0",
    color: BRAND.text,
    fontWeight: 700,
    fontSize: 13,
  },
  itemText: { display: "grid", gap: 2 },
  itemTitle: { fontSize: 14, fontWeight: 600, color: BRAND.text },
  itemSub: { fontSize: 12, color: BRAND.sub },
  status: {
    fontSize: 11,
    fontWeight: 600,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #BBF7D0",
    background: "#ECFDF5",
    color: "#166534",
  },

  primary: {
    marginTop: 16,
    width: "100%",
    borderRadius: 999,
    padding: "13px 16px",
    border: "none",
    background: "linear-gradient(90deg, #3B82F6, #22C55E)",
    color: "white",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  },

  login: {
    marginTop: 10,
    width: "100%",
    borderRadius: 999,
    padding: "11px 16px",
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    color: BRAND.text,
    fontWeight: 500,
    fontSize: 14,
    cursor: "pointer",
  },

  secondary: {
    marginTop: 8,
    width: "100%",
    borderRadius: 999,
    padding: "10px 16px",
    border: "1px solid #E5E7EB",
    background: "#F9FAFB",
    color: "#4B5563",
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
  },
  tip: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    color: BRAND.sub,
  },
};
