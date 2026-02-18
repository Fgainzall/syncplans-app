export default function ConflictsBanner(props: {
  applied: boolean;
  deleted?: number;
  appliedCount?: number;
  skipped?: number;
  onDismiss: () => void;
}) {
  const { applied, deleted, appliedCount, skipped, onDismiss } = props;
  if (!applied) return null;

  return (
    <div
      style={{
        marginBottom: 14,
        padding: "14px 16px",
        borderRadius: 16,
        border: "1px solid rgba(34,197,94,0.30)",
        background:
          "linear-gradient(180deg, rgba(34,197,94,0.12), rgba(34,197,94,0.08))",
        color: "rgba(255,255,255,0.95)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div>
        <div style={{ fontWeight: 950, fontSize: 14 }}>✅ Conflictos resueltos</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, fontWeight: 700 }}>
          {appliedCount ?? 0} decisión(es) aplicadas
          {typeof deleted === "number" ? ` · ${deleted} evento(s) eliminados` : ""}
          {typeof skipped === "number" ? ` · ${skipped} ignorado(s)` : ""}
        </div>
      </div>

      <button
        onClick={onDismiss}
        style={{
          padding: "8px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.95)",
          fontWeight: 950,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Entendido
      </button>
    </div>
  );
}