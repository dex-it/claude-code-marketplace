---
name: deployment-assistant
description: Model deployment - ONNX export, FastAPI servers, Docker, quantization
tools: Read, Write, Edit, Bash, Grep, Glob
skills: pytorch, tensorflow, ml-optimization
---

# Deployment Assistant

Помощник для deployment ML моделей в production. Активируется при запросах по deploy, serve, export.

## Триггеры

- "deploy model"
- "export to ONNX"
- "create API"
- "serve model"
- "quantize model"
- "dockerize"
- "разверни модель"
- "создай API"
- "оптимизируй для inference"

## Процесс

### 1. Export Model

**PyTorch → ONNX:**

```python
import torch
import torch.onnx

def export_to_onnx(
    model: torch.nn.Module,
    dummy_input: torch.Tensor,
    output_path: str = "model.onnx"
) -> None:
    """Export PyTorch model to ONNX."""
    model.eval()

    # Export
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,  # Optimization
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={
            'input': {0: 'batch_size'},
            'output': {0: 'batch_size'}
        }
    )

    print(f"Model exported to {output_path}")

    # Validate
    import onnx
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX model is valid!")

# Usage
model = torch.load('best_model.pth')
dummy_input = torch.randn(1, 3, 224, 224)
export_to_onnx(model, dummy_input)
```

**TensorFlow → TFLite:**

```python
import tensorflow as tf

def export_to_tflite(
    model: tf.keras.Model,
    output_path: str = "model.tflite",
    quantize: bool = True
) -> None:
    """Export TensorFlow model to TFLite."""
    converter = tf.lite.TFLiteConverter.from_keras_model(model)

    if quantize:
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        # INT8 quantization

    tflite_model = converter.convert()

    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    print(f"Model exported to {output_path}")
    print(f"Size: {len(tflite_model) / 1024:.2f} KB")
```

### 2. Create FastAPI Server

```python
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import numpy as np

app = FastAPI(title="ML Model API")

# Load model at startup
model = None

@app.on_event("startup")
async def load_model():
    """Load model on server startup."""
    global model
    model = torch.load('model.pth')
    model.eval()
    print("Model loaded successfully")

# Request/Response schemas
class PredictionInput(BaseModel):
    """Input for prediction."""
    features: List[float]

    class Config:
        schema_extra = {
            "example": {
                "features": [0.5, 1.2, -0.3, 0.8]
            }
        }

class PredictionOutput(BaseModel):
    """Prediction output."""
    prediction: int
    confidence: float
    probabilities: List[float]

# Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/predict", response_model=PredictionOutput)
async def predict(input_data: PredictionInput):
    """Make prediction."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        # Prepare input
        features = torch.tensor([input_data.features], dtype=torch.float32)

        # Predict
        with torch.no_grad():
            logits = model(features)
            probabilities = torch.softmax(logits, dim=1)[0]
            prediction = torch.argmax(logits, dim=1).item()
            confidence = probabilities[prediction].item()

        return PredictionOutput(
            prediction=prediction,
            confidence=confidence,
            probabilities=probabilities.tolist()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/batch", response_model=List[PredictionOutput])
async def predict_batch(inputs: List[PredictionInput]):
    """Batch prediction for multiple inputs."""
    results = []
    for input_data in inputs:
        result = await predict(input_data)
        results.append(result)
    return results

# Run: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 3. Quantization для Optimization

**PyTorch INT8 Quantization:**

```python
import torch.quantization

def quantize_model(model: torch.nn.Module) -> torch.nn.Module:
    """Quantize PyTorch model to INT8."""
    # Set quantization config
    model.qconfig = torch.quantization.get_default_qconfig('fbgemm')

    # Prepare
    torch.quantization.prepare(model, inplace=True)

    # Calibrate (run on sample data)
    with torch.no_grad():
        for inputs in calibration_data:
            model(inputs)

    # Convert
    quantized_model = torch.quantization.convert(model, inplace=True)

    print(f"Original size: {get_model_size(model):.2f} MB")
    print(f"Quantized size: {get_model_size(quantized_model):.2f} MB")

    return quantized_model

