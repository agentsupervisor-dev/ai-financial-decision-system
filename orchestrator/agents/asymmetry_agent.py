import requests
import os

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

def asymmetry_agent(state):

    ticker = state["ticker"]

    prompt = f"""
You are a hedge fund analyst searching for asymmetric opportunities.

Analyze {ticker} for:
- mispricing
- hidden catalysts
- upside potential
"""

    try:

        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek/deepseek-chat",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
        )

        data = response.json()

        state["asymmetry_report"] = data["choices"][0]["message"]["content"]

    except Exception as e:
        state["asymmetry_report"] = f"Asymmetry analysis failed: {str(e)}"

    return state