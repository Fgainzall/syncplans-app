// src/app/api/integrations/google/list/route.ts
import { createApiRequestContext, jsonError, jsonOk, logRequestStart } from "@/lib/apiObservability";
import { createSupabaseUserClient } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

type GoogleAccountRow = {
  access_token?: string | null;
  refresh_token?: string | null;
};

type GoogleProviderResponse = {
  error?: {
    message?: string;
    status?: string;
  };
  error_description?: string;
  items?: unknown[];
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

function mustEnv(name: string, fallbackName?: string): string {
  const primary = (process.env[name] ?? "").trim();
  if (primary) return primary;

  const fallback = fallbackName ? (process.env[fallbackName] ?? "").trim() : "";
  if (fallback) return fallback;

  throw new Error(
    fallbackName ? `Missing env: ${name} or ${fallbackName}` : `Missing env: ${name}`
  );
}

async function refreshGoogleAccessToken(
  supabase: Awaited<ReturnType<typeof createSupabaseUserClient>>,
  userId: string,
  refreshToken: string
): Promise<string> {
  const clientId = mustEnv("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_CLIENT_ID");
  const clientSecret = mustEnv(
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_CLIENT_SECRET"
  );

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;

  if (!resp.ok || !data.access_token) {
    const providerCode =
      typeof data.error === "string" ? data.error : `google_http_${resp.status}`;
    throw new GoogleProviderError(
      "No se pudo refrescar la sesión de Google.",
      resp.status,
      providerCode
    );
  }

  const expiresAt =
    typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

  await supabase
    .from("google_accounts")
    .update({
      access_token: data.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return String(data.access_token);
}

async function fetchEventsWithToken(accessToken: string) {
  const timeMin = new Date().toISOString();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&singleEvents=true&orderBy=startTime&maxResults=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const json = (await response.json().catch(() => ({}))) as GoogleProviderResponse;
  return { response, json };
}

export async function GET(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "google.list" });

  try {
    const supabase = await createSupabaseUserClient(req);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return jsonError(ctx, {
        error: "No autenticado.",
        code: "GOOGLE_LIST_UNAUTHORIZED",
        status: 401,
        log: { flow: "google.list" },
      });
    }

    const { data: ga, error: gaErr } = await supabase
      .from("google_accounts")
      .select("access_token, refresh_token")
      .eq("user_id", user.id)
      .maybeSingle<GoogleAccountRow>();

    if (gaErr) {
      return jsonError(ctx, {
        error: "No se pudo leer la conexión de Google.",
        code: "GOOGLE_LIST_ACCOUNT_LOOKUP_FAILED",
        status: 500,
        log: { flow: "google.list", userId: user.id, providerError: gaErr.message },
      });
    }

    if (!ga?.access_token) {
      return jsonError(ctx, {
        error: "No hay Google conectado. Vuelve a conectar tu cuenta desde el Panel.",
        code: "GOOGLE_NO_ACCOUNT",
        status: 400,
        log: { flow: "google.list", userId: user.id },
      });
    }

    let accessToken = ga.access_token;
    let { response, json } = await fetchEventsWithToken(accessToken);

    if ((response.status === 401 || response.status === 403) && ga.refresh_token) {
      try {
        accessToken = await refreshGoogleAccessToken(supabase, user.id, ga.refresh_token);
        const retry = await fetchEventsWithToken(accessToken);
        response = retry.response;
        json = retry.json;
      } catch (error) {
        const providerError = error instanceof GoogleProviderError ? error : null;
        return jsonError(ctx, {
          error: "No se pudo refrescar la sesión de Google. Vuelve a conectar tu cuenta desde el Panel.",
          code: "GOOGLE_TOKEN_REFRESH_FAILED",
          status: 401,
          log: {
            flow: "google.list",
            userId: user.id,
            providerStatus: providerError?.status ?? null,
            providerCode: providerError?.providerCode ?? null,
          },
        });
      }
    }

    if (!response.ok) {
      const code = json.error?.status || `google_http_${response.status}`;
      return jsonError(ctx, {
        error: "Google devolvió un error al leer eventos.",
        code: "GOOGLE_LIST_PROVIDER_FAILED",
        status: 502,
        log: {
          flow: "google.list",
          userId: user.id,
          providerStatus: response.status,
          providerCode: code,
        },
      });
    }

    const items = Array.isArray(json.items) ? json.items : [];

    return jsonOk(
      ctx,
      { items },
      {
        log: {
          flow: "google.list",
          userId: user.id,
          items: items.length,
        },
      }
    );
  } catch (error) {
    return jsonError(ctx, {
      error: "Error inesperado al leer los eventos de Google.",
      code: "GOOGLE_LIST_FAILED",
      status: 500,
      level: "error",
      log: { flow: "google.list", error },
    });
  }
}