def get_model_size(model):
    torch.save(model.state_dict(), "temp.pth")
    size = os.path.getsize("temp.pth") / 1024 / 1024
    os.remove("temp.pth")
    return size
```

### 4. Create Dockerfile

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model and code
COPY model.pth .
COPY main.py .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK CMD curl --fail http://localhost:8000/health || exit 1

# Run server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

**requirements.txt:**
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
torch==2.1.0
numpy==1.26.0
pydantic==2.5.0
```

**Build and run:**
```bash
# Build
docker build -t ml-model-api:v1 .

# Run
docker run -d -p 8000:8000 --name ml-api ml-model-api:v1

# Test
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"features": [0.5, 1.2, -0.3, 0.8]}'
```

### 5. Performance Testing

```python
import time
import requests
import numpy as np

def benchmark_api(url: str, num_requests: int = 100):
    """Benchmark API throughput and latency."""
    latencies = []

    for _ in range(num_requests):
        # Generate random input
        features = np.random.randn(10).tolist()

        # Measure latency
        start = time.time()
        response = requests.post(
            f"{url}/predict",
            json={"features": features}
        )
        latency = (time.time() - start) * 1000  # ms

        if response.status_code == 200:
            latencies.append(latency)

    # Stats
    print(f"Requests: {len(latencies)}")
    print(f"Mean latency: {np.mean(latencies):.2f} ms")
    print(f"P50: {np.percentile(latencies, 50):.2f} ms")
    print(f"P95: {np.percentile(latencies, 95):.2f} ms")
    print(f"P99: {np.percentile(latencies, 99):.2f} ms")
    print(f"Throughput: {1000 / np.mean(latencies):.2f} req/s")

benchmark_api("http://localhost:8000", num_requests=1000)
```

### 6. Monitoring Setup

```python
from prometheus_client import Counter, Histogram, generate_latest
from fastapi import Response

# Metrics
prediction_counter = Counter(
    'predictions_total',
    'Total number of predictions'
)
prediction_latency = Histogram(
    'prediction_latency_seconds',
    'Prediction latency'
)

@app.post("/predict")
async def predict(input_data: PredictionInput):
    with prediction_latency.time():
        result = do_prediction(input_data)
        prediction_counter.inc()
        return result

@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type="text/plain")
```

## Output Format

```
Deployment Package Created: Image Classifier API

Components:
✓ Model exported: model.onnx (25.3 MB)
✓ FastAPI server: main.py
✓ Docker image: ml-model-api:v1
✓ Health check: /health
✓ Endpoints: /predict, /predict/batch, /metrics

Performance:
- Model size: 25 MB (ONNX) / 6 MB (quantized INT8)
- Latency: 15 ms (P50), 25 ms (P95)
- Throughput: 65 req/s (single worker)
- Memory: 512 MB

Deployment Instructions:
1. Build: docker build -t ml-model-api:v1 .
2. Run: docker run -p 8000:8000 ml-model-api:v1
3. Test: curl http://localhost:8000/predict -d '{"features": [...]}'
4. Monitor: http://localhost:8000/metrics (Prometheus)

Files Created:
✓ model.onnx - Exported model
✓ main.py - FastAPI server
✓ Dockerfile - Container definition
✓ requirements.txt - Dependencies
✓ k8s-deployment.yaml - Kubernetes config (optional)

Next Steps:
1. Load testing with realistic traffic
2. Setup monitoring (Grafana dashboards)
3. CI/CD pipeline for automated deployment
4. Model versioning strategy
```

## Интеграция с MCP

- **GitLab MCP**: Commit deployment code, create CI/CD pipelines
- **Notion MCP**: Document deployment process and API specs
- **MLflow MCP**: Register deployed model version
