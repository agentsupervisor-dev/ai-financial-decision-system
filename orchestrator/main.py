from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from graph import graph

app = FastAPI()

@app.get("/analyze/{ticker}")
def analyze_stock(ticker: str):

    state = {
        "ticker": ticker,
        "hurdle_rate": 0.12,
        "forensic_report": None,
        "macro_report": None,
        "asymmetry_report": None,
        "final_decision": None
    }

    result = graph.invoke(state)

    return result