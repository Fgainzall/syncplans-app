// src/app/groups/new/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import { createGroup, getMyGroups } from "@/lib/groupsDb";
import { getMyProfile, type Profile } from "@/lib/profilesDb";
import { getGroupLimitState } from "@/lib/premium";
import { trackEvent, trackScreenView } from "@/lib/analytics";

type GType = "pair" | "family" | "other";
type UiToast = null | { title: string; subtitle?: string };
type CreatedGroupResult = {
  id?: string | null;
  group?: {
    id?: string | null;
  } | null;
};
type TypeMeta = {
  key: GType;
  label: string;
  title: string;
  subtitle: string;
  example: string;
  activation: string;
  color: string;
  soft: string;
  border: string;
};

const TYPE_META: Record<GType, TypeMeta> = {
  pair: {
    key: "pair",
    label: "Pareja",
    title: "Crea el espacio donde se van a organizar juntos",
    subtitle:
      "Este debería ser el primer grupo de SyncPlans. Aquí empieza la agenda compartida que evita cruces, olvidos y discusiones innecesarias.",
    example: "Ej: Fernando & Ara",
    activation:
      "Ruta ideal: crear grupo → crear primer plan → invitar a tu pareja.",
    color: "rgba(96,165,250,0.98)",
    soft: "rgba(96,165,250,0.14)",
    border: "rgba(96,165,250,0.28)",
  },
  family: {
    key: "family",
    label: "Familia",
    title: "Crea un espacio familiar con una sola referencia clara",
    subtitle:
      "Úsalo cuando la coordinación ya no sea de una sola persona y necesites alinear planes, tiempos y contexto desde un mismo lugar.",
    example: "Ej: Familia Llosa",
    activation:
      "Ruta ideal: crear grupo → definir el primer plan compartido → ordenar el resto desde aquí.",
    color: "rgba(34,197,94,0.98)",
    soft: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.24)",
  },
  other: {
    key: "other",
    label: "Compartido",
    title: "Crea un grupo compartido para coordinar fuera del chat",
    subtitle:
      "Sirve para amigos, trabajo o cualquier grupo donde el tiempo compartido necesite menos ruido y una mejor referencia común.",
    example: "Ej: Pichanga de los jueves",
    activation:
      "Ruta ideal: crear grupo → activar contexto → convertir la próxima idea en plan.",
    color: "rgba(168,85,247,0.98)",
    soft: "rgba(168,85,247,0.14)",
    border: "rgba(168,85,247,0.30)",
  },
};

