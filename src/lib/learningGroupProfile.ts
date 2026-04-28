// src/lib/learningGroupProfile.tsx

import type { LearningSignal } from "@/lib/learningTypes";

export type LearnedGroupIntentStats = {
  intentKey: string;
  accepted: number;
  adjusted: number;
  declined: number;
  created: number;
  total: number;
  successRate: number;
};

export type LearnedGroupDecisionProfile = {
  groupId: string;
  intents: LearnedGroupIntentStats[];
  totalSignals: number;
  lastUpdatedAt: string;
};

export type LearnedBestGroupMatch = {
  groupId: string | null;
  confidence: number;
  reason: string;
};

type BuildLearnedGroupDecisionProfileOptions = {
  groupId: string;
};

type PickBestGroupFromLearningInput = {
  rawText: string;
  profiles: LearnedGroupDecisionProfile[];
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
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeIso(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function detectIntentKey(rawText: string): string {
  const text = ` ${normalizeText(rawText)} `;

  if (
    text.includes(" desayuno ") ||
    text.includes(" desayunar ") ||
    text.includes(" breakfast ")
  ) {
    return "breakfast";
  }

  if (
    text.includes(" almuerzo ") ||
    text.includes(" almorzar ") ||
    text.includes(" lunch ")
  ) {
    return "lunch";
  }

  if (
    text.includes(" cena ") ||
    text.includes(" cenar ") ||
    text.includes(" dinner ")
  ) {
    return "dinner";
  }

  if (
    text.includes(" cafe ") ||
    text.includes(" cafecito ") ||
    text.includes(" coffee ")
  ) {
    return "coffee";
  }

  if (
    text.includes(" fulbito ") ||
    text.includes(" futbol ") ||
    text.includes(" padel ") ||
    text.includes(" tenis ") ||
    text.includes(" gym ") ||
    text.includes(" deporte ") ||
    text.includes(" entrenamiento ")
  ) {
    return "sports";
  }

  if (
    text.includes(" medico ") ||
    text.includes(" doctor ") ||
    text.includes(" dentista ") ||
    text.includes(" cita medica ")
  ) {
    return "medical";
  }

  if (
    text.includes(" reunion ") ||
    text.includes(" meeting ") ||
    text.includes(" llamada ") ||
    text.includes(" zoom ") ||
    text.includes(" trabajo ")
  ) {
    return "meeting";
  }

  if (
    text.includes(" cumple ") ||
    text.includes(" cumpleanos ") ||
    text.includes(" aniversario ") ||
    text.includes(" celebracion ")
  ) {
    return "celebration";
  }

  if (
    text.includes(" compras ") ||
    text.includes(" banco ") ||
    text.includes(" tramite ") ||
    text.includes(" recoger ") ||
    text.includes(" llevar ")
  ) {
    return "errand";
  }

  return "generic";
}

function detectKeywordIntentHints(rawText: string): string[] {
  const text = normalizeText(rawText);
  const hints: string[] = [];

  if (PAIR_KEYWORDS.some((keyword) => text.includes(normalizeText(keyword)))) {
    hints.push("pair_like");
  }

  if (FAMILY_KEYWORDS.some((keyword) => text.includes(normalizeText(keyword)))) {
    hints.push("family_like");
  }

  if (OTHER_KEYWORDS.some((keyword) => text.includes(normalizeText(keyword)))) {
    hints.push("other_like");
  }

  return hints;
}

function isAcceptedSignal(signal: LearningSignal): boolean {
  return signal.type === "proposal_accepted" || signal.type === "event_accepted";
}

function isAdjustedSignal(signal: LearningSignal): boolean {
  return (
    signal.type === "proposal_adjusted" ||
    signal.type === "conflict_resolved" ||
    signal.type === "conflict_auto_adjusted"
  );
}

function isDeclinedSignal(signal: LearningSignal): boolean {
  return signal.type === "event_declined";
}

function isCreatedSignal(signal: LearningSignal): boolean {
  return signal.type === "event_created";
}

function extractSignalIntentKey(signal: LearningSignal): string {
  const title = String(signal.title ?? "").trim();
  return detectIntentKey(title);
}

function buildIntentScore(stat: LearnedGroupIntentStats): number {
  if (stat.total <= 0) return 0;

  const positive = stat.accepted * 1 + stat.adjusted * 0.65 + stat.created * 0.1;
  const negative = stat.declined * 1;

  return (positive - negative) / stat.total;
}

function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(4));
}

