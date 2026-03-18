"use client";

import { useState } from "react";

interface HurdleComponents {
  inflation: number;
  borrowing: number;
  index_return: number;
  tax_drag: number;
  opex: number;
  alpha_target: number;
}

interface AnalysisResult {
  ticker: string;
  hurdle_rate: number;
  hurdle_components: HurdleComponents;
  forensic_score: number | null;
  macro_score: number | null;
  asymmetry_score: number | null;
  composite_score: number | null;
  confidence: number | null;
  expected_return: number | null;
  clears_hurdle: boolean | null;
  excess_return: number | null;
  final_decision: string | null;
  decision_summary: string | null;
}

const defaultHurdle: HurdleComponents = {
  inflation: 3.5,
  borrowing: 7.5,
  index_return: 12.0,
  tax_drag: 10.0,
  opex: 0.5,
  alpha_target: 6.5,
};

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 65 ? "bg-emerald-500" : score >= 45 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono font-semibold text-white">{score.toFixed(1)}/100</span>
      </div>
      <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return null;
  const config: Record<string, { bg: string; text: string; border: string }> = {
    BUY: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
    HOLD: { bg: "bg-amber-400/10", text: "text-amber-400", border: "border-amber-400/30" },
    REJECT: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  };
  const c = config[decision] ?? config["HOLD"];
  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-2xl font-bold tracking-widest ${c.bg} ${c.text} ${c.border}`}
    >
      {decision === "BUY" && "▲"}
      {decision === "HOLD" && "◼"}
      {decision === "REJECT" && "▼"}
      {decision}
    </div>
  );
}

export default function Home() {
  const [ticker, setTicker] = useState("");
  const [hurdle, setHurdle] = useState<HurdleComponents>(defaultHurdle);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHurdle, setShowHurdle] = useState(false);

  const totalHurdle = Object.values(hurdle).reduce((a, b) => a + b, 0);

  async function handleAnalyze() {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const params = new URLSearchParams({
      ticker: ticker.trim().toUpperCase(),
      ...Object.fromEntries(
        Object.entries(hurdle).map(([k, v]) => [k, String(v)])
      ),
    });

    try {
      const res = await fetch(`/api/orchestrate?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Finance Decision Machine
          </h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Multi-agent analysis — Forensic · Macro · Asymmetry · Decision
          </p>
        </div>

        {/* Input */}
        <div className="mb-6 flex gap-3">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="Ticker (e.g. AAPL)"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono uppercase text-lg"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !ticker.trim()}
            className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        {/* Hurdle Rate Configurator */}
        <div className="mb-8">
          <button
            onClick={() => setShowHurdle(!showHurdle)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded text-emerald-400 font-bold">
              {totalHurdle.toFixed(1)}%
            </span>
            Hurdle Rate
            <span className="ml-1">{showHurdle ? "▲" : "▼"}</span>
          </button>

          {showHurdle && (
            <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5 grid grid-cols-2 gap-4">
              {(
                [
                  ["inflation", "Inflation (%)"],
                  ["borrowing", "Borrowing Cost (%)"],
                  ["index_return", "Index Return (%)"],
                  ["tax_drag", "Tax Drag (%)"],
                  ["opex", "OpEx (%)"],
                  ["alpha_target", "Alpha Target (%)"],
                ] as [keyof HurdleComponents, string][]
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs text-zinc-500 mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={hurdle[key]}
                    onChange={(e) =>
                      setHurdle((h) => ({ ...h, [key]: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-zinc-500"
                  />
                </div>
              ))}
              <div className="col-span-2 pt-2 border-t border-zinc-800 flex justify-between text-sm">
                <span className="text-zinc-400">Total Hurdle Rate</span>
                <span className="font-mono font-bold text-emerald-400">
                  {totalHurdle.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <div className="text-zinc-400 text-sm animate-pulse">
              Running 3-agent analysis for {ticker}…
              <br />
              <span className="text-xs text-zinc-600 mt-1 block">
                Forensic (Claude) → Macro (Gemini) → Asymmetry (DeepSeek) → Decision
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-5 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-5">
            {/* Decision */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Signal</div>
                  <div className="text-2xl font-bold font-mono">{result.ticker}</div>
                </div>
                <DecisionBadge decision={result.final_decision} />
              </div>

              {/* Hurdle pass/fail */}
              <div className="flex items-center gap-2 text-sm mt-3">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                    result.clears_hurdle
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {result.clears_hurdle ? "✓ Clears Hurdle" : "✗ Below Hurdle"}
                </span>
                <span className="text-zinc-500">
                  {result.expected_return?.toFixed(1)}% expected vs {result.hurdle_rate?.toFixed(1)}% required
                </span>
                {result.excess_return !== null && (
                  <span
                    className={`font-mono text-xs ${
                      result.excess_return >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    ({result.excess_return >= 0 ? "+" : ""}
                    {result.excess_return.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>

            {/* Scores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex justify-between items-baseline mb-5">
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
                  Agent Scores
                </h2>
                <div className="text-xs text-zinc-500">
                  Confidence:{" "}
                  <span className="text-white font-mono">{result.confidence?.toFixed(0)}%</span>
                </div>
              </div>
              <ScoreBar label="Forensic — Business Moat (Claude)" score={result.forensic_score} />
              <ScoreBar label="Macro — Economic Backdrop (Gemini)" score={result.macro_score} />
              <ScoreBar label="Asymmetry — Risk/Reward (DeepSeek)" score={result.asymmetry_score} />
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <ScoreBar label="Composite Score (40 / 30 / 30)" score={result.composite_score} />
              </div>
            </div>

            {/* Hurdle breakdown */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-4">
                Hurdle Breakdown
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(result.hurdle_components).map(([key, val]) => (
                  <div key={key} className="bg-zinc-800 rounded-lg px-3 py-2">
                    <div className="text-xs text-zinc-500 capitalize">
                      {key.replace("_", " ")}
                    </div>
                    <div className="font-mono text-sm text-white">{(val as number).toFixed(1)}%</div>
                  </div>
                ))}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2">
                  <div className="text-xs text-zinc-500">Total Hurdle</div>
                  <div className="font-mono text-sm text-emerald-400 font-bold">
                    {result.hurdle_rate?.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Decision rationale */}
            {result.decision_summary && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-3">
                  Decision Rationale
                </h2>
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {result.decision_summary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
