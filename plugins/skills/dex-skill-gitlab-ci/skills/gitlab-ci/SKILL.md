---
name: gitlab-ci
description: GitLab CI/CD — оптимизация, ловушки, безопасность. Активируется при gitlab ci, pipeline, .gitlab-ci.yml, ci cd, deploy
allowed-tools: Read, Grep, Glob
---

# GitLab CI/CD

## Правила

- Stages: validate → build → test → package → deploy
- Cache для NuGet packages, artifacts для build outputs
- `rules:` вместо `only:/except:` (deprecated)
- `needs:` (DAG) для параллельных dependencies
- Protected + masked variables для secrets
- `interruptible: true` для non-deploy jobs
- Manual deploy в production

## Частые ошибки

```yaml
# Плохо — секреты в логах
script:
  - echo "Deploying with $DB_PASSWORD"  # маскированная переменная раскрыта

# Плохо — cache и artifacts путаются
build:
  cache:
    paths:
      - bin/Release/    # это build output → artifacts, не cache
  artifacts:
    paths:
      - .nuget/packages/  # это dependencies → cache, не artifacts

# Хорошо — cache для dependencies, artifacts для outputs
build:
  cache:
    key: "$CI_COMMIT_REF_SLUG"
    paths:
      - .nuget/packages/
  artifacts:
    paths:
      - "**/bin/Release/"
    expire_in: 1 hour

# Плохо — only/except (deprecated) + нет DAG
build:
  stage: build
  only: [main, develop]
test:
  stage: test
  # ждёт ВСЕ jobs в build stage, даже ненужные

# Хорошо — rules + needs (DAG)
build:
  stage: build
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_MERGE_REQUEST_ID

test:unit:
  stage: test
  needs:
    - job: build
      artifacts: true
  # стартует сразу после build, не ждёт другие jobs
```

## .NET Pipeline — шаблон

```yaml
variables:
  NUGET_PACKAGES: "$CI_PROJECT_DIR/.nuget/packages"
  DOCKER_IMAGE: "$CI_REGISTRY_IMAGE"

stages: [validate, build, test, package, deploy]

.dotnet-cache: &dotnet-cache
  cache:
    key: "$CI_COMMIT_REF_SLUG"
    paths: [.nuget/packages/]

lint:
  stage: validate
  <<: *dotnet-cache
  image: mcr.microsoft.com/dotnet/sdk:8.0
  script:
    - dotnet format --verify-no-changes
  interruptible: true

build:
  stage: build
  <<: *dotnet-cache
  image: mcr.microsoft.com/dotnet/sdk:8.0
  script:
    - dotnet restore --locked-mode
    - dotnet build -c Release --no-restore
  artifacts:
    paths: ["**/bin/Release/"]
    expire_in: 1 hour
  interruptible: true

test:unit:
  stage: test
  <<: *dotnet-cache
  image: mcr.microsoft.com/dotnet/sdk:8.0
  needs: [build]
  script:
    - dotnet test --no-build -c Release --logger "trx" /p:CollectCoverage=true
  coverage: '/Total\s+\|\s+(\d+\.?\d*)%/'
  artifacts:
    reports:
      junit: "**/TestResults/*.trx"
      coverage_report:
        coverage_format: cobertura
        path: "**/coverage.cobertura.xml"
  interruptible: true

test:integration:
  stage: test
  needs: [build]
  image: mcr.microsoft.com/dotnet/sdk:8.0
  services: [postgres:15-alpine]
  variables:
    POSTGRES_DB: testdb
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  script:
    - dotnet test tests/Integration.Tests --no-build -c Release
  interruptible: true

docker-build:
  stage: package
  image: docker:latest
  services: [docker:dind]
  needs: [test:unit, test:integration]
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $DOCKER_IMAGE:$CI_COMMIT_SHA .
    - docker push $DOCKER_IMAGE:$CI_COMMIT_SHA
  rules:
    - if: $CI_COMMIT_BRANCH =~ /^(main|develop)$/

deploy-production:
  stage: deploy
  image: bitnami/kubectl:latest
  needs: [docker-build]
  script:
    - kubectl set image deployment/myapp myapp=$DOCKER_IMAGE:$CI_COMMIT_SHA -n production
    - kubectl rollout status deployment/myapp -n production
  environment:
    name: production
    url: https://example.com
  when: manual
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

## Оптимизация pipeline

| Проблема | Решение |
|----------|---------|
| Долгий restore | NuGet cache + `--locked-mode` |
| Всё ждёт build | `needs:` (DAG) для параллельных jobs |
| Тесты не нужны на каждый push | `rules: changes:` для monorepo |
| Медленный Docker build | BuildKit cache, multi-stage |
| Pipeline > 10 мин | `interruptible: true` + cancel outdated |

## Чек-лист

- [ ] Cache для NuGet, artifacts для build outputs
- [ ] `rules:` вместо `only:/except:`
- [ ] `needs:` для параллельных зависимостей
- [ ] `interruptible: true` на non-deploy jobs
- [ ] Protected + masked variables для secrets
- [ ] Manual deploy в production
- [ ] Coverage и test reports в artifacts
- [ ] `--locked-mode` для restore
