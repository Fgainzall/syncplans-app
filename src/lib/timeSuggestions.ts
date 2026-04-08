export type Suggestion = {
  date: Date;
  label: string;
  score: number;
};

export type SuggestionGroupType = "personal" | "pair" | "family" | "other";

type SuggestionIntent =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "coffee"
  | "sports"
  | "medical"
  | "meeting"
  | "celebration"
  | "errand"
  | "generic";

type TemporalSignals = {
  mentionsWeekend: boolean;
  mentionsWeekday: boolean;
  mentionsSpecificWeekendDay: boolean;
  mentionsTwoWeekends: boolean;
  mentionsMorning: boolean;
  mentionsAfternoon: boolean;
  mentionsNight: boolean;
  mentionsToday: boolean;
  mentionsTomorrow: boolean;
  mentionsUrgency: boolean;
  mentionsLooseFuture: boolean;
};

type SocialSignals = {
  mentionsPeople: boolean;
  mentionsPluralGroup: boolean;
  mentionsFamily: boolean;
  mentionsCouple: boolean;
  mentionsFriends: boolean;
  mentionsLocation: boolean;
};

type Flexibility = "low" | "medium" | "high";

type SuggestionProfile = {
  intent: SuggestionIntent;
  temporal: TemporalSignals;
  social: SocialSignals;
  flexibility: Flexibility;
  prefersSoon: boolean;
  prefersWeekend: boolean;
  prefersWeekday: boolean;
  prefersEvening: boolean;
  prefersDaylight: boolean;
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function normalizeText(input: string) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function paddedText(input: string) {
  return ` ${normalizeText(input)} `;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function buildBaseLabel(date: Date) {
  const now = new Date();
  const day = startOfDay(date);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  let prefix = "";

  if (day.getTime() === today.getTime()) {
    prefix = "Hoy · ";
  } else if (day.getTime() === tomorrow.getTime()) {
    prefix = "Mañana · ";
  }

  const formatted = date.toLocaleString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return prefix + formatted;
}

function detectIntent(raw: string): SuggestionIntent {
  const text = paddedText(raw);

  if (
    text.includes(" desayuno ") ||
    text.includes(" desayunar ") ||
    text.includes(" breakfast ")
  ) {
    return "breakfast";
  }

  if (
    text.includes(" almuerzo ") ||
    text.includes(" almorzar ") ||
    text.includes(" lunch ")
  ) {
    return "lunch";
  }

  if (
    text.includes(" cena ") ||
    text.includes(" cenar ") ||
    text.includes(" dinner ")
  ) {
    return "dinner";
  }

  if (
    text.includes(" cafe ") ||
    text.includes(" cafecito ") ||
    text.includes(" coffee ")
  ) {
    return "coffee";
  }

  if (
    text.includes(" fulbito ") ||
    text.includes(" futbol ") ||
    text.includes(" padel ") ||
    text.includes(" tenis ") ||
    text.includes(" gym ") ||
    text.includes(" deporte ") ||
    text.includes(" entrenamiento ")
  ) {
    return "sports";
  }

  if (
    text.includes(" medico ") ||
    text.includes(" doctor ") ||
    text.includes(" dentista ") ||
    text.includes(" cita medica ")
  ) {
    return "medical";
  }

  if (
    text.includes(" reunion ") ||
    text.includes(" meeting ") ||
    text.includes(" llamada ") ||
    text.includes(" zoom ") ||
    text.includes(" trabajo ")
  ) {
    return "meeting";
  }

  if (
    text.includes(" cumple ") ||
    text.includes(" cumpleanos ") ||
    text.includes(" cumpleaños ") ||
    text.includes(" aniversario ") ||
    text.includes(" celebracion ") ||
    text.includes(" celebración ")
  ) {
    return "celebration";
  }

  if (
    text.includes(" compras ") ||
    text.includes(" banco ") ||
    text.includes(" tramite ") ||
    text.includes(" trámite ") ||
    text.includes(" recoger ") ||
    text.includes(" llevar ")
  ) {
    return "errand";
  }

  return "generic";
}

function detectTemporalSignals(raw: string): TemporalSignals {
  const text = paddedText(raw);

  const mentionsWeekend =
    text.includes(" fin de semana ") ||
    text.includes(" finde ") ||
    text.includes(" finde semana ") ||
    text.includes(" sabado ") ||
    text.includes(" domingo ");

  const mentionsWeekday =
    text.includes(" entre semana ") ||
    text.includes(" durante la semana ") ||
    text.includes(" en semana ") ||
    text.includes(" lunes ") ||
    text.includes(" martes ") ||
    text.includes(" miercoles ") ||
    text.includes(" jueves ") ||
    text.includes(" viernes ");

  const mentionsSpecificWeekendDay =
    text.includes(" sabado ") || text.includes(" domingo ");

  const mentionsTwoWeekends =
    text.includes(" dos fines de semana ") ||
    text.includes(" dos findes ") ||
    text.includes(" proximos dos fines ") ||
    text.includes(" proximos dos fines de semana ") ||
    text.includes(" siguientes dos fines ") ||
    text.includes(" en dos fines ");

  const mentionsMorning =
    text.includes(" manana ") ||
    text.includes(" temprano ") ||
    text.includes(" morning ");

  const mentionsAfternoon =
    text.includes(" tarde ") || text.includes(" afternoon ");

  const mentionsNight =
    text.includes(" noche ") ||
    text.includes(" nocturno ") ||
    text.includes(" night ");

  const mentionsToday = text.includes(" hoy ");
  const mentionsTomorrow = text.includes(" manana ");
  const mentionsUrgency =
    text.includes(" urgente ") ||
    text.includes(" antes de ") ||
    text.includes(" si o si ") ||
    text.includes(" sí o sí ") ||
    mentionsToday ||
    mentionsTomorrow;

  const mentionsLooseFuture =
    text.includes(" algun dia ") ||
    text.includes(" algún día ") ||
    text.includes(" uno de estos dias ") ||
    text.includes(" uno de estos días ") ||
    text.includes(" cuando puedan ") ||
    text.includes(" cuando se pueda ") ||
    text.includes(" esta semana ") ||
    text.includes(" el otro finde ");

  return {
    mentionsWeekend,
    mentionsWeekday,
    mentionsSpecificWeekendDay,
    mentionsTwoWeekends,
    mentionsMorning,
    mentionsAfternoon,
    mentionsNight,
    mentionsToday,
    mentionsTomorrow,
    mentionsUrgency,
    mentionsLooseFuture,
  };
}

function detectSocialSignals(raw: string): SocialSignals {
  const text = paddedText(raw);

  const mentionsPeople =
    /\bcon\s+[a-záéíóúñ]+\b/i.test(raw) ||
    text.includes(" juntos ") ||
    text.includes(" juntas ") ||
    text.includes(" con ");

  const mentionsPluralGroup =
    text.includes(" amigos ") ||
    text.includes(" primos ") ||
    text.includes(" tios ") ||
    text.includes(" tíos ") ||
    text.includes(" todos ") ||
    text.includes(" nosotros ") ||
    text.includes(" equipo ") ||
    text.includes(" grupo ");

  const mentionsFamily =
    text.includes(" familia ") ||
    text.includes(" familiar ") ||
    text.includes(" mama ") ||
    text.includes(" mamá ") ||
    text.includes(" papa ") ||
    text.includes(" papá ") ||
    text.includes(" hijos ") ||
    text.includes(" abuelos ");

  const mentionsCouple =
    text.includes(" pareja ") ||
    text.includes(" novia ") ||
    text.includes(" novio ") ||
    text.includes(" esposa ") ||
    text.includes(" esposo ") ||
    text.includes(" aniversario ");

  const mentionsFriends =
    text.includes(" amigos ") ||
    text.includes(" fulbito ") ||
    text.includes(" padel ") ||
    text.includes(" pádel ") ||
    text.includes(" asado ") ||
    text.includes(" previa ") ||
    text.includes(" after ");

  const mentionsLocation =
    text.includes(" en casa de ") ||
    text.includes(" cerca de ") ||
    text.includes(" en ") ||
    text.includes(" por ");

  return {
    mentionsPeople,
    mentionsPluralGroup,
    mentionsFamily,
    mentionsCouple,
    mentionsFriends,
    mentionsLocation,
  };
}

function getFlexibility(
  rawText: string,
  intent: SuggestionIntent,
  temporal: TemporalSignals
): Flexibility {
  const text = paddedText(rawText);

  if (
    temporal.mentionsUrgency ||
    intent === "medical" ||
    intent === "meeting" ||
    /\b(hoy|mañana|manana|antes de|urgente|si o si|sí o sí)\b/.test(text)
  ) {
    return "low";
  }

  if (
    temporal.mentionsLooseFuture ||
    /\b(cuando puedan|algun dia|algún día|esta semana|el otro finde)\b/.test(
      text
    )
  ) {
    return "high";
  }

  return "medium";
}

function buildSuggestionProfile(
  rawText: string,
  groupType: SuggestionGroupType
): SuggestionProfile {
  const intent = detectIntent(rawText);
  const temporal = detectTemporalSignals(rawText);
  const social = detectSocialSignals(rawText);
  const flexibility = getFlexibility(rawText, intent, temporal);

  const prefersWeekend =
    temporal.mentionsWeekend ||
    social.mentionsFamily ||
    social.mentionsFriends ||
    groupType === "family" ||
    (groupType === "other" && intent === "sports");

  const prefersWeekday =
    temporal.mentionsWeekday || intent === "medical" || intent === "meeting";

  const prefersEvening =
    temporal.mentionsNight ||
    intent === "dinner" ||
    intent === "coffee" ||
    (groupType === "pair" && !temporal.mentionsMorning);

  const prefersDaylight =
    temporal.mentionsMorning ||
    intent === "breakfast" ||
    intent === "lunch" ||
    intent === "medical" ||
    intent === "meeting";

  const prefersSoon =
    temporal.mentionsUrgency || flexibility === "low";

  return {
    intent,
    temporal,
    social,
    flexibility,
    prefersSoon,
    prefersWeekend,
    prefersWeekday,
    prefersEvening,
    prefersDaylight,
  };
}

function getCandidateHours(
  profile: SuggestionProfile,
  groupType: SuggestionGroupType
): number[] {
  const { intent, temporal, social } = profile;
  let hours: number[];

  switch (intent) {
    case "breakfast":
      hours = [8, 9, 10];
      break;
    case "lunch":
      hours = [13, 14, 15];
      break;
    case "dinner":
      hours = [19, 20, 21];
      break;
    case "coffee":
      hours = [16, 17, 18];
      break;
    case "sports":
      hours = [18, 19, 20, 21];
      break;
    case "medical":
      hours = [9, 10, 11, 16];
      break;
    case "meeting":
      hours = [9, 11, 16, 17];
      break;
    case "celebration":
      hours = [13, 14, 19, 20];
      break;
    case "errand":
      hours = [10, 11, 16, 17];
      break;
    default:
      if (groupType === "pair") hours = [19, 20, 21];
      else if (groupType === "family") hours = [12, 13, 18, 19];
      else if (groupType === "other") hours = [18, 19, 20];
      else hours = [9, 13, 19];
      break;
  }

  if (social.mentionsFamily && !temporal.mentionsMorning) {
    hours = Array.from(new Set([...hours, 13, 14, 18]));
  }

  if (social.mentionsFriends || groupType === "other") {
    hours = Array.from(new Set([...hours, 19, 20]));
  }

  if (temporal.mentionsMorning) {
    return hours.filter((hour) => hour <= 11);
  }

  if (temporal.mentionsAfternoon) {
    return hours.filter((hour) => hour >= 13 && hour <= 18);
  }

  if (temporal.mentionsNight) {
    return hours.filter((hour) => hour >= 18);
  }

  return hours;
}

function getDurationMinutes(intent: SuggestionIntent) {
  switch (intent) {
    case "dinner":
    case "celebration":
      return 120;
    case "lunch":
    case "breakfast":
    case "sports":
      return 90;
    case "meeting":
    case "medical":
    case "errand":
    case "coffee":
    default:
      return 60;
  }
}

function getDayOffsets(profile: SuggestionProfile): number[] {
  const { intent, temporal, flexibility } = profile;

  if (temporal.mentionsToday) {
    return [0, 1, 2];
  }

  if (temporal.mentionsTomorrow) {
    return [1, 2, 3];
  }

  if (temporal.mentionsTwoWeekends) {
    return Array.from({ length: 14 }, (_, i) => i + 1);
  }

  if (temporal.mentionsWeekend || temporal.mentionsSpecificWeekendDay) {
    return Array.from({ length: 10 }, (_, i) => i + 1);
  }

  if (intent === "medical" || intent === "meeting") {
    return flexibility === "low" ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7];
  }

  if (flexibility === "high") {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }

  return [1, 2, 3, 4, 5, 6, 7];
}

function shouldSkipDay(
  date: Date,
  profile: SuggestionProfile
) {
  const weekend = isWeekend(date);
  const { intent, temporal, prefersWeekday } = profile;

  if (intent === "medical" || intent === "meeting") {
    return weekend;
  }

  if (temporal.mentionsWeekend && !weekend) {
    return true;
  }

  if (temporal.mentionsWeekday && weekend) {
    return true;
  }

  if (prefersWeekday && weekend && profile.flexibility === "low") {
    return true;
  }

  return false;
}

function getEventWindow(event: any) {
  const start = new Date(event?.start);
  const end = new Date(event?.end);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
}

function isSlotFree(events: any[], start: Date, durationMinutes = 60) {
  const end = new Date(start.getTime() + durationMinutes * 60000);

  return !events.some((e) => {
    const window = getEventWindow(e);
    if (!window) return false;

    return start < window.end && end > window.start;
  });
}

function countEventsForDay(events: any[], day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  return events.reduce((count, event) => {
    const window = getEventWindow(event);
    if (!window) return count;

    const overlapsDay = window.start < dayEnd && window.end > dayStart;
    return overlapsDay ? count + 1 : count;
  }, 0);
}

function getNearestGapMinutes(events: any[], slotStart: Date, durationMinutes: number) {
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
  let nearestGap = Number.POSITIVE_INFINITY;

  for (const event of events) {
    const window = getEventWindow(event);
    if (!window) continue;

    const gapBefore =
      Math.abs(slotStart.getTime() - window.end.getTime()) / 60000;
    const gapAfter =
      Math.abs(window.start.getTime() - slotEnd.getTime()) / 60000;

    nearestGap = Math.min(nearestGap, gapBefore, gapAfter);
  }

  return nearestGap;
}

function getHourPreferenceBonus(intent: SuggestionIntent, hour: number) {
  if (intent === "breakfast") {
    if (hour === 9) return 16;
    if (hour === 8) return 12;
    if (hour === 10) return 8;
  }

  if (intent === "lunch") {
    if (hour === 13) return 18;
    if (hour === 14) return 12;
    if (hour === 15) return 4;
  }

  if (intent === "dinner") {
    if (hour === 20) return 18;
    if (hour === 19) return 12;
    if (hour === 21) return 8;
  }

  if (intent === "coffee") {
    if (hour === 17) return 14;
    if (hour === 16) return 10;
    if (hour === 18) return 8;
  }

  if (intent === "sports") {
    if (hour === 19) return 16;
    if (hour === 20) return 12;
    if (hour === 18) return 8;
    if (hour === 21) return 6;
  }

  if (intent === "medical" || intent === "meeting") {
    if (hour === 11) return 14;
    if (hour === 9) return 10;
    if (hour === 16) return 8;
  }

  if (intent === "celebration") {
    if (hour === 20) return 14;
    if (hour === 13) return 12;
  }

  if (intent === "errand") {
    if (hour === 10) return 12;
    if (hour === 11) return 10;
    if (hour === 16) return 8;
  }

  return 0;
}

function getContextualBoost(
  profile: SuggestionProfile,
  groupType: SuggestionGroupType,
  day: Date,
  hour: number,
  rawText: string
) {
  const text = paddedText(rawText);
  const weekend = isWeekend(day);
  const weekday = !weekend;
  let score = 0;

  if (groupType === "family") {
    if (weekend) score += 28;
    else score -= 8;
    if (profile.intent === "lunch") score += 12;
    if (profile.intent === "breakfast" && weekend) score += 8;
    if (hour >= 12 && hour <= 14 && weekend) score += 8;
  }

  if (groupType === "pair") {
    if (profile.intent === "dinner") score += 12;
    if (weekday && (profile.intent === "dinner" || profile.intent === "coffee")) {
      score += 6;
    }
    if (weekend && profile.intent === "dinner") score += 6;
    if (hour >= 19 && hour <= 21) score += 5;
  }

  if (groupType === "other") {
    if (weekend) score += 16;
    if (profile.intent === "sports") score += 12;
    if (profile.social.mentionsFriends && weekend) score += 10;
    if (weekday && profile.intent === "sports") score -= 2;
  }

  if (profile.intent === "breakfast" && weekday) score += 8;
  if (profile.intent === "lunch" && weekend) score += 12;
  if (profile.intent === "dinner" && weekend) score += 6;
  if (profile.intent === "medical" && weekend) score -= 30;
  if (profile.intent === "meeting" && weekend) score -= 24;
  if (profile.intent === "errand" && weekday) score += 10;

  if (profile.temporal.mentionsWeekend) {
    score += weekend ? 30 : -24;
  }

  if (profile.temporal.mentionsWeekday) {
    score += weekday ? 18 : -20;
  }

  if (profile.temporal.mentionsSpecificWeekendDay && weekend) {
    score += 6;
  }

  if (profile.temporal.mentionsTwoWeekends) {
    const today = startOfDay(new Date());
    const diffDays = Math.floor(
      (startOfDay(day).getTime() - today.getTime()) / 86400000
    );

    if (weekend) {
      if (diffDays <= 7) score += 10;
      else if (diffDays <= 14) score += 8;
      else score -= 8;
    }
  }

  if (profile.social.mentionsFamily || text.includes(" familiar ")) {
    if (weekend) score += 10;
    if (profile.intent === "lunch") score += 8;
  }

  if (profile.social.mentionsCouple && hour >= 19) {
    score += 8;
  }

  if (profile.social.mentionsPeople && profile.flexibility === "high") {
    score += 4;
  }

  if (profile.social.mentionsLocation) {
    score += 3;
  }

  return score;
}

function getRecencyPenalty(now: Date, slot: Date, flexibility: Flexibility) {
  const diffMinutes = (slot.getTime() - now.getTime()) / 60000;

  if (flexibility === "low") {
    if (diffMinutes < 120) return 70;
    if (diffMinutes < 240) return 28;
    if (diffMinutes < 480) return 10;
    return 0;
  }

  if (flexibility === "high") {
    if (diffMinutes < 180) return 30;
    if (diffMinutes < 360) return 12;
    return 0;
  }

  if (diffMinutes < 180) return 80;
  if (diffMinutes < 360) return 36;
  if (diffMinutes < 720) return 16;
  return 0;
}

function getDistancePenaltyForExplicitTemporalSignal(
  slot: Date,
  profile: SuggestionProfile
) {
  const signals = profile.temporal;

  if (!(signals.mentionsWeekend || signals.mentionsWeekday || signals.mentionsTwoWeekends)) {
    return 0;
  }

  const today = startOfDay(new Date());
  const diffDays = Math.floor(
    (startOfDay(slot).getTime() - today.getTime()) / 86400000
  );

  if (signals.mentionsTwoWeekends) {
    if (diffDays > 14) return 30;
    if (diffDays > 10) return 12;
    return 0;
  }

  if (profile.flexibility === "low" && diffDays > 7) return 20;
  if (diffDays > 10) return 12;
  return 0;
}

function getPreferenceShapeBonus(profile: SuggestionProfile, day: Date, hour: number) {
  let score = 0;

  if (profile.prefersWeekend && isWeekend(day)) score += 10;
  if (profile.prefersWeekday && !isWeekend(day)) score += 8;
  if (profile.prefersEvening && hour >= 18) score += 10;
  if (profile.prefersDaylight && hour >= 8 && hour <= 15) score += 8;
  if (profile.prefersSoon) {
    const diffDays = Math.floor(
      (startOfDay(day).getTime() - startOfDay(new Date()).getTime()) / 86400000
    );
    if (diffDays <= 2) score += 12;
    else if (diffDays >= 6) score -= 10;
  }

  return score;
}

function scoreSlot(params: {
  events: any[];
  now: Date;
  slot: Date;
  day: Date;
  profile: SuggestionProfile;
  durationMinutes: number;
  groupType: SuggestionGroupType;
  rawText: string;
}) {
  const {
    events,
    now,
    slot,
    day,
    profile,
    durationMinutes,
    groupType,
    rawText,
  } = params;

  let score = 100;

  score += getHourPreferenceBonus(profile.intent, slot.getHours());
  score += getPreferenceShapeBonus(profile, day, slot.getHours());
  score -= getRecencyPenalty(now, slot, profile.flexibility);
  score -= getDistancePenaltyForExplicitTemporalSignal(slot, profile);

  const eventsCountForDay = countEventsForDay(events, day);
  score -= eventsCountForDay * 10;

  const nearestGap = getNearestGapMinutes(events, slot, durationMinutes);
  if (Number.isFinite(nearestGap)) {
    if (nearestGap < 45) score -= 28;
    else if (nearestGap < 90) score -= 14;
    else if (nearestGap >= 180) score += 10;
  } else {
    score += 12;
  }

  if (isWeekend(day)) {
    if (
      profile.intent === "breakfast" ||
      profile.intent === "lunch" ||
      profile.intent === "dinner" ||
      profile.intent === "sports" ||
      profile.intent === "celebration"
    ) {
      score += 6;
    }
  }

  score += getContextualBoost(
    profile,
    groupType,
    day,
    slot.getHours(),
    rawText
  );

  return score;
}

function decorateRankedLabel(baseLabel: string, index: number) {
  if (index === 0) return `Mejor encaje · ${baseLabel}`;
  if (index === 1) return `Más cerca de lo ideal · ${baseLabel}`;
  return `Opción cómoda · ${baseLabel}`;
}

export function getSuggestedTimeSlots(
  events: any[],
  groupType: SuggestionGroupType,
  rawText: string
): Suggestion[] {
  const now = new Date();
  const profile = buildSuggestionProfile(rawText, groupType);
  const hours = getCandidateHours(profile, groupType);
  const durationMinutes = getDurationMinutes(profile.intent);
  const offsets = getDayOffsets(profile);

  const candidates: Suggestion[] = [];

  for (const offset of offsets) {
    const day = addDays(startOfDay(now), offset);

    if (shouldSkipDay(day, profile)) {
      continue;
    }

    let bestForDay: Suggestion | null = null;

    for (const hour of hours) {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);

      if (slot.getTime() <= now.getTime()) continue;
      if (!isSlotFree(events, slot, durationMinutes)) continue;

      const score = scoreSlot({
        events,
        now,
        slot,
        day,
        profile,
        durationMinutes,
        groupType,
        rawText,
      });

      const candidate: Suggestion = {
        date: slot,
        label: buildBaseLabel(slot),
        score,
      };

      if (!bestForDay || candidate.score > bestForDay.score) {
        bestForDay = candidate;
      }
    }

    if (bestForDay) {
      candidates.push(bestForDay);
    }
  }

  const sorted = candidates.sort((a, b) => b.score - a.score).slice(0, 3);

  return sorted.map((s, i) => ({
    ...s,
    label: decorateRankedLabel(s.label, i),
  }));
}

