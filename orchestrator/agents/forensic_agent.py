import os
from langchain_aws import ChatBedrock

llm = ChatBedrock(
    model_id="anthropic.claude-3-haiku-20240307-v1:0",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1")
)

def forensic_agent(state):

    ticker = state["ticker"]

    prompt = f"""
You are a forensic financial analyst.

Analyze the durability of the business moat for {ticker}.

Look for:
- moat decay
- margin compression
- structural risks
"""

    response = llm.invoke(prompt)

    state["forensic_report"] = response.content

    return state