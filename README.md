# 💚 CashFlow — *Your business finances have a heartbeat.*

An AI-powered SaaS web app that helps small-business owners forecast cash flow. Enter your business data through a guided setup (or load demo data), and the app projects your cash balance 90 days forward, tracks your vital signs (Cash Position · Burn Rate · Revenue · Runway), flags upcoming shortfalls, and uses the **Claude API** to explain the numbers and **build statistically accurate plans** to fix them.

Built with **React + Tailwind + Recharts** (frontend), **Node/Express + SQLite** (backend), and **Claude (`claude-sonnet-4-6`)** for AI insights. Dark charcoal / electric-teal theme with a pulse-to-dollar logo.

> **Runs out of the box.** A demo restaurant business with 6 months of realistic transactions is seeded automatically, and the app works fully **even without an Anthropic API key** (it falls back to built-in template insights, and plans can be built from the Scenario Planner). Add a key to unlock the conversational planning assistant and real Claude-generated narratives.

---

## Features

- **Auth** — email/password with JWT, plus a business profile (name, type, industry).
- **Guided onboarding** — a from-scratch wizard (business profile → opening cash → recurring income/expense builder) that builds a live forecast from your own numbers. New accounts start here.
- **Data ingestion** — CSV upload, manual entry, a recurring-item builder, and a mock **"Connect QuickBooks"** button that instantly loads a realistic restaurant dataset.
- **KPI vitals** — four headline cards: **Cash Position**, **Burn Rate** (avg net monthly), **Revenue** (trailing 30 days), and **Runway** (time until low cash).
- **Cash Flow Dashboard** — a 30/60/90-day projected line chart (labeled to your business), red shortfall alerts (exact date + dollar amount), and an income-vs-expense bar chart.
- **Financial Analytics** — a dedicated page with five decision-grade charts: Revenue vs Net Income (spots "profitless growth"), a Profit-Margin Corridor (gross/operating/net %), Net Income vs Net Cash Flow, an Expense Breakout donut, and a Break-Even analysis — all derived from your transactions.
- **AI Prediction Engine** — detects recurring income/expenses, projects 90 days forward, and calls Claude for a narrative summary + 3 action recommendations.
- **Planning Assistant (chatbot)** — sits beside the recommendations; clarifies them and proposes plans. Every plan it suggests is run through the **real forecast engine** for an accurate projected impact (not an AI guess).
- **Action Plans** — save plans (from the chatbot or the Scenario Planner) to a dedicated dashboard section; **Apply** overlays a plan's trajectory on the projection chart.
- **Alert System** — prominent red card: days until shortfall, projected deficit, and a Claude-generated explanation.
- **Weekly Digest** — an email-style report with the top 3 insights in plain English.
- **Scenario Planner** — model "hire at $X/mo" or "land a $X contract" and see the 90-day projection update in real time; save any scenario as an Action Plan.
- **Dark, professional financial dashboard** — mobile responsive.

---

## Prerequisites

- **Node.js 18+** (uses ESM and `node --watch`)
- npm

