# ❄️ PowderIQ — Setup Guide

Production-grade ski/snowboard powder intelligence SaaS.

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Prisma · PostgreSQL · Supabase Auth · Stripe · Resend

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18.17 | Use nvm if needed |
| npm | ≥ 9 | Comes with Node |
| PostgreSQL | ≥ 14 | Local or hosted (Supabase, Neon, Railway) |
| Git | any | |

---

## Step 1 — Install Dependencies

```bash
npm install
```

---

## Step 2 — Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every value. Details for each service below.

---

## Step 3 — Supabase Setup

1. Go to https://supabase.com → **New project**
2. Name it `powderiq`, choose a region close to your users
3. **Authentication → Settings:**
   - Set **Site URL** → `http://localhost:3000` (dev) or your production URL
   - Under **Email auth**, you can disable "Confirm email" for faster dev
4. **Project Settings → API:**
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ Never expose the `service_role` key client-side. It's only used server-side.

---

## Step 4 — Database Setup

You can use **Supabase's built-in PostgreSQL** (recommended) or any Postgres instance.

**Get your DATABASE_URL:**
- In Supabase: Project Settings → Database → Connection string → URI mode
- Replace `[YOUR-PASSWORD]` with your project password

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate
# When prompted for migration name, type: init

# Seed mountains (8 resorts pre-loaded)
npm run db:seed
```

---

## Step 5 — Stripe Setup

1. Go to https://stripe.com → Dashboard → **Test mode** (toggle on)
2. **Products → Add product:**
   - Name: `PowderIQ Pro`
   - Pricing: Recurring, $9.99/month
   - Click **Save product**
   - Copy the **Price ID** (starts with `price_`) → `STRIPE_PRO_PRICE_ID`
3. **Developers → API keys:**
   - Copy **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Copy **Secret key** → `STRIPE_SECRET_KEY`
4. **Webhooks → Add endpoint:**
   - URL: `https://your-domain.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

**For local Stripe webhook testing:**
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
# Copy the "webhook signing secret" it shows → STRIPE_WEBHOOK_SECRET
```

---

## Step 6 — (Optional) OpenWeather API

Without this, the app uses realistic **mock snow data** (deterministic per mountain).

1. Sign up at https://openweathermap.org/api
2. Subscribe to **One Call API 3.0** (has a free tier)
3. Copy your API key → `OPENWEATHER_API_KEY`

---

## Step 7 — (Optional) Resend Email

Without this, alert emails are **logged to console** instead of sent.

1. Sign up at https://resend.com
2. Add and verify your domain
3. Create an API key → `RESEND_API_KEY`
4. Set `RESEND_FROM_EMAIL` to your verified domain email

---

## Step 8 — Run Locally

```bash
npm run dev
```

Open http://localhost:3000

---

## Step 9 — Create Admin User

After signing up through the app:

```bash
npm run db:studio
```

In Prisma Studio, find your user in the `User` table and change `role` to `admin`.

**Or via SQL:**
```sql
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Deploying to Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

1. Link to your Vercel project
2. Add all environment variables in **Vercel Dashboard → Settings → Environment Variables**
3. Update `NEXT_PUBLIC_APP_URL` to your production URL
4. Update Supabase **Site URL** to your production URL
5. Update Stripe webhook URL to your production URL

**Vercel Cron (for alerts):**

Create `vercel.json` in root:
```json
{
  "crons": [
    {
      "path": "/api/cron/evaluate-alerts",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Vercel crons send a GET request with `Authorization: Bearer <CRON_SECRET>`.

---

## Deploying to Other Hosts (VPS / Docker)

```bash
npm run build
npm run start
```

**Environment:** Make sure all `.env.local` vars are set as real environment variables on your server.

**Cron setup (Linux crontab):**
```bash
# Every 6 hours, evaluate alerts
0 */6 * * * curl -X POST https://your-domain.com/api/cron/evaluate-alerts \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

---

## iOS / Mobile API Integration

**Base URL:** `https://your-domain.com` (or `http://localhost:3000` for dev)

