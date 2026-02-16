// src/lib/auth.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  verified?: boolean;
};

export async function getUser(): Promise<AuthUser | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    verified: !!user.email_confirmed_at,
  };
}

export async function isAuthed(): Promise<boolean> {
  const u = await getUser();
  return !!u;
}

export async function signIn(params: { email: string; password: string }) {
  const email = (params.email ?? "").trim().toLowerCase();
  const password = params.password ?? "";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function signUp(params: { name: string; email: string; password: string }) {
  const name = (params.name ?? "").trim();
  const email = (params.email ?? "").trim().toLowerCase();
  const password = params.password ?? "";

  const emailRedirectTo =
    `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/auth/callback`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo,
    },
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}