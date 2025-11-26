---
name: pipeline
description: Create or update GitLab CI/CD pipeline configuration (.gitlab-ci.yml)
---

# Pipeline Command

Create or update a GitLab CI/CD pipeline configuration for a .NET project.

## Usage

```bash
/pipeline [options]
```

## Options

- `--type` - Project type: api, console, blazor, library (auto-detected if not specified)
- `--deploy` - Include deployment stages: none, docker, kubernetes, azure (default: kubernetes)
- `--test` - Include test coverage: true/false (default: true)
- `--cache` - Enable NuGet caching: true/false (default: true)
- `--lint` - Include code quality checks: true/false (default: true)
- `--security` - Include security scanning: true/false (default: true)

## What This Command Does

1. **Project Analysis**
   - Detect .NET project type (API, console, library, Blazor)
   - Find solution/project files
   - Identify test projects
   - Check for existing Docker configuration

2. **Pipeline Design**
   - Create appropriate stages (validate, build, test, package, deploy)
   - Configure jobs with proper dependencies
   - Set up caching for NuGet packages
   - Configure artifacts and reports
   - Add parallel execution where possible

3. **Generate .gitlab-ci.yml**
   - Create complete pipeline configuration
   - Add comments for clarity
   - Include best practices
   - Configure environment-specific jobs

4. **Validation**
   - Check YAML syntax
   - Verify job dependencies
   - Validate script commands
   - Ensure proper variable usage

## Pipeline Stages

### Standard Pipeline

```
validate → build → test → package → deploy-staging → deploy-production
```

### Stage Descriptions

1. **validate** - Code quality, linting, security scanning
2. **build** - Compile .NET projects
3. **test** - Run unit and integration tests
4. **package** - Build Docker image (if applicable)
5. **deploy-staging** - Deploy to staging environment
6. **deploy-production** - Deploy to production (manual trigger)

## Generated Configuration

### Basic API Project

```yaml
variables:
  DOTNET_VERSION: "8.0"
  PROJECT_PATH: "src/MyApp.Api"
  DOCKER_IMAGE: "$CI_REGISTRY_IMAGE"

stages:
  - validate
  - build
  - test
  - package
  - deploy

# Cache NuGet packages
cache:
  key: "$CI_COMMIT_REF_SLUG"
  paths:
    - .nuget/packages/

validate:
  stage: validate
  image: mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION}
  script:
    - dotnet format --verify-no-changes
    - dotnet build --no-incremental --verify-no-changes
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "develop"
    - if: $CI_COMMIT_BRANCH == "main"

build:
  stage: build
  image: mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION}
  script:
    - dotnet restore
    - dotnet build -c Release --no-restore
  artifacts:
    paths:
      - "**/bin/Release/"
    expire_in: 1 hour

test:
  stage: test
  image: mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION}
  script:
    - dotnet test -c Release --no-build --logger "trx;LogFileName=test-results.trx" /p:CollectCoverage=true
  coverage: '/Total\s+\|\s+(\d+\.?\d*)%/'
  artifacts:
    reports:
      junit: "**/test-results.trx"
      coverage_report:
        coverage_format: cobertura
        path: "**/coverage.cobertura.xml"

docker-build:
  stage: package
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $DOCKER_IMAGE:$CI_COMMIT_SHA -t $DOCKER_IMAGE:latest .
    - docker push $DOCKER_IMAGE:$CI_COMMIT_SHA
    - docker push $DOCKER_IMAGE:latest
  only:
    - develop
    - main

deploy-staging:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context $KUBE_CONTEXT
    - kubectl set image deployment/myapp myapp=$DOCKER_IMAGE:$CI_COMMIT_SHA -n staging
    - kubectl rollout status deployment/myapp -n staging
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

deploy-production:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context $KUBE_CONTEXT
    - kubectl set image deployment/myapp myapp=$DOCKER_IMAGE:$CI_COMMIT_SHA -n production
    - kubectl rollout status deployment/myapp -n production
  environment:
    name: production
    url: https://example.com
  when: manual
  only:
    - main
```

### With Security Scanning

Adds security scanning job:
```yaml
security-scan:
  stage: validate
  image: mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION}
  script:
    - dotnet list package --vulnerable --include-transitive
    - dotnet list package --deprecated
  allow_failure: true
```

### With Code Coverage

