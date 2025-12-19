# DEX Python ML Developer Plugin

> Comprehensive Machine Learning toolkit для Python разработчиков. PyTorch, TensorFlow, scikit-learn, HuggingFace Transformers, MLOps tools.

## Описание

Plugin для ML инженеров и Data Scientists. Предоставляет AI-ассистентов, команды и best practices для:

- Deep Learning (PyTorch, TensorFlow/Keras)
- Classical ML (scikit-learn, XGBoost, LightGBM)
- NLP (HuggingFace Transformers, tokenization, fine-tuning)
- Computer Vision (ResNet, YOLO, U-Net, albumentations)
- MLOps (experiment tracking, hyperparameter tuning, deployment)
- Model optimization (quantization, pruning, profiling)

## Компоненты

### 🤖 Agents

**ml-experimenter** - Exploratory Data Analysis и feature engineering
- Dataset loading и inspection
- Statistical analysis
- Feature engineering strategies
- Baseline models (RandomForest, XGBoost)
- MLflow integration для insights
- Triggers: `explore dataset`, `EDA`, `feature engineering`, `исследуй данные`, `анализ данных`

**model-trainer** - Обучение моделей (PyTorch/TensorFlow/sklearn)
- Multi-framework training loops
- Validation и early stopping
- Checkpointing
- MLflow/Weights & Biases tracking
- Distributed training (DDP)
- Triggers: `train model`, `fine-tune`, `обучи модель`, `тренируй`, `дообучи`

**model-debugger** - Отладка ML моделей
- Loss not decreasing diagnostics
- Overfitting fixes (dropout, regularization, augmentation)
- NaN/exploding gradients solutions
- CUDA OOM troubleshooting
- Learning rate issues
- Triggers: `loss not decreasing`, `overfitting`, `модель не учится`, `NaN`, `gradient exploding`

**deployment-assistant** - Model deployment
- ONNX export (PyTorch)
- TFLite export (TensorFlow)
- FastAPI server generation
- Dockerfile creation
- Quantization (INT8)
- Performance testing
- Triggers: `deploy model`, `export to ONNX`, `create API`, `задеплой модель`

**data-pipeline-builder** - Efficient data loading
- PyTorch DataLoader optimization
- TensorFlow tf.data pipelines
- Text datasets для NLP
- Large dataset patterns (HDF5, memmap)
- DataLoader benchmarking
- Triggers: `create dataloader`, `data pipeline`, `slow training`, `оптимизируй загрузку`

### ⚡ Commands

**`/train`** - Запуск обучения модели
```
Автоматическое обнаружение framework и обучение:
- Detects PyTorch/TensorFlow/scikit-learn
- Starts MLflow tracking server
- Monitors progress (nvidia-smi, logs)
- Returns metrics + MLflow run ID

Usage:
/train train.py
/train scripts/train_classifier.py --epochs 50
```

**`/evaluate`** - Comprehensive model evaluation
```
Полная оценка на test set:
- Classification/regression metrics
- Confusion matrix, ROC curves
- Per-class performance analysis
- Identify worst classes
- Visualization generation

Usage:
/evaluate model.pth test_data/
/evaluate models/best_model.h5
```

**`/tune`** - Hyperparameter tuning
```
Автоматический поиск оптимальных гиперпараметров:
- Optuna или Ray Tune backend
- Progress monitoring (dashboard, TensorBoard)
- Parameter importance analysis
- Best params export to YAML

Usage:
/tune 100                    # 100 trials
/tune --metric f1_score
```

**`/profile`** - Performance profiling
```
Анализ производительности модели:
- Count FLOPs и parameters
- Measure latency (P50/P95/P99)
- Memory profiling (GPU/CPU)
- Bottleneck analysis
- Optimization recommendations

Usage:
/profile model.pth
/profile --batch-size 32
```

**`/convert`** - Model format conversion
```
Конвертация между форматами:
- PyTorch → ONNX
- TensorFlow → TFLite
- Validation (output comparison)
- Performance benchmarking

Usage:
/convert model.pth onnx
/convert model.h5 tflite
```

