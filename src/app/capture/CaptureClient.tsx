// src/app/capture/CaptureClient.tsx
"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseQuickCapture } from "@/lib/quickCaptureParser";
import supabase from "@/lib/supabaseClient";
import { upsertProposalResponse } from "@/lib/proposalResponsesDb";
import { trackEvent } from "@/lib/analytics";

type CaptureClientProps = {
  initialText?: string;
};

const EXAMPLES = [
  "fulbito sábado 6pm en la cancha",
  "cena mañana 8pm con fer",
  "cumple de juan viernes 7pm",
];

function pickIncomingText(
  searchParams: ReturnType<typeof useSearchParams>,
  initialText: string
) {
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
    "manual"
  );
}

function pickIntent(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get("intent")?.trim() || "";
}

function pickProposalEventId(searchParams: ReturnType<typeof useSearchParams>) {
  const candidates = [
    searchParams.get("proposal_event_id"),
    searchParams.get("proposalEventId"),
    searchParams.get("event_id"),
    searchParams.get("eventId"),
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }

  return "";
}

function cleanTemporalNoise(raw: string): string {
  let text = String(raw || "").trim();

  text = text.replace(/en dos fines de semana/gi, "");
  text = text.replace(/dos fines de semana/gi, "");
  text = text.replace(/en dos fines de/gi, "en dos fines");
  text = text.replace(/en dos fines/gi, "en dos fines");
  text = text.replace(/\bfin de semana\b/gi, "");
  text = text.replace(/\bfinde\b/gi, "");

  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^[-–—,:;\s]+/, "").replace(/[-–—,:;\s]+$/, "");

  return text;
}

