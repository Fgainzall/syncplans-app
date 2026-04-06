export type GroupSuggestion = {
  type: "pair" | "family" | "other" | null;
  confidence: number;
  reason?: string;
};

const PAIR_KEYWORDS = [
  "cena",
  "salir",
  "date",
  "aniversario",
  "pelicula",
  "cine",
  "comer",
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
];

const OTHER_KEYWORDS = [
  "padel",
  "pádel",
  "futbol",
  "fulbito",
  "amigos",
  "asado",
  "reunion",
];

function score(text: string, keywords: string[]) {
  let hits = 0;
  for (const k of keywords) {
    if (text.includes(k)) hits++;
  }
  return hits;
}

export function suggestGroupFromText(
  title: string,
  notes?: string
): GroupSuggestion {
  const text = `${title} ${notes ?? ""}`.toLowerCase();

  const pairScore = score(text, PAIR_KEYWORDS);
  const familyScore = score(text, FAMILY_KEYWORDS);
  const otherScore = score(text, OTHER_KEYWORDS);

  const max = Math.max(pairScore, familyScore, otherScore);

  if (max === 0) {
    return { type: null, confidence: 0 };
  }

  if (max === pairScore) {
    return {
      type: "pair",
      confidence: pairScore,
      reason: "Parece un plan de pareja",
    };
  }

  if (max === familyScore) {
    return {
      type: "family",
      confidence: familyScore,
      reason: "Parece un plan familiar",
    };
  }

  return {
    type: "other",
    confidence: otherScore,
    reason: "Parece un plan con amigos",
  };
}