**`/serve`** - FastAPI inference server
```
Production-ready API server generation:
- FastAPI application
- Dockerfile + docker-compose
- Health check endpoint
- Load testing setup (locust)
- Prometheus metrics

Usage:
/serve model.pth
/serve model.onnx --port 8000
```

### 🎯 Skills

**pytorch-patterns** - PyTorch best practices
```
Активируется при:
- Custom nn.Module architecture
- DataLoader creation
- Training loops
- Transfer learning
- Distributed training (DDP)

Включает:
- nn.Module patterns с type hints
- DataLoader optimization (pin_memory, num_workers)
- Training loop with checkpointing
- Learning rate schedulers (OneCycleLR)
- Mixed precision training (AMP)
- Gradient clipping
```

**tensorflow-patterns** - TensorFlow/Keras best practices
```
Активируется при:
- Keras model creation
- tf.data pipelines
- Custom training loops
- Model export (SavedModel)

Включает:
- Functional API vs Subclassing
- Custom layers с get_config
- tf.data optimization (AUTOTUNE, prefetch)
- GradientTape training loops
- Callbacks (ModelCheckpoint, EarlyStopping)
- Multi-GPU (MirroredStrategy)
```

**classical-ml** - scikit-learn, XGBoost, LightGBM
```
Активируется при:
- Pipeline creation
- Feature engineering
- Cross-validation
- Hyperparameter tuning
- Imbalanced data

Включает:
- Pipeline + ColumnTransformer patterns
- XGBoost early stopping
- Feature engineering (PolynomialFeatures, target encoding)
- Cross-validation (StratifiedKFold, TimeSeriesSplit)
- Ensemble methods (VotingClassifier, Stacking)
- SMOTE для imbalanced data
```

**nlp-transformers** - HuggingFace Transformers
```
Активируется при:
- Tokenization
- Fine-tuning BERT/GPT
- Text classification, NER
- LoRA/QLoRA
- Generation

Включает:
- Fast tokenizers (batched encoding)
- Trainer API fine-tuning
- Text classification patterns
- LoRA/QLoRA efficient fine-tuning
- Gradient accumulation
- Model quantization (4-bit, 8-bit)
- Batch inference optimization
```

**computer-vision** - CV architectures и techniques
```
Активируется при:
- Image classification
- Object detection (YOLO)
- Semantic segmentation (U-Net)
- Image augmentation
- Transfer learning

Включает:
- Transfer learning (ResNet, EfficientNet)
- Albumentations augmentation
- YOLO fine-tuning
- U-Net semantic segmentation
- Vision Transformers (ViT)
- Grad-CAM interpretability
```

**ml-optimization** - Performance optimization
```
Активируется при:
- Hyperparameter search
- Multi-GPU training
- Performance profiling
- Memory optimization

Включает:
- Optuna hyperparameter tuning
- Ray Tune distributed search
- PyTorch DDP multi-GPU
- torch.profiler для bottlenecks
- Gradient checkpointing
- Efficient DataLoader settings
```

### 📝 System Prompt

ML Developer system prompt с:
- Technology stack (Python 3.10+, PyTorch, TensorFlow, etc.)
- Coding principles (type hints everywhere, async, reproducibility)
- Experiment tracking standards
- Model deployment best practices
- Common patterns и anti-patterns

## Configuration

This plugin requires several MCP servers to be configured with environment variables.

### Required Environment Variables

**MLflow Integration**
- `MLFLOW_TRACKING_URI` - MLflow tracking server URL
  - Get from: Your MLflow server deployment
  - Default: `http://localhost:5000`
  - Required for: Experiment tracking, model registry

**Weights & Biases Integration**
- `WANDB_API_KEY` - Weights & Biases API key
  - Get from: https://wandb.ai/authorize
  - Required for: Experiment tracking, model versioning

**HuggingFace Integration**
- `HUGGINGFACE_TOKEN` - HuggingFace API token
  - Get from: https://huggingface.co/settings/tokens
  - Required for: Model download/upload, dataset access

