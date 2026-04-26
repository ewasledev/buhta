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
├── SettingsModule (global)     — SettingsService: key-value store in DB (cron schedule etc.)
├── ClientsModule               — exports ClientsService
├── SubscriptionsModule         — exports SubscriptionsService
├── BotModule
│   ├── TelegrafModule          — bot token + session() middleware
│   ├── ClientsModule
│   ├── SubscriptionsModule
│   └── providers: BotUpdate, AdminGuard, 4 scenes (ClientCreate, ClientEdit, CustomDate, EditSchedule)
└── NotificationsModule
    └── SubscriptionsModule
```

### Bot routing

`BotUpdate` (`src/bot/bot.update.ts`) handles all `@Command` and `@Action` decorators. Callback data convention:
- `clients:list`, `clients:detail:{id}`, `clients:edit:{id}`, `clients:delete:{id}`, `clients:delete:confirm:{id}`, `clients:vip:{id}`, `clients:info`
- `subs:list:{clientId}`, `subs:add:{clientId}`, `subs:add:(1m|3m|6m|1y):{clientId}`, `subs:add:custom:{clientId}`
- `subs:extend:{subId}:{clientId}`, `subs:extend:(1m|3m|6m|1y):{subId}:{clientId}`, `subs:extend:custom:{subId}:{clientId}`
- `subs:detail:{subId}:{clientId}`, `subs:edit:{subId}:{clientId}`, `subs:delete:{subId}:{clientId}`, `subs:delete:confirm:{subId}:{clientId}`
- `schedule:view`, `schedule:edit`, `menu:back`

Multi-step input uses Telegraf `@Wizard` scenes. Scene state is passed via `ctx.scene.enter(SCENE_NAME, state)` and read as `ctx.scene.state`. `clientId`, `subscriptionId`, and `mode` ('add'|'extend') are the common state fields.

### Subscription logic

- `create(clientId, duration)` — starts from `new Date()` (used only when no active subscription exists)
- `extend(id, duration)` — starts from `sub.endDate`, preserving paid time. When `duration` is a `Date` instance, it is used as the new `endDate` directly (used by both "extend with custom date" and "edit date")
- `onSubsAdd` checks `getActive(clientId)` first: active → extend keyboard; no active → add keyboard. `onSubsAddDuration`/`onSubsAddCustom` repeat this check as a safety fallback for stale UI

### Notifications

`NotificationsService` injects `@InjectBot()` to send proactive messages. The cron job (named `notification-check`) fires at the stored schedule (`SettingsService.getNotificationCron()`) and sends expiry alerts to `ADMIN_TELEGRAM_ID`. VIP clients (`isVip: true`) are excluded from notifications. The cron schedule is persisted in the `Setting` DB table and restored via `onModuleInit`.

### VIP clients

`Client.isVip` (`Boolean @default(false)`) marks clients with automatic payment. VIP clients:
- Show ⭐ badge in list, info section, and detail card
- Are excluded from expiry notifications
- Toggled via `ClientsService.toggleVip(id)`

### Settings / key-value store

`SettingsService` (`src/settings/`) provides `get(key)` / `set(key, value)` backed by the `Setting` Prisma model. Currently used for `notification_cron` key. Extend for future app-level settings.

## Testing

**Do not use `Test.createTestingModule`** — it conflicts with `@Global()` on `PrismaModule`, leaving `this.prisma` as `undefined`. Use direct instantiation instead:

```typescript
const prismaMock = { client: { findMany: vi.fn(), ... } };
const service = new ClientsService(prismaMock as unknown as PrismaService);
```

Create mocks inside `beforeEach`, not at module level, to avoid state leakage.

`vitest.setup.ts` imports `reflect-metadata` — required for NestJS decorators in the Vitest environment.

## Development workflow

1. **Plan** — use `/plan` for non-trivial tasks; save the plan to `docs/plans/<feature>.md`
2. **Implement** — follow the plan; `npx nest build` must pass
3. **Test** — write tests in the same task; `npm test -- --run` must be green
4. **Document** — update `docs/README.md` feature table and `docs/functions.md`

## Environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `ADMIN_TELEGRAM_ID` | Only Telegram user ID allowed to interact with the bot |
| `DATABASE_URL` | SQLite path, e.g. `file:./data/buhta.db` |

In Docker, `DATABASE_URL` must point inside the mounted volume: `file:/app/data/buhta.db`.
