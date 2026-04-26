# Требования к стеку

## Технологии

| Компонент | Решение | Версия |
|---|---|---|
| Runtime | Node.js | 20+ |
| Язык | TypeScript | 5.x |
| Framework | NestJS | 10.x |
| Telegram | nestjs-telegraf + Telegraf.js | 2.x / 4.x |
| ORM | Prisma | 5.x |
| База данных | SQLite | — |
| Тесты | Vitest | 1.x |
| Линтинг | ESLint + Prettier | 8.x / 3.x |
| Сборка | Vite (через vite-node / vitest) | 5.x |

## Обоснование выбора

### NestJS + TypeScript

Обеспечивает структурированный DI-контейнер, модульную архитектуру и удобную работу с декораторами. TypeScript гарантирует строгую типизацию на всех уровнях — от конфига до Telegram-контекста.

### nestjs-telegraf

Официальная интеграция NestJS с Telegraf.js. Позволяет описывать обработчики команд и сцены как NestJS-провайдеры с декораторами (`@Update`, `@Command`, `@Scene`, `@Wizard`), переиспользовать сервисы через DI и писать guard-и в стиле NestJS.

### Prisma + SQLite

SQLite — файловая БД без необходимости поднимать сервер. Подходит для одно-пользовательского инструмента. Prisma предоставляет type-safe клиент, автогенерацию миграций и читаемую схему. При необходимости перевод на PostgreSQL — изменение одной строки в `schema.prisma`.

### Vitest

Входит в экосистему Vite. Поддерживает ESM из коробки, быстрый запуск без прогрева, совместим с Jest API. Используется для юнит-тестов сервисов.

### ESLint + Prettier

ESLint с конфигурацией NestJS (`@typescript-eslint`) + Prettier для автоформатирования. Запускаются через `npm run lint` и `npm run format`.

## Структура проекта

```
buhta/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── config/           # Загрузка и валидация .env
│   ├── prisma/           # PrismaService (глобальный модуль)
│   ├── clients/          # Бизнес-логика клиентов
│   ├── subscriptions/    # Бизнес-логика подписок
│   └── bot/
│       ├── bot.module.ts
│       ├── bot.update.ts     # /start, /menu, /help и колбэки верхнего уровня
│       ├── scenes/
│       │   ├── client/       # Wizard-сцены создания и редактирования клиента
│       │   └── subscription/ # Wizard-сцены добавления и продления подписки
│       └── keyboards/        # Строители инлайн-клавиатур
├── prisma/
│   └── schema.prisma
├── docs/
├── test/
├── .env.example
├── .eslintrc.js
├── vitest.config.ts
├── tsconfig.json
└── nest-cli.json
```

## Схема базы данных

```prisma
model Client {
  id            Int            @id @default(autoincrement())
  name          String         @unique
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  subscriptions Subscription[]
}

model Subscription {
  id        Int      @id @default(autoincrement())
  clientId  Int
  client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  startDate DateTime
  endDate   DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Ключевые решения:**
- `name` уникален на уровне БД — защита от случайных дублей
- `onDelete: Cascade` — удаление клиента удаляет все его подписки
- `endDate` хранится явно (не вычисляется) — упрощает логику продления и ручной даты
