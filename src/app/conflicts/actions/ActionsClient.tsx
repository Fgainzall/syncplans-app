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
} from "@/lib/conflicts";

import { loadEventsFromDb, deleteEventsByIdsDb } from "@/lib/conflictsDbBridge";

import {
  Resolution,
  getMyConflictResolutionsMap,
  clearMyConflictResolutions,
} from "@/lib/conflictResolutionsDb";

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

  /* =========================
     Toast auto-hide
     ========================= */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /* =========================
     Boot
     ========================= */
  useEffect(() => {
    let alive = true;

    const fetchResMap = async () => {
      const dbMap = await getMyConflictResolutionsMap();
      if (!alive) return;
      setResMap(dbMap ?? {});
    };

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
        await fetchResMap();

        // ✅ segundo pull por si el upsert recién aterriza o hay race
        setTimeout(() => {
          fetchResMap().catch(() => {});
        }, 450);
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

  /* =========================
     Conflicts + plan
     ========================= */
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
      const r = resMap[String(c.id)];

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

  /* =========================
     Actions
     ========================= */
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
        await deleteEventsByIdsDb(plan.deleteIds);
      }

      try {
        await clearMyConflictResolutions();
      } catch {
        // no bloquea UX
      }

      router.replace(
        `/calendar?applied=1&deleted=${plan.deleteIds.length}&skipped=${plan.skipped}&appliedCount=${plan.decided}`
      );
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

  /* =========================
     Loading
     ========================= */
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

  /* =========================
     UI
     ========================= */
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

        {/* DEBUG (temporal) */}
        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.25)",
            padding: 12,
            fontSize: 12,
            opacity: 0.9,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            DEBUG /conflicts/actions
          </div>

          <div>
            conflicts.length: <b>{conflicts.length}</b>
          </div>
          <div>
            resMap keys: <b>{Object.keys(resMap).length}</b>
          </div>
          <div>
            plan.decided: <b>{plan.decided}</b> | pending: <b>{plan.pending}</b>{" "}
            | deleteIds: <b>{plan.deleteIds.length}</b>
          </div>
          <div>
            disabledApply: <b>{String(disabledApply)}</b>
          </div>

          <div style={{ marginTop: 8, opacity: 0.8 }}>
            <div>
              <b>first conflict id</b>: {conflicts[0]?.id ?? "—"}
            </div>
            <div>
              <b>first resMap key</b>: {Object.keys(resMap)[0] ?? "—"}
            </div>
          </div>

          <div style={{ marginTop: 8, opacity: 0.7 }}>
            <div>
              <b>conflict ids (top 3)</b>:
            </div>
            <div style={{ wordBreak: "break-all" }}>
              {conflicts.slice(0, 3).map((c) => c.id).join(" | ") || "—"}
            </div>

            <div style={{ marginTop: 6 }}>
              <b>resMap keys (top 3)</b>:
            </div>
            <div style={{ wordBreak: "break-all" }}>
              {Object.keys(resMap).slice(0, 3).join(" | ") || "—"}
            </div>
          </div>
        </div>

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

/* =========================
   Styles
   ========================= */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { maxWidth: 1120, margin: "0 auto", padding: "22px 18px 48px" },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  topActions: { display: "flex", gap: 10, alignItems: "center" },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  heroLeft: { display: "flex", flexDirection: "column", gap: 6 },
  heroRight: { display: "flex", gap: 10, alignItems: "center" },
  kicker: { fontSize: 11, fontWeight: 900 },
  h1: { margin: 0, fontSize: 28 },
  sub: { fontSize: 13, opacity: 0.75 },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.8,
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
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(124,58,237,0.25)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  loadingCard: {
    marginTop: 18,
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
  },
  loadingTitle: { fontWeight: 900 },
  loadingSub: { fontSize: 12, opacity: 0.75 },
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
  toastT: { fontSize: 13, fontWeight: 900 },
  toastS: { marginTop: 4, fontSize: 12, opacity: 0.75 },
};
