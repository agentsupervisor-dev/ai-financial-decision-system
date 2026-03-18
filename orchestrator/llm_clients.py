import os
from langchain_aws import ChatBedrockConverse
from langchain_google_vertexai import ChatVertexAI
from langchain_openai import ChatOpenAI

# Forensic + Decision — Claude 3.5 Sonnet via AWS Bedrock
claude_model = ChatBedrockConverse(
    model="us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    temperature=0.1,
)

# Macro CIO — Gemini 2.0 Flash via Google Vertex AI
gemini_model = ChatVertexAI(
    model="gemini-2.5-flash",
    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
    temperature=0.2,
)

# Asymmetry / Risk — DeepSeek via OpenRouter (no native cloud option)
deepseek_model = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    model="deepseek/deepseek-chat",
    temperature=0.3,
)
