"use client";

import supabase from "@/lib/supabaseClient";

async function requireAuthed() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error("No authenticated user");
  return data.user;
}

export async function deleteGroup(groupId: string) {
  await requireAuthed();

  const { data, error } = await supabase.rpc("delete_group", {
    p_group_id: groupId,
  });

  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "No se pudo eliminar el grupo");

  return true;
}

export async function leaveGroup(groupId: string) {
  await requireAuthed();

  const { data, error } = await supabase.rpc("leave_group", {
    p_group_id: groupId,
  });

  if (error) throw error;

  if (!data?.ok) {
    const code = data?.error;
    if (code === "owner_cannot_leave") {
      throw new Error("Eres el owner. Para salir, elimina el grupo.");
    }
    throw new Error(code || "No se pudo salir del grupo");
  }

  return true;
}
