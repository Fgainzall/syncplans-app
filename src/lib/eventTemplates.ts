export type EventTemplate = {
  id: string;
  title: string;
  emoji: string;
  defaultDurationMinutes: number;
  defaultNotes?: string;
  suggestedGroupType?: "personal" | "pair" | "family" | "shared";
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "dinner",
    title: "Cena",
    emoji: "🍷",
    defaultDurationMinutes: 120,
    defaultNotes: "Plan compartido",
    suggestedGroupType: "pair",
  },
  {
    id: "lunch",
    title: "Almuerzo",
    emoji: "🍽️",
    defaultDurationMinutes: 90,
    suggestedGroupType: "shared",
  },
  {
    id: "padel",
    title: "Pádel",
    emoji: "🎾",
    defaultDurationMinutes: 90,
    suggestedGroupType: "shared",
  },
  {
    id: "meeting",
    title: "Reunión",
    emoji: "👥",
    defaultDurationMinutes: 60,
    suggestedGroupType: "shared",
  },
  {
    id: "doctor",
    title: "Cita médica",
    emoji: "🩺",
    defaultDurationMinutes: 45,
    suggestedGroupType: "personal",
  },
  {
    id: "trip",
    title: "Viaje",
    emoji: "✈️",
    defaultDurationMinutes: 180,
    suggestedGroupType: "family",
  },
];