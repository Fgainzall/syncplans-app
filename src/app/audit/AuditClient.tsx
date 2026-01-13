"use client";

import { useEffect, useState } from "react";
import PremiumHeader from "@/components/PremiumHeader";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

import { listAudit, AuditRow } from "@/lib/auditDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

export default function AuditClient() {
  const { push } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);

      try {
        const gid = await getActiveGroupIdFromDb();
        if (!alive) return;

        setGroupId(gid);

        if (!gid) {
          setRows([]);
          setLoading(false);
          return;
        }

        const data = await listAudit(gid);
        if (!alive) return;

        setRows(data);
      } catch (e: any) {
        push({
          kind: "err",
          title: "No se pudo cargar la auditoría",
          body: e.message,
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [push]);

  return (
    <main className="min-h-screen bg-[#050816]">
      <PremiumHeader />

      <div className="mx-auto max-w-5xl px-4 pb-10 pt-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
          <p className="text-sm text-white/70">
            Registro de acciones sobre eventos: quién creó, editó o eliminó.
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <Pill>Grupo: {groupId ? `${groupId.slice(0, 8)}…` : "No encontrado"}</Pill>
            <Pill>Total registros: {rows.length}</Pill>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : !groupId ? (
            <EmptyState
              title="No encontramos un grupo activo"
              subtitle="Crea o selecciona un grupo y vuelve a esta sección."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Sin actividad todavía"
              subtitle="Cuando se creen, editen o eliminen eventos, aparecerán aquí."
            />
          ) : (
            <div className="grid gap-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Acción: {r.action}</div>
                      <div className="mt-1 text-xs text-white/60">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {r.actor_id ? <Pill>actor: {r.actor_id.slice(0, 8)}…</Pill> : null}
                      {r.event_id ? <Pill>event: {r.event_id.slice(0, 8)}…</Pill> : null}
                    </div>
                  </div>

                  <details className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <summary className="cursor-pointer text-xs text-white/70">
                      Ver detalle (before / after)
                    </summary>
                    <pre className="mt-2 max-h-[300px] overflow-auto text-[11px] text-white/70">
{JSON.stringify({ before: r.before, after: r.after }, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
