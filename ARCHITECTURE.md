# Finance Decision Machine — Architecture Blueprint

## Overview

A multi-agent AI system that scans a stock watchlist against a user-defined investment profile, running three specialized LLMs in parallel and producing a rule-based BUY / HOLD / REJECT decision.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Next.js 16)                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Pages (React)                         │   │
│  │                                                          │   │
│  │  /login          Supabase email auth                     │   │
│  │  /               Dashboard — profiles + scan results     │   │
│  │  /profile        Create / edit investment profiles       │   │
│  │  /admin/prompts  Superuser — customize agent prompts     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   API Routes                             │   │
│  │                                                          │   │
│  │  POST /api/scan          Run full market scan            │   │
│  │  GET  /api/scan/status   Agent progress polling stub     │   │
│  │  GET  /api/profile       List user profiles              │   │
│  │  PUT  /api/profile/[id]  Update profile                  │   │
│  │  GET  /api/admin/tickers Manage ticker watchlist         │   │
│  │  GET  /api/admin/prompts Manage agent instructions       │   │
│  │  GET  /api/test-llms     Verify all LLM connections      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               lib/agents.ts  (Scan Engine)               │   │
│  │                                                          │   │
│  │  For each ticker:                                        │   │
│  │  1. Fetch company data from FMP (profile, income,        │   │
│  │     earnings transcript)                                 │   │
│  │  2. Run 3 agents in PARALLEL ──────────────────────────┐ │   │
│  │     ├─ Forensic  → Claude Haiku 4.5 (Bedrock)          │ │   │
│  │     ├─ Macro     → Gemini 2.5 Flash (Vertex AI)        │ │   │
│  │     └─ Asymmetry → DeepSeek Chat (OpenRouter)          │ │   │
│  │  3. Run Decision agent sequentially ◄──────────────────┘ │   │
│  │     └─ Rule-based composite (40/30/30)                   │   │
│  │        + Claude writes 2-3 sentence rationale            │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────┬───────────────┬──────────────────┬───────────────────────┘
       │               │                  │
       ▼               ▼                  ▼
┌────────────┐  ┌─────────────┐  ┌──────────────────┐
│  Supabase  │  │  AWS Bedrock│  │  External APIs   │
│            │  │             │  │                  │
│ • Auth     │  │ Claude      │  │ Gemini 2.5 Flash │
│ • profiles │  │ Haiku 4.5   │  │ (Vertex AI/GCP)  │
│ • decisions│  │             │  │                  │
│ • agent_   │  │ Forensic +  │  │ DeepSeek Chat    │
│   prompts  │  │ Decision    │  │ (OpenRouter)     │
│ • admin_   │  │ agents      │  │                  │
│   tickers  │  └─────────────┘  │ FMP API          │
│ • scan_logs│                   │ (market data)    │
└────────────┘                   └──────────────────┘
```

---

## Investment Profile → Hurdle Rate

```
Hurdle Rate = Inflation + Borrowing Cost + Index Return + OpEx + Alpha Target
                 3.5%  +      7.5%      +    12.0%    + 0.5% +    6.5%
                                                              = 30.0%
```

---

## Scan Pipeline (per ticker)

```
Ticker + Profile
       │
       ▼
┌─────────────┐
│  FMP API    │  Company profile, income statements (4 quarters),
│  Data Fetch │  earnings call transcript (latest)
└──────┬──────┘
       │
       ├──────────────────────────────────────────┐
       ▼                    ▼                     ▼
┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
│  FORENSIC   │    │    MACRO     │    │   ASYMMETRY      │
│  AGENT      │    │    AGENT     │    │   AGENT          │
│             │    │              │    │                  │
│  Claude     │    │  Gemini 2.5  │    │  DeepSeek Chat   │
│  Haiku 4.5  │    │  Flash       │    │  via OpenRouter  │
│  (Bedrock)  │    │  (Vertex AI) │    │                  │
│             │    │              │    │  Outputs:        │
│  Analyzes:  │    │  Analyzes:   │    │  • Score 0-100   │
│  • Moat     │    │  • Rate env  │    │  • Expected      │
│  • Margins  │    │  • Sector    │    │    annual return  │
│  • Risks    │    │    trends    │    │    (%)           │
│  • Mgmt     │    │  • Geopolit. │    │                  │
│             │    │              │    │                  │
│  Score 0-100│    │  Score 0-100 │    │                  │
└──────┬──────┘    └──────┬───────┘    └────────┬─────────┘
       │                  │                     │
       └──────────────────┴─────────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │  DECISION AGENT  │
                │                  │
                │  Rule Engine:    │
                │  Composite =     │
                │  F×40+M×30+A×30  │
                │                  │
                │  Confidence =    │
                │  100 - spread    │
                │                  │
                │  Threshold:      │
                │  1yr → 65        │
                │  3yr → 55        │
                │  5yr → 48        │
                │                  │
                │  BUY  if score ≥ threshold      │
                │       AND confidence ≥ 50       │
                │       AND return ≥ hurdle        │
                │  HOLD if borderline             │
                │  REJECT otherwise               │
                │                  │
                │  Claude writes   │
                │  2-3 sentence    │
                │  rationale       │
                └────────┬─────────┘
                         │
                         ▼
              ┌────────────────────┐
              │   Result Object    │
              │                   │
              │  ticker            │
              │  forensic_score    │
              │  macro_score       │
              │  asymmetry_score   │
              │  composite_score   │
              │  confidence        │
              │  expected_return   │
              │  hurdle_rate       │
              │  excess_return     │
              │  clears_hurdle     │
              │  final_decision    │
              │  decision_summary  │
              └────────────────────┘
```

---

## Data Model (Supabase)

```
profiles
├── id
├── user_id          → auth.users
├── name
├── investment_period  (1yr / 3yr / 5yr)
├── inflation
├── borrowing
├── index_return
├── opex
└── alpha_target

decisions
├── ticker           (unique)
├── recommendation   (BUY / HOLD / REJECT / PENDING)
├── composite_score
├── forensic_score
├── macro_score
├── asymmetry_score
├── confidence
├── expected_return
├── hurdle_rate
├── excess_return
├── clears_hurdle
├── triangulation_summary
├── forensic_report
├── macro_report
└── asymmetry_report

agent_prompts
├── agent            (forensic / macro / asymmetry / decision)
├── instructions     (custom prompt text, overrides default)
├── updated_at
└── updated_by

admin_tickers
├── symbol
└── added_at

scan_logs            ← migration pending (008_scan_logs.sql)
├── user_email
├── profile_id
├── ticker
├── all scores + decision fields
└── scanned_at
```

---

## Auth & Access Control

```
Public          → /login only
Authenticated   → all pages + scan
Superuser       → /admin/prompts + /admin (ticker management)
                  configured via SUPERUSER_EMAIL env var (comma-separated)
```

---

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | Bedrock | Claude agent auth |
| `AWS_SECRET_ACCESS_KEY` | Bedrock | Claude agent auth |
| `GOOGLE_APPLICATION_CREDENTIALS` | Vertex AI | Gemini agent auth (full JSON content) |
| `GOOGLE_CLOUD_PROJECT` | Vertex AI | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI | Region (us-central1) |
| `OPENROUTER_API_KEY` | OpenRouter | DeepSeek agent auth |
| `GEMINI_API_KEY` | Google AI Studio | Gemini fallback if Vertex fails |
| `FMP_API_KEY` | FMP | Company + financial data |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client | DB + auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client | Public auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server | Admin DB access |
| `NEXT_PUBLIC_SUPERUSER_EMAIL` | Frontend | Show/hide admin nav |
| `SUPERUSER_EMAIL` | API routes | Guard admin endpoints |

---

## Key Files

```
app/
├── page.tsx                    Dashboard — scan runner + results
├── login/page.tsx              Auth
├── profile/                    Profile CRUD
├── admin/prompts/page.tsx      Agent prompt editor (superuser)
└── api/
    ├── scan/route.ts           Main scan endpoint
    ├── scan/status/route.ts    Polling stub
    ├── profile/route.ts        Profile list
    ├── profile/[id]/route.ts   Profile update/delete
    ├── admin/tickers/route.ts  Ticker management
    ├── admin/prompts/route.ts  Prompt management
    ├── test-llms/route.ts      LLM health check
    └── analyze/route.ts        Legacy single-ticker endpoint

lib/
├── agents.ts                   All 4 AI agents + FMP data fetch
├── bedrock.ts                  AWS Bedrock client (Claude)
└── supabaseClient.ts           Browser Supabase client

orchestrator/                   Python FastAPI (local dev only)
├── main.py                     FastAPI app + /analyze endpoint
├── agents/                     Python agent implementations
└── llm_clients.py              LangChain LLM clients
```
