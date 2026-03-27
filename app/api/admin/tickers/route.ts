import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAIL ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function serviceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function assertSuperuser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error } = await anon.auth.getUser();
  if (error || !user) return null;
  if (!SUPERUSER_EMAILS.length || !SUPERUSER_EMAILS.includes((user.email ?? "").toLowerCase())) return null;
  return user;
}

// GET — return all tickers
export async function GET(req: NextRequest) {
  const user = await assertSuperuser(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = serviceSupabase();
  const { data, error } = await sb.from("admin_tickers").select("symbol, added_by, added_at").order("added_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tickers: (data ?? []).map((r) => r.symbol) });
}

// PUT — replace full ticker list
export async function PUT(req: NextRequest) {
  const user = await assertSuperuser(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { tickers } = await req.json() as { tickers: string[] };
  const symbols = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];

  const sb = serviceSupabase();

  // Delete all existing, then insert new list
  const { error: delError } = await sb.from("admin_tickers").delete().neq("symbol", "");
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  if (symbols.length > 0) {
    const { error: insError } = await sb.from("admin_tickers").insert(
      symbols.map((symbol) => ({ symbol, added_by: user.email }))
    );
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ tickers: symbols });
}
