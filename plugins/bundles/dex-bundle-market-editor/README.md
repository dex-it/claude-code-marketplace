# Bundle: dex-bundle-market-editor

Бандл для того, кто правит **сам каталог**, а не работает с его плагинами: автор скилла, агента или
команды, редактор маркетплейса. Отличается от ролевых бандлов предметом - предмет здесь артефакт
каталога (`SKILL.md`, `agents/*.md`, `commands/*.md`), а нормы, по которым он судится, живут в
`docs/` каталога и вместе с плагином не устанавливаются. Поэтому его состав и не едет в бандлы
разработчика: у пользователя нормы неприменимы, а работа над каталогом идёт в локальном клоне.

Цикл автора: правка артефакта -> `optimize-for-llm` (переписать под LLM без потери нормативной силы)
-> `fact-verification` (сверить утверждения об инструментах) -> `artifact-review` (ревью по осям
фреймворка) -> `npm run validate && npm test`. Отдельная ветка - `/mr-collect` -> `/mr-analyze` ->
`/mr-apply`: уроки из чужих MR превращаются в предложения по скиллам и агентам каталога.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh market-editor

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 market-editor

# Preview без установки
./install-bundle/install-bundle.sh market-editor --dry-run
```

## Uninstallation

```bash
./install-bundle/uninstall-bundle.sh market-editor
.\install-bundle\uninstall-bundle.ps1 market-editor
```

## Included Components

Полный состав - `bundle.json` (`includes[]`).

### Skills
- `dex-skill-artifact-review` - ревью артефакта каталога по обязательным осям: соответствие
  фреймворку, fact-check, полезность против целей продукта, лаконичность, сверка с гайдом модели
- `dex-skill-optimize-for-llm` - переписать инструкцию под модель: срезать воду и дубли, сохранить
  нормативную силу, грабли и поле срабатывания
- `dex-skill-fact-verification` - сверка утверждений об инструментах и API первоисточником; ось
  fact-check у `artifact-review` держится на нём

### Utility
- `dex-knowledge-extractor` - `/mr-collect`, `/mr-analyze`, `/mr-apply`: review-комментарии чужих MR
  -> обобщённые предложения для skills и агентов -> применение с саморевью и валидацией

## Замечания

- `dex-skill-optimize-for-llm` едет также в бандлах `code-review`, `dotnet-developer` и
  `dotnet-fullstack`: он применим к любой инструкции, не только к артефакту каталога. Пересечение
  составов бандлов - норма, установка плоская.
- Оси `artifact-review` ссылаются на `docs/SKILL_FRAMEWORK.md`, `docs/AGENT_FRAMEWORK.md` и
  `docs/COMMAND_FRAMEWORK.md` **каталога**. Они разрешаются в локальном клоне репозитория; вне его
  скилл теряет нормативный дом цифр и лимитов.
- Ревьюер-агенты каталога (`dex-mr-reviewer`, `dex-mr-check-reviewer`, `dex-self-reviewer`)
  `artifact-review` не грузят: для артефактов каталога он и есть ревьюер, и вызывается напрямую.
