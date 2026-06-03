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

  const [claude, gemini, deepseek] = await Promise.all([testClaude(), testGemini(), testDeepSeek()]);
  return NextResponse.json({
    claude:   { model: "Claude Haiku 4.5 (Bedrock)",        ...claude },
    gemini:   { model: `Gemini 2.5 Flash (Vertex AI)`,      ...gemini },
    deepseek: { model: "DeepSeek Chat (OpenRouter)",         ...deepseek },
  });
}
