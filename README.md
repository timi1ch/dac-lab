# Дискреционная модель доступа

Владелец создаёт ресурс и выдаёт другим пользователям права чтения, изменения
и удаления. Backend проверяет каждое действие. Страница «Демо-сценарий» проверяет
доступ владельца, получателя прав и постороннего пользователя.

## Запуск всего проекта в Docker

Из корня проекта:

```bash
cp .env.example .env
docker compose up --build
```

Frontend: http://localhost:5173. Документация API: http://localhost:8000/docs.
PostgreSQL хранит данные в томе `postgres_data`. Backend ждёт готовности БД,
применяет миграции и запускается. Остановка: `docker compose down`.

Параметры новой базы задаются в `.env` до первого запуска. Если меняешь пароль
у уже созданной базы, его нужно поменять и в самом PostgreSQL.

## Локальный запуск с существующим PostgreSQL

Все команды выполняются из корня проекта. PostgreSQL должен быть запущен,
а указанная база — уже существовать.

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt
cp .env.example .env
```

В `.env` укажи свои `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
По умолчанию адрес — `127.0.0.1:5432`. Другой адрес можно задать через
`POSTGRES_HOST` и `POSTGRES_PORT` или полной строкой `DATABASE_URL`.

```bash
alembic upgrade head
uvicorn backend.main:app --reload
```

В другом терминале:

```bash
cd frontend
npm ci
npm run dev
```

## Структура

- `backend/api/` — HTTP-запросы и проверки прав.
- `backend/db/` — единые ORM-модели, подключение и запросы к БД.
- `backend/schemas/` — проверка входных данных.
- `backend/core/application.py` — приложение FastAPI.
- `alembic/` — миграции тех же моделей, которые использует backend.
- `frontend/` — интерфейс React.

Таблицы создают миграции, импорт приложения не меняет базу. Первая миграция
учитывает существующие таблицы с ожидаемыми столбцами; вторая исправляет поля
пользователей, включая время создания и размер хеша пароля.

Новые пароли хранятся с солью через scrypt. Старые SHA-256-хеши обновляются при
успешном входе. Случайные токены действуют 24 часа; выход удаляет текущую сессию.

После изменения моделей: `alembic revision --autogenerate -m "описание"`,
проверка созданного файла, затем `alembic upgrade head`.
