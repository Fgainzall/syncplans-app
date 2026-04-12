// src/lib/groupSuggestion.ts

import type { LearningSignal } from "@/lib/learningTypes";
import {
  buildLearnedGroupDecisionProfile,
  getBestGroupFromLearning,
} from "@/lib/learningGroupProfile";
import type { LearnedGroupDecisionProfile } from "@/lib/learningGroupProfile";

export type GroupSuggestionMode =
  | "auto_apply"
  | "suggest_only"
  | "ambiguous"
  | "none";

export type GroupSuggestionReason =
  | "semantic"
  | "name_match"
  | "learned"
  | "context"
  | "fallback"
  | "conflict";

export type GroupSuggestionConfidence = "high" | "medium" | "low";

export type GroupSuggestionType = "pair" | "family" | "other";

export type GroupSuggestionWinner = "heuristic" | "learning" | "none" | "mixed";

export type CanonicalGroupSuggestion = {
  groupId: string | null;
  type: GroupSuggestionType | null;
  confidence: GroupSuggestionConfidence;
  mode: GroupSuggestionMode;
  reason: GroupSuggestionReason;
  trace?: GroupSuggestionTrace;
};

export type GroupSuggestionTrace = {
  rawText: string;
  decision:
    | "heuristic_only"
    | "learning_only"
    | "heuristic_and_learning_agree"
    | "heuristic_conflict_learning_ignored"
    | "learning_override"
    | "heuristic_kept_learning_weak"
    | "heuristic_vs_learning_ambiguous"
    | "empty_input"
    | "no_signals_or_candidates"
    | "no_profiles"
    | "learning_below_threshold"
    | "learning_group_not_found";
  explanation: {
    winner: GroupSuggestionWinner;
    summary: string;
  };
  heuristic: {
    type: GroupSuggestionType | null;
    score: number;
    normalizedConfidence: number;
    reason: string | null;
    strongMatch: boolean;
  };
  learning: {
    groupId: string | null;
    type: GroupSuggestionType | null;
    confidence: number;
    reason: string | null;
    minConfidenceReached: boolean;
    overrideThresholdReached: boolean;
  };
  candidates: Array<{
    id: string;
    type: GroupSuggestionType;
  }>;
  final: {
    groupId: string | null;
    type: GroupSuggestionType | null;
    confidence: GroupSuggestionConfidence;
    mode: GroupSuggestionMode;
    reason: GroupSuggestionReason;
  };
};

export type GroupSuggestion = {
  type: GroupSuggestionType | null;
  confidence: number;
  reason?: string;
  trace?: GroupSuggestionTrace;
};

export type SuggestGroupFromLearningInput = {
  title: string;
  notes?: string;
  signals?: LearningSignal[];
  candidateGroups?: Array<{
    id: string;
    type: string | null;
  }>;
};

const PAIR_KEYWORDS = [
  "cena",
  "salir",
  "date",
  "aniversario",
  "pelicula",
  "cine",
  "comer",
  "pareja",
  "novia",
  "novio",
  "esposa",
  "esposo",
  "juntos",
  "juntas",
];

const FAMILY_KEYWORDS = [
  "familia",
  "mama",
  "mamá",
  "papa",
  "papá",
  "papas",
  "papás",
  "padres",
  "cumple",
  "cumpleaños",
  "almuerzo familiar",
  "hijos",
  "abuelos",
  "casa de mis padres",
];

const OTHER_KEYWORDS = [
  "padel",
  "pádel",
  "futbol",
  "fulbito",
  "amigos",
  "asado",
  "reunion",
  "reunión",
  "partido",
  "after",
  "previa",
  "chicos",
  "team",
  "equipo",
  "gente",
  "banda",
  "grupo",
  "juntada",
];

type NormalizedCandidateGroup = {
  id: string;
  type: GroupSuggestionType;
};

type HeuristicGroupSuggestion = {
  type: GroupSuggestionType | null;
  score: number;
  confidence: number;
  reason?: string;
  trace?: GroupSuggestionTrace;
};

type TraceBuildInput = {
  rawText: string;
  decision: GroupSuggestionTrace["decision"];
  heuristic: HeuristicGroupSuggestion;
  learningGroupId?: string | null;
  learningType?: GroupSuggestionType | null;
  learningConfidence?: number;
  learningReason?: string | null;
  candidates: NormalizedCandidateGroup[];
  final: CanonicalGroupSuggestion;
};

