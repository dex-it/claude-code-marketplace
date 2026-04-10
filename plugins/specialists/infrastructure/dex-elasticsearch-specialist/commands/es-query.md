---
description: Выполнение и анализ Elasticsearch запросов — поиск, агрегации, cluster health
allowed-tools: Bash, Read, Grep
argument-hint: "<query-text или index-name>"
---

# /es-query

Быстрый поиск и анализ данных в Elasticsearch.

**Goal:** Выполнить запрос к Elasticsearch и показать результаты с метриками производительности.

**Scenarios:**
- Текстовый запрос — поиск по полям с match/term, показать top hits
- Index name — информация об индексе: mapping, doc count, size, settings
- Без аргументов — cluster health overview: nodes, indices, shards, disk usage

**Output:** Результаты запроса в читаемом формате: hits count, took ms, top documents. Для index info — таблица с doc count, store size, replica count.

**Constraints:**
- Добавлять `"size": 10` к запросам по умолчанию (не вытягивать все документы)
- Для больших индексов использовать scroll API или search_after
- При ошибках — показать HTTP status и error reason
