---
name: kubernetes
description: Kubernetes expertise for .NET deployments - Deployment, Service, Ingress, ConfigMap, Secrets, and resource management
allowed-tools: Read, Grep, Glob
---

# Kubernetes Skill

This skill provides deep knowledge of Kubernetes for deploying and managing .NET applications.

## When to Activate

Activate this skill when:
- User needs Kubernetes manifest help
- User wants to deploy to Kubernetes
- User asks about scaling or high availability
- User needs help with configuration management
- User asks about service networking
- User needs ingress/routing setup
- User wants monitoring and health checks

## Core Kubernetes Resources

### 1. Deployment

Manages application pods with desired state.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
  labels:
    app: myapp
    version: v1.0.0
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
        version: v1.0.0
    spec:
      containers:
      - name: myapp
        image: registry.example.com/myapp:1.0.0
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        env:
        - name: ASPNETCORE_ENVIRONMENT
          value: "Production"
        - name: ASPNETCORE_URLS
          value: "http://+:8080"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
```

### 2. Service

Exposes pods to network traffic.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: production
  labels:
    app: myapp
spec:
  type: ClusterIP  # or LoadBalancer, NodePort
  selector:
    app: myapp
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP
  sessionAffinity: ClientIP  # Optional: sticky sessions
```

### 3. Ingress

Routes external traffic to services.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp
  namespace: production
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp
            port:
              number: 80
```

### 4. ConfigMap

Non-sensitive configuration data.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
  namespace: production
data:
  appsettings.json: |
    {
      "Logging": {
        "LogLevel": {
          "Default": "Information"
        }
      },
      "FeatureFlags": {
        "NewFeature": true
      }
    }
  API_URL: "https://api.example.com"
  MAX_CONNECTIONS: "100"
```

Usage in Deployment:
```yaml
spec:
  containers:
  - name: myapp
    env:
    - name: API_URL
      valueFrom:
        configMapKeyRef:
          name: myapp-config
          key: API_URL
    volumeMounts:
    - name: config
      mountPath: /app/appsettings.json
      subPath: appsettings.json
      readOnly: true
  volumes:
  - name: config
    configMap:
      name: myapp-config
```

### 5. Secret

Sensitive configuration data.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
  namespace: production
type: Opaque
stringData:
  ConnectionStrings__Default: "Host=postgres;Database=myapp;Username=user;Password=pass"
  JwtSecret: "super-secret-key"
```

Usage:
```yaml
spec:
  containers:
  - name: myapp
    env:
    - name: ConnectionStrings__Default
      valueFrom:
        secretKeyRef:
          name: myapp-secrets
          key: ConnectionStrings__Default
```

### 6. HorizontalPodAutoscaler

Auto-scaling based on metrics.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
```

## Health Checks for .NET

### ASP.NET Core Setup

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy())
    .AddNpgSql(connectionString, tags: new[] { "ready" })
    .AddRedis(redisConnection, tags: new[] { "ready" });

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // No checks = always healthy
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

startupProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 0
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 30  # 5 minutes total
```

### Probe Types

- **livenessProbe**: Is the app running? Restart if fails
- **readinessProbe**: Is the app ready for traffic? Remove from service if fails
- **startupProbe**: Has the app started? Protects slow-starting apps

## Resource Management

### Resource Requests vs Limits

```yaml
resources:
  requests:
    memory: "256Mi"  # Guaranteed
    cpu: "100m"      # Guaranteed (0.1 CPU)
  limits:
    memory: "512Mi"  # Maximum allowed
    cpu: "500m"      # Maximum allowed (0.5 CPU)
```

### .NET-Specific Considerations

```yaml
# For typical ASP.NET Core API
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# For Blazor Server (WebSocket connections)
resources:
  requests:
    memory: "512Mi"
    cpu: "200m"
  limits:
    memory: "1Gi"
    cpu: "1000m"

# For background workers
resources:
  requests:
    memory: "128Mi"
    cpu: "50m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