/**
 * Fase 6.1 — calibración fina del motor canónico
 *
 * Intención:
 * - subir el listón para que learning dé menos auto_apply silencioso
 * - exigir más señal antes de override contra heurística
 * - empujar casos medianos a suggest_only / ambiguous
 * - mantener los casos fuertes funcionando sin reescribir la lógica
 */
const LEARNING_MIN_CONFIDENCE = 0.26;
const LEARNING_OVERRIDE_THRESHOLD = 0.68;
const LEARNING_STRONG_THRESHOLD = 0.76;
const AUTO_APPLY_LEARNING_THRESHOLD = 0.84;
const MEDIUM_LEARNING_THRESHOLD = 0.52;
const HEURISTIC_STRONG_SCORE = 2;

function normalizeText(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!?()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWholePhrase(text: string, phrase: string): boolean {
  const normalizedText = ` ${normalizeText(text)} `;
  const normalizedPhrase = normalizeText(phrase);
  return normalizedText.includes(` ${normalizedPhrase} `);
}

function scoreSuggestion(text: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (hasWholePhrase(text, keyword)) hits += 1;
  }
  return hits;
}

function countPatternHits(text: string, patterns: RegExp[]): number {
  const normalized = normalizeText(text);
  return patterns.reduce(
    (acc, pattern) => acc + (pattern.test(normalized) ? 1 : 0),
    0,
  );
}

function normalizeSuggestedType(
  value: string | null | undefined,
): GroupSuggestionType | null {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "pair") return "pair";
  if (raw === "family") return "family";
  if (raw === "other") return "other";
  if (raw === "shared") return "other";

  return null;
}

function normalizeCandidateGroups(
  candidateGroups: SuggestGroupFromLearningInput["candidateGroups"],
): NormalizedCandidateGroup[] {
  const seen = new Set<string>();
  const normalized: NormalizedCandidateGroup[] = [];

  for (const group of Array.isArray(candidateGroups) ? candidateGroups : []) {
    const id = String(group?.id ?? "").trim();
    const type = normalizeSuggestedType(group?.type ?? null);

    if (!id || !type || seen.has(id)) continue;

    seen.add(id);
    normalized.push({ id, type });
  }

  return normalized;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Number(value.toFixed(4)));
}

function heuristicScoreToUnit(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  if (score >= 3) return 1;
  if (score >= 2) return 0.8;
  return 0.55;
}

function unitToConfidenceBand(value: number): GroupSuggestionConfidence {
  if (value >= AUTO_APPLY_LEARNING_THRESHOLD) return "high";
  if (value >= MEDIUM_LEARNING_THRESHOLD) return "medium";
  return "low";
}

function isStrongHeuristicMatch(suggestion: HeuristicGroupSuggestion): boolean {
  return Boolean(suggestion.type && suggestion.score >= HEURISTIC_STRONG_SCORE);
}

function countCandidatesByType(
  candidates: NormalizedCandidateGroup[],
  type: GroupSuggestionType | null,
): number {
  if (!type) return 0;
  return candidates.filter((candidate) => candidate.type === type).length;
}

