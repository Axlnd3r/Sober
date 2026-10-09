import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "./config";
import { PantaError } from "./panta";
import { ZodError } from "zod";

export function ok(data: unknown, status = 200) { return NextResponse.json({ ok: true, data, meta: { serverTime: new Date().toISOString() } }, { status, headers: { "Cache-Control": "private, no-store" } }); }
export function fail(error: unknown) {
  if (error instanceof PantaError) return NextResponse.json({ ok: false, error: { code: error.code, message: error.message, retryable: error.status === 429 || error.status >= 500 } }, { status: error.status, headers: error.retryAfter ? { "Retry-After": error.retryAfter } : {} });
  if (error instanceof ZodError) return NextResponse.json({ ok: false, error: { code: "VALIDATION", message: error.issues[0]?.message || "Invalid input", retryable: false } }, { status: 400 });
  const upstreamCode = error && typeof error === "object" && "code" in error ? error.code : null;
  if (error instanceof TypeError || error instanceof AggregateError || typeof upstreamCode === "string") {
    return NextResponse.json({ ok: false, error: { code: "SOBER_500", message: "Request could not be completed", retryable: true } }, { status: 500 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const code = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message.includes("configured") || message.includes("required") ? 503 : message.includes("conflict") ? 409 : 400;
  return NextResponse.json({ ok: false, error: { code: `SOBER_${code}`, message: code >= 500 ? "Service is not configured" : message, retryable: code >= 500 } }, { status: code });
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(appUrl).origin) throw new Error("Forbidden");
}
