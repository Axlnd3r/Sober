import { NextRequest } from "next/server";
import { requireJobSecret } from "@/lib/job-auth";
import { syncImportedFixtures } from "@/lib/fixture-sync";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    requireJobSecret(req);
    return ok(await syncImportedFixtures());
  } catch (error) { return fail(error); }
}
