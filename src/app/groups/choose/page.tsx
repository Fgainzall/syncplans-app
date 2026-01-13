"use client";

import { useRouter } from "next/navigation";

export default function GroupsChoose() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 18% 10%, rgba(56,189,248,0.18), transparent 36%), radial-gradient(circle at 82% 18%, rgba(34,197,94,0.14), transparent 42%), radial-gradient(circle at 55% 92%, rgba(37,99,235,0.14), transparent 48%), linear-gradient(180deg, #020617 0%, #000 120%)",
        color: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "26px",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%", position: "relative" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -90,
            background:
              "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.18), transparent 58%), radial-gradient(circle at 70% 35%, rgba(34,197,94,0.14), transparent 60%)",
            filter: "blur(18px)",
            opacity: 0.95,
            zIndex: 0,
          }}
        />

        <section
          style={{
            position: "relative",
            zIndex: 1,
            borderRadius: 26,
            padding: "22px 18px 18px",
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.88))",
            border: "1px solid rgba(148,163,184,0.28)",
            boxShadow: "0 22px 60px rgba(15,23,42,0.75)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.32)",
              background: "rgba(2,6,23,0.55)",
              color: "#9CA3AF",
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#60A5FA",
                boxShadow: "0 0 0 6px rgba(96,165,250,0.16)",
              }}
            />
            Grupos
          </div>

          <h1
            style={{
              fontSize: 28,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            ¿Cómo quieres{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #38BDF8, #22C55E)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              organizarte
            </span>
            ?
          </h1>

          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#9CA3AF",
              marginBottom: 16,
            }}
          >
            Empieza solo, sincroniza con tu pareja o arma un grupo familiar.
          </p>

          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            <ChoiceCard
              title="Solo"
              subtitle="Tu calendario personal (vista día premium)"
              emoji="🟡"
              onClick={() => router.push("/calendar/day")}
            />
            <ChoiceCard
              title="Pareja"
              subtitle="Crea un grupo y comparte el código"
              emoji="🔴"
              onClick={() => router.push("/groups/create-pair")}
            />
            <ChoiceCard
              title="Familia"
              subtitle="Únete con un código de invitación"
              emoji="🔵"
              onClick={() => router.push("/groups/join")}
            />
          </div>

          <button
            onClick={() => router.push("/auth/login")}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(2,6,23,0.45)",
              color: "#CBD5E1",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Volver a Auth
          </button>
        </section>
      </div>
    </main>
  );
}

function ChoiceCard(props: {
  title: string;
  subtitle: string;
  emoji: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 18,
        padding: 14,
        background: "rgba(2,6,23,0.35)",
        border: "1px solid rgba(148,163,184,0.18)",
        color: "#F9FAFB",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            background: "rgba(2,6,23,0.55)",
            border: "1px solid rgba(148,163,184,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          {props.emoji}
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>{props.title}</div>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>{props.subtitle}</div>
        </div>
      </div>

      <span style={{ color: "#94A3B8", fontWeight: 900 }}>→</span>
    </button>
  );
}
