"use client";

import { useState, useEffect } from "react";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

interface BuyModalProps {
  symbol: string;
  company_name: string;
  sector: string;
  current_price: number | null;   // may be null if FMP didn't load
  expected_return: number | null;
  hurdle_rate: number;
  profile_id: number;
  profile_name: string;
  available_balance: number;
  token: string;
  onClose: () => void;
  onSuccess: (new_balance: number) => void;
}

export default function BuyModal({
  symbol, company_name, sector, current_price: initialPrice, expected_return,
  hurdle_rate, profile_id, profile_name, available_balance, token,
  onClose, onSuccess,
}: BuyModalProps) {
  const [livePrice, setLivePrice] = useState<number | null>(initialPrice);
  const [fetchingPrice, setFetchingPrice] = useState(initialPrice === null);
  const [mode, setMode] = useState<"shares" | "amount">("amount");
  const [shares, setShares] = useState("1");
  const [amount, setAmount] = useState("1000");
  const [buying, setBuying] = useState(false);

  // Fetch live price if not available
  useEffect(() => {
    if (initialPrice !== null) { setLivePrice(initialPrice); return; }
    setFetchingPrice(true);
    fetch(`/api/market/price?symbol=${symbol}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const d = await r.json();
        if (d.price) setLivePrice(d.price);
      })
      .catch(() => {})
      .finally(() => setFetchingPrice(false));
  }, [symbol, initialPrice, token]);

  const [manualPrice, setManualPrice] = useState("");
  const current_price = livePrice ?? (parseFloat(manualPrice) || 0);
  const [error, setError] = useState<string | null>(null);

  const sharesNum = parseFloat(shares) || 0;
  const amountNum = parseFloat(amount) || 0;

  const effectiveShares = mode === "shares" ? sharesNum : amountNum / current_price;
  const effectiveAmount = mode === "shares" ? sharesNum * current_price : amountNum;

  const targetPrice = current_price * (1 + hurdle_rate / 100);
  const bonusTarget  = expected_return && expected_return > hurdle_rate
    ? current_price * (1 + expected_return / 100)
    : null;
  const afterBalance = available_balance - effectiveAmount;
  const isValid = effectiveShares > 0 && effectiveAmount > 0 && effectiveAmount <= available_balance;

  async function handleBuy() {
    if (!isValid) return;
    setBuying(true);
    setError(null);
    try {
      const res = await fetch("/api/vip/buy", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id, symbol, company_name, sector,
          quantity: parseFloat(effectiveShares.toFixed(4)),
          buy_price: current_price,
          hurdle_rate, expected_return,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Buy failed"); return; }
      onSuccess(json.new_balance);
    } catch (e) {
      setError(String(e));
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={APPLE}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#f0f0f0]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-[#1d1d1f]">{symbol}</h2>
              <p className="text-[13px] text-[#6e6e73]">{company_name} · {sector}</p>
            </div>
            <button onClick={onClose} className="text-[#aeaeb2] hover:text-[#1d1d1f] text-[20px] leading-none">×</button>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            {fetchingPrice ? (
              <span className="text-[18px] text-[#aeaeb2]">Fetching live price…</span>
            ) : livePrice ? (
              <>
                <span className="text-[32px] font-bold text-[#1d1d1f]">${livePrice.toFixed(2)}</span>
                <span className="text-[13px] text-[#6e6e73]">live price</span>
              </>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[13px] text-[#aeaeb2]">Enter price manually:</span>
                <div className="flex items-center gap-1 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-1.5 focus-within:border-[#0071e3] focus-within:bg-white transition-all">
                  <span className="text-[14px] text-[#6e6e73]">$</span>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="e.g. 420.50"
                    className="w-28 bg-transparent text-[15px] font-semibold text-[#1d1d1f] focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Target prices */}
        <div className="px-6 py-4 bg-[#f9f9f9] border-b border-[#f0f0f0]">
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] font-semibold text-[#aeaeb2] uppercase tracking-wide">Target Price</p>
              <p className="text-[16px] font-bold text-[#1d1d1f]">${targetPrice.toFixed(2)}</p>
              <p className="text-[11px] text-[#6e6e73]">+{hurdle_rate.toFixed(1)}% hurdle</p>
            </div>
            {bonusTarget && (
              <div className="pl-4 border-l border-[#e5e5ea]">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#059669" }}>⚡ Upside Potential</p>
                <p className="text-[16px] font-bold" style={{ color: "#059669" }}>${bonusTarget.toFixed(2)}</p>
                <p className="text-[11px]" style={{ color: "#34d399" }}>+{expected_return!.toFixed(1)}% AI estimate</p>
              </div>
            )}
          </div>
        </div>

        {/* Amount input */}
        <div className="px-6 py-5">
          <div className="flex gap-2 mb-4">
            {(["amount", "shares"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all border"
                style={{ background: mode === m ? "#0071e3" : "#f5f5f7", color: mode === m ? "white" : "#6e6e73", borderColor: mode === m ? "#0071e3" : "#e5e5ea" }}>
                {m === "amount" ? "By Amount ($)" : "By Shares"}
              </button>
            ))}
          </div>

          {mode === "amount" ? (
            <div>
              <label className="text-[12px] text-[#6e6e73] mb-1.5 block">Investment Amount</label>
              <div className="flex items-center gap-2 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3 focus-within:border-[#0071e3] focus-within:bg-white transition-all">
                <span className="text-[17px] font-semibold text-[#1d1d1f]">$</span>
                <input type="number" value={amount} min="1" step="100"
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-transparent text-[17px] font-semibold text-[#1d1d1f] focus:outline-none" />
              </div>
              <p className="text-[11px] text-[#aeaeb2] mt-1">≈ {(amountNum / current_price).toFixed(4)} shares</p>
            </div>
          ) : (
            <div>
              <label className="text-[12px] text-[#6e6e73] mb-1.5 block">Number of Shares</label>
              <div className="flex items-center gap-2 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3 focus-within:border-[#0071e3] focus-within:bg-white transition-all">
                <input type="number" value={shares} min="0.001" step="1"
                  onChange={(e) => setShares(e.target.value)}
                  className="flex-1 bg-transparent text-[17px] font-semibold text-[#1d1d1f] focus:outline-none" />
                <span className="text-[13px] text-[#6e6e73]">shares</span>
              </div>
              <p className="text-[11px] text-[#aeaeb2] mt-1">≈ ${(sharesNum * current_price).toFixed(2)} total</p>
            </div>
          )}

          {/* Summary */}
          <div className="mt-4 space-y-2 bg-[#f9f9f9] rounded-xl p-4">
            {[
              ["Total Cost",         `$${effectiveAmount.toFixed(2)}`],
              ["Available Balance",  `$${available_balance.toFixed(2)}`],
              ["Balance After Buy",  `$${Math.max(0, afterBalance).toFixed(2)}`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-[13px]">
                <span className="text-[#6e6e73]">{label}</span>
                <span className="font-semibold text-[#1d1d1f]">{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-[13px] pt-2 border-t border-[#e5e5ea]">
              <span className="text-[#6e6e73]">Profile</span>
              <span className="font-semibold text-[#0071e3]">{profile_name}</span>
            </div>
          </div>

          {error && <p className="text-[12px] text-red-500 mt-3">{error}</p>}
          {afterBalance < 0 && (
            <p className="text-[12px] text-red-500 mt-2">Amount exceeds available balance</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button onClick={handleBuy} disabled={!isValid || buying}
            className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#0071e3" }}>
            {buying ? "Buying…" : `Buy ${symbol} · $${effectiveAmount.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
