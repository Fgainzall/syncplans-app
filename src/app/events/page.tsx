"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getMyEvents, deleteEventsByIds } from "@/lib/eventsDb";
import { getMyGroups } from "@/lib/groupsDb";

import { groupMeta, type CalendarEvent } from "@/lib/conflicts";

type DbGroup = {
  id: string;
  name: string | null;
  type: "pair" | "family" | string;
};

export default function EventsPage() {
  const router = useRouter();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [groupTypeById, setGroupTypeById] = useState<Map<string, "pair" | "family">>(new Map());

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const [rawEvents, rawGroups] = await Promise.all([
          getMyEvents().catch(() => [] as any[]),
          getMyGroups().catch(() => [] as any[]),
        ]);

        if (!alive) return;

        const groups: DbGroup[] = Array.isArray(rawGroups) ? (rawGroups as any) : [];

        // ✅ Mapa groupId -> ("pair" | "family")
        const typeMap = new Map<string, "pair" | "family">();
        for (const g of groups) {
          if (!g?.id) continue;
          const t = String(g.type);
          typeMap.set(String(g.id), t === "family" ? "family" : "pair");
        }
        setGroupTypeById(typeMap);

        // ✅ Normaliza eventos (NO confiamos en groupType que venga de DB)
        const list: CalendarEvent[] = (rawEvents || []).map((e: any) => {
          const groupId = e.group_id ? String(e.group_id) : null;

          // 👇 Importante: dejamos groupType como personal por defecto
          // y el color REAL lo resolvemos en render usando groupId + typeMap
          return {
            id: String(e.id),
            title: e.title ?? "Evento",
            start: String(e.start),
            end: String(e.end),
            groupId,
            groupType: "personal" as any,
            notes: e.notes ?? undefined,
          } as CalendarEvent;
        });

        setEvents(list);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((e) => new Date(e.end).getTime() >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events]);

  async function onDelete(id: string) {
    const ok = confirm("¿Eliminar este evento? Esta acción no se puede deshacer.");
    if (!ok) return;

    const deleted = await deleteEventsByIds([id]);
    if (deleted >= 0) {
      setEvents((s) => s.filter((x) => String(x.id) !== String(id)));
      setToast("Evento eliminado ✅");
      window.setTimeout(() => setToast(null), 1800);
    }
  }

  // ✅ calcula el tipo real para color: personal si no hay groupId; si hay, pair/family según groups
  function resolveTypeForColor(e: CalendarEvent): "personal" | "pair" | "family" {
    const gid = e.groupId ? String(e.groupId) : "";
    if (!gid) return "personal";
    return groupTypeById.get(gid) ?? "pair"; // fallback seguro
  }

  return (
    <main style={S.page}>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.shell}>
        <div style={S.topRow}>
          <PremiumHeader />
          <div style={S.topActions}>
            <button
              style={S.primary}
              onClick={() => router.push("/events/new/details?type=personal")}
            >
              + Evento
            </button>
            <LogoutButton />
          </div>
        </div>

        <section style={S.card}>
          <div style={S.title}>Próximos eventos</div>
          <div style={S.sub}>Tu agenda futura (personal y grupos)</div>

          {loading ? (
            <div style={S.empty}>Cargando…</div>
          ) : upcoming.length === 0 ? (
            <div style={S.empty}>No tienes eventos futuros.</div>
          ) : (
            <div style={S.list}>
              {upcoming.map((e) => {
                const realType = resolveTypeForColor(e);
                const meta = groupMeta(realType as any);

                return (
                  <div key={e.id} style={S.row}>
                    <div style={{ ...S.bar, background: meta.dot }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.rowTop}>
                        <div style={S.rowTitle}>{e.title}</div>
                        <button
                          style={S.del}
                          onClick={() => onDelete(String(e.id))}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>

                      <div style={S.rowSub}>
                        {new Date(e.start).toLocaleString()} —{" "}
                        {new Date(e.end).toLocaleString()}
                      </div>

                      {/* Debug suave (puedes borrarlo después) */}
                      <div style={S.debug}>
                        {realType === "personal"
                          ? "Personal"
                          : realType === "family"
                          ? "Familia"
                          : "Pareja"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#050816", color: "rgba(255,255,255,0.92)" },
  shell: { maxWidth: 1120, margin: "0 auto", padding: "22px 18px 48px" },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  topActions: { display: "flex", gap: 10, alignItems: "center" },
  primary: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  card: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 16,
  },
  title: { fontSize: 16, fontWeight: 950 },
  sub: { marginTop: 4, fontSize: 12, opacity: 0.75, fontWeight: 650 },
  empty: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.02)",
    opacity: 0.8,
    fontWeight: 700,
  },
  list: { marginTop: 12, display: "flex", flexDirection: "column", gap: 10 },
  row: {
    display: "flex",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  bar: { width: 6, borderRadius: 999 },
  rowTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  rowTitle: { fontWeight: 950, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  rowSub: { marginTop: 6, fontSize: 12, opacity: 0.75, fontWeight: 650 },
  debug: { marginTop: 6, fontSize: 11, opacity: 0.55, fontWeight: 800 },
  del: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(248,113,113,0.10)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  toast: {
    position: "fixed",
    top: 16,
    right: 16,
    zIndex: 60,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.75)",
    backdropFilter: "blur(12px)",
    fontWeight: 900,
  },
};
