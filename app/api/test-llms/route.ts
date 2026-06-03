import { NextResponse } from "next/server";
import { callClaude } from "@/lib/bedrock";

const PING = "Reply with exactly: OK";

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

  // Try Vertex AI first (uses GCP $300 credits)
  if (gac.trim().startsWith("{") && project) {
    try {
      const sa = JSON.parse(gac);
      const now = Math.floor(Date.now() / 1000);
      const { createSign } = await import("crypto");
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const claim = Buffer.from(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: sa.token_uri ?? "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now })).toString("base64url");
      const sign = createSign("RSA-SHA256");
      sign.update(`${header}.${claim}`);
      const sig = sign.sign(sa.private_key, "base64url");
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${sig}` }) });
      const tokenData = await tokenRes.json() as { access_token?: string };
      if (!tokenData.access_token) throw new Error(JSON.stringify(tokenData));
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/gemini-2.0-flash-001:generateContent`;
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: PING }] }], generationConfig: { maxOutputTokens: 10 } }), cache: "no-store" });
      const data = await res.json() as { candidates?: { content: { parts: { text: string }[] } }[] };
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data);
      return { ok: reply.includes("OK"), reply: reply.trim(), via: "Vertex AI (GCP credits)", ms: Date.now() - start };
    } catch (e) {
      return { ok: false, reply: String(e), via: "Vertex AI (GCP credits) — failed", ms: Date.now() - start };
    }
  }

  // Fall back to Google AI Studio API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reply: "Neither GOOGLE_APPLICATION_CREDENTIALS nor GEMINI_API_KEY set", via: "none", ms: 0 };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: PING }] }], generationConfig: { maxOutputTokens: 10 } }), cache: "no-store" });
    const data = await res.json() as { candidates?: { content: { parts: { text: string }[] } }[] };
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data);
    return { ok: reply.includes("OK"), reply: reply.trim(), via: "Google AI Studio (API key)", ms: Date.now() - start };
  } catch (e) {
    return { ok: false, reply: String(e), via: "Google AI Studio (API key) — failed", ms: Date.now() - start };
  }
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

export async function GET() {
  const [claude, gemini, deepseek] = await Promise.all([testClaude(), testGemini(), testDeepSeek()]);
  return NextResponse.json({
    claude:   { model: "Claude Haiku 4.5 (Bedrock)",      ...claude },
    gemini:   { model: "Gemini 2.0 Flash (Google AI)",    ...gemini },
    deepseek: { model: "DeepSeek Chat (OpenRouter)",      ...deepseek },
  });
}
