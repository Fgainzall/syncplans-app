// src/app/conflicts/actions/ActionsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  CalendarEvent,
  computeVisibleConflicts,
  attachEvents,
  type ConflictItem,
  conflictKey,
} from "@/lib/conflicts";
import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import { deleteEventsByIds } from "@/lib/eventsDb";

import {
  Resolution,
  getMyConflictResolutionsMap,
  clearMyConflictResolutions,
} from "@/lib/conflictResolutionsDb";

/** fallback: si el conflictId exacto no matchea, matcheamos por pareja de eventos */
function resolutionForConflict(
  c: ConflictItem,
  resMap: Record<string, Resolution>
): Resolution | undefined {
  const exact = resMap[String(c.id)];
  if (exact) return exact;

  const a = String(c.existingEventId ?? "");
  const b = String(c.incomingEventId ?? "");
  if (!a || !b) return undefined;

  // ✅ clave estable (mismo generador que computeVisibleConflicts)
  const stableKey = conflictKey(a, b);
  if (resMap[stableKey]) return resMap[stableKey];

  // ✅ compat: si en algún momento guardaste con formato viejo "cx::a::b::algo"
  const [x, y] = [a, b].sort();
  const legacyPrefix = `cx::${x}::${y}::`;

  for (const k of Object.keys(resMap)) {
    if (k.startsWith(legacyPrefix)) return resMap[k];
  }
  return undefined;
}

