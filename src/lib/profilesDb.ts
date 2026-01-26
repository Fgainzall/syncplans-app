"use client";

import supabase from "@/lib/supabaseClient";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

export async function getMyProfile(): Promise<Profile | null> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function createMyProfile(input: {
  first_name: string;
  last_name: string;
}): Promise<Profile> {
  const uid = await requireUid();

  const first_name = input.first_name.trim();
  const last_name = input.last_name.trim();

  if (!first_name || !last_name) {
    throw new Error("Nombre y apellido son obligatorios.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: uid,
      first_name,
      last_name,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function getInitials(p: {
  first_name: string;
  last_name: string;
}): string {
  return (
    (p.first_name?.[0] ?? "").toUpperCase() +
    (p.last_name?.[0] ?? "").toUpperCase()
  );
}
