"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import supabase from "@/lib/supabaseClient";

export default function NewEventPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!title || !startDate || !endDate) {
      alert("Completa título y fechas");
      return;
    }

    const startISO = new Date(`${startDate}T${startTime}`).toISOString();
    const endISO = new Date(`${endDate}T${endTime}`).toISOString();

    if (new Date(endISO) <= new Date(startISO)) {
      alert("La fecha de fin debe ser posterior al inicio");
      return;
    }

    try {
      setBusy(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth/login");
        return;
      }

      // ✅ NO mandes user_id (tu tabla no lo tiene)
      // ✅ owner_id debe ser default auth.uid() en DB
      const { error } = await supabase.from("events").insert({
        title: title.trim(),
        start_at: startISO,
        end_at: endISO,
        group_id: null,
        group_type: "personal",
        notes: null,
      });

      if (error) {
        alert(error.message || "No se pudo guardar el evento");
        setBusy(false);
        return;
      }

      router.push("/calendar");
    } catch {
      alert("Error inesperado al guardar");
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Nuevo evento</h1>

        <label style={styles.label}>Título</label>
        <input
          style={styles.input}
          placeholder="Ej: Cena, Pádel, Reunión"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div style={styles.row}>
          <div>
            <label style={styles.label}>Inicio</label>
            <input
              type="date"
              style={styles.input}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="time"
              style={styles.input}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <label style={styles.label}>Fin</label>
            <input
              type="date"
              style={styles.input}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <input
              type="time"
              style={styles.input}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <button
          style={{
            ...styles.button,
            opacity: busy ? 0.6 : 1,
            cursor: busy ? "not-allowed" : "pointer",
          }}
          onClick={handleSave}
          disabled={busy}
        >
          {busy ? "Guardando…" : "Guardar evento"}
        </button>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#050816",
    color: "#fff",
  },
  card: {
    width: 420,
    padding: 24,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  title: { marginBottom: 8, fontSize: 22 },
  label: { fontSize: 12, opacity: 0.8 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
  },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  button: {
    marginTop: 12,
    padding: "12px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #38bdf8, #7c3aed)",
    color: "#fff",
    fontWeight: 800,
  },
};
