"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getGroupState, loadGroup } from "@/lib/groups";

export default function MembersPage() {
  const router = useRouter();

  const gs = useMemo(() => getGroupState(), []);
  const g = useMemo(() => loadGroup(gs.groupId), [gs.groupId]);

  const invite = (gs.inviteCode ?? gs.joinCode ?? g?.inviteCode ?? g?.joinCode ?? "").toString();

  const members = useMemo(() => {
    const me = gs.me ?? g?.me;
    const partner = gs.partnerEmail ?? g?.partnerEmail;
    const partnerName = gs.partnerName ?? g?.partnerName;

    const list: { name: string; email: string }[] = [];
    if (me?.email) list.push({ name: me.name ?? "Yo", email: me.email });
    if (partner) list.push({ name: partnerName ?? "Pareja", email: partner });

    return list;
  }, [gs, g]);

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-xs text-white/60">SyncPlans · Miembros</div>
          <h1 className="mt-2 text-2xl font-semibold">{gs.groupName ?? g?.name ?? "Tu grupo"}</h1>
          <p className="mt-1 text-sm text-white/60">Administra quién comparte este calendario.</p>

          {invite ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-semibold text-white/70">Código de invitación</div>
              <div className="mt-1 text-lg font-semibold tracking-widest">{invite}</div>
              <div className="mt-1 text-xs text-white/50">Úsalo en “Unirme con código” (demo).</div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-2">
            {members.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                Aún no hay miembros registrados.
              </div>
            ) : (
              members.map((m) => (
                <div key={m.email} className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="text-sm font-semibold">{m.name}</div>
                  <div className="text-xs text-white/60">{m.email}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/groups")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Volver a grupos
            </button>
            <button
              onClick={() => router.push("/calendar")}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Ir al calendario →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
