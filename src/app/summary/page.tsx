function SummaryFallback() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050816",
        color: "rgba(248,250,252,0.96)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "14px 12px calc(18px + 120px) 12px",
        }}
      >
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.45)",
            background: "rgba(15,23,42,0.96)",
            fontSize: 13,
            fontWeight: 750,
          }}
        >
          Cargando tu resumen…
        </div>
      </div>
    </main>
  );
}