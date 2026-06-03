import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPERUSER_EMAILS = (process.env.SUPERUSER_EMAIL ?? "")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function assertSuperuser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error } = await anon.auth.getUser();
  if (error || !user) return null;
  if (!SUPERUSER_EMAILS.includes((user.email ?? "").toLowerCase())) return null;
  return user;
}

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — all VIP portfolios with user emails and profile names
export async function GET(req: NextRequest) {
  const user = await assertSuperuser(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: portfolios } = await sb()
    .from("vip_portfolios")
    .select("id, profile_id, user_id, initial_balance, current_balance, created_at, profiles(name, universe_key)")
    .order("created_at");

  if (!portfolios?.length) return NextResponse.json({ portfolios: [] });

  // Get user emails from auth.users via the admin API
  const userIds = [...new Set(portfolios.map((p) => p.user_id))];
  const emailMap: Record<string, string> = {};

  await Promise.allSettled(
    userIds.map(async (uid) => {
      const { data } = await sb().auth.admin.getUserById(uid);
      if (data?.user?.email) emailMap[uid] = data.user.email;
    })
  );

  const result = portfolios.map((p) => ({
    ...p,
    user_email: emailMap[p.user_id] ?? p.user_id,
  }));

  return NextResponse.json({ portfolios: result });
}

// PUT — set wallet balance for a portfolio
export async function PUT(req: NextRequest) {
  const user = await assertSuperuser(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { portfolio_id, new_balance, reason } = await req.json();

  if (typeof new_balance !== "number" || new_balance < 0) {
    return NextResponse.json({ error: "Invalid balance amount" }, { status: 400 });
  }

  const { data: portfolio } = await sb()
    .from("vip_portfolios")
    .select("current_balance, profile_id, user_id")
    .eq("id", portfolio_id)
    .single();

  if (!portfolio) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });

  // Update balance
  const { error } = await sb()
    .from("vip_portfolios")
    .update({ current_balance: new_balance })
    .eq("id", portfolio_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Record as a transaction for audit trail
  const diff = new_balance - portfolio.current_balance;
  await sb().from("vip_transactions").insert({
    portfolio_id,
    profile_id:    portfolio.profile_id,
    user_id:       portfolio.user_id,
    type:          diff >= 0 ? "admin_credit" : "admin_debit",
    symbol:        "ADMIN",
    company_name:  reason ?? `Admin adjustment by ${user.email}`,
    quantity:      0,
    price:         0,
    amount:        Math.abs(diff),
    balance_before: portfolio.current_balance,
    balance_after:  new_balance,
  });

  return NextResponse.json({ success: true, new_balance });
}
