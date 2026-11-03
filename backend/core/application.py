from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.core.config import APP_ENV
from backend.core.logging import logger

app = FastAPI(
        title='Дискреционная модель доступа',
        version="1.0.0"
)


@app.middleware("http")
async def log_request(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception:
        # Не выводим исключение, SQL-параметры или тело запроса: там могут быть секреты.
        logger.error("request_failed", extra={"path": request.url.path, "status": 500})
        return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})
    level = logger.error if response.status_code >= 400 else logger.info
    level("request_finished", extra={"path": request.url.path, "status": response.status_code})
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    logger.error("validation_failed", extra={"path": request.url.path, "status": 422})
    # FastAPI по умолчанию включает input; исключаем его, чтобы не возвращать пароль.
    errors = [{"loc": item["loc"], "msg": item["msg"], "type": item["type"]} for item in error.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


logger.info(f"application_configured:{APP_ENV}")


