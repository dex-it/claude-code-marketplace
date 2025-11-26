---
name: deploy
description: Deploy .NET application to target environment (staging/production)
---

# Deploy Command

Deploy a .NET application to the specified environment.

## Usage

```bash
/deploy [environment] [options]
```

## Arguments

- `environment` - Target environment: staging, production (default: staging)

## Options

- `--platform` - Deployment platform: kubernetes, docker, azure (default: kubernetes)
- `--namespace` - Kubernetes namespace (default: from environment)
- `--replicas` - Number of replicas (default: 3 for production, 1 for staging)
- `--dry-run` - Show what would be deployed without actually deploying

## What This Command Does

1. **Analyze Project**
   - Detect .NET project type (API, console, Blazor)
   - Find Docker image reference
   - Check existing deployment configuration

2. **Validate Prerequisites**
   - Check if Docker image exists
   - Verify deployment manifests
   - Validate configuration (ConfigMap/Secrets)
   - Check target environment availability

3. **Platform-Specific Deployment**

   ### Kubernetes
   - Apply/update Deployment manifest
   - Update Service if needed
   - Update Ingress if needed
   - Apply ConfigMaps and Secrets
   - Verify deployment rollout
   - Check pod health

   ### Docker
   - Pull latest image
   - Stop and remove old container
   - Start new container
   - Verify container health

   ### Azure
   - Deploy to Azure App Service or Container Instances
   - Update configuration
   - Verify deployment

4. **Verification**
   - Check deployment status
   - Verify pods are running (K8s)
   - Test health endpoints
   - Show deployment URL

5. **Rollback on Failure**
   - Automatically rollback if deployment fails
   - Restore previous version
   - Report failure reason

## Examples

```bash
# Deploy to staging
/deploy staging

# Deploy to production with 5 replicas
/deploy production --replicas 5

# Dry run for production deployment
/deploy production --dry-run

# Deploy to specific namespace
/deploy staging --namespace myapp-dev

# Deploy using Docker
/deploy staging --platform docker
```

## Environment Configuration

The command expects environment-specific configuration in:

### Kubernetes
- `k8s/overlays/staging/` - Staging configuration
- `k8s/overlays/production/` - Production configuration

### Docker Compose
- `docker-compose.staging.yml`
- `docker-compose.production.yml`

### Environment Variables
Should be configured as GitLab CI/CD variables or K8s Secrets:
- Connection strings
- API keys
- Feature flags
- Service endpoints

## Deployment Process

### For Staging

1. Pull latest image from registry
2. Apply Kubernetes manifests
3. Wait for rollout to complete
4. Run smoke tests
5. Report deployment status

### For Production

1. Verify staging deployment is healthy
2. Create backup/snapshot if needed
3. Apply manifests with rolling update strategy
4. Monitor rollout progress
5. Verify health checks pass
6. Run smoke tests
7. Report deployment status
8. Notify team (optional)

## Safety Mechanisms

- **Staging First**: Encourage deploying to staging before production
- **Manual Approval**: Production deployments require confirmation
- **Health Checks**: Verify application health before marking deployment successful
- **Rollback**: Automatic rollback on failed health checks
- **Backup**: Create backup before production deployment

## Integration with CI/CD

This command is designed to work in GitLab CI/CD pipelines:

```yaml
deploy-staging:
  stage: deploy
  script:
    - /deploy staging
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

deploy-production:
  stage: deploy
  script:
    - /deploy production
  environment:
    name: production
    url: https://example.com
  when: manual
  only:
    - main
```

## Kubernetes Deployment Strategy

Uses rolling update by default:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

This ensures:
- Zero downtime deployment
- New pods are ready before old ones are terminated
- Automatic rollback on failure

## Post-Deployment Checks

1. **Pod Status**: All pods are Running
2. **Health Checks**: Liveness and readiness probes pass
3. **HTTP Test**: Application responds on health endpoint
4. **Logs**: No critical errors in recent logs
5. **Metrics**: Resource usage is normal

## Troubleshooting

### Deployment Fails

1. Check pod status: `kubectl get pods -n <namespace>`
2. View pod logs: `kubectl logs <pod-name> -n <namespace>`
3. Describe pod: `kubectl describe pod <pod-name> -n <namespace>`
4. Check events: `kubectl get events -n <namespace>`

### Image Pull Errors

1. Verify image exists in registry
2. Check image pull secrets
3. Verify registry credentials

### Configuration Issues

1. Check ConfigMap: `kubectl get configmap -n <namespace>`
2. Verify Secret: `kubectl get secret -n <namespace>`
3. Check environment variables in pod

### Health Check Failures

1. Check application logs
2. Verify health endpoint configuration
3. Check probe configuration (timing, path)
4. Verify application is binding to correct port

## Rollback

If deployment fails, rollback using:

```bash
# Kubernetes
kubectl rollout undo deployment/<name> -n <namespace>

# Docker
docker-compose down
docker-compose -f docker-compose.<env>.yml up -d
```

## Success Criteria

Deployment is considered successful when:
1. All pods are in Running state (K8s)
2. Health checks pass
3. Application responds on expected endpoint
4. No error logs in last 5 minutes
5. Resource usage is within normal range

---

**Note**: This command should be used carefully in production. Always test in staging first!
