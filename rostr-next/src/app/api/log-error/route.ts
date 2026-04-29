import { NextResponse, type NextRequest } from "next/server";

/**
 * /api/log-error — sink for client-side error reports from the
 * `captureError()` helper.
 *
 * Today: writes to the server-side console (Vercel captures these as
 * function logs). Later: swap the body for a Sentry / Datadog / Logtail
 * call without touching any caller.
 *
 * Public on purpose — error reports come from unauthenticated views
 * too (marketing, demo, public profiles). We rate-limit by IP via the
 * platform layer; nothing here is sensitive.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, reason: "bad-shape" }, { status: 400 });
  }

  // Payload size cap — prevents a malicious client from filling the
  // log stream with a 10MB JSON blob. Stringified report should be
  // well under 4KB in practice.
  const json = JSON.stringify(body);
  if (json.length > 16 * 1024) {
    return NextResponse.json({ ok: false, reason: "too-large" }, { status: 413 });
  }

  // The Vercel runtime indexes console output; this becomes searchable
  // in the deployment's Logs panel. Tag so we can filter quickly.
  // eslint-disable-next-line no-console
  console.error("[client-error]", {
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
    referer: req.headers.get("referer") ?? null,
    ...JSON.parse(json),
  });

  return NextResponse.json({ ok: true });
}

// Don't bother with GET — this is write-only.
export async function GET() {
  return NextResponse.json({ ok: false }, { status: 405 });
}
