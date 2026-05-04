---
description: Конфигурация S3-бакета (регион, encryption, versioning, lifecycle, public access)
user-invocable: true
allowed-tools: Bash
argument-hint: "bucket-name [--profile name]"
---

# /s3-info

Показать конфигурацию бакета.

**Goal:** Понять, как настроен бакет -- регион, шифрование, versioning, lifecycle, доступность извне -- для аудита и диагностики.

**Output:** Сгруппированный отчёт: location (регион), default encryption (KMS / AES256 / нет), versioning (enabled/suspended/none), lifecycle rules (если есть), public access block (4 флага), bucket policy (есть/нет), object ownership.

**Scenarios:**

- `bucket-name` -- полный snapshot конфигурации (несколько `aws s3api get-bucket-*` вызовов).
- `--profile name` -- конкретный AWS-профиль.

**Constraints:**

- Требует `aws` CLI в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- Использует `aws s3api get-bucket-*` (read-only).
- Часть API-вызовов может вернуть `404 NoSuchConfiguration` -- это **нормально** (значит фича не настроена); не считать это ошибкой.
- Размер бакета и число объектов через `s3api` напрямую недоступны -- вывести предупреждение и предложить CloudWatch metric `BucketSizeBytes` или `s3 ls --recursive --summarize` (но дорого).
