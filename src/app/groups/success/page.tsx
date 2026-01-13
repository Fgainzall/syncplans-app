"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getGroupState, loadGroup } from "@/lib/groups";

export default function GroupsSuccessPage() {
  const router = useRouter();

  const gs = useMemo(() => getGroupState(), []);
  const g = useMemo(() => loadGroup(gs.groupId) , [gs.groupId]);

  const invite = (gs.inviteCode ?? gs.joinCode ?? g?.inviteCode ?? g?.joinCode ?? "").toString();

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-xs text-white/60">SyncPlans · Listo</div>
          <h1 className="mt-2 text-2xl font-semibold">Grupo configurado ✅</h1>
          <p className="mt-1 text-sm text-white/60">Ya puedes crear eventos y detectar choques automáticamente.</p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
            <Row k="Modo" v={gs.mode} />
            <Row k="Grupo" v={gs.groupName ?? g?.name ?? "—"} />
            <Row k="Tu nombre" v={gs.me?.name ?? g?.me?.name ?? "—"} />
            <Row k="Tu correo" v={gs.me?.email ?? g?.me?.email ?? "—"} />
            <Row k="Correo pareja" v={gs.partnerEmail ?? g?.partnerEmail ?? "—"} />
          </div>

          {invite ? (
            <div className="mt-4 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4">
              <div className="text-xs font-semibold text-fuchsia-100/90">Código de invitación</div>
              <div className="mt-1 text-xl font-semibold tracking-widest">{invite}</div>
              <div className="mt-1 text-xs text-fuchsia-100/70">Compártelo para que se unan (demo).</div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/calendar")}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Ir al calendario →
            </button>
            <button
              onClick={() => router.push("/members")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Ver miembros
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div className="text-white/60">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}
