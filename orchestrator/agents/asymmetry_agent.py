import re
from llm_clients import deepseek_model


def asymmetry_agent(state):
    ticker = state["ticker"]
    hurdle = state.get("hurdle_rate", 40.0)

    prompt = f"""You are a hedge fund analyst specializing in asymmetric risk/reward opportunities.

Analyze {ticker} for:
1. Mispricing signals (vs. intrinsic value, sector peers, historical multiples)
2. Hidden catalysts (product launches, regulatory approvals, M&A potential, spin-offs)
3. Downside protection (balance sheet strength, cash flows, floor valuation)
4. Upside/downside asymmetry ratio

The investor's hurdle rate is {hurdle}% per year. Estimate the realistic expected annual return
if the thesis plays out over a 2-3 year horizon.

End your response with exactly these two lines:
ASYMMETRY_SCORE: [number 0-100, where 100 = extreme asymmetric upside]
EXPECTED_RETURN: [number, estimated annual % return e.g. 18.5]"""

    try:
        response = deepseek_model.invoke(prompt)
        report = response.content
    except Exception as e:
        report = f"Asymmetry analysis failed: {str(e)}\nASYMMETRY_SCORE: 50\nEXPECTED_RETURN: 10"

    score_match = re.search(r"ASYMMETRY_SCORE:\s*(\d+(?:\.\d+)?)", report)
    return_match = re.search(r"EXPECTED_RETURN:\s*(\d+(?:\.\d+)?)", report)

    score = float(score_match.group(1)) if score_match else 50.0
    expected_return = float(return_match.group(1)) if return_match else 10.0

    return {
        **state,
        "asymmetry_report": report,
        "asymmetry_score": min(max(score, 0), 100),
        "expected_return": expected_return,
    }
