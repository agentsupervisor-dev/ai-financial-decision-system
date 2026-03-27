import os
import re
from llm_clients import claude_model
from supabase import create_client


def decision_agent(state):
    ticker = state["ticker"]
    hurdle_rate = state.get("hurdle_rate", 40.0)

    forensic_score = state.get("forensic_score") or 50.0
    macro_score = state.get("macro_score") or 50.0
    asymmetry_score = state.get("asymmetry_score") or 50.0
    expected_return = state.get("expected_return") or 10.0

    # Composite score: Forensic 40% / Macro 30% / Asymmetry 30%
    composite = round(
        (forensic_score * 0.40) + (macro_score * 0.30) + (asymmetry_score * 0.30), 1
    )

    # Triangulation confidence: 100 minus spread between highest and lowest score
    scores = [forensic_score, macro_score, asymmetry_score]
    spread = max(scores) - min(scores)
    confidence = round(max(0, 100 - spread), 1)

    clears_hurdle = expected_return >= hurdle_rate
    excess_return = round(expected_return - hurdle_rate, 2)

    prompt = f"""You are an investment committee chair making a final, unbiased decision.
You have NO memory of prior trades and NO awareness of current P&L.

TICKER: {ticker}

AGENT SCORES:
- Forensic (business quality): {forensic_score}/100
- Macro (economic backdrop): {macro_score}/100
- Asymmetry (risk/reward): {asymmetry_score}/100
- Composite Score: {composite}/100
- Triangulation Confidence: {confidence}%

HURDLE MATH:
- Required return: {hurdle_rate}%
- Expected return: {expected_return}%
- Excess return: {excess_return}%
- Clears hurdle: {"YES" if clears_hurdle else "NO"}

FORENSIC SUMMARY:
{(state.get("forensic_report") or "")[:800]}

MACRO SUMMARY:
{(state.get("macro_report") or "")[:600]}

ASYMMETRY SUMMARY:
{(state.get("asymmetry_report") or "")[:600]}

Decision rules:
- BUY: composite >= 65, confidence >= 50, clears hurdle = YES
- REJECT: composite < 45 OR clears hurdle = NO
- HOLD: everything else

State your decision with a 2-3 sentence rationale. Be direct and bias-free.
End with exactly this line:
DECISION: [BUY / HOLD / REJECT]"""

    try:
        response = claude_model.invoke(prompt)
        summary = response.content
    except Exception as e:
        summary = f"Decision failed: {str(e)}\nDECISION: HOLD"

    match = re.search(r"DECISION:\s*(BUY|HOLD|REJECT)", summary, re.IGNORECASE)
    final_decision = match.group(1).upper() if match else "HOLD"

    # Write to Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if supabase_url and supabase_key:
        try:
            sb = create_client(supabase_url, supabase_key)
            hurdle_components = state.get("hurdle_components", {})
            sb.table("decisions").upsert(
                {
                    "ticker": ticker,
                    "hurdle_rate": hurdle_rate,
                    "inflation": hurdle_components.get("inflation"),
                    "borrowing_cost": hurdle_components.get("borrowing"),
                    "index_return": hurdle_components.get("index_return"),
                    "opex": hurdle_components.get("opex"),
                    "alpha_target": hurdle_components.get("alpha_target"),
                    "recommendation": final_decision,
                    "composite_score": composite,
                    "forensic_score": forensic_score,
                    "macro_score": macro_score,
                    "asymmetry_score": asymmetry_score,
                    "confidence": confidence,
                    "expected_return": expected_return,
                    "clears_hurdle": clears_hurdle,
                    "excess_return": excess_return,
                    "triangulation_summary": summary[:2000],
                    "forensic_report": (state.get("forensic_report") or "")[:5000],
                    "macro_report": (state.get("macro_report") or "")[:5000],
                    "asymmetry_report": (state.get("asymmetry_report") or "")[:5000],
                },
                on_conflict="ticker",
            ).execute()
        except Exception as e:
            print(f"Supabase upsert error: {e}")

    return {
        **state,
        "composite_score": composite,
        "confidence": confidence,
        "clears_hurdle": clears_hurdle,
        "excess_return": excess_return,
        "final_decision": final_decision,
        "decision_summary": summary,
    }
