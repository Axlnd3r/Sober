import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { claimStatus } from "@/lib/claim";
import { fail, ok } from "@/lib/http";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireSession(req); return ok(await claimStatus(user.wallet, (await params).id)); } catch (error) { return fail(error); } }
