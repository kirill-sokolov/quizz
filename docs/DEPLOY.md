# Деплой Wedding Quiz на VPS — пошаговый план

## Обзор

```
Push to main → GitHub Actions → SSH на VPS → git pull → docker compose up --build
```

**Домен:** `sokolov.lv` (или временный дешёвый домен на время настройки)
**Стек деплоя:** Docker Compose + Nginx + Let's Encrypt + GitHub Actions

---

## Этап 1: Подготовка production-файлов в репозитории

Всё ниже делается локально, коммитится в репо.

### 1.1 Создать `.env.example`

```bash
# === Database ===
POSTGRES_DB=wedding
POSTGRES_USER=wedding
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

DATABASE_URL=postgresql://wedding:CHANGE_ME_STRONG_PASSWORD@wedding_db:5432/wedding

# === API ===
PORT=3000
HOST=0.0.0.0
JWT_SECRET=CHANGE_ME_RANDOM_STRING_32_CHARS
MEDIA_DIR=./uploads

# === Telegram Bot ===
BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_BOT_USERNAME=YourBotName

# === LLM (OpenRouter) ===
OPENROUTER_API_KEY=sk-or-...

# === Domain (для бота — ссылки в сообщениях) ===
APP_URL=https://sokolov.lv
```

### 1.2 Создать `Dockerfile` для бота (`apps/bot/Dockerfile`)

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

CMD ["npm", "start"]
```

### 1.3 Создать `Dockerfile` для фронтенда (`apps/web/Dockerfile.prod`)

Multi-stage: собрать Vite → раздавать через nginx.

```dockerfile
# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_TELEGRAM_BOT_USERNAME
ARG VITE_API_URL
ENV VITE_TELEGRAM_BOT_USERNAME=${VITE_TELEGRAM_BOT_USERNAME}
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 1.4 Создать `apps/web/nginx.conf` (внутренний nginx для SPA)

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> Это **внутренний** nginx контейнера web. Он только раздаёт SPA с `try_files` для React Router. Проксирование API/WS делает **внешний** nginx на хосте (этап 3).

### 1.5 Обновить `apps/api/Dockerfile` для production

```dockerfile
FROM node:20-slim

# Системные зависимости для DOCX конвертации
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    imagemagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

> **Важно:** В текущем Dockerfile нет `npm install` и `npm run build` — он рассчитан на volume mount из docker-compose dev. Для прода нужен полноценный build внутри образа.

### 1.6 Создать `docker-compose.prod.yml`

```yaml
version: "3.9"

services:
  wedding_db:
    image: postgres:15
    container_name: wedding_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - wedding_postgres_data:/var/lib/postgresql/data
    # НЕ выставляем порт наружу!
    networks:
      - wedding_network

  wedding_api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: wedding_api
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DATABASE_URL: ${DATABASE_URL}
    volumes:
      - uploads_data:/app/uploads
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      - wedding_db
    networks:
      - wedding_network

  wedding_bot:
    build:
      context: ./apps/bot
      dockerfile: Dockerfile
    container_name: wedding_bot
    restart: unless-stopped
    env_file:
      - .env
    environment:
      API_URL: http://wedding_api:3000
    depends_on:
      - wedding_api
    networks:
      - wedding_network

  wedding_web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.prod
      args:
        VITE_TELEGRAM_BOT_USERNAME: ${TELEGRAM_BOT_USERNAME}
        # Пустой — фронт будет использовать relative paths (/api, /ws)
        VITE_API_URL: ""
    container_name: wedding_web
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:80"
    networks:
      - wedding_network

volumes:
  wedding_postgres_data:
  uploads_data:

networks:
  wedding_network:
    name: wedding_network
```

**Ключевые отличия от dev:**
- Нет `volumes:` с исходниками — образы самодостаточные
- Postgres порт не выставлен наружу
- API и Web слушают только на `127.0.0.1` — снаружи доступны только через nginx
- `uploads_data` — именованный volume для медиа файлов (переживает пересборку)
- Bot имеет свой Dockerfile с `npm run build`

### 1.7 Создать `nginx/wedding-quiz.conf` (для хост-nginx)

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name sokolov.lv www.sokolov.lv;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name sokolov.lv www.sokolov.lv;

    ssl_certificate     /etc/letsencrypt/live/sokolov.lv/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sokolov.lv/privkey.pem;

    client_max_body_size 50M;  # для загрузки DOCX/ZIP

    # API + WebSocket
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;  # WS keep-alive 24h
    }

    # Uploaded media (картинки вопросов, слайды)
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    # Frontend SPA (всё остальное)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 1.8 Создать `.github/workflows/deploy.yml`

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/wedding-quiz
            git pull origin main
            docker compose -f docker-compose.prod.yml build
            docker compose -f docker-compose.prod.yml up -d
            # Миграции БД (если есть новые)
            docker exec wedding_api npm run db:migrate
            echo "Deploy complete: $(date)"
```

