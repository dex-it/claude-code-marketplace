---
name: jenkins
description: Jenkins - Jenkinsfile, стадии со своим agent, parallel, постоянные агенты, credentials, плагины. Активируется при jenkins, jenkinsfile, declarative pipeline, parallel stages, failFast, when beforeAgent, cleanWs, workspace, credentials scope, plugins, replay
---

# Jenkins - чек-лист

Пункт называет ситуацию, которую пайплайн проверяет.

- `when` со `branch` у стадии со своим `agent` без `beforeAgent true`
- `parallel` без `failFast true`, когда провал одной ветки обесценивает остальные
- Workspace постоянного агента без очистки
- Credentials, видимые всем пайплайнам контроллера
- Массовое обновление плагинов на рабочем Jenkins
- Правки через Replay, не перенесённые в Jenkinsfile
