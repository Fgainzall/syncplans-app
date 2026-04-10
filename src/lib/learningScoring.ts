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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(23, Math.trunc(value)));
}

function clampBoost(value: number): number {
  const maxBoost = Math.max(0, Number(LEARNING_CONFIG.MAX_BOOST ?? 0.35));
  if (!Number.isFinite(value)) return 0;
  return Math.max(-maxBoost, Math.min(maxBoost, value));
}

function buildReason(
  hour: number,
  rawHourScore: number,
  confidence: number,
  boost: number,
): string {
  const direction =
    boost > 0 ? "favored" : boost < 0 ? "avoided" : "neutral";

  return [
    `hour=${hour}`,
    `profile_score=${rawHourScore.toFixed(4)}`,
    `confidence=${confidence.toFixed(4)}`,
    `direction=${direction}`,
    `boost=${boost.toFixed(4)}`,
  ].join(" | ");
}

export function computeLearningScoreForHour(
  options: ComputeLearningScoreOptions,
): LearningScoreResult {
  const profile = options.profile ?? null;
  const hour = clampHour(options.hour);

  if (!profile || !Array.isArray(profile.slots) || profile.slots.length === 0) {
    return {
      boost: 0,
      confidence: 0,
      reason: `hour=${hour} | no_profile`,
    };
  }

  const rawHourScore = getProfileHourScore(profile, hour);
  const confidence = clamp01(profile.confidence);

  if (confidence <= 0) {
    return {
      boost: 0,
      confidence: 0,
      reason: `hour=${hour} | no_confidence`,
    };
  }

  const scaledBoost = clampBoost(rawHourScore * confidence);

  return {
    boost: scaledBoost,
    confidence,
    reason: buildReason(hour, rawHourScore, confidence, scaledBoost),
  };
}

export function mergeBaseScoreWithLearning(
  options: MergeLearningScoreOptions,
): number {
  const baseScore = Number(options.baseScore ?? 0);
  const learning = options.learning ?? null;

  if (!learning) return baseScore;
  if (!Number.isFinite(baseScore)) return learning.boost;

  return baseScore + clampBoost(learning.boost);
}

export function scoreHourWithLearning(
  hour: number,
  profile?: LearnedTimeProfile | null,
  baseScore = 0,
): {
  finalScore: number;
  learning: LearningScoreResult;
} {
  const learning = computeLearningScoreForHour({
    hour,
    profile,
    baseScore,
  });

  return {
    finalScore: mergeBaseScoreWithLearning({
      baseScore,
      learning,
    }),
    learning,
  };
}