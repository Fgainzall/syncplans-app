// src/lib/learningTypes.ts

/* ============================================================
   FASE 3 — LEARNING TYPES (contratos canónicos)
   ============================================================ */

/* ------------------------------------------------------------
   Scope del aprendizaje
   ------------------------------------------------------------ */

export type LearningScope = "user" | "group";

/* ------------------------------------------------------------
   Tipos de señal (EVENTOS REALES DEL SISTEMA)
   ------------------------------------------------------------ */

export type LearningSignalType =
  | "event_created"
  | "event_accepted"
  | "event_declined"
  | "proposal_accepted"
  | "proposal_adjusted"
  | "proposal_pending"
  | "conflict_resolved"
  | "conflict_auto_adjusted";

/* ------------------------------------------------------------
   Señal base de aprendizaje
   ------------------------------------------------------------ */

export type LearningSignal = {
  type: LearningSignalType;

  userId?: string;
  groupId?: string;

  /* Tiempo del evento */
  start: string; // ISO
  end: string;   // ISO

  /* Metadata contextual */
  groupType?: "personal" | "pair" | "family" | "other" | string;
  title?: string | null;

  /* Intensidad o peso base */
  weight?: number;

  /* Momento de la señal */
  createdAt: string; // ISO
};

/* ------------------------------------------------------------
   Perfil aprendido por franja horaria
   ------------------------------------------------------------ */

export type LearnedTimeSlot = {
  hour: number; // 0–23
  accepted: number;
  adjusted: number;
  declined: number;
  score: number; // score final calculado
};

/* ------------------------------------------------------------
   Perfil aprendido agregado
   ------------------------------------------------------------ */

export type LearnedTimeProfile = {
  scope: LearningScope;

  userId?: string;
  groupId?: string;

  slots: LearnedTimeSlot[];

  totalSignals: number;

  confidence: number; // 0–1 basado en volumen real

  lastUpdatedAt: string;
};

/* ------------------------------------------------------------
   Perfil aprendido por grupo (comportamiento colectivo)
   ------------------------------------------------------------ */

export type LearnedGroupProfile = {
  groupId: string;

  preferredHours: number[];
  avoidedHours: number[];

  avgDurationMinutes: number;

  acceptanceRate: number;
  adjustmentRate: number;
  declineRate: number;

  sampleSize: number;

  lastUpdatedAt: string;
};

/* ------------------------------------------------------------
   Resultado de scoring aprendido
   ------------------------------------------------------------ */

export type LearningScoreResult = {
  boost: number;         // cuánto suma/resta al score base
  confidence: number;    // qué tan confiable es ese boost
  reason?: string;       // debug / trazabilidad
};

/* ------------------------------------------------------------
   Configuración base (para evitar magia)
   ------------------------------------------------------------ */

export const LEARNING_CONFIG = {
  MIN_SIGNALS_FOR_CONFIDENCE: 5,
  MAX_BOOST: 0.35, // nunca dominar heurística base
  DECAY_DAYS: 30,  // peso decrece con el tiempo
};