function formatDateLabel(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return "Sin fecha detectada";

  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function normalizeTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function humanizeSource(source: string) {
  const safe = source.trim().toLowerCase();
  if (!safe || safe === "manual") return "Manual";
  if (safe === "summary") return "Inicio";
  if (safe === "whatsapp") return "WhatsApp";
  if (safe === "copy_link") return "Link copiado";
  if (safe === "deep-link" || safe === "link") return "Link";
  return source;
}

function shouldReadClipboardForSource(source: string) {
  const safe = source.trim().toLowerCase();
  return (
    safe === "deep-link" ||
    safe === "link" ||
    safe === "copy_link" ||
    safe === "whatsapp"
  );
}

function normalizeCaptureTextForMatching(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLocationQueryForDetails(
  locationQuery: string | null | undefined,
  participants: string[] | null | undefined,
  rawText: string
) {
  const query = normalizeTitle(String(locationQuery || ""));
  if (!query) return "";

  const normalizedRaw = normalizeCaptureTextForMatching(rawText);
  const normalizedQuery = normalizeCaptureTextForMatching(query);
  const firstParticipant = (participants || [])
    .map((participant) => normalizeTitle(String(participant || "")))
    .find(Boolean);

  const pointsToParticipantHome =
    /\ben\s+(su|sus)\s+casa\b/.test(normalizedRaw) ||
    /^(su|sus)\s+casa$/.test(normalizedQuery);

  if (pointsToParticipantHome && firstParticipant) {
    return `Casa de ${firstParticipant}`;
  }

  const pointsToParticipantApartment =
    /\ben\s+(su|sus)\s+(depa|departamento)\b/.test(normalizedRaw) ||
    /^(su|sus)\s+(depa|departamento)$/.test(normalizedQuery);

  if (pointsToParticipantApartment && firstParticipant) {
    return `Depa de ${firstParticipant}`;
  }

  return query;
}


type ContextPlaceKind =
  | "casa"
  | "depa"
  | "oficina"
  | "club"
  | "playa"
  | "cancha"
  | "campo"
  | "colegio"
  | "universidad"
  | "local"
  | "terraza";

type ContextPlaceIssue = {
  key: string;
  phrase: string;
  kind: ContextPlaceKind;
  placeLabel: string;
  mode: "owner" | "generic";
  ownerHint: "self" | "other" | "unknown";
  participantSuggestion: string;
  question: string;
  unresolvedLabel: string;
};

type ContextPlaceChoice = "self" | "participant" | "other" | "unknown" | null;

const CONTEXT_PLACE_LABELS: Record<ContextPlaceKind, string> = {
  casa: "Casa",
  depa: "Depa",
  oficina: "Oficina",
  club: "Club",
  playa: "Playa",
  cancha: "Cancha",
  campo: "Campo",
  colegio: "Colegio",
  universidad: "Universidad",
  local: "Local",
  terraza: "Terraza",
};

function normalizeContextPlaceKind(value: string): ContextPlaceKind {
  const normalized = normalizeCaptureTextForMatching(value);
  if (normalized === "departamento") return "depa";
  return (normalized as ContextPlaceKind) || "casa";
}

function getFirstRelevantParticipant(participants: string[] | null | undefined) {
  return (
    (participants || [])
      .map((participant) => normalizeTitle(String(participant || "")))
      .find(Boolean) || ""
  );
}

function prettifyContextOwner(value: string) {
  return normalizeTitle(
    String(value || "")
      .replace(/^(mi|mis|tu|tus|su|sus)\s+/i, "")
      .trim()
  );
}

function detectContextualPlaceIssue(
  rawText: string,
  participants: string[] | null | undefined
): ContextPlaceIssue | null {
  const raw = String(rawText || "");
  if (!raw.trim()) return null;

  const firstParticipant = getFirstRelevantParticipant(participants);
  const placeWords =
    "casa|depa|departamento|oficina|club|playa|cancha|campo|colegio|universidad|local|terraza";

  const possessiveMatch = raw.match(
    new RegExp(`\\b(mi|mis|tu|tus|su|sus)\\s+(${placeWords})\\b`, "i")
  );

  if (possessiveMatch?.[1] && possessiveMatch?.[2]) {
    const pronoun = normalizeCaptureTextForMatching(possessiveMatch[1]);
    const kind = normalizeContextPlaceKind(possessiveMatch[2]);
    const placeLabel = CONTEXT_PLACE_LABELS[kind] || "Lugar";
    const ownerHint = pronoun === "mi" || pronoun === "mis" ? "self" : "other";
    const participantSuggestion = ownerHint === "other" ? firstParticipant : "";
    const phrase = `${possessiveMatch[1]} ${possessiveMatch[2]}`.trim();

    return {
      key: `owner:${normalizeCaptureTextForMatching(phrase)}:${participantSuggestion}`,
      phrase,
      kind,
      placeLabel,
      mode: "owner",
      ownerHint,
      participantSuggestion,
      question:
        ownerHint === "self"
          ? `¿Quieres guardar “${phrase}” como tu ${placeLabel.toLowerCase()}?`
          : `¿De quién es “${phrase}”?`,
      unresolvedLabel: `${placeLabel} por confirmar`,
    };
  }

  const whereRelativeMatch = raw.match(
    /\bdonde\s+(mi|tu|su)\s+(mam[aá]|pap[aá]|herman[oa]|amig[oa]|primo|prima|t[ií]o|t[ií]a|abuelo|abuela|pareja|novi[oa])\b/i
  );

  if (whereRelativeMatch?.[1] && whereRelativeMatch?.[2]) {
    const pronoun = normalizeCaptureTextForMatching(whereRelativeMatch[1]);
    const owner = prettifyContextOwner(whereRelativeMatch[2]);
    const phrase = `${whereRelativeMatch[1]} ${whereRelativeMatch[2]}`.trim();

    return {
      key: `relative:${normalizeCaptureTextForMatching(phrase)}`,
      phrase: `donde ${phrase}`,
      kind: "casa",
      placeLabel: "Casa",
      mode: "owner",
      ownerHint: pronoun === "mi" ? "self" : "other",
      participantSuggestion: owner,
      question: `¿“donde ${phrase}” significa Casa de ${owner}?`,
      unresolvedLabel: "Casa por confirmar",
    };
  }

  const genericMatch = raw.match(
    /\b(?:en|por|cerca de|junto a|donde)\s+(?:el|la)\s+(club|playa|cancha|campo|oficina|colegio|universidad|local|terraza)\b(?!\s+(?:de|del)\b)(?!\s+[a-záéíóúñ]{3,})/i
  );

  if (genericMatch?.[1]) {
    const kind = normalizeContextPlaceKind(genericMatch[1]);
    const placeLabel = CONTEXT_PLACE_LABELS[kind] || "Lugar";
    const phrase = String(genericMatch[0] || genericMatch[1]).trim();

    return {
      key: `generic:${normalizeCaptureTextForMatching(phrase)}`,
      phrase,
      kind,
      placeLabel,
      mode: "generic",
      ownerHint: "unknown",
      participantSuggestion: "",
      question: `¿Qué ${placeLabel.toLowerCase()} es?`,
      unresolvedLabel: `${placeLabel} por confirmar`,
    };
  }

  return null;
}

function buildResolvedContextLocation(
  issue: ContextPlaceIssue | null,
  choice: ContextPlaceChoice,
  customValue: string
) {
  if (!issue) return "";

  const custom = normalizeTitle(String(customValue || ""));

  if (choice === "self") return `Mi ${issue.placeLabel.toLowerCase()}`;
  if (choice === "participant" && issue.participantSuggestion) {
    return `${issue.placeLabel} de ${issue.participantSuggestion}`;
  }
  if (choice === "other" && custom) {
    return issue.mode === "generic" ? custom : `${issue.placeLabel} de ${custom}`;
  }
  if (choice === "unknown") return issue.unresolvedLabel;

  return "";
}

export default function CaptureClient({ initialText = "" }: CaptureClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const attemptedClipboardRef = useRef(false);

  const incomingText = useMemo(
    () => pickIncomingText(searchParams, initialText),
    [initialText, searchParams]
  );

  const source = useMemo(() => pickIncomingSource(searchParams), [searchParams]);
  const shouldReadClipboard = useMemo(
    () => shouldReadClipboardForSource(source),
    [source]
  );
  const intent = useMemo(() => pickIntent(searchParams), [searchParams]);
  const proposalEventId = useMemo(
    () => pickProposalEventId(searchParams),
    [searchParams]
  );
  const isExplicitSharedIntent = intent === "shared";

  const [draft, setDraft] = useState(incomingText);
  const [clipboardNotice, setClipboardNotice] = useState("");
  const [clipboardState, setClipboardState] = useState<
    "idle" | "reading" | "success" | "blocked"
  >("idle");
  const [isSavingLater, setIsSavingLater] = useState(false);

  const parsed = useMemo(() => parseQuickCapture(draft.trim()), [draft]);
  const contextPlaceIssue = useMemo(
    () => detectContextualPlaceIssue(draft.trim(), parsed.participants),
    [draft, parsed.participants]
  );
  const [contextPlaceChoice, setContextPlaceChoice] = useState<ContextPlaceChoice>(null);
  const [contextPlaceCustomValue, setContextPlaceCustomValue] = useState("");
  const resolvedContextLocation = useMemo(
    () =>
      buildResolvedContextLocation(
        contextPlaceIssue,
        contextPlaceChoice,
        contextPlaceCustomValue
      ),
    [contextPlaceChoice, contextPlaceCustomValue, contextPlaceIssue]
  );
  const contextLocationPreview =
    resolvedContextLocation || contextPlaceIssue?.unresolvedLabel || "";
  const inferredGroupPlanIntent =
    parsed.participants.length > 0 ||
    parsed.signals.mentionsPeople ||
    parsed.signals.mentionsCouple ||
    parsed.locationSource === "house_of";
  const shouldCreateGroupPlan = isExplicitSharedIntent || inferredGroupPlanIntent;
  const isSharedIntent = isExplicitSharedIntent;

  useEffect(() => {
    setDraft(incomingText);
  }, [incomingText]);

  useEffect(() => {
    setContextPlaceChoice(null);
    setContextPlaceCustomValue("");
  }, [contextPlaceIssue?.key]);

  useEffect(() => {
    void trackEvent({
      event: "capture_opened",
      metadata: {
        screen: "capture",
        source,
        intent: shouldCreateGroupPlan ? "shared" : "personal",
        has_prefill: Boolean(incomingText.trim()),
      },
    });

    void trackEvent({
      event: "quick_capture_started",
      metadata: {
        screen: "capture",
        source,
        intent: shouldCreateGroupPlan ? "shared" : "personal",
        has_prefill: Boolean(incomingText.trim()),
      },
    });
  }, [incomingText, shouldCreateGroupPlan, source]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.focus();
    const length = inputRef.current.value.length;
    inputRef.current.setSelectionRange(length, length);
  }, []);

  useEffect(() => {
    if (attemptedClipboardRef.current) return;
    if (!shouldReadClipboard) return;
    if (incomingText.trim()) return;
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) return;
    if (!navigator.clipboard?.readText) return;

    attemptedClipboardRef.current = true;
    setClipboardState("reading");

    navigator.clipboard
      .readText()
      .then((clipboardText) => {
        const value = clipboardText.trim();

        if (!value) {
          setClipboardState("idle");
          return;
        }

        setDraft(value);
        setClipboardState("success");
        setClipboardNotice("Texto detectado desde tu portapapeles.");
      })
      .catch(() => {
        setClipboardState("blocked");
        setClipboardNotice(
          "No pudimos leer tu portapapeles. Puedes pegar el texto manualmente."
        );
      });
  }, [incomingText, shouldReadClipboard]);

  const title = parsed.title?.trim() || "";
  const normalizedTitle = normalizeTitle(title);
  const rawNotes = parsed.notes?.trim() || "";
  const cleanedNotes = cleanTemporalNoise(rawNotes);
  const prettyNotes = sentenceCase(cleanedNotes);
  const durationMinutes = parsed.durationMinutes || 60;
  const hasParsedDate = Boolean(parsed.date && !Number.isNaN(parsed.date.getTime()));
  const hasDateDetected = Boolean(parsed.signals.hasExplicitDate && hasParsedDate);
  const hasTimeDetected = Boolean(parsed.signals.hasExplicitTime && parsed.startHour !== null);
  const hasLocationDetected = Boolean(
    resolveLocationQueryForDetails(parsed.locationQuery, parsed.participants, draft.trim()) ||
      resolvedContextLocation ||
      contextPlaceIssue?.unresolvedLabel
  );
  const canContinue = Boolean(draft.trim() && normalizedTitle);
  const hasNotes = Boolean(prettyNotes);
  const isDraftEmpty = !draft.trim();
  const isManualEntry =
    source.trim().toLowerCase() === "manual" && !isSharedIntent;
  const pageTitle = isManualEntry
    ? "Crea tu plan rápido ✨"
    : "Esto es lo que entendí 👇";
  const pageSubtitle = isManualEntry
    ? "Escribe tu plan como se lo contarías a alguien. Lo ordenamos antes de crearlo."
    : "Revísalo y decide cómo quieres continuar.";

  const missingChecks = useMemo(
    () => ({
      title: !title,
      date: !hasDateDetected,
      notes: !hasNotes,
    }),
    [hasDateDetected, hasNotes, title]
  );

  const clarityScore = useMemo(() => {
    const score =
      Number(!missingChecks.title) +
      Number(!missingChecks.date) +
      Number(!missingChecks.notes);

    if (score <= 1) return "low";
    if (score === 2) return "medium";
    return "high";
  }, [missingChecks]);

  const parsingStatus = useMemo(() => {
    if (isDraftEmpty) {
      return {
        label: "Escribe tu plan para comenzar",
        tone: "neutral" as const,
        help: "Cuando escribas algo, te mostramos una vista previa clara antes de guardarlo.",
      };
    }

    if (!normalizedTitle) {
      return {
        label: "Falta el título del plan",
        tone: "warn" as const,
        help: "Agrega qué plan es (ej. cena, reunión, fulbito) para poder continuar.",
      };
    }

    if (!hasDateDetected && !hasTimeDetected) {
      return {
        label: "Entendí el plan, pero falta fecha y hora",
        tone: "warn" as const,
        help: "Puedes continuar, pero en el siguiente paso tendrás que confirmar cuándo es antes de guardarlo.",
      };
    }

    if (!hasDateDetected) {
      return {
        label: "Entendí la hora, pero falta la fecha",
        tone: "warn" as const,
        help: "No voy a asumir que es hoy. Confirma la fecha en el siguiente paso antes de guardar.",
      };
    }

    if (!hasTimeDetected) {
      return {
        label: "Entendí la fecha, pero falta la hora",
        tone: "warn" as const,
        help: "No voy a asumir una hora final. Confirma la hora en el siguiente paso antes de guardar.",
      };
    }

    if (isSharedIntent && (!hasDateDetected || !hasTimeDetected)) {
      return {
        label: "Para compartir mejor, falta cuándo",
        tone: "warn" as const,
        help: "Poner fecha y hora evita que todos coordinen con información incompleta.",
      };
    }

    return {
      label: "Plan claro y listo para continuar",
      tone: "success" as const,
      help: "Revisa los datos detectados y confirma para pasar al detalle final del plan.",
    };
  }, [hasDateDetected, hasTimeDetected, isDraftEmpty, isSharedIntent, normalizedTitle]);

  const summaryLine = useMemo(() => {
    if (!hasDateDetected) {
      return "Tiene sentido así 👇 · Fecha por confirmar";
    }

    if (!hasTimeDetected) {
      return `Tiene sentido así 👇 · ${formatDateLabel(parsed.date)} · Hora por confirmar`;
    }

    return `Tiene sentido así 👇 · ${formatDateLabel(parsed.date)}`;
  }, [hasDateDetected, hasTimeDetected, parsed]);

  function buildDetailsUrl(response?: "accept" | "adjust") {
    const params = new URLSearchParams();
    params.set("qc", "1");
    params.set("from", "capture");
    params.set("capture_source", source);
    params.set("type", shouldCreateGroupPlan ? "group" : "personal");
    params.set("title", normalizedTitle);
    params.set("duration", String(durationMinutes));
    params.set("raw_text", draft.trim());
    params.set("date_detected", hasDateDetected ? "1" : "0");
    params.set("time_detected", hasTimeDetected ? "1" : "0");
    params.set("location_detected", hasLocationDetected ? "1" : "0");
    params.set("qc_confidence", parsed.signals.confidence);

    const locationQueryForDetails =
      resolvedContextLocation ||
      contextPlaceIssue?.unresolvedLabel ||
      resolveLocationQueryForDetails(
        parsed.locationQuery,
        parsed.participants,
        draft.trim()
      );

    if (locationQueryForDetails) {
      params.set("location_query", locationQueryForDetails);
      if (contextPlaceIssue) {
        params.set("location_context", contextPlaceIssue.key);
      }
    }

    if (isSharedIntent) {
      params.set("intent", "shared");
      params.set("proposal", "1");

      if (proposalEventId) {
        params.set("proposal_event_id", proposalEventId);
      }

      if (response) {
        params.set("proposal_response", response);
      }
    }

    if (prettyNotes) {
      params.set("notes", prettyNotes);
    }

    if (parsed.startHour !== null) {
      params.set(
        "time",
        `${String(parsed.startHour).padStart(2, "0")}:${String(parsed.startMinutes).padStart(2, "0")}`
      );
    }

    if (hasDateDetected && parsed.date) {
      params.set("date", parsed.date.toISOString());
    }

    return `/events/new/details?${params.toString()}`;
  }

  function handleContinue() {
    if (!canContinue) return;
    void trackEvent({
      event: "quick_capture_submitted",
      metadata: {
        screen: "capture",
        source,
        intent: shouldCreateGroupPlan ? "shared" : "personal",
        action: "accept",
        has_date: hasDateDetected,
        has_time: hasTimeDetected,
        has_notes: hasNotes,
      },
    });
    router.push(buildDetailsUrl("accept"));
  }

  function handleAdjustBeforeCreate() {
    if (!canContinue) return;
    void trackEvent({
      event: "quick_capture_submitted",
      metadata: {
        screen: "capture",
        source,
        intent: shouldCreateGroupPlan ? "shared" : "personal",
        action: "adjust",
        has_date: hasDateDetected,
        has_time: hasTimeDetected,
        has_notes: hasNotes,
      },
    });
    router.push(buildDetailsUrl("adjust"));
  }

  async function handleLater() {
    if (isSavingLater) return;

    setIsSavingLater(true);

    try {
      if (isSharedIntent && proposalEventId) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (user?.id) {
          await upsertProposalResponse({
            eventId: proposalEventId,
            userId: user.id,
            response: "pending",
          });
        }
      }

      window.alert(
        "La propuesta quedó pendiente. Puedes volver más tarde desde el link."
      );
      router.push("/summary");
    } catch (error) {
      console.error("CaptureClient.handleLater", error);
      window.alert(
        "No pudimos guardar la propuesta como pendiente. Inténtalo otra vez."
      );
    } finally {
      setIsSavingLater(false);
    }
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
        {isSharedIntent && draft.trim() ? (
          <div
            style={{
              marginBottom: 18,
              borderRadius: 18,
              padding: "14px 16px",
              background: "rgba(56,189,248,0.10)",
              border: "1px solid rgba(56,189,248,0.25)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                                letterSpacing: "0.01em",
                color: "#7dd3fc",
              }}
            >
              Te mandaron esta idea 👇
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 16,
                fontWeight: 900,
                color: "#e0f2fe",
                lineHeight: 1.4,
              }}
            >
              “{draft.trim()}”
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                lineHeight: 1.5,
                color: "rgba(224,242,254,0.84)",
              }}
            >
              Revísala y decide cómo quieres continuar.
            </div>
          </div>
        ) : null}

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
              letterSpacing: "0.01em",
                          }}
          >
            {isManualEntry ? "Crear plan" : "Quick Capture"}
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
            {isManualEntry ? "Entrada manual" : `Fuente: ${humanizeSource(source)}`}
          </span>

          {isSharedIntent ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                padding: "8px 12px",
                background: "rgba(56, 189, 248, 0.10)",
                border: "1px solid rgba(56, 189, 248, 0.20)",
                color: "#dbeafe",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              Propuesta compartida
            </span>
          ) : null}

          {clipboardState === "reading" ? (
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
              Leyendo portapapeles...
            </span>
          ) : null}

          {isSharedIntent && proposalEventId ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                padding: "8px 12px",
                background: "rgba(16, 185, 129, 0.10)",
                border: "1px solid rgba(16, 185, 129, 0.22)",
                color: "#d1fae5",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              Propuesta vinculada
            </span>
          ) : null}
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
            {pageTitle}
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
            {pageSubtitle}
          </p>
        </header>

        <section
          style={{
            marginBottom: 16,
            borderRadius: 18,
            padding: "14px 16px",
            background:
              parsingStatus.tone === "success"
                ? "rgba(16, 185, 129, 0.10)"
                : parsingStatus.tone === "warn"
                  ? "rgba(245, 158, 11, 0.10)"
                  : "rgba(148, 163, 184, 0.10)",
            border:
              parsingStatus.tone === "success"
                ? "1px solid rgba(16, 185, 129, 0.22)"
                : parsingStatus.tone === "warn"
                  ? "1px solid rgba(245, 158, 11, 0.24)"
                  : "1px solid rgba(148, 163, 184, 0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 900,
                  color:
                    parsingStatus.tone === "success"
                      ? "#d1fae5"
                      : parsingStatus.tone === "warn"
                        ? "#fef3c7"
                        : "#e2e8f0",
                }}
              >
                {parsingStatus.label}
              </p>
              <p
                style={{
                  margin: "5px 0 0 0",
                  fontSize: 13,
                  lineHeight: 1.45,
                  color:
                    parsingStatus.tone === "success"
                      ? "rgba(209, 250, 229, 0.88)"
                      : parsingStatus.tone === "warn"
                        ? "rgba(254, 243, 199, 0.9)"
                        : "rgba(226, 232, 240, 0.76)",
                }}
              >
                {parsingStatus.help}
              </p>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                padding: "7px 11px",
                border: "1px solid rgba(148, 163, 184, 0.24)",
                fontSize: 12,
                fontWeight: 800,
                color: "rgba(226, 232, 240, 0.9)",
                background: "rgba(2, 6, 23, 0.4)",
              }}
            >
              Claridad:{" "}
              {clarityScore === "high"
                ? "Alta"
                : clarityScore === "medium"
                  ? "Media"
                  : "Baja"}
            </span>
          </div>
        </section>

        {clipboardNotice ? (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 16,
              padding: "12px 14px",
              background:
                clipboardState === "success"
                  ? "rgba(16, 185, 129, 0.10)"
                  : "rgba(245, 158, 11, 0.10)",
              border:
                clipboardState === "success"
                  ? "1px solid rgba(16, 185, 129, 0.25)"
                  : "1px solid rgba(245, 158, 11, 0.25)",
              color:
                clipboardState === "success"
                  ? "rgba(209, 250, 229, 0.95)"
                  : "rgba(254, 243, 199, 0.95)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {clipboardNotice}
          </div>
        ) : null}

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
                Tu idea
              </p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 13,
                  color: "rgba(226, 232, 240, 0.62)",
                }}
              >
                Puedes editarla antes de seguir.
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
              Así quedaría 👇
            </p>

            <div
              style={{
                display: "grid",
                gap: 12,
                marginTop: 14,
              }}
            >
              <PreviewRow
                label="Título"
                value={normalizedTitle || "Sin título detectado"}
                muted={missingChecks.title}
                severity={missingChecks.title ? "warn" : "default"}
              />
              <PreviewRow
                label="Notas"
                value={prettyNotes || "Sin notas detectadas"}
                muted={missingChecks.notes}
                severity={missingChecks.notes ? "neutral" : "default"}
              />
              <PreviewRow
                label="Fecha"
                value={hasDateDetected ? formatDateLabel(parsed.date) : "Fecha por confirmar"}
                muted={missingChecks.date}
                severity={missingChecks.date ? "warn" : "default"}
              />
              <PreviewRow label="Duración" value={`${durationMinutes} min`} />
              <PreviewRow
                label="Ubicación"
                value={
                  contextLocationPreview ||
                  parsed.locationQuery ||
                  "Sin ubicación detectada"
                }
                muted={!contextLocationPreview && !parsed.locationQuery}
                severity={contextPlaceIssue ? "warn" : "default"}
              />
            </div>

            {contextPlaceIssue ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  padding: 14,
                  background: "rgba(245, 158, 11, 0.10)",
                  border: "1px solid rgba(245, 158, 11, 0.24)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: "#fef3c7",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Necesito aclarar una ubicación
                </p>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "rgba(254, 243, 199, 0.94)",
                    fontSize: 14,
                    fontWeight: 800,
                    lineHeight: 1.45,
                  }}
                >
                  {contextPlaceIssue.question}
                </p>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "rgba(254, 243, 199, 0.76)",
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  No voy a adivinar. Si no estás seguro, lo dejamos por confirmar.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {contextPlaceIssue.ownerHint === "self" ? (
                    <ContextChoiceButton
                      active={contextPlaceChoice === "self"}
                      onClick={() => setContextPlaceChoice("self")}
                    >
                      Mi {contextPlaceIssue.placeLabel.toLowerCase()}
                    </ContextChoiceButton>
                  ) : null}

                  {contextPlaceIssue.participantSuggestion ? (
                    <ContextChoiceButton
                      active={contextPlaceChoice === "participant"}
                      onClick={() => setContextPlaceChoice("participant")}
                    >
                      {contextPlaceIssue.placeLabel} de {contextPlaceIssue.participantSuggestion}
                    </ContextChoiceButton>
                  ) : null}

                  <ContextChoiceButton
                    active={contextPlaceChoice === "other"}
                    onClick={() => setContextPlaceChoice("other")}
                  >
                    {contextPlaceIssue.mode === "generic" ? "Poner nombre" : "Otra persona"}
                  </ContextChoiceButton>

                  <ContextChoiceButton
                    active={contextPlaceChoice === "unknown"}
                    onClick={() => setContextPlaceChoice("unknown")}
                  >
                    Dejar por confirmar
                  </ContextChoiceButton>
                </div>

                {contextPlaceChoice === "other" ? (
                  <input
                    value={contextPlaceCustomValue}
                    onChange={(event) => setContextPlaceCustomValue(event.target.value)}
                    placeholder={
                      contextPlaceIssue.mode === "generic"
                        ? `Ej. ${contextPlaceIssue.placeLabel} Regatas, Playa Asia, Cancha del cole`
                        : "Nombre de la persona"
                    }
                    style={{
                      width: "100%",
                      marginTop: 12,
                      borderRadius: 14,
                      border: "1px solid rgba(245, 158, 11, 0.28)",
                      background: "rgba(15, 23, 42, 0.86)",
                      color: "#fff7ed",
                      padding: "12px 13px",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 16,
                borderRadius: 16,
                padding: "13px 14px",
                background:
                  "linear-gradient(180deg, rgba(30,41,59,0.72), rgba(2,6,23,0.72))",
                border: "1px solid rgba(96, 165, 250, 0.22)",
                color: "#dbeafe",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {summaryLine}
            </div>

            {(missingChecks.title || missingChecks.date || missingChecks.notes) && (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                  padding: "11px 12px",
                  background: "rgba(245, 158, 11, 0.09)",
                  border: "1px solid rgba(245, 158, 11, 0.20)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#fef3c7",
                  }}
                >
                  Para mayor claridad, te sugiero:
                </p>
                <ul
                  style={{
                    margin: "8px 0 0 18px",
                    padding: 0,
                    display: "grid",
                    gap: 5,
                    color: "rgba(254, 243, 199, 0.9)",
                    fontSize: 13,
                  }}
                >
                  {missingChecks.title ? <li>Agregar el nombre del plan.</li> : null}
                  {missingChecks.date ? <li>Incluir día y hora (ej. viernes 8pm).</li> : null}
                  {missingChecks.notes ? <li>Añadir contexto breve (con quién o dónde).</li> : null}
                </ul>
              </div>
            )}
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
              Lo que puedes hacer ahora
            </p>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <MiniStep text="Interpreté tu idea" />
              <MiniStep
                text={
                  canContinue
                    ? "La dejé lista para revisar"
                    : "Completa el plan para habilitar continuar"
                }
              />
              <MiniStep
                text={
                  hasDateDetected && hasTimeDetected
                    ? "Puedes confirmarla o cambiar algo antes"
                    : "Confirma fecha y hora en el siguiente paso"
                }
              />
            </div>
          </div>
        </section>

        {isSharedIntent ? (
          <div
            style={{
              marginTop: 18,
              borderRadius: 18,
              padding: "14px 16px",
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                                letterSpacing: "0.01em",
                color: "#bfdbfe",
              }}
            >
              Decidan esto juntos
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.55,
                color: "rgba(226,232,240,0.78)",
              }}
            >
              Puedes dejarlo como está, cambiar algo o verlo más tarde.
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 22,
          }}
        >
          {isSharedIntent && (!hasDateDetected || !hasTimeDetected) && canContinue ? (
            <div
              style={{
                width: "100%",
                borderRadius: 14,
                padding: "10px 12px",
                background: "rgba(245, 158, 11, 0.10)",
                border: "1px solid rgba(245, 158, 11, 0.24)",
                color: "rgba(254, 243, 199, 0.95)",
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              Te recomiendo agregar fecha/hora antes de compartir para evitar idas y vueltas.
            </div>
          ) : null}

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
              boxShadow: canContinue
                ? "0 12px 30px rgba(37, 99, 235, 0.26)"
                : "none",
            }}
            >
            {isSharedIntent && (!hasDateDetected || !hasTimeDetected)
              ? "Continuar y confirmar fecha/hora"
              : isSharedIntent
                ? "Sí, hagámoslo así"
                : "Continuar con este plan"}
          </button>

          {isSharedIntent ? (
            <button
              type="button"
              onClick={handleAdjustBeforeCreate}
              disabled={!canContinue}
              style={{
                borderRadius: 999,
                padding: "13px 16px",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                background: "rgba(15, 23, 42, 0.9)",
                color: "#e2e8f0",
                fontSize: 13,
                fontWeight: 800,
                cursor: canContinue ? "pointer" : "not-allowed",
                opacity: canContinue ? 1 : 0.58,
              }}
            >
              Corregir antes
            </button>
          ) : null}

          {isSharedIntent ? (
            <button
              type="button"
              onClick={handleLater}
              disabled={isSavingLater}
              style={{
                borderRadius: 999,
                padding: "13px 16px",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                background: "rgba(2, 6, 23, 0.7)",
                color: "#94a3b8",
                fontSize: 13,
                fontWeight: 800,
                cursor: isSavingLater ? "not-allowed" : "pointer",
                opacity: isSavingLater ? 0.7 : 1,
              }}
            >
              {isSavingLater ? "Guardando..." : "Lo veo después"}
            </button>
          ) : null}

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
            Volver a Inicio
          </Link>
        </div>
      </section>
    </main>
  );
}

function ContextChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        padding: "9px 12px",
        border: active
          ? "1px solid rgba(251, 191, 36, 0.62)"
          : "1px solid rgba(245, 158, 11, 0.26)",
        background: active
          ? "rgba(245, 158, 11, 0.24)"
          : "rgba(15, 23, 42, 0.72)",
        color: active ? "#fff7ed" : "rgba(254, 243, 199, 0.86)",
        fontSize: 12,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function PreviewRow({
  label,
  value,
  muted = false,
  severity = "default",
}: {
  label: string;
  value: string;
  muted?: boolean;
  severity?: "default" | "warn" | "neutral";
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "12px 14px",
        borderRadius: 14,
        background: "rgba(2, 6, 23, 0.64)",
        border:
          severity === "warn"
            ? "1px solid rgba(245, 158, 11, 0.28)"
            : severity === "neutral"
              ? "1px solid rgba(148, 163, 184, 0.22)"
              : "1px solid rgba(148, 163, 184, 0.12)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
                    letterSpacing: "0.01em",
          color:
            severity === "warn"
              ? "rgba(253, 230, 138, 0.95)"
              : "rgba(147, 197, 253, 0.92)",
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