**Authentication flow:**
1. Use the Supabase Swift SDK or call the REST auth endpoint directly
2. Sign in → get `access_token` from the session
3. Include on every authenticated request:

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Key endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Health check |
| GET | `/api/mountains` | None | List all mountains |
| GET | `/api/mountains?near=lat,lon&radius=km` | None | Mountains near location |
| GET | `/api/mountains/:id` | None | Mountain details |
| GET | `/api/mountains/:id/score` | Optional | Powder score (personalized if authed) |
| GET | `/api/mountains/:id/forecast` | None | Raw snow data |
| GET | `/api/me` | Required | Current user + profile |
| PUT | `/api/me/profile` | Required | Update rider profile |
| GET | `/api/favorites` | Required | User's favorite mountains |
| POST | `/api/favorites` | Required | `{ mountainId }` |
| DELETE | `/api/favorites` | Required | `{ mountainId }` |
| POST | `/api/compare` | Pro | `{ mountainIds: string[] }` |
| GET | `/api/alerts` | Pro | User's alerts |
| POST | `/api/alerts` | Pro | `{ mountainId, threshold }` |
| DELETE | `/api/alerts` | Pro | `{ alertId }` |
| POST | `/api/billing/checkout` | Required | Start Stripe checkout, returns `{ url }` |
| POST | `/api/privacy/export` | Required | Download data as JSON |
| POST | `/api/privacy/delete` | Required | Delete account |

**Response envelope:**
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message", "details": [...] }
```

---

## Project Structure

```
powderiq/
├── prisma/
│   ├── schema.prisma       # All DB models
│   └── seed.ts             # Mountain seeder
├── src/
│   ├── app/                # Next.js App Router pages + API routes
│   │   ├── page.tsx        # Landing page
│   │   ├── auth/           # Login / signup
│   │   ├── dashboard/      # Main user dashboard
│   │   ├── mountains/      # Browse + detail pages
│   │   ├── compare/        # Pro: side-by-side comparison
│   │   ├── alerts/         # Pro: powder alert management
│   │   ├── account/        # Billing + privacy
│   │   ├── admin/          # Admin-only pages
│   │   └── api/            # All Route Handlers
│   ├── components/
│   │   ├── ScoreBadge.tsx  # Color-coded score display
│   │   └── ForecastBreakdown.tsx  # Progress bar breakdown
│   ├── lib/
│   │   ├── prisma.ts       # DB client singleton
│   │   ├── auth.ts         # JWT verification helpers
│   │   ├── stripe.ts       # Stripe client
│   │   ├── email.ts        # Resend / stub
│   │   ├── audit.ts        # Audit log writer
│   │   ├── ratelimit.ts    # In-memory rate limiter
│   │   └── logger.ts       # Structured JSON logger
│   └── services/
│       ├── scoreEngine.ts  # 0–100 scoring algorithm
│       ├── snowProvider.ts # Mock + OpenWeather providers
│       └── scoreService.ts # Cached score orchestration
├── .env.example
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## Score Algorithm

Weighted 0–100 score with 6 components:

| Component | Default Weight | Description |
|-----------|---------------|-------------|
| 24h Snowfall | 30% | Recent fresh powder |
| 7-Day Snowfall | 15% | Accumulated snowpack |
| Base Depth | 15% | Total snow depth |
| Wind (inverse) | 20% | Lower wind = higher score |
| Temp Stability | 10% | Smaller daily range = better |
| Crowd Factor | 10% | Weekdays score higher |

**Profile adjustments:** Powder hunters get 40% weight on 24h snowfall. Beginners get more weight on crowd and temperature.

---

## Troubleshooting

**`prisma generate` fails:** Make sure `DATABASE_URL` is set correctly.

**Supabase auth 401:** Check that `SUPABASE_SERVICE_ROLE_KEY` is the full secret key, not the anon key.

**Stripe webhook 400:** Run `stripe listen` locally and copy the fresh webhook secret.

**Score always the same:** Mock provider is deterministic by design. Add `OPENWEATHER_API_KEY` for real data.