> On Windows, `better-sqlite3` is a native module — it compiles via prebuilt binaries on install. If install fails, ensure you have the [build tools](https://github.com/nodejs/node-gyp#on-windows) (`npm install --global windows-build-tools` is no longer needed on modern Node; prebuilt binaries usually cover it).

---

## Setup

```bash
# 1. Clone / open the project
cd cashflow-forecaster

# 2. Configure environment (optional — the app runs without a key)
cp .env.example .env
#   then edit .env and paste your ANTHROPIC_API_KEY if you have one

# 3. Install all dependencies (root + server + client)
npm install
```

`npm install` automatically installs the server and client workspaces too (via the root `postinstall` script).

### Environment variables (`.env` in the project root)

| Variable            | Required | Description                                                            |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | No       | Your Anthropic key. **Omit it and the app uses template insights.**    |
| `JWT_SECRET`        | No       | Secret used to sign JWTs. Defaults to a dev value — change in prod.     |
| `PORT`              | No       | API port. Defaults to `4000`.                                          |

**Getting an API key:** sign in at [console.anthropic.com](https://console.anthropic.com) → **Settings → API Keys → Create Key**, add a few dollars of credit under Billing, and paste the `sk-ant-...` value into `.env`. Each dashboard load makes a few small Claude calls (a few cents at most).

---

## Run locally

```bash
npm run dev
```

This starts both servers concurrently:

- **API** → http://localhost:4000
- **Web app** → http://localhost:5173  ← open this

The Vite dev server proxies `/api/*` to the Express backend, so there's no CORS setup to worry about.

### Demo login

A demo account is seeded automatically:

```
Email:    demo@bistro.com
Password: demo1234
```

It comes pre-loaded with 6 months of restaurant transactions, so the dashboard, shortfall alert, digest, and scenario planner are all populated immediately. (The login form is pre-filled with these credentials.)

You can also register a fresh account and click **"Connect QuickBooks (demo data)"** on the dashboard to load the same dataset.

---

## How to upload a CSV

1. Sign in, then go to **Import Data** in the sidebar.
2. Click **"Click to choose a CSV file"** and select your file.
3. Click **Upload & analyze**.

Your CSV must have a header row with these columns (case-insensitive):

| Column        | Notes                                                            |
| ------------- | --------------------------------------------------------------- |
| `date`        | `YYYY-MM-DD`, `M/D/YYYY`, or most common date formats            |
| `description` | Free text, e.g. "Sysco food order"                              |
| `amount`      | **Positive = income, negative = expense.** `$` and `,` allowed. |
| `category`    | e.g. "Payroll", "Rent". Defaults to "Uncategorized" if blank.   |

Example:

```csv
date,description,amount,category
2026-06-01,Square POS deposit,2450.00,POS Income
2026-06-01,Commercial lease - rent,-6800.00,Rent
2026-06-02,Sysco food order,-3100.00,Food Costs
2026-06-03,Catering event,2800.00,Catering Income
```

---

## Connect a live bank (Plaid Sandbox) — live predictions

You can link a (fake) bank through **Plaid** so transactions stream in and the forecast updates **live** — no refresh. It's optional and free in Sandbox.

### 1. Get free sandbox keys
1. Sign up at **[dashboard.plaid.com](https://dashboard.plaid.com)** (free).
2. Go to **Developers → Keys** and copy your **`client_id`** and **Sandbox `secret`**.
3. Put them in `.env`:
   ```
   PLAID_CLIENT_ID=your_client_id
   PLAID_SECRET=your_sandbox_secret
   PLAID_ENV=sandbox
   ```
4. Restart (`npm run dev`). The server logs `Plaid: ENABLED (sandbox)` and the **Connect a bank** button activates (on the dashboard empty-state and the **Import Data** page).

### 2. Connect
Click **🏦 Connect a bank** → in Plaid Link pick any institution (e.g. **First Platypus Bank**) and log in with the sandbox credentials:
```
username: user_good
password: pass_good
```
The app exchanges the token, imports the bank's transactions, and recomputes your forecast.

> **Sign convention:** Plaid reports money *out* as positive; the app flips this on import so income stays positive and spending negative.

### 3. See it update live
- **Locally**, click **Sync now** or **⚡ Simulate a live transaction** on the bank card — the dashboard updates instantly (a small "● Updated live" badge flashes) via Server-Sent Events.
- **Deployed** behind a public URL, set `PLAID_WEBHOOK_URL` to `https://<your-host>/api/plaid/webhook` (e.g. via an [ngrok](https://ngrok.com) tunnel) and Plaid will push new transactions automatically.

### Notes
- Access tokens are **encrypted at rest** (AES-256-GCM; set a strong `ENCRYPTION_KEY` in production).
- **Production** bank data (real accounts) requires Plaid approval and a paid tier — Sandbox is for development/demos.
- Other sources slot into the same pipeline if you want them later: **Stripe** (live revenue webhooks), or the real **QuickBooks/Xero** APIs (invoices/bills for known future cash). The ingestion → `transactions` table → `forecast.js` → live SSE path is identical.

---

## SMS alerts (Twilio)

CashFlow can text you when cash flow needs attention. Four alert types, each independently toggleable, configured under **Settings → SMS Alerts**.

### Works with zero setup (simulation mode)
With **no Twilio credentials**, SMS runs in **simulation mode**: messages are printed to the server console and the verification code is shown in the UI — so you can exercise the entire flow (verify a number, fire every alert) without a Twilio account. Look for `[SMS simulated] → +1…` lines in the server log.

### Enable real texts
1. Create a free account at **[twilio.com](https://www.twilio.com)**.
2. **Testing:** Console → **Account → Keys & tokens → Test Credentials**. Use the Test SID/Token and the magic number **+15005550006** as `TWILIO_PHONE_NUMBER` — no real SMS is sent or billed.
   **Production:** use your **live** Account SID (`AC…`), Auth Token, and a real Messaging-capable Twilio number.
3. Add to `.env` and restart:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+15005550006
   APP_URL=http://localhost:5173
   ```
   The server logs `Twilio SMS: ENABLED`. (Swap points are commented in `server/src/twilio.js`.)

### The four alerts
| Alert | Trigger | Cadence rules |
|---|---|---|
| **⚠ Shortfall** | 90-day projection dips below your threshold | Re-sends only if the deficit worsens ≥10%, min 48h cooldown |
| **Weekly Pulse** | Monday 8am **in your timezone** | Once/week; opt out independently |
| **📈 Improvement** | 30-day outlook improves ≥10% (e.g. after new income) | 24h cooldown |
| **🔴 Threshold breach** | A new/synced transaction drops your balance below the threshold | Immediate — always, even during quiet hours |

The natural-language bit of each message ("main cause", "outlook") is generated by **Claude** (with a deterministic fallback), kept short to fit ~160 chars.

### Settings
Phone verification (one-time SMS code), per-alert toggles, low-cash threshold, **quiet hours** (default 9pm–8am; alerts generated during quiet hours are queued and sent when they end — except breaches), and timezone. Each alert type has a **Send test** button.

### How it runs
- **`node-cron`** jobs (in `server/src/cron.js`): daily 9am (shortfall + improvement), hourly (weekly pulse, self-gated to Monday 8am per user timezone), and a 10-min queue flush.
- **Real-time** breach/improvement checks fire the moment a transaction is imported or synced (via the same event bus that powers live dashboard updates).
- Every send is recorded in the **`notification_log`** table (`user_id, alert_type, sent_at, projection_value_at_send`) — used for the cooldown and "worsened ≥10%" comparisons.

---

## Project structure

```
cashflow-forecaster/
├─ package.json            # root scripts (concurrently runs both apps)
├─ .env.example
├─ server/                 # Node/Express + SQLite + forecast + Claude
│  └─ src/
│     ├─ index.js          # app bootstrap + auto-seed
│     ├─ db.js             # better-sqlite3 schema (Postgres-friendly)
│     ├─ seed.js           # 6-month restaurant dataset generator
│     ├─ auth.js           # bcrypt + JWT
│     ├─ forecast.js       # pattern detection + 90-day projection
│     ├─ anthropic.js      # Claude wrapper + template fallbacks
│     └─ routes/           # auth, transactions, forecast, ai, scenarios, digest
└─ client/                 # React + Vite + Tailwind + Recharts
   └─ src/
      ├─ pages/            # Login, Register, Dashboard, Digest, ScenarioPlanner, Upload, Settings
      ├─ components/       # Layout, Sidebar, charts, cards
      └─ context/          # AuthContext (JWT in localStorage)
```

---

## How the AI is used

The app calls Claude (`claude-sonnet-4-6`) for three things, passing a compact summary of the transactions + projections as context:

1. **Cash Flow Summary** — a plain-English narrative of your situation.
2. **3 Action Recommendations** — specific, numbered, data-driven.
3. **Shortfall Explanation** — why the shortfall is happening and the top fix.

Responses are cached in-memory per user + data-hash so reloading the dashboard doesn't re-spend tokens. If `ANTHROPIC_API_KEY` is missing or a call fails, the app transparently falls back to deterministic, numbers-driven template text (look for the `AUTO` vs `CLAUDE` badges in the UI).

---

## Useful scripts

| Command              | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Run API + web app together (development)              |
| `npm run dev:server` | Run only the Express API                             |
| `npm run dev:client` | Run only the Vite dev server                         |
| `npm run seed`       | Re-seed the demo account's transactions               |
| `npm run build`      | Build the client for production                       |

---

## Moving from SQLite to Postgres

The app uses `better-sqlite3` for zero-config local dev, but the schema is written to port easily:

- IDs are app-generated strings (`nanoid`), not auto-increment — works as-is on Postgres.
- Swap `better-sqlite3` for `pg`, change `db.js` to use a connection pool, and adjust the few `db.prepare(...).get/run/all` calls to `pool.query(...)`. Column types map directly (`TEXT`→`TEXT`, `REAL`→`NUMERIC`).
- The `datetime('now')` defaults become `NOW()`.

The SQLite database file lives at `server/data/app.db` (gitignored).