export function getSuggestionContextLabel(
  rawText: string,
  groupType: SuggestionGroupType
): string | null {
  const profile = buildSuggestionProfile(rawText, groupType);
  const { intent, social, flexibility, temporal } = profile;

  if (flexibility === "low" && temporal.mentionsUrgency) {
    return "Busqué opciones que te sirvan pronto";
  }

  switch (intent) {
    case "breakfast":
      return "Podría encajar bien en la mañana";
    case "lunch":
      return social.mentionsFamily || groupType === "family"
        ? "Esto suele funcionar bien para juntarse a almorzar"
        : "Podría funcionar para almorzar";
    case "dinner":
      return groupType === "pair" || social.mentionsCouple
        ? "Estos horarios suelen cuadrar bien para un plan juntos"
        : "Estos horarios tienen buena pinta";
    case "coffee":
      return "Podría encajar para un café sin romperte el día";
    case "sports":
      return groupType === "other" || social.mentionsFriends
        ? "Estos horarios suelen funcionar bien para coordinar con más gente"
        : "Estos horarios suelen funcionar bien";
    case "medical":
      return "Horarios razonables para esta cita";
    case "meeting":
      return "Podría cuadrar en estos bloques sin apretarte demasiado";
    case "celebration":
      return "Estos horarios se sienten naturales para ese plan";
    case "errand":
      return "Esto podría resolverse bien en estos bloques";
    default:
      if (groupType === "pair") return "Podrían cuadrar estos horarios";
      if (groupType === "family") return "Esto suele funcionar bien en familia";
      if (groupType === "other") return "Esto podría coordinarse mejor así";
      return "Podría encajar en estos horarios";
  }
}