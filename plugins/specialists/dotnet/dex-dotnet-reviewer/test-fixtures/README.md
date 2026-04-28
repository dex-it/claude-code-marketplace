# Test fixtures для /mr-apply

Каталог тестовых analyze.md для разработки и регрессии команды `/mr-apply`.

| Файл | Сценарий | Ожидаемый исход |
|------|----------|-----------------|
| analyze-skill-addition.md | Новая ловушка в существующий skill | Applied: 1 |
| analyze-new-skill.md | Создание нового skill | Applied: 1, files: 3 (SKILL.md, plugin.json, marketplace.json) |
| analyze-agent-change.md | Правка фазы агента | Applied: 1 |
| analyze-mixed.md | Микс типов | Applied: 3, Skipped: 1, Dropped: 1 |
| analyze-self-review-fail.md | Имя конкретного проекта | Applied: 0, Skipped: 1 (self-review failed) |

## Запуск (ручной, после имплементации команды)

```bash
cd /home/mmx/Work/claude-market/claude-code-marketplace
git stash  # сохранить рабочее дерево
claude -p "/mr-apply $(pwd)/plugins/specialists/dotnet/dex-dotnet-reviewer/test-fixtures/analyze-skill-addition.md"
git diff   # посмотреть что применилось
git checkout .  # откатить
git stash pop
```