### Quality of Service (QoS)

- **Guaranteed**: requests == limits (highest priority)
- **Burstable**: requests < limits (medium priority)
- **BestEffort**: no requests/limits (lowest priority, evicted first)

## Deployment Strategies

### 1. Rolling Update (Default)

```yaml
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Max 4 pods during update (3 + 1)
      maxUnavailable: 0  # Always maintain 3 pods
```

Benefits:
- Zero downtime
- Gradual rollout
- Easy rollback

### 2. Recreate

```yaml
spec:
  strategy:
    type: Recreate
```

Use when:
- Database migrations require downtime
- Cannot run multiple versions simultaneously

### 3. Blue-Green

Use labels and service selector:

```yaml
# Blue deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: myapp
        version: blue

---
# Service (initially points to blue)
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
    version: blue  # Switch to 'green' for deployment
```

### 4. Canary

```yaml
# Stable version (90%)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
spec:
  replicas: 9
  template:
    metadata:
      labels:
        app: myapp
        track: stable

---
# Canary version (10%)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: myapp
        track: canary

---
# Service (routes to both)
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp  # Matches both stable and canary
```

## Security Best Practices

### 1. SecurityContext

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
  - name: myapp
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL
      readOnlyRootFilesystem: true
```

### 2. NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: myapp-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: database
    ports:
    - protocol: TCP
      port: 5432
  - to:  # Allow DNS
    - namespaceSelector: {}
    ports:
    - protocol: UDP
      port: 53
```

### 3. PodSecurityPolicy (Deprecated) / Pod Security Standards

Use Pod Security Admission:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### 4. RBAC

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp
  namespace: production

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: myapp-role
  namespace: production
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: myapp-rolebinding
  namespace: production
subjects:
- kind: ServiceAccount
  name: myapp
roleRef:
  kind: Role
  name: myapp-role
  apiGroup: rbac.authorization.k8s.io
```

## Configuration Management

### 1. Environment Variables

```yaml
env:
- name: ASPNETCORE_ENVIRONMENT
  value: "Production"
- name: ASPNETCORE_URLS
  value: "http://+:8080"
```

### 2. ConfigMap

```yaml
env:
- name: API_URL
  valueFrom:
    configMapKeyRef:
      name: myapp-config
      key: API_URL
```

### 3. Secrets

```yaml
env:
- name: ConnectionStrings__Default
  valueFrom:
    secretKeyRef:
      name: myapp-secrets
      key: ConnectionStrings__Default
```

### 4. Volume Mounts

```yaml
volumeMounts:
- name: config
  mountPath: /app/appsettings.json
  subPath: appsettings.json
  readOnly: true
- name: secrets
  mountPath: /app/secrets
  readOnly: true

volumes:
- name: config
  configMap:
    name: myapp-config
- name: secrets
  secret:
    secretName: myapp-secrets
```

## Namespace Organization

### Multi-Environment Strategy

```yaml
# Development namespace
apiVersion: v1
kind: Namespace
metadata:
  name: dev
  labels:
    environment: dev

---
# Staging namespace
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    environment: staging

---
# Production namespace
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    environment: production
    pod-security.kubernetes.io/enforce: restricted
```

### Resource Quotas

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: dev
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    persistentvolumeclaims: "10"
```

### LimitRange

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
  namespace: dev
spec:
  limits:
  - max:
      cpu: "2"
      memory: "2Gi"
    min:
      cpu: "100m"
      memory: "128Mi"
    default:
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:
      cpu: "100m"
      memory: "256Mi"
    type: Container
```

## Persistence

### PersistentVolumeClaim

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myapp-data
  namespace: production
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: fast-ssd
```

Usage in Deployment:
```yaml
volumeMounts:
- name: data
  mountPath: /app/data

volumes:
- name: data
  persistentVolumeClaim:
    claimName: myapp-data
```

### StatefulSet (for databases, etc.)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

## Monitoring and Logging

