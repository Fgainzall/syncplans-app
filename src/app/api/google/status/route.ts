import { createClient } from "@supabase/supabase-js";
import { createApiRequestContext, jsonError, jsonOk, logRequestStart, maskEmail } from "@/lib/apiObservability";
import { createSupabaseUserClient } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

type ConnectionState = "connected" | "needs_reauth" | "disconnected";

type GoogleAccountStatusRow = {
  provider?: string | null;
  email?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type GoogleRefreshResult = {
  access_token: string;
  expires_in?: number;
};

class GoogleProviderError extends Error {
  status: number;
  providerCode?: string;

  constructor(message: string, status: number, providerCode?: string) {
    super(message);
    this.name = "GoogleProviderError";
    this.status = status;
    this.providerCode = providerCode;
  }
}

function getGoogleOauthCredentials() {
  const clientId =
    (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim() ||
    (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret =
    (process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim() ||
    (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleRefreshResult> {
  const credentials = getGoogleOauthCredentials();
  if (!credentials) {
    throw new GoogleProviderError("Missing Google OAuth environment variables", 500, "missing_env");
  }

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok || !json?.access_token) {
    const providerCode =
      typeof json?.error === "string" ? json.error : `google_http_${res.status}`;
    throw new GoogleProviderError(
      "No se pudo refrescar el access token de Google",
      res.status,
      providerCode
    );
  }

  return {
    access_token: String(json.access_token),
    expires_in: typeof json.expires_in === "number" ? json.expires_in : undefined,
  };
}

function isGoogleRefreshTokenInvalid(error: GoogleProviderError | null): boolean {
  const code = String(error?.providerCode ?? "").toLowerCase();
  return error?.status === 400 && (code === "invalid_grant" || code === "invalid_request");
}

async function persistGoogleAccountNeedsReauth(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) return;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await supabaseAdmin
    .from("google_accounts")
    .update({
      access_token: null,
      refresh_token: null,
      expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function persistRefreshedGoogleToken(userId: string, refreshed: GoogleRefreshResult) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) return;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nextExpiry = new Date(
    Date.now() + (refreshed.expires_in ?? 3600) * 1000
  ).toISOString();

  await supabaseAdmin
    .from("google_accounts")
    .update({
      access_token: refreshed.access_token,
      expires_at: nextExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function GET(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "google.status" });

  try {
    const supabase = await createSupabaseUserClient(req);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return jsonError(ctx, {
        error: "No autenticado.",
        code: "GOOGLE_STATUS_UNAUTHORIZED",
        status: 401,
        log: { flow: "google.status" },
      });
    }

    const { data, error } = await supabase
      .from("google_accounts")
      .select("provider,email,created_at,updated_at,expires_at,access_token,refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return jsonError(ctx, {
        error: "No se pudo revisar la conexión de Google.",
        code: "GOOGLE_STATUS_LOOKUP_FAILED",
        status: 500,
        log: {
          flow: "google.status",
          userId: user.id,
          providerError: error.message,
        },
      });
    }

    if (!data) {
      return jsonOk(
        ctx,
        {
          connected: false,
          connection_state: "disconnected" satisfies ConnectionState,
          account: null,
        },
        {
          log: {
            flow: "google.status",
            userId: user.id,
            connection_state: "disconnected",
          },
        }
      );
    }

    const account = data as GoogleAccountStatusRow;
    const refreshToken = account.refresh_token ?? null;
    let connectionState: ConnectionState = refreshToken ? "connected" : "needs_reauth";

    if (refreshToken) {
      const accessToken = account.access_token ?? null;
      const expiryMs = account.expires_at ? new Date(account.expires_at).getTime() : 0;
      const shouldValidateRefresh =
        !accessToken || !expiryMs || Number.isNaN(expiryMs) || expiryMs <= Date.now() + 60_000;

      if (shouldValidateRefresh) {
        try {
          const refreshed = await refreshGoogleAccessToken(refreshToken);
          await persistRefreshedGoogleToken(user.id, refreshed);
          connectionState = "connected";
        } catch (error) {
          const providerError = error instanceof GoogleProviderError ? error : null;

          if (isGoogleRefreshTokenInvalid(providerError)) {
            connectionState = "needs_reauth";
            await persistGoogleAccountNeedsReauth(user.id);
          }
        }
      }
    }

    return jsonOk(
      ctx,
      {
        connected: connectionState === "connected",
        connection_state: connectionState,
        account: {
          provider: account.provider ?? "google",
          email: account.email ?? null,
          created_at: account.created_at ?? null,
          updated_at: account.updated_at ?? null,
        },
      },
      {
        log: {
          flow: "google.status",
          userId: user.id,
          connection_state: connectionState,
          googleEmail: maskEmail(account.email),
        },
      }
    );
  } catch (error) {
    return jsonError(ctx, {
      error: "Error revisando conexión con Google.",
      code: "GOOGLE_STATUS_FAILED",
      status: 500,
      level: "error",
      log: { flow: "google.status", error },
    });
  }
}
