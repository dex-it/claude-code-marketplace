---
name: gitlab-ci
description: Expert knowledge about GitLab CI/CD - stages, jobs, artifacts, caching, and pipeline optimization
allowed-tools: Read, Grep, Glob
---

# GitLab CI/CD Skill

This skill provides deep knowledge of GitLab CI/CD for .NET projects.

## When to Activate

Activate this skill when:
- User asks about GitLab CI/CD configuration
- User needs help with `.gitlab-ci.yml`
- User wants to optimize pipeline performance
- User asks about CI/CD best practices
- User needs to set up artifacts or caching
- User wants to implement deployment pipelines

## Core Concepts

### Pipeline Structure

```yaml
stages:
  - validate
  - build
  - test
  - package
  - deploy
```

Each stage runs sequentially, jobs within a stage run in parallel.

### Job Anatomy

```yaml
job-name:
  stage: stage-name
  image: docker-image
  services:
    - docker:dind
  before_script:
    - setup commands
  script:
    - main commands
  after_script:
    - cleanup commands
  artifacts:
    paths:
      - path/to/artifacts
    expire_in: 1 hour
  cache:
    key: cache-key
    paths:
      - path/to/cache
  only:
    - branches
  except:
    - tags
  when: on_success
  allow_failure: false
  retry: 2
  timeout: 1h
```

## GitLab CI/CD Variables

### Predefined Variables

Important predefined variables:
- `$CI_COMMIT_SHA` - Commit hash
- `$CI_COMMIT_REF_NAME` - Branch or tag name
- `$CI_COMMIT_REF_SLUG` - Branch name (URL-safe)
- `$CI_PROJECT_DIR` - Project directory
- `$CI_REGISTRY` - GitLab Container Registry URL
- `$CI_REGISTRY_IMAGE` - Full image path
- `$CI_REGISTRY_USER` - Registry username
- `$CI_REGISTRY_PASSWORD` - Registry password
- `$CI_PIPELINE_ID` - Pipeline ID
- `$CI_JOB_ID` - Job ID
- `$CI_COMMIT_BRANCH` - Branch name (not for tags)
- `$CI_COMMIT_TAG` - Tag name (only for tags)
- `$CI_MERGE_REQUEST_ID` - MR number

### Custom Variables

Define in `.gitlab-ci.yml`:
```yaml
variables:
  DOTNET_VERSION: "8.0"
  PROJECT_PATH: "src/MyApp"
  DOCKER_IMAGE: "$CI_REGISTRY_IMAGE"
```

Or in GitLab UI under Settings > CI/CD > Variables:
- Regular variables
- Protected variables (only for protected branches)
- Masked variables (hidden in logs)
- File variables (content written to file)

## Stages Deep Dive

### 1. Validate Stage

Code quality and security checks:
```yaml
lint:
  stage: validate
  image: mcr.microsoft.com/dotnet/sdk:8.0
  script:
    - dotnet format --verify-no-changes
    - dotnet build --no-incremental

security-scan:
  stage: validate
  image: mcr.microsoft.com/dotnet/sdk:8.0
  script:
    - dotnet list package --vulnerable --include-transitive
    - dotnet list package --deprecated
  allow_failure: true
```

### 2. Build Stage

Compile the application:
```yaml
build:
  stage: build
  image: mcr.microsoft.com/dotnet/sdk:8.0
  script:
    - dotnet restore
    - dotnet build -c Release --no-restore
  artifacts:
    paths:
      - "**/bin/Release/"
    expire_in: 1 hour
  cache:
    key: "$CI_COMMIT_REF_SLUG"
    paths:
      - .nuget/packages/
```

### 3. Test Stage

Run tests with coverage:
```yaml
test:unit:
  stage: test
  image: mcr.microsoft.com/dotnet/sdk:8.0
  script:
    - dotnet test tests/Unit.Tests --logger "trx;LogFileName=test-results.trx" /p:CollectCoverage=true
  coverage: '/Total\s+\|\s+(\d+\.?\d*)%/'
  artifacts:
    reports:
      junit: "**/test-results.trx"
      coverage_report:
        coverage_format: cobertura
        path: "**/coverage.cobertura.xml"

test:integration:
  stage: test
  image: mcr.microsoft.com/dotnet/sdk:8.0
  services:
    - postgres:15-alpine
  variables:
    POSTGRES_DB: testdb
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  script:
    - dotnet test tests/Integration.Tests
```