**GitLab Integration**
- `GITLAB_TOKEN` - GitLab Personal Access Token
  - Get from: https://gitlab.com/-/user_settings/personal_access_tokens
  - Scopes: `api`, `read_repository`, `write_repository`
  - Required for: Code versioning, CI/CD integration

**Notion Integration**
- `NOTION_TOKEN` - Notion API token
  - Get from: https://www.notion.so/my-integrations
  - Required for: Documentation, experiment notes

### Optional Environment Variables

- `GITLAB_URL` - GitLab instance URL
  - Default: `https://gitlab.com`

### Setup Instructions

1. **Generate API keys** from each service (see links above)
2. **Set environment variables** before launching Claude Code:
   ```bash
   export MLFLOW_TRACKING_URI="http://localhost:5000"
   export WANDB_API_KEY="your-wandb-key"
   export HUGGINGFACE_TOKEN="your-hf-token"
   export GITLAB_TOKEN="glpat-xxxxx"
   export NOTION_TOKEN="ntn_xxxxx"
   ```
3. **Start MLflow server** (if using local tracking):
   ```bash
   mlflow server --host 0.0.0.0 --port 5000
   ```
4. **Launch Claude Code** and verify configuration:
   ```bash
   claude
   /mcp list
   ```

## Quick Start

### 1. Установка

```bash
# Скопируйте плагин в .claude/plugins/
cp -r dex-python-ml-developer ~/.claude/plugins/

# Или через marketplace (когда доступно)
claude plugin install dex-python-ml-developer
```

### 2. Configuration

See the **[Configuration](#configuration)** section above for detailed setup instructions for MCP servers and environment variables.

### 3. Python Environment Setup

```bash
# Рекомендуется Python 3.10+
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install core dependencies
pip install torch torchvision torchaudio  # PyTorch
pip install tensorflow                    # TensorFlow
pip install scikit-learn xgboost lightgbm # Classical ML
pip install transformers datasets         # HuggingFace
pip install mlflow wandb optuna ray[tune] # MLOps tools
pip install fastapi uvicorn              # Deployment
pip install black isort mypy             # Code quality

# Optional but recommended
pip install albumentations timm          # Computer Vision
pip install accelerate bitsandbytes peft # Efficient training
```

### 4. Использование

**Exploratory Data Analysis:**
```
"Исследуй датасет data/train.csv"
"Проанализируй признаки и покажи корреляции"
"Создай baseline модель для классификации"
```

**Model Training:**
```
/train train.py                          # Auto-detect framework
"Обучи BERT для классификации текстов"
"Fine-tune ResNet на моём датасете"
"Создай XGBoost classifier с cross-validation"
```

**Debugging:**
```
"Loss не уменьшается, что делать?"
"Модель переобучается - как исправить?"
"CUDA out of memory error"
```

**Hyperparameter Tuning:**
```
/tune 100                                # 100 trials
"Подбери гиперпараметры для XGBoost"
"Найди оптимальный learning rate для ResNet"
```

**Model Evaluation:**
```
/evaluate model.pth data/test/
"Оцени модель на тестовом наборе"
"Какие классы модель путает чаще всего?"
```

**Deployment:**
```
/serve model.pth                         # FastAPI server
/convert model.pth onnx                  # Export to ONNX
"Создай Docker контейнер для модели"
"Экспортируй в TFLite для mobile"
```

**Performance Analysis:**
```
/profile model.pth
"Сколько FLOPs у модели?"
"Какие слои самые медленные?"
"Как ускорить inference?"
```

## Frameworks & Best Practices

### PyTorch Training Loop

```python
from typing import Dict
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

def train_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    device: torch.device
) -> Dict[str, float]:
    """Single training epoch with type hints."""
    model.train()
    total_loss = 0.0

    for batch_idx, (inputs, targets) in enumerate(dataloader):
        inputs, targets = inputs.to(device), targets.to(device)

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    return {"loss": total_loss / len(dataloader)}

# Mixed precision training
scaler = torch.cuda.amp.GradScaler()
with torch.cuda.amp.autocast():
    outputs = model(inputs)
    loss = criterion(outputs, targets)
scaler.scale(loss).backward()
scaler.step(optimizer)
scaler.update()
```

### TensorFlow tf.data Pipeline

```python
import tensorflow as tf
from typing import Tuple

def create_dataset(
    file_pattern: str,
    batch_size: int = 32,
    shuffle_buffer: int = 10000
) -> tf.data.Dataset:
    """Optimized tf.data pipeline."""
    dataset = tf.data.TFRecordDataset(
        tf.io.gfile.glob(file_pattern),
        num_parallel_reads=tf.data.AUTOTUNE
    )

    dataset = dataset.map(
        parse_function,
        num_parallel_calls=tf.data.AUTOTUNE
    )

    dataset = dataset.cache()
    dataset = dataset.shuffle(shuffle_buffer)
    dataset = dataset.batch(batch_size)
    dataset = dataset.prefetch(tf.data.AUTOTUNE)

    return dataset
```

### scikit-learn Pipeline

```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.ensemble import RandomForestClassifier

# Separate numerical and categorical features
numeric_features = ['age', 'income']
categorical_features = ['gender', 'occupation']

# Preprocessing pipeline
preprocessor = ColumnTransformer([
    ('num', StandardScaler(), numeric_features),
    ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
])

# Full pipeline
pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
])

# Cross-validation
from sklearn.model_selection import cross_val_score
scores = cross_val_score(pipeline, X, y, cv=5, scoring='f1_weighted')
print(f"F1 score: {scores.mean():.3f} ± {scores.std():.3f}")
```

### HuggingFace Fine-tuning

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
from datasets import load_dataset

# Load pretrained model
model_name = "bert-base-uncased"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)

