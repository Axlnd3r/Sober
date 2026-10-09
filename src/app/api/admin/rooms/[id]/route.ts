import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { fail, ok, sameOrigin } from "@/lib/http";
import { getRoom, getRoomMarket } from "@/lib/rooms";
import { verifyFixtureForWrite } from "@/lib/fixture-import";
import { publicHttpsUrl } from "@/lib/public-url";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(req); await requireAdmin(req);
    const id = (await params).id;
    const input = z.discriminatedUnion("action", [z.object({ action: z.literal("map"), marketId: z.string().min(20) }), z.object({ action: z.literal("publish") }), z.object({ action: z.literal("pause"), paused: z.boolean() }), z.object({ action: z.literal("edit"), brief: z.string().max(1200), question: z.string().min(20).max(512), resolutionRule: z.string().min(40).max(2048), sources: z.array(publicHttpsUrl).min(1).max(20) })]).parse(await req.json());
    const room = await getRoom(id, true);
    if (!room) throw new Error("Room unavailable");
    if (input.action === "edit") {
      if (room.published || room.reviewed || room.pantaMarketId) throw new Error("Mapped or published room details cannot be edited");
      await dbPool().query("UPDATE rooms SET brief=$2,question=$3,resolution_rule=$4,sources=$5 WHERE id=$1 AND published=false AND reviewed=false AND panta_market_id IS NULL", [id, input.brief, input.question, input.resolutionRule, JSON.stringify(input.sources)]);
    } else if (input.action === "map") {
      await verifyFixtureForWrite(room, true);
      if (!room.sources.length) throw new Error("Review and add at least one resolution source before mapping");
      const market = await getRoomMarket({ ...room, pantaMarketId: input.marketId });
      if (!market || market.marketId !== input.marketId) throw new Error("Panta market could not be verified");
      if (market.title.trim() !== room.question?.trim()) throw new Error("Panta market question does not match the room");
      if (market.endTime && market.endTime * 1000 > new Date(room.cutoffAt).getTime()) throw new Error("Panta market closes after the room cutoff");
      await dbPool().query("UPDATE rooms SET panta_market_id=$2,reviewed=true,published=false WHERE id=$1", [id, input.marketId]);
    } else if (input.action === "publish") {
      await verifyFixtureForWrite(room, true);
      if (!room.pantaMarketId || !room.reviewed || !room.question || !room.resolutionRule || !room.sources.length) throw new Error("Review mapping, rules, and sources first");
      if (room.providerFixtureId && room.sources.every(source => source === room.fixtureSourceUrl)) throw new Error("Add a public resolution source before publishing this imported fixture");
      await dbPool().query("UPDATE rooms SET published=true WHERE id=$1", [id]);
    } else {
      if (!input.paused) await verifyFixtureForWrite(room, true);
      await dbPool().query("UPDATE rooms SET trading_paused=$2 WHERE id=$1", [id, input.paused]);
    }
    return ok(await getRoom(id, true));
  } catch (error) { return fail(error); }
}
