import os
from langchain_openai import ChatOpenAI

_openrouter_key = os.getenv("OPENROUTER_API_KEY")

# Macro CIO — Gemini via OpenRouter
gemini_model = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=_openrouter_key,
    model="google/gemini-2.0-flash-001",
    temperature=0.2,
)

# Forensic + Decision — Claude via OpenRouter
claude_model = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=_openrouter_key,
    model="anthropic/claude-3.5-sonnet",
    temperature=0.1,
)

# Asymmetry / Risk — DeepSeek via OpenRouter
deepseek_model = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=_openrouter_key,
    model="deepseek/deepseek-chat",
    temperature=0.3,
)
