import { createApiRequestContext, jsonError, jsonOk, logRequestStart, maskEmail } from "@/lib/apiObservability";
import { createSupabaseUserClient } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

type ConnectionState = "connected" | "needs_reauth" | "disconnected";

type GoogleAccountStatusRow = {
  provider?: string | null;
  email?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

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
      .select("provider,email,created_at,updated_at,expires_at,refresh_token")
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
    const connectionState: ConnectionState = refreshToken ? "connected" : "needs_reauth";

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
