// src/lib/timeSuggestions.ts

type Suggestion = {
  date: Date;
  label: string;
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSlotFree(events: any[], start: Date, durationMinutes = 60) {
  const end = new Date(start.getTime() + durationMinutes * 60000);

  return !events.some((e) => {
    const evStart = new Date(e.start);
    const evEnd = new Date(e.end);

    return start < evEnd && end > evStart;
  });
}

function buildLabel(date: Date) {
  return date.toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getSuggestedTimeSlots(
  events: any[],
  groupType: "personal" | "pair" | "family" | "other"
): Suggestion[] {
  const now = new Date();

  let hours: number[] = [];

  // 🔥 lógica producto
  if (groupType === "pair") {
    hours = [19, 20, 21]; // noche
  } else if (groupType === "family") {
    hours = [13, 14, 18]; // almuerzo/tarde
  } else {
    hours = [9, 13, 19]; // general
  }

  const suggestions: Suggestion[] = [];

  for (let d = 1; d <= 5; d++) {
    const day = addDays(now, d);

    for (const h of hours) {
      const slot = new Date(day);
      slot.setHours(h, 0, 0, 0);

      if (isSlotFree(events, slot)) {
        suggestions.push({
          date: slot,
          label: buildLabel(slot),
        });
      }

      if (suggestions.length >= 3) break;
    }

    if (suggestions.length >= 3) break;
  }

  return suggestions;
}