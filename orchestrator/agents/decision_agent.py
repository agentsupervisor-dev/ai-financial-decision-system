def decision_agent(state):

    forensic = (state.get("forensic_report") or "").lower()
    macro = (state.get("macro_report") or "").lower()
    asymmetry = (state.get("asymmetry_report") or "").lower()

    # Simple rule logic (can evolve later)
    if "moat decay" in forensic or "structural risk" in forensic:
        state["final_decision"] = "REJECT"
        return state

    if "upside" in asymmetry or "mispricing" in asymmetry:
        state["final_decision"] = "BUY"
        return state

    state["final_decision"] = "HOLD"

    return state