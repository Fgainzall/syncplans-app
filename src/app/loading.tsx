export default function Loading() {
  return (
    <main
      aria-live="polite"
      aria-label="Abriendo SyncPlans"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(900px 420px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(700px 380px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
        color: "#E5E7EB",
      }}
    >
      <section
        style={{
          width: "min(420px, 100%)",
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(15,23,42,0.72)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.32)",
          padding: 22,
        }}
      >
        <p
          style={{
            margin: 0,
            color: "rgba(125,211,252,0.92)",
            fontSize: 12,
            fontWeight: 950,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          SyncPlans
        </p>
        <h1
          style={{
            margin: "8px 0 0",
            fontSize: 30,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            fontWeight: 950,
          }}
        >
          Abriendo SyncPlans…
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            color: "rgba(226,232,240,0.72)",
            fontSize: 15,
            lineHeight: 1.45,
            fontWeight: 650,
          }}
        >
          Preparando tu contexto antes de mostrarte el siguiente paso.
        </p>
      </section>
    </main>
  );
}
