# Finance Decision Machine

A multi-agent AI system that scans a stock watchlist against a personalised investment profile and outputs **BUY / HOLD / REJECT** signals. Three specialist LLMs analyse independently; a rule-based engine makes the final call.

Live app → **https://ai-financial-decision-system.vercel.app**

---

## Architecture

```
Browser (React / Next.js)
        │
        ▼
/api/scan  (Next.js API route — Vercel)
        │
        │  For each ticker:
        ├─────────────────────────────────────────────┐
        │                                             │
        ▼  parallel                                   │
┌───────────────┐  ┌──────────────┐  ┌─────────────┐ │
│ Forensic      │  │ Macro        │  │ Asymmetry   │ │
│ Agent         │  │ Agent        │  │ Agent       │ │
│               │  │              │  │             │ │
│ Claude        │  │ Gemini 2.5   │  │ DeepSeek    │ │
│ Haiku 4.5     │  │ Flash        │  │ Chat        │ │
│ (Bedrock)     │  │ (Vertex AI)  │  │ (OpenRouter)│ │
│               │  │              │  │             │ │
│ Score 0-100   │  │ Score 0-100  │  │ Score 0-100 │ │
│               │  │              │  │ + expected  │ │
│               │  │              │  │   return %  │ │
└───────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
        └─────────────────┴──────────────────┘        │
                          │ sequential                 │
                          ▼                            │
                  ┌───────────────┐                    │
                  │ Decision      │                    │
                  │ Agent         │                    │
                  │               │                    │
                  │ Rule-based    │                    │
                  │ composite +   │                    │
                  │ Claude writes │                    │
                  │ rationale     │                    │
                  └───────┬───────┘                    │
                          │                            │
                          └────────────────────────────┘
                          ▼
                    Result per ticker
```

---

## Agents

| Agent | Model | Provider | Role |
|---|---|---|---|
| Forensic | Claude Haiku 4.5 | AWS Bedrock | Business moat, margin trends, earnings transcript analysis |
| Macro | Gemini 2.5 Flash | Google Vertex AI | Interest rates, sector tailwinds, Fed policy, geopolitical risks |
| Asymmetry | DeepSeek Chat | OpenRouter | Mispricing signals, hidden catalysts, risk/reward ratio, expected return |
| Decision | Claude Haiku 4.5 | AWS Bedrock | Rule-based BUY/HOLD/REJECT + 2-3 sentence rationale |

---

## Decision Logic

```
Composite = Forensic × 40% + Macro × 30% + Asymmetry × 30%
Confidence = 100 − (max score − min score)   ← penalises agent disagreement

Horizon-adjusted thresholds:
  1 yr  → composite ≥ 65
  3 yrs → composite ≥ 55
  5 yrs → composite ≥ 48

BUY    — composite ≥ threshold AND confidence ≥ 50 AND expected_return ≥ hurdle_rate
REJECT — composite < 45 OR expected_return < hurdle_rate
HOLD   — everything else
```

---

## Investment Profile → Hurdle Rate

Each user creates one or more investment profiles. The hurdle rate is the minimum expected return required to consider a BUY:

```
Hurdle Rate = Inflation + Borrowing Cost + Index Return + OpEx + Alpha Target
```

---

## Setup

### 1 — Cloud Credentials

**AWS (Forensic + Decision agents)**
1. Sign up at [aws.amazon.com](https://aws.amazon.com)
2. Go to **IAM** → create a user with `AmazonBedrockFullAccess`
3. Generate an **Access Key ID** and **Secret Access Key**
4. Models are auto-enabled on first invocation — no manual access request needed

**Google Cloud (Macro agent)**
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Vertex AI API**
3. Create a **Service Account** with roles: `Vertex AI User`, `Vertex AI Administrator`
4. Download the **JSON key file** → paste its full contents as the `GOOGLE_APPLICATION_CREDENTIALS` env var

**OpenRouter (Asymmetry agent)**
1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Add credits and copy your API key

**Financial Modeling Prep (market data)**
1. Sign up at [financialmodelingprep.com](https://financialmodelingprep.com)
2. Choose a plan that includes **Earnings Call Transcripts**
3. Copy your API key

**Supabase (auth + database)**
1. Create a project at [supabase.com](https://supabase.com)
2. Run all migrations in `supabase/migrations/` via the SQL Editor
3. Copy your **Project URL**, **anon key**, and **service_role key**

---

### 2 — Local Development

```bash
git clone <repo-url>
cd financial-decision-machine

# Install frontend dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in all values in .env

# Start the Next.js app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The Python orchestrator in `orchestrator/` is for local development only and is no longer used in production. To run it locally:

```bash
cd orchestrator
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

### 3 — Deploy to Vercel

1. Push code to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Add all environment variables (see table below)
4. Vercel auto-deploys on every push to `main`

---

## Environment Variables

| Variable | Required For |
|---|---|
| `AWS_ACCESS_KEY_ID` | Claude agents (Bedrock) |
| `AWS_SECRET_ACCESS_KEY` | Claude agents (Bedrock) |
| `AWS_REGION` | Bedrock region (default: `us-east-1`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Gemini agent (Vertex AI) — paste full JSON content |
| `GOOGLE_CLOUD_PROJECT` | Vertex AI project ID |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI region (default: `us-central1`) |
| `GEMINI_API_KEY` | Gemini fallback if Vertex AI fails (Google AI Studio) |
| `OPENROUTER_API_KEY` | DeepSeek agent (OpenRouter) |
| `FMP_API_KEY` | Company data + earnings transcripts |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase (browser + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server-side admin access |
| `NEXT_PUBLIC_SUPERUSER_EMAIL` | Show admin nav in UI (comma-separated) |
| `SUPERUSER_EMAIL` | Guard admin API routes (comma-separated) |

---

## Database Migrations

Run in order via Supabase SQL Editor:

| Migration | Description |
|---|---|
| `001_create_decisions_table.sql` | Legacy decisions table |
| `002_create_profiles_table.sql` | Investment profiles |
| `003_profiles_multi.sql` | Multi-profile support per user |
| `004_profiles_delete_policy.sql` | RLS delete policy |
| `005_profiles_unique_name.sql` | Unique profile names per user |
| `006_agent_prompts.sql` | Admin-editable agent instructions |
| `007_admin_tickers.sql` | Admin-managed ticker watchlist |
| `008_scan_logs.sql` | Per-scan audit log (pending) |

---

## Key Files

```
lib/agents.ts          All 4 AI agents + FMP data fetch + scan orchestration
lib/bedrock.ts         AWS Bedrock client (Claude Haiku 4.5)
lib/gcp.ts             Google Cloud service account → OAuth2 token
lib/ScanContext.tsx    React state — profiles, scan lifecycle, toasts
app/api/scan/route.ts  Main scan endpoint
app/page.tsx           Dashboard UI
app/admin/prompts/     Admin panel — tickers, prompts, LLM health check
```

---

## Cost Estimate

Per ticker analysis (approximate):

| Agent | Model | Cost |
|---|---|---|
| Forensic | Claude Haiku 4.5 (Bedrock) | ~$0.002 |
| Macro | Gemini 2.5 Flash (Vertex AI) | ~$0.001 |
| Asymmetry | DeepSeek Chat (OpenRouter) | ~$0.0003 |
| Decision | Claude Haiku 4.5 (Bedrock) | ~$0.001 |
| **Total** | | **~$0.004 per ticker** |

---

## Verifying LLM Connections

Log in as a superuser → `/admin` → **System** tab → **Test Connections**.

All three LLMs should show ✓ green. If any fail, check the relevant API key in Vercel environment variables.
