---
name: gitlab-ci
description: GitLab CI/CD - пайплайн .gitlab-ci.yml, повторные push в ветку. Активируется при gitlab ci, .gitlab-ci.yml, pipeline, gitlab runner, merge request pipeline, interruptible, auto-cancel redundant pipelines, jobs, stages, artifacts, повторные push
---

# GitLab CI - чек-лист

Пункт называет ситуацию, которую пайплайн проверяет.

- Джобы без `interruptible`, когда повторные push копят параллельные пайплайны