### 1.9 Закоммитить всё и смержить в main

```bash
git add .env.example docker-compose.prod.yml nginx/ .github/ apps/bot/Dockerfile apps/web/Dockerfile.prod apps/web/nginx.conf
# НЕ коммитить .env!
echo ".env" >> .gitignore  # если ещё нет
git commit -m "Add production deployment config"
git push
```

---

## Этап 2: Подготовка VPS

### 2.1 Купить/подключить VPS

Минимальные требования:
- **2 vCPU, 4 GB RAM** (libreoffice тяжёлый при конвертации)
- **20 GB SSD**
- Ubuntu 22.04 или 24.04
- Провайдеры: Hetzner (€4-7/мес), DigitalOcean ($6/мес), Timeweb Cloud (~300₽/мес)

### 2.2 Базовая настройка сервера

```bash
# Подключиться к VPS
ssh root@YOUR_VPS_IP

# Обновить систему
apt update && apt upgrade -y

# Создать пользователя для деплоя
adduser deploy
usermod -aG sudo deploy

# Настроить SSH ключ для пользователя deploy
su - deploy
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Добавить свой публичный ключ:
echo "ssh-ed25519 AAAA..." >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 2.3 Установить Docker

```bash
# Как пользователь deploy (или root)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
# Перелогиниться чтобы группа применилась
exit
ssh deploy@YOUR_VPS_IP

# Проверить
docker --version
docker compose version
```

### 2.4 Установить Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
```

### 2.5 Установить Git

```bash
sudo apt install -y git
```

---

## Этап 3: Настройка домена и SSL

### 3.1 DNS записи

В панели регистратора (где покупал `sokolov.lv`):

| Тип | Имя | Значение | TTL |
|-----|------|----------|-----|
| A | @ | YOUR_VPS_IP | 300 |
| A | www | YOUR_VPS_IP | 300 |

> **Совет:** TTL поставь 300 (5 мин) на время настройки, потом можно увеличить до 3600.

### 3.2 Проверить что DNS работает

```bash
# С локальной машины:
dig sokolov.lv +short
# Должен вернуть IP твоего VPS
```

> DNS может распространяться от 5 минут до 48 часов. Обычно 10-30 минут.

### 3.3 Временный nginx конфиг (для получения SSL)

На VPS:

```bash
sudo tee /etc/nginx/sites-available/wedding-quiz <<'EOF'
server {
    listen 80;
    server_name sokolov.lv www.sokolov.lv;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Wedding Quiz - настройка...';
        add_header Content-Type text/plain;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/wedding-quiz /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx
```

### 3.4 Получить SSL сертификат

```bash
sudo certbot --nginx -d sokolov.lv -d www.sokolov.lv --email your@email.com --agree-tos
```

Certbot сам:
- Получит сертификат от Let's Encrypt
- Настроит автообновление (cron)
- Обновит nginx конфиг

### 3.5 Заменить nginx конфиг на production

```bash
# Скопировать конфиг из репозитория (после клонирования на шаге 4.1)
sudo cp /opt/wedding-quiz/nginx/wedding-quiz.conf /etc/nginx/sites-available/wedding-quiz
sudo nginx -t && sudo systemctl reload nginx
```

---

## Этап 4: Деплой приложения

### 4.1 Клонировать репо на VPS

```bash
ssh deploy@YOUR_VPS_IP

# Клонировать
sudo mkdir -p /opt/wedding-quiz
sudo chown deploy:deploy /opt/wedding-quiz
git clone https://github.com/YOUR_USERNAME/quizz.git /opt/wedding-quiz
cd /opt/wedding-quiz
```

### 4.2 Создать `.env` на сервере

```bash
cd /opt/wedding-quiz
cp .env.example .env
nano .env
```

Заполнить реальные значения:
- Сгенерировать пароль Postgres: `openssl rand -base64 24`
- Сгенерировать JWT secret: `openssl rand -base64 32`
- Вставить BOT_TOKEN от @BotFather
- Вставить OPENROUTER_API_KEY
- Указать TELEGRAM_BOT_USERNAME (без @)
- Обновить DATABASE_URL с тем же паролем что POSTGRES_PASSWORD

### 4.3 Первый запуск

