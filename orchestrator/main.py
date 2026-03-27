from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

import os, json, tempfile, concurrent.futures

# If GOOGLE_APPLICATION_CREDENTIALS contains JSON content (not a file path),
# write it to a temp file so the Google SDK can read it.
_gac = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
if _gac.strip().startswith("{"):
    _tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    _tmp.write(_gac)
    _tmp.close()
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _tmp.name

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from agents.forensic_agent import forensic_agent
from agents.macro_agent import macro_agent
from agents.asymmetry_agent import asymmetry_agent
from agents.decision_agent import decision_agent

app = FastAPI(title="Financial Decision Machine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://ai-financial-decision-system.vercel.app",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# In-memory scan status: profile_id -> agent status dict
scan_status: dict = {}


def _run_agent(agent_fn, state, profile_id: str, agent_name: str):
    """Run an agent and mark it done in scan_status on completion."""
    result = agent_fn(state)
    if profile_id in scan_status:
        scan_status[profile_id][agent_name] = "done"
    return result


@app.get("/status/{profile_id}")
def get_scan_status(profile_id: str):
    return scan_status.get(profile_id, {})


@app.get("/analyze/{ticker}")
def analyze_stock(
    ticker: str,
    inflation:         float = Query(default=3.5),
    borrowing:         float = Query(default=7.5),
    index_return:      float = Query(default=12.0),
    opex:              float = Query(default=0.5),
    alpha_target:      float = Query(default=6.5),
    investment_period: str   = Query(default="3yr"),
    profile_id:        str   = Query(default=""),
):
    pid = profile_id or ticker
    hurdle_components = {
        "inflation":    inflation,
        "borrowing":    borrowing,
        "index_return": index_return,
        "opex":         opex,
        "alpha_target": alpha_target,
    }

    state = {
        "ticker":            ticker.upper(),
        "hurdle_components": hurdle_components,
        "hurdle_rate":       round(sum(hurdle_components.values()), 2),
        "investment_period": investment_period,
        "forensic_report":   None,
        "macro_report":      None,
        "asymmetry_report":  None,
        "forensic_score":    None,
        "macro_score":       None,
        "asymmetry_score":   None,
        "composite_score":   None,
        "confidence":        None,
        "expected_return":   None,
        "clears_hurdle":     None,
        "excess_return":     None,
        "final_decision":    None,
        "decision_summary":  None,
    }

    # Mark all three agents as running
    scan_status[pid] = {
        "ticker":    ticker.upper(),
        "forensic":  "running",
        "macro":     "running",
        "asymmetry": "running",
        "decision":  "pending",
    }

    # Run Forensic, Macro, Asymmetry in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        f_future = executor.submit(_run_agent, forensic_agent,   state, pid, "forensic")
        m_future = executor.submit(_run_agent, macro_agent,      state, pid, "macro")
        a_future = executor.submit(_run_agent, asymmetry_agent,  state, pid, "asymmetry")

        f_result = f_future.result()
        m_result = m_future.result()
        a_result = a_future.result()

    # Merge parallel results into a single state
    merged = {
        **state,
        "forensic_score":   f_result.get("forensic_score"),
        "forensic_report":  f_result.get("forensic_report"),
        "macro_score":      m_result.get("macro_score"),
        "macro_report":     m_result.get("macro_report"),
        "asymmetry_score":  a_result.get("asymmetry_score"),
        "asymmetry_report": a_result.get("asymmetry_report"),
        "expected_return":  a_result.get("expected_return"),
    }

    # Run Decision sequentially after all three complete
    scan_status[pid]["decision"] = "running"
    result = decision_agent(merged)
    scan_status[pid]["decision"] = "done"

    return {
        "ticker":            result["ticker"],
        "hurdle_rate":       result["hurdle_rate"],
        "hurdle_components": result["hurdle_components"],
        "forensic_score":    result.get("forensic_score"),
        "macro_score":       result.get("macro_score"),
        "asymmetry_score":   result.get("asymmetry_score"),
        "composite_score":   result.get("composite_score"),
        "confidence":        result.get("confidence"),
        "expected_return":   result.get("expected_return"),
        "clears_hurdle":     result.get("clears_hurdle"),
        "excess_return":     result.get("excess_return"),
        "final_decision":    result.get("final_decision"),
        "decision_summary":  result.get("decision_summary"),
    }


@app.get("/health")
def health():
    return {"status": "ok"}
