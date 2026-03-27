import os
import re
import requests
from llm_clients import claude_model
from prompt_store import get_instructions

FMP_API_KEY = os.getenv("FMP_API_KEY")

DEFAULT_INSTRUCTIONS = """You are a forensic financial analyst. Analyze {ticker} for business moat durability.

Analyze:
1. Moat durability (pricing power, switching costs, network effects)
2. Margin trends (compression or expansion)
3. Structural risks (competitive threats, regulatory, disruption)
4. Management quality signals from the transcript"""


def _fetch_fmp(path: str):
    url = f"https://financialmodelingprep.com{path}&apikey={FMP_API_KEY}"
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    return r.json()


def forensic_agent(state):
    ticker = state["ticker"]

    try:
        profile = _fetch_fmp(f"/stable/profile?symbol={ticker}")
        company = profile[0] if profile else {}
    except Exception:
        company = {}

    try:
        income = _fetch_fmp(f"/stable/income-statement?symbol={ticker}&limit=4")
        income_str = str(income[:2]) if income else "Not available"
    except Exception:
        income_str = "Not available"

    try:
        transcript = _fetch_fmp(f"/stable/earning_call_transcript?symbol={ticker}&limit=1")
        transcript_text = transcript[0].get("content", "")[:3000] if transcript else "Not available"
    except Exception:
        transcript_text = "Not available"

    custom = get_instructions("forensic")
    instructions = (custom or DEFAULT_INSTRUCTIONS).format(ticker=ticker)

    prompt = f"""{instructions}

Company: {company.get('companyName', ticker)} | Sector: {company.get('sector', 'Unknown')}
Market Cap: {company.get('marketCap', 'Unknown')} | Description: {company.get('description', '')[:500]}

Recent Income Statements:
{income_str}

Latest Earnings Call Transcript (excerpt):
{transcript_text}

End your response with exactly this line:
FORENSIC_SCORE: [number 0-100]"""

    try:
        response = claude_model.invoke(prompt)
        report = response.content
    except Exception as e:
        report = f"Forensic analysis failed: {str(e)}\nFORENSIC_SCORE: 50"

    match = re.search(r"FORENSIC_SCORE:\s*(\d+(?:\.\d+)?)", report)
    score = float(match.group(1)) if match else 50.0

    return {
        **state,
        "forensic_report": report,
        "forensic_score": min(max(score, 0), 100),
    }
