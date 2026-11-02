FROM python:3.11-slim

WORKDIR /app

# Копируем только requirements.txt для кэширования
COPY requirements.txt .

# Устанавливаем Python-зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальной код
COPY . .

# Запускаем FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]