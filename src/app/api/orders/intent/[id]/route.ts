import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { fail, ok, sameOrigin } from "@/lib/http";
import { orderStatus, submitOrder } from "@/lib/order";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireSession(req); return ok(await orderStatus(user.wallet, (await params).id)); } catch (error) { return fail(error); } }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { sameOrigin(req); const user = await requireSession(req); return ok(await submitOrder(user.wallet, (await params).id)); } catch (error) { return fail(error); } }
