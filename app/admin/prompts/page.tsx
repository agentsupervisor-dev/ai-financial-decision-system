"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

const AGENTS = [
  {
    key: "forensic",
    label: "Forensic Agent",
    model: "Claude",
    hint: "Available placeholders: {ticker}",
    defaultInstructions:
`You are a forensic financial analyst. Analyze {ticker} for business moat durability.

Analyze:
1. Moat durability (pricing power, switching costs, network effects)
2. Margin trends (compression or expansion)
3. Structural risks (competitive threats, regulatory, disruption)
4. Management quality signals from the transcript`,
  },
  {
    key: "macro",
    label: "Macro Agent",
    model: "Gemini",
    hint: "Available placeholders: {ticker}, {horizon}, {hurdle}",
    defaultInstructions:
`You are a macro strategist and CIO. Analyze the macroeconomic environment affecting {ticker}.

Investment horizon: {horizon}

Consider:
- Current interest rate regime and trajectory over a {horizon} horizon
- Inflation dynamics and real rate impact on valuations
- Sector-specific growth drivers and headwinds
- Global demand conditions and geopolitical risks
- Fed policy and liquidity conditions

The investor requires a {hurdle}% annual return to clear their hurdle rate over {horizon}.
Given macro conditions, assess whether the backdrop supports or hinders achieving this return.`,
  },
  {
    key: "asymmetry",
    label: "Asymmetry Agent",
    model: "DeepSeek",
    hint: "Available placeholders: {ticker}, {horizon}, {hurdle}",
    defaultInstructions:
`You are a hedge fund analyst specializing in asymmetric risk/reward opportunities.

Analyze {ticker} for:
1. Mispricing signals (vs. intrinsic value, sector peers, historical multiples)
2. Hidden catalysts (product launches, regulatory approvals, M&A potential, spin-offs)
3. Downside protection (balance sheet strength, cash flows, floor valuation)
4. Upside/downside asymmetry ratio

The investor's hurdle rate is {hurdle}% per year and investment horizon is {horizon}.
Estimate the realistic expected annual return if the thesis plays out over {horizon}.`,
  },
  {
    key: "decision",
    label: "Decision Agent",
    model: "Claude",
    hint: "Available placeholders: {ticker}, {decision}, {horizon}",
    defaultInstructions:
`You are an investment committee chair writing a rationale for a decision already made by the rule engine.

Write a 2-3 sentence rationale explaining why this {decision} decision was reached. Reference the investment horizon where relevant (e.g. short-term needs higher conviction, long-term can ride out volatility). Be direct and factual.`,
  },
];

