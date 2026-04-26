# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev          # watch mode (ts hot-reload via @nestjs/cli)
npm run build              # tsc -p tsconfig.build.json → dist/
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
├── SettingsModule (global)     — SettingsService: key-value store in DB (cron schedule etc.)
├── ClientsModule               — exports ClientsService
├── SubscriptionsModule         — exports SubscriptionsService
├── BotModule
│   ├── TelegrafModule          — bot token + session() middleware
│   ├── ClientsModule
│   ├── SubscriptionsModule
│   └── providers: BotUpdate, AdminGuard, 5 scenes
│       (ClientCreate, ClientEdit, ClientEditPrice, CustomDate, EditSchedule)
└── NotificationsModule
    └── SubscriptionsModule
```

### Bot routing

`BotUpdate` (`src/bot/bot.update.ts`) handles all `@Command` and `@Action` decorators. Callback data convention:
- `clients:list`, `clients:detail:{id}`, `clients:edit:{id}`, `clients:price:{id}`, `clients:delete:{id}`, `clients:delete:confirm:{id}`, `clients:vip:{id}`, `clients:info`
- `subs:list:{clientId}`, `subs:add:{clientId}`, `subs:add:(1m|3m|6m|1y):{clientId}`, `subs:add:custom:{clientId}`
- `subs:extend:{subId}:{clientId}`, `subs:extend:(1m|3m|6m|1y):{subId}:{clientId}`, `subs:extend:custom:{subId}:{clientId}`
- `subs:detail:{subId}:{clientId}`, `subs:edit:{subId}:{clientId}`, `subs:delete:{subId}:{clientId}`, `subs:delete:confirm:{subId}:{clientId}`
- `schedule:view`, `schedule:edit`, `menu:back`

Multi-step input uses Telegraf `@Wizard` scenes. Scene state is passed via `ctx.scene.enter(SCENE_NAME, state)` and read as `ctx.scene.state`.

### Subscription logic

- `create(clientId, duration)` — starts from `new Date()` (only when no active subscription)
- `extend(id, duration)` — starts from `sub.endDate`, preserving paid time. When `duration` is a `Date` instance, sets `endDate` directly (used for "edit date" and VIP auto-renewal)
- `onSubsAdd` checks `getActive(clientId)` first: active → extend keyboard; no active → add keyboard

### VIP & price

- `Client.isVip` (`Boolean @default(false)`) — excluded from expiry notifications; subscription auto-renewed daily if expired
- `Client.price` (`Int @default(0)`) — displayed in client card and summed in info section
- VIP auto-renewal: `newEndDate = oldEndDate + (oldEndDate − startDate)` — preserves exact subscription length
- `ClientsService.toggleVip(id)` — flips isVip
- `ClientsService.updatePrice(id, price)` — updates price field only

### Notifications

`NotificationsService` cron job (`notification-check`, default `0 9 * * *`):
1. `renewVipSubscriptions()` — auto-extends expired VIP subscriptions, returns list of renewed
2. Finds non-VIP subscriptions expiring today/tomorrow
3. Sends combined message to `ADMIN_TELEGRAM_ID` (🔄 + ⚠️ + 🔔 blocks)

Schedule persisted in `Setting` DB table, restored via `onModuleInit`.

### Settings / key-value store

`SettingsService` (`src/settings/`) — `get(key)` / `set(key, value)` backed by `Setting` Prisma model. Currently used for `notification_cron`.

### Build

`npm run build` runs `tsc -p tsconfig.build.json` (NOT `nest build` — NestJS CLI was unreliable in Alpine Docker). `tsconfig.build.json` sets `rootDir: "src"` and `include: ["src/**/*"]` to output `dist/main.js` (not `dist/src/main.js`).

## Testing

**Do not use `Test.createTestingModule`** — conflicts with `@Global()` on `PrismaModule`. Use direct instantiation:

```typescript
const prismaMock = { client: { findMany: vi.fn(), ... } };
const service = new ClientsService(prismaMock as unknown as PrismaService);
```

Create mocks inside `beforeEach`. `vitest.setup.ts` imports `reflect-metadata`.

## Development workflow

1. **Plan** — use `/plan` for non-trivial tasks; save the plan to `docs/plans/<feature>.md`
2. **Implement** — follow the plan; `npx nest build` must pass
3. **Test** — write tests in the same task; `npm test -- --run` must be green
4. **Document** — update `docs/README.md` and `docs/functions.md`

## Environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `ADMIN_TELEGRAM_ID` | Only Telegram user ID allowed to interact with the bot |
| `DATABASE_URL` | SQLite path, e.g. `file:./data/buhta.db` |

In Docker: `DATABASE_URL=file:/app/data/buhta.db` (absolute path inside container, mapped to `./data/` volume on host).

## Docker notes

- Alpine image requires `apk add --no-cache openssl` for Prisma
- `npm run build` uses `tsc` directly — `nest build` fails silently in Alpine (OOM)
- Server must have outbound port 443 unblocked to reach `api.telegram.org`
