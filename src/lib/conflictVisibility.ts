export type ConflictVisibility = {
  total: number;
  hasConflicts: boolean;
  hasUrgent: boolean;
  nextConflictId?: string;
};

type ConflictVisibilityItem = {
  id?: string | number | null;
};

export function getConflictVisibility(
  conflicts: ConflictVisibilityItem[]
): ConflictVisibility {
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
    nextConflictId:
  conflicts[0]?.id === null || conflicts[0]?.id === undefined
    ? undefined
    : String(conflicts[0].id),
  };
}