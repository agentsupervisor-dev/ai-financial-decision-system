"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useScan } from "@/lib/ScanContext";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: "USD", symbol: "$",  name: "US Dollar",          rate: 1       },
  { code: "GBP", symbol: "£",  name: "British Pound",      rate: 1.27    },
  { code: "EUR", symbol: "€",  name: "Euro",               rate: 1.08    },
  { code: "INR", symbol: "₹",  name: "Indian Rupee",       rate: 0.012   },
  { code: "AUD", symbol: "A$", name: "Australian Dollar",  rate: 0.65    },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar",    rate: 0.74    },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar",   rate: 0.74    },
  { code: "AED", symbol: "د", name: "UAE Dirham",          rate: 0.27    },
];

const DIVESTMENT_OPTIONS = [
  { value: "never",  label: "Never",        sub: "Long-term hold" },
  { value: "1yr",    label: "1 Year",       sub: "Short-term" },
  { value: "3yr",    label: "3 Years",      sub: "Medium-term" },
  { value: "5yr",    label: "5 Years",      sub: "Long-term" },
  { value: "10yr",   label: "10 Years",     sub: "Very long-term" },
];

const PERIOD_OPTIONS = [
  { value: "1yr", label: "Short-term · 1 yr" },
  { value: "3yr", label: "Medium-term · 3 yrs" },
  { value: "5yr", label: "Long-term · 5+ yrs" },
];

const MARKET_CAP_PRESETS = [
  { key: "mega10",    label: "MEGA Cap",   sublabel: "Top 10",  count: 10, color: "#0071e3", bg: "#f0f6ff", description: "Apple, Microsoft, NVIDIA, Alphabet, Amazon + 5 more" },
  { key: "nasdaq100", label: "NASDAQ 100", sublabel: "Top 25",  count: 25, color: "#5856d6", bg: "#f3f2ff", description: "Top NASDAQ-listed tech & growth companies" },
  { key: "sp500",     label: "S&P 500",    sublabel: "Top 30",  count: 30, color: "#34c759", bg: "#f0fdf4", description: "Largest US companies across all sectors" },
];

const SECTOR_PRESETS = [
  { key: "sector_tech",       label: "Technology",  icon: "💻", count: 15, description: "NVIDIA, AMD, Qualcomm, Oracle and more" },
  { key: "sector_health",     label: "Healthcare",  icon: "🏥", count: 13, description: "Eli Lilly, UnitedHealth, J&J and more" },
  { key: "sector_finance",    label: "Financial",   icon: "🏦", count: 12, description: "JPMorgan, Visa, Mastercard and more" },
  { key: "sector_energy",     label: "Energy",      icon: "⚡", count: 8,  description: "Exxon, Chevron, ConocoPhillips and more" },
  { key: "sector_consumer",   label: "Consumer",    icon: "🛍️", count: 12, description: "Amazon, Walmart, McDonald's and more" },
  { key: "sector_industrial", label: "Industrial",  icon: "🏭", count: 11, description: "Honeywell, Union Pacific, Caterpillar and more" },
];

const ALL_PRESETS = [...MARKET_CAP_PRESETS, ...SECTOR_PRESETS];

