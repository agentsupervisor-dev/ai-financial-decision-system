import { NextResponse } from "next/server";
import { callClaude } from "@/lib/bedrock";

const PING = "Reply with exactly: OK";

async function testClaude() {
  const start = Date.now();
  const reply = await callClaude(PING, { maxTokens: 10 });
  return { ok: reply.includes("OK"), reply: reply.trim(), ms: Date.now() - start };
}

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reply: "GEMINI_API_KEY not set — macro agent falls back to Claude", ms: 0 };
  const start = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: PING }] }], generationConfig: { maxOutputTokens: 10 } }),
        cache: "no-store",
      }
    );
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data);
    return { ok: reply.includes("OK"), reply: reply.trim(), ms: Date.now() - start };
  } catch (e) {
    return { ok: false, reply: String(e), ms: Date.now() - start };
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