export default function NewGroupPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [type, setType] = useState<GType>("pair");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [existingGroupsCount, setExistingGroupsCount] = useState(0);
  const [toast, setToast] = useState<UiToast>(null);

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
        const [profileRow, groups] = await Promise.all([
          getMyProfile().catch(() => null),
          getMyGroups().catch(() => []),
        ]);

        if (!alive) return;

        setProfile(profileRow ?? null);
        setExistingGroupsCount(Array.isArray(groups) ? groups.length : 0);
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    void trackScreenView({
      screen: "groups_new",
      metadata: {
        area: "groups",
        step: "create",
      },
    });
  }, []);

  const meta = useMemo(() => TYPE_META[type], [type]);

  const groupLimitState = useMemo(
    () => getGroupLimitState(profile, existingGroupsCount),
    [profile, existingGroupsCount]
  );

  const reachedGroupLimit = groupLimitState.reached;

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push("Ponle un nombre al grupo.");
    if (name.trim().length > 0 && name.trim().length < 3) {
      list.push("El nombre debe tener al menos 3 caracteres.");
    }
    return list;
  }, [name]);

  const canSave = errors.length === 0 && !saving && !reachedGroupLimit;

  const helperHeadline = useMemo(() => {
    if (type === "pair") return "Este es el paso que activa el producto de verdad.";
    if (type === "family") return "Aquí empieza una coordinación más clara para todos.";
    return "Un grupo compartido sirve cuando el chat ya no alcanza.";
  }, [type]);

  function showTemporaryToast(next: UiToast, timeout = 2600) {
    setToast(next);
    window.setTimeout(() => setToast(null), timeout);
  }

  function goBack() {
    router.push("/groups");
  }

  async function save() {
    if (reachedGroupLimit) {
      void trackEvent({
        event: "premium_gate_seen",
        metadata: {
          screen: "groups_new",
          gate: "group_limit",
          existing_groups_count: existingGroupsCount,
        },
      });

      setToast({
        title: "Límite Free alcanzado",
        subtitle:
          "En Free puedes crear 1 grupo. Premium abre más espacios compartidos sin fricción.",
      });

      window.setTimeout(() => {
        void trackEvent({
          event: "premium_cta_clicked",
          metadata: {
            screen: "groups_new",
            source: "group_limit_toast",
            target: "/planes",
          },
        });
        router.push("/planes");
      }, 500);
      return;
    }

    if (!canSave) {
      showTemporaryToast({
        title: "Revisa el formulario",
        subtitle: errors[0],
      }, 2200);
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      router.replace("/auth/login");
      return;
    }

    setSaving(true);

    try {
     const created = (await createGroup({
  type,
  name: name.trim(),
})) as CreatedGroupResult;

      const gid =
        (typeof created?.id === "string" && created.id) ||
        (typeof created?.group?.id === "string" && created.group.id) ||
        null;

      if (!gid) {
        throw new Error("Grupo creado pero no se recibió el ID.");
      }

      void trackEvent({
        event: "group_created",
        entityId: String(gid),
        metadata: {
          screen: "groups_new",
          source: "groups_new",
          group_type: type,
          existing_groups_count: existingGroupsCount,
        },
      });

      setToast({
        title: "Grupo creado ✅",
        subtitle: type === "pair"
          ? "Ahora vamos a crear el primer plan compartido."
          : "Ahora vamos con tu primer plan dentro del grupo.",
      });

      window.setTimeout(() => {
        router.push(
          `/events/new/details?type=group&groupId=${encodeURIComponent(
            String(gid)
          )}&wow=1&from=first-group`
        );
      }, 450);
  } catch (err: unknown) {
  showTemporaryToast({
    title: "No se pudo crear",
    subtitle: err instanceof Error ? err.message : "Intenta nuevamente.",
  }, 2800);
}
    finally {
      setSaving(false);
    }
  }

  if (booting) {
    return (
      <main style={S.page}>
        <div style={S.shell}>
          <div style={S.topRow}>
            <PremiumHeader title="Nuevo grupo" subtitle="Preparando creación…" />
          </div>

          <section style={S.loadingCard}>
            <div style={S.loadingDot} />
            <div>
              <div style={S.loadingTitle}>Preparando tu siguiente paso…</div>
              <div style={S.loadingSub}>Creación de grupo</div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      {toast ? (
        <div style={S.toastWrap}>
          <div style={S.toastCard}>
            <div style={S.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={S.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      ) : null}

      <div style={S.shell}>
        <div style={S.topRow}>
          <PremiumHeader
            title="Nuevo grupo"
            subtitle="El espacio donde la coordinación deja de vivir en mensajes sueltos y empieza a compartirse de verdad."
          />
          <div style={S.topActions}>
            <LogoutButton />
          </div>
        </div>

        <section
          style={{
            ...S.hero,
            borderColor: meta.border,
            background: `linear-gradient(180deg, ${meta.soft}, rgba(255,255,255,0.03))`,
          }}
        >
          <div style={S.heroCopy}>
            <div style={S.kicker}>Bloque 3 · Activación real</div>
            <h1 style={S.h1}>{meta.title}</h1>
            <p style={S.sub}>{meta.subtitle}</p>

            <div style={S.heroBadges}>
              <span style={S.heroBadge}>Tipo: {meta.label}</span>
              <span style={S.heroBadgeSoft}>
                {existingGroupsCount === 0
                  ? "Tu primer grupo"
                  : `${existingGroupsCount} grupo${existingGroupsCount === 1 ? "" : "s"} existente${existingGroupsCount === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>

          <div style={S.heroActions}>
            <button type="button" onClick={goBack} style={S.ghostBtn}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              style={{
                ...S.primaryBtn,
                ...(canSave ? null : S.primaryBtnDisabled),
              }}
            >
              {reachedGroupLimit
                ? "Ver planes"
                : saving
                  ? "Creando…"
                  : type === "pair"
                    ? "Crear espacio"
                    : "Crear grupo"}
            </button>
          </div>
        </section>

        {reachedGroupLimit ? (
          <section style={S.limitCard}>
            <div style={S.limitBadge}>Free</div>
            <div style={S.limitTitle}>Ya usaste tu grupo incluido en Free.</div>
            <div style={S.limitCopy}>
              Premium abre más espacios cuando necesitas coordinar más de{" "}
              {groupLimitState.limit} grupo sin salirte del mismo sistema.
            </div>
            <div style={S.limitActions}>
              <button
                type="button"
                onClick={() => {
                  void trackEvent({
                    event: "premium_cta_clicked",
                    metadata: {
                      screen: "groups_new",
                      source: "limit_card",
                      target: "/planes",
                    },
                  });
                  router.push("/planes");
                }}
                style={S.primaryBtn}
              >
                Ver planes
              </button>
              <button type="button" onClick={goBack} style={S.ghostBtn}>
                Volver a grupos
              </button>
            </div>
          </section>
        ) : null}

        <div style={S.grid}>
          <section style={S.mainCard}>
            <div style={S.sectionEyebrow}>Paso 1</div>
            <div style={S.sectionTitle}>Elige el tipo de espacio</div>
            <div style={S.typeGrid}>
              {(Object.keys(TYPE_META) as GType[]).map((item) => {
                const itemMeta = TYPE_META[item];
                const selected = type === item;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setType(item)}
                    style={{
                      ...S.typeCard,
                      ...(selected
                        ? {
                            borderColor: itemMeta.border,
                            background: itemMeta.soft,
                          }
                        : null),
                    }}
                  >
                    <div style={S.typeTop}>
                      <span
                        style={{
                          ...S.typeDot,
                          background: itemMeta.color,
                        }}
                      />
                      <span style={S.typeLabel}>{itemMeta.label}</span>
                    </div>

                    <div style={S.typeTitle}>{itemMeta.label}</div>
                    <div style={S.typeBody}>{itemMeta.subtitle}</div>
                  </button>
                );
              })}
            </div>

            <div style={S.divider} />

            <div style={S.sectionEyebrow}>Paso 2</div>
            <div style={S.sectionTitle}>Ponle un nombre claro</div>

            <div style={S.field}>
              <label htmlFor="group-name" style={S.fieldLabel}>
                Nombre del grupo
              </label>
              <input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={meta.example}
                style={S.input}
              />
              <div style={S.inputHint}>
                Usa un nombre corto, reconocible y fácil de encontrar después.
              </div>
            </div>

            {errors.length > 0 ? (
              <div style={S.errorBox}>
                <div style={S.errorTitle}>Antes de crear:</div>
                <ul style={S.errorList}>
                  {errors.map((error) => (
                    <li key={error} style={S.errorItem}>
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div style={S.footerRow}>
              <button type="button" onClick={goBack} style={S.ghostBtnWide}>
                ← Volver
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                style={{
                  ...S.primaryBtnWide,
                  ...(canSave ? null : S.primaryBtnDisabled),
                }}
              >
                {reachedGroupLimit
                  ? "Ver planes"
                  : saving
                    ? "Creando…"
                    : type === "pair"
                      ? "Crear espacio y seguir"
                      : "Crear grupo y seguir"}
              </button>
            </div>
          </section>

          <aside style={S.sideCard}>
            <div style={S.sideEyebrow}>Por qué importa</div>
            <div style={S.sideTitle}>{helperHeadline}</div>
            <p style={S.sideBody}>
              Un grupo no es una carpeta. Es el contexto compartido desde donde
              SyncPlans empieza a entender con quién coordinas y por qué ese
              tiempo ya no depende de una sola persona.
            </p>

            <div style={S.sideBlock}>
              <div style={S.sideBlockLabel}>Ruta sugerida</div>
              <div style={S.sideBlockBody}>{meta.activation}</div>
            </div>

            <div style={S.sideBlock}>
              <div style={S.sideBlockLabel}>Resultado buscado</div>
              <div style={S.sideBlockBody}>
                Crear el grupo y llevarte directo al primer plan compartido.
              </div>
            </div>

            {type === "pair" ? (
              <div style={S.highlightCard}>
                <div style={S.highlightLabel}>Recomendado</div>
                <div style={S.highlightTitle}>Empieza por Pareja</div>
                <div style={S.highlightBody}>
                  Es la entrada más clara, más emocional y más fácil de activar
                  rápido en SyncPlans.
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
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
    display: "grid",
    gap: 14,
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
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  topActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  loadingCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 16px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,28,0.72)",
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
  },
  loadingSub: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    padding: "20px 18px",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
    flexWrap: "wrap",
  },
  heroCopy: {
    display: "grid",
    gap: 8,
    minWidth: 0,
    flex: "1 1 480px",
  },
  kicker: {
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.95)",
    fontWeight: 800,
  },
  h1: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.02,
    letterSpacing: "-0.04em",
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
    maxWidth: 720,
  },
  sub: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.62,
    color: "rgba(226,232,240,0.84)",
    maxWidth: 760,
  },
  heroBadges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 4,
  },
  heroBadge: {
    minHeight: 32,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(255,255,255,0.94)",
  },
  heroBadgeSoft: {
    minHeight: 32,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(226,232,240,0.78)",
  },
  heroActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(280px, 0.92fr)",
    gap: 14,
    alignItems: "start",
  },
  mainCard: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,28,0.72)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    padding: 18,
    display: "grid",
    gap: 14,
  },
  sideCard: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,28,0.72)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    padding: 18,
    display: "grid",
    gap: 12,
    position: "sticky",
    top: 18,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.84)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  typeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  typeCard: {
    textAlign: "left",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: "14px 14px",
    display: "grid",
    gap: 8,
    cursor: "pointer",
  },
  typeTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(226,232,240,0.86)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
    lineHeight: 1.25,
  },
  typeBody: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(203,213,225,0.78)",
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.08)",
    margin: "2px 0",
  },
  field: {
    display: "grid",
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(255,255,255,0.94)",
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
  inputHint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(148,163,184,0.86)",
  },
  errorBox: {
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.20)",
    background: "rgba(127,29,29,0.14)",
    padding: "12px 12px",
    display: "grid",
    gap: 6,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(254,226,226,0.96)",
  },
  errorList: {
    margin: 0,
    paddingLeft: 18,
  },
  errorItem: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(254,226,226,0.90)",
  },
  footerRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  ghostBtn: {
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  ghostBtnWide: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
    flex: "1 1 180px",
  },
  primaryBtn: {
    minHeight: 44,
    padding: "0 15px",
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
  primaryBtnWide: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.24)",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.96), rgba(59,130,246,0.90))",
    color: "white",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(30,64,175,0.22)",
    flex: "2 1 260px",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
    boxShadow: "none",
    background: "rgba(51,65,85,0.76)",
  },
  limitCard: {
    borderRadius: 20,
    border: "1px solid rgba(251,191,36,0.22)",
    background: "rgba(120,53,15,0.18)",
    padding: 16,
    display: "grid",
    gap: 8,
  },
  limitBadge: {
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.14)",
    color: "rgba(255,243,205,0.96)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  limitTitle: {
    fontSize: 18,
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
    letterSpacing: "-0.02em",
  },
  limitCopy: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(255,237,213,0.88)",
    maxWidth: 760,
  },
  limitActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  sideEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.86)",
  },
  sideTitle: {
    fontSize: 20,
    fontWeight: 950,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  sideBody: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: "rgba(203,213,225,0.80)",
  },
  sideBlock: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 12px",
    display: "grid",
    gap: 4,
  },
  sideBlockLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.84)",
  },
  sideBlockBody: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.86)",
  },
  highlightCard: {
    borderRadius: 16,
    border: "1px solid rgba(96,165,250,0.20)",
    background: "rgba(59,130,246,0.12)",
    padding: "12px 12px",
    display: "grid",
    gap: 4,
  },
  highlightLabel: {
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(219,234,254,0.92)",
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(248,250,252,0.98)",
  },
  highlightBody: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(226,242,255,0.88)",
  },
};