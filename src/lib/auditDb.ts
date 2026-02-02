import supabase from "@/lib/supabaseClient";

export type AuditRow = {
  id: number;
  event_id: string | null;
  group_id: string | null;
  actor_id: string | null;
  action: "insert" | "update" | "delete";
  before: any | null;
  after: any | null;
  created_at: string;
};

export async function listAudit(groupId: string): Promise<AuditRow[]> {
  const { data, error } = await supabase
    .from("events_audit")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data ?? []) as AuditRow[];
}
