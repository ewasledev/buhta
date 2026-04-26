# Стратегия тестирования

## Стек

| Инструмент | Версия | Назначение |
|---|---|---|
| Vitest | 2.x | Test runner, assertions |
| @vitest/coverage-v8 | 2.x | Отчёт покрытия |
| @nestjs/testing | 10.x | Не используется в юнит-тестах — обнаружен конфликт с `@Global()` модулями; сервисы тестируются через прямое инстанцирование |

Конфиг: `vitest.config.ts` + `vitest.setup.ts` (подключает `reflect-metadata` для декораторов NestJS).

## Подход к мокированию

Все тесты — **юнитные**. Реальная БД и Telegram API не задействованы.

| Зависимость | Способ мока |
|---|---|
| `PrismaService` | Объект с `vi.fn()` на каждый метод (`client.*`, `subscription.*`), создаётся fresh в `beforeEach` |
| `Telegraf` bot | `{ telegram: { sendMessage: vi.fn() } }` — прямая передача в конструктор |
| `ConfigService` | `{ getOrThrow: vi.fn().mockReturnValue('...') }` |
| `TelegrafExecutionContext` | `vi.mock('nestjs-telegraf', ...)` — замена модуля целиком |

**Прямое инстанцирование** (`new Service(mock as any)`) используется вместо DI для всех сервисов. Это надёжнее при наличии `@Global()` провайдеров и не требует полного модульного контекста NestJS.

## Тест-файлы

| Файл | Тестов | Покрывает |
|---|---|---|
| `src/common/utils/date.utils.spec.ts` | 12 | `formatDate`, `parseDate`, `isDateInFuture`, `isActive`, `statusLabel` |
| `src/clients/clients.service.spec.ts` | 9 | `findAll`, `findOne`, `create`, `update`, `remove` + исключения |
| `src/subscriptions/subscriptions.service.spec.ts` | 9 | `resolveEndDate` (5 вариантов), `findExpiringOn`, `create`, `extend`, `remove` |
| `src/notifications/notifications.service.spec.ts` | 5 | `checkExpiringSubscriptions`: пустые списки, только сегодня, только завтра, оба, ошибка отправки |
| `src/bot/guards/admin.guard.spec.ts` | 4 | `canActivate`: совпадение, несовпадение, `from` undefined, парсинг строки→число |

**Итого: 39 тестов, 5 файлов.**

## Запуск

```bash
npm test              # watch-режим (разработка)
npm test -- --run     # однократный прогон
npm run test:cov      # с HTML-отчётом покрытия (./coverage/)
```

## Что не покрыто тестами

- `BotUpdate` — обработчики команд и callback-кнопок. Требует mock Telegraf-контекста с `editMessageText`, `reply`, `scene.enter`. Добавить при необходимости интеграционного тестирования.
- `PrismaService` — wrapper над Prisma Client, тестируется Prisma напрямую в интеграционных тестах.
- Wizard-сцены (`ClientCreateScene`, `ClientEditScene`, `CustomDateScene`) — сложная многошаговая логика с `ctx.wizard`. Кандидат на e2e-тесты с реальным ботом в тестовой среде.
