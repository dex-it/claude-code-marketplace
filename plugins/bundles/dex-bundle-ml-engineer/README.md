# Bundle: dex-bundle-ml-engineer

Meta-plugin that combines multiple specialists into one role-based package.

## Included Plugins

- `dex-ml-experimenter`
- `dex-model-trainer`
- `dex-model-debugger`
- `dex-ml-deployer`
- `dex-data-pipeline`
- `dex-skill-pytorch`
- `dex-skill-tensorflow`
- `dex-skill-classical-ml`
- `dex-skill-nlp-transformers`
- `dex-skill-computer-vision`
- `dex-skill-ml-optimization`

## Installation

Since Claude Code doesn't have native bundle dependency management, install each component separately:

```bash
# Install all components
claude plugins install dex-ml-experimenter
claude plugins install dex-model-trainer
claude plugins install dex-model-debugger
claude plugins install dex-ml-deployer
claude plugins install dex-data-pipeline
claude plugins install dex-skill-pytorch
claude plugins install dex-skill-tensorflow
claude plugins install dex-skill-classical-ml
claude plugins install dex-skill-nlp-transformers
claude plugins install dex-skill-computer-vision
claude plugins install dex-skill-ml-optimization
```

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
