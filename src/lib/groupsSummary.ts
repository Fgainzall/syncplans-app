// src/lib/groupsSummary.ts

export type GroupSummary = {
  pair: number;
  family: number;
  shared: number;
  total: number;
};

export type AnyGroupLike = {
  type?: string | null;
};

/**
 * buildGroupsSummary
 *
 * Recibe una lista de grupos (con campo `type`) y devuelve:
 * - cuántos son de pareja
 * - cuántos son de familia
 * - cuántos son "otros" (compartidos, equipos, etc.)
 * - total
 *
 * Regla:
 * - "pair" o "couple" => pareja
 * - "family" => familia
 * - todo lo demás => compartido/otros
 */
export function buildGroupsSummary(groups: AnyGroupLike[]): GroupSummary {
  let pair = 0;
  let family = 0;
  let shared = 0;

  for (const g of groups || []) {
    const t = String(g.type ?? "").toLowerCase();

    if (t === "pair" || t === "couple") {
      pair += 1;
    } else if (t === "family") {
      family += 1;
    } else {
      shared += 1;
    }
  }

  const total = pair + family + shared;

  return { pair, family, shared, total };
}