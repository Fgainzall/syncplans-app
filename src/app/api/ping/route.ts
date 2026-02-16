// src/app/api/_ping/route.ts
export const runtime = "nodejs";

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, ts: new Date().toISOString() }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
}