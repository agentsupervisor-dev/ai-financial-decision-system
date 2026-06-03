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
  universe_type: string;
  universe_key: string;
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


interface ScanContextValue {
  profiles: Profile[];
  userEmail: string | null;
  isSuperuser: boolean;
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
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [scans, setScans] = useState<Record<number, ScanState>>({});
  const [agentStatuses, setAgentStatuses] = useState<Record<number, AgentStatuses>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const refreshProfiles = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setProfilesLoaded(true); return; }
    const email = session.user.email ?? null;
    setUserEmail(email);
    const superuserEmails = (process.env.NEXT_PUBLIC_SUPERUSER_EMAIL ?? "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    setIsSuperuser(!!email && superuserEmails.includes(email.toLowerCase()));
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

  useEffect(() => {
    refreshProfiles();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (!session) { setProfiles([]); setProfilesLoaded(true); }
      else refreshProfiles();
    });
    return () => listener?.subscription.unsubscribe();
  }, [refreshProfiles]);

  const decisionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (decisionTimerRef.current) { clearTimeout(decisionTimerRef.current); decisionTimerRef.current = null; }
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

    // Forensic, Macro, Asymmetry run in parallel immediately
    setAgentStatuses((prev) => ({
      ...prev,
      [profileId]: { forensic: "running", macro: "running", asymmetry: "running", decision: "pending" },
    }));

    // Decision runs after the 3 parallel agents finish (~20s estimate)
    decisionTimerRef.current = setTimeout(() => {
      setAgentStatuses((prev) => {
        const cur = prev[profileId];
        if (!cur || cur.decision !== "pending") return prev;
        return { ...prev, [profileId]: { ...cur, decision: "running" } };
      });
    }, 20000);

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
  }, [stopPolling]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ScanContext.Provider value={{ profiles, userEmail, isSuperuser, profilesLoaded, refreshProfiles, scans, agentStatuses, toasts, startScan, dismissToast }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within ScanProvider");
  return ctx;
}
