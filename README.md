# PingRanger — Backend

> The engine behind PingRanger. Pings URLs on a schedule, opens and resolves incidents, fires multi-channel alerts, and streams live check results to the dashboard — all in a single NestJS service.

---

## What it does

Every minute a cron job wakes up, finds every active monitor whose interval has elapsed, and fires an HTTP GET against the target URL. If the response is `>= 400` or the request times out (10 s), an incident is opened and an alert is sent. When the URL comes back up, the incident is resolved and a recovery alert fires. Every check result is pushed to connected browser clients via **Server-Sent Events** so the dashboard updates in real time without polling.

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 (Alpine) |
| Framework | NestJS 11 |
| ORM | Prisma 7.5 |
| Database | PostgreSQL 16 |
| Auth | Clerk (JWT validation via `@clerk/backend`) |
| HTTP client | `@nestjs/axios` + Axios |
| Scheduling | `@nestjs/schedule` (node-cron) |
| Real-time | Server-Sent Events (native `EventEmitter`) |
| Validation | `class-validator` + `class-transformer` |
| Config validation | Joi |

---

## Project structure

```
src/
├── app.module.ts          # Root module — wires everything together
├── main.ts                # Bootstrap, CORS, global pipes
│
├── clerk/                 # Auth layer
│   ├── clerk.guard.ts     # Global JWT guard — validates every request
│   ├── clerk.module.ts
│   └── public.decorator.ts  # @Public() — skips auth for open endpoints
│
├── prisma/                # Database client
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── monitors/              # CRUD for monitors
│   ├── monitors.controller.ts
│   ├── monitors.service.ts
│   ├── monitors.module.ts
│   └── dto/
│       ├── create-monitor.dto.ts
│       └── update-monitor.dto.ts
│
├── incidents/             # Incident history per monitor
│   ├── incidents.controller.ts
│   ├── incidents.service.ts
│   └── incidents.module.ts
│
├── scheduler/             # The beating heart — runs checks every minute
│   ├── scheduler.service.ts
│   └── scheduler.module.ts
│
├── events/                # SSE — real-time push to browser
│   ├── events.controller.ts
│   ├── events.service.ts
│   ├── events.module.ts
│   └── sse-auth.guard.ts  # Separate guard for SSE (token in query param)
│
├── alerts/                # Alert dispatch (Strategy pattern)
│   ├── alert.factory.ts
│   ├── interfaces/
│   │   └── alert-channel.interface.ts
│   └── channels/
│       ├── telegram.channel.ts
│       ├── discord.channel.ts
│       └── slack.channel.ts
│
├── telegram-bot/          # Telegram webhook to link chat IDs
│   ├── telegram-bot.controller.ts
│   ├── telegram-bot.service.ts
│   └── telegram-bot.module.ts
│
└── public/                # Unauthenticated status page data
    ├── public.controller.ts
    ├── public.service.ts
    └── public.module.ts
```

---

## Database schema

```prisma
model Monitor {
  id            String    @id @default(cuid())
  clerkUserId   String
  name          String
  url           String
  intervalMin   Int       @default(5)
  active        Boolean   @default(true)
  lastStatus    String?
  lastLatencyMs Int?
  lastCheckedAt DateTime?
  publicSlug    String?   @unique   // shareable status page slug
  deletedAt     DateTime?           // soft delete
  createdAt     DateTime  @default(now())

  incidents   Incident[]
  alertConfig AlertConfig?
}

model Incident {
  id         String    @id @default(cuid())
  monitorId  String
  startedAt  DateTime  @default(now())
  resolvedAt DateTime?
  statusCode Int?
  errorMsg   String?
}

model AlertConfig {
  id        String @id @default(cuid())
  monitorId String @unique
  type      String   // "telegram" | "discord" | "slack"
  config    Json     // { chatId } or { webhookUrl }
}
```

Monitors use **soft delete** — calling DELETE sets `deletedAt` instead of removing the row. All queries filter `deletedAt: null`. This preserves incident history for forensics and makes accidental deletions recoverable at the DB level.

---

## API reference

All endpoints require `Authorization: Bearer <clerk-jwt>` unless marked **public**.

### Monitors

| Method | Path | Description |
|---|---|---|
| `GET` | `/monitors` | List all active monitors (includes 30-day incidents) |
| `POST` | `/monitors` | Create a monitor |
| `GET` | `/monitors/:id` | Monitor detail (includes last 5 incidents + alertConfig) |
| `PATCH` | `/monitors/:id` | Update name, URL, interval, active, alertConfig, makePublic |
| `DELETE` | `/monitors/:id` | Soft-delete a monitor |
| `POST` | `/monitors/:id/check` | Trigger an immediate check (204 No Content) |

**Create / Update body**

```json
{
  "name": "My API",
  "url": "https://api.example.com/health",
  "intervalMin": 5,
  "active": true,
  "makePublic": true,
  "alertConfig": {
    "type": "telegram",
    "chatId": "123456789"
  }
}
```

`makePublic: true` generates a random 8-character slug and enables the public status page.
`makePublic: false` revokes the slug and makes the page private again.

### Incidents

