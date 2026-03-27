"use client";

import { useScan, AgentStatus } from "@/lib/ScanContext";

function agentColor(status: AgentStatus) {
  if (status === "done")    return "#34c759";
  if (status === "running") return "#0071e3";
  return "#e5e5ea";
}


function AgentBar({
  label, sub, status,
}: { label: string; sub: string; status: AgentStatus }) {
  const isRunning = status === "running";
  return (
    <div className="flex-1 rounded-xl overflow-hidden relative h-12">
      {/* Track */}
      <div className="absolute inset-0 bg-[#e5e5ea]" />
      {/* Fill */}
      <div
        className="absolute inset-0"
        style={{
          background: agentColor(status),
          width: status === "done" ? "100%" : status === "running" ? "100%" : "0%",
          opacity: isRunning ? undefined : 1,
          transition: "background 0.4s ease",
          animation: isRunning ? "pulse-fill 1.5s ease-in-out infinite" : undefined,
        }}
      />
      {/* Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 z-10">
        <span className="text-[11px] font-semibold" style={{ color: status === "pending" ? "#3a3a3c" : "white" }}>
          {label}
          {status === "done" && " ✓"}
        </span>
        <span className="text-[10px]" style={{ color: status === "pending" ? "#aeaeb2" : "rgba(255,255,255,0.75)" }}>
          {sub}
        </span>
      </div>
    </div>
  );
}

export default function ScanStatusBar() {
  const { scans, agentStatuses } = useScan();

  const runningScan = Object.values(scans).find((s) => s.status === "running");
  if (!runningScan) return null;

  const statuses = agentStatuses[runningScan.profileId] ?? {
    forensic: "pending", macro: "pending", asymmetry: "pending", decision: "pending",
  };

  const currentTicker = statuses.ticker;

  return (
    <>
      <style>{`
        @keyframes pulse-fill {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-6 pb-4 pt-2"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}
      >
        <div className="max-w-3xl mx-auto bg-white/90 backdrop-blur-md border border-black/[0.08] rounded-2xl shadow-xl px-5 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold text-[#1d1d1f]">
              Scanning — <span style={{ color: "#0071e3" }}>{runningScan.profileName}</span>
            </p>
            {currentTicker && (
              <span className="text-[11px] text-[#6e6e73]">
                Analysing <span className="font-medium text-[#1d1d1f]">{currentTicker}</span>
              </span>
            )}
          </div>

          {/* Three parallel agent bars */}
          <div className="flex gap-2 mb-2">
            <AgentBar label="Forensic"  sub="Claude"   status={statuses.forensic} />
            <AgentBar label="Macro"     sub="Gemini"   status={statuses.macro} />
            <AgentBar label="Asymmetry" sub="DeepSeek" status={statuses.asymmetry} />
          </div>

          {/* Decision bar — full width */}
          <div className="rounded-xl overflow-hidden relative h-10">
            <div className="absolute inset-0 bg-[#e5e5ea]" />
            <div
              className="absolute inset-0"
              style={{
                background: agentColor(statuses.decision),
                transition: "background 0.4s ease",
                animation: statuses.decision === "running" ? "pulse-fill 1.5s ease-in-out infinite" : undefined,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 z-10">
              <span
                className="text-[11px] font-semibold"
                style={{ color: statuses.decision === "pending" ? "#3a3a3c" : "white" }}
              >
                Decision (Claude){statuses.decision === "done" && " ✓"}
              </span>
              {statuses.decision === "pending" && (
                <span className="text-[10px] text-[#aeaeb2]">— runs after all three complete</span>
              )}
            </div>
          </div>

          <p className="text-[10px] text-[#aeaeb2] text-center mt-2">
            You can navigate freely while scanning…
          </p>
        </div>
      </div>
    </>
  );
}
