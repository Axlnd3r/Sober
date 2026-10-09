import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { listRooms } from "@/lib/rooms";
import { session } from "@/lib/auth";
export async function GET(req: NextRequest) { try { const user = await session(req).catch(() => null); return ok(await listRooms(Boolean(user?.admin && req.nextUrl.searchParams.get("all") === "1"))); } catch (error) { return fail(error); } }