### 4. Package Stage

Build Docker images:
```yaml
docker-build:
  stage: package
  image: docker:latest
  services:
    - docker:dind
  variables:
    DOCKER_TLS_CERTDIR: "/certs"
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker build -t $CI_REGISTRY_IMAGE:latest .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - develop
    - main
```

### 5. Deploy Stage

Deploy to environments:
```yaml
deploy-staging:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl set image deployment/myapp myapp=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n staging
    - kubectl rollout status deployment/myapp -n staging
  environment:
    name: staging
    url: https://staging.example.com
    on_stop: stop-staging
  only:
    - develop

deploy-production:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl set image deployment/myapp myapp=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n production
    - kubectl rollout status deployment/myapp -n production
  environment:
    name: production
    url: https://example.com
  when: manual
  only:
    - main
```

## Artifacts

### Types of Artifacts

1. **Build Artifacts**
   ```yaml
   artifacts:
     paths:
       - bin/Release/
     expire_in: 1 hour
   ```

2. **Test Reports**
   ```yaml
   artifacts:
     reports:
       junit: "**/test-results.trx"
   ```

3. **Coverage Reports**
   ```yaml
   artifacts:
     reports:
       coverage_report:
         coverage_format: cobertura
         path: "**/coverage.cobertura.xml"
   ```

4. **Docker Images** (via registry, not files)

### Artifact Best Practices

- Set appropriate expiration times
- Only save necessary files
- Use artifacts for inter-stage dependencies
- Don't save NuGet packages (use cache instead)

## Caching

### NuGet Cache

```yaml
cache:
  key: "$CI_COMMIT_REF_SLUG"
  paths:
    - .nuget/packages/

variables:
  NUGET_PACKAGES: "$CI_PROJECT_DIR/.nuget/packages"

before_script:
  - export NUGET_PACKAGES=$CI_PROJECT_DIR/.nuget/packages
```

### Cache Strategies

1. **Per-branch cache**
   ```yaml
   cache:
     key: "$CI_COMMIT_REF_SLUG"
   ```

2. **Global cache**
   ```yaml
   cache:
     key: "global"
   ```

3. **Per-job cache**
   ```yaml
   cache:
     key: "$CI_JOB_NAME"
   ```

4. **Pull-push policy**
   ```yaml
   cache:
     key: "$CI_COMMIT_REF_SLUG"
     policy: pull-push  # or pull, or push
   ```

### Cache vs Artifacts

- **Cache**: Dependencies, packages (NuGet, npm)
- **Artifacts**: Build outputs, test results

## Job Control

### Conditional Execution

```yaml
# Only for specific branches
only:
  - main
  - develop

# Except specific branches
except:
  - /^temp-.*/

# Rules (more powerful)
rules:
  - if: $CI_COMMIT_BRANCH == "main"
  - if: $CI_MERGE_REQUEST_ID
  - if: $CI_COMMIT_TAG
```

### When Clauses

```yaml
when: on_success  # Default
when: on_failure  # Only if previous job failed
when: always      # Always run
when: manual      # Require manual trigger
when: delayed     # Delay execution
  start_in: 30 minutes
```

### Dependencies

```yaml
deploy:
  stage: deploy
  dependencies:
    - build
    - test
  script:
    - ./deploy.sh
```

### Needs (DAG)

```yaml
test:
  stage: test
  needs:
    - job: build
      artifacts: true
```

## Optimization Strategies

### 1. Parallel Jobs

Run independent jobs in parallel:
```yaml
test:unit:
  stage: test
  script:
    - dotnet test tests/Unit.Tests

test:integration:
  stage: test
  script:
    - dotnet test tests/Integration.Tests
```

### 2. Matrix Builds

Test multiple configurations:
```yaml
test:
  stage: test
  parallel:
    matrix:
      - DOTNET_VERSION: ["6.0", "7.0", "8.0"]
  image: mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION}
  script:
    - dotnet test
```

### 3. Job Templates

Use YAML anchors:
```yaml
.build-template: &build-template
  image: mcr.microsoft.com/dotnet/sdk:8.0
  before_script:
    - dotnet restore

build:
  <<: *build-template
  stage: build
  script:
    - dotnet build
```

### 4. Include External Files

```yaml
include:
  - local: '.gitlab/ci/build.yml'
  - template: Security/SAST.gitlab-ci.yml
  - remote: 'https://example.com/ci-templates/dotnet.yml'
```

### 5. Interruptible Jobs

