import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {

  const apiKey = process.env.FMP_API_KEY;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const tickers = ["AAPL","MSFT","NVDA","GOOGL","AMZN"];

  let inserted = [];

  for (const ticker of tickers) {

    const url = `https://financialmodelingprep.com/stable/profile?symbol=${ticker}&apikey=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.length > 0) {

      await supabase.from("decisions").insert([
        {
          ticker: data[0].symbol,
          recommendation: "PENDING",
          triangulation_summary: data[0].companyName
        }
      ]);

      inserted.push(data[0].symbol);
    }
  }

  return NextResponse.json({
    message: "Companies ingested",
    companies: inserted
  });
}