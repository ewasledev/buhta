# Деплой и первый запуск

## Содержание

1. [Подготовка: бот и токены](#1-подготовка-бот-и-токены)
2. [Требования к серверу](#2-требования-к-серверу)
3. [Первый запуск на сервере](#3-первый-запуск-на-сервере)
4. [Автодеплой через GitHub Actions](#4-автодеплой-через-github-actions)
5. [Управление сервисом](#5-управление-сервисом)
6. [Диагностика проблем](#6-диагностика-проблем)

---

## 1. Подготовка: бот и токены

### Создать бота в Telegram

1. Открой [@BotFather](https://t.me/BotFather) в Telegram
2. Отправь `/newbot`
3. Придумай имя бота (например, `Buhta Manager`)
4. Придумай username (должен оканчиваться на `bot`, например `buhta_manager_bot`)
5. BotFather выдаст токен вида `123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` — это `TELEGRAM_BOT_TOKEN`

### Узнать свой Telegram ID

Открой [@userinfobot](https://t.me/userinfobot) и отправь любое сообщение. Бот ответит твоим числовым ID — это `ADMIN_TELEGRAM_ID`.

> Бот реагирует **только** на сообщения от этого ID. Все остальные запросы игнорируются молча.

---

## 2. Требования к серверу

- Linux (Ubuntu 22.04 / Debian 12 или новее)
- Docker Engine 24+ и Docker Compose v2 (`docker compose` без дефиса)
- Git
- Минимум 512 МБ RAM, 1 ГБ свободного места

### Установка Docker (если не установлен)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Переподключись к серверу, чтобы применились права группы
```

---

## 3. Первый запуск на сервере

### Шаг 1. Клонировать репозиторий

```bash
git clone <repo-url> /opt/buhta
cd /opt/buhta
```

### Шаг 2. Создать файл окружения

```bash
cp .env.example .env
nano .env
```

Заполни три значения:

```env
TELEGRAM_BOT_TOKEN=123456789:ABC-DEF...   # токен от BotFather
ADMIN_TELEGRAM_ID=123456789               # твой числовой Telegram ID
DATABASE_URL=file:/app/data/buhta.db      # путь внутри контейнера — не менять
```

> `DATABASE_URL` должен быть именно `file:/app/data/buhta.db` — это путь внутри Docker-контейнера, где смонтирован volume с хоста (`./data/`).

### Шаг 3. Запустить

```bash
docker compose up --build -d
```

Первый запуск занимает 1–3 минуты (сборка образа + установка зависимостей).

При старте контейнер автоматически применяет миграции базы данных (`prisma migrate deploy`).

### Шаг 4. Проверить

```bash
# Статус контейнера (должен быть Up)
docker compose ps

# Хвост логов (бот должен подключиться к Telegram без ошибок)
docker compose logs --tail=50 bot
```

Признак успешного старта в логах:
```
[Nest] LOG [NestApplication] Nest application successfully started
```

### Шаг 5. Проверить работу бота

Открой бота в Telegram, отправь `/start` — должно появиться главное меню с кнопкой «Клиенты».

---

## 4. Автодеплой через GitHub Actions

После первого ручного запуска можно настроить автоматический деплой при каждом `git push` в ветку `main`.

### Шаг 1. Создать SSH-ключ для деплоя

**На сервере:**

```bash
ssh-keygen -t ed25519 -C "deploy@buhta" -f ~/.ssh/buhta_deploy -N ""

# Разрешить этому ключу подключаться к серверу
cat ~/.ssh/buhta_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Вывести приватный ключ (скопируй его целиком, включая -----BEGIN и -----END строки)
cat ~/.ssh/buhta_deploy
```

### Шаг 2. Добавить секреты в GitHub

Перейди в репозиторий → **Settings → Secrets and variables → Actions → New repository secret**:

| Секрет | Значение |
|---|---|
| `SSH_HOST` | IP-адрес или домен сервера |
| `SSH_USER` | Пользователь на сервере (например, `ubuntu` или `root`) |
| `SSH_PRIVATE_KEY` | Содержимое приватного ключа `~/.ssh/buhta_deploy` |
| `PROJECT_PATH` | Путь к проекту на сервере (например, `/opt/buhta`) |

### Шаг 3. Проверить

Сделай любой коммит и запушь в `main`:

```bash
git push origin main
```

Перейди в **GitHub → Actions** — появится workflow `Deploy`. После его завершения бот обновится на сервере.

### Как работает автодеплой

При каждом пуше в `main` GitHub Actions:
1. Подключается к серверу по SSH
2. Запускает `scripts/deploy.sh`, который:
   - `git pull origin main`
   - `docker compose up --build -d`
   - `docker image prune -f` (удаляет устаревшие образы)

---

## 5. Управление сервисом

```bash
# Логи в реальном времени
docker compose logs -f --tail=100 bot

# Статус
docker compose ps

# Перезапуск без пересборки
docker compose restart bot

# Остановить
docker compose down

# Ручное обновление (без GitHub Actions)
bash scripts/deploy.sh
```

### Где хранятся данные

SQLite-база находится на хосте в `./data/buhta.db` и монтируется в контейнер. При пересборке или перезапуске контейнера данные **не теряются**.

Резервная копия:
```bash
cp /opt/buhta/data/buhta.db /opt/buhta/data/buhta.db.backup
```

---

## 6. Диагностика проблем

### Бот не отвечает на команды

```bash
docker compose logs --tail=100 bot
```

Частые причины:
- Неверный `TELEGRAM_BOT_TOKEN` — проверь `.env`, убедись что токен скопирован целиком
- Другой процесс уже использует этот токен — Telegram не позволяет двум процессам держать один бот
- Контейнер упал — проверь `docker compose ps`, статус должен быть `Up`

### Контейнер постоянно рестартует

```bash
docker compose logs bot   # смотри ошибку при старте
```

Частые причины:
- Ошибка в `.env` (пустые значения, лишние пробелы)
- `DATABASE_URL` указывает не туда — должен быть `file:/app/data/buhta.db`

### GitHub Actions падает на шаге SSH

- Убедись, что публичный ключ добавлен в `~/.ssh/authorized_keys` на сервере
- Проверь, что `SSH_USER` имеет права на `PROJECT_PATH`
- Проверь, что на сервере установлен Docker и пользователь входит в группу `docker`

### Сброс данных (осторожно)

```bash
# Остановить и удалить volume с базой
docker compose down -v
rm -f /opt/buhta/data/buhta.db
docker compose up --build -d
```