interface PortfolioDraft {
  name: string;
  allocation_pct: number;
  divestment: string;
  investment_period: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NewProfilePage() {
  const router = useRouter();
  const { refreshProfiles } = useScan();

  const TOTAL_STEPS = 5;
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Step 1 — AUM
  const [aumAmount, setAumAmount]     = useState("");
  const [aumCurrency, setAumCurrency] = useState("USD");

  const currency    = CURRENCIES.find((c) => c.code === aumCurrency) ?? CURRENCIES[0];
  const aumUSD      = parseFloat(aumAmount) * currency.rate || 0;
  const aumDisplay  = parseFloat(aumAmount) || 0;

  // Step 2 — Portfolio count
  const [portfolioCount, setPortfolioCount] = useState(1);

  // Step 3 — Per-portfolio config
  const [portfolios, setPortfolios] = useState<PortfolioDraft[]>([
    { name: "Portfolio 1", allocation_pct: 100, divestment: "never", investment_period: "3yr" },
  ]);

  function updatePortfolio(i: number, field: keyof PortfolioDraft, value: string | number) {
    setPortfolios((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  function syncPortfolioCount(n: number) {
    setPortfolioCount(n);
    setPortfolios((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ name: `Portfolio ${next.length + 1}`, allocation_pct: 0, divestment: "never", investment_period: "3yr" });
      return next.slice(0, n);
    });
    // Auto-distribute allocation equally
    const equal = parseFloat((100 / n).toFixed(1));
    setPortfolios((prev) => prev.slice(0, n).map((p, i) => ({ ...p, allocation_pct: i === 0 ? 100 - equal * (n - 1) : equal })));
  }

  const totalAlloc = portfolios.reduce((s, p) => s + p.allocation_pct, 0);
  const allocOk    = Math.abs(totalAlloc - 100) < 0.1;

  // Step 4 — Universe
  const [universeType, setUniverseType] = useState<"preset" | "manual">("preset");
  const [universeKey, setUniverseKey]   = useState("");

  // Step 5 — Hurdle rate
  const [inflation,   setInflation]   = useState(3.5);
  const [borrowing,   setBorrowing]   = useState(7.5);
  const [indexReturn, setIndexReturn] = useState(12.0);
  const [opex,        setOpex]        = useState(0.5);
  const [alpha,       setAlpha]       = useState(6.5);
  const hurdle = inflation + borrowing + indexReturn + opex + alpha;

  // ── Navigation ───────────────────────────────────────────────────────────────

  function goNext() {
    setError(null);
    if (step === 1 && (!aumAmount || parseFloat(aumAmount) <= 0)) { setError("Please enter your AUM amount."); return; }
    if (step === 3 && !allocOk) { setError(`Allocation must total 100%. Currently ${totalAlloc.toFixed(1)}%.`); return; }
    if (step === 4 && !universeKey) { setError("Please select a stock universe."); return; }
    setStep((s) => s + 1);
  }

  function goBack() { setError(null); setStep((s) => s - 1); }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true); setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }

    const res = await fetch("/api/profile/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        portfolios: portfolios.map((p) => ({
          name:            p.name,
          allocation_pct:  p.allocation_pct,
          divestment:      p.divestment,
          investment_period: p.investment_period,
          aum_amount:      aumDisplay,
          aum_currency:    aumCurrency,
          aum_usd:         aumUSD,
        })),
        universe_type: universeType,
        universe_key:  universeKey || "mega10",
        hurdle_components: { inflation, borrowing, index_return: indexReturn, opex, alpha_target: alpha },
      }),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed to create profiles."); setSaving(false); return; }
    await refreshProfiles();
    router.push("/market");
  }

  // ── Progress dots ─────────────────────────────────────────────────────────────

  const stepLabels = ["AUM", "Portfolios", "Allocation", "Universe", "Hurdle Rate"];

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-28" style={APPLE}>
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => step === 1 ? router.push("/market") : goBack()}
            className="text-[13px] text-[#0071e3] hover:underline">
            ← {step === 1 ? "Cancel" : "Back"}
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[12px] font-medium text-[#1d1d1f]">Step {step} of {TOTAL_STEPS} — {stepLabels[step - 1]}</span>
            <div className="flex gap-1.5 mt-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div key={i} className="h-1.5 w-6 rounded-full transition-colors"
                  style={{ background: step > i ? "#0071e3" : "#d2d2d7" }} />
              ))}
            </div>
          </div>
          <div className="w-16" />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600 mb-5">{error}</div>}

        {/* ── STEP 1: AUM ── */}
        {step === 1 && (
          <div>
            <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight mb-1">Assets Under Management</h1>
            <p className="text-[15px] text-[#6e6e73] mb-8">Enter the total amount you plan to invest across all portfolios.</p>

            <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 space-y-5">
              {/* Currency selector */}
              <div>
                <label className="text-[13px] font-medium text-[#1d1d1f] block mb-2">Currency</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CURRENCIES.map((c) => (
                    <button key={c.code} onClick={() => setAumCurrency(c.code)}
                      className="py-2.5 px-3 rounded-xl border-2 text-left transition-all"
                      style={{ borderColor: aumCurrency === c.code ? "#0071e3" : "#e5e5ea", background: aumCurrency === c.code ? "#f0f6ff" : "#fff" }}>
                      <span className="text-[15px] font-bold" style={{ color: aumCurrency === c.code ? "#0071e3" : "#1d1d1f" }}>{c.symbol} {c.code}</span>
                      <p className="text-[10px] text-[#aeaeb2] mt-0.5">{c.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-[13px] font-medium text-[#1d1d1f] block mb-2">Total AUM in {aumCurrency}</label>
                <div className="flex items-center gap-2 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3 focus-within:border-[#0071e3] focus-within:bg-white transition-all">
                  <span className="text-[20px] font-semibold text-[#aeaeb2]">{currency.symbol}</span>
                  <input type="number" min="0" step="1000" value={aumAmount}
                    onChange={(e) => setAumAmount(e.target.value)}
                    placeholder="100,000"
                    className="flex-1 bg-transparent text-[20px] font-semibold text-[#1d1d1f] focus:outline-none" />
                </div>
              </div>

              {/* USD Equivalent */}
              {aumDisplay > 0 && aumCurrency !== "USD" && (
                <div className="rounded-xl bg-[#f0f6ff] px-4 py-3 flex items-center justify-between">
                  <span className="text-[13px] text-[#6e6e73]">USD Equivalent</span>
                  <span className="text-[18px] font-bold" style={{ color: "#0071e3" }}>
                    ${aumUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              {aumDisplay > 0 && aumCurrency === "USD" && (
                <div className="rounded-xl bg-[#f0f6ff] px-4 py-3 flex items-center justify-between">
                  <span className="text-[13px] text-[#6e6e73]">Total investable</span>
                  <span className="text-[18px] font-bold" style={{ color: "#0071e3" }}>
                    ${aumDisplay.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Portfolio Count ── */}
        {step === 2 && (
          <div>
            <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight mb-1">Number of Portfolios</h1>
            <p className="text-[15px] text-[#6e6e73] mb-2">
              How many portfolios do you want to create from your {currency.symbol}{aumDisplay.toLocaleString()} AUM?
            </p>
            <p className="text-[13px] text-[#aeaeb2] mb-8">Each portfolio can have different stocks, sectors and time horizons.</p>

            <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6">
              <div className="grid grid-cols-5 gap-3 mb-6">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => syncPortfolioCount(n)}
                    className="py-5 rounded-2xl border-2 text-center transition-all font-bold text-[22px]"
                    style={{ borderColor: portfolioCount === n ? "#0071e3" : "#e5e5ea", background: portfolioCount === n ? "#f0f6ff" : "#fff", color: portfolioCount === n ? "#0071e3" : "#1d1d1f" }}>
                    {n}
                    <p className="text-[11px] font-medium mt-1 text-[#aeaeb2]">{n === 1 ? "portfolio" : "portfolios"}</p>
                  </button>
                ))}
              </div>
              <div className="rounded-xl bg-[#f9f9f9] px-4 py-3 text-center">
                <p className="text-[13px] text-[#6e6e73]">
                  Each portfolio will analyse stocks independently with its own allocation and investment horizon.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Allocation & Divestment ── */}
        {step === 3 && (
          <div>
            <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight mb-1">Portfolio Configuration</h1>
            <p className="text-[15px] text-[#6e6e73] mb-2">
              Name each portfolio, assign allocation % and set your divestment plan.
            </p>
            <p className="text-[13px] text-[#aeaeb2] mb-6">Total must equal 100%. Currently: <span className="font-semibold" style={{ color: allocOk ? "#16a34a" : "#dc2626" }}>{totalAlloc.toFixed(1)}%</span></p>

            <div className="space-y-4">
              {portfolios.map((p, i) => {
                const allocated = (aumUSD * p.allocation_pct) / 100;
                return (
                  <div key={i} className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{ background: "#0071e3" }}>{i + 1}</div>
                      <input type="text" value={p.name}
                        onChange={(e) => updatePortfolio(i, "name", e.target.value)}
                        placeholder={`Portfolio ${i + 1}`}
                        className="flex-1 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[15px] font-semibold text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all" />
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      {/* Allocation */}
                      <div>
                        <label className="text-[11px] text-[#aeaeb2] uppercase tracking-wide block mb-1.5">% of AUM</label>
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" max="100" step="5" value={p.allocation_pct}
                            onChange={(e) => updatePortfolio(i, "allocation_pct", parseFloat(e.target.value) || 0)}
                            className="w-20 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[15px] font-semibold text-[#1d1d1f] text-right focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all" />
                          <span className="text-[14px] text-[#6e6e73]">%</span>
                        </div>
                        <p className="text-[11px] text-[#aeaeb2] mt-1">
                          ≈ ${allocated.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
                        </p>
                      </div>

                      {/* Investment Period */}
                      <div>
                        <label className="text-[11px] text-[#aeaeb2] uppercase tracking-wide block mb-1.5">Investment Horizon</label>
                        <div className="flex gap-1">
                          {PERIOD_OPTIONS.map((opt) => (
                            <button key={opt.value} onClick={() => updatePortfolio(i, "investment_period", opt.value)}
                              className="flex-1 py-2 rounded-lg text-[11px] font-medium transition-all border"
                              style={{ background: p.investment_period === opt.value ? "#0071e3" : "#f5f5f7", color: p.investment_period === opt.value ? "white" : "#6e6e73", borderColor: p.investment_period === opt.value ? "#0071e3" : "#e5e5ea" }}>
                              {opt.value === "1yr" ? "1yr" : opt.value === "3yr" ? "3yr" : "5yr+"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Divestment */}
                      <div>
                        <label className="text-[11px] text-[#aeaeb2] uppercase tracking-wide block mb-1.5">Liquidation Plan</label>
                        <select value={p.divestment} onChange={(e) => updatePortfolio(i, "divestment", e.target.value)}
                          className="w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[14px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all">
                          {DIVESTMENT_OPTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label} — {d.sub}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 4: Universe ── */}
        {step === 4 && (
          <div>
            <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight mb-1">What do you want to scan?</h1>
            <p className="text-[15px] text-[#6e6e73] mb-8">Choose a stock universe — applied to all {portfolioCount} portfolio{portfolioCount > 1 ? "s" : ""}.</p>

            <p className="text-[12px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">By Market Cap</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {MARKET_CAP_PRESETS.map((p) => (
                <button key={p.key} onClick={() => { setUniverseKey(p.key); setUniverseType("preset"); }}
                  className="text-left rounded-2xl border-2 p-6 transition-all hover:shadow-md"
                  style={{ borderColor: universeKey === p.key ? p.color : "#e5e5ea", background: universeKey === p.key ? p.bg : "#fff" }}>
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-[20px] font-bold" style={{ color: p.color }}>{p.label}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: p.bg, color: p.color }}>{p.count} stocks</span>
                  </div>
                  <p className="text-[13px] font-medium text-[#6e6e73] mb-1">{p.sublabel}</p>
                  <p className="text-[12px] text-[#aeaeb2] leading-relaxed">{p.description}</p>
                </button>
              ))}
            </div>

            <p className="text-[12px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">By Sector</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {SECTOR_PRESETS.map((p) => (
                <button key={p.key} onClick={() => { setUniverseKey(p.key); setUniverseType("preset"); }}
                  className="text-left rounded-2xl border-2 p-5 transition-all hover:shadow-md"
                  style={{ borderColor: universeKey === p.key ? "#0071e3" : "#e5e5ea", background: universeKey === p.key ? "#f0f6ff" : "#fff" }}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-[22px]">{p.icon}</span>
                    <span className="text-[15px] font-semibold text-[#1d1d1f]">{p.label}</span>
                  </div>
                  <p className="text-[12px] text-[#aeaeb2] mb-2 leading-relaxed">{p.description}</p>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#f5f5f7] text-[#6e6e73] font-medium">{p.count} stocks</span>
                </button>
              ))}
            </div>

            <p className="text-[12px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">Manual Picks</p>
            <button onClick={() => { setUniverseType("manual"); setUniverseKey("manual"); }}
              className="w-full text-left rounded-2xl border-2 p-6 transition-all hover:shadow-md"
              style={{ borderColor: universeKey === "manual" ? "#0071e3" : "#e5e5ea", background: universeKey === "manual" ? "#f0f6ff" : "#fff" }}>
              <div className="flex items-center gap-4">
                <span className="text-[28px]">🔍</span>
                <div>
                  <p className="text-[16px] font-semibold text-[#1d1d1f]">Pick Stocks Manually</p>
                  <p className="text-[13px] text-[#aeaeb2] mt-0.5">Add stocks to each portfolio after creation via Edit Profile</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ── STEP 5: Hurdle Rate ── */}
        {step === 5 && (
          <div>
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl mb-3" style={{ background: "#f0f6ff" }}>
                <span className="text-[13px] font-medium text-[#0071e3]">
                  {ALL_PRESETS.find((p) => p.key === universeKey)?.label ?? "Manual Picks"} · Applied to all portfolios
                </span>
              </div>
              <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight mb-1">Set Hurdle Rate</h1>
              <p className="text-[15px] text-[#6e6e73]">Minimum annual return required across all portfolios.</p>
            </div>

            <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <label className="text-[13px] font-semibold text-[#1d1d1f] uppercase tracking-widest">Hurdle Rate Components</label>
                <div className="text-right">
                  <p className="text-[10px] text-[#aeaeb2] uppercase tracking-wide">Total</p>
                  <p className="text-[26px] font-bold" style={{ color: "#0071e3" }}>{hurdle.toFixed(1)}%</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Inflation Rate",  value: inflation,    setter: setInflation,   hint: "Expected annual inflation",   max: 15 },
                  { label: "Borrowing Cost",  value: borrowing,    setter: setBorrowing,   hint: "Cost of capital / loan rate", max: 25 },
                  { label: "Index Return",    value: indexReturn,  setter: setIndexReturn, hint: "Expected S&P 500 return",     max: 25 },
                  { label: "OpEx / Fees",     value: opex,         setter: setOpex,        hint: "Management fees / expenses",  max: 5  },
                  { label: "Alpha Target",    value: alpha,        setter: setAlpha,       hint: "Extra return above market",   max: 20 },
                ].map(({ label, value, setter, hint, max }) => (
                  <div key={label} className="flex items-center gap-4">
                    <div className="w-36 shrink-0">
                      <p className="text-[13px] text-[#1d1d1f] font-medium leading-tight">{label}</p>
                      <p className="text-[10px] text-[#aeaeb2] mt-0.5">{hint}</p>
                    </div>
                    <div className="flex-1">
                      <input type="range" min={0} max={max} step={0.5} value={value}
                        onChange={(e) => setter(parseFloat(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                        style={{ accentColor: "#0071e3" }} />
                      <div className="flex justify-between text-[9px] text-[#aeaeb2] mt-0.5 px-0.5">
                        <span>0%</span><span>{max}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <input type="number" value={value} step={0.5} min={0} max={max}
                        onChange={(e) => setter(Math.min(max, parseFloat(e.target.value) || 0))}
                        className="w-16 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-2 py-1.5 text-[14px] text-right font-semibold focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all" />
                      <span className="text-[13px] text-[#6e6e73]">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="mt-5 bg-white rounded-2xl border border-black/[0.08] shadow-sm p-5">
              <p className="text-[12px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#6e6e73]">Total AUM</span>
                  <span className="font-semibold text-[#1d1d1f]">{currency.symbol}{aumDisplay.toLocaleString()} {aumCurrency} {aumCurrency !== "USD" && `(~$${aumUSD.toLocaleString()} USD)`}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#6e6e73]">Portfolios</span>
                  <span className="font-semibold text-[#1d1d1f]">{portfolioCount} portfolio{portfolioCount > 1 ? "s" : ""}</span>
                </div>
                {portfolios.map((p, i) => (
                  <div key={i} className="flex justify-between text-[12px] pl-3 border-l-2 border-[#e5e5ea]">
                    <span className="text-[#6e6e73]">{p.name}</span>
                    <span className="text-[#1d1d1f]">{p.allocation_pct}% · Divest: {DIVESTMENT_OPTIONS.find((d) => d.value === p.divestment)?.label}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[13px] pt-2 border-t border-[#f0f0f0]">
                  <span className="text-[#6e6e73]">Hurdle Rate</span>
                  <span className="font-bold" style={{ color: "#0071e3" }}>{hurdle.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-black/[0.06] px-6 py-4 flex justify-end z-20">
        {step < TOTAL_STEPS ? (
          <button onClick={goNext}
            className="px-10 py-3.5 rounded-xl text-[15px] font-semibold text-white transition-all hover:opacity-90 shadow-lg"
            style={{ background: "#0071e3", minWidth: 200 }}>
            Continue →
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving}
            className="px-10 py-3.5 rounded-xl text-[15px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 shadow-lg"
            style={{ background: "#0071e3", minWidth: 240 }}>
            {saving ? "Creating…" : `Create ${portfolioCount} Portfolio${portfolioCount > 1 ? "s" : ""} →`}
          </button>
        )}
      </div>
    </div>
  );
}
