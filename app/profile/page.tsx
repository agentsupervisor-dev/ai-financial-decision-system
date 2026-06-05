"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ── Constants ──────────────────────────────────────────────────────────────────

const INVESTMENT_TYPES = ["Jumbo cap", "Mega cap", "Large cap", "Mid cap", "Small cap", "Mutual fund", "ETF", "Treasury bond"];
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "HKD", "NZD", "SEK", "KRW", "SGD", "NOK", "MXN", "INR"];
const CURRENCY_RATES: Record<string, number> = {
  USD: 1.0, EUR: 1.08, GBP: 1.26, JPY: 0.0064, AUD: 0.66, CAD: 0.73, CHF: 1.11,
  CNY: 0.14, HKD: 0.13, NZD: 0.61, SEK: 0.095, KRW: 0.00073, SGD: 0.74,
  NOK: 0.093, MXN: 0.059, INR: 0.012,
};
const STRATEGY_PRESETS: Record<string, {
  periods: string[];
  hurdle: number | Record<string, number>;
  stopLoss: number | Record<string, number>;
}> = {
  unrealized: { periods: ["10 years"], hurdle: 8.5, stopLoss: 15.0 },
  realized: {
    periods: ["1 day", "5 days", "15 days", "1 month", "3 months", "6 months", "1 year", "3 years", "5 years"],
    hurdle:   { "1 day": 0.05, "5 days": 0.25, "15 days": 0.75, "1 month": 1.5, "3 months": 2.5, "6 months": 4.0, "1 year": 6.0, "3 years": 7.0, "5 years": 7.5 },
    stopLoss: { "1 day": 1.0,  "5 days": 2.0,  "15 days": 3.5,  "1 month": 5.0, "3 months": 7.5, "6 months": 8.0, "1 year": 10.0, "3 years": 12.0, "5 years": 12.5 },
  },
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface Stock       { exchange: string; ticker: string; confidence: string; sharePct: string; price: string; strike: string; action: string; execute: string; }
interface Investment  { type: string; pct: string; stocks: Stock[]; }
interface Strategy    { obj: string; period: string; aumPct: number; hurdle: number; stopLoss: number; investments: Investment[]; }
interface Portfolio   { name: string; aumPct: number; }
type StrategiesMap  = Record<number, Strategy[]>;

// ── Helpers ────────────────────────────────────────────────────────────────────

const FONT       = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
const fmt        = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
const parseMoney = (s: string) => Math.floor(Number(s.replace(/[^0-9.-]+/g, "")) || 0);

// ── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  card:  { background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" as const, marginBottom: 16, fontFamily: FONT },
  hdr:   { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,0.06)", userSelect: "none" as const },
  badge: { background: "#0071e3", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 },
  title: { fontSize: 16, fontWeight: 600, color: "#1d1d1f", margin: 0 },
  pill:  { fontSize: 12, fontFamily: "ui-monospace,monospace", color: "#6e6e73", background: "#f5f5f7", padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" },
  body:  { padding: 24 },
  grid:  { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 20 },
  lbl:   { display: "block", fontSize: 13, color: "#6e6e73", marginBottom: 6, fontWeight: 500 },
  sel:   { width: "100%", background: "#f5f5f7", color: "#1d1d1f", borderRadius: 10, padding: "10px 12px", fontSize: 15, border: "1px solid rgba(0,0,0,0.08)", outline: "none", fontFamily: FONT, boxSizing: "border-box" as const },
  inp:   { width: "100%", background: "#f5f5f7", color: "#1d1d1f", borderRadius: 10, padding: "10px 12px", fontSize: 15, border: "1px solid rgba(0,0,0,0.08)", outline: "none", fontFamily: "ui-monospace,monospace", textAlign: "right" as const, boxSizing: "border-box" as const },
  disp:  { width: "100%", background: "#f5f5f7", color: "#6e6e73", borderRadius: 10, padding: "10px 12px", fontSize: 15, border: "1px solid rgba(0,0,0,0.06)", height: 43, display: "flex", alignItems: "center", justifyContent: "flex-end", boxSizing: "border-box" as const, fontFamily: "ui-monospace,monospace" },
  tbl:   { width: "100%", borderCollapse: "collapse" as const },
  th:    { paddingBottom: 10, fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, color: "#6e6e73", borderBottom: "1px solid rgba(0,0,0,0.08)", letterSpacing: "0.04em" },
  td:    { padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" },
  tabA:  { padding: "10px 18px", fontSize: 14, color: "#0071e3", background: "transparent", border: "none", borderBottom: "2px solid #0071e3", cursor: "pointer", fontWeight: 500, fontFamily: FONT },
  tabI:  { padding: "10px 18px", fontSize: 14, color: "#6e6e73", background: "transparent", border: "none", borderBottom: "2px solid transparent", cursor: "pointer", fontFamily: FONT },
  vtabA: { width: "100%", textAlign: "left" as const, padding: "11px 14px", fontSize: 13, background: "#0071e3", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONT },
  vtabI: { width: "100%", textAlign: "left" as const, padding: "11px 14px", fontSize: 13, background: "#f5f5f7", color: "#1d1d1f", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONT },
  sTh:   { background: "#f5f5f7", color: "#6e6e73", fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const, padding: "9px 8px", border: "1px solid rgba(0,0,0,0.06)", textAlign: "left" as const, letterSpacing: "0.04em", position: "relative" as const },
  sTd:   { padding: "5px 8px", border: "1px solid rgba(0,0,0,0.06)", background: "#fff", verticalAlign: "middle" as const },
  sInp:  { width: "100%", background: "transparent", color: "#1d1d1f", border: "none", padding: 4, fontSize: 13, fontFamily: "ui-monospace,monospace", outline: "none", textAlign: "right" as const, boxSizing: "border-box" as const },
  sRo:   { padding: 4, fontSize: 13, fontFamily: "ui-monospace,monospace", color: "#6e6e73", userSelect: "none" as const },
};

// ── Accordion section ──────────────────────────────────────────────────────────

function Section({ id, step, title, summary, open, onToggle, children }: {
  id: string; step: string; title: string; summary?: string;
  open: boolean; onToggle: (id: string) => void; children: React.ReactNode;
}) {
  return (
    <div style={S.card}>
      <div onClick={() => onToggle(id)} style={S.hdr}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={S.badge}>{step}</span>
          <h2 style={S.title}>{title}</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {!open && summary && <span style={S.pill}>{summary}</span>}
          <span style={{ fontSize: 20, color: "#aeaeb2", fontWeight: 300 }}>{open ? "−" : "+"}</span>
        </div>
      </div>
      <div
        className={`accordion-content${open ? "" : " collapsed"}`}
        style={{ maxHeight: open ? "9999px" : "0" }}
      >
        <div style={S.body}>{children}</div>
      </div>
    </div>
  );
}

// ── Default state ──────────────────────────────────────────────────────────────

const DEFAULT_PORTFOLIOS: Portfolio[] = [
  { name: "Portfolio Alpha A", aumPct: 100 },
  { name: "Portfolio Alpha B", aumPct: 0 },
  { name: "Portfolio Alpha C", aumPct: 0 },
  { name: "Portfolio Alpha D", aumPct: 0 },
  { name: "Portfolio Alpha E", aumPct: 0 },
];

const makeStrategy = (): Strategy => ({
  obj: "realized", period: "1 year", aumPct: 100,
  hurdle: 6.0, stopLoss: 10.0, investments: [{ type: "", pct: "", stocks: [] }],
});

const DEFAULT_STRATEGIES: StrategiesMap = {
  1: [
    {
      obj: "unrealized", period: "10 years", aumPct: 40, hurdle: 8.5, stopLoss: 15.0,
      investments: [
        { type: "Large cap", pct: "50", stocks: [
          { exchange: "NASDAQ", ticker: "AAPL", confidence: "95", sharePct: "60", price: "180", strike: "200", action: "BUY", execute: "No" },
          { exchange: "NASDAQ", ticker: "MSFT", confidence: "95", sharePct: "40", price: "420", strike: "450", action: "BUY", execute: "No" },
        ]},
        { type: "ETF", pct: "50", stocks: [] },
      ],
    },
    { obj: "realized", period: "3 years", aumPct: 40, hurdle: 7.0, stopLoss: 12.0, investments: [{ type: "", pct: "", stocks: [] }] },
    { obj: "realized", period: "1 month", aumPct: 20, hurdle: 1.5, stopLoss: 5.0,  investments: [{ type: "", pct: "", stocks: [] }] },
  ],
  2: [makeStrategy()], 3: [makeStrategy()], 4: [makeStrategy()], 5: [makeStrategy()],
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [token,  setToken]  = useState("");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [wsName, setWsName] = useState("My Workspace");

  const [open, setOpen] = useState({ s1: true, s2: true, s3: true, s4: true });
  const toggle = (id: string) => setOpen(p => ({ ...p, [id]: !p[id as keyof typeof p] }));

  const [currency, setCurrency] = useState("USD");
  const [rawAum,   setRawAum]   = useState(10_000_000);
  const [pCount,   setPCount]   = useState(1);
  const usdEq = useMemo(() => rawAum * (CURRENCY_RATES[currency] ?? 1), [rawAum, currency]);

  const [portfolios, setPortfolios] = useState<Portfolio[]>(DEFAULT_PORTFOLIOS);
  const [strats,     setStrats]     = useState<StrategiesMap>(DEFAULT_STRATEGIES);
  const [tab3,       setTab3]       = useState(1);
  const [tab4,       setTab4]       = useState(1);
  const [vtab,       setVtab]       = useState(0);
  const [colFilters, setColFilters] = useState<Record<string, Record<string, string>>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const activeStrats3 = useMemo(() => strats[tab3] ?? [], [strats, tab3]);
  const activeStrats4 = strats[tab4] ?? [];
  const focusedStrat  = activeStrats4[vtab];
  const totalPct      = portfolios.slice(0, pCount).reduce((s, p) => s + p.aumPct, 0);

  // ── Auth & load ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setToken(session.access_token);
      fetch("/api/profile-workspace", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json())
        .then(({ workspace: w }) => {
          if (!w) return;
          if (w.name)            setWsName(w.name);
          if (w.currency)        setCurrency(w.currency);
          if (w.aum)             setRawAum(w.aum);
          if (w.portfolio_count) setPCount(w.portfolio_count);
          if (w.portfolios)      setPortfolios(w.portfolios);
          if (w.strategies)      setStrats(w.strategies);
        }).catch(() => {});
    });
  }, [router]);

  // ── Save ──
  async function save() {
    if (!token) return;
    setSaving(true);
    await fetch("/api/profile-workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: wsName, currency, aum: rawAum, portfolioCount: pCount, portfolios, strategies: strats }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // ── Portfolio allocation sliders ──
  function handleSlider(idx: number, val: string) {
    const updated = portfolios.map((p, i) => i === idx ? { ...p, aumPct: Math.max(0, Math.min(100, Number(val) || 0)) } : { ...p });
    let sum = 0;
    for (let i = 0; i < pCount - 1; i++) sum += updated[i].aumPct;
    updated[pCount - 1] = { ...updated[pCount - 1], aumPct: Math.max(0, 100 - sum) };
    setPortfolios(updated);
  }

  // ── Strategy row update ──
  const updateStrat = useCallback((rowIdx: number, key: string, val: unknown, targetTab?: number) => {
    const tab  = targetTab ?? tab3;
    const rows = [...(strats[tab] ?? [])];
    const row: Strategy = { ...rows[rowIdx], [key]: val };

    if (key === "obj") {
      const p  = STRATEGY_PRESETS[val as string];
      row.period   = p.periods[0];
      row.hurdle   = typeof p.hurdle   === "object" ? (p.hurdle   as Record<string,number>)[row.period] : p.hurdle as number;
      row.stopLoss = typeof p.stopLoss === "object" ? (p.stopLoss as Record<string,number>)[row.period] : p.stopLoss as number;
    }
    if (key === "period") {
      const p  = STRATEGY_PRESETS[row.obj];
      row.hurdle   = typeof p.hurdle   === "object" ? (p.hurdle   as Record<string,number>)[val as string] : p.hurdle as number;
      row.stopLoss = typeof p.stopLoss === "object" ? (p.stopLoss as Record<string,number>)[val as string] : p.stopLoss as number;
    }

    rows[rowIdx] = row;

    if (key === "aumPct") {
      let running = 0;
      for (let i = 0; i < rows.length - 1; i++) {
        if (running + rows[i].aumPct > 100) rows[i] = { ...rows[i], aumPct: 100 - running };
        running += rows[i].aumPct;
      }
      rows[rows.length - 1] = { ...rows[rows.length - 1], aumPct: Math.max(0, 100 - running) };
    }

    setStrats(p => ({ ...p, [tab]: rows }));
  }, [strats, tab3]);

  function addStratRow() {
    const rows  = [...activeStrats3];
    const sum   = rows.slice(0, -1).reduce((s, r) => s + r.aumPct, 0);
    const avail = Math.max(0, 100 - sum);
    rows.splice(rows.length - 1, 0, { obj: "realized", period: "3 years", aumPct: Math.min(10, avail), hurdle: 7.0, stopLoss: 12.0, investments: [{ type: "", pct: "", stocks: [] }] });
    const newSum = rows.slice(0, -1).reduce((s, r) => s + r.aumPct, 0);
    rows[rows.length - 1] = { ...rows[rows.length - 1], aumPct: Math.max(0, 100 - newSum) };
    setStrats(p => ({ ...p, [tab3]: rows }));
  }

  // ── Render ──
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f7", fontFamily: FONT }}>

      {/* Nav */}
      <nav style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, position: "sticky", top: 0, zIndex: 50 }}>
        <Link href="/" style={{ fontSize: 14, color: "#0071e3", textDecoration: "none" }}>← Dashboard</Link>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f" }}>Wealth Management Workspace</span>
        <button onClick={save} disabled={saving} style={{ padding: "7px 20px", background: saved ? "#34c759" : saving ? "#aeaeb2" : "#0071e3", color: "#fff", border: "none", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", fontFamily: FONT, transition: "background 0.2s" }}>
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
        </button>
      </nav>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 32px" }}>

        <input value={wsName} onChange={e => setWsName(e.target.value)} placeholder="Workspace name…"
          style={{ fontSize: 22, fontWeight: 600, color: "#1d1d1f", background: "transparent", border: "none", outline: "none", fontFamily: FONT, marginBottom: 20, width: "100%", display: "block" }} />

        {/* ── 01 Portfolio Baseline ── */}
        <Section id="s1" step="01" title="Portfolio Baseline" summary={`${fmt(rawAum)} ${currency}`} open={open.s1} onToggle={toggle}>
          <div style={S.grid}>
            <div>
              <label style={S.lbl}>Currency Base</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={S.sel}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Baseline Volume Allocation</label>
              <input type="text" value={fmt(rawAum)} onChange={e => setRawAum(parseMoney(e.target.value))} style={S.inp} />
            </div>
            <div>
              <label style={S.lbl}>Global Index Equivalent (USD)</label>
              <div style={S.disp}>${Math.round(usdEq).toLocaleString("en-US")}</div>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <label style={S.lbl}>Structure Node Count</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                  onClick={() => { setPCount(n); if (tab3 > n) setTab3(1); if (tab4 > n) setTab4(1); }}
                  style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: 20, border: "1px solid", borderColor: pCount === n ? "#0071e3" : "rgba(0,0,0,0.12)", background: pCount === n ? "#0071e3" : "#fff", color: pCount === n ? "#fff" : "#1d1d1f", cursor: "pointer", fontFamily: FONT }}>
                  {n} {n === 1 ? "Portfolio" : "Portfolios"}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── 02 Component Framework Split ── */}
        <Section id="s2" step="02" title="Component Framework Split" summary={`Total: ${totalPct}%`} open={open.s2} onToggle={toggle}>
          <div style={{ overflowX: "auto" }}>
            <table style={S.tbl}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: "33%" }}>Target Profile Unit Identification</th>
                  <th style={{ ...S.th, width: "67%", paddingLeft: 16 }}>AUM Allocation Distribution Matrix</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: pCount }).map((_, i) => {
                  const isLast = i === pCount - 1;
                  return (
                    <tr key={i}>
                      <td style={S.td}>
                        <input type="text" value={portfolios[i].name}
                          onChange={e => { const u = portfolios.map((p, j) => j === i ? { ...p, name: e.target.value } : p); setPortfolios(u); }}
                          style={{ ...S.inp, textAlign: "left" }} />
                      </td>
                      <td style={{ ...S.td, paddingLeft: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <input type="range" min="0" max="100" value={portfolios[i].aumPct}
                            disabled={isLast && pCount > 1}
                            onChange={e => handleSlider(i, e.target.value)}
                            style={{ flex: 1, accentColor: "#0071e3", height: 4, cursor: "pointer", opacity: isLast && pCount > 1 ? 0.3 : 1 }} />
                          <span style={{ fontSize: 13, fontFamily: "ui-monospace,monospace", color: "#1d1d1f", background: "#f5f5f7", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", minWidth: 52, textAlign: "right" }}>
                            {portfolios[i].aumPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 03 Profile Allocation Models ── */}
        <Section id="s3" step="03" title="Profile Allocation Models" summary={`Active Nodes: ${pCount}`} open={open.s3} onToggle={toggle}>
          <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", overflowX: "auto", marginBottom: 16 }}>
            {Array.from({ length: pCount }).map((_, i) => (
              <button key={i} type="button" onClick={() => setTab3(i + 1)} style={tab3 === i + 1 ? S.tabA : S.tabI}>
                {portfolios[i].name || `Portfolio #${i + 1}`}
              </button>
            ))}
          </div>
          <div style={{ background: "#f5f5f7", padding: 16, borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...S.tbl, tableLayout: "fixed", minWidth: 1000 }}>
                <thead>
                  <tr>
                    {[["Strategy Target","15%"],["Temporal Range","12%"],["% Target","8%"],["Hurdle %","10%"],["Stop %","10%"],["Sub-Allocation Blocks","45%"]].map(([h, w]) => (
                      <th key={h} style={{ ...S.th, width: w }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeStrats3.map((row, ri) => {
                    const isLast = ri === activeStrats3.length - 1;
                    const cellStyle = { padding: "8px 8px 8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" };
                    return (
                      <tr key={ri}>
                        <td style={cellStyle}>
                          <select value={row.obj} onChange={e => updateStrat(ri, "obj", e.target.value)} style={{ ...S.sel, fontSize: 13, padding: "7px 10px" }}>
                            <option value="unrealized">Unrealized Execution</option>
                            <option value="realized">Realized Execution</option>
                          </select>
                        </td>
                        <td style={cellStyle}>
                          <select value={row.period} onChange={e => updateStrat(ri, "period", e.target.value)} style={{ ...S.sel, fontSize: 13, padding: "7px 10px" }}>
                            {STRATEGY_PRESETS[row.obj].periods.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </td>
                        <td style={cellStyle}>
                          <input type="number" value={row.aumPct} disabled={isLast}
                            onChange={e => updateStrat(ri, "aumPct", Number(e.target.value))}
                            style={{ ...S.inp, fontSize: 13, padding: "7px 10px" }} />
                        </td>
                        <td style={cellStyle}>
                          <input type="number" value={row.hurdle} onChange={e => updateStrat(ri, "hurdle", Number(e.target.value))}
                            style={{ ...S.inp, fontSize: 13, padding: "7px 10px", color: "#1a7f3c" }} />
                        </td>
                        <td style={cellStyle}>
                          <input type="number" value={row.stopLoss} onChange={e => updateStrat(ri, "stopLoss", Number(e.target.value))}
                            style={{ ...S.inp, fontSize: 13, padding: "7px 10px", color: "#c0392b" }} />
                        </td>
                        <td style={{ ...cellStyle, paddingRight: 0 }}>
                          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0" }}>
                            {(row.investments ?? []).map((inv, ii) => (
                              <div key={ii} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", padding: 8, borderRadius: 10, display: "flex", flexDirection: "column", gap: 6, width: 120, flexShrink: 0 }}>
                                <select value={inv.type}
                                  onChange={e => {
                                    const upd = [...row.investments];
                                    upd[ii] = { ...upd[ii], type: e.target.value, stocks: upd[ii].stocks ?? [] };
                                    if (e.target.value && ii === upd.length - 1) upd.push({ type: "", pct: "", stocks: [] });
                                    if (!e.target.value && ii < upd.length - 1) upd.splice(ii, 1);
                                    updateStrat(ri, "investments", upd);
                                  }}
                                  style={{ ...S.sel, fontSize: 12, padding: "5px 6px" }}>
                                  <option value="">-- Class --</option>
                                  {INVESTMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                                {inv.type && (
                                  <input type="number" placeholder="%" value={inv.pct}
                                    onChange={e => {
                                      const upd = [...row.investments];
                                      upd[ii] = { ...upd[ii], pct: e.target.value };
                                      updateStrat(ri, "investments", upd);
                                    }}
                                    style={{ ...S.inp, fontSize: 12, padding: "5px 6px", color: "#0071e3" }} />
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
            </div>
            <button type="button" onClick={addStratRow}
              style={{ marginTop: 12, background: "#fff", color: "#0071e3", border: "1px solid rgba(0,0,0,0.08)", padding: "7px 16px", fontSize: 13, borderRadius: 10, cursor: "pointer", fontFamily: FONT }}>
              + Add Execution Node
            </button>
          </div>
        </Section>

        {/* ── 04 Build Portfolio ── */}
        <Section id="s4" step="04" title="Build Portfolio" open={open.s4} onToggle={toggle}>
          <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", overflowX: "auto", marginBottom: 16 }}>
            {Array.from({ length: pCount }).map((_, i) => (
              <button key={i} type="button" onClick={() => { setTab4(i + 1); setVtab(0); }} style={tab4 === i + 1 ? S.tabA : S.tabI}>
                {portfolios[i].name || `Portfolio #${i + 1}`}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 20, minHeight: 300 }}>

            {/* Vertical strategy tabs */}
            <div style={{ width: 220, display: "flex", flexDirection: "column", gap: 6, borderRight: "1px solid rgba(0,0,0,0.08)", paddingRight: 16, flexShrink: 0 }}>
              {activeStrats4.map((r, idx) => (
                <button key={idx} type="button" onClick={() => setVtab(idx)} style={vtab === idx ? S.vtabA : S.vtabI}>
                  <span>{r.obj === "unrealized" ? "Unrealized" : "Realized"} ({r.period})</span>
                  <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, background: vtab === idx ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: 6 }}>
                    {r.aumPct}%
                  </span>
                </button>
              ))}
            </div>

            {/* Spreadsheet */}
            <div style={{ flex: 1, background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", overflowX: "auto" }}>
              {focusedStrat ? (() => {
                const portAlloc  = (portfolios[tab4 - 1]?.aumPct ?? 0) / 100;
                const stratAlloc = focusedStrat.aumPct / 100;
                const rawVol     = rawAum * portAlloc * stratAlloc;
                const validInvs  = (focusedStrat.investments ?? []).filter(i => i.type && Number(i.pct) > 0);

                const COLS: [string, string, string][] = [
                  ["exchange","Exchange","10%"], ["ticker","Ticker","8%"],
                  ["confidence","Conf.","7%"],   ["sharePct","% Total","7%"],
                  ["price","Price","7%"],         ["strike","Strike","7%"],
                  ["action","Signal","8%"],       ["execute","Approve","9%"],
                ];

                return (
                  <div>
                    {validInvs.length === 0 ? (
                      <div style={{ padding: 32, color: "#aeaeb2", textAlign: "center", fontSize: 14 }}>
                        No asset allocations defined in Section 03.
                      </div>
                    ) : validInvs.map((item, itemIdx) => {
                      const assetVol    = rawVol * (Number(item.pct) / 100);
                      const allStocks   = item.stocks ?? [];
                      const fk          = `${tab4}-${vtab}-${itemIdx}`;
                      const flt         = colFilters[fk] ?? {};
                      const visStocks   = allStocks.filter(s =>
                        Object.entries(flt).every(([k, v]) => !v || String(s[k as keyof Stock] ?? "").toLowerCase().includes(v.toLowerCase()))
                      );
                      const investedVol = allStocks.filter(s => s.execute === "Yes").reduce((sum, s) => sum + assetVol * ((Number(s.sharePct) || 0) / 100), 0);
                      const available   = assetVol - investedVol;
                      const masterIdx   = focusedStrat.investments.findIndex(i => i.type === item.type && i.pct === item.pct);

                      function patchStocks(fn: (ss: Stock[]) => Stock[]) {
                        const invs = [...focusedStrat.investments];
                        invs[masterIdx] = { ...invs[masterIdx], stocks: fn([...(invs[masterIdx].stocks ?? [])]) };
                        updateStrat(vtab, "investments", invs, tab4);
                      }

                      return (
                        <div key={itemIdx} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>

                          {/* Asset class summary bar */}
                          <div style={{ padding: "10px 14px", background: "#f5f5f7", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: "ui-monospace,monospace", fontSize: 12 }}>
                            <div style={{ color: "#0071e3", fontWeight: 600, marginBottom: 6 }}>{item.type.toUpperCase()} ({item.pct}%)</div>
                            <div style={{ display: "flex", gap: 24, color: "#6e6e73" }}>
                              {([["Budget", fmt(assetVol), "#1d1d1f"], ["Invested", fmt(investedVol), "#1a7f3c"], ["Available", fmt(available), available < 0 ? "#c0392b" : "#1d1d1f"]] as [string,string,string][]).map(([lbl, val, col]) => (
                                <div key={lbl}>
                                  <div style={{ fontSize: 11 }}>{lbl}</div>
                                  <div style={{ color: col, fontWeight: 600 }}>{val} {currency}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Stock table */}
                          <table style={{ ...S.tbl, fontSize: 13, fontFamily: "ui-monospace,monospace" }}>
                            <thead>
                              <tr>
                                {COLS.map(([key, lbl, w]) => (
                                  <th key={key} style={{ ...S.sTh, width: w }}>
                                    <button type="button"
                                      onClick={() => setOpenFilter(p => p === `${fk}-${key}` ? null : `${fk}-${key}`)}
                                      style={{ background: "none", border: "none", color: flt[key] ? "#0071e3" : "#aeaeb2", cursor: "pointer", marginRight: 4, padding: 0, verticalAlign: "middle" }}>
                                      <svg viewBox="0 0 24 24" width={11} height={11} fill="currentColor"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" /></svg>
                                    </button>
                                    {lbl}
                                    {openFilter === `${fk}-${key}` && (
                                      <div style={{ position: "absolute", top: 30, left: 4, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, padding: 8, zIndex: 30, width: 130, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                                        <input autoFocus value={flt[key] ?? ""}
                                          onChange={e => setColFilters(p => ({ ...p, [fk]: { ...flt, [key]: e.target.value } }))}
                                          placeholder="Filter…"
                                          style={{ ...S.sInp, background: "#f5f5f7", border: "1px solid rgba(0,0,0,0.08)", textAlign: "left", borderRadius: 6, padding: "6px 8px", width: "100%" }} />
                                      </div>
                                    )}
                                  </th>
                                ))}
                                <th style={{ ...S.sTh, width: "7%",  textAlign: "right" }}>Units</th>
                                <th style={{ ...S.sTh, width: "10%", textAlign: "right" }}>Amount ({currency})</th>
                                <th style={{ ...S.sTh, width: "5%"  }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {visStocks.map((stock) => {
                                const realIdx  = allStocks.indexOf(stock);
                                const stockVol = assetVol * ((Number(stock.sharePct) || 0) / 100);
                                const units    = Number(stock.price) > 0 ? Math.floor(stockVol / Number(stock.price)) : 0;
                                const patch    = (field: string, val: string) =>
                                  patchStocks(ss => { ss[realIdx] = { ...ss[realIdx], [field]: val }; return ss; });

                                return (
                                  <tr key={realIdx}>
                                    <td style={S.sTd}><div style={{ ...S.sRo, textAlign: "left" }}>{stock.exchange || "NASDAQ"}</div></td>
                                    <td style={S.sTd}><input type="text" placeholder="--" value={stock.ticker} onChange={e => patch("ticker", e.target.value.toUpperCase())} style={{ ...S.sInp, textAlign: "left" }} /></td>
                                    <td style={{ ...S.sTd, textAlign: "right" }}><div style={S.sRo}>{stock.confidence}%</div></td>
                                    <td style={S.sTd}><input type="number" placeholder="0.0"  value={stock.sharePct} onChange={e => patch("sharePct", e.target.value)} style={S.sInp} /></td>
                                    <td style={S.sTd}><input type="number" placeholder="0.00" value={stock.price}    onChange={e => patch("price",    e.target.value)} style={S.sInp} /></td>
                                    <td style={S.sTd}><input type="number" placeholder="0.00" value={stock.strike}   onChange={e => patch("strike",   e.target.value)} style={S.sInp} /></td>
                                    <td style={{ ...S.sTd, textAlign: "center" }}>
                                      <div style={{ color: stock.action === "SELL" ? "#c0392b" : "#1a7f3c", fontWeight: 600, userSelect: "none" }}>{stock.action || "BUY"}</div>
                                    </td>
                                    <td style={{ ...S.sTd, textAlign: "center" }}>
                                      <div onClick={() => patch("execute", stock.execute === "Yes" ? "No" : "Yes")}
                                        style={{ position: "relative", width: 52, height: 22, borderRadius: 999, cursor: "pointer", background: stock.execute === "Yes" ? "#34c759" : "#e5e5ea", transition: "background 0.2s", margin: "0 auto" }}>
                                        <span style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", fontSize: 9, fontWeight: 700, color: stock.execute === "Yes" ? "#fff" : "transparent", zIndex: 1 }}>YES</span>
                                        <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 9, fontWeight: 700, color: stock.execute === "No"  ? "#6e6e73" : "transparent", zIndex: 1 }}>NO</span>
                                        <div style={{ position: "absolute", top: 2, left: stock.execute === "Yes" ? 32 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", zIndex: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                                      </div>
                                    </td>
                                    <td style={{ ...S.sTd, textAlign: "right", paddingRight: 10, color: "#1d1d1f" }}>{units.toLocaleString("en-US")}</td>
                                    <td style={{ ...S.sTd, textAlign: "right", paddingRight: 10, color: "#0071e3" }}>{fmt(stockVol)}</td>
                                    <td style={{ ...S.sTd, textAlign: "center" }}>
                                      <button type="button" onClick={() => patchStocks(ss => { ss.splice(realIdx, 1); return ss; })}
                                        style={{ background: "none", border: "none", color: "#aeaeb2", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>×</button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>

                          <div style={{ padding: "10px 14px" }}>
                            <button type="button"
                              onClick={() => patchStocks(ss => { ss.push({ exchange: "NASDAQ", ticker: "", confidence: "95", sharePct: "", price: "", strike: "", action: "BUY", execute: "No" }); return ss; })}
                              style={{ background: "transparent", color: "#0071e3", border: "1px solid rgba(0,113,227,0.3)", padding: "6px 14px", fontSize: 12, borderRadius: 8, cursor: "pointer", fontFamily: FONT }}>
                              + Add Stock
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <div style={{ padding: 32, fontSize: 13, color: "#aeaeb2", textAlign: "center" }}>
                  Select a strategy from the left panel to build the portfolio.
                </div>
              )}
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