| Method | Path | Description |
|---|---|---|
| `GET` | `/incidents?monitorId=<id>&limit=20&offset=0` | Paginated incident list for a monitor |

### Events (SSE)

| Method | Path | Description |
|---|---|---|
| `GET` | `/events?token=<clerk-jwt>` | Subscribe to real-time events for the authenticated user |

The SSE endpoint accepts the token in a query parameter because browsers can't set headers on `EventSource` connections.

Events emitted:

```jsonc
{ "type": "monitor_created", "monitorId": "..." }
{ "type": "monitor_updated", "monitorId": "..." }
{ "type": "monitor_deleted", "monitorId": "..." }
{
  "type": "check_completed",
  "monitorId": "...",
  "data": { "status": "up", "latencyMs": 142, "lastCheckedAt": "..." }
}
```

### Public (no auth required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/public/:slug` | Status page data for a monitor by its public slug |

Returns monitor name, URL, last status, latency, and 30-day incident history — no sensitive fields exposed.

### Telegram bot

| Method | Path | Description |
|---|---|---|
| `POST` | `/telegram/webhook` | Receives updates from Telegram |

Send `/start` to your bot to get your chat ID, then use it when configuring alerts.

---

## How the scheduler works

```
Every minute  @Cron('* * * * *')
  │
  ├─ Query all active, non-deleted monitors where lastCheckedAt
  │   is null OR more than 60 s ago  (DB-level pre-filter)
  │
  ├─ Post-filter: skip monitors where intervalMin hasn't elapsed yet
  │   (supports 1, 5, 10, 30, 60 min intervals per monitor)
  │
  └─ checkMonitor(monitor) for each due monitor — parallel, allSettled
       │
       ├─ HTTP GET, 10 s timeout
       ├─ Update monitor: lastStatus, lastLatencyMs, lastCheckedAt
       │
       ├─ DOWN & no open incident → create incident + send alert
       ├─ UP & open incident     → resolve incident + send recovery alert
       │
       └─ Emit SSE event to all connected browser sessions for this user
```

---

## Alert channels

The alert system uses the **Strategy pattern**. `AlertFactory.create()` returns the right channel implementation based on the `type` field.

| Channel | Config field | Notes |
|---|---|---|
| Telegram | `chatId` | Requires `TELEGRAM_BOT_TOKEN`. User must `/start` the bot first to get their chat ID. |
| Discord | `webhookUrl` | Paste the webhook URL from your Discord channel settings. |
| Slack | `webhookUrl` | Paste the incoming webhook URL from your Slack app. |

To add a new channel, implement `AlertChannel` in `src/alerts/channels/` and register it in `AlertFactory`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Yes | From your Clerk dashboard (`sk_live_...`) |
| `CLERK_PUBLISHABLE_KEY` | No | Optional, for display purposes |
| `TELEGRAM_BOT_TOKEN` | Yes* | Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_URL` | No | Sets Telegram webhook on startup if provided |
| `FRONTEND_URL` | No | Allowed CORS origin |
| `PORT` | No | HTTP port (default: `3000`) |

*Required by the startup validator. If you don't use Telegram, set any placeholder string.

```bash
cp .env.example .env
# Fill in DATABASE_URL, CLERK_SECRET_KEY, TELEGRAM_BOT_TOKEN at minimum
```

---

## Local development

### Prerequisites

- Node.js 20+
- Docker + Docker Compose

### 1. Start the database

```bash
docker compose up postgres -d
```

Postgres data persists in `./postgres/` (bind mount). This folder is git-ignored.

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Run migrations and generate Prisma client

```bash
npx prisma migrate dev
npx prisma generate
```

Inspect the database visually:

```bash
npx prisma studio
# Opens at http://localhost:5555
```

### 4. Start the dev server

```bash
npm run start:dev
```

Hot-reload via `@nestjs/cli` watchman. API available at `http://localhost:3000`.

---

## Useful Prisma commands

| Command | What it does |
|---|---|
| `npx prisma migrate dev --name <name>` | Create and apply a new migration |
| `npx prisma migrate deploy` | Apply pending migrations (production) |
| `npx prisma generate` | Regenerate the client after schema changes |
| `npx prisma db push` | Sync schema without creating a migration file |
| `npx prisma studio` | Visual database browser at `localhost:5555` |

---

## Docker

The `Dockerfile` uses a **two-stage build** to keep the production image small:

1. **Builder**: installs all deps, generates Prisma client, compiles TypeScript → `/app/dist`
2. **Runner**: installs only production deps, copies compiled output and the generated client

The `entrypoint.sh` runs `prisma migrate deploy` before starting the server, so the schema is always in sync on every deploy with no manual intervention.

```bash
# Build the image
docker build -t pingranger-backend .

# Run with env file
docker run -p 3000:3000 --env-file .env pingranger-backend
```

---

## Production deployment (Dokploy)

1. Connect your GitHub repository to Dokploy and point it at the `backend/` directory and `Dockerfile`
2. Create a PostgreSQL 16 database service in Dokploy and copy the internal connection URL
3. Set all required environment variables in the Dokploy service settings
4. Deploy — `entrypoint.sh` runs migrations automatically on every start
5. No manual `prisma migrate deploy` needed after the first deployment
