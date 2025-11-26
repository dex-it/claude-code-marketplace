# DEX DevOps Plugin

> Comprehensive DevOps toolkit для CI/CD, Docker, Kubernetes и автоматизации deployment.

## Описание

Plugin для DevOps инженеров. Предоставляет AI-ассистентов, команды и best practices для:

- CI/CD pipelines (GitLab CI, GitHub Actions)
- Docker containerization
- Kubernetes orchestration
- Infrastructure as Code
- Deployment automation

## Компоненты

### 🤖 Agents

**pipeline-expert** - CI/CD Pipeline специалист
- GitLab CI/CD pipeline creation
- GitHub Actions workflows
- Pipeline optimization и troubleshooting
- Artifact management
- Triggers: `pipeline`, `CI/CD`, `gitlab ci`, `github actions`, `пайплайн`

**docker-builder** - Docker контейнеризация
- Dockerfile creation и optimization
- Multi-stage builds
- Docker Compose configurations
- Image optimization
- Security best practices
- Triggers: `dockerfile`, `docker`, `containerize`, `контейнеризация`

**k8s-specialist** - Kubernetes deployment
- Deployment, Service, Ingress manifests
- ConfigMaps и Secrets management
- StatefulSets, DaemonSets
- Helm charts
- Kubernetes troubleshooting
- Triggers: `kubernetes`, `k8s`, `helm`, `деплой в kubernetes`

### ⚡ Commands

**`/pipeline`** - Создание CI/CD pipeline
```
Генерирует CI/CD pipeline configuration:
- GitLab CI (.gitlab-ci.yml)
- GitHub Actions (.github/workflows/*.yml)
- Build, test, deploy stages
- Artifact caching
- Environment variables
```

**`/dockerfile`** - Генерация Dockerfile
```
Создаёт optimized Dockerfile:
- Multi-stage builds
- Layer caching optimization
- Security best practices
- .dockerignore
- Health checks
```

**`/deploy`** - Kubernetes deployment setup
```
Создаёт Kubernetes manifests:
- Deployment + Service
- ConfigMap + Secrets
- Ingress rules
- Resource limits
- Health probes
```

### 🎯 Skills

**gitlab-ci** - GitLab CI/CD best practices
```
Активируется при:
- Pipeline creation
- Job configuration
- Artifact management
- Cache optimization

Включает:
- .gitlab-ci.yml structure
- Job dependencies и stages
- Docker-in-Docker patterns
- Variables и secrets management
- Pipeline optimization techniques
```

**docker-best-practices** - Docker patterns
```
Активируется при:
- Dockerfile creation
- Image optimization
- Multi-stage builds
- Security hardening

Включает:
- Minimal base images
- Layer caching strategies
- Security scanning
- .dockerignore patterns
- Health check implementation
```

**kubernetes** - Kubernetes deployment patterns
```
Активируется при:
- Manifest creation
- Resource configuration
- Helm charts
- Troubleshooting

Включает:
- Deployment strategies (Rolling, Blue/Green)
- Resource requests/limits
- Probes (liveness, readiness, startup)
- ConfigMaps + Secrets patterns
- Service types (ClusterIP, NodePort, LoadBalancer)
```

### 📝 System Prompt

DevOps system prompt с:
- Technology stack (GitLab CI, Docker, Kubernetes, Helm)
- Best practices для CI/CD
- Security considerations
- Monitoring и observability patterns

## Configuration

This plugin requires GitLab MCP server to be configured with environment variables.

### Required Environment Variables

**GitLab Integration**
- `GITLAB_TOKEN` - GitLab Personal Access Token
  - Get from: https://gitlab.com/-/user_settings/personal_access_tokens
  - Scopes: `api`, `read_repository`, `write_repository`
  - Required for: CI/CD pipeline management, repository access

### Optional Environment Variables

- `GITLAB_API_URL` - GitLab instance URL
  - Default: `https://gitlab.com/api/v4`
  - Use custom URL for self-hosted GitLab instances

### Setup Instructions

