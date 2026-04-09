export type ConflictVisibility = {
  total: number;
  hasConflicts: boolean;
  hasUrgent: boolean;
  nextConflictId?: string;
};

export function getConflictVisibility(conflicts: any[]): ConflictVisibility {
  if (!conflicts || conflicts.length === 0) {
    return {
      total: 0,
      hasConflicts: false,
      hasUrgent: false,
    };
  }

  return {
    total: conflicts.length,
    hasConflicts: true,
    hasUrgent: conflicts.length > 0,
    nextConflictId: conflicts[0]?.id,
  };
}