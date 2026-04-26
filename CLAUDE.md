# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev          # watch mode (ts hot-reload via @nestjs/cli)
npm run build              # compile to dist/
npm run start              # run compiled dist/main.js

# Database
npx prisma migrate dev --name <name>   # create + apply migration
npx prisma migrate deploy              # apply migrations (production / Docker)
npx prisma generate                    # regenerate Prisma client after schema changes

# Tests
npm test -- --run                      # run all tests once (no watch)
npm test -- --run clients.service      # run tests in files matching pattern
npm test -- --run -t "findAll"         # run tests matching description
npm run test:cov                       # coverage report

# Code quality
npm run lint                           # ESLint --fix
npm run format                         # Prettier
```

## Architecture

### Entry point

`src/main.ts` uses `NestFactory.createApplicationContext` — **no HTTP server**. The app is a pure Telegram bot process.

### Module graph

```
AppModule
├── ConfigModule (global)       — .env via ConfigService
├── ScheduleModule              — enables @Cron decorators
├── PrismaModule (global)       — PrismaService available everywhere without re-importing
├── ClientsModule               — exports ClientsService
├── SubscriptionsModule         — exports SubscriptionsService
├── BotModule
│   ├── TelegrafModule          — bot token + session() middleware
│   ├── ClientsModule
│   ├── SubscriptionsModule
│   └── providers: BotUpdate, AdminGuard, 3 scenes
└── NotificationsModule
    └── SubscriptionsModule
```

### Bot routing

`BotUpdate` (`src/bot/bot.update.ts`) handles all `@Command` and `@Action` decorators. Callback data follows a convention:
- `clients:list`, `clients:detail:{id}`, `clients:edit:{id}`, `clients:delete:{id}`, `clients:delete:confirm:{id}`
- `subs:list:{clientId}`, `subs:add:{clientId}`, `subs:add:(1m|3m|6m|1y):{clientId}`, `subs:add:custom:{clientId}`
- `subs:extend:{subId}:{clientId}`, `subs:extend:(1m|3m|6m|1y):{subId}:{clientId}`, `subs:extend:custom:{subId}:{clientId}`
- `subs:detail:{subId}:{clientId}`, `subs:delete:{subId}:{clientId}`, `subs:delete:confirm:{subId}:{clientId}`

Multi-step input (create client, edit client, custom subscription date) uses Telegraf `@Wizard` scenes. Scenes are registered as NestJS providers in `BotModule` and autodiscovered by `nestjs-telegraf`. Scene state (clientId, subscriptionId, mode) is passed via `ctx.scene.enter(SCENE_NAME, state)` and read as `ctx.scene.state`.

### Subscription logic

- `create(clientId, duration)` — starts from `new Date()` (used only when no active subscription)
- `extend(id, duration)` — starts from `sub.endDate`, preserving paid time
- `onSubsAdd` in `BotUpdate` checks `getActive(clientId)` first: if active exists → shows extend keyboard; otherwise → add keyboard. `onSubsAddDuration` and `onSubsAddCustom` repeat this check as a safety fallback for stale UI.

### Notifications

`NotificationsService` injects `@InjectBot()` (direct Telegraf instance) to send proactive messages. The `@Cron('0 9 * * *')` job runs at 09:00 server time and sends to `ADMIN_TELEGRAM_ID` when subscriptions expire today or tomorrow.

## Testing

**Do not use `Test.createTestingModule`** — it conflicts with `@Global()` on `PrismaModule`, leaving `this.prisma` as `undefined`. Use direct instantiation instead:

```typescript
const prismaMock = { client: { findMany: vi.fn(), ... } };
const service = new ClientsService(prismaMock as unknown as PrismaService);
```

Create `prismaMock` inside `beforeEach`, not at module level, to avoid state leakage between tests.

`vitest.setup.ts` imports `reflect-metadata` — required for NestJS decorators in the Vitest environment.

## Development workflow

1. **Plan** — use `/plan` for non-trivial tasks; save the plan to `docs/plans/<feature>.md`
2. **Implement** — follow the plan; `npx nest build` must pass
3. **Test** — write tests in the same task; `npm test -- --run` must be green
4. **Document** — update the feature table in `docs/README.md`

## Environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `ADMIN_TELEGRAM_ID` | Only Telegram user ID allowed to interact with the bot |
| `DATABASE_URL` | SQLite path, e.g. `file:./data/buhta.db` |

In Docker, `DATABASE_URL` should point inside the mounted volume: `file:/app/data/buhta.db`.
