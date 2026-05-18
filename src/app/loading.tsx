import type React from "react";

export default function Loading() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}>S</div>
        <div style={styles.copy}>
          <div style={styles.eyebrow}>SyncPlans</div>
          <div style={styles.title}>Preparando tu resumen…</div>
          <div style={styles.sub}>Cargando lo esencial primero.</div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background:
      "radial-gradient(900px 420px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(700px 380px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.94)",
  },
  card: {
    width: "min(420px, 100%)",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.72)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.32)",
    padding: 18,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "rgba(56,189,248,0.16)",
    border: "1px solid rgba(125,211,252,0.28)",
    fontWeight: 950,
    fontSize: 20,
  },
  copy: { minWidth: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(125,211,252,0.92)",
  },
  title: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  sub: {
    marginTop: 3,
    fontSize: 12,
    color: "rgba(226,232,240,0.70)",
    fontWeight: 650,
  },
};