# Tokenize dataset
def tokenize_function(examples):
    return tokenizer(examples["text"], padding="max_length", truncation=True)

dataset = load_dataset("imdb")
tokenized_datasets = dataset.map(tokenize_function, batched=True)

# Training arguments
training_args = TrainingArguments(
    output_dir="./results",
    evaluation_strategy="epoch",
    learning_rate=2e-5,
    per_device_train_batch_size=16,
    num_train_epochs=3,
    weight_decay=0.01,
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
)

# Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_datasets["train"],
    eval_dataset=tokenized_datasets["test"],
)

trainer.train()
```

### LoRA Fine-tuning (Efficient)

```python
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM

# Load base model
base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    load_in_8bit=True,  # Quantization
    device_map="auto"
)

# LoRA config
lora_config = LoraConfig(
    r=8,                    # Low rank
    lora_alpha=16,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

# Apply LoRA
model = get_peft_model(base_model, lora_config)
model.print_trainable_parameters()  # Only ~0.1% parameters trainable!
```

## MLOps Patterns

### Experiment Tracking (MLflow)

```python
import mlflow

mlflow.set_tracking_uri("http://localhost:5000")
mlflow.set_experiment("image-classification")

with mlflow.start_run(run_name="resnet50-v1"):
    # Log parameters
    mlflow.log_params({
        "model": "resnet50",
        "optimizer": "adam",
        "lr": 0.001,
        "batch_size": 32
    })

    # Training loop
    for epoch in range(num_epochs):
        train_loss = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc = evaluate(model, val_loader, criterion, device)

        # Log metrics
        mlflow.log_metrics({
            "train_loss": train_loss,
            "val_loss": val_loss,
            "val_accuracy": val_acc
        }, step=epoch)

    # Log model
    mlflow.pytorch.log_model(model, "model")

    # Log artifacts
    mlflow.log_artifact("confusion_matrix.png")
```

### Hyperparameter Tuning (Optuna)

```python
import optuna
from optuna.integration import MLflowCallback

def objective(trial: optuna.Trial) -> float:
    # Suggest hyperparameters
    lr = trial.suggest_float("lr", 1e-5, 1e-2, log=True)
    batch_size = trial.suggest_categorical("batch_size", [16, 32, 64])
    dropout = trial.suggest_float("dropout", 0.1, 0.5)

    # Train model
    model = create_model(dropout=dropout)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    train_loader = DataLoader(train_dataset, batch_size=batch_size)

    val_acc = train_and_evaluate(model, train_loader, val_loader, optimizer)

    return val_acc

# Run study
mlflow_callback = MLflowCallback(tracking_uri="http://localhost:5000")
study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=100, callbacks=[mlflow_callback])

