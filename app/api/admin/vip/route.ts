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

// GET — all profiles with their VIP wallet status (creates wallet row if missing)
export async function GET(req: NextRequest) {
  const admin = await assertSuperuser(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Load all profiles
  const { data: profiles } = await sb()
    .from("profiles")
    .select("id, name, user_id, universe_key, investment_period")
    .order("created_at");

  if (!profiles?.length) return NextResponse.json({ portfolios: [] });

  // Load existing VIP portfolios
  const { data: existingPortfolios } = await sb()
    .from("vip_portfolios")
    .select("*");

  const portfolioByProfile = Object.fromEntries(
    (existingPortfolios ?? []).map((p) => [p.profile_id, p])
  );

  // Get user emails
  const userIds = [...new Set(profiles.map((p) => p.user_id))];
  const emailMap: Record<string, string> = {};
  await Promise.allSettled(
    userIds.map(async (uid) => {
      const { data } = await sb().auth.admin.getUserById(uid);
      if (data?.user?.email) emailMap[uid] = data.user.email;
    })
  );

  // Merge: return all profiles with their wallet status
  const result = profiles.map((profile) => {
    const wallet = portfolioByProfile[profile.id] ?? null;
    return {
      profile_id:       profile.id,
      profile_name:     profile.name,
      universe_key:     profile.universe_key,
      user_id:          profile.user_id,
      user_email:       emailMap[profile.user_id] ?? profile.user_id,
      portfolio_id:     wallet?.id ?? null,
      initial_balance:  wallet?.initial_balance ?? 10000,
      current_balance:  wallet?.current_balance ?? null, // null = not yet created
    };
  });

  return NextResponse.json({ portfolios: result });
}

// PUT — set wallet balance for a profile (creates wallet if it doesn't exist)
export async function PUT(req: NextRequest) {
  const admin = await assertSuperuser(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { profile_id, new_balance, reason } = await req.json();

  if (typeof new_balance !== "number" || new_balance < 0) {
    return NextResponse.json({ error: "Invalid balance amount" }, { status: 400 });
  }

  // Get profile to find user_id
  const { data: profile } = await sb().from("profiles").select("user_id").eq("id", profile_id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Upsert portfolio
  const { data: portfolio, error: upsertErr } = await sb()
    .from("vip_portfolios")
    .upsert(
      { profile_id, user_id: profile.user_id, initial_balance: new_balance, current_balance: new_balance },
      { onConflict: "profile_id" }
    )
    .select()
    .single();

  if (upsertErr || !portfolio) return NextResponse.json({ error: upsertErr?.message ?? "Upsert failed" }, { status: 500 });

  // If portfolio already existed, just update balance (upsert overwrites initial_balance which we don't want)
  const existing = await sb().from("vip_portfolios").select("current_balance").eq("profile_id", profile_id).single();
  const balanceBefore = existing.data?.current_balance ?? new_balance;

  await sb().from("vip_portfolios").update({ current_balance: new_balance }).eq("profile_id", profile_id);

  // Audit log
  await sb().from("vip_transactions").insert({
    portfolio_id:  portfolio.id,
    profile_id,
    user_id:       profile.user_id,
    type:          "admin_credit",
    symbol:        "ADMIN",
    company_name:  reason ?? `Admin allocation by ${admin.email}`,
    quantity:      0,
    price:         0,
    amount:        Math.abs(new_balance - balanceBefore),
    balance_before: balanceBefore,
    balance_after:  new_balance,
  });

  return NextResponse.json({ success: true, new_balance });
}