export default function ActionsClient({
  groupIdFromUrl,
}: {
  groupIdFromUrl: string | null;
}) {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [toast, setToast] = useState<null | { title: string; sub?: string }>(
    null
  );

  /* ========================= Toast auto-hide ========================= */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /* ========================= Boot ========================= */
  useEffect(() => {
    let alive = true;
    (async () => {
      setBooting(true);

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      if (error || !data.session?.user) {
        setBooting(false);
        router.replace("/auth/login");
        return;
      }

      try {
        const { events: ev } = await loadEventsFromDb({
          groupId: groupIdFromUrl,
        });
        if (!alive) return;
        setEvents(Array.isArray(ev) ? ev : []);
      } catch {
        if (!alive) return;
        setEvents([]);
      }

      try {
        const dbMap = await getMyConflictResolutionsMap();
        if (!alive) return;
        setResMap(dbMap ?? {});
      } catch {
        if (!alive) return;
        setResMap({});
      }

      setBooting(false);
    })();

    return () => {
      alive = false;
    };
  }, [router, groupIdFromUrl]);

  /* ========================= Conflicts + plan ========================= */
  const conflicts = useMemo<ConflictItem[]>(() => {
    const cx = computeVisibleConflicts(events);
    return attachEvents(cx, events);
  }, [events]);

  const plan = useMemo(() => {
    let decided = 0;
    let pending = 0;
    let skipped = 0;
    const deleteIds = new Set<string>();

    for (const c of conflicts) {
      const r = resolutionForConflict(c, resMap);
      if (!r) {
        pending++;
        continue;
      }
      decided++;
      if (r === "none") {
        skipped++;
        continue;
      }
      if (r === "keep_existing" && c.incomingEventId) {
        deleteIds.add(String(c.incomingEventId));
      }
      if (r === "replace_with_new" && c.existingEventId) {
        deleteIds.add(String(c.existingEventId));
      }
    }

    return {
      total: conflicts.length,
      decided,
      pending,
      skipped,
      deleteIds: Array.from(deleteIds),
    };
  }, [conflicts, resMap]);

  const disabledApply = plan.decided === 0 || busy;

  /* ========================= Actions ========================= */
  const apply = async () => {
    if (busy) return;

    if (plan.decided === 0) {
      setToast({
        title: "Nada que aplicar",
        sub: "Primero elige qué hacer con al menos un conflicto.",
      });
      return;
    }

    try {
      setBusy(true);

      if (plan.deleteIds.length > 0) {
        // ✅ solo por id, RLS-safe (sin SELECT raros)
        await deleteEventsByIds(plan.deleteIds);
      }

      try {
        await clearMyConflictResolutions();
      } catch {
        // no bloquea la UX si falla limpiar
      }

      // 🔁 Ahora redirigimos al resumen con contexto,
      // para mostrar un feedback sutil post-conflictos
      const resolved = plan.decided; // decisiones tomadas (incluye "none")
      const qp = new URLSearchParams();
      qp.set("from", "conflicts");
      qp.set("resolved", String(resolved));
      if (plan.deleteIds.length > 0) {
        qp.set("deleted", String(plan.deleteIds.length));
      }

      router.replace(`/summary?${qp.toString()}`);
    } catch (e: any) {
      setBusy(false);
      setToast({
        title: "No se pudo aplicar",
        sub:
          e?.message ??
          "Inténtalo nuevamente en unos segundos (puede ser RLS/permiso).",
      });
    }
  };

  const back = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    router.push(`/conflicts/detected?${qp.toString()}`);
  };

  /* ========================= Loading ========================= */
  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Preparando cambios…</div>
              <div style={styles.loadingSub}>Un último chequeo</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ========================= UI ========================= */
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topRow}>
          <PremiumHeader />
          <div style={styles.topActions}>
            <button onClick={back} style={styles.ghostBtn}>
              ← Volver
            </button>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.kicker}>Último paso</div>
            <h1 style={styles.h1}>Aplicar decisiones</h1>
            <div style={styles.sub}>
              Esto actualizará tu calendario y resolverá los conflictos
              seleccionados.
            </div>
            {conflicts.length > 0 && plan.decided === 0 && (
              <div style={styles.helperText}>
                No hay decisiones guardadas aún. Vuelve a “Comparar” y elige
                Conservar A/B.
              </div>
            )}
          </div>

          <div style={styles.heroRight}>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Conflictos</div>
                <div style={styles.statValue}>{plan.total}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Decididos</div>
                <div style={styles.statValue}>{plan.decided}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Pendientes</div>
                <div style={styles.statValue}>{plan.pending}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Por eliminar</div>
                <div style={styles.statValue}>{plan.deleteIds.length}</div>
              </div>
            </div>

            <button
              onClick={apply}
              disabled={disabledApply}
              style={{
                ...styles.primaryBtn,
                opacity: disabledApply ? 0.55 : 1,
                cursor: disabledApply ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Aplicando…" : "Aplicar cambios ✅"}
            </button>
          </div>
        </section>

        {conflicts.length === 0 && (
          <section style={styles.emptyCard}>
            <div style={styles.emptyTitle}>No hay conflictos abiertos</div>
            <div style={styles.emptySub}>
              Tu calendario ya está limpio. Puedes volver al calendario o crear
              nuevos eventos.
            </div>
            <button
              onClick={() => router.push("/calendar")}
              style={styles.primaryBtnWide}
            >
              Ir al calendario
            </button>
          </section>
        )}

        {toast && (
          <div style={styles.toast}>
            <div style={styles.toastT}>{toast.title}</div>
            {toast.sub && <div style={styles.toastS}>{toast.sub}</div>}
          </div>
        )}
      </div>
    </main>
  );
}

/* ========================= Styles ========================= */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 48px",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 14,
  },
  heroLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
  },
  heroRight: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "flex-end",
    minWidth: 260,
  },
  kicker: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  },
  h1: {
    margin: 0,
    fontSize: 26,
    letterSpacing: "-0.6px",
  },
  sub: {
    fontSize: 13,
    opacity: 0.78,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.82,
    lineHeight: 1.35,
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  primaryBtn: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(80px, 1fr))",
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    padding: 8,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(5,8,22,0.85)",
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.75,
  },
  statValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: 900,
  },
  emptyCard: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.02)",
    padding: 18,
  },
  emptyTitle: {
    fontWeight: 900,
    fontSize: 16,
  },
  emptySub: {
    marginTop: 6,
    opacity: 0.78,
    fontSize: 13,
  },
  primaryBtnWide: {
    marginTop: 12,
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 240,
  },
  loadingCard: {
    marginTop: 18,
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
  },
  loadingTitle: {
    fontWeight: 900,
  },
  loadingSub: {
    fontSize: 12,
    opacity: 0.75,
  },
  toast: {
    position: "fixed",
    left: 18,
    right: 18,
    bottom: 18,
    maxWidth: 560,
    margin: "0 auto",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(16,18,26,0.92)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
  },
  toastT: {
    fontSize: 13,
    fontWeight: 900,
  },
  toastS: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
  },
};
