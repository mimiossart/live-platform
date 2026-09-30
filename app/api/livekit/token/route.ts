import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = await request.json().catch(() => null);
  const liveId = typeof body?.liveId === "string" ? body.liveId : "";
  const matchId = typeof body?.matchId === "string" ? body.matchId : "";

  if (!liveId) {
    return NextResponse.json({ error: "liveId requis." }, { status: 400 });
  }

  const { data: live, error } = await supabase
    .from("lives")
    .select("id,user_id,status")
    .eq("id", liveId)
    .single();

  if (error || !live || live.status !== "live") {
    return NextResponse.json({ error: "Live indisponible." }, { status: 404 });
  }

  let battleRoom = "";
  let battleParticipant = false;
  if (matchId) {
    const { data: match } = await supabase
      .from("live_matches")
      .select("id,live_id,opponent_live_id,battle_room_id,challenger_id,opponent_id,status")
      .eq("id", matchId)
      .in("status", ["pending", "active"])
      .maybeSingle();

    const participant = Boolean(user && match && (user.id === match.challenger_id || user.id === match.opponent_id));
    const liveBelongsToMatch = Boolean(match && (match.live_id === liveId || match.opponent_live_id === liveId));

    if (!match || !liveBelongsToMatch || (match.status === "active" && !participant && !user)) {
      return NextResponse.json({ error: "Match indisponible." }, { status: 404 });
    }

    battleRoom = match.battle_room_id || match.id;
    battleParticipant = participant;
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json(
      { error: "LiveKit n'est pas encore configuré côté serveur." },
      { status: 500 },
    );
  }

  const isOwner = Boolean(user && live.user_id === user.id);
  let isGuest = false;

  if (user && !isOwner) {
    const { data: guest } = await supabase
      .from("live_guests")
      .select("user_id")
      .eq("live_id", liveId)
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    isGuest = Boolean(guest);
  }

  const identity = user?.id ?? `viewer-${crypto.randomUUID()}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: user?.id ?? "Visiteur",
    ttl: "10m",
  });

  token.addGrant({
    roomJoin: true,
    room: battleRoom || live.id,
    canSubscribe: true,
    canPublish: battleRoom ? battleParticipant : (isOwner || isGuest),
  });

  return NextResponse.json({
    serverUrl,
    participantToken: await token.toJwt(),
    isOwner,
    isGuest,
    battleRoom: battleRoom || live.id,
  });
}
