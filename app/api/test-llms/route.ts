import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callClaude } from "@/lib/bedrock";
import { getGCPAccessToken } from "@/lib/gcp";

const PING = "Reply with exactly: OK";
const GEMINI_MODEL = "gemini-2.5-flash";

async function testClaude() {
  const start = Date.now();
  const reply = await callClaude(PING, { maxTokens: 10 });
  return { ok: reply.includes("OK"), reply: reply.trim(), ms: Date.now() - start };
}

async function testGemini() {
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
  const start = Date.now();

  if (gac.trim().startsWith("{") && project) {
    try {
      const token = await getGCPAccessToken(gac);
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: PING }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
        cache: "no-store",
      });
      const data = await res.json() as { candidates?: { content: { parts: { text: string }[] } }[] };
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data);
      return { ok: reply.includes("OK"), reply: reply.trim(), via: "Vertex AI (GCP credits)", ms: Date.now() - start };
    } catch (e) {
      return { ok: false, reply: String(e), via: "Vertex AI (GCP credits) — failed", ms: Date.now() - start };
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reply: "Neither GOOGLE_APPLICATION_CREDENTIALS nor GEMINI_API_KEY set", via: "none", ms: 0 };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: PING }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
        cache: "no-store",
      }
    );
    const data = await res.json() as { candidates?: { content: { parts: { text: string }[] } }[] };
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data);
    return { ok: reply.includes("OK"), reply: reply.trim(), via: "Google AI Studio (API key)", ms: Date.now() - start };
  } catch (e) {
    return { ok: false, reply: String(e), via: "Google AI Studio (API key) — failed", ms: Date.now() - start };
  }
}

async function testFMP() {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return { ok: false, reply: "FMP_API_KEY not set", ms: 0, endpoints: [] as string[] };
  const start = Date.now();
  const base = "https://financialmodelingprep.com";
  const ticker = "AAPL";

  const checks: { name: string; ok: boolean; detail: string }[] = [];

  // 1. Company profile (all plans)
  try {
    const res = await fetch(`${base}/stable/profile?symbol=${ticker}&apikey=${apiKey}`, { cache: "no-store" });
    const data = await res.json();
    const name = Array.isArray(data) ? (data[0] as Record<string, unknown>)?.companyName : null;
    checks.push({ name: "Profile", ok: !!name, detail: name ? String(name) : JSON.stringify(data).slice(0, 120) });
  } catch (e) {
    checks.push({ name: "Profile", ok: false, detail: String(e) });
  }

  // 2. Income statement (starter+)
  try {
    const res = await fetch(`${base}/stable/income-statement?symbol=${ticker}&limit=1&apikey=${apiKey}`, { cache: "no-store" });
    const data = await res.json();
    const ok = Array.isArray(data) && data.length > 0;
    checks.push({ name: "Income Statement", ok, detail: ok ? `${data.length} period(s) returned` : JSON.stringify(data).slice(0, 120) });
  } catch (e) {
    checks.push({ name: "Income Statement", ok: false, detail: String(e) });
  }

  // 3. Earnings call transcript (ultimate) — try stable then v3
  try {
    let data: unknown[] = [];
    let usedPath = "";

    const stableRes = await fetch(`${base}/stable/earning_call_transcript?symbol=${ticker}&limit=1&apikey=${apiKey}`, { cache: "no-store" });
    const stableData = await stableRes.json();
    if (Array.isArray(stableData) && stableData.length > 0 && (stableData[0] as Record<string, unknown>)?.content) {
      data = stableData; usedPath = "stable";
    } else {
      const year = new Date().getFullYear();
      const v3Res = await fetch(`${base}/v3/earning_call_transcript/${ticker}?year=${year}&quarter=4&apikey=${apiKey}`, { cache: "no-store" });
      const v3Data = await v3Res.json();
      if (Array.isArray(v3Data) && v3Data.length > 0 && (v3Data[0] as Record<string, unknown>)?.content) {
        data = v3Data; usedPath = "v3";
      } else {
        const v3Res2 = await fetch(`${base}/v3/earning_call_transcript/${ticker}?year=${year}&quarter=1&apikey=${apiKey}`, { cache: "no-store" });
        const v3Data2 = await v3Res2.json();
        if (Array.isArray(v3Data2) && v3Data2.length > 0) { data = v3Data2; usedPath = "v3-q1"; }
      }
    }

    const ok = data.length > 0 && !!(data[0] as Record<string, unknown>)?.content;
    const chars = ok ? String((data[0] as Record<string, unknown>).content).length : 0;
    checks.push({ name: "Earnings Transcript", ok, detail: ok ? `${chars} chars (${usedPath})` : `[] on both stable+v3 — may need to enable transcript access on FMP dashboard` });
  } catch (e) {
    checks.push({ name: "Earnings Transcript", ok: false, detail: String(e) });
  }

  const allOk = checks.every((c) => c.ok);
  return {
    ok: allOk,
    reply: checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`).join(" | "),
    ms: Date.now() - start,
    checks,
  };
}

async function testDeepSeek() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, reply: "OPENROUTER_API_KEY not set — asymmetry agent falls back to Claude", ms: 0 };
  const start = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek/deepseek-chat", messages: [{ role: "user", content: PING }], max_tokens: 10 }),
      cache: "no-store",
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? JSON.stringify(data);
    return { ok: reply.includes("OK"), reply: reply.trim(), ms: Date.now() - start };
  } catch (e) {
    return { ok: false, reply: String(e), ms: Date.now() - start };
  }
}

export async function GET(req: NextRequest) {
  // Require a valid logged-in session
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [claude, gemini, deepseek, fmp] = await Promise.all([testClaude(), testGemini(), testDeepSeek(), testFMP()]);
  return NextResponse.json({
    llms: {
      claude:   { model: "Claude Haiku 4.5 (Bedrock)",   ...claude },
      gemini:   { model: "Gemini 2.5 Flash (Vertex AI)", ...gemini },
      deepseek: { model: "DeepSeek Chat (OpenRouter)",    ...deepseek },
    },
    fmp: { model: "Financial Modeling Prep (AAPL)", ...fmp },
  });
}
