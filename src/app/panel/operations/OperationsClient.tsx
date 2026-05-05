// src/app/panel/operations/OperationsClient.tsx
"use client";

import React, {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";

import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

type CheckStatus = "idle" | "running" | "ok" | "warn" | "error";

type CheckId =
  | "ping"
  | "userLocation"
  | "googleStatus"
  | "mapsAutocomplete";

type CheckDefinition = {
  id: CheckId;
  title: string;
  description: string;
  method: "GET" | "POST";
  url: string;
  body?: Record<string, unknown>;
  costHint: string;
};

type CheckResult = {
  id: CheckId;
  title: string;
  description: string;
  status: CheckStatus;
  statusText: string;
  durationMs?: number;
  httpStatus?: number;
  requestId?: string | null;
  rateLimitMode?: string | null;
  rateLimitLimit?: string | null;
  rateLimitRemaining?: string | null;
  rateLimitReset?: string | null;
  retryAfter?: string | null;
  bodyPreview?: string;
  checkedAt?: string;
};

type RunbookLink = {
  id: string;
  label: string;
  href: string;
  description: string;
};

const CHECKS: CheckDefinition[] = [
  {
    id: "ping",
    title: "Ping público",
    description: "Confirma que el deploy responde sin sesión.",
    method: "GET",
    url: "/api/ping",
    costHint: "Sin costo externo",
  },
  {
    id: "userLocation",
    title: "Ubicación de usuario",
    description: "Valida sesión real + RLS en /api/user/location.",
    method: "GET",
    url: "/api/user/location",
    costHint: "Sin costo externo",
  },
  {
    id: "googleStatus",
    title: "Google Calendar",
    description: "Valida estado de conexión del usuario actual.",
    method: "GET",
    url: "/api/google/status",
    costHint: "Lectura liviana",
  },
  {
    id: "mapsAutocomplete",
    title: "Maps autocomplete",
    description: "Valida Maps autenticado + rate limit Redis.",
    method: "POST",
    url: "/api/maps/autocomplete",
    body: { input: "Osaka Lima" },
    costHint: "Usar con cuidado",
  },
];

const RUNBOOKS: RunbookLink[] = [
  {
    id: "errors",
    label: "Errores operativos",
    href: "/docs/OPERATIONS_ERRORS.md",
    description: "Códigos estables, requestId y diagnóstico base.",
  },
  {
    id: "cron",
    label: "Cron",
    href: "/docs/RUNBOOK_CRON.md",
    description: "daily-reminders, weekly-summary y leave-alerts.",
  },
  {
    id: "google",
    label: "Google Sync",
    href: "/docs/RUNBOOK_GOOGLE_SYNC.md",
    description: "Conexión, sincronización y reconexión.",
  },
  {
    id: "maps",
    label: "Maps",
    href: "/docs/RUNBOOK_MAPS.md",
    description: "Autocomplete, ETA, rate limit y cuota.",
  },
  {
    id: "rate",
    label: "Rate limiting",
    href: "/docs/RUNBOOK_RATE_LIMITING.md",
    description: "Upstash Redis, headers y control de abuso.",
  },
  {
    id: "push",
    label: "Push",
    href: "/docs/RUNBOOK_PUSH.md",
    description: "Permisos, dispositivo y notificaciones de prueba.",
  },
  {
    id: "email",
    label: "Email",
    href: "/docs/RUNBOOK_EMAIL.md",
    description: "Resend, invitaciones y digest.",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function getString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function formatClock(value?: string) {
  if (!value) return "Sin ejecutar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin ejecutar";

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTone(status: CheckStatus): CSSProperties {
  if (status === "ok") return styles.pillOk;
  if (status === "warn") return styles.pillWarn;
  if (status === "error") return styles.pillError;
  if (status === "running") return styles.pillRunning;
  return styles.pillIdle;
}

function getStatusLabel(status: CheckStatus) {
  if (status === "ok") return "OK";
  if (status === "warn") return "Revisar";
  if (status === "error") return "Error";
  if (status === "running") return "Probando";
  return "Pendiente";
}

function buildInitialResults(): Record<CheckId, CheckResult> {
  return CHECKS.reduce<Record<CheckId, CheckResult>>((acc, check) => {
    acc[check.id] = {
      id: check.id,
      title: check.title,
      description: check.description,
      status: "idle",
      statusText: "Todavía no ejecutado",
    };
    return acc;
  }, {} as Record<CheckId, CheckResult>);
}

function interpretResult(
  check: CheckDefinition,
  response: Response,
  parsed: unknown,
  bodyPreview: string
): Pick<CheckResult, "status" | "statusText" | "bodyPreview"> {
  if (!response.ok) {
    return {
      status: "error",
      statusText: `HTTP ${response.status}`,
      bodyPreview,
    };
  }

  if (check.id === "googleStatus" && isRecord(parsed)) {
    const ok = getBoolean(parsed.ok);
    const connected = getBoolean(parsed.connected);
    const connectionState = getString(parsed.connection_state);

    if (ok === false) {
      return {
        status: "error",
        statusText: "Google status respondió con ok:false",
        bodyPreview,
      };
    }

    if (connected === true || connectionState === "connected") {
      return {
        status: "ok",
        statusText: "Conectado",
        bodyPreview,
      };
    }

    return {
      status: "warn",
      statusText: connectionState ? `Estado: ${connectionState}` : "Disponible, no conectado",
      bodyPreview,
    };
  }

  if (check.id === "mapsAutocomplete") {
    const mode = response.headers.get("x-ratelimit-mode");
    const remaining = response.headers.get("x-ratelimit-remaining");
    const limit = response.headers.get("x-ratelimit-limit");

    if (mode === "redis") {
      return {
        status: "ok",
        statusText:
          remaining && limit
            ? `Redis activo · ${remaining}/${limit} restantes`
            : "Redis activo",
        bodyPreview,
      };
    }

    return {
      status: "warn",
      statusText: "Respondió, pero sin x-ratelimit-mode: redis",
      bodyPreview,
    };
  }

  return {
    status: "ok",
    statusText: "Respuesta correcta",
    bodyPreview,
  };
}

async function runCheck(check: CheckDefinition): Promise<CheckResult> {
  const started = performance.now();

  const response = await fetch(check.url, {
    method: check.method,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": `ops_${check.id}_${Date.now()}`,
    },
    body: check.body ? JSON.stringify(check.body) : undefined,
  });

  const text = await response.text();
  const durationMs = Math.round(performance.now() - started);
  const preview = text.slice(0, 260);

  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  const interpreted = interpretResult(check, response, parsed, preview);

  return {
    id: check.id,
    title: check.title,
    description: check.description,
    durationMs,
    httpStatus: response.status,
    requestId: response.headers.get("x-request-id"),
    rateLimitMode: response.headers.get("x-ratelimit-mode"),
    rateLimitLimit: response.headers.get("x-ratelimit-limit"),
    rateLimitRemaining: response.headers.get("x-ratelimit-remaining"),
    rateLimitReset: response.headers.get("x-ratelimit-reset"),
    retryAfter: response.headers.get("retry-after"),
    checkedAt: new Date().toISOString(),
    ...interpreted,
  };
}

function StatusPill({ status }: { status: CheckStatus }) {
  return (
    <span style={{ ...styles.pill, ...getTone(status) }}>
      {getStatusLabel(status)}
    </span>
  );
}

function CheckCard({
  result,
  costHint,
  onRun,
  disabled,
}: {
  result: CheckResult;
  costHint: string;
  onRun: () => void;
  disabled: boolean;
}) {
  return (
    <article style={styles.checkCard}>
      <div style={styles.checkTop}>
        <div>
          <div style={styles.cardEyebrow}>{costHint}</div>
          <h3 style={styles.checkTitle}>{result.title}</h3>
        </div>
        <StatusPill status={result.status} />
      </div>

      <p style={styles.checkDescription}>{result.description}</p>

      <div style={styles.resultBox}>
        <div style={styles.resultMain}>{result.statusText}</div>
        <div style={styles.resultMeta}>
          <span>HTTP: {result.httpStatus ?? "—"}</span>
          <span>Tiempo: {result.durationMs ? `${result.durationMs} ms` : "—"}</span>
          <span>Último: {formatClock(result.checkedAt)}</span>
        </div>

        {result.requestId ? (
          <div style={styles.monoLine}>requestId: {result.requestId}</div>
        ) : (
          <div style={styles.mutedLine}>Sin x-request-id visible</div>
        )}

        {result.rateLimitMode || result.rateLimitLimit ? (
          <div style={styles.rateGrid}>
            <span>mode: {result.rateLimitMode ?? "—"}</span>
            <span>limit: {result.rateLimitLimit ?? "—"}</span>
            <span>remaining: {result.rateLimitRemaining ?? "—"}</span>
            <span>reset: {result.rateLimitReset ?? "—"}</span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        style={{
          ...styles.secondaryButton,
          ...(disabled ? styles.buttonDisabled : null),
        }}
        onClick={onRun}
        disabled={disabled}
      >
        {result.status === "running" ? "Ejecutando…" : "Ejecutar check"}
      </button>
    </article>
  );
}

function CronContractCard() {
  return (
    <section style={styles.sectionCard}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.sectionEyebrow}>Crons</div>
          <h2 style={styles.sectionTitle}>Contrato operativo actual</h2>
        </div>
        <span style={{ ...styles.pill, ...styles.pillOk }}>Bearer</span>
      </div>

      <p style={styles.sectionCopy}>
        Los crons no se ejecutan desde esta pantalla porque requieren secreto de
        servidor. Para producción, el contrato correcto es{" "}
        <strong>Authorization: Bearer CRON_SECRET</strong>. Los query params tipo
        <strong> ?secret=</strong>, <strong>?token=</strong> y{" "}
        <strong>x-cron-secret</strong> deben seguir rechazados.
      </p>

      <div style={styles.cronGrid}>
        <div style={styles.cronItem}>
          <span>daily-reminders</span>
          <strong>/api/cron/daily-reminders</strong>
        </div>
        <div style={styles.cronItem}>
          <span>weekly-summary</span>
          <strong>/api/cron/weekly-summary</strong>
        </div>
        <div style={styles.cronItem}>
          <span>leave-alerts</span>
          <strong>/api/cron/leave-alerts</strong>
        </div>
      </div>
    </section>
  );
}

export default function OperationsClient() {
  const router = useRouter();
  const [results, setResults] = useState<Record<CheckId, CheckResult>>(
    () => buildInitialResults()
  );
  const [runningAll, setRunningAll] = useState(false);

  const summary = useMemo(() => {
    const values = Object.values(results);
    const ok = values.filter((item) => item.status === "ok").length;
    const warn = values.filter((item) => item.status === "warn").length;
    const error = values.filter((item) => item.status === "error").length;
    const idle = values.filter((item) => item.status === "idle").length;

    return { ok, warn, error, idle, total: values.length };
  }, [results]);

  const setRunning = useCallback((id: CheckId) => {
    setResults((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: "running",
        statusText: "Ejecutando check…",
      },
    }));
  }, []);

  const handleRunOne = useCallback(
    async (check: CheckDefinition) => {
      setRunning(check.id);

      try {
        const result = await runCheck(check);
        setResults((prev) => ({ ...prev, [check.id]: result }));
      } catch (error) {
        setResults((prev) => ({
          ...prev,
          [check.id]: {
            ...prev[check.id],
            status: "error",
            statusText:
              error instanceof Error
                ? error.message
                : "Error inesperado ejecutando el check",
            checkedAt: new Date().toISOString(),
          },
        }));
      }
    },
    [setRunning]
  );

  const handleRunAll = useCallback(async () => {
    if (runningAll) return;

    setRunningAll(true);

    try {
      for (const check of CHECKS) {
        await handleRunOne(check);
      }
    } finally {
      setRunningAll(false);
    }
  }, [handleRunOne, runningAll]);

  return (
    <MobileScaffold maxWidth={1120}>
      <PremiumHeader
        title="Operaciones"
        subtitle="Dashboard interno mínimo para revisar salud, sesión, Google, Maps y runbooks."
      />

      <div style={styles.stack}>
        <section style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <div style={styles.heroEyebrow}>Beta cerrada</div>
              <h1 style={styles.heroTitle}>Centro operativo</h1>
              <p style={styles.heroCopy}>
                Una pantalla liviana para verificar que lo esencial sigue vivo
                sin entrar a logs: deploy, sesión/RLS, Google Calendar, Maps y
                rate limit Redis.
              </p>
            </div>

            <div style={styles.heroActions}>
              <button
                type="button"
                style={{
                  ...styles.primaryButton,
                  ...(runningAll ? styles.buttonDisabled : null),
                }}
                onClick={handleRunAll}
                disabled={runningAll}
              >
                {runningAll ? "Ejecutando…" : "Ejecutar checks"}
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => router.push("/panel")}
              >
                Volver al panel
              </button>
            </div>
          </div>

          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span>OK</span>
              <strong>{summary.ok}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span>Revisar</span>
              <strong>{summary.warn}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span>Errores</span>
              <strong>{summary.error}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span>Pendientes</span>
              <strong>{summary.idle}</strong>
            </div>
          </div>
        </section>

        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Checks</div>
              <h2 style={styles.sectionTitle}>Salud rápida</h2>
            </div>
            <span style={styles.sectionHint}>
              Ejecuta bajo demanda para no gastar cuota innecesaria.
            </span>
          </div>

          <div style={styles.checkGrid}>
            {CHECKS.map((check) => (
              <CheckCard
                key={check.id}
                result={results[check.id]}
                costHint={check.costHint}
                onRun={() => handleRunOne(check)}
                disabled={runningAll || results[check.id].status === "running"}
              />
            ))}
          </div>
        </section>

        <CronContractCard />

        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Runbooks</div>
              <h2 style={styles.sectionTitle}>Qué revisar si algo falla</h2>
            </div>
          </div>

          <div style={styles.runbookGrid}>
            {RUNBOOKS.map((item) => (
              <a key={item.id} href={item.href} style={styles.runbookCard}>
                <span>{item.label}</span>
                <p>{item.description}</p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </MobileScaffold>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  heroCard: {
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: 28,
    padding: 20,
    background:
      "linear-gradient(135deg, rgba(30, 41, 59, 0.88), rgba(15, 23, 42, 0.78))",
    boxShadow: "0 24px 80px rgba(2, 6, 23, 0.34)",
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  heroEyebrow: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    margin: 0,
    color: "#F8FAFC",
    fontSize: "clamp(28px, 5vw, 44px)",
    lineHeight: 1,
    letterSpacing: "-0.05em",
  },
  heroCopy: {
    color: "#CBD5E1",
    fontSize: 15,
    lineHeight: 1.55,
    maxWidth: 680,
    margin: "12px 0 0",
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  primaryButton: {
    border: "1px solid rgba(129, 140, 248, 0.8)",
    borderRadius: 999,
    padding: "11px 15px",
    background: "linear-gradient(135deg, rgba(79, 70, 229, 0.96), rgba(37, 99, 235, 0.92))",
    color: "#FFFFFF",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 36px rgba(37, 99, 235, 0.24)",
  },
  secondaryButton: {
    border: "1px solid rgba(148, 163, 184, 0.28)",
    borderRadius: 999,
    padding: "10px 14px",
    background: "rgba(15, 23, 42, 0.72)",
    color: "#E2E8F0",
    fontWeight: 850,
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.58,
    cursor: "not-allowed",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 18,
  },
  summaryCard: {
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: 20,
    padding: 14,
    background: "rgba(2, 6, 23, 0.28)",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: 800,
  },
  sectionCard: {
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 26,
    padding: 18,
    background: "rgba(15, 23, 42, 0.72)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: "#67E8F9",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 22,
    lineHeight: 1.08,
    margin: 0,
    letterSpacing: "-0.035em",
  },
  sectionHint: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 1.4,
    maxWidth: 280,
  },
  sectionCopy: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 1.55,
    margin: "0 0 14px",
  },
  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 12,
  },
  checkCard: {
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 22,
    padding: 14,
    background: "rgba(2, 6, 23, 0.22)",
    minWidth: 0,
  },
  checkTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  cardEyebrow: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 850,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  checkTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    lineHeight: 1.1,
    margin: 0,
    letterSpacing: "-0.02em",
  },
  checkDescription: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 1.45,
    minHeight: 38,
    margin: "10px 0 12px",
  },
  resultBox: {
    border: "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: 18,
    padding: 12,
    background: "rgba(15, 23, 42, 0.68)",
    marginBottom: 12,
  },
  resultMain: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: 850,
    marginBottom: 8,
  },
  resultMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 1.35,
  },
  monoLine: {
    marginTop: 8,
    color: "#A5B4FC",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 11,
    overflowWrap: "anywhere",
  },
  mutedLine: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 12,
  },
  rateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 6,
    marginTop: 9,
    color: "#BAE6FD",
    fontSize: 12,
  },
  pill: {
    borderRadius: 999,
    padding: "6px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
    border: "1px solid rgba(148, 163, 184, 0.2)",
  },
  pillOk: {
    background: "rgba(34, 197, 94, 0.14)",
    color: "#BBF7D0",
    borderColor: "rgba(34, 197, 94, 0.28)",
  },
  pillWarn: {
    background: "rgba(245, 158, 11, 0.14)",
    color: "#FDE68A",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  pillError: {
    background: "rgba(248, 113, 113, 0.14)",
    color: "#FECACA",
    borderColor: "rgba(248, 113, 113, 0.34)",
  },
  pillRunning: {
    background: "rgba(96, 165, 250, 0.14)",
    color: "#BFDBFE",
    borderColor: "rgba(96, 165, 250, 0.34)",
  },
  pillIdle: {
    background: "rgba(148, 163, 184, 0.1)",
    color: "#CBD5E1",
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  cronGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  cronItem: {
    border: "1px solid rgba(148, 163, 184, 0.16)",
    borderRadius: 18,
    padding: 12,
    background: "rgba(2, 6, 23, 0.22)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#CBD5E1",
    fontSize: 12,
  },
  runbookGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  runbookCard: {
    border: "1px solid rgba(148, 163, 184, 0.16)",
    borderRadius: 18,
    padding: 13,
    background: "rgba(2, 6, 23, 0.2)",
    color: "#F8FAFC",
    textDecoration: "none",
    display: "block",
  },
};
