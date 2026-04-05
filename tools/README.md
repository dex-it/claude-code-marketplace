# Tools

Dev-утилиты для Claude Code marketplace.

## validate-agent.js

Валидатор агентов, проверяющий соответствие [Agent Framework](../AGENT_FRAMEWORK.md).

### Что проверяет

**Frontmatter (errors):**

- Обязательные поля `name`, `description`, `tools`
- Запрещённое поле `allowed-tools` (не поддерживается Claude Code)
- Поле `skills:` — error если у агента есть фазы (мигрирован), warning если нет (ещё в старом формате)

**Frontmatter (warnings):**

- Description короче 50 символов
- Description не содержит слов «Триггеры» / «trigger» — Claude Code матчит агентов по ключевым словам
- Отсутствие `Skill` в `tools:` — агент не сможет императивно загружать skills

**Phase-level (errors, только для мигрированных агентов):**

- Каждая фаза должна иметь атрибут `**Goal:**`
- Каждая фаза должна иметь атрибут `**Exit criteria:**`
- Mandatory-фаза без обоснования (фреймворк требует объяснять «зачем mandatory»)

**Phase-level (warnings):**

- Агент без секций `## Phase N:` — не мигрирован во фреймворк (остальные phase-правила пропускаются)
- Exit criteria содержит фразы из чёрного списка («агент понял», «анализ завершён») — они описывают внутреннее состояние, а не observable outcome
- Фаза содержит нумерованный список из ≥4 пунктов — потенциально процедурное описание (фреймворк требует декларативный стиль)

**Skill references (warnings):**

- Упомянутый в теле агента плагин `dex-skill-X` отсутствует в `marketplace.json`

### Установка

Из корня репозитория:

```bash
npm install
```

Устанавливает dev-зависимости: `remark`, `gray-matter`, `unist-util-visit`. Папка `node_modules` игнорируется git, `package-lock.json` коммитится.

### Запуск

```bash
# Один файл
node tools/validate-agent.js plugins/specialists/dotnet/dex-dotnet-coder/agents/coding-assistant.md

# Все агенты в plugins/specialists/
node tools/validate-agent.js all

# Только errors (для CI — не блокировать на warnings)
node tools/validate-agent.js all --errors-only
```

Через npm scripts:

```bash
npm run validate              # node tools/validate-agent.js (все, с warnings)
npm run validate:all          # то же, явно "all"
npm run validate:errors       # только errors, для CI
```

### Коды возврата

- `0` — чисто (или есть только warnings при флаге `--errors-only`)
- `1` — найдена хотя бы одна ошибка
- `2` — только warnings (не блокирует без `--errors-only`)

### Как добавить новую проверку

1. Откройте `tools/validate-agent.js`
2. Найдите функцию `validateFrontmatter`, `validatePhases` или `validateSkillReferences` в зависимости от уровня проверки
3. Добавьте новое правило — push в `findings` с полями `level` (`ERROR` или `WARNING`), `rule` (kebab-case идентификатор) и `message`
4. Прогоните `node tools/validate-agent.js all` чтобы убедиться, что правило не создаёт массовых false positives на существующих агентах
5. Обновите этот README с описанием нового правила

### Ограничения текущей версии

В первой версии не реализованы:

- Проверка output → input цепочки между фазами (требует семантического анализа)
- Проверка дублирования содержимого skills в теле агента (требует парсинга SKILL.md)
- Проверка соответствия `tools:` во frontmatter реально используемым tools в теле агента

Эти проверки — кандидаты для второй версии после того, как фреймворк стабилизируется на большем количестве мигрированных агентов.