function buildCanonicalSuggestion(params: {
  heuristic: HeuristicGroupSuggestion;
  candidates: NormalizedCandidateGroup[];
  learningGroupId?: string | null;
  learningType?: GroupSuggestionType | null;
  learningConfidence?: number;
  preferHeuristic?: boolean;
  preferLearning?: boolean;
  forceAmbiguous?: boolean;
}): CanonicalGroupSuggestion {
  const heuristic = params.heuristic;
  const learningConfidence = clampUnit(params.learningConfidence ?? 0);
  const heuristicConfidence = clampUnit(heuristic.confidence);

  const typeCandidateCount = countCandidatesByType(
    params.candidates,
    heuristic.type ?? params.learningType ?? null,
  );
  const multipleCandidatesSameType = typeCandidateCount > 1;

  if (params.forceAmbiguous) {
    return {
      groupId: null,
      type: heuristic.type ?? params.learningType ?? null,
      confidence: "low",
      mode: "ambiguous",
      reason: "conflict",
    };
  }

  if (params.preferLearning && params.learningGroupId && params.learningType) {
    const mode: GroupSuggestionMode =
      learningConfidence >= AUTO_APPLY_LEARNING_THRESHOLD
        ? "auto_apply"
        : "suggest_only";

    return {
      groupId: params.learningGroupId,
      type: params.learningType,
      confidence: unitToConfidenceBand(learningConfidence),
      mode,
      reason: "learned",
    };
  }

  if (params.preferHeuristic && heuristic.type) {
    if (multipleCandidatesSameType) {
      return {
        groupId: null,
        type: heuristic.type,
        confidence: unitToConfidenceBand(heuristicConfidence),
        mode: "suggest_only",
        reason: "semantic",
      };
    }

    const onlyCandidateOfType = params.candidates.find(
      (candidate) => candidate.type === heuristic.type,
    );

    if (onlyCandidateOfType && heuristicConfidence >= 0.8) {
      return {
        groupId: onlyCandidateOfType.id,
        type: heuristic.type,
        confidence: unitToConfidenceBand(heuristicConfidence),
        mode: "auto_apply",
        reason: "semantic",
      };
    }

    return {
      groupId: onlyCandidateOfType?.id ?? null,
      type: heuristic.type,
      confidence: unitToConfidenceBand(heuristicConfidence),
      mode: "suggest_only",
      reason: "semantic",
    };
  }

  if (params.learningGroupId && params.learningType) {
    return {
      groupId: params.learningGroupId,
      type: params.learningType,
      confidence: unitToConfidenceBand(learningConfidence),
      mode:
        learningConfidence >= MEDIUM_LEARNING_THRESHOLD
          ? "suggest_only"
          : "ambiguous",
      reason: "learned",
    };
  }

  if (heuristic.type) {
    return {
      groupId: null,
      type: heuristic.type,
      confidence: unitToConfidenceBand(heuristicConfidence),
      mode:
        heuristicConfidence >= MEDIUM_LEARNING_THRESHOLD
          ? "suggest_only"
          : "ambiguous",
      reason: "semantic",
    };
  }

  return {
    groupId: null,
    type: null,
    confidence: "low",
    mode: "none",
    reason: "fallback",
  };
}

function getTraceWinner(
  decision: GroupSuggestionTrace["decision"],
): GroupSuggestionWinner {
  switch (decision) {
    case "heuristic_only":
    case "heuristic_conflict_learning_ignored":
    case "heuristic_kept_learning_weak":
      return "heuristic";

    case "learning_only":
    case "learning_override":
      return "learning";

    case "heuristic_and_learning_agree":
      return "mixed";

    case "heuristic_vs_learning_ambiguous":
    case "empty_input":
    case "no_signals_or_candidates":
    case "no_profiles":
    case "learning_below_threshold":
    case "learning_group_not_found":
    default:
      return "none";
  }
}

function buildTraceSummary(params: {
  decision: GroupSuggestionTrace["decision"];
  heuristic: HeuristicGroupSuggestion;
  learningConfidence: number;
  learningReason?: string | null;
  final: CanonicalGroupSuggestion;
}): string {
  const heuristicType = params.heuristic.type ?? "none";
  const finalType = params.final.type ?? "none";

  switch (params.decision) {
    case "heuristic_only":
      return `Heurística decidió ${heuristicType} sin apoyo de learning.`;

    case "learning_only":
      return `Learning decidió ${finalType} sin señal heurística clara.`;

    case "heuristic_and_learning_agree":
      return `Heurística y learning coincidieron en ${finalType}.`;

    case "heuristic_conflict_learning_ignored":
      return `Heurística mantuvo ${heuristicType} porque learning no alcanzó fuerza suficiente para contradecirla.`;

    case "heuristic_kept_learning_weak":
      return `Heurística se mantuvo porque learning fue demasiado débil.`;

    case "learning_override":
      return `Learning sobreescribió la heurística por mayor confianza (${params.learningConfidence.toFixed(2)}).`;

    case "heuristic_vs_learning_ambiguous":
      return `Hubo conflicto entre heurística y learning, así que la decisión quedó ambigua.`;

    case "empty_input":
      return "No hubo texto suficiente para sugerir un grupo.";

    case "no_signals_or_candidates":
      return "Faltan señales de learning o grupos candidatos para decidir mejor.";

    case "no_profiles":
      return "No se encontraron perfiles útiles de learning para los grupos candidatos.";

    case "learning_below_threshold":
      return `Learning quedó por debajo del threshold mínimo (${params.learningConfidence.toFixed(2)}).`;

    case "learning_group_not_found":
      return "Learning devolvió un grupo que no pudo mapearse a los candidatos disponibles.";

    default:
      return params.learningReason?.trim() || "No hay explicación adicional.";
  }
}