print(f"Best trial: {study.best_trial.number}")
print(f"Best params: {study.best_params}")
print(f"Best value: {study.best_value:.4f}")
```

### Model Deployment (FastAPI)

```python
from fastapi import FastAPI
from pydantic import BaseModel
import torch
from typing import List

app = FastAPI(title="Image Classifier API")

class PredictionInput(BaseModel):
    features: List[float]

class PredictionOutput(BaseModel):
    prediction: int
    probability: float

# Load model at startup
model = None

@app.on_event("startup")
async def load_model():
    global model
    model = torch.load("model.pth", map_location="cpu")
    model.eval()

@app.post("/predict", response_model=PredictionOutput)
async def predict(input_data: PredictionInput):
    tensor = torch.tensor([input_data.features])
    with torch.no_grad():
        output = model(tensor)
        probs = torch.softmax(output, dim=1)
        pred = output.argmax(dim=1).item()
        prob = probs[0, pred].item()

    return PredictionOutput(prediction=pred, probability=prob)

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None}
```

## Tips & Best Practices

### Training

✅ **Do:**
- Use type hints everywhere (Python 3.10+)
- Set random seeds для reproducibility (`torch.manual_seed(42)`)
- Track experiments в MLflow/W&B
- Validate на отдельном val set (не на train!)
- Save checkpoints регулярно
- Monitor GPU usage (`nvidia-smi`)
- Use mixed precision (AMP) для speedup
- Gradient clipping для stability

❌ **Don't:**
- Train без validation set
- Forget reproducibility (random seeds)
- Hardcode hyperparameters
- Ignore data leakage
- Skip data normalization
- Use mutable default arguments в функциях

### Data Loading

✅ **Do:**
- Use DataLoader с `num_workers > 0` (CPU bound)
- Enable `pin_memory=True` для GPU
- Set `persistent_workers=True` (PyTorch 1.7+)
- Use `prefetch_factor` для overlap
- Cache preprocessed data если возможно
- Profile DataLoader (`profiler.profile()`)

❌ **Don't:**
- Load entire dataset в memory без необходимости
- Use `num_workers` слишком большой (4-8 обычно достаточно)
- Forget augmentation в training (но не в validation!)
- Ignore data imbalance

### Model Architecture

✅ **Do:**
- Start с pretrained models (transfer learning)
- Use BatchNorm/LayerNorm для stability
- Add dropout для regularization
- Use residual connections для deep networks
- Validate output shapes в `__init__`

❌ **Don't:**
- Train от scratch если есть pretrained
- Skip normalization layers
- Use too many parameters (overfitting risk)
- Forget activation functions

### Debugging

✅ **Do:**
- Overfit на small batch сначала (sanity check)
- Check gradient flow (`model.parameters()`)
- Visualize predictions регулярно
- Use learning rate finder
- Monitor loss curves (train + val)
- Check data distribution (class balance)

❌ **Don't:**
- Ignore NaN losses (check LR, normalization)
- Trust only final metrics (plot curves!)
- Skip sanity checks (1 batch overfit test)
- Use too high learning rate

### Deployment

✅ **Do:**
- Quantize models для production (INT8)
- Benchmark latency (P50, P95, P99)
- Use ONNX для portability
- Add health checks к API
- Load test перед production
- Version models (MLflow registry)

❌ **Don't:**
- Deploy без latency testing
- Skip error handling в inference
- Forget batch inference optimization
- Use FP32 если INT8 достаточно

## Integration с Development Workflow

Этот плагин designed для ML research и production:

- **MLflow**: primary experiment tracking
- **Weights & Biases**: alternative tracking (richer visualizations)
- **HuggingFace**: pretrained models, datasets, tokenizers
- **GitLab**: code versioning, model registry (LFS)
- **Notion**: documentation, experiment notes, model cards

Пример integrated workflow:
```
1. EDA → ml-experimenter agent → insights в Notion
2. Baseline → /train → MLflow tracking
3. Hyperparameter tuning → /tune → best params
4. Final training → /train с best params → MLflow model registry
5. Evaluation → /evaluate → metrics report
6. Optimization → /profile → bottleneck analysis
7. Conversion → /convert → ONNX export
8. Deployment → /serve → FastAPI + Docker
9. Documentation → model card в Notion
```

## Troubleshooting

**CUDA out of memory:**
```python
# Reduce batch size
batch_size = 16  # Was 32

