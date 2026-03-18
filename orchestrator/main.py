from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from graph import graph

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


@app.get("/analyze/{ticker}")
def analyze_stock(
    ticker: str,
    inflation:    float = Query(default=3.5),
    borrowing:    float = Query(default=7.5),
    index_return: float = Query(default=12.0),
    tax_drag:     float = Query(default=10.0),
    opex:         float = Query(default=0.5),
    alpha_target: float = Query(default=6.5),
):
    hurdle_components = {
        "inflation":    inflation,
        "borrowing":    borrowing,
        "index_return": index_return,
        "tax_drag":     tax_drag,
        "opex":         opex,
        "alpha_target": alpha_target,
    }

    state = {
        "ticker":            ticker.upper(),
        "hurdle_components": hurdle_components,
        "hurdle_rate":       round(sum(hurdle_components.values()), 2),
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

    result = graph.invoke(state)

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
