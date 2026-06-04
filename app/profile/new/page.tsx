"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useScan } from "@/lib/ScanContext";

// ── Constants (from spec) ──────────────────────────────────────────────────────

const MAX_PORTFOLIOS = 5;

const INVESTMENT_TYPES = ["Jumbo cap", "Mega cap", "Large cap", "Mid cap", "Small cap", "Mutual fund", "ETF", "Treasury bond"];

const CURRENCY_RATES: Record<string, number> = {
  USD:1.0,EUR:1.08,GBP:1.26,JPY:0.0064,AUD:0.66,CAD:0.73,CHF:1.11,CNY:0.14,HKD:0.13,NZD:0.61,
  SEK:0.095,KRW:0.00073,SGD:0.74,NOK:0.093,MXN:0.059,INR:0.012,RUB:0.011,ZAR:0.054,BRL:0.19,TRY:0.031,
  TWD:0.031,DKK:0.14,PLN:0.25,THB:0.027,IDR:0.000061,HUF:0.0028,CZK:0.043,ILS:0.27,CLP:0.0011,PHP:0.017,
  AED:0.27,COP:0.00026,SAR:0.27,MYR:0.21,RON:0.22,ARS:0.0011,PAB:1.0,PEN:0.27,UYU:0.026,EGP:0.021,
  VND:0.000039,UAH:0.025,KWD:3.25,QAR:0.27,NGN:0.00067,
};

const CURRENCY_LOCALES: Record<string, string> = {
  USD:"en-US",EUR:"de-DE",GBP:"en-GB",JPY:"ja-JP",AUD:"en-AU",CAD:"en-CA",CHF:"de-CH",CNY:"zh-CN",
  HKD:"zh-HK",NZD:"en-NZ",SEK:"sv-SE",KRW:"ko-KR",SGD:"en-SG",NOK:"no-NO",MXN:"es-MX",INR:"en-IN",
  RUB:"ru-RU",ZAR:"en-ZA",BRL:"pt-BR",TRY:"tr-TR",TWD:"zh-TW",DKK:"da-DK",PLN:"pl-PL",THB:"th-TH",
  IDR:"id-ID",HUF:"hu-HU",CZK:"cs-CZ",ILS:"he-IL",CLP:"es-CL",PHP:"en-PH",AED:"ar-AE",COP:"es-CO",
  SAR:"ar-SA",MYR:"ms-MY",RON:"ro-RO",ARS:"es-AR",PAB:"es-PA",PEN:"es-PE",UYU:"es-UY",EGP:"ar-EG",
  VND:"vi-VN",UAH:"uk-UA",KWD:"ar-KW",QAR:"ar-QA",NGN:"en-NG",
};

const DECIMAL_COMMA_LOCALES = new Set(["de-DE","de-CH","fr-FR","es-MX","es-CL","es-CO","es-AR","es-PE","es-UY","ru-RU","tr-TR","da-DK","pl-PL","id-ID","hu-HU","cs-CZ","vi-VN","uk-UA","pt-BR","ro-RO"]);

const STRATEGY_MATRIX = {
  unrealized: {
    periods: ["10 years"],
    hurdle:   { "10 years": 8.5 },
    stopLoss: { "10 years": 15.0 },
  },
  realized: {
    periods: ["1 day","5 days","15 days","1 month","3 months","6 months","9 months","1 year","3 years","5 years"],
    hurdle:   { "1 day":0.05,"5 days":0.25,"15 days":0.75,"1 month":1.5,"3 months":2.5,"6 months":4.0,"9 months":5.0,"1 year":6.0,"3 years":7.0,"5 years":7.5 },
    stopLoss: { "1 day":1.0,"5 days":2.0,"15 days":3.5,"1 month":5.0,"3 months":7.5,"6 months":8.0,"9 months":9.0,"1 year":10.0,"3 years":12.0,"5 years":12.5 },
  },
} as const;

type Objective = keyof typeof STRATEGY_MATRIX;

interface Investment { type: string; pct: string; }
interface StrategyRow {
  obj: Objective; period: string;
  aumPct: number; hurdle: number; stopLoss: number;
  investments: Investment[];
}
interface Portfolio { name: string; aum: number; }

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(v: string | number) { return Math.max(0, Math.min(100, parseInt(String(v), 10) || 0)); }

