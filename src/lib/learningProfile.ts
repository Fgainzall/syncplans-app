// src/lib/learningProfile.tsx

import type {
  LearnedGroupProfile,
  LearnedTimeProfile,
  LearnedTimeSlot,
  LearningScope,
  LearningSignal,
} from "@/lib/learningTypes";
import { LEARNING_CONFIG } from "@/lib/learningTypes";

export type BuildLearnedTimeProfileOptions = {
  scope: LearningScope;
  userId?: string;
  groupId?: string;
};

export type BuildLearnedGroupProfileOptions = {
  groupId: string;
};

type HourBucket = {
  hour: number;
  accepted: number;
  adjusted: number;
  declined: number;
  pending: number;
  created: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function safeIso(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function diffMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return Math.round((end - start) / 60000);
}

function getHourFromIso(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getHours();
}

function createEmptyHourBuckets(): HourBucket[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    accepted: 0,
    adjusted: 0,
    declined: 0,
    pending: 0,
    created: 0,
  }));
}

function normalizeWeight(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.1, Math.min(2, Number(value)));
}

function getSignalRecencyMultiplier(
  createdAtIso: string,
  nowIso: string,
): number {
  const created = new Date(createdAtIso).getTime();
  const now = new Date(nowIso).getTime();

  if (!Number.isFinite(created) || !Number.isFinite(now)) return 1;
  if (created > now) return 1;

  const ageDays = Math.max(0, (now - created) / 86400000);
  const decayDays = Math.max(1, LEARNING_CONFIG.DECAY_DAYS);

  return 1 / (1 + ageDays / decayDays);
}