# Enable gradient accumulation
accumulation_steps = 2  # Effective batch = 16 * 2 = 32

# Use gradient checkpointing
model.gradient_checkpointing_enable()

# Mixed precision
from torch.cuda.amp import autocast, GradScaler
scaler = GradScaler()
```

**Loss не уменьшается:**
```python
# 1. Check learning rate (too high/low)
lr = 1e-3  # Try 1e-4 or 1e-2

# 2. Sanity check: overfit на 1 batch
for _ in range(100):
    loss = train_step(model, single_batch)
    # Should → 0

# 3. Check labels (correct encoding?)
assert targets.max() < num_classes

# 4. Check input normalization
mean, std = inputs.mean(), inputs.std()
# Should be ~0, ~1 if normalized
```

**Overfitting:**
```python
# Add dropout
model = nn.Sequential(
    nn.Linear(128, 64),
    nn.Dropout(0.3),  # <-- Add this
    nn.ReLU(),
    ...
)

# Data augmentation (images)
transforms.Compose([
    transforms.RandomHorizontalFlip(),
    transforms.RandomCrop(32, padding=4),
    transforms.ColorJitter(brightness=0.2),
])

# L2 regularization
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

# Early stopping
if val_loss > best_val_loss:
    patience_counter += 1
if patience_counter > patience:
    break
```

**MLflow не работает:**
```bash
# Check server
mlflow server --host 0.0.0.0 --port 5000

# Verify connection
python -c "import mlflow; mlflow.set_tracking_uri('http://localhost:5000'); print(mlflow.get_tracking_uri())"

# Check firewall
curl http://localhost:5000
```

**HuggingFace tokenizer slow:**
```python
# Use fast tokenizers
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased", use_fast=True)

# Batch processing
tokenized = tokenizer(texts, padding=True, truncation=True, return_tensors="pt")

# Cache tokenized data
tokenized_dataset = dataset.map(tokenize_function, batched=True)
```

## Code Quality

Плагин автоматически проверяет:

**black** - code formatting:
```bash
black your_script.py
```

**isort** - import sorting:
```bash
isort your_script.py
```

**mypy** - type checking (опционально):
```bash
mypy your_script.py
```

Setup pre-commit hook:
```bash
pip install pre-commit
# Create .pre-commit-config.yaml
pre-commit install
```

## Roadmap Plugin'а

- [ ] AutoML integration (AutoKeras, AutoGluon)
- [ ] Model interpretability tools (SHAP, LIME)
- [ ] Automated model monitoring (drift detection)
- [ ] Kedro integration для ML pipelines
- [ ] DVC integration для data versioning
- [ ] Kubernetes deployment templates
- [ ] Model compression techniques (knowledge distillation)
- [ ] Federated learning patterns

## Contributing

Suggestions welcome! Areas для improvement:

- Additional ML domains (Reinforcement Learning, Time Series)
- More deployment targets (TorchServe, TFServing, Triton)
- Industry-specific models (Finance, Healthcare, Retail)
- Integration с другими tools (Neptune.ai, ClearML)

## License

См. корневой LICENSE файл проекта.

---

**Version:** 2.0.0
**Author:** DEX Team
**Requires:** MLflow MCP, Weights & Biases MCP, HuggingFace MCP
**Tags:** python, machine-learning, pytorch, tensorflow, scikit-learn, huggingface, mlops, deep-learning
