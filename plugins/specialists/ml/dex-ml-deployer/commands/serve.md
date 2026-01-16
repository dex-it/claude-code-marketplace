---
description: Create FastAPI inference server для модели
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: <model-path>
---

# /serve

Создание production-ready inference server с FastAPI.

## Процесс

1. **Generate FastAPI application:**
```python
# Generated: serve/main.py
from fastapi import FastAPI
from pydantic import BaseModel
import torch

app = FastAPI(title="ML Model API")
model = None

@app.on_event("startup")
async def load_model():
    global model
    model = torch.load('model.pth')
    model.eval()

class PredictionInput(BaseModel):
    features: list[float]

@app.post("/predict")
async def predict(input: PredictionInput):
    tensor = torch.tensor([input.features])
    with torch.no_grad():
        output = model(tensor)
    return {"prediction": output.tolist()}

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None}
```

2. **Create Dockerfile:**
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

3. **Build and run:**
```bash
docker build -t ml-api:v1 .
docker run -d -p 8000:8000 --name ml-api ml-api:v1
```

4. **Test endpoints:**
```bash
# Health check
curl http://localhost:8000/health

# Prediction
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"features": [0.5, 1.2, -0.3]}'
```

5. **Load testing:**
```bash
pip install locust
locust -f loadtest.py --host http://localhost:8000
```

## Вывод

```
FastAPI Server Created: Image Classifier API

Server Configuration:
✓ Framework: FastAPI + Uvicorn
✓ Model: ResNet50 (97.8 MB)
✓ Port: 8000
✓ Workers: 4
✓ Timeout: 60s

Endpoints:
✓ GET  /health - Health check
✓ GET  /docs - Swagger UI
✓ POST /predict - Single prediction
✓ POST /predict/batch - Batch predictions
✓ GET  /metrics - Prometheus metrics

Validation:
✓ Server starts successfully
✓ Health check: 200 OK
✓ Test prediction: 200 OK
✓ Swagger docs: http://localhost:8000/docs

Performance (Load Test):
- Concurrent users: 100
- Requests: 10,000
- Success rate: 100%
- Latency P50: 18 ms
- Latency P95: 35 ms
- Throughput: 280 req/sec
- Errors: 0

Files Created:
✓ serve/main.py - FastAPI application
✓ serve/requirements.txt - Dependencies
✓ serve/Dockerfile - Container definition
✓ serve/loadtest.py - Locust load test
✓ serve/README.md - Deployment guide

Docker Image:
✓ Image: ml-api:v1
✓ Size: 1.2 GB
✓ Layers: 8
✓ Build time: 45s

Next steps:
1. Configure monitoring (Prometheus + Grafana)
2. Add request/response logging
3. Setup CI/CD pipeline for auto-deployment
4. Configure auto-scaling (HPA in Kubernetes)
5. Add rate limiting and authentication

Deployment Commands:
# Local
uvicorn main:app --reload

# Docker
docker run -p 8000:8000 ml-api:v1

# Kubernetes
kubectl apply -f k8s-deployment.yaml
```

## Действия

- Save API specs to Notion MCP
- Commit serving code to GitLab MCP
- Create deployment pipeline in GitLab CI
- Register API endpoint in MLflow MCP