function isAcceptedSignal(signal: LearningSignal): boolean {
  return (
    signal.type === "proposal_accepted" ||
    signal.type === "event_accepted"
  );
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

function isPendingSignal(signal: LearningSignal): boolean {
  return signal.type === "proposal_pending";
}

function isCreatedSignal(signal: LearningSignal): boolean {
  return signal.type === "event_created";
}

function filterSignalsForScope(
  signals: LearningSignal[],
  options: BuildLearnedTimeProfileOptions,
): LearningSignal[] {
  if (options.scope === "user") {
    const userId = String(options.userId ?? "").trim();
    if (!userId) return [];
    return signals.filter((signal) => String(signal.userId ?? "").trim() === userId);
  }

  const groupId = String(options.groupId ?? "").trim();
  if (!groupId) return [];

  return signals.filter((signal) => String(signal.groupId ?? "").trim() === groupId);
}

function computeSlotScore(bucket: HourBucket): number {
  const positive =
    bucket.accepted * 1 +
    bucket.adjusted * 0.5 +
    bucket.created * 0.15;

  const negative =
    bucket.declined * 1 +
    bucket.pending * 0.2;

  const total =
    bucket.accepted +
    bucket.adjusted +
    bucket.declined +
    bucket.pending +
    bucket.created;

  if (total <= 0) return 0;

  return (positive - negative) / total;
}

function convertBucketsToSlots(buckets: HourBucket[]): LearnedTimeSlot[] {
  return buckets.map((bucket) => ({
    hour: bucket.hour,
    accepted: Number(bucket.accepted.toFixed(3)),
    adjusted: Number(bucket.adjusted.toFixed(3)),
    declined: Number(bucket.declined.toFixed(3)),
    score: Number(computeSlotScore(bucket).toFixed(4)),
  }));
}

function extractLastUpdatedAt(signals: LearningSignal[], fallbackIso: string): string {
  const sorted = [...signals].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return safeIso(sorted[0]?.createdAt) || fallbackIso;
}

function buildConfidence(totalSignals: number): number {
  const minSignals = Math.max(1, LEARNING_CONFIG.MIN_SIGNALS_FOR_CONFIDENCE);
  return clamp01(totalSignals / minSignals);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildLearnedTimeProfile(
  signals: LearningSignal[],
  options: BuildLearnedTimeProfileOptions,
): LearnedTimeProfile {
  const nowIso = new Date().toISOString();
  const scopedSignals = filterSignalsForScope(signals, options).filter(
    (signal) => safeIso(signal.start) && safeIso(signal.end) && safeIso(signal.createdAt),
  );

  const buckets = createEmptyHourBuckets();

  for (const signal of scopedSignals) {
    const hour = getHourFromIso(signal.start);
    const bucket = buckets[hour];
    if (!bucket) continue;

    const recency = getSignalRecencyMultiplier(signal.createdAt, nowIso);
    const weight = normalizeWeight(signal.weight) * recency;

    if (isAcceptedSignal(signal)) {
      bucket.accepted += weight;
      continue;
    }

    if (isAdjustedSignal(signal)) {
      bucket.adjusted += weight;
      continue;
    }

    if (isDeclinedSignal(signal)) {
      bucket.declined += weight;
      continue;
    }

    if (isPendingSignal(signal)) {
      bucket.pending += weight;
      continue;
    }

    if (isCreatedSignal(signal)) {
      bucket.created += weight;
    }
  }

  return {
    scope: options.scope,
    userId: options.scope === "user" ? String(options.userId ?? "").trim() || undefined : undefined,
    groupId: options.scope === "group" ? String(options.groupId ?? "").trim() || undefined : undefined,
    slots: convertBucketsToSlots(buckets),
    totalSignals: scopedSignals.length,
    confidence: buildConfidence(scopedSignals.length),
    lastUpdatedAt: extractLastUpdatedAt(scopedSignals, nowIso),
  };
}

export function buildLearnedGroupProfile(
  signals: LearningSignal[],
  options: BuildLearnedGroupProfileOptions,
): LearnedGroupProfile | null {
  const groupId = String(options.groupId ?? "").trim();
  if (!groupId) return null;

  const groupSignals = signals.filter(
    (signal) =>
      String(signal.groupId ?? "").trim() === groupId &&
      safeIso(signal.start) &&
      safeIso(signal.end) &&
      safeIso(signal.createdAt),
  );

  if (groupSignals.length === 0) {
    return {
      groupId,
      preferredHours: [],
      avoidedHours: [],
      avgDurationMinutes: 0,
      acceptanceRate: 0,
      adjustmentRate: 0,
      declineRate: 0,
      sampleSize: 0,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  const timeProfile = buildLearnedTimeProfile(groupSignals, {
    scope: "group",
    groupId,
  });

  const preferredHours = timeProfile.slots
    .filter((slot) => slot.score >= 0.35 && slot.accepted >= slot.declined)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((slot) => slot.hour);

  const avoidedHours = timeProfile.slots
    .filter((slot) => slot.score <= -0.2 || slot.declined > slot.accepted + slot.adjusted)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((slot) => slot.hour);

  const acceptedCount = groupSignals.filter(isAcceptedSignal).length;
  const adjustedCount = groupSignals.filter(isAdjustedSignal).length;
  const declinedCount = groupSignals.filter(isDeclinedSignal).length;

  const outcomeSignals = acceptedCount + adjustedCount + declinedCount;

  const durations = groupSignals
    .filter((signal) => isAcceptedSignal(signal) || isAdjustedSignal(signal) || isCreatedSignal(signal))
    .map((signal) => diffMinutes(signal.start, signal.end))
    .filter((value) => value > 0);

  return {
    groupId,
    preferredHours,
    avoidedHours,
    avgDurationMinutes: Math.round(average(durations)),
    acceptanceRate: outcomeSignals > 0 ? Number((acceptedCount / outcomeSignals).toFixed(4)) : 0,
    adjustmentRate: outcomeSignals > 0 ? Number((adjustedCount / outcomeSignals).toFixed(4)) : 0,
    declineRate: outcomeSignals > 0 ? Number((declinedCount / outcomeSignals).toFixed(4)) : 0,
    sampleSize: groupSignals.length,
    lastUpdatedAt: timeProfile.lastUpdatedAt,
  };
}

export function getTopPreferredHours(
  profile: LearnedTimeProfile,
  limit = 3,
): number[] {
  return [...(profile?.slots ?? [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .map((slot) => slot.hour);
}

export function getTopAvoidedHours(
  profile: LearnedTimeProfile,
  limit = 3,
): number[] {
  return [...(profile?.slots ?? [])]
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.max(1, limit))
    .map((slot) => slot.hour);
}

export function getProfileHourScore(
  profile: LearnedTimeProfile | null | undefined,
  hour: number,
): number {
  if (!profile || !Array.isArray(profile.slots)) return 0;
  const safeHour = Math.max(0, Math.min(23, Math.trunc(Number(hour))));
  const slot = profile.slots.find((item) => item.hour === safeHour);
  return slot ? slot.score : 0;
}