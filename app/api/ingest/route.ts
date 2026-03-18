import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TICKERS } from "@/data/tickers";

async function fetchProfile(symbol: string, apiKey: string) {
  const candidates = [symbol];

  if (symbol.includes(".")) {
    candidates.push(symbol.replace(/\./g, "-"));
  }

  for (const candidate of candidates) {
    const url = `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(candidate)}&apikey=${apiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        reason: `Non-JSON response: ${text.slice(0, 120)}`,
      };
    }

    if (Array.isArray(data) && data.length > 0) {
      return { ok: true, data: data[0] };
    }
  }

  return { ok: false, reason: "Empty profile response" };
}

export async function GET() {
  const apiKey = process.env.FMP_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing FMP_API_KEY" }, { status: 500 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase environment variables" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const inserted: string[] = [];
  const skipped: string[] = [];
  const failed: { ticker: string; reason: string }[] = [];

  for (const ticker of TICKERS) {
    try {
      const profile = await fetchProfile(ticker, apiKey);

      if (!profile.ok) {
        failed.push({ ticker, reason: profile.reason ?? "Unknown error" });
        continue;
      }

      const company = profile.data;

      const { data: existing, error: existingError } = await supabase
        .from("decisions")
        .select("id")
        .eq("ticker", company.symbol)
        .limit(1);

      if (existingError) {
        failed.push({ ticker, reason: existingError.message });
        continue;
      }

      if (existing && existing.length > 0) {
        skipped.push(company.symbol);
        continue;
      }

      const { error: insertError } = await supabase.from("decisions").insert([
        {
          ticker: company.symbol,
          recommendation: "PENDING",
          triangulation_summary: company.companyName,
        },
      ]);

      if (insertError) {
        failed.push({ ticker, reason: insertError.message });
        continue;
      }

      inserted.push(company.symbol);
    } catch (error) {
      failed.push({
        ticker,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    message: "Ingestion complete",
    insertedCount: inserted.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    inserted,
    skipped,
    failed,
  });
}