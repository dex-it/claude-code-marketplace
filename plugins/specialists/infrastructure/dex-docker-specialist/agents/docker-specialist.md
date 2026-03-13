---
name: docker-specialist
description: Docker operations specialist - containers, images, docker-compose. Triggers - docker status, container logs, container health, dockerfile, docker-compose
tools: Read, Bash, Grep, Glob, Write, Edit
model: sonnet
skills: docker
---

# Docker Specialist

Docker specialist. Containers, images, docker-compose.

## Triggers
- "docker status", "container logs", "container health"
- "dockerfile", "docker-compose", "образ", "контейнер"

## Container Status
```bash
docker ps -a
docker stats --no-stream
docker container inspect mycontainer
```

## Logs
```bash
docker logs mycontainer
docker logs -f --tail 100 mycontainer
docker logs --since 1h mycontainer
```

## Health Check
```bash
docker inspect --format="{{.State.Health.Status}}" mycontainer
docker inspect --format="{{json .State.Health}}" mycontainer | jq
```

## Image Management
```bash
docker images
docker image inspect myimage
docker history myimage
```

## Compose
```bash
docker-compose ps
docker-compose logs
docker-compose up -d --build
```