export default function AdminPromptsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<"tickers" | "prompts">("tickers");

  // Tickers state
  const [tickers, setTickers] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [savingTickers, setSavingTickers] = useState(false);
  const [savedTickers, setSavedTickers] = useState(false);
  const [tickerError, setTickerError] = useState<string | null>(null);

  // Prompts state
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setToken(session.access_token);

      const [tickerRes, promptRes] = await Promise.all([
        fetch("/api/admin/tickers", { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch("/api/admin/prompts",  { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ]);
      if (tickerRes.status === 403 || promptRes.status === 403) { router.replace("/"); return; }

      const tickerJson = await tickerRes.json();
      setTickers(tickerJson.tickers ?? []);

      const promptJson = await promptRes.json();
      const map: Record<string, string> = {};
      (promptJson.prompts ?? []).forEach((p: { agent: string; instructions: string }) => {
        map[p.agent] = p.instructions;
      });
      setInstructions(map);
      setLoading(false);
    }
    init();
  }, [router]);

  // ── Ticker helpers ──────────────────────────────────────────
  function addTicker() {
    const sym = newTicker.trim().toUpperCase();
    if (!sym) return;
    if (tickers.includes(sym)) { setTickerError(`${sym} is already in the list.`); return; }
    setTickers((prev) => [...prev, sym]);
    setNewTicker("");
    setTickerError(null);
  }

  function removeTicker(sym: string) {
    setTickers((prev) => prev.filter((t) => t !== sym));
  }

  async function saveTickers() {
    if (!token) return;
    setSavingTickers(true);
    setTickerError(null);
    const res = await fetch("/api/admin/tickers", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tickers }),
    });
    if (!res.ok) {
      const json = await res.json();
      setTickerError(json.error || "Save failed");
    } else {
      setSavedTickers(true);
      setTimeout(() => setSavedTickers(false), 2500);
    }
    setSavingTickers(false);
  }

  // ── Prompt helpers ──────────────────────────────────────────
  async function handleSave(agentKey: string) {
    if (!token) return;
    setSaving(agentKey);
    setPromptError(null);
    const res = await fetch("/api/admin/prompts", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ agent: agentKey, instructions: instructions[agentKey] }),
    });
    if (!res.ok) {
      const json = await res.json();
      setPromptError(json.error || "Save failed");
    } else {
      setSaved(agentKey);
      setTimeout(() => setSaved(null), 2500);
    }
    setSaving(null);
  }

  function handleReset(agentKey: string) {
    const agent = AGENTS.find((a) => a.key === agentKey);
    if (agent) setInstructions((prev) => ({ ...prev, [agentKey]: agent.defaultInstructions }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" style={APPLE}>
        <p className="text-[#6e6e73] text-[15px]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]" style={APPLE}>
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="text-[#0071e3] text-[13px] hover:underline">← Dashboard</button>
          <span className="text-[13px] font-medium text-[#1d1d1f]">Admin</span>
          <span className="text-[11px] px-2.5 py-1 rounded-lg font-semibold tracking-wider"
            style={{ background: "#fef6e0", color: "#a3730a" }}>SUPERUSER</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 pb-24">
        {/* Tabs */}
        <div className="flex gap-1 bg-[#e5e5ea] p-1 rounded-xl mb-8 w-fit">
          {(["tickers", "prompts"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-[14px] font-medium transition-all"
              style={{
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "#1d1d1f" : "#6e6e73",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}>
              {t === "tickers" ? "Ticker List" : "Agent Prompts"}
            </button>
          ))}
        </div>

        {/* ── TICKERS TAB ── */}
        {tab === "tickers" && (
          <div>
            <div className="mb-6">
              <h1 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight">Ticker List</h1>
              <p className="mt-1 text-[15px] text-[#6e6e73]">These stocks are scanned on every Run Scan. Falls back to built-in defaults if empty.</p>
            </div>

            {tickerError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600 mb-5">{tickerError}</div>
            )}

            <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 mb-4">
              {/* Add ticker input */}
              <div className="flex gap-2 mb-5">
                <input
                  type="text"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && addTicker()}
                  placeholder="e.g. MSFT"
                  className="flex-1 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-2.5 text-[15px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all font-mono uppercase"
                />
                <button onClick={addTicker}
                  className="px-5 py-2.5 rounded-xl text-[14px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: "#0071e3" }}>
                  Add
                </button>
              </div>

              {/* Ticker chips */}
              {tickers.length === 0 ? (
                <p className="text-[13px] text-[#aeaeb2] text-center py-4">No tickers added — defaults (AAPL, TSLA, NFLX) will be used.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tickers.map((sym) => (
                    <div key={sym} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0f6ff] border border-[#c7dcff]">
                      <span className="text-[13px] font-semibold text-[#0071e3] font-mono">{sym}</span>
                      <button onClick={() => removeTicker(sym)}
                        className="text-[#aeaeb2] hover:text-red-500 transition-colors text-[14px] leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={saveTickers} disabled={savingTickers}
                className="px-6 py-2.5 rounded-xl text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: savedTickers ? "#34c759" : "#0071e3" }}>
                {savingTickers ? "Saving…" : savedTickers ? "Saved ✓" : "Save Ticker List"}
              </button>
            </div>
          </div>
        )}

        {/* ── PROMPTS TAB ── */}
        {tab === "prompts" && (
          <div>
            <div className="mb-6">
              <h1 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight">Agent Prompts</h1>
              <p className="mt-1 text-[15px] text-[#6e6e73]">
                Customize the instructions sent to each AI agent. Placeholders in <code className="bg-[#f0f0f5] px-1.5 py-0.5 rounded text-[13px]">{"{ }"}</code> are filled automatically at scan time.
              </p>
              <p className="mt-1.5 text-[13px] text-[#aeaeb2]">
                The required output format line (e.g. <code className="bg-[#f0f0f5] px-1 rounded">FORENSIC_SCORE:</code>) is always appended by the system — do not include it here.
              </p>
            </div>

            {promptError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600 mb-6">{promptError}</div>
            )}

            <div className="space-y-6">
              {AGENTS.map((agent) => {
                const value = instructions[agent.key] ?? agent.defaultInstructions;
                const isSaving = saving === agent.key;
                const isSaved = saved === agent.key;
                return (
                  <div key={agent.key} className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{agent.label}</h2>
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-medium text-[#6e6e73] bg-[#f5f5f7]">{agent.model}</span>
                    </div>
                    <p className="text-[12px] text-[#aeaeb2] mb-3">{agent.hint}</p>
                    <textarea
                      value={value}
                      onChange={(e) => setInstructions((prev) => ({ ...prev, [agent.key]: e.target.value }))}
                      rows={10}
                      className="w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3 text-[14px] text-[#1d1d1f] font-mono leading-relaxed focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all resize-y"
                    />
                    <div className="flex items-center justify-between mt-3">
                      <button onClick={() => handleReset(agent.key)}
                        className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
                        Reset to default
                      </button>
                      <button onClick={() => handleSave(agent.key)} disabled={isSaving}
                        className="px-5 py-2 rounded-xl text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                        style={{ background: isSaved ? "#34c759" : "#0071e3" }}>
                        {isSaving ? "Saving…" : isSaved ? "Saved ✓" : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
