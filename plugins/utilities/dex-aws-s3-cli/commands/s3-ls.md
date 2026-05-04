---
description: Список S3-бакетов или содержимого префикса через aws s3 ls
user-invocable: true
allowed-tools: Bash
argument-hint: "[s3://bucket[/prefix]] [--recursive] [--profile name] [--region name]"
---

# /s3-ls

Показать бакеты аккаунта или объекты по префиксу.

**Goal:** Быстро увидеть, что есть в S3 — список бакетов, содержимое папки, размеры.

**Output:** Без аргументов — список бакетов с датой создания. С `s3://bucket/prefix` — таблица: дата, размер, ключ. С `--recursive` — рекурсивный обход. В конце — общий размер и количество объектов.

**Scenarios:**

- Без аргументов — `aws s3 ls` (список бакетов аккаунта).
- `s3://bucket` — top-level содержимое бакета.
- `s3://bucket/prefix/` — содержимое префикса.
- `--recursive` — рекурсивный обход (внимательно: на больших бакетах долго).
- `--profile name` — конкретный AWS-профиль из `~/.aws/credentials`.
- `--region name` — переопределить регион.

**Constraints:**

- Требует `aws` CLI в PATH; если не найден — показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Параметры доступа: `~/.aws/credentials` / `~/.aws/config` или env (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` / `AWS_PROFILE` / `AWS_REGION`). Ключи не печатать в выводе.
- Read-only.
- Для больших бакетов `--recursive` может стоить денег (LIST API requests) и занимать время — упомянуть в выводе.
