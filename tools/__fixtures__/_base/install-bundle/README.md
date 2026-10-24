# Fixture Installer

Установщик фикстурного каталога: нужен таблице снятых плагинов, которую судит `validate-readme.js`.

## Renamed and removed plugins (manual step)

| Removed | Replacement | Notes |
|---|---|---|
| `dex-skill-fixture-gone` | - | снят: имя в каталоге больше не объявлено |
| `dex-skill-fixture-old`, `dex-skill-fixture-older` | `dex-skill-fixture` | переименован дважды, обе старые формы сняты |

Образец строки в код-блоке таблицей не считается:

```markdown
| Removed | Replacement | Notes |
|---|---|---|
| `dex-fixture-specialist` | - | образец |
```