Enhanced test job with coverage:
```yaml
test:
  stage: test
  image: mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION}
  script:
    - dotnet test /p:CollectCoverage=true /p:CoverageReportFormat=cobertura
    - dotnet tool install -g dotnet-reportgenerator-globaltool
    - reportgenerator -reports:"**/coverage.cobertura.xml" -targetdir:"coveragereport" -reporttypes:Html
  coverage: '/Total\s+\|\s+(\d+\.?\d*)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: "**/coverage.cobertura.xml"
    paths:
      - coveragereport/
```

## Project Type Variations

### Console Application

Simplified pipeline without deployment:
- No Docker build stage
- No deployment stages
- Publish artifacts instead

### Library/NuGet Package

Pipeline for NuGet package:
- Build and test stages
- Pack NuGet package
- Push to NuGet registry

### Blazor Application

Pipeline with static file handling:
- Build Blazor client
- Build server (if BlazorServer)
- Include wwwroot in Docker image

### Microservices Solution

Pipeline for multiple projects:
- Build all projects in parallel
- Run all test projects
- Build multiple Docker images
- Deploy services independently

## Optimization Features

### Parallel Execution

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

### Conditional Jobs

Run jobs based on conditions:
```yaml
deploy-staging:
  script: ...
  only:
    - develop
  except:
    - schedules

deploy-production:
  script: ...
  only:
    - main
  when: manual
```

### Retry Logic

Retry flaky tests:
```yaml
test:
  script:
    - dotnet test
  retry:
    max: 2
    when:
      - runner_system_failure
      - stuck_or_timeout_failure
```

## Environment Variables

Required variables (set in GitLab):
- `CI_REGISTRY_USER` - Docker registry username (provided by GitLab)
- `CI_REGISTRY_PASSWORD` - Docker registry password (provided by GitLab)
- `KUBE_CONTEXT` - Kubernetes context for deployment
- `KUBECONFIG` - Kubernetes config file (as CI/CD variable)

Optional variables:
- `DOCKER_IMAGE` - Custom Docker image name
- `ASPNETCORE_ENVIRONMENT` - Environment name
- `CONNECTION_STRING` - Database connection string

## Best Practices Applied

1. **Caching**: NuGet packages cached between jobs
2. **Artifacts**: Build outputs shared between stages
3. **Reports**: Test results and coverage reported to GitLab
4. **Security**: No secrets in logs, use masked variables
5. **Performance**: Parallel jobs where possible
6. **Reliability**: Proper job dependencies, retry logic
7. **Maintainability**: Clear job names, comments, DRY principle

## Integration with Other Tools

### SonarQube

Add code quality analysis:
```yaml
sonarqube:
  stage: validate
  image: mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION}
  script:
    - dotnet sonarscanner begin /k:"project-key" /d:sonar.host.url="$SONAR_HOST_URL"
    - dotnet build
    - dotnet sonarscanner end
```

### SAST (Static Application Security Testing)

GitLab SAST integration:
```yaml
include:
  - template: Security/SAST.gitlab-ci.yml

variables:
  SAST_EXCLUDED_PATHS: "tests/, specs/"
```

### Dependency Scanning

Scan dependencies for vulnerabilities:
```yaml
include:
  - template: Security/Dependency-Scanning.gitlab-ci.yml
```

## Examples

```bash
# Generate pipeline for API project with Kubernetes deployment
/pipeline --type api --deploy kubernetes

# Generate pipeline for console app without deployment
/pipeline --type console --deploy none

# Generate pipeline with full security scanning
/pipeline --security true

# Generate simple pipeline without tests
/pipeline --test false --deploy none

# Generate pipeline for library with NuGet publish
/pipeline --type library
```

## After Generation

1. **Review Configuration**
   - Check all stages and jobs
   - Verify variable names
   - Update image tags
   - Adjust resource limits

2. **Configure CI/CD Variables**
   - Set required secrets in GitLab
   - Configure environment variables
   - Add Kubernetes credentials

3. **Test Pipeline**
   - Push to feature branch
   - Verify all jobs pass
   - Check artifacts and reports
   - Test deployment to staging

4. **Optimize**
   - Monitor job durations
   - Adjust cache configuration
   - Add parallel jobs if needed
   - Fine-tune retry logic

## Troubleshooting

### Build Failures

- Check .NET SDK version
- Verify project paths
- Check NuGet package restore
- Review build logs

### Test Failures

- Check test configuration
- Verify test project references
- Check test output format
- Review coverage settings

### Docker Build Failures

- Check Dockerfile exists
- Verify Docker-in-Docker service
- Check registry credentials
- Review Docker build logs

### Deployment Failures

- Verify Kubernetes credentials
- Check namespace exists
- Verify deployment manifests
- Check image pull secrets

---

**Note**: Generated pipeline should be reviewed and customized based on project-specific requirements!
