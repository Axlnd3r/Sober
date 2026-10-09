import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

export function requireJobSecret(req: NextRequest) {
  const secret = process.env.JOB_SECRET;
  if (!secret) throw new Error("Job secret is not configured");
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.get("authorization") || "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Forbidden");
}
