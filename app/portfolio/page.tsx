"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

interface Wallet { id: number; current_balance: number; initial_balance: number }
interface Position {
  id: number; portfolio_id: number; profile_id: number;
  symbol: string; company_name: string; sector: string;
  quantity: number; buy_price: number; buy_amount: number;
  target_price: number; hurdle_rate: number; expected_return: number | null;
  current_price: number | null; current_value: number | null;
  status: "holding" | "target_hit" | "sold";
  bought_at: string;
}
interface Transaction {
  id: number; type: string; symbol: string; company_name: string;
  quantity: number; price: number; amount: number;
  balance_before: number; balance_after: number; created_at: string;
}

function fmt(n: number) { return n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`; }
function fmtPct(n: number) { return n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`; }

export default function PortfolioPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [wallet, setWallet]           = useState<Wallet | null>(null);
  const [positions, setPositions]     = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [selling, setSelling]         = useState<number | null>(null);
  const [confirmSell, setConfirmSell] = useState<number | null>(null);
  // Live prices fetched after load
  const [livePrices, setLivePrices]   = useState<Record<string, number>>({});

  const load = useCallback(async (tok: string) => {
    const res = await fetch("/api/vip/portfolio", {
      headers: { Authorization: `Bearer ${tok}` }, cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      setWallet(json.wallet ?? null);
      setPositions(json.positions ?? []);
      setTransactions(json.transactions ?? []);
      // Fetch live prices for active positions
      const syms = (json.positions ?? []).map((p: Position) => p.symbol);
      if (syms.length > 0) {
        fetch("/api/market/prices", {
          method: "POST",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: syms }),
        }).then((r) => r.json()).then((d) => {
          if (d.prices) {
            setLivePrices(Object.fromEntries(
              Object.entries(d.prices as Record<string, { price: number }>).map(([k, v]) => [k, v.price])
            ));
          }
        }).catch(() => {});
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setToken(session.access_token);
      load(session.access_token);
    });
  }, [router, load]);

  async function handleRefresh() {
    if (!token) return;
    setRefreshing(true);
    await fetch("/api/vip/refresh-prices", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await load(token);
    setRefreshing(false);
  }

  async function handleSell(positionId: number) {
    if (!token) return;
    setSelling(positionId);
    setConfirmSell(null);
    const res = await fetch("/api/vip/sell", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ position_id: positionId }),
    });
    if (res.ok) await load(token);
    setSelling(null);
  }

  // Get the best current price: live > stored > buy price
  function currentPrice(pos: Position): number {
    return livePrices[pos.symbol] ?? pos.current_price ?? pos.buy_price;
  }

  // Summary calculations
  const totalInvested  = positions.reduce((s, p) => s + p.buy_amount, 0);
  const totalCurrent   = positions.reduce((s, p) => s + currentPrice(p) * p.quantity, 0);
  const totalUnrealised = totalCurrent - totalInvested;
  const cashBalance    = wallet?.current_balance ?? 0;
  const targetHitCount = positions.filter((p) => p.status === "target_hit").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" style={APPLE}>
        <p className="text-[#6e6e73]">Loading portfolio…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col" style={APPLE}>
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/market" className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f]">← Market</Link>
            <span className="text-[15px] font-semibold text-[#1d1d1f]">Virtual Investment Portfolio (VIP)</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/portfolio/health" className="text-[13px] text-[#0071e3] hover:underline">Health Report →</Link>
            <button onClick={handleRefresh} disabled={refreshing}
              className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5ea] disabled:opacity-40 transition-colors">
              {refreshing ? "Refreshing…" : "↻ Refresh Prices"}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 pb-16 flex-1">

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-black/[0.08] p-5">
            <p className="text-[11px] text-[#aeaeb2] uppercase tracking-wide mb-1">Available Cash</p>
            <p className="text-[24px] font-bold" style={{ color: "#0071e3" }}>${cashBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
            <p className="text-[11px] text-[#aeaeb2] mt-0.5">of ${(wallet?.initial_balance ?? 10000).toLocaleString()} starting balance</p>
          </div>
          <div className="bg-white rounded-2xl border border-black/[0.08] p-5">
            <p className="text-[11px] text-[#aeaeb2] uppercase tracking-wide mb-1">Invested</p>
            <p className="text-[24px] font-bold text-[#1d1d1f]">${totalInvested.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
            <p className="text-[11px] text-[#aeaeb2] mt-0.5">in {positions.length} active position{positions.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-white rounded-2xl border border-black/[0.08] p-5">
            <p className="text-[11px] text-[#aeaeb2] uppercase tracking-wide mb-1">Current Value</p>
            <p className="text-[24px] font-bold text-[#1d1d1f]">${totalCurrent.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
            <p className="text-[11px] text-[#aeaeb2] mt-0.5">at {livePrices && Object.keys(livePrices).length > 0 ? "live price" : "last known price"}</p>
          </div>
          <div className="bg-white rounded-2xl border border-black/[0.08] p-5">
            <p className="text-[11px] text-[#aeaeb2] uppercase tracking-wide mb-1">Unrealised P&L</p>
            <p className="text-[24px] font-bold" style={{ color: totalUnrealised >= 0 ? "#16a34a" : "#dc2626" }}>
              {fmt(totalUnrealised)}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: totalUnrealised >= 0 ? "#16a34a" : "#dc2626" }}>
              {totalInvested > 0 ? fmtPct((totalUnrealised / totalInvested) * 100) : "—"}
            </p>
          </div>
        </div>

        {/* ── Target Hit Alerts ── */}
        {targetHitCount > 0 && (
          <div className="rounded-2xl border-2 p-5 mb-6" style={{ borderColor: "#16a34a", background: "#f0fdf4" }}>
            <p className="text-[15px] font-bold mb-3" style={{ color: "#15803d" }}>🏆 {targetHitCount} position{targetHitCount !== 1 ? "s" : ""} hit target price!</p>
            <div className="space-y-2">
              {positions.filter((p) => p.status === "target_hit").map((p) => {
                const cur = currentPrice(p);
                const gain = (cur - p.buy_price) * p.quantity;
                const gainPct = ((cur - p.buy_price) / p.buy_price) * 100;
                return (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 flex-wrap gap-2">
                    <div>
                      <span className="text-[14px] font-bold text-[#1d1d1f]">{p.symbol}</span>
                      <span className="text-[12px] text-[#6e6e73] ml-2">{p.quantity.toFixed(4)} shares bought @ ${p.buy_price.toFixed(2)}</span>
                      <span className="text-[12px] font-semibold ml-3" style={{ color: "#16a34a" }}>
                        Now ${cur.toFixed(2)} · {fmtPct(gainPct)} · Profit ${gain.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {confirmSell === p.id ? (
                        <>
                          <button onClick={() => setConfirmSell(null)} className="px-3 py-1.5 rounded-lg text-[12px] bg-[#f5f5f7] text-[#6e6e73]">Cancel</button>
                          <button onClick={() => handleSell(p.id)} disabled={selling === p.id}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-[#16a34a] disabled:opacity-40">
                            {selling === p.id ? "Selling…" : "Confirm Sell"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setConfirmSell(p.id)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white" style={{ background: "#16a34a" }}>Sell</button>
                          <button className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#0071e3] bg-[#f0f6ff]">Hold</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Positions Table ── */}
        {positions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/[0.08] p-10 text-center mb-8">
            <p className="text-[15px] text-[#6e6e73] mb-2">No active positions.</p>
            <p className="text-[13px] text-[#aeaeb2]">Go to <Link href="/market" className="text-[#0071e3] hover:underline">Market Intelligence</Link> and click Buy on any stock.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden mb-8">
            <div className="px-5 py-3 border-b border-[#f0f0f0] bg-[#f9f9f9] grid text-[10px] font-semibold uppercase tracking-wide text-[#aeaeb2]"
              style={{ gridTemplateColumns: "1fr 5rem 5rem 5rem 5rem 5rem 6rem 5rem" }}>
              <span>Stock</span>
              <span className="text-right">Shares</span>
              <span className="text-right">Buy Price</span>
              <span className="text-right">Now</span>
              <span className="text-right">Target</span>
              <span className="text-right">P&L</span>
              <span className="text-right">Progress</span>
              <span className="text-right">Action</span>
            </div>
            {positions.map((pos) => {
              const cur      = currentPrice(pos);
              const curValue = cur * pos.quantity;
              const gain     = curValue - pos.buy_amount;
              const gainPct  = ((cur - pos.buy_price) / pos.buy_price) * 100;
              const progress = Math.min(100, Math.max(0, (gainPct / pos.hurdle_rate) * 100));
              const isHit    = pos.status === "target_hit";

              return (
                <div key={pos.id}
                  className="grid px-5 py-3 items-center border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors text-[13px]"
                  style={{ gridTemplateColumns: "1fr 5rem 5rem 5rem 5rem 5rem 6rem 5rem" }}>
                  <div>
                    <div className="flex items-center gap-1.5">
                      {isHit && <span>🏆</span>}
                      <span className="font-bold text-[#1d1d1f]">{pos.symbol}</span>
                    </div>
                    <p className="text-[10px] text-[#aeaeb2]">{pos.company_name}</p>
                  </div>
                  <span className="text-right text-[#6e6e73]">{pos.quantity.toFixed(4)}</span>
                  <span className="text-right text-[#6e6e73]">${pos.buy_price.toFixed(2)}</span>
                  <span className="text-right font-semibold text-[#1d1d1f]">${cur.toFixed(2)}</span>
                  <span className="text-right text-[#6e6e73]">${pos.target_price.toFixed(2)}</span>
                  <span className="text-right font-semibold" style={{ color: gain >= 0 ? "#16a34a" : "#dc2626" }}>
                    {fmtPct(gainPct)}
                  </span>
                  <div className="px-1">
                    <div className="h-1.5 bg-[#e5e5ea] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, background: isHit ? "#16a34a" : progress > 60 ? "#ff9f0a" : "#0071e3" }} />
                    </div>
                    <p className="text-[9px] text-[#aeaeb2] mt-0.5 text-right">{progress.toFixed(0)}% to target</p>
                  </div>
                  <div className="flex justify-end">
                    {confirmSell === pos.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => setConfirmSell(null)} className="px-2 py-1 rounded text-[10px] bg-[#f5f5f7] text-[#6e6e73]">✕</button>
                        <button onClick={() => handleSell(pos.id)} disabled={selling === pos.id}
                          className="px-2 py-1 rounded text-[10px] font-semibold text-white bg-red-500 disabled:opacity-40">
                          {selling === pos.id ? "…" : "Sell"}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmSell(pos.id)}
                        className="px-3 py-1 rounded-lg text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                        Sell
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Recent Transactions ── */}
        {transactions.length > 0 && (
          <div>
            <h2 className="text-[16px] font-bold text-[#1d1d1f] mb-3">Transaction History</h2>
            <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] px-2 py-0.5 rounded font-bold"
                      style={{ background: tx.type === "buy" ? "#f0f6ff" : tx.type === "sell" ? "#f0fdf4" : "#f5f5f7",
                               color:      tx.type === "buy" ? "#0071e3" : tx.type === "sell" ? "#16a34a" : "#6e6e73" }}>
                      {tx.type.toUpperCase()}
                    </span>
                    <div>
                      <span className="text-[13px] font-semibold text-[#1d1d1f]">{tx.symbol}</span>
                      {tx.quantity > 0 && (
                        <span className="text-[11px] text-[#6e6e73] ml-2">
                          {tx.quantity.toFixed(4)} shares @ ${tx.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-semibold" style={{ color: tx.type === "buy" ? "#dc2626" : "#16a34a" }}>
                      {tx.type === "buy" ? "-" : tx.type === "sell" ? "+" : ""}${tx.amount.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-[#aeaeb2]">
                      Balance: ${tx.balance_after.toFixed(2)} · {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-black/[0.06] py-5 text-center">
        <p className="text-[11px] text-[#aeaeb2]">Virtual portfolio — not real money. For learning purposes only.</p>
      </footer>
    </div>
  );
}
