import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { reconcilePending } from "@/lib/reconcile";
import { requireJobSecret } from "@/lib/job-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    requireJobSecret(req);
    return ok(await reconcilePending());
  } catch (error) { return fail(error); }
}
