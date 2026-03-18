# AI Financial Decision System

A multi-agent AI pipeline that analyzes stocks and outputs binary BUY / HOLD / REJECT signals. Three specialist LLMs triangulate independently before a fourth makes the final call.

---

## Architecture

```
User (Next.js UI)
       │
       ▼
/api/orchestrate  ──────►  FastAPI Orchestrator (Python)
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼               ▼
              Forensic Agent   Macro Agent   Asymmetry Agent
              (Claude 3.5      (Gemini 2.0   (DeepSeek Chat
               via Bedrock)     Flash via     via OpenRouter)
                                Vertex AI)
                     └──────────────┼──────────────┘
                                    ▼
                            Decision Agent
                            (Claude 3.5 via Bedrock)
                                    │
                                    ▼
                               Supabase DB
```

### Agents

| Agent | Model | Provider | Role |
|-------|-------|----------|------|
| Forensic | Claude 3.5 Sonnet | AWS Bedrock | Company moat, margin trends, transcript analysis |
| Macro | Gemini 2.0 Flash | Google Vertex AI | Interest rates, sector tailwinds, Fed policy |
| Asymmetry | DeepSeek Chat | OpenRouter | Mispricing, hidden catalysts, risk/reward ratio |
| Decision | Claude 3.5 Sonnet | AWS Bedrock | Composite scoring, hurdle math, final verdict |

### Decision Rules (composite = Forensic 40% + Macro 30% + Asymmetry 30%)

- **BUY** — composite ≥ 65 AND confidence ≥ 50 AND expected_return ≥ hurdle_rate
- **REJECT** — composite < 45 OR expected_return < hurdle_rate
- **HOLD** — everything else

---

## Setup

### Phase 1 — Cloud Credentials

**AWS (Forensic + Decision agents)**
1. Sign up at [aws.amazon.com](https://aws.amazon.com)
2. Navigate to **Amazon Bedrock Console** → **Model catalog** → find **Claude 3.5 Sonnet v2**
   - Models are now auto-enabled on first invocation — no manual access request needed
   - First-time Anthropic users: click **Open in playground** and submit the one-time use case form if prompted
3. Go to **IAM** → create a User with `AmazonBedrockFullAccess`
4. Generate an **Access Key ID** and **Secret Access Key**

**Google Cloud (Macro agent)**
1. Sign up at [console.cloud.google.com](https://console.cloud.google.com)
2. Create project **Financial-Decision-Machine**
3. Enable the **Vertex AI API**
4. Create a **Service Account** with role `Vertex AI User`
5. Download the **JSON key file**

**OpenRouter (Asymmetry agent)**
1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Add $10 in credits
3. Copy your API key

**Financial Modeling Prep (market data)**
1. Sign up at [financialmodelingprep.com](https://financialmodelingprep.com)
2. Choose a plan that includes **Earnings Call Transcripts**
3. Copy your API key from the dashboard

### Phase 2 — Database

**Supabase**
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/migrations/001_create_decisions_table.sql`
3. Copy your **Project URL** and **service_role key** (Settings → API)

### Phase 3 — Local Development

```bash
# Clone the repo
git clone <repo-url>
cd ai-financial-decision-system

# Configure environment
cp .env.example .env
# Fill in all values in .env

# Install frontend dependencies
npm install

# Install backend dependencies
cd orchestrator
pip install -r requirements.txt
cd ..

# Start the FastAPI orchestrator (terminal 1)
cd orchestrator
uvicorn main:app --reload --port 8000

# Start the Next.js frontend (terminal 2)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Phase 4 — Deploy to Vercel

1. Push code to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Add all environment variables in Vercel project settings
4. Vercel auto-deploys on every push

Cron jobs run automatically:
- **9:00 AM** daily — `/api/ingest` loads 20 tickers into Supabase as PENDING
- **9:30 AM** daily — `/api/analyze` processes PENDING tickers via Bedrock

---

## Environment Variables

See `.env.example` for the full list with descriptions.

| Variable | Required For |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Forensic + Decision agents |
| `AWS_SECRET_ACCESS_KEY` | Forensic + Decision agents |
| `AWS_REGION` | Forensic + Decision agents (default: us-east-1) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Macro agent |
| `GOOGLE_CLOUD_PROJECT` | Macro agent |
| `GOOGLE_CLOUD_LOCATION` | Macro agent (default: us-central1) |
| `OPENROUTER_API_KEY` | Asymmetry agent |
| `FMP_API_KEY` | Forensic agent (market data) |
| `SUPABASE_URL` | Decision persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | Decision persistence |
| `ORCHESTRATOR_URL` | Next.js → FastAPI proxy |

---

## Tracked Tickers

20 large-cap US equities: AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, BRK-B, JPM, V, LLY, AVGO, NFLX, COST, WMT, XOM, MA, JNJ, HD, PG

---

## Cost Estimate

~$0.03 per ticker analysis. See breakdown:

| Agent | Model | Cost/Run |
|-------|-------|----------|
| Forensic | Claude 3.5 Sonnet (Bedrock) | ~$0.022 |
| Macro | Gemini 2.0 Flash (Vertex AI) | ~$0.0003 |
| Asymmetry | DeepSeek Chat (OpenRouter) | ~$0.0003 |
| Decision | Claude 3.5 Sonnet (Bedrock) | ~$0.007 |
| **Total** | | **~$0.03** |
