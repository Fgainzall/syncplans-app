// src/lib/learningScoring.tsx

import type {
  LearnedTimeProfile,
  LearningScoreResult,
} from "@/lib/learningTypes";
import { LEARNING_CONFIG } from "@/lib/learningTypes";
import { getProfileHourScore } from "@/lib/learningProfile";

export type ComputeLearningScoreOptions = {
  hour: number;
  profile?: LearnedTimeProfile | null;
  baseScore?: number;
};

export type MergeLearningScoreOptions = {
  baseScore: number;
  learning?: LearningScoreResult | null;
};

export type LearningScoreDirection = "favored" | "avoided" | "neutral";

export type LearningScoreBreakdown = {
  hour: number;
  baseScore: number;
  rawHourScore: number;
  confidence: number;
  unclampedBoost: number;
  appliedBoost: number;
  finalScore: number;
  direction: LearningScoreDirection;
  profileAvailable: boolean;
  reasonCode:
    | "no_profile"
    | "no_confidence"
    | "profile_hour_evaluated";
  reasonText: string;
};

export type LearningScoreWithBreakdown = {
  finalScore: number;
  learning: LearningScoreResult;
  breakdown: LearningScoreBreakdown;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(23, Math.trunc(value)));
}

function clampFiniteNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clampBoost(value: number): number {
  const maxBoost = Math.max(0, Number(LEARNING_CONFIG.MAX_BOOST ?? 0.35));
  if (!Number.isFinite(value)) return 0;
  return Math.max(-maxBoost, Math.min(maxBoost, value));
}

function resolveDirection(boost: number): LearningScoreDirection {
  if (boost > 0) return "favored";
  if (boost < 0) return "avoided";
  return "neutral";
}

function buildReason(
  hour: number,
  rawHourScore: number,
  confidence: number,
  boost: number,
): string {
  const direction = resolveDirection(boost);

  return [
    `hour=${hour}`,
    `profile_score=${rawHourScore.toFixed(4)}`,
    `confidence=${confidence.toFixed(4)}`,
    `direction=${direction}`,
    `boost=${boost.toFixed(4)}`,
  ].join(" | ");
}

function buildBreakdown(params: {
  hour: number;
  baseScore: number;
  rawHourScore: number;
  confidence: number;
  unclampedBoost: number;
  appliedBoost: number;
  profileAvailable: boolean;
  reasonCode: LearningScoreBreakdown["reasonCode"];
  reasonText: string;
}): LearningScoreBreakdown {
  const baseScore = clampFiniteNumber(params.baseScore, 0);
  const appliedBoost = clampBoost(params.appliedBoost);
  const finalScore = baseScore + appliedBoost;

  return {
    hour: clampHour(params.hour),
    baseScore,
    rawHourScore: clampFiniteNumber(params.rawHourScore, 0),
    confidence: clamp01(params.confidence),
    unclampedBoost: clampFiniteNumber(params.unclampedBoost, 0),
    appliedBoost,
    finalScore,
    direction: resolveDirection(appliedBoost),
    profileAvailable: Boolean(params.profileAvailable),
    reasonCode: params.reasonCode,
    reasonText: params.reasonText,
  };
}

export function computeLearningScoreBreakdownForHour(
  options: ComputeLearningScoreOptions,
): LearningScoreBreakdown {
  const profile = options.profile ?? null;
  const hour = clampHour(options.hour);
  const baseScore = clampFiniteNumber(options.baseScore, 0);

  if (!profile || !Array.isArray(profile.slots) || profile.slots.length === 0) {
    return buildBreakdown({
      hour,
      baseScore,
      rawHourScore: 0,
      confidence: 0,
      unclampedBoost: 0,
      appliedBoost: 0,
      profileAvailable: false,
      reasonCode: "no_profile",
      reasonText: `hour=${hour} | no_profile`,
    });
  }

  const rawHourScore = clampFiniteNumber(getProfileHourScore(profile, hour), 0);
  const confidence = clamp01(profile.confidence);

  if (confidence <= 0) {
    return buildBreakdown({
      hour,
      baseScore,
      rawHourScore,
      confidence: 0,
      unclampedBoost: 0,
      appliedBoost: 0,
      profileAvailable: true,
      reasonCode: "no_confidence",
      reasonText: `hour=${hour} | no_confidence`,
    });
  }

  const unclampedBoost = rawHourScore * confidence;
  const appliedBoost = clampBoost(unclampedBoost);

  return buildBreakdown({
    hour,
    baseScore,
    rawHourScore,
    confidence,
    unclampedBoost,
    appliedBoost,
    profileAvailable: true,
    reasonCode: "profile_hour_evaluated",
    reasonText: buildReason(hour, rawHourScore, confidence, appliedBoost),
  });
}

export function computeLearningScoreForHour(
  options: ComputeLearningScoreOptions,
): LearningScoreResult {
  const breakdown = computeLearningScoreBreakdownForHour(options);

  return {
    boost: breakdown.appliedBoost,
    confidence: breakdown.confidence,
    reason: breakdown.reasonText,
  };
}

export function mergeBaseScoreWithLearning(
  options: MergeLearningScoreOptions,
): number {
  const baseScore = Number(options.baseScore ?? 0);
  const learning = options.learning ?? null;

  if (!learning) return baseScore;
  if (!Number.isFinite(baseScore)) return clampBoost(learning.boost);

  return baseScore + clampBoost(learning.boost);
}

export function mergeBaseScoreWithLearningBreakdown(
  options: MergeLearningScoreOptions,
): LearningScoreBreakdown {
  const baseScore = clampFiniteNumber(options.baseScore, 0);
  const learning = options.learning ?? null;

  if (!learning) {
    return buildBreakdown({
      hour: 0,
      baseScore,
      rawHourScore: 0,
      confidence: 0,
      unclampedBoost: 0,
      appliedBoost: 0,
      profileAvailable: false,
      reasonCode: "no_profile",
      reasonText: "merge_only | no_learning_payload",
    });
  }

  const appliedBoost = clampBoost(learning.boost);

  return buildBreakdown({
    hour: 0,
    baseScore,
    rawHourScore: 0,
    confidence: clamp01(learning.confidence),
    unclampedBoost: clampFiniteNumber(learning.boost, 0),
    appliedBoost,
    profileAvailable: true,
    reasonCode: "profile_hour_evaluated",
    reasonText: String(learning.reason ?? "").trim() || "merge_only | learning_payload",
  });
}

export function scoreHourWithLearning(
  hour: number,
  profile?: LearnedTimeProfile | null,
  baseScore = 0,
): LearningScoreWithBreakdown {
  const breakdown = computeLearningScoreBreakdownForHour({
    hour,
    profile,
    baseScore,
  });

  const learning: LearningScoreResult = {
    boost: breakdown.appliedBoost,
    confidence: breakdown.confidence,
    reason: breakdown.reasonText,
  };

  return {
    finalScore: breakdown.finalScore,
    learning,
    breakdown,
  };
}