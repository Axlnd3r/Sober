import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { mode } from "@/lib/config";
import { dbPool } from "@/lib/db";
import { fail, ok, sameOrigin } from "@/lib/http";
import { getRoom } from "@/lib/rooms";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    if (mode !== "live") throw new Error("Usage evidence requires live mode");
    const user = await requireSession(req);
    const input = z.object({ roomId: z.string().max(100), event: z.enum(["room_view", "analysis_view", "share"]) }).parse(await req.json());
    const room = await getRoom(input.roomId);
    if (!room) throw new Error("Room unavailable");
    const internal = user.admin || (process.env.INTERNAL_TEST_WALLETS || "").split(",").map(x => x.trim()).includes(user.wallet);
    await dbPool().query("INSERT INTO usage_events(wallet,room_id,event,internal) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [user.wallet, room.id, input.event, internal]);
    return ok({ recorded: true });
  } catch (error) { return fail(error); }
}
