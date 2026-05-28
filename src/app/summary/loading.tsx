export default function Loading() {
  return (
    <main
      aria-label="Abriendo SyncPlans"
      style={{
        minHeight: "100dvh",
        background: "#0B0F19",
        color: "#E5E7EB",
        display: "flex",
        justifyContent: "center",
        padding: "max(18px, env(safe-area-inset-top)) 16px max(96px, env(safe-area-inset-bottom))",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          display: "grid",
          gap: 14,
          alignContent: "start",
        }}
      >
        <div
          style={{
            height: 54,
            borderRadius: 20,
            background: "rgba(15, 23, 42, 0.86)",
            border: "1px solid rgba(148, 163, 184, 0.14)",
          }}
        />

        <div
          style={{
            minHeight: 132,
            borderRadius: 28,
            background: "rgba(15, 23, 42, 0.92)",
            border: "1px solid rgba(148, 163, 184, 0.16)",
            boxShadow: "0 22px 70px rgba(0, 0, 0, 0.30)",
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              style={{
                height: 92,
                borderRadius: 22,
                background: "rgba(15, 23, 42, 0.74)",
                border: "1px solid rgba(148, 163, 184, 0.12)",
              }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
