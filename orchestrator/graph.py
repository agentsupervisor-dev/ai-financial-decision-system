from langgraph.graph import StateGraph, END

from models.state import AnalysisState
from agents.forensic_agent import forensic_agent
from agents.macro_agent import macro_agent
from agents.asymmetry_agent import asymmetry_agent
from agents.decision_agent import decision_agent


def hurdle_gate(state):
    c = state["hurdle_components"]
    hurdle = sum(c.values())
    return {**state, "hurdle_rate": round(hurdle, 2)}


workflow = StateGraph(AnalysisState)

workflow.add_node("hurdle_gate", hurdle_gate)
workflow.add_node("forensic", forensic_agent)
workflow.add_node("macro", macro_agent)
workflow.add_node("asymmetry", asymmetry_agent)
workflow.add_node("decision", decision_agent)

workflow.set_entry_point("hurdle_gate")
workflow.add_edge("hurdle_gate", "forensic")
workflow.add_edge("forensic", "macro")
workflow.add_edge("macro", "asymmetry")
workflow.add_edge("asymmetry", "decision")
workflow.add_edge("decision", END)

graph = workflow.compile()