function formatAmt(val: number, currency: string) {
  const locale = CURRENCY_LOCALES[currency] ?? "en-US";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(val);
}

function parseAmt(str: string, currency: string) {
  const locale = CURRENCY_LOCALES[currency] ?? "en-US";
  const clean = str.replace(/[^\d.,-]/g, "");
  if (DECIMAL_COMMA_LOCALES.has(locale)) {
    return Math.floor(parseFloat(clean.replace(/\./g, "").replace(/,/g, ".")) || 0);
  }
  return Math.floor(parseFloat(clean.replace(/,/g, "")) || 0);
}

function defaultStrategies(): StrategyRow[] {
  return [
    { obj: "unrealized", period: "10 years", aumPct: 40, hurdle: 8.5,  stopLoss: 15.0, investments: [{ type: "", pct: "" }] },
    { obj: "realized",   period: "3 years",  aumPct: 40, hurdle: 7.0,  stopLoss: 12.0, investments: [{ type: "", pct: "" }] },
    { obj: "realized",   period: "1 month",  aumPct: 20, hurdle: 1.5,  stopLoss: 5.0,  investments: [{ type: "", pct: "" }] },
  ];
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NewProfilePage() {
  const router = useRouter();
  const { refreshProfiles } = useScan();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Section 01 state
  const [rawAmount, setRawAmount]       = useState(10_000_000);
  const [amountDisplay, setAmountDisplay] = useState("10,000,000");
  const [currency, setCurrency]         = useState("USD");
  const [portfolioCount, setPortfolioCount] = useState(1);
  const [showCountMenu, setShowCountMenu] = useState(false);

  // Section 02 state
  const [portfolios, setPortfolios] = useState<Portfolio[]>(
    Array.from({ length: MAX_PORTFOLIOS }, (_, i) => ({
      name: `Portfolio Alpha ${String.fromCharCode(65 + i)}`,
      aum:  i === 0 ? 100 : 0,
    }))
  );

  // Section 03 state
  const [activeTab, setActiveTab]     = useState(1);
  const [strategies, setStrategies]   = useState<Record<number, StrategyRow[]>>({});

  // ── Computed ────────────────────────────────────────────────────────────────

  const rate        = CURRENCY_RATES[currency] ?? 1;
  const usdEquiv    = Math.round(rawAmount * rate);
  const totalAlloc  = portfolios.slice(0, portfolioCount).reduce((s, p) => s + p.aum, 0);

  // ── Section 01 handlers ─────────────────────────────────────────────────────

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parseAmt(e.target.value, currency);
    setRawAmount(parsed);
    setAmountDisplay(formatAmt(parsed, currency));
  }

  function handleCurrencyChange(c: string) {
    setCurrency(c);
    setAmountDisplay(formatAmt(rawAmount, c));
  }

  function handleCountSelect(n: number) {
    setPortfolioCount(n);
    setShowCountMenu(false);
    if (activeTab > n) setActiveTab(1);
    rebalance(null, n);
  }

  // ── Section 02 handlers ─────────────────────────────────────────────────────

  function rebalance(changedIdx: number | null, count = portfolioCount) {
    setPortfolios((prev) => {
      const next = [...prev];
      const last = count - 1;
      let sum = 0;
      for (let i = 0; i < last; i++) {
        if (changedIdx !== null && i === changedIdx && sum + next[i].aum > 100) {
          next[i].aum = Math.max(0, 100 - (sum - next[i].aum + next[i].aum));
        }
        sum += next[i].aum;
      }
      if (sum > 100 && changedIdx !== null) {
        const overflow = sum - 100;
        next[changedIdx].aum = Math.max(0, next[changedIdx].aum - overflow);
        sum = 100;
      }
      next[last].aum = Math.max(0, 100 - sum);
      return next;
    });
  }

  function handlePortfolioName(i: number, val: string) {
    setPortfolios((prev) => prev.map((p, idx) => idx === i ? { ...p, name: val } : p));
  }

  function handlePortfolioAum(i: number, val: number) {
    setPortfolios((prev) => {
      const next = [...prev];
      next[i].aum = pct(val);
      return next;
    });
    rebalance(i);
  }

  // ── Section 03 handlers ─────────────────────────────────────────────────────

  const updateStrategies = useCallback((pIdx: number, fn: (rows: StrategyRow[]) => StrategyRow[]) => {
    setStrategies((prev) => {
      const rows = prev[pIdx] ?? defaultStrategies();
      return { ...prev, [pIdx]: fn([...rows]) };
    });
  }, []);

  function recalcRemainder(rows: StrategyRow[]) {
    const sum = rows.slice(0, -1).reduce((s, r) => s + r.aumPct, 0);
    rows[rows.length - 1].aumPct = Math.max(0, 100 - sum);
    return rows;
  }

  function handleObjective(rowIdx: number, val: Objective) {
    updateStrategies(activeTab, (rows) => {
      rows[rowIdx].obj    = val;
      rows[rowIdx].period = STRATEGY_MATRIX[val].periods[0];
      rows[rowIdx].hurdle   = (STRATEGY_MATRIX[val].hurdle as Record<string, number>)[rows[rowIdx].period] ?? 0;
      rows[rowIdx].stopLoss = (STRATEGY_MATRIX[val].stopLoss as Record<string, number>)[rows[rowIdx].period] ?? 0;
      return rows;
    });
  }

  function handlePeriod(rowIdx: number, val: string) {
    updateStrategies(activeTab, (rows) => {
      const obj = rows[rowIdx].obj;
      rows[rowIdx].period   = val;
      rows[rowIdx].hurdle   = (STRATEGY_MATRIX[obj].hurdle as Record<string, number>)[val] ?? 0;
      rows[rowIdx].stopLoss = (STRATEGY_MATRIX[obj].stopLoss as Record<string, number>)[val] ?? 0;
      return rows;
    });
  }

  function handleStrategyAum(rowIdx: number, val: string) {
    updateStrategies(activeTab, (rows) => {
      rows[rowIdx].aumPct = pct(val);
      let running = 0;
      for (let i = 0; i < rows.length - 1; i++) {
        if (running + rows[i].aumPct > 100) rows[i].aumPct = 100 - running;
        running += rows[i].aumPct;
      }
      return recalcRemainder(rows);
    });
  }

  function handleInvType(rowIdx: number, invIdx: number, val: string) {
    updateStrategies(activeTab, (rows) => {
      const invs = rows[rowIdx].investments;
      invs[invIdx].type = val;
      if (val) {
        const used = invs.reduce((s, item, i) => i === invIdx || !item.type ? s : s + pct(item.pct), 0);
        invs[invIdx].pct = String(Math.max(0, 100 - used));
        if (invIdx === invs.length - 1) invs.push({ type: "", pct: "" });
      } else if (invIdx < invs.length - 1) {
        invs.splice(invIdx, 1);
      }
      return rows;
    });
  }

  function handleInvPct(rowIdx: number, invIdx: number, val: string) {
    updateStrategies(activeTab, (rows) => {
      const invs = rows[rowIdx].investments;
      const other = invs.reduce((s, item, i) => i === invIdx || !item.type ? s : s + pct(item.pct), 0);
      invs[invIdx].pct = val === "" ? "" : String(Math.max(0, Math.min(100 - other, pct(val))));
      return rows;
    });
  }

  function addStrategyRow() {
    updateStrategies(activeTab, (rows) => {
      const fixedSum = rows.slice(0, -1).reduce((s, r) => s + r.aumPct, 0);
      const newRow: StrategyRow = {
        obj: "realized", period: "3 years", aumPct: 100 - fixedSum >= 10 ? 10 : 0,
        hurdle: 7.0, stopLoss: 12.0, investments: [{ type: "", pct: "" }],
      };
      rows.splice(rows.length - 1, 0, newRow);
      return recalcRemainder(rows);
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true); setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }

    // Create all profiles via batch API
    const profilePayloads = portfolios.slice(0, portfolioCount).map((p) => ({
      name:           p.name,
      allocation_pct: p.aum,
      investment_period: "3yr",
      aum_amount:     rawAmount,
      aum_currency:   currency,
      aum_usd:        usdEquiv,
      divestment:     "never",
    }));

    const batchRes = await fetch("/api/profile/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        portfolios: profilePayloads,
        universe_type: "preset",
        universe_key: "mega10",
        hurdle_components: { inflation: 0, borrowing: 0, index_return: 0, opex: 0, alpha_target: 0 },
      }),
    });

    const batchJson = await batchRes.json();
    if (!batchRes.ok) { setError(batchJson.error ?? "Failed to create profiles"); setSaving(false); return; }

    const createdProfiles: { id: number }[] = batchJson.profiles;

    // Save strategies for each profile
    for (let i = 0; i < createdProfiles.length; i++) {
      const profileId = createdProfiles[i].id;
      const rows = strategies[i + 1] ?? defaultStrategies();
      const stratPayload = rows.map((r, si) => ({
        objective:      r.obj,
        holding_period: r.period,
        aum_pct:        r.aumPct,
        hurdle_rate:    r.hurdle,
        stop_loss:      r.stopLoss,
        sort_order:     si,
        is_remainder:   si === rows.length - 1,
        investments:    r.investments.filter((inv) => inv.type && pct(inv.pct) > 0)
          .map((inv, ii) => ({ investment_type: inv.type, allocation_pct: pct(inv.pct), sort_order: ii })),
      }));

      await fetch(`/api/profile/${profileId}/strategies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ strategies: stratPayload }),
      });
    }

    await refreshProfiles();
    router.push("/market");
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const activeRows = strategies[activeTab] ?? defaultStrategies();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6" style={APPLE}>
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="border-b border-gray-300 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Wealth Management</h1>
            <p className="text-sm text-gray-600 mt-1">Configure assets under management, execution strategy, asset mix.</p>
          </div>
          <button onClick={() => router.push("/market")} className="text-sm text-blue-600 hover:underline">← Cancel</button>
        </header>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}

        {/* ── SECTION 01: Portfolio Summary ── */}
        <section className="bg-white p-6 rounded-lg border border-gray-300 space-y-6">
          <div className="flex items-start gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded">01</span>
            <h2 className="text-xl font-semibold">Portfolio Summary</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select value={currency} onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500 text-sm">
                  {Object.entries(CURRENCY_RATES).map(([code]) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="text" value={amountDisplay}
                  onChange={handleAmountChange}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 font-mono text-right text-sm focus:outline-none focus:border-blue-500" />
              </div>

              {/* USD Equivalent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">USD Equivalent</label>
                <div className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-500 font-mono text-right text-sm select-none">
                  {usdEquiv.toLocaleString("en-US")}
                </div>
              </div>
            </div>

            {/* Portfolio count */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Portfolios</label>
              <button type="button" onClick={() => setShowCountMenu(!showCountMenu)}
                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 text-left text-sm flex justify-between items-center focus:outline-none focus:border-blue-500">
                <span>{portfolioCount} {portfolioCount === 1 ? "Portfolio" : "Portfolios"}</span>
                <span className="text-xs text-gray-400">▼</span>
              </button>
              {showCountMenu && (
                <div className="absolute left-0 w-full bg-white border border-gray-300 rounded mt-1 shadow-xl z-50">
                  {Array.from({ length: MAX_PORTFOLIOS }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" onClick={() => handleCountSelect(n)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-blue-50 transition-colors">
                      {n} {n === 1 ? "Portfolio" : "Portfolios"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── SECTION 02: Configure Portfolio AUM ── */}
        <section className="bg-white p-6 rounded-lg border border-gray-300 space-y-6">
          <div className="flex justify-between items-center border-b border-gray-200 pb-4">
            <div className="flex items-start gap-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded">02</span>
              <h2 className="text-xl font-semibold">Configure Portfolio AUM</h2>
            </div>
            <div className="text-xs px-2 py-1 rounded bg-gray-50 border border-gray-200">
              Total: <span className={`font-bold ${Math.abs(totalAlloc - 100) < 0.1 ? "text-green-600" : "text-red-500"}`}>{totalAlloc}%</span> / 100%
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="pb-3 w-1/3">Portfolio Name</th>
                <th className="pb-3 w-2/3 pl-4">% of Total AUM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.from({ length: portfolioCount }, (_, i) => {
                const p = portfolios[i];
                const isLast = i === portfolioCount - 1 && portfolioCount > 1;
                return (
                  <tr key={i} className={isLast ? "bg-blue-50" : "hover:bg-gray-50"}>
                    <td className="py-3 pr-4">
                      <input type="text" value={p.name} onChange={(e) => handlePortfolioName(i, e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500" />
                      <span className="text-[10px] text-gray-400 block mt-1">
                        {isLast ? `Portfolio #${i + 1} (Remainder Baseline)` : `Portfolio #${i + 1}`}
                      </span>
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-4">
                        <input type="range" min={0} max={100} value={p.aum}
                          disabled={isLast}
                          onChange={(e) => handlePortfolioAum(i, parseInt(e.target.value))}
                          className={`w-full accent-blue-600 h-2 rounded ${isLast ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`} />
                        <span className="text-sm font-mono min-w-[50px] text-right bg-gray-100 px-2 py-1 rounded border border-gray-200">
                          {p.aum}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* ── SECTION 03: Strategy Configuration ── */}
        <section className="bg-white p-6 rounded-lg border border-gray-300 space-y-6">
          <div className="flex items-start gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded">03</span>
            <h2 className="text-xl font-semibold">Configure Individual Portfolio Strategy</h2>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {Array.from({ length: portfolioCount }, (_, i) => {
              const idx = i + 1;
              const isActive = idx === activeTab;
              return (
                <button key={idx} type="button" onClick={() => setActiveTab(idx)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive ? "border-blue-500 text-blue-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                  {portfolios[i].name || `Portfolio #${idx}`}
                </button>
              );
            })}
          </div>

          {/* Strategy table */}
          <div className="overflow-x-auto">
            <div className="bg-gray-50 p-4 rounded-b border-b border-x border-gray-200 min-w-[1200px] space-y-4">
              <table className="w-full text-left border-collapse" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "14%" }} />  {/* Objective */}
                  <col style={{ width: "10%" }} />  {/* Holding Period */}
                  <col style={{ width: "7%" }} />   {/* % of AUM */}
                  <col style={{ width: "7%" }} />   {/* Hurdle Rate */}
                  <col style={{ width: "7%" }} />   {/* Stop Loss */}
                  <col style={{ width: "7%" }} />   {/* % Invested */}
                  <col />                           {/* Investment Allocation — takes rest */}
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-1 text-left whitespace-nowrap">Objective</th>
                    <th className="pb-2 px-1 text-left whitespace-nowrap">Period</th>
                    <th className="pb-2 px-1 text-right whitespace-nowrap">% AUM</th>
                    <th className="pb-2 px-1 text-right whitespace-nowrap">Hurdle %</th>
                    <th className="pb-2 px-1 text-right whitespace-nowrap">Stop Loss %</th>
                    <th className="pb-2 px-1 text-right whitespace-nowrap">Invested %</th>
                    <th className="pb-2 pl-1 text-left whitespace-nowrap">Investment Allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/60">
                  {activeRows.map((row, rowIdx) => {
                    const isLast = rowIdx === activeRows.length - 1;
                    const periods = STRATEGY_MATRIX[row.obj].periods;
                    const invested = row.investments.reduce((s, inv) => inv.type ? s + pct(inv.pct) : s, 0);

                    return (
                      <tr key={rowIdx} className={isLast ? "bg-blue-50 border-dashed" : "hover:bg-gray-100/70"}>
                        {/* Objective */}
                        <td className="py-2 pr-1 align-top">
                          <select value={row.obj} onChange={(e) => handleObjective(rowIdx, e.target.value as Objective)}
                            className="w-full bg-white border border-gray-300 rounded px-1 py-1 text-xs text-gray-900 focus:outline-none focus:border-blue-500">
                            <option value="unrealized">Unrealized gain/loss</option>
                            <option value="realized">Realized gain/loss</option>
                          </select>
                        </td>
                        {/* Period */}
                        <td className="py-2 px-1 align-top">
                          <select value={row.period} onChange={(e) => handlePeriod(rowIdx, e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded px-1 py-1 text-xs text-gray-900 focus:outline-none focus:border-blue-500">
                            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        {/* AUM % */}
                        <td className="py-2 px-1 align-top">
                          <div className="flex items-center gap-0.5">
                            <input type="number" value={row.aumPct} disabled={isLast} min={0} max={100}
                              onChange={(e) => handleStrategyAum(rowIdx, e.target.value)}
                              className={`w-full bg-white border border-gray-300 rounded px-1 py-1 text-xs text-right font-mono focus:outline-none focus:border-blue-500 ${isLast ? "opacity-60 cursor-not-allowed" : ""}`} />
                            <span className="text-xs text-gray-400 shrink-0">%</span>
                          </div>
                        </td>
                        {/* Hurdle */}
                        <td className="py-2 px-1 align-top">
                          <div className="flex items-center gap-0.5">
                            <input type="number" value={row.hurdle} step={0.05} min={0} max={100}
                              onChange={(e) => updateStrategies(activeTab, (rows) => { rows[rowIdx].hurdle = parseFloat(e.target.value) || 0; return rows; })}
                              className="w-full bg-white border border-gray-300 rounded px-1 py-1 text-xs text-right font-mono text-green-600 focus:outline-none focus:border-blue-500" />
                            <span className="text-xs text-gray-400 shrink-0">%</span>
                          </div>
                        </td>
                        {/* Stop Loss */}
                        <td className="py-2 px-1 align-top">
                          <div className="flex items-center gap-0.5">
                            <input type="number" value={row.stopLoss} step={0.05} min={0} max={100}
                              onChange={(e) => updateStrategies(activeTab, (rows) => { rows[rowIdx].stopLoss = parseFloat(e.target.value) || 0; return rows; })}
                              className="w-full bg-white border border-gray-300 rounded px-1 py-1 text-xs text-right font-mono text-red-500 focus:outline-none focus:border-blue-500" />
                            <span className="text-xs text-gray-400 shrink-0">%</span>
                          </div>
                        </td>
                        {/* % Invested */}
                        <td className="py-2 px-1 align-top">
                          <div className="flex items-center gap-0.5">
                            <div className="w-full bg-gray-100 border border-gray-200 rounded px-1 py-1 text-xs text-right font-mono select-none">
                              <span className={invested === 100 ? "text-green-600 font-bold" : "text-gray-500"}>{invested}</span>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">%</span>
                          </div>
                        </td>
                        {/* Investment Allocation */}
                        <td className="py-2 pl-1 align-top">
                          <div className="flex flex-row gap-1 overflow-x-auto pb-1">
                            {row.investments.map((inv, invIdx) => (
                              <div key={invIdx} className="flex flex-col gap-1 w-[108px] shrink-0 bg-gray-100 p-1.5 rounded border border-gray-200">
                                <select value={inv.type} onChange={(e) => handleInvType(rowIdx, invIdx, e.target.value)}
                                  className="bg-white border border-gray-300 rounded px-1.5 py-1 text-[11px] text-gray-900 focus:outline-none focus:border-blue-500 w-full">
                                  <option value="">-- Select Type --</option>
                                  {INVESTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                {inv.type && (
                                  <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded border border-gray-200">
                                    <input type="number" value={inv.pct} min={0} max={100}
                                      onChange={(e) => handleInvPct(rowIdx, invIdx, e.target.value)}
                                      className="w-full bg-transparent text-xs text-right font-mono text-blue-600 focus:outline-none" />
                                    <span className="text-xs text-gray-400 shrink-0">%</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-200">
                <button type="button" onClick={addStrategyRow}
                  className="bg-white hover:bg-gray-50 text-blue-600 text-xs font-medium px-4 py-2 rounded border border-gray-200 transition-colors">
                  + Add Strategy Objective
                </button>
                <span>
                  Strategy Allocation Sum: <span className="font-bold text-blue-600 ml-1">
                    {activeRows.reduce((s, r) => s + r.aumPct, 0)}%
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end pb-8">
          <button onClick={handleSave} disabled={saving}
            className="px-10 py-3.5 rounded-xl text-[15px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 shadow-lg"
            style={{ background: "#0071e3" }}>
            {saving ? "Creating Portfolios…" : `Create ${portfolioCount} Portfolio${portfolioCount > 1 ? "s" : ""} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
