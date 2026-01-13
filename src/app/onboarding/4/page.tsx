"use client";

import { useRouter } from "next/navigation";

const BRAND = {
  bg: "#020617",
  card: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.12)",
  text: "rgba(255,255,255,0.92)",
  sub: "rgba(255,255,255,0.70)",
  ok: "#22C55E",
  accent: "#38BDF8",
  warn: "#FBBF24",
};

export default function Onboarding4Page() {
  const router = useRouter();

  function markOnboardingDone() {
    try {
      localStorage.setItem("syncplans.onboarding_done", "true");
    } catch {}
  }

  function handleLogin() {
    // ✅ No marcamos onboarding done todavía (aún no entró al producto)
    router.push("/auth/login");
  }

  function handleCreateAccount() {
    // ✅ No marcamos onboarding done todavía (aún no entró al producto)
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
              4 de 4 · Listo para empezar
            </div>

            <div style={styles.iconWrap}>✨</div>
          </div>

          <h1 style={styles.h1}>
            Empieza con <span style={{ color: BRAND.accent }}>una configuración</span>{" "}
            <span style={{ color: BRAND.ok }}>rápida</span>
          </h1>

          <p style={styles.p}>
            Crea tu primer calendario y, si quieres, invita a tu pareja o familia.
            <br />
            En <b>60 segundos</b> estarás listo.
          </p>

          <div style={styles.list}>
            <div style={styles.item}>
              <div style={styles.check}>✓</div>
              <div style={styles.itemText}>
                <div style={styles.itemTitle}>Crea tu perfil</div>
                <div style={styles.itemSub}>Nombre y preferencias</div>
              </div>
              <div style={styles.status}>Listo</div>
            </div>

            <div style={styles.item}>
              <div style={styles.check}>✓</div>
              <div style={styles.itemText}>
                <div style={styles.itemTitle}>Elige tus capas</div>
                <div style={styles.itemSub}>Personal · Pareja · Familia</div>
              </div>
              <div style={styles.status}>Listo</div>
            </div>

            <div style={styles.item}>
              <div style={styles.check}>✓</div>
              <div style={styles.itemText}>
                <div style={styles.itemTitle}>Activa alertas</div>
                <div style={styles.itemSub}>Conflictos, recordatorios y más</div>
              </div>
              <div style={styles.status}>Listo</div>
            </div>
          </div>

          {/* ✅ NUEVO: Login arriba del CTA principal */}
          <button style={styles.login} onClick={handleLogin}>
            Iniciar sesión
          </button>

          <button style={styles.primary} onClick={handleCreateAccount}>
            Crear mi cuenta
          </button>

          <button style={styles.secondary} onClick={handleBack}>
            Volver
          </button>

          <div style={styles.tip}>Tip: luego puedes sincronizar Google/Apple Calendar.</div>

          {/* 
            Nota importante (para hacerlo “perfecto”):
            Marca onboarding_done cuando realmente entren a la app (ej: en /groups/choose o /calendar),
            no aquí. Si quieres, te digo exactamente dónde poner markOnboardingDone().
          */}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: `radial-gradient(900px 450px at 15% 10%, rgba(56,189,248,0.18), transparent 60%),
                 radial-gradient(900px 450px at 85% 20%, rgba(34,197,94,0.16), transparent 60%),
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
    boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
  },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  progressPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${BRAND.border}`,
    background: "rgba(255,255,255,0.04)",
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
    background: "rgba(255,255,255,0.04)",
    fontSize: 18,
  },
  h1: { margin: "14px 0 0", fontSize: 32, lineHeight: 1.1, letterSpacing: -0.5 },
  p: { margin: "10px 0 0", color: BRAND.sub, fontSize: 14, lineHeight: 1.6 },
  list: {
    marginTop: 16,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.12)",
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
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "rgba(34,197,94,0.18)",
    border: "1px solid rgba(34,197,94,0.35)",
    color: "rgba(255,255,255,0.95)",
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
    border: "1px solid rgba(34,197,94,0.30)",
    background: "rgba(34,197,94,0.12)",
    color: "rgba(255,255,255,0.92)",
  },

  // ✅ NUEVO: botón login (más “ligero” que el primary)
  login: {
    marginTop: 16,
    width: "100%",
    borderRadius: 18,
    padding: "12px 16px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: BRAND.text,
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },

  primary: {
    marginTop: 10,
    width: "100%",
    borderRadius: 18,
    padding: "14px 16px",
    border: "1px solid rgba(56,189,248,0.35)",
    background: "linear-gradient(90deg, rgba(37,99,235,0.9), rgba(34,197,94,0.9))",
    color: "white",
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
    background: "rgba(255,255,255,0.04)",
    color: BRAND.text,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
  tip: { marginTop: 12, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.55)" },
};
