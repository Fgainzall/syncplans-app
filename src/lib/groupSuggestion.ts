// src/lib/groupSuggestion.ts

import type { LearningSignal } from "@/lib/learningTypes";
import {
  buildLearnedGroupDecisionProfile,
  getBestGroupFromLearning,
} from "@/lib/learningGroupProfile";
import type { LearnedGroupDecisionProfile } from "@/lib/learningGroupProfile";

export type GroupSuggestion = {
  type: "pair" | "family" | "other" | null;
  confidence: number;
  reason?: string;
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
];

const FAMILY_KEYWORDS = [
  "familia",
  "mama",
  "mamá",
  "papa",
  "papá",
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
];

type NormalizedCandidateGroup = {
  id: string;
  type: "pair" | "family" | "other";
};

function normalizeText(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function scoreSuggestion(text: string, keywords: string[]) {
  let hits = 0;
  for (const keyword of keywords) {
    if (text.includes(normalizeText(keyword))) hits += 1;
  }
  return hits;
}

function normalizeSuggestedType(
  value: string | null | undefined,
): "pair" | "family" | "other" | null {
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

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function isStrongHeuristicMatch(suggestion: GroupSuggestion): boolean {
  return Boolean(suggestion.type && suggestion.confidence >= 2);
}

export function suggestGroupFromText(
  title: string,
  notes?: string,
): GroupSuggestion {
  const text = normalizeText(`${title} ${notes ?? ""}`);

  if (!text) return { type: null, confidence: 0 };

  const pairScore = scoreSuggestion(text, PAIR_KEYWORDS);
  const familyScore = scoreSuggestion(text, FAMILY_KEYWORDS);
  const otherScore = scoreSuggestion(text, OTHER_KEYWORDS);

  const max = Math.max(pairScore, familyScore, otherScore);

  if (max === 0) {
    return { type: null, confidence: 0 };
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
    return { type: null, confidence: max };
  }

  return {
    type: leaders[0].type,
    confidence: leaders[0].score,
    reason: leaders[0].reason,
  };
}

export function suggestGroupWithLearning(
  input: SuggestGroupFromLearningInput,
): GroupSuggestion {
  const title = String(input.title ?? "").trim();
  const notes = String(input.notes ?? "").trim();
  const rawText = `${title} ${notes}`.trim();

  const heuristic = suggestGroupFromText(title, notes);
  const signals = Array.isArray(input.signals) ? input.signals : [];
  const candidateGroups = normalizeCandidateGroups(input.candidateGroups);

  if (!rawText || signals.length === 0 || candidateGroups.length === 0) {
    return heuristic;
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
    return heuristic;
  }

  const learned = getBestGroupFromLearning({
    rawText,
    profiles,
  });

  if (!learned.groupId || learned.confidence < 0.2) {
    return heuristic;
  }

  const matchedGroup = candidateGroups.find((group) => group.id === learned.groupId);
  const learnedType = matchedGroup?.type ?? null;

  if (!learnedType) {
    return heuristic;
  }

  if (!heuristic.type) {
    return {
      type: learnedType,
      confidence: clampConfidence(learned.confidence),
      reason: learned.reason,
    };
  }

  if (heuristic.type === learnedType) {
    return {
      type: heuristic.type,
      confidence: clampConfidence(Math.max(heuristic.confidence, learned.confidence)),
      reason: `heuristic_and_learning | ${heuristic.reason ?? "heuristic"} | ${learned.reason}`,
    };
  }

  if (isStrongHeuristicMatch(heuristic) && learned.confidence < 0.7) {
    return {
      ...heuristic,
      reason: `${heuristic.reason ?? "heuristic"} | learning_conflict_ignored`,
    };
  }

  if (learned.confidence >= 0.62 && learned.confidence > heuristic.confidence + 0.1) {
    return {
      type: learnedType,
      confidence: clampConfidence(learned.confidence),
      reason: `learning_override | ${learned.reason}`,
    };
  }

  return {
    ...heuristic,
    reason: `${heuristic.reason ?? "heuristic"} | learning_not_strong_enough_to_override`,
  };
}