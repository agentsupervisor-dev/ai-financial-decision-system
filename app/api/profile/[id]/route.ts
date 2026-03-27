import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// PUT — update a specific profile
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = serverSupabase(token);
  const { id } = await params;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, investment_period, inflation, borrowing, index_return, opex, alpha_target } = body;

  const { data, error } = await supabase
    .from("profiles")
    .update({ name, investment_period, inflation, borrowing, index_return, opex, alpha_target })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    const msg = String(error.message ?? "");
    const isDuplicate = String(error.code) === "23505" || msg.toLowerCase().includes("duplicate key") || msg.toLowerCase().includes("unique constraint");
    return NextResponse.json(
      { error: isDuplicate ? "A profile with that name already exists." : msg },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ profile: data });
}

// DELETE — delete a specific profile
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = serverSupabase(token);
  const { id } = await params;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
