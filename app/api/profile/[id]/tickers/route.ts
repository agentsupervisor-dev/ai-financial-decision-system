import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function authClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET — list tickers for this profile
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await authClient(token).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data } = await sb()
    .from("profile_tickers")
    .select("symbol, added_at")
    .eq("profile_id", id)
    .eq("user_id", user.id)
    .order("added_at");

  return NextResponse.json({ tickers: data ?? [] });
}

// POST — add a ticker to this profile
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await authClient(token).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { symbol } = await req.json();
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  const { error: insertErr } = await sb()
    .from("profile_tickers")
    .upsert({ profile_id: Number(id), user_id: user.id, symbol: symbol.toUpperCase() }, { onConflict: "profile_id,symbol" });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — remove a ticker from this profile
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await authClient(token).auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  await sb().from("profile_tickers").delete().eq("profile_id", id).eq("user_id", user.id).eq("symbol", symbol);
  return NextResponse.json({ success: true });
}
