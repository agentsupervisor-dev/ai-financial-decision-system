"use client";

import { useScan, AgentStatus } from "@/lib/ScanContext";

function AgentPill({ label, sub, status }: { label: string; sub: string; status: AgentStatus }) {
  const bg =
    status === "done"    ? "#34c759" :
    status === "running" ? "#0071e3" : "#e5e5ea";
  const textColor = status === "pending" ? "#aeaeb2" : "white";
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg px-3 py-1.5 min-w-[60px]"
      style={{
        background: bg,
        animation: status === "running" ? "agent-pulse 1.4s ease-in-out infinite" : undefined,
        transition: "background 0.3s ease",
      }}
    >
      <span className="text-[11px] font-semibold leading-tight" style={{ color: textColor }}>
        {label}{status === "done" ? " ✓" : ""}
      </span>
      <span className="text-[9px] leading-tight" style={{ color: status === "pending" ? "#aeaeb2" : "rgba(255,255,255,0.7)" }}>
        {sub}
      </span>
    </div>
  );
}

export default function ScanStatusBar() {
  const { scans, agentStatuses } = useScan();
  const runningScan = Object.values(scans).find((s) => s.status === "running");
  if (!runningScan) return null;

  const s = agentStatuses[runningScan.profileId] ?? {
    forensic: "pending", macro: "pending", asymmetry: "pending", decision: "pending",
  };

  return (
    <>
      <style>{`
        @keyframes agent-pulse {
          0%, 100% { opacity: 0.65; }
          50%       { opacity: 1; }
        }
      `}</style>
      <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>
        <div className="flex items-center gap-3 bg-white border border-black/[0.08] rounded-2xl shadow-xl px-4 py-3">
          {/* Profile + ticker */}
          <div className="flex flex-col mr-1">
            <span className="text-[11px] font-semibold text-[#1d1d1f] leading-tight whitespace-nowrap">
              {runningScan.profileName}
            </span>
            {s.ticker && (
              <span className="text-[10px] text-[#6e6e73] leading-tight">{s.ticker}</span>
            )}
          </div>

          {/* Parallel agents */}
          <div className="flex items-center gap-1.5">
            <AgentPill label="Forensic"  sub="Claude"   status={s.forensic} />
            <AgentPill label="Macro"     sub="Gemini"   status={s.macro} />
            <AgentPill label="Asymmetry" sub="DeepSeek" status={s.asymmetry} />
          </div>

          {/* Arrow */}
          <span className="text-[#aeaeb2] text-[13px]">→</span>

          {/* Decision */}
          <AgentPill label="Decision" sub="Claude" status={s.decision} />
        </div>
      </div>
    </>
  );
}
