import { createClient } from "@supabase/supabase-js";
import { callClaude } from "./bedrock";

// ── types ─────────────────────────────────────────────────────────────────────

export interface TickerAnalysis {
  ticker: string;
  forensic_score: number;
  macro_score: number;
  asymmetry_score: number;
  composite_score: number;
  confidence: number;
  expected_return: number;
  hurdle_rate: number;
  excess_return: number;
  clears_hurdle: boolean;
  final_decision: string;
  decision_summary: string;
  error?: string;
}

// ── LLM clients ───────────────────────────────────────────────────────────────

// Get a short-lived OAuth2 token from a GCP service account JSON string
async function getGCPAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url");

  const { createSign } = await import("crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${claim}`);
  const sig = sign.sign(sa.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${sig}`,
    }),
  });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error("No access token returned");
  return data.access_token;
}

// Gemini 2.0 Flash — prefers Vertex AI (uses GCP $300 credits) via service account,
// falls back to Google AI Studio API key, then Claude.
async function callGemini(prompt: string): Promise<string> {
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

  // Try Vertex AI using service account JSON stored directly in the env var
  if (gac.trim().startsWith("{") && project) {
    try {
      const token = await getGCPAccessToken(gac);
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/gemini-2.0-flash:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
        }),
        cache: "no-store",
      });
      const data = await res.json() as { candidates?: { content: { parts: { text: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch { /* fall through */ }
  }

  // Fall back to Google AI Studio API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
          }),
          cache: "no-store",
        }
      );
      const data = await res.json() as { candidates?: { content: { parts: { text: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch { /* fall through */ }
  }

  return callClaude(prompt);
}

// DeepSeek Chat via OpenRouter (needs OPENROUTER_API_KEY)
async function callDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Fallback to Claude if no OpenRouter key configured
    return callClaude(prompt);
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      }),
      cache: "no-store",
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    return callClaude(prompt);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseTaggedNumber(text: string, tag: string, fallback = 50): number {
  const match = text.match(new RegExp(`${tag}:\\s*(\\d+(?:\\.\\d+)?)`));
  return match ? Math.min(100, Math.max(0, parseFloat(match[1]))) : fallback;
}

async function getCustomPrompt(agent: string): Promise<string | null> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data } = await sb.from("agent_prompts").select("instructions").eq("agent", agent).single();
    return data?.instructions ?? null;
  } catch { return null; }
}

// ── FMP data fetch ────────────────────────────────────────────────────────────

async function fetchFMP(path: string): Promise<unknown> {
  const apiKey = process.env.FMP_API_KEY;
  const res = await fetch(
    `https://financialmodelingprep.com${path}&apikey=${apiKey}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`FMP ${res.status}`);
  return res.json();
}

// ── agents ────────────────────────────────────────────────────────────────────

const FORENSIC_DEFAULT = `You are a forensic financial analyst. Analyze {ticker} for business moat durability.

Analyze:
1. Moat durability (pricing power, switching costs, network effects)
2. Margin trends (compression or expansion)
3. Structural risks (competitive threats, regulatory, disruption)
4. Management quality signals from the transcript`;

async function runForensicAgent(ticker: string): Promise<{ score: number; report: string }> {
  let company: Record<string, unknown> = {};
  let incomeStr = "Not available";
  let transcriptText = "Not available";

  try {
    const profile = await fetchFMP(`/stable/profile?symbol=${ticker}`) as unknown[];
    company = (Array.isArray(profile) ? profile[0] : {}) as Record<string, unknown>;
  } catch { /* use empty */ }

  try {
    const income = await fetchFMP(`/stable/income-statement?symbol=${ticker}&limit=4`) as unknown[];
    incomeStr = JSON.stringify((income as unknown[]).slice(0, 2));
  } catch { /* use fallback */ }

  try {
    const transcript = await fetchFMP(`/stable/earning_call_transcript?symbol=${ticker}&limit=1`) as unknown[];
    const t = Array.isArray(transcript) ? (transcript[0] as Record<string, unknown>) : null;
    transcriptText = t ? String(t.content ?? "").slice(0, 3000) : "Not available";
  } catch { /* use fallback */ }

  const custom = await getCustomPrompt("forensic");
  const instructions = (custom || FORENSIC_DEFAULT).replace(/\{ticker\}/g, ticker);

  const prompt = `${instructions}

Company: ${company.companyName ?? ticker} | Sector: ${company.sector ?? "Unknown"}
Market Cap: ${company.marketCap ?? "Unknown"} | Description: ${String(company.description ?? "").slice(0, 500)}

Recent Income Statements:
${incomeStr}

Latest Earnings Call Transcript (excerpt):
${transcriptText}

End your response with exactly this line:
FORENSIC_SCORE: [number 0-100]`;

  let report: string;
  try {
    report = await callClaude(prompt, { maxTokens: 800 });
  } catch (e) {
    report = `Forensic analysis failed: ${e}\nFORENSIC_SCORE: 50`;
  }

  const score = parseTaggedNumber(report, "FORENSIC_SCORE");
  return { score, report };
}

const MACRO_DEFAULT = `You are a macro strategist and CIO. Analyze the macroeconomic environment affecting {ticker}.

Investment horizon: {horizon}

Consider:
- Current interest rate regime and trajectory over a {horizon} horizon
- Inflation dynamics and real rate impact on valuations
- Sector-specific growth drivers and headwinds
- Global demand conditions and geopolitical risks
- Fed policy and liquidity conditions

The investor requires a {hurdle}% annual return to clear their hurdle rate over {horizon}.
Given macro conditions, assess whether the backdrop supports or hinders achieving this return.`;

async function runMacroAgent(ticker: string, hurdleRate: number, investmentPeriod: string): Promise<{ score: number; report: string }> {
  const periodMap: Record<string, string> = { "1yr": "1 year", "3yr": "3 years", "5yr": "5+ years" };
  const horizon = periodMap[investmentPeriod] ?? "3 years";

  const custom = await getCustomPrompt("macro");
  const instructions = (custom || MACRO_DEFAULT)
    .replace(/\{ticker\}/g, ticker)
    .replace(/\{horizon\}/g, horizon)
    .replace(/\{hurdle\}/g, String(hurdleRate));

  const prompt = `${instructions}

End your response with exactly this line:
MACRO_SCORE: [number 0-100, where 100 = extremely favorable macro backdrop]`;

  let report: string;
  try {
    report = await callGemini(prompt);
  } catch (e) {
    report = `Macro analysis failed: ${e}\nMACRO_SCORE: 50`;
  }

  const score = parseTaggedNumber(report, "MACRO_SCORE");
  return { score, report };
}

const ASYMMETRY_DEFAULT = `You are a hedge fund analyst specializing in asymmetric risk/reward opportunities.

Analyze {ticker} for:
1. Mispricing signals (vs. intrinsic value, sector peers, historical multiples)
2. Hidden catalysts (product launches, regulatory approvals, M&A potential, spin-offs)
3. Downside protection (balance sheet strength, cash flows, floor valuation)
4. Upside/downside asymmetry ratio

The investor's hurdle rate is {hurdle}% per year and investment horizon is {horizon}.
Estimate the realistic expected annual return if the thesis plays out over {horizon}.`;

async function runAsymmetryAgent(ticker: string, hurdleRate: number, investmentPeriod: string): Promise<{ score: number; expectedReturn: number; report: string }> {
  const periodMap: Record<string, string> = { "1yr": "1 year", "3yr": "3 years", "5yr": "5+ years" };
  const horizon = periodMap[investmentPeriod] ?? "3 years";

  const custom = await getCustomPrompt("asymmetry");
  const instructions = (custom || ASYMMETRY_DEFAULT)
    .replace(/\{ticker\}/g, ticker)
    .replace(/\{horizon\}/g, horizon)
    .replace(/\{hurdle\}/g, String(hurdleRate));

  const prompt = `${instructions}

End your response with exactly these two lines:
ASYMMETRY_SCORE: [number 0-100, where 100 = extreme asymmetric upside]
EXPECTED_RETURN: [number, estimated annual % return e.g. 18.5]`;

  let report: string;
  try {
    report = await callDeepSeek(prompt);
  } catch (e) {
    report = `Asymmetry analysis failed: ${e}\nASYMMETRY_SCORE: 50\nEXPECTED_RETURN: 10`;
  }

  const score = parseTaggedNumber(report, "ASYMMETRY_SCORE");
  const returnMatch = report.match(/EXPECTED_RETURN:\s*(\d+(?:\.\d+)?)/);
  const expectedReturn = returnMatch ? parseFloat(returnMatch[1]) : 10;

  return { score, expectedReturn, report };
}

const DECISION_DEFAULT = `You are an investment committee chair writing a rationale for a decision already made by the rule engine.

Write a 2-3 sentence rationale explaining why this {decision} decision was reached. Reference the investment horizon where relevant (e.g. short-term needs higher conviction, long-term can ride out volatility). Be direct and factual.`;

async function runDecisionAgent(
  ticker: string,
  investmentPeriod: string,
  hurdleRate: number,
  forensicScore: number,
  macroScore: number,
  asymmetryScore: number,
  expectedReturn: number,
  forensicReport: string,
  macroReport: string,
  asymmetryReport: string,
): Promise<{ decision: string; composite: number; confidence: number; summary: string }> {
  // Rule-based composite and decision (matches Python orchestrator exactly)
  const composite = Math.round((forensicScore * 0.40 + macroScore * 0.30 + asymmetryScore * 0.30) * 10) / 10;
  const spread = Math.max(forensicScore, macroScore, asymmetryScore) - Math.min(forensicScore, macroScore, asymmetryScore);
  const confidence = Math.round(Math.max(0, 100 - spread) * 10) / 10;
  const clears = expectedReturn >= hurdleRate;
  const excess = Math.round((expectedReturn - hurdleRate) * 100) / 100;
  const thresholds: Record<string, number> = { "1yr": 65, "3yr": 55, "5yr": 48 };
  const threshold = thresholds[investmentPeriod] ?? 55;

  let decision: string;
  if (composite >= threshold && confidence >= 50 && clears) {
    decision = "BUY";
  } else if (composite < 45 || !clears) {
    decision = "REJECT";
  } else {
    decision = "HOLD";
  }

  const periodMap: Record<string, string> = { "1yr": "1 year (short-term)", "3yr": "3 years (medium-term)", "5yr": "5+ years (long-term)" };
  const horizon = periodMap[investmentPeriod] ?? "3 years (medium-term)";

  const custom = await getCustomPrompt("decision");
  const instructions = (custom || DECISION_DEFAULT)
    .replace(/\{ticker\}/g, ticker)
    .replace(/\{decision\}/g, decision)
    .replace(/\{horizon\}/g, horizon);

  const prompt = `${instructions}

TICKER: ${ticker}
INVESTMENT HORIZON: ${horizon}
DECISION: ${decision}

AGENT SCORES:
- Forensic (business quality): ${forensicScore}/100
- Macro (economic backdrop): ${macroScore}/100
- Asymmetry (risk/reward): ${asymmetryScore}/100
- Composite Score: ${composite}/100 (BUY threshold for this horizon: ${threshold})
- Triangulation Confidence: ${confidence}%

HURDLE MATH:
- Required return: ${hurdleRate}%
- Expected return: ${expectedReturn}%
- Excess return: ${excess}%
- Clears hurdle: ${clears ? "YES" : "NO"}

FORENSIC SUMMARY:
${forensicReport.slice(0, 800)}

MACRO SUMMARY:
${macroReport.slice(0, 600)}

ASYMMETRY SUMMARY:
${asymmetryReport.slice(0, 600)}

End with exactly: DECISION: ${decision}`;

  let summary: string;
  try {
    summary = await callClaude(prompt, { maxTokens: 400 });
  } catch (e) {
    summary = `Decision analysis failed: ${e}\nDECISION: ${decision}`;
  }

  return { decision, composite, confidence, summary };
}

// ── full ticker analysis ──────────────────────────────────────────────────────

export async function analyzeTicker(
  ticker: string,
  hurdleRate: number,
  investmentPeriod: string,
): Promise<TickerAnalysis> {
  try {
    // Run Forensic, Macro, Asymmetry in parallel
    const [forensic, macro, asymmetry] = await Promise.all([
      runForensicAgent(ticker),
      runMacroAgent(ticker, hurdleRate, investmentPeriod),
      runAsymmetryAgent(ticker, hurdleRate, investmentPeriod),
    ]);

    const decision = await runDecisionAgent(
      ticker, investmentPeriod, hurdleRate,
      forensic.score, macro.score, asymmetry.score,
      asymmetry.expectedReturn,
      forensic.report, macro.report, asymmetry.report,
    );

    const excessReturn = Math.round((asymmetry.expectedReturn - hurdleRate) * 100) / 100;

    return {
      ticker,
      forensic_score: forensic.score,
      macro_score: macro.score,
      asymmetry_score: asymmetry.score,
      composite_score: decision.composite,
      confidence: decision.confidence,
      expected_return: asymmetry.expectedReturn,
      hurdle_rate: hurdleRate,
      excess_return: excessReturn,
      clears_hurdle: asymmetry.expectedReturn >= hurdleRate,
      final_decision: decision.decision,
      decision_summary: decision.summary,
    };
  } catch (e) {
    return {
      ticker,
      forensic_score: 0, macro_score: 0, asymmetry_score: 0,
      composite_score: 0, confidence: 0,
      expected_return: 0, hurdle_rate: hurdleRate,
      excess_return: -hurdleRate,
      clears_hurdle: false,
      final_decision: "REJECT",
      decision_summary: "Analysis failed.",
      error: String(e),
    };
  }
}
