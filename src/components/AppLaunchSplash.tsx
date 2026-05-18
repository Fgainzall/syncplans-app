"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "syncplans_launch_splash_seen_v2";
const PRIVATE_ROUTES = [
  "/summary",
  "/calendar",
  "/events",
  "/conflicts",
  "/panel",
  "/groups",
  "/members",
  "/invitations",
  "/profile",
  "/settings",
  "/pricing",
  "/planes",
];

function shouldShowForPath(pathname: string | null) {
  if (!pathname) return false;
  return PRIVATE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export default function AppLaunchSplash() {
  const pathname = usePathname();
  const isEligibleRoute = useMemo(() => shouldShowForPath(pathname), [pathname]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isEligibleRoute) return;

    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      alreadyShown = false;
    }

    if (alreadyShown) return;

    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Si storage falla, igual mostramos una vez durante este montaje.
    }

    setVisible(true);

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, 700);

    return () => window.clearTimeout(hideTimer);
  }, [isEligibleRoute]);

  if (!visible) return null;

  return (
    <div style={styles.overlay} aria-live="polite" aria-label="SyncPlans cargando">
      <section style={styles.card}>
        <div style={styles.logo}>S</div>
        <div style={styles.copy}>
          <div style={styles.eyebrow}>SyncPlans</div>
          <div style={styles.title}>Preparando tu resumen…</div>
          <div style={styles.sub}>Cargando lo esencial primero.</div>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    display: "grid",
    placeItems: "center",
    padding: 20,
    background:
      "radial-gradient(900px 420px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(700px 380px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.94)",
    pointerEvents: "none",
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
