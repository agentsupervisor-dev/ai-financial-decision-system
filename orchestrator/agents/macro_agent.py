from langchain_google_vertexai import ChatVertexAI

# Requires Google Cloud credentials configured
llm = ChatVertexAI(
    model_name="gemini-2.5-pro",
    temperature=0.2
)

def macro_agent(state):
    ticker = state["ticker"]

    prompt = f"""
You are a macro strategist.

Analyze the macroeconomic environment affecting {ticker}.

Consider:
- interest rates
- sector growth
- global economic conditions

Return a short paragraph.
"""

    try:
        response = llm.invoke(prompt)
        state["macro_report"] = response.content
    except Exception as e:
        state["macro_report"] = f"Macro analysis failed: {str(e)}"

    return state