### 1. Logging

```csharp
// Program.cs - Structured logging
builder.Logging.AddJsonConsole();
```

Kubernetes collects from stdout/stderr:
```bash
kubectl logs myapp-pod-name -n production
kubectl logs -f myapp-pod-name  # Follow
kubectl logs --since=1h myapp-pod-name  # Last hour
```

### 2. Prometheus Metrics

```csharp
// Add Prometheus metrics
builder.Services.AddOpenTelemetryMetrics(builder =>
{
    builder.AddPrometheusExporter();
    builder.AddAspNetCoreInstrumentation();
});

app.MapPrometheusScrapingEndpoint();
```

ServiceMonitor for Prometheus:
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp
  namespace: production
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### 3. Distributed Tracing

```csharp
builder.Services.AddOpenTelemetryTracing(builder =>
{
    builder
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddNpgsql()
        .AddJaegerExporter();
});
```

## GitLab CI/CD Integration

### Deployment Job

```yaml
deploy-production:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context $KUBE_CONTEXT
    - kubectl set image deployment/myapp myapp=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n production
    - kubectl rollout status deployment/myapp -n production
    - kubectl get pods -n production
  environment:
    name: production
    url: https://myapp.example.com
    on_stop: stop-production
  when: manual
  only:
    - main
```

### Using kubectl apply

```yaml
deploy:
  script:
    - kubectl apply -f k8s/namespace.yaml
    - kubectl apply -f k8s/configmap.yaml
    - kubectl apply -f k8s/secret.yaml
    - kubectl apply -f k8s/deployment.yaml
    - kubectl apply -f k8s/service.yaml
    - kubectl apply -f k8s/ingress.yaml
    - kubectl rollout status deployment/myapp -n production
```

### Using Kustomize

```yaml
deploy:
  script:
    - kubectl apply -k k8s/overlays/production
    - kubectl rollout status deployment/myapp -n production
```

## Kustomize for Environment Management

### Directory Structure

```
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── kustomization.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml
    │   └── patches/
    ├── staging/
    │   ├── kustomization.yaml
    │   └── patches/
    └── production/
        ├── kustomization.yaml
        └── patches/
```

### Base kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml

commonLabels:
  app: myapp
```

### Overlay kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: production

bases:
  - ../../base

replicas:
  - name: myapp
    count: 3

images:
  - name: myapp
    newName: registry.example.com/myapp
    newTag: 1.0.0

configMapGenerator:
  - name: myapp-config
    behavior: merge
    literals:
      - ASPNETCORE_ENVIRONMENT=Production
```

## Troubleshooting

### Common Commands

```bash
# Check pod status
kubectl get pods -n production

# Describe pod (events, conditions)
kubectl describe pod myapp-pod -n production

# View logs
kubectl logs myapp-pod -n production
kubectl logs -f myapp-pod -n production  # Follow
kubectl logs --previous myapp-pod -n production  # Previous container

# Execute commands
kubectl exec -it myapp-pod -n production -- /bin/bash

# Port forward for debugging
kubectl port-forward myapp-pod 8080:8080 -n production

# Check rollout status
kubectl rollout status deployment/myapp -n production

# View rollout history
kubectl rollout history deployment/myapp -n production

# Rollback
kubectl rollout undo deployment/myapp -n production
kubectl rollout undo deployment/myapp --to-revision=3 -n production
```

### Common Issues

1. **CrashLoopBackOff**
   - Check logs: `kubectl logs pod-name`
   - Check probes: Too aggressive timing?
   - Check resources: OOMKilled?

2. **ImagePullBackOff**
   - Check image name and tag
   - Check image pull secrets
   - Verify registry access

3. **Pending**
   - Check resources: Not enough CPU/memory?
   - Check node affinity
   - Check PVC binding

4. **Failing Probes**
   - Check probe configuration (path, port, timing)
   - Check app startup time
   - Check health endpoint implementation

Remember: Always test in dev/staging before production!