function buildTrace(params: TraceBuildInput): GroupSuggestionTrace {
  const heuristicStrong = isStrongHeuristicMatch(params.heuristic);
  const learningConfidence = clampUnit(params.learningConfidence ?? 0);

  return {
    rawText: params.rawText,
    decision: params.decision,
    explanation: {
      winner: getTraceWinner(params.decision),
      summary: buildTraceSummary({
        decision: params.decision,
        heuristic: params.heuristic,
        learningConfidence,
        learningReason: params.learningReason ?? null,
        final: params.final,
      }),
    },
    heuristic: {
      type: params.heuristic.type ?? null,
      score: clampScore(params.heuristic.score),
      normalizedConfidence: clampUnit(params.heuristic.confidence),
      reason: params.heuristic.reason ?? null,
      strongMatch: heuristicStrong,
    },
    learning: {
      groupId: String(params.learningGroupId ?? "").trim() || null,
      type: params.learningType ?? null,
      confidence: learningConfidence,
      reason: params.learningReason ?? null,
      minConfidenceReached: learningConfidence >= LEARNING_MIN_CONFIDENCE,
      overrideThresholdReached:
        learningConfidence >= LEARNING_OVERRIDE_THRESHOLD,
    },
    candidates: params.candidates.map((candidate) => ({
      id: candidate.id,
      type: candidate.type,
    })),
    final: {
      groupId: params.final.groupId,
      type: params.final.type,
      confidence: params.final.confidence,
      mode: params.final.mode,
      reason: params.final.reason,
    },
  };
}

export function suggestGroupFromText(
  title: string,
  notes?: string,
): GroupSuggestion {
  const text = normalizeText(`${title} ${notes ?? ""}`);

  if (!text) {
    return { type: null, confidence: 0, trace: undefined };
  }

  const pairScore =
    scoreSuggestion(text, PAIR_KEYWORDS) +
    countPatternHits(text, [
      /\bcon\s+mi\s+(pareja|novi[oa]|espos[oa])\b/,
      /\bjuntos\b/,
      /\bjuntas\b/,
    ]);

  const familyScore =
    scoreSuggestion(text, FAMILY_KEYWORDS) +
    countPatternHits(text, [
      /\bcon\s+mi\s+familia\b/,
      /\bcon\s+mis\s+(papas|papás|padres|hijos|abuelos)\b/,
      /\balmuerzo\s+con\s+mis\s+(papas|papás|padres)\b/,
    ]);

  const otherScore =
    scoreSuggestion(text, OTHER_KEYWORDS) +
    countPatternHits(text, [
      /\bcon\s+los\s+chicos\b/,
      /\bcon\s+amigos\b/,
      /\bcon\s+el\s+team\b/,
      /\bcon\s+[a-záéíóúñ]+\s+y\s+[a-záéíóúñ]+\b/,
      /\b(fulbito|padel|pádel|asado)\b/,
    ]);

  const max = Math.max(pairScore, familyScore, otherScore);

  if (max === 0) {
    return { type: null, confidence: 0, trace: undefined };
  }

  const leaders = [
    {
      type: "pair" as const,
      score: pairScore,
      reason: "Suena más a un plan de pareja",
    },
    {
      type: "family" as const,
      score: familyScore,
      reason: "Suena más a un plan familiar",
    },
    {
      type: "other" as const,
      score: otherScore,
      reason: "Suena más a un plan compartido",
    },
  ].filter((item) => item.score === max);

  if (leaders.length !== 1) {
    return { type: null, confidence: max, trace: undefined };
  }

  return {
    type: leaders[0].type,
    confidence: leaders[0].score,
    reason: leaders[0].reason,
    trace: undefined,
  };
}