```bash
cd /opt/wedding-quiz

# Собрать и запустить
docker compose -f docker-compose.prod.yml up -d --build

# Подождать ~1-2 минуты пока всё соберётся
# Смотреть логи:
docker compose -f docker-compose.prod.yml logs -f

# Запустить миграции БД
docker exec wedding_api npm run db:migrate

# (Опционально) Засеять демо-данные
docker exec wedding_api npm run seed
```

### 4.4 Установить production nginx конфиг

```bash
sudo cp /opt/wedding-quiz/nginx/wedding-quiz.conf /etc/nginx/sites-available/wedding-quiz
sudo nginx -t && sudo systemctl reload nginx
```

### 4.5 Проверить

- Открыть `https://sokolov.lv` — должна загрузиться админка
- Открыть `https://sokolov.lv/tv` — TV экран
- Проверить бота в Telegram — отправить `/start`

---

## Этап 5: Настройка GitHub Actions (CI/CD)

### 5.1 Создать SSH ключ для деплоя

На VPS:

```bash
# Как пользователь deploy
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy  # Скопировать приватный ключ
```

### 5.2 Добавить Secrets в GitHub

В репозитории: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Значение |
|--------|----------|
| `VPS_HOST` | IP адрес VPS (например `123.45.67.89`) |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Содержимое `~/.ssh/github_deploy` (приватный ключ целиком) |

### 5.3 Проверить деплой

```bash
# Сделать любой коммит в main
git commit --allow-empty -m "Test CI/CD deploy"
git push origin main
```

Зайти в **GitHub → Actions** — должен запуститься workflow. Через ~2-3 минуты изменения будут на сервере.

---

## Этап 6: Финальные штрихи

### 6.1 Автообновление SSL

Certbot ставит cron автоматически. Проверить:

```bash
sudo certbot renew --dry-run
```

### 6.2 Настроить файрвол

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 6.3 Настроить автозапуск Docker при перезагрузке

Docker service уже `enabled` по умолчанию. Контейнеры с `restart: unless-stopped` перезапустятся автоматически.

Проверить:

```bash
sudo reboot
# Через минуту подключиться снова
docker ps  # Все контейнеры должны быть UP
```

### 6.4 Мониторинг (опционально)

Простейший healthcheck:

```bash
# Добавить в crontab (crontab -e)
*/5 * * * * curl -sf https://sokolov.lv/api/health || echo "Wedding Quiz DOWN" | mail -s "Alert" your@email.com
```

---

## Чеклист готовности

- [ ] VPS куплен и настроен (Docker, Nginx, UFW)
- [ ] Домен привязан к VPS (DNS A-записи)
- [ ] SSL сертификат получен (certbot)
- [ ] Production файлы в репо (docker-compose.prod.yml, Dockerfiles, nginx конфиг)
- [ ] `.env` заполнен на VPS
- [ ] Приложение запущено и доступно по HTTPS
- [ ] Telegram бот работает с production сервером
- [ ] GitHub Actions секреты настроены
- [ ] Деплой по пушу в main работает
- [ ] Файрвол настроен (только 22, 80, 443)
- [ ] Контейнеры перезапускаются после reboot

---

## Troubleshooting

### Контейнер не стартует

```bash
docker compose -f docker-compose.prod.yml logs wedding_api
docker compose -f docker-compose.prod.yml logs wedding_bot
```

### 502 Bad Gateway

Nginx не может достучаться до контейнера:
```bash
# Проверить что контейнеры запущены
docker ps
# Проверить что порты слушаются
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:8080
```

### WebSocket не подключается

Проверить nginx конфиг — должен быть `proxy_http_version 1.1` и заголовки Upgrade/Connection.

### Бот не отвечает

```bash
docker logs wedding_bot
# Проверить BOT_TOKEN в .env
# Проверить что API доступен внутри сети:
docker exec wedding_bot wget -qO- http://wedding_api:3000/api/health
```

### Миграции не прошли

```bash
docker exec wedding_api npm run db:migrate 2>&1
# Проверить DATABASE_URL в .env
```

---

## Структура файлов (что добавится в репо)

```
wedding-quiz/
├── .env.example                    # ← NEW: шаблон переменных
├── .github/
│   └── workflows/
│       └── deploy.yml              # ← NEW: GitHub Actions
├── docker-compose.yml              # dev (без изменений)
├── docker-compose.prod.yml         # ← NEW: production
├── nginx/
│   └── wedding-quiz.conf           # ← NEW: nginx конфиг для хоста
├── apps/
│   ├── api/
│   │   └── Dockerfile              # ← UPDATED: production build
│   ├── bot/
│   │   └── Dockerfile              # ← NEW: production build
│   └── web/
│       ├── Dockerfile.prod         # ← NEW: multi-stage build
│       └── nginx.conf              # ← NEW: SPA fallback
```
