// src/app/groups/invite/GroupInviteClient.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import LogoutButton from "@/components/LogoutButton";

import { inviteToGroup } from "@/lib/invitationsDb";
import { fetchMyGroups, type GroupRow } from "@/lib/groupsStore";
import { trackEvent, trackScreenView } from "@/lib/analytics";

type ToastState =
  | null
  | {
      title: string;
      subtitle?: string;
    };

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function groupMeta(type: string) {
  switch (type) {
    case "pair":
      return {
        label: "Pareja",
        dot: "rgba(96,165,250,0.98)",
        soft: "rgba(96,165,250,0.14)",
        border: "rgba(96,165,250,0.24)",
      };
    case "family":
      return {
        label: "Familia",
        dot: "rgba(34,197,94,0.98)",
        soft: "rgba(34,197,94,0.12)",
        border: "rgba(34,197,94,0.22)",
      };
    default:
      return {
        label: "Compartido",
        dot: "rgba(168,85,247,0.98)",
        soft: "rgba(168,85,247,0.14)",
        border: "rgba(168,85,247,0.24)",
      };
  }
}

export default function GroupInviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryGroupId = String(searchParams.get("groupId") ?? "").trim();

  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(queryGroupId);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(
    "Quiero que coordinemos desde un solo lugar para evitar cruces y mensajes perdidos."
  );
  const [toast, setToast] = useState<ToastState>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    void trackScreenView({
      screen: "group_invite",
      metadata: {
        area: "groups",
        source: "invite_flow",
        groupId: queryGroupId || null,
      },
    });
  }, [queryGroupId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const myGroups = await fetchMyGroups();
        if (!alive) return;

        const rows = Array.isArray(myGroups) ? myGroups : [];
        setGroups(rows);

        if (!selectedGroupId && rows.length > 0) {
          const preferred =
            rows.find((g: any) => g.type === "pair") ??
            rows.find((g: any) => g.is_active) ??
            rows[0];

          setSelectedGroupId(String(preferred?.id ?? ""));
        }
      } catch {
        if (alive) setGroups([]);
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedGroupId]);

  const selectedGroup = useMemo(
    () => groups.find((g: any) => String(g.id) === String(selectedGroupId)) ?? null,
    [groups, selectedGroupId]
  );

  const meta = useMemo(
    () => groupMeta(String(selectedGroup?.type ?? "pair")),
    [selectedGroup?.type]
  );

  const canSend =
    !sending &&
    !!selectedGroupId &&
    !!email.trim() &&
    isEmail(email);

  function pushToast(next: ToastState, timeout = 2800) {
    setToast(next);
    window.setTimeout(() => setToast(null), timeout);
  }

  async function handleInvite() {
    if (!selectedGroupId) {
      pushToast({
        title: "Elige un grupo",
        subtitle: "Primero necesitamos saber desde qué grupo vas a invitar.",
      });
      return;
    }

    if (!isEmail(email)) {
      pushToast({
        title: "Correo inválido",
        subtitle: "Escribe un correo real para enviar la invitación.",
      });
      return;
    }

    try {
      setSending(true);

   const result: any = await inviteToGroup({
  groupId: selectedGroupId,
  email: email.trim(),
  role: "member",
});

      const inviteId = result?.invite_id ?? result?.id ?? null;
      const inviteUrl =
        typeof result?.accept_url === "string" && result.accept_url
          ? result.accept_url
          : inviteId
            ? `/invitations/accept?invite=${encodeURIComponent(String(inviteId))}`
            : null;

      setLastInviteUrl(inviteUrl);

      void trackEvent({
        event: "invite_sent",
        entityId: inviteId ? String(inviteId) : null,
        metadata: {
          screen: "group_invite",
          groupId: selectedGroupId,
          groupType: selectedGroup?.type ?? null,
          recipientDomain: email.includes("@") ? email.split("@")[1] : null,
        },
      });

      pushToast({
        title: "Invitación creada ✅",
        subtitle:
          selectedGroup?.type === "pair"
            ? "Ahora el siguiente momento clave es que tu pareja la acepte."
            : "La invitación ya quedó lista para compartir.",
      });
    } catch (error: any) {
      pushToast({
        title: "No se pudo invitar",
        subtitle: error?.message ?? "Inténtalo nuevamente.",
      });
    } finally {
      setSending(false);
    }
  }

  async function copyInviteLink() {
    if (!lastInviteUrl) {
      pushToast({
        title: "Todavía no hay link",
        subtitle: "Primero crea la invitación para poder copiarla.",
      });
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(lastInviteUrl);
        pushToast({
          title: "Link copiado ✅",
          subtitle: "Ya puedes pegarlo donde quieras.",
        });
      }
    } catch {
      pushToast({
        title: "No se pudo copiar",
        subtitle: "Inténtalo nuevamente.",
      });
    }
  }

  if (booting) {
    return (
      <MobileScaffold maxWidth={980} style={styles.page}>
        <Section>
          <PremiumHeader
            title="Invitar"
            subtitle="Preparando el siguiente paso compartido…"
          />
          <Card style={styles.surfaceCard}>
            <div style={styles.loadingRow}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>Cargando grupos…</div>
                <div style={styles.loadingSub}>Preparando la invitación</div>
              </div>
            </div>
          </Card>
        </Section>
      </MobileScaffold>
    );
  }

  return (
    <MobileScaffold maxWidth={980} style={styles.page}>
      {toast ? (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      ) : null}

      <Section>
        <div style={styles.topRow}>
          <PremiumHeader
            title="Invitar a otra persona"
            subtitle="Este paso convierte un grupo en coordinación real: ya no solo existe el espacio, ahora empieza a compartirse."
          />
          <div style={styles.topUtilities}>
            <button
              type="button"
              style={styles.secondary}
              onClick={() => router.push("/groups")}
            >
              Volver a grupos
            </button>
            <LogoutButton />
          </div>
        </div>

        <Card style={styles.surfaceCard}>
          <Section style={styles.stack}>
            <Card
              tone="muted"
              style={{
                ...styles.heroCard,
                borderColor: meta.border,
                background: `linear-gradient(180deg, ${meta.soft}, rgba(255,255,255,0.03))`,
              }}
            >
              <div style={styles.heroLeft}>
                <div style={styles.heroPill}>
                  <span style={{ ...styles.heroDot, background: meta.dot }} />
                  {meta.label}
                </div>

                <h1 style={styles.heroTitle}>
                  {selectedGroup?.type === "pair"
                    ? "Invita a tu pareja y conviértanlo en una sola agenda compartida"
                    : "Invita a la otra persona y compartan el mismo contexto"}
                </h1>

                <p style={styles.heroText}>
                  La invitación no es un detalle lateral. Es el momento en el que SyncPlans deja de ser algo que tú organizas solo y empieza a funcionar como coordinación compartida.
                </p>
              </div>

              <div style={styles.heroRight}>
                <div style={styles.miniCard}>
                  <div style={styles.miniLabel}>Grupo</div>
                  <div style={styles.miniValue}>
                    {selectedGroup?.name || "Selecciona un grupo"}
                  </div>
                </div>

                <div style={styles.miniCard}>
                  <div style={styles.miniLabel}>Objetivo</div>
                  <div style={styles.miniValue}>
                    Lograr que la otra persona acepte fácil y entienda el valor rápido.
                  </div>
                </div>
              </div>
            </Card>

            <div style={styles.grid}>
              <Card tone="muted" style={styles.formCard}>
                <div style={styles.sectionEyebrow}>Paso 1</div>
                <div style={styles.sectionTitle}>Elige desde qué grupo invitas</div>

                <div style={styles.field}>
                  <label style={styles.label}>Grupo</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    style={styles.select}
                  >
                    <option value="">Selecciona un grupo</option>
                    {groups.map((group: any) => (
                      <option key={String(group.id)} value={String(group.id)}>
                        {group.name || "Sin nombre"} · {groupMeta(String(group.type)).label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.divider} />

                <div style={styles.sectionEyebrow}>Paso 2</div>
                <div style={styles.sectionTitle}>Invita con un correo claro</div>

                <div style={styles.field}>
                  <label style={styles.label}>Correo de la otra persona</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    style={styles.input}
                    type="email"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Mensaje opcional</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    style={styles.textarea}
                    placeholder="Quiero que empecemos a coordinarnos mejor desde aquí."
                  />
                </div>

                <div style={styles.actionsRow}>
                  <button
                    type="button"
                    style={{
                      ...styles.primary,
                      ...(canSend ? null : styles.primaryDisabled),
                    }}
                    disabled={!canSend}
                    onClick={handleInvite}
                  >
                    {sending ? "Enviando…" : "Enviar invitación"}
                  </button>

                  <button
                    type="button"
                    style={styles.secondary}
                    onClick={copyInviteLink}
                  >
                    Copiar link
                  </button>
                </div>
              </Card>

              <Card tone="muted" style={styles.sideCard}>
                <div style={styles.sectionEyebrow}>Por qué importa</div>
                <div style={styles.sectionTitle}>Este paso cierra activación</div>
                <p style={styles.sectionBody}>
                  En una app como SyncPlans, invitar no es una feature lateral.
                  Es el puente entre “me gusta la idea” y “ya entendí por qué esto nos sirve”.
                </p>

                <div style={styles.routeCard}>
                  <div style={styles.routeLabel}>Ruta ideal</div>
                  <div style={styles.routeItem}>1. Crear grupo</div>
                  <div style={styles.routeItem}>2. Invitar</div>
                  <div style={styles.routeItem}>3. Aceptar fácil</div>
                  <div style={styles.routeItem}>4. Crear primer plan</div>
                </div>

                {lastInviteUrl ? (
                  <div style={styles.linkPreview}>
                    <div style={styles.routeLabel}>Link generado</div>
                    <div style={styles.linkText}>{lastInviteUrl}</div>
                  </div>
                ) : (
                  <div style={styles.helperBox}>
                    {selectedGroup?.type === "pair"
                      ? "Cuando la invitación salga, el siguiente momento importante será que tu pareja la acepte y entren juntos al mismo contexto."
                      : "Cuando la invitación salga, el siguiente momento importante será que la otra persona entre al mismo contexto y lo use contigo."}
                  </div>
                )}
              </Card>
            </div>
          </Section>
        </Card>
      </Section>
    </MobileScaffold>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  surfaceCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,14,28,0.72)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    backdropFilter: "blur(12px)",
  },
  stack: {
    display: "grid",
    gap: 14,
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  topUtilities: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  toastWrap: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 50,
    pointerEvents: "none",
  },
  toastCard: {
    pointerEvents: "auto",
    minWidth: 260,
    maxWidth: 360,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.92)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: {
    fontWeight: 900,
    fontSize: 13,
    color: "rgba(255,255,255,0.95)",
  },
  toastSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    fontWeight: 650,
  },
  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 0 8px rgba(56,189,248,0.10)",
    flexShrink: 0,
  },
  loadingTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.96)",
  },
  loadingSub: {
    fontSize: 12,
    marginTop: 2,
    color: "rgba(203,213,225,0.72)",
  },
  heroCard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(260px, 0.92fr)",
    gap: 14,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: 16,
  },
  heroLeft: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  heroPill: {
    width: "fit-content",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(255,255,255,0.94)",
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  heroTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
    maxWidth: 720,
  },
  heroText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.62,
    color: "rgba(226,232,240,0.82)",
    maxWidth: 720,
  },
  heroRight: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  miniCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 12px",
    display: "grid",
    gap: 4,
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.80)",
  },
  miniValue: {
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(226,232,240,0.86)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(280px, 0.92fr)",
    gap: 14,
  },
  formCard: {
    borderRadius: 22,
    padding: 18,
    display: "grid",
    gap: 12,
  },
  sideCard: {
    borderRadius: 22,
    padding: 18,
    display: "grid",
    gap: 12,
    alignContent: "start",
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.86)",
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 1.12,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  sectionBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.62,
    color: "rgba(226,232,240,0.82)",
  },
  field: {
    display: "grid",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(255,255,255,0.94)",
  },
  select: {
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(15,23,42,0.74)",
    color: "rgba(248,250,252,0.98)",
    padding: "0 14px",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(15,23,42,0.74)",
    color: "rgba(248,250,252,0.98)",
    padding: "0 14px",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(15,23,42,0.74)",
    color: "rgba(248,250,252,0.98)",
    padding: "12px 14px",
    fontSize: 14,
    lineHeight: 1.55,
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.08)",
    margin: "2px 0",
  },
  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  routeCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 12px",
    display: "grid",
    gap: 6,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.86)",
  },
  routeItem: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.82)",
  },
  helperBox: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 12px",
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.80)",
  },
  linkPreview: {
    borderRadius: 16,
    border: "1px solid rgba(96,165,250,0.18)",
    background: "rgba(59,130,246,0.10)",
    padding: "12px 12px",
    display: "grid",
    gap: 6,
  },
  linkText: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(219,234,254,0.96)",
    wordBreak: "break-all",
  },
  primary: {
    minHeight: 42,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.24)",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.96), rgba(59,130,246,0.90))",
    color: "white",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(30,64,175,0.22)",
  },
  primaryDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
    boxShadow: "none",
    background: "rgba(51,65,85,0.76)",
  },
  secondary: {
    minHeight: 42,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
};