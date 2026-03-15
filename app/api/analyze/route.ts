import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { askClaude } from "@/lib/bedrock";


export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase environment variables" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const { data: rows, error } = await supabase
  .from("decisions")
  .select("*")
  .eq("recommendation", "PENDING")
  .order("created_at", { ascending: true })
  .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updated: string[] = [];

  for (const row of rows || []) {
    const apiKey = process.env.FMP_API_KEY;

    const profileUrl = `https://financialmodelingprep.com/stable/profile?symbol=${row.ticker}&apikey=${apiKey}`;

    const res = await fetch(profileUrl);
    const profile = await res.json();

    const company = profile[0];
    const prompt = `
    You are a professional equity research analyst.

    Analyze the company below and give an investment recommendation.

    Company: ${company.companyName}
    Ticker: ${company.symbol}
    Sector: ${company.sector}
    Industry: ${company.industry}
    Market Cap: ${company.marketCap}

    Business Description:
    ${company.description}

    Return format:

    Recommendation: BUY, HOLD, or SELL
    Reason: one short sentence
`;

const aiResponse = await askClaude(prompt);

let recommendation = "HOLD";

if (aiResponse.includes("BUY")) recommendation = "BUY";
if (aiResponse.includes("SELL")) recommendation = "SELL";

    const { error: updateError } = await supabase
      .from("decisions")
      .update({
        recommendation,
        triangulation_summary: aiResponse,
      })
      .eq("id", row.id);

    if (!updateError) {
      updated.push(row.ticker);
    }
  }

  return NextResponse.json({
    message: "Analysis complete",
    updatedCount: updated.length,
    updated,
  });
}