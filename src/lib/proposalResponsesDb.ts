import supabase from "@/lib/supabaseClient";

export type ProposalResponseStatus = "accepted" | "adjusted" | "pending";

export type ProposalResponseRow = {
  id: string;
  event_id: string;
  user_id: string;
  response: ProposalResponseStatus;
  created_at: string;
  updated_at: string;
};

export type UpsertProposalResponseInput = {
  eventId: string;
  userId: string;
  response: ProposalResponseStatus;
};

function isValidProposalResponse(
  value: string,
): value is ProposalResponseStatus {
  return value === "accepted" || value === "adjusted" || value === "pending";
}

export async function upsertProposalResponse(
  input: UpsertProposalResponseInput,
): Promise<ProposalResponseRow> {
  const { eventId, userId, response } = input;

  if (!eventId) {
    throw new Error("upsertProposalResponse: eventId es requerido");
  }

  if (!userId) {
    throw new Error("upsertProposalResponse: userId es requerido");
  }

  if (!isValidProposalResponse(response)) {
    throw new Error(
      `upsertProposalResponse: response inválido (${response})`,
    );
  }

  const payload = {
    event_id: eventId,
    user_id: userId,
    response,
  };

  const { data, error } = await supabase
    .from("proposal_responses")
    .upsert(payload, {
      onConflict: "event_id,user_id",
    })
    .select("id, event_id, user_id, response, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "upsertProposalResponse: no se recibió respuesta de Supabase",
    );
  }

  return data as ProposalResponseRow;
}

export async function getProposalResponseForEvent(
  eventId: string,
  userId: string,
): Promise<ProposalResponseRow | null> {
  if (!eventId) {
    throw new Error("getProposalResponseForEvent: eventId es requerido");
  }

  if (!userId) {
    throw new Error("getProposalResponseForEvent: userId es requerido");
  }

  const { data, error } = await supabase
    .from("proposal_responses")
    .select("id, event_id, user_id, response, created_at, updated_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProposalResponseRow | null) ?? null;
}

export async function getMyProposalResponsesForEvents(
  eventIds: string[],
  userId: string,
): Promise<Record<string, ProposalResponseRow>> {
  if (!userId) {
    throw new Error("getMyProposalResponsesForEvents: userId es requerido");
  }

  const cleanEventIds = Array.from(
    new Set(eventIds.filter((value) => typeof value === "string" && value.trim().length > 0)),
  );

  if (cleanEventIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("proposal_responses")
    .select("id, event_id, user_id, response, created_at, updated_at")
    .eq("user_id", userId)
    .in("event_id", cleanEventIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ProposalResponseRow[];

  return rows.reduce<Record<string, ProposalResponseRow>>((acc, row) => {
    acc[row.event_id] = row;
    return acc;
  }, {});
}