export function suggestCanonicalGroupWithLearning(
  input: SuggestGroupFromLearningInput,
): CanonicalGroupSuggestion {
  const title = String(input.title ?? "").trim();
  const notes = String(input.notes ?? "").trim();
  const rawText = `${title} ${notes}`.trim();

  const heuristicBase = suggestGroupFromText(title, notes);
  const heuristic: HeuristicGroupSuggestion = {
    type: heuristicBase.type,
    score: clampScore(heuristicBase.confidence),
    confidence: heuristicScoreToUnit(heuristicBase.confidence),
    reason: heuristicBase.reason,
    trace: heuristicBase.trace,
  };

  const signals = Array.isArray(input.signals) ? input.signals : [];
  const candidateGroups = normalizeCandidateGroups(input.candidateGroups);

  if (!rawText) {
    const final = buildCanonicalSuggestion({
      heuristic,
      candidates: candidateGroups,
    });

    return {
      ...final,
      trace: buildTrace({
        rawText,
        decision: "empty_input",
        heuristic,
        candidates: candidateGroups,
        final,
      }),
    };
  }

  if (signals.length === 0 || candidateGroups.length === 0) {
    const final = buildCanonicalSuggestion({
      heuristic,
      candidates: candidateGroups,
      preferHeuristic: Boolean(heuristic.type),
    });

    return {
      ...final,
      trace: buildTrace({
        rawText,
        decision: "no_signals_or_candidates",
        heuristic,
        candidates: candidateGroups,
        final,
      }),
    };
  }

  const profiles: LearnedGroupDecisionProfile[] = candidateGroups
    .map((group) =>
      buildLearnedGroupDecisionProfile(signals, {
        groupId: group.id,
      }),
    )
    .filter(
      (profile): profile is LearnedGroupDecisionProfile =>
        profile !== null && profile.totalSignals > 0,
    );

  if (profiles.length === 0) {
    const final = buildCanonicalSuggestion({
      heuristic,
      candidates: candidateGroups,
      preferHeuristic: Boolean(heuristic.type),
    });

    return {
      ...final,
      trace: buildTrace({
        rawText,
        decision: "no_profiles",
        heuristic,
        candidates: candidateGroups,
        final,
      }),
    };
  }

  const learned = getBestGroupFromLearning({
    rawText,
    profiles,
  });

  if (!learned.groupId || learned.confidence < LEARNING_MIN_CONFIDENCE) {
    const final = buildCanonicalSuggestion({
      heuristic,
      candidates: candidateGroups,
      preferHeuristic: Boolean(heuristic.type),
      learningGroupId: learned.groupId ?? null,
      learningConfidence: learned.confidence,
    });

    return {
      ...final,
      trace: buildTrace({
        rawText,
        decision: "learning_below_threshold",
        heuristic,
        learningGroupId: learned.groupId ?? null,
        learningConfidence: learned.confidence,
        learningReason: learned.reason ?? null,
        candidates: candidateGroups,
        final,
      }),
    };
  }

  const matchedGroup = candidateGroups.find(
    (group) => group.id === learned.groupId,
  );
  const learnedType = matchedGroup?.type ?? null;

  if (!learnedType) {
    const final = buildCanonicalSuggestion({
      heuristic,
      candidates: candidateGroups,
      preferHeuristic: Boolean(heuristic.type),
      learningGroupId: learned.groupId ?? null,
      learningConfidence: learned.confidence,
    });

    return {
      ...final,
      trace: buildTrace({
        rawText,
        decision: "learning_group_not_found",
        heuristic,
        learningGroupId: learned.groupId,
        learningConfidence: learned.confidence,
        learningReason: learned.reason ?? null,
        candidates: candidateGroups,
        final,
      }),
    };
  }

  if (!heuristic.type) {
    const final = buildCanonicalSuggestion({
      heuristic,
      candidates: candidateGroups,
      learningGroupId: learned.groupId,
      learningType: learnedType,
      learningConfidence: learned.confidence,
      preferLearning: true,
    });

    return {
      ...final,
      trace: buildTrace({
        rawText,
        decision: "learning_only",
        heuristic,
        learningGroupId: learned.groupId,
        learningType: learnedType,
        learningConfidence: learned.confidence,
        learningReason: learned.reason ?? null,
        candidates: candidateGroups,
        final,
      }),
    };
  }

  if (heuristic.type === learnedType) {
    const final = buildCanonicalSuggestion({
      heuristic,
      candidates: candidateGroups,
      learningGroupId: learned.groupId,
      learningType: learnedType,
      learningConfidence: learned.confidence,
      preferLearning:
        learned.confidence >= LEARNING_OVERRIDE_THRESHOLD &&
        learned.confidence > heuristic.confidence,
      preferHeuristic:
        !(learned.confidence >= LEARNING_OVERRIDE_THRESHOLD &&
          learned.confidence > heuristic.confidence),
    });

    return {
      ...final,
      trace: buildTrace({
        rawText,
        decision: "heuristic_and_learning_agree",
        heuristic,
        learningGroupId: learned.groupId,
        learningType: learnedType,
        learningConfidence: learned.confidence,
        learningReason: learned.reason ?? null,
        candidates: candidateGroups,
        final,
      }),
    };
  }

  if (
    isStrongHeuristicMatch(heuristic) &&
    learned.confidence < LEARNING_STRONG_THRESHOLD
  ) {
    const final = buildCanonicalSuggestion({
      heuristic,
      candidates: candidateGroups,
      learningGroupId: learned.groupId,
      learningType: learnedType,
      learningConfidence: learned.confidence,
      preferHeuristic: true,
    });

    return {
      ...final,
      trace: buildTrace({
        rawText,
        decision: "heuristic_conflict_learning_ignored",
        heuristic,
        learningGroupId: learned.groupId,
        learningType: learnedType,
        learningConfidence: learned.confidence,
        learningReason: learned.reason ?? null,
        candidates: candidateGroups,
        final,
      }),
    };
  }

  if (
    learned.confidence >= LEARNING_OVERRIDE_THRESHOLD &&
    learned.confidence > heuristic.confidence + 0.1
  ) {
    const final = buildCanonicalSuggestion({
      heuristic,
      candidates: candidateGroups,
      learningGroupId: learned.groupId,
      learningType: learnedType,
      learningConfidence: learned.confidence,
      preferLearning: true,
    });

    return {
      ...final,
      trace: buildTrace({
        rawText,
        decision: "learning_override",
        heuristic,
        learningGroupId: learned.groupId,
        learningType: learnedType,
        learningConfidence: learned.confidence,
        learningReason: learned.reason ?? null,
        candidates: candidateGroups,
        final,
      }),
    };
  }

  const final = buildCanonicalSuggestion({
    heuristic,
    candidates: candidateGroups,
    learningGroupId: learned.groupId,
    learningType: learnedType,
    learningConfidence: learned.confidence,
    forceAmbiguous: true,
  });

  return {
    ...final,
    trace: buildTrace({
      rawText,
      decision: "heuristic_vs_learning_ambiguous",
      heuristic,
      learningGroupId: learned.groupId,
      learningType: learnedType,
      learningConfidence: learned.confidence,
      learningReason: learned.reason ?? null,
      candidates: candidateGroups,
      final,
    }),
  };
}

function canonicalToLegacyConfidence(
  canonical: CanonicalGroupSuggestion,
): number {
  const trace = canonical.trace;

  if (!trace) {
    return canonical.mode === "none" ? 0 : 0.3;
  }

  if (
    trace.decision === "learning_only" ||
    trace.decision === "learning_override"
  ) {
    return clampUnit(trace.learning.confidence);
  }

  if (
    trace.decision === "heuristic_only" ||
    trace.decision === "heuristic_conflict_learning_ignored" ||
    trace.decision === "heuristic_kept_learning_weak"
  ) {
    return clampScore(trace.heuristic.score);
  }

  if (trace.decision === "heuristic_and_learning_agree") {
    return Math.max(
      clampScore(trace.heuristic.score),
      clampUnit(trace.learning.confidence),
    );
  }

  if (trace.decision === "heuristic_vs_learning_ambiguous") {
    if (trace.heuristic.strongMatch) {
      return clampScore(trace.heuristic.score);
    }
    return Math.min(clampUnit(trace.learning.confidence), 0.3);
  }

  if (
    trace.decision === "empty_input" ||
    trace.decision === "no_signals_or_candidates" ||
    trace.decision === "no_profiles" ||
    trace.decision === "learning_below_threshold" ||
    trace.decision === "learning_group_not_found"
  ) {
    if (trace.heuristic.score > 0) return clampScore(trace.heuristic.score);
    return canonical.mode === "none" ? 0 : 0.3;
  }

  return canonical.mode === "none" ? 0 : 0.3;
}

/**
 * Compat layer:
 * mantiene la firma vieja para no romper Summary / Details hoy.
 * Internamente ya usa la decisión canónica nueva.
 *
 * Importante:
 * preserva lo mejor posible la escala legacy híbrida:
 * - heurística -> score entero (1, 2, 3...)
 * - learning -> confidence 0..1
 */
export function suggestGroupWithLearning(
  input: SuggestGroupFromLearningInput,
): GroupSuggestion {
  const canonical = suggestCanonicalGroupWithLearning(input);

  const legacyReason =
    canonical.mode === "auto_apply"
      ? `${canonical.reason} | auto_apply`
      : canonical.mode === "suggest_only"
        ? `${canonical.reason} | suggest_only`
        : canonical.mode === "ambiguous"
          ? `${canonical.reason} | ambiguous`
          : canonical.reason;

  return {
    type: canonical.type,
    confidence: canonicalToLegacyConfidence(canonical),
    reason: legacyReason,
    trace: canonical.trace,
  };
}