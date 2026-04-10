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

function normalizeText(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function normalizeSuggestedType(value: string | null | undefined): "pair" | "family" | "other" | null {
  const raw = String(value ?? "").trim().toLowerCase();

  if (raw === "pair") return "pair";
  if (raw === "family") return "family";
  if (raw === "other") return "other";
  if (raw === "shared") return "other";

  return null;
}

export function suggestGroupFromText(
  title: string,
  notes?: string
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
  const candidateGroups = Array.isArray(input.candidateGroups)
    ? input.candidateGroups
    : [];

  if (!rawText || signals.length === 0 || candidateGroups.length === 0) {
    return heuristic;
  }

  const profiles: LearnedGroupDecisionProfile[] = candidateGroups
    .map((group) =>
      buildLearnedGroupDecisionProfile(signals, {
        groupId: String(group.id ?? "").trim(),
      }),
    )
    .filter(
      (profile): profile is LearnedGroupDecisionProfile => profile !== null,
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

  const matchedGroup = candidateGroups.find(
    (group) => String(group.id ?? "").trim() === learned.groupId,
  );

  const learnedType = normalizeSuggestedType(matchedGroup?.type);

  if (!learnedType) {
    return heuristic;
  }

  if (!heuristic.type) {
    return {
      type: learnedType,
      confidence: learned.confidence,
      reason: learned.reason,
    };
  }

  if (heuristic.type === learnedType) {
    return {
      type: heuristic.type,
      confidence: Math.max(heuristic.confidence, learned.confidence),
      reason: `${heuristic.reason ?? "heuristic"} + ${learned.reason}`,
    };
  }

  if (learned.confidence >= 0.55 && learned.confidence > heuristic.confidence) {
    return {
      type: learnedType,
      confidence: learned.confidence,
      reason: learned.reason,
    };
  }

  return heuristic;
}