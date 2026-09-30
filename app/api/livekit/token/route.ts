import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const liveId = typeof body?.liveId === "string" ? body.liveId : "";

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

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json(
      { error: "LiveKit n'est pas encore configuré côté serveur." },
      { status: 500 },
    );
  }

  const isOwner = live.user_id === user.id;

  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.id,
    ttl: "10m",
  });

  token.addGrant({
    roomJoin: true,
    room: live.id,
    canSubscribe: true,
    canPublish: isOwner,
  });

  return NextResponse.json({
    serverUrl,
    participantToken: await token.toJwt(),
    isOwner,
  });
}
