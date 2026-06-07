# Bundle: dex-bundle-ml-engineer

Bundle for ML Engineers: experiments, model training, debugging, deployment, data pipelines.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh ml-engineer

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 ml-engineer

# Preview what will be installed
./install-bundle/install-bundle.sh ml-engineer --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh ml-engineer

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 ml-engineer
```

## Included Components (11)

### Specialists (5)
- `dex-ml-experimenter` - EDA and feature engineering
- `dex-model-trainer` - Model training
- `dex-model-debugger` - Model debugging
- `dex-ml-deployer` - Model deployment
- `dex-data-pipeline` - Data pipelines

### Skills (6)
- `dex-skill-python-pytorch` - PyTorch patterns
- `dex-skill-python-tensorflow` - TensorFlow/Keras patterns
- `dex-skill-python-classical-ml` - Classical ML (scikit-learn, XGBoost)
- `dex-skill-python-nlp-transformers` - NLP with Transformers
- `dex-skill-python-computer-vision` - Computer Vision
- `dex-skill-python-ml-optimization` - ML optimization

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
