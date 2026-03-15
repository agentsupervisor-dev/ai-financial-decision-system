import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: companies } = await supabase
    .from("decisions")
    .select("*")
    .eq("recommendation", "PENDING");

  let analyzed = [];

  for (const company of companies || []) {

    // Placeholder AI logic
    const recommendation = Math.random() > 0.5 ? "BUY" : "SELL";

    await supabase
      .from("decisions")
      .update({ recommendation })
      .eq("id", company.id);

    analyzed.push(company.ticker);
  }

  return NextResponse.json({
    message: "Analysis complete",
    companies: analyzed
  });
}