"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseQuickCapture } from "@/lib/quickCaptureParser";

type CaptureClientProps = {
  initialText?: string;
};

const EXAMPLES = [
  "fulbito sábado 6pm en la cancha",
  "cena mañana 8pm con fer",
  "cumple de juan viernes 7pm",
];

function pickIncomingText(searchParams: ReturnType<typeof useSearchParams>, initialText: string) {
  const candidates = [
    searchParams.get("text"),
    searchParams.get("q"),
    searchParams.get("input"),
    searchParams.get("message"),
    initialText,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }

  return "";
}

function pickIncomingSource(searchParams: ReturnType<typeof useSearchParams>) {
  return (
    searchParams.get("source")?.trim() ||
    searchParams.get("from")?.trim() ||
    searchParams.get("origin")?.trim() ||
    "deep-link"
  );
}

function formatDateLabel(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return "Sin fecha detectada";

  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function toTitleCase(value: string) {
  if (!value.trim()) return "";
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CaptureClient({ initialText = "" }: CaptureClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const incomingText = useMemo(
    () => pickIncomingText(searchParams, initialText),
    [initialText, searchParams],
  );

  const source = useMemo(() => pickIncomingSource(searchParams), [searchParams]);

  const [draft, setDraft] = useState(incomingText);

  useEffect(() => {
    setDraft(incomingText);
  }, [incomingText]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.focus();
    const length = inputRef.current.value.length;
    inputRef.current.setSelectionRange(length, length);
  }, []);

  const parsed = useMemo(() => parseQuickCapture(draft.trim()), [draft]);

  const title = parsed.title?.trim() || "";
  const notes = parsed.notes?.trim() || "";
  const durationMinutes = parsed.durationMinutes || 60;
  const hasDate = Boolean(parsed.date && !Number.isNaN(parsed.date.getTime()));
  const canContinue = Boolean(draft.trim() && title);

  const summaryLine = useMemo(() => {
    const safeTitle = title || "Evento";
    const when = hasDate ? formatDateLabel(parsed.date) : "sin fecha todavía";
    return `→ Se creará: ${toTitleCase(safeTitle)} · ${when}`;
  }, [title, hasDate, parsed]);

  function handleContinue() {
    if (!canContinue) return;

    const params = new URLSearchParams();
    params.set("qc", "1");
    params.set("from", "capture");
    params.set("capture_source", source);
    params.set("type", "personal");
    params.set("title", toTitleCase(title));
    params.set("duration", String(durationMinutes));
    params.set("raw_text", draft.trim());

    if (notes) {
      params.set("notes", notes);
    }

    if (hasDate && parsed.date) {
      params.set("date", parsed.date.toISOString());
    }

    router.push(`/events/new/details?${params.toString()}`);
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px 120px",
        background:
          "radial-gradient(circle at top, rgba(59,130,246,0.20), transparent 34%), linear-gradient(180deg, #07111f 0%, #08101b 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 760,
          borderRadius: 28,
          padding: 24,
          background: "rgba(11, 18, 32, 0.92)",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.38)",
          color: "#e5eefb",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              padding: "8px 12px",
              background: "rgba(37, 99, 235, 0.16)",
              border: "1px solid rgba(96, 165, 250, 0.24)",
              color: "#bfdbfe",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Capture
          </span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              padding: "8px 12px",
              background: "rgba(15, 23, 42, 0.92)",
              border: "1px solid rgba(148, 163, 184, 0.16)",
              color: "rgba(226, 232, 240, 0.78)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Fuente: {source}
          </span>
        </div>

        <header style={{ marginBottom: 18 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 4vw, 2.9rem)",
              lineHeight: 1.02,
              fontWeight: 900,
              letterSpacing: "-0.03em",
            }}
          >
            Convierte una frase en un plan claro
          </h1>

          <p
            style={{
              margin: "12px 0 0 0",
              maxWidth: 640,
              fontSize: 15,
              lineHeight: 1.65,
              color: "rgba(226, 232, 240, 0.82)",
            }}
          >
            Aquí no creamos nada automáticamente. Primero entendemos la intención,
            te mostramos una vista previa limpia y luego te mandamos al formulario
            normal para confirmar.
          </p>
        </header>

        <section
          style={{
            borderRadius: 22,
            padding: 18,
            background: "rgba(15, 23, 42, 0.82)",
            border: "1px solid rgba(148, 163, 184, 0.14)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#bfdbfe",
                }}
              >
                Texto a interpretar
              </p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 13,
                  color: "rgba(226, 232, 240, 0.62)",
                }}
              >
                Puedes editarlo antes de seguir.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDraft("")}
              style={{
                borderRadius: 999,
                padding: "8px 12px",
                border: "1px solid rgba(148, 163, 184, 0.16)",
                background: "rgba(2, 6, 23, 0.56)",
                color: "#cbd5e1",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Limpiar
            </button>
          </div>

          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ej: cena viernes 8pm con fer"
            rows={4}
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: 18,
              padding: "16px 16px",
              background: "rgba(2, 6, 23, 0.8)",
              border: "1px solid rgba(96, 165, 250, 0.18)",
              color: "#f8fafc",
              fontSize: 16,
              lineHeight: 1.55,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 12,
            }}
          >
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setDraft(example)}
                style={{
                  borderRadius: 999,
                  padding: "8px 12px",
                  border: "1px solid rgba(148, 163, 184, 0.16)",
                  background: "rgba(15, 23, 42, 0.92)",
                  color: "#dbeafe",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gap: 16,
            marginTop: 18,
          }}
        >
          <div
            style={{
              borderRadius: 20,
              padding: 18,
              background: "rgba(15, 23, 42, 0.72)",
              border: "1px solid rgba(148, 163, 184, 0.14)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                color: "#bfdbfe",
              }}
            >
              Vista previa
            </p>

            <div
              style={{
                display: "grid",
                gap: 12,
                marginTop: 14,
              }}
            >
              <PreviewRow label="Título" value={title ? toTitleCase(title) : "Sin título detectado"} muted={!title} />
              <PreviewRow label="Notas" value={notes || "Sin notas detectadas"} muted={!notes} />
              <PreviewRow label="Fecha" value={hasDate ? formatDateLabel(parsed.date) : "Sin fecha detectada"} muted={!hasDate} />
              <PreviewRow label="Duración" value={`${durationMinutes} min`} />
            </div>

            <div
              style={{
                marginTop: 16,
                borderRadius: 16,
                padding: "13px 14px",
                background: "linear-gradient(180deg, rgba(30,41,59,0.72), rgba(2,6,23,0.72))",
                border: "1px solid rgba(96, 165, 250, 0.22)",
                color: "#dbeafe",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {summaryLine}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              borderRadius: 20,
              padding: 18,
              background: "rgba(8, 15, 29, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.12)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                color: "#bfdbfe",
              }}
            >
              Qué hará SyncPlans ahora
            </p>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <MiniStep text="Interpretar tu frase con el parser real" />
              <MiniStep text="Mantener el evento como personal por defecto" />
              <MiniStep text="Abrir el formulario normal para confirmar" />
            </div>
          </div>
        </section>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 22,
          }}
        >
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            style={{
              borderRadius: 999,
              padding: "13px 18px",
              border: "1px solid rgba(96, 165, 250, 0.34)",
              background: canContinue
                ? "linear-gradient(180deg, rgba(59,130,246,0.98), rgba(37,99,235,0.92))"
                : "rgba(30, 41, 59, 0.72)",
              color: "#eff6ff",
              fontSize: 14,
              fontWeight: 900,
              cursor: canContinue ? "pointer" : "not-allowed",
              opacity: canContinue ? 1 : 0.58,
              boxShadow: canContinue ? "0 12px 30px rgba(37, 99, 235, 0.26)" : "none",
            }}
          >
            Continuar al formulario
          </button>

          <Link
            href="/summary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              padding: "13px 16px",
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
              color: "#e2e8f0",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              background: "rgba(15, 23, 42, 0.9)",
            }}
          >
            Volver a Summary
          </Link>
        </div>
      </section>
    </main>
  );
}

function PreviewRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "12px 14px",
        borderRadius: 14,
        background: "rgba(2, 6, 23, 0.64)",
        border: "1px solid rgba(148, 163, 184, 0.12)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(147, 197, 253, 0.92)",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: 15,
          lineHeight: 1.45,
          color: muted ? "rgba(226, 232, 240, 0.58)" : "#f8fafc",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MiniStep({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        background: "rgba(2, 6, 23, 0.56)",
        border: "1px solid rgba(148, 163, 184, 0.1)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "rgba(96, 165, 250, 0.92)",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 14,
          lineHeight: 1.45,
          color: "#e2e8f0",
        }}
      >
        {text}
      </span>
    </div>
  );
}