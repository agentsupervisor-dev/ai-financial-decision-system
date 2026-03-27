import re
from llm_clients import gemini_model


def macro_agent(state):
    ticker = state["ticker"]
    hurdle = state.get("hurdle_rate", 40.0)
    investment_period = state.get("investment_period", "3yr")

    period_map = {"1yr": "1 year", "3yr": "3 years", "5yr": "5+ years"}
    horizon = period_map.get(investment_period, "3 years")

    prompt = f"""You are a macro strategist and CIO. Analyze the macroeconomic environment affecting {ticker}.

Investment horizon: {horizon}

Consider:
- Current interest rate regime and trajectory over a {horizon} horizon
- Inflation dynamics and real rate impact on valuations
- Sector-specific growth drivers and headwinds
- Global demand conditions and geopolitical risks
- Fed policy and liquidity conditions

The investor requires a {hurdle}% annual return to clear their hurdle rate over {horizon}.
Given macro conditions, assess whether the backdrop supports or hinders achieving this return.

End your response with exactly this line:
MACRO_SCORE: [number 0-100, where 100 = extremely favorable macro backdrop]"""

    try:
        response = gemini_model.invoke(prompt)
        report = response.content
    except Exception as e:
        report = f"Macro analysis failed: {str(e)}\nMACRO_SCORE: 50"

    match = re.search(r"MACRO_SCORE:\s*(\d+(?:\.\d+)?)", report)
    score = float(match.group(1)) if match else 50.0

    return {
        **state,
        "macro_report": report,
        "macro_score": min(max(score, 0), 100),
    }
