from backend.core.application import app

@app.get("/api/health")
def health_check():
    return {
        "status": "OK"
    }