export function buildLearnedGroupDecisionProfile(
  signals: LearningSignal[],
  options: BuildLearnedGroupDecisionProfileOptions,
): LearnedGroupDecisionProfile | null {
  const groupId = String(options.groupId ?? "").trim();
  if (!groupId) return null;

  const groupSignals = signals.filter(
    (signal) => String(signal.groupId ?? "").trim() === groupId,
  );

  const statsMap = new Map<string, LearnedGroupIntentStats>();

  for (const signal of groupSignals) {
    const intentKey = extractSignalIntentKey(signal);
    const current =
      statsMap.get(intentKey) ??
      {
        intentKey,
        accepted: 0,
        adjusted: 0,
        declined: 0,
        created: 0,
        total: 0,
        successRate: 0,
      };

    if (isAcceptedSignal(signal)) current.accepted += 1;
    else if (isAdjustedSignal(signal)) current.adjusted += 1;
    else if (isDeclinedSignal(signal)) current.declined += 1;
    else if (isCreatedSignal(signal)) current.created += 1;

    current.total += 1;
    statsMap.set(intentKey, current);
  }

  const intents = Array.from(statsMap.values())
    .map((stat) => {
      const outcomes = stat.accepted + stat.adjusted + stat.declined;
      const successRate =
        outcomes > 0 ? (stat.accepted + stat.adjusted * 0.5) / outcomes : 0;

      return {
        ...stat,
        accepted: round4(stat.accepted),
        adjusted: round4(stat.adjusted),
        declined: round4(stat.declined),
        created: round4(stat.created),
        total: round4(stat.total),
        successRate: round4(successRate),
      };
    })
    .sort((a, b) => buildIntentScore(b) - buildIntentScore(a));

  const lastUpdatedAt =
    groupSignals
      .map((signal) => safeIso(signal.createdAt))
      .filter(Boolean)
      .sort()
      .at(-1) || new Date().toISOString();

  return {
    groupId,
    intents,
    totalSignals: groupSignals.length,
    lastUpdatedAt,
  };
}

export function getBestGroupFromLearning(
  input: PickBestGroupFromLearningInput,
): LearnedBestGroupMatch {
  const rawText = String(input.rawText ?? "").trim();
  const profiles = Array.isArray(input.profiles) ? input.profiles : [];

  if (!rawText || profiles.length === 0) {
    return {
      groupId: null,
      confidence: 0,
      reason: "no_learning_match",
    };
  }

  const intentKey = detectIntentKey(rawText);
  const keywordHints = detectKeywordIntentHints(rawText);

  const ranked = profiles
    .map((profile) => {
      const stat = profile.intents.find((item) => item.intentKey === intentKey);
      if (!stat) {
        return {
          groupId: profile.groupId,
          score: 0,
          confidence: 0,
          reason: `no_stat_for_${intentKey}`,
        };
      }

      let score = buildIntentScore(stat);
      const confidence = Math.min(1, stat.total / 4);

      if (keywordHints.includes("pair_like") && intentKey === "dinner") {
        score += 0.12;
      }
      if (keywordHints.includes("family_like") && intentKey === "lunch") {
        score += 0.12;
      }
      if (keywordHints.includes("other_like") && intentKey === "sports") {
        score += 0.12;
      }

      return {
        groupId: profile.groupId,
        score,
        confidence,
        reason: `intent=${intentKey} total=${stat.total} success=${stat.successRate}`,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];

  if (!best || best.score <= 0) {
    return {
      groupId: null,
      confidence: 0,
      reason: "learning_not_strong_enough",
    };
  }

  const gap = second ? best.score - second.score : best.score;
  const finalConfidence = Math.max(0, Math.min(1, best.confidence * Math.max(0.35, gap + 0.35)));

  if (finalConfidence < 0.2) {
    return {
      groupId: null,
      confidence: finalConfidence,
      reason: `weak_learning_gap | ${best.reason}`,
    };
  }

  return {
    groupId: best.groupId,
    confidence: round4(finalConfidence),
    reason: `learning_match | ${best.reason}`,
  };
}