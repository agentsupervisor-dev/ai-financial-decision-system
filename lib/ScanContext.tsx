"use client";

import { createContext, useContext, useRef, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface Profile {
  id: number;
  name: string;
  investment_period: string;
  inflation: number;
  borrowing: number;
  index_return: number;
  opex: number;
  alpha_target: number;
}

export interface StockResult {
  ticker: string;
  final_decision: string | null;
  composite_score: number | null;
  forensic_score: number | null;
  macro_score: number | null;
  asymmetry_score: number | null;
  confidence: number | null;
  expected_return: number | null;
  hurdle_rate: number | null;
  excess_return: number | null;
  clears_hurdle: boolean | null;
  decision_summary: string | null;
}

export interface ScanState {
  profileId: number;
  profileName: string;
  status: "running" | "completed" | "failed";
  results: StockResult[];
  total_scanned: number;
  total_passing: number;
  hurdle_rate: number;
  startedAt: number;
}

interface Toast {
  id: number;
  profileName: string;
  total_passing: number;
  total_scanned: number;
}

export type AgentStatus = "pending" | "running" | "done";

export interface AgentStatuses {
  ticker?: string;
  forensic: AgentStatus;
  macro: AgentStatus;
  asymmetry: AgentStatus;
  decision: AgentStatus;
}

const DEFAULT_AGENT_STATUSES: AgentStatuses = {
  forensic: "pending", macro: "pending", asymmetry: "pending", decision: "pending",
};

interface ScanContextValue {
  profiles: Profile[];
  userEmail: string | null;
  profilesLoaded: boolean;
  refreshProfiles: () => Promise<void>;
  scans: Record<number, ScanState>;
  agentStatuses: Record<number, AgentStatuses>;
  toasts: Toast[];
  startScan: (profileId: number, profileName: string) => void;
  dismissToast: (id: number) => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [scans, setScans] = useState<Record<number, ScanState>>({});
  const [agentStatuses, setAgentStatuses] = useState<Record<number, AgentStatuses>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshProfiles = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setProfilesLoaded(true); return; }
    setUserEmail(session.user.email ?? null);
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const json = await res.json();
      setProfiles(json.profiles ?? []);
    } catch { /* ignore */ }
    setProfilesLoaded(true);
  }, []);

  useEffect(() => { refreshProfiles(); }, [refreshProfiles]);

  // Poll agent status from backend while any scan is running
  const startPolling = useCallback((profileId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/status?profile_id=${profileId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data.forensic === "string") {
          setAgentStatuses((prev) => ({ ...prev, [profileId]: data as AgentStatuses }));
        }
      } catch { /* ignore */ }
    }, 1500);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startScan = useCallback(async (profileId: number, profileName: string) => {
    setScans((prev) => ({
      ...prev,
      [profileId]: {
        profileId, profileName, status: "running",
        results: [], total_scanned: 0, total_passing: 0, hurdle_rate: 0,
        startedAt: Date.now(),
      },
    }));
    setAgentStatuses((prev) => ({ ...prev, [profileId]: { ...DEFAULT_AGENT_STATUSES } }));
    startPolling(profileId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/scan?profile_id=${profileId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      stopPolling();
      setScans((prev) => ({
        ...prev,
        [profileId]: {
          ...prev[profileId], status: "completed",
          results: data.results, total_scanned: data.total_scanned,
          total_passing: data.total_passing, hurdle_rate: data.profile.hurdle_rate,
        },
      }));
      setAgentStatuses((prev) => ({
        ...prev,
        [profileId]: { forensic: "done", macro: "done", asymmetry: "done", decision: "done" },
      }));

      const id = ++toastId.current;
      setToasts((prev) => [...prev, { id, profileName, total_passing: data.total_passing, total_scanned: data.total_scanned }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 8000);
    } catch {
      stopPolling();
      setScans((prev) => ({
        ...prev,
        [profileId]: { ...prev[profileId], status: "failed" },
      }));
    }
  }, [startPolling, stopPolling]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ScanContext.Provider value={{ profiles, userEmail, profilesLoaded, refreshProfiles, scans, agentStatuses, toasts, startScan, dismissToast }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within ScanProvider");
  return ctx;
}
