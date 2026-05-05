// src/app/panel/operations/page.tsx
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import OperationsClient from "./OperationsClient";

type OperationsProfileGate = {
  plan_tier: string | null;
};

function OperationsFallback() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#050817",
        color: "#F8FAFC",
        display: "grid",
        placeItems: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div
          style={{
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: 24,
            padding: 20,
            background: "rgba(15, 23, 42, 0.72)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#93C5FD",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Operaciones
          </div>
          <h1 style={{ fontSize: 24, lineHeight: 1.1, margin: 0 }}>
            Preparando dashboard…
          </h1>
        </div>
      </div>
    </main>
  );
}

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getAdminEmailAllowlist() {
  return new Set(
    [
      process.env.SYNCPLANS_ADMIN_EMAIL,
      process.env.SYNCPLANS_ADMIN_EMAILS,
      process.env.SYNCPLANS_FOUNDER_EMAIL,
      process.env.SYNCPLANS_FOUNDER_EMAILS,
    ]
      .filter(Boolean)
      .flatMap((value) => String(value).split(","))
      .map(normalizeEmail)
      .filter(Boolean)
  );
}

function isPrivilegedPlanTier(value?: string | null) {
  const tier = (value ?? "").trim().toLowerCase();

  return tier === "admin" || tier.startsWith("admin_") || tier.startsWith("founder");
}

async function canAccessOperations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) return false;

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return false;

  const userEmail = normalizeEmail(user.email);
  const adminEmails = getAdminEmailAllowlist();

  if (userEmail && adminEmails.has(userEmail)) return true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .maybeSingle<OperationsProfileGate>();

  return isPrivilegedPlanTier(profile?.plan_tier);
}

export default async function OperationsPage() {
  const allowed = await canAccessOperations();

  if (!allowed) {
    redirect("/panel");
  }

  return (
    <Suspense fallback={<OperationsFallback />}>
      <OperationsClient />
    </Suspense>
  );
}