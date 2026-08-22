# dex-requirements-reviewer

Ревьюер чужого готового набора требований по рецепту **Reviewer**. Предмет ревью - документ (BRD, эпик, набор stories с AC), а не код и не diff. Агент судит: выносит дефекты с цитатой из текста, калибрует severity, формулирует правку автору. Порождение требований - зона `/feature` (трек `dex-skill-analytics-track`), не этого плагина.

## Команда

`/review-requirements <путь к BRD/stories> [путь к источнику]` - согласование чужих требований. Источник (исходный BRD, цели, запрос заказчика) опционален: без него оси полноты и трассировки набора закрываются статусом `n/a`, остальные оси прогоняются как обычно.

## Архитектура

Команда тонкая и делегирует агенту `requirements-reviewer` с явной передачей `mode: interactive`. Десять фаз: Context and Input Acceptance -> Domain Priming -> Direct Analysis (единица) -> Set Analysis (набор) -> Fact Verification -> Cross-Linking -> Severity Calibration -> Deferred Decision Triage -> Output Labeling -> Report.

Set Analysis занимает в этом агенте место, которое в code-ревьюерах занимает Skill-Based Deep Scan: предмет - документ, а не стек, поэтому глубину даёт оракул набора, а не профильные skills по языку.

**Входная приёмка по метке `quality-checks`** (контракт `dex-skill-node-contract`): если во входе есть `{тип, оракул, verdict: passed}`, соответствующий прогон становится подтверждающим (выборка на предмет ложной метки) вместо полного; метки нет - полный обход. Находка вопреки метке помечает её `contradicted`.

## Границы

- Без `Write`/`Edit`: чужой документ не мутируется. Правку вносит автор или оператор.
- Находки предъявляются оператору, не автору напрямую. Канал доставки (задача в трекер или правка в документ) выбирает оператор.
- Желательность фичи по сути не оценивается - предмет только качество требования как артефакта.
- Дизайн-документ (спека, ADR, диаграммы) - предмет `dex-design-reviewer` / `/review-design`.

## Skills

Pre-load: `dex-skill-node-contract` (контракт узла, входная приёмка по метке). Императивно по фазам: `dex-skill-codebase-conventions`, `dex-skill-ddd` (Domain Priming), `dex-skill-requirement-quality` (единица), `dex-skill-requirement-set-quality` (набор), `dex-skill-fact-verification` + `dex-skill-review-evidence` (сверка и фальсификация), `dex-skill-output-hygiene` (формулировки).

## Связанные плагины

- `dex-sdlc` (`/feature`, трек `dex-skill-analytics-track`) - порождение требований, адресат правок.
- `dex-design-reviewer` - симметричный ревьюер зоны 2 (дизайн-документ).
- `dex-mr-reviewer` - ревью кода; там `requirement-quality` применяется к ТЗ задачи, а не к набору эпика.
