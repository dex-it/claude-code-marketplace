---
description: Метаданные конкретного S3-объекта через aws s3api head-object
user-invocable: true
allowed-tools: Bash
argument-hint: "s3://bucket/key [--version-id id] [--profile name]"
---

# /s3-head

Показать метаданные одного объекта.

**Goal:** Узнать размер, content-type, дату модификации, ETag, storage class, KMS-ключ, custom metadata конкретного объекта — без скачивания.

**Output:** Таблица полей: ContentLength (size), ContentType, LastModified, ETag, StorageClass, ServerSideEncryption (+ KMS key id), VersionId (если versioning включён), Metadata (`x-amz-meta-*` пользовательские), CacheControl, ContentEncoding.

**Scenarios:**

- `s3://bucket/key` — head конкретного объекта.
- `--version-id id` — конкретная версия (если versioning включён).
- `--profile name` — конкретный AWS-профиль.

**Constraints:**

- Требует `aws` CLI в PATH; если не найден — показать инструкцию установки.
- Использует `aws s3api head-object` (read-only).
- При `404 NoSuchKey` — сообщить и предложить `/s3-ls s3://bucket/prefix/` для поиска.
- При `403 Forbidden` — диагностировать как permission issue (RoleArn / bucket policy / ACL); не считать что объекта нет.
