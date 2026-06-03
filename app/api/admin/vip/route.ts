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

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET — all users with their wallet status (one wallet per user)
export async function GET(req: NextRequest) {
  const admin = await assertSuperuser(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get all unique users from profiles
  const { data: profiles } = await sb().from("profiles").select("user_id").order("created_at");
  const userIds = [...new Set((profiles ?? []).map((p) => p.user_id))];

  // Get existing wallets
  const { data: wallets } = await sb().from("vip_portfolios").select("*").in("user_id", userIds);
  const walletByUser = Object.fromEntries((wallets ?? []).map((w) => [w.user_id, w]));

  // Get emails
  const emailMap: Record<string, string> = {};
  await Promise.allSettled(userIds.map(async (uid) => {
    const { data } = await sb().auth.admin.getUserById(uid);
    if (data?.user?.email) emailMap[uid] = data.user.email;
  }));

  // Count profiles per user
  const { data: allProfiles } = await sb().from("profiles").select("user_id, id, name");
  const profilesByUser: Record<string, { id: number; name: string }[]> = {};
  for (const p of allProfiles ?? []) {
    profilesByUser[p.user_id] = [...(profilesByUser[p.user_id] ?? []), { id: p.id, name: p.name }];
  }

  const result = userIds.map((uid) => {
    const wallet = walletByUser[uid] ?? null;
    return {
      user_id:         uid,
      user_email:      emailMap[uid] ?? uid,
      wallet_id:       wallet?.id ?? null,
      initial_balance: wallet?.initial_balance ?? 10000,
      current_balance: wallet?.current_balance ?? null,
      profiles:        profilesByUser[uid] ?? [],
    };
  });

  return NextResponse.json({ users: result });
}

// PUT — set wallet balance for a user
export async function PUT(req: NextRequest) {
  const admin = await assertSuperuser(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, new_balance, reason } = await req.json();
  if (typeof new_balance !== "number" || new_balance < 0) {
    return NextResponse.json({ error: "Invalid balance" }, { status: 400 });
  }

  // Upsert wallet for user
  const { data: wallet, error: upsertErr } = await sb()
    .from("vip_portfolios")
    .upsert({ user_id, initial_balance: new_balance, current_balance: new_balance }, { onConflict: "user_id" })
    .select().single();

  if (upsertErr || !wallet) return NextResponse.json({ error: upsertErr?.message ?? "Failed" }, { status: 500 });

  // Audit log
  await sb().from("vip_transactions").insert({
    portfolio_id:   wallet.id,
    profile_id:     null,
    user_id,
    type:           "admin_credit",
    symbol:         "ADMIN",
    company_name:   reason ?? `Admin allocation by ${admin.email}`,
    quantity:       0, price: 0,
    amount:         new_balance,
    balance_before: 0,
    balance_after:  new_balance,
  });

  return NextResponse.json({ success: true, new_balance });
}