Allow jobs to be interrupted:
```yaml
build:
  interruptible: true
  script:
    - dotnet build
```

## Security Best Practices

### 1. Masked Variables

Define in GitLab UI with "Mask variable" enabled.

### 2. Protected Variables

Use protected variables for production secrets.

### 3. No Secrets in Logs

```yaml
script:
  - echo "Connection string is $CONNECTION_STRING"  # BAD
  - ./deploy.sh  # GOOD (secret used in script)
```

### 4. Vulnerability Scanning

```yaml
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml
  - template: Security/Container-Scanning.gitlab-ci.yml
```

### 5. Minimal Permissions

Use least-privilege service accounts for deployments.

## Environments

### Environment Configuration

```yaml
deploy-staging:
  environment:
    name: staging
    url: https://staging.example.com
    on_stop: stop-staging
    auto_stop_in: 1 week
```

### Deployment Strategies

1. **Continuous Deployment**
   ```yaml
   deploy:
     stage: deploy
     script: ./deploy.sh
     only:
       - main
   ```

2. **Manual Deployment**
   ```yaml
   deploy:
     stage: deploy
     script: ./deploy.sh
     when: manual
   ```

3. **Timed Deployment**
   ```yaml
   deploy:
     stage: deploy
     script: ./deploy.sh
     when: delayed
     start_in: 30 minutes
   ```

## Pipeline Efficiency Metrics

Monitor these metrics:
- **Total pipeline duration** - Target: < 10 minutes
- **Job durations** - Identify bottlenecks
- **Cache hit rate** - Should be > 80%
- **Artifact size** - Minimize to speed up downloads
- **Parallelization** - Maximize parallel jobs

## Common Patterns

### Multi-Environment Pipeline

```yaml
stages:
  - build
  - test
  - deploy

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE

build:
  stage: build
  script:
    - docker build -t $DOCKER_IMAGE:$CI_COMMIT_SHA .
    - docker push $DOCKER_IMAGE:$CI_COMMIT_SHA

test:
  stage: test
  script:
    - dotnet test

.deploy-template: &deploy-template
  stage: deploy
  script:
    - kubectl set image deployment/myapp myapp=$DOCKER_IMAGE:$CI_COMMIT_SHA -n $ENVIRONMENT

deploy-dev:
  <<: *deploy-template
  variables:
    ENVIRONMENT: dev
  environment:
    name: dev
  only:
    - develop

deploy-staging:
  <<: *deploy-template
  variables:
    ENVIRONMENT: staging
  environment:
    name: staging
  only:
    - develop

deploy-production:
  <<: *deploy-template
  variables:
    ENVIRONMENT: production
  environment:
    name: production
  when: manual
  only:
    - main
```

### Monorepo Pattern

Build only changed projects:
```yaml
build:api:
  script:
    - dotnet build src/Api
  only:
    changes:
      - src/Api/**/*
      - src/Common/**/*

build:worker:
  script:
    - dotnet build src/Worker
  only:
    changes:
      - src/Worker/**/*
      - src/Common/**/*
```

## Debugging Tips

### View Pipeline Details

1. Check pipeline status in GitLab UI
2. View job logs
3. Download artifacts
4. Check job variables
5. Review retry history

### Common Issues

1. **Job stuck**: Check runner availability
2. **Cache issues**: Clear cache, check cache key
3. **Artifact not found**: Check job dependencies
4. **Image pull errors**: Check registry credentials
5. **Script failures**: Check command syntax, permissions

### Debug Mode

Enable debug logging:
```yaml
variables:
  CI_DEBUG_TRACE: "true"
```

## Integration with .NET

### Restore and Build

```yaml
before_script:
  - dotnet restore --locked-mode

script:
  - dotnet build -c Release --no-restore
  - dotnet test --no-build
  - dotnet publish -c Release --no-build -o ./publish
```

### Version from Git Tag

```yaml
script:
  - VERSION=${CI_COMMIT_TAG:-"0.0.0-dev"}
  - dotnet build /p:Version=$VERSION
  - dotnet pack /p:PackageVersion=$VERSION
```

### NuGet Package Publishing

```yaml
publish-nuget:
  stage: deploy
  script:
    - dotnet pack -c Release
    - dotnet nuget push **/*.nupkg -s https://api.nuget.org/v3/index.json -k $NUGET_API_KEY
  only:
    - tags
```

Remember: Always optimize for speed, security, and maintainability!