1. **Create GitLab Personal Access Token:**
   - Open https://gitlab.com/-/user_settings/personal_access_tokens
   - Click "Add new token"
   - Set expiration date
   - Select scopes: `api`, `read_repository`, `write_repository`
   - Copy the generated token

2. **Set environment variable:**
   ```bash
   export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
   export GITLAB_API_URL="https://gitlab.com/api/v4"  # Optional
   ```

3. **Verify configuration:**
   ```bash
   claude
   /mcp list
   ```

## Quick Start

### 1. Установка

```bash
# Скопируйте плагин в .claude/plugins/
cp -r dex-devops ~/.claude/plugins/

# Или через marketplace (когда доступно)
claude plugin install dex-devops
```

### 2. Configuration

See the **[Configuration](#configuration)** section above for GitLab setup instructions.

### 3. Использование

**CI/CD Pipeline:**
```
/pipeline                        # Create GitLab CI pipeline
"Создай pipeline для .NET приложения"
"Добавь stage для Docker build"
```

**Docker:**
```
/dockerfile                      # Generate Dockerfile
"Создай Dockerfile для ASP.NET приложения"
"Оптимизируй размер образа"
```

**Kubernetes:**
```
/deploy                          # Create K8s manifests
"Создай deployment для приложения"
"Настрой ingress для домена example.com"
```

## Best Practices

### GitLab CI

✅ **DO:**
- Use Docker executor для consistency
- Cache dependencies (`cache:` directive)
- Split pipeline into logical stages
- Use `extends:` для DRY configuration
- Store secrets в GitLab CI/CD variables

❌ **DON'T:**
- Hardcode credentials в .gitlab-ci.yml
- Use `latest` tags
- Run unnecessary jobs
- Forget to set `only/except` rules

### Docker

✅ **DO:**
- Use specific base image tags (не `latest`)
- Multi-stage builds для уменьшения size
- .dockerignore для excluding unnecessary files
- Run containers as non-root user
- Health checks (`HEALTHCHECK`)

❌ **DON'T:**
- Copy entire project directory
- Install unnecessary packages
- Run as root
- Ignore security vulnerabilities
- Use outdated base images

### Kubernetes

✅ **DO:**
- Set resource requests/limits
- Configure health probes
- Use ConfigMaps/Secrets для configuration
- Follow 12-factor app principles
- Use namespaces для isolation

❌ **DON'T:**
- Use `latest` image tags
- Run without resource limits
- Store secrets в plain text
- Ignore security contexts
- Deploy without health checks

## Troubleshooting

**GitLab CI pipeline fails:**
```bash
# Check runner logs
gitlab-runner verify
gitlab-runner run

# Verify .gitlab-ci.yml syntax
gitlab-ci-lint .gitlab-ci.yml
```

**Docker build fails:**
```bash
# Build with verbose output
docker build --progress=plain --no-cache .

# Check layer sizes
docker history image:tag
```

**Kubernetes pod not starting:**
```bash
# Check pod status
kubectl describe pod <pod-name>
kubectl logs <pod-name>

# Check events
kubectl get events --sort-by='.lastTimestamp'
```

## Integration с .NET Workflow

Этот плагин designed для .NET команд:

- **GitLab CI**: Pipeline для .NET builds, tests, deployments
- **Docker**: Multi-stage builds для ASP.NET приложений
- **Kubernetes**: Deployment .NET микросервисов

Example integrated workflow:
```
1. Code → GitLab repository
2. GitLab CI → Build .NET solution
3. Docker → Create optimized image
4. Kubernetes → Deploy to cluster
5. Monitoring → Track health & metrics
```

## Roadmap

- [ ] Terraform integration для IaC
- [ ] Ansible playbooks templates
- [ ] AWS/Azure cloud deployment patterns
- [ ] Prometheus + Grafana monitoring setup
- [ ] ArgoCD GitOps integration

## License

См. корневой LICENSE файл проекта.

---

**Version:** 2.0.0
**Author:** DEX Team
**Requires:** GitLab MCP server
**Tags:** devops, ci-cd, docker, kubernetes, gitlab-ci
