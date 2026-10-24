# python-tensorflow: сжатие по свидетельству, группа 4.5

Скилл `dex-skill-python-tensorflow` 2.0.1 ([`inputs/`](inputs/): SKILL-2.0.1.md, SKILL-n1.md (итоговая)), эпик #291, группа 4.5 (#306). Исход - **сжат**: 2.0.1 -> 2.1.0.

**Заход группы 4.5.** Общий для семи скиллов: `python-project-hygiene`, `python-pytorch`, `python-tensorflow`,
`python-classical-ml`, `python-computer-vision`, `python-nlp-transformers`, `python-ml-optimization`. Вход -
мини-проект [`_projects/shelfwatch`](../_projects/shelfwatch/README.md) (Python 3.12, версии закреплены `==`),
ветки `branches/<имя>`. Ключ, коды единиц, приманки, дефекты вне скилла и допустимые решения записаны до первого
прогона (коммит `44692c54`); правка ключа после прогона одна - единица N6v K-NLP, записана коммитом до пары
`c3`, `c4` (`_projects/shelfwatch/README.md`, раздел K-NLP).

**Исполнитель.** `claude -p --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config
--no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3`, инструменты
`Read, Write, Edit, Glob, Grep, Bash`, разрешён только `Bash(git *)`. Скилл подан копией `SKILL.md` через
`--add-dir` и строкой промпта, `Skill` tool не вызывается. Раннер с промптами дословно -
[`_projects/shelfwatch/run-group-4-5.sh`](../_projects/shelfwatch/run-group-4-5.sh).

**Среда и порядок.** CLI 2.1.303 (поле `claude_code_version` в журналах всех прогонов), модель
`claude-sonnet-5-5` (поле `model`), effort medium флагом; каталог прогона - клон shelfwatch в каталоге вне репозитория,
раннер отказывается стартовать при `CLAUDE.md` на пути и при `~/.claude/CLAUDE.md` (проба пройдена, `~/.claude/CLAUDE.md`
нет), `skills` и `mcp_servers` в init-событии пусты у всех прогонов, выход за каталог прогона - пусто (`esc=[]`).
Окружения Python у исполнителя нет и сказано в промпте: код не запускался, `pytest`, `ruff`, `mypy` не гонялись; все
единицы судятся на уровне кода (ключ, «Среда прогона»). Версии библиотек сверены отдельно на установленном окружении
по `uv pip compile pyproject.toml` (Python 3.12, закреплённые версии: torch 2.14.1, keras 3.15.1, scikit-learn 1.9.1,
transformers 5.20.1, optuna 5.0.0, ruff 0.17.1). Даты прогонов - 2026-10-19: контроль `c1`-`c2` (25 прогонов), пара `c3`, `c4`
K-NLP, набор `n` (редакция `n1`, 24 прогона), набор `m` (итоговые редакции pytorch, nlp-transformers, classical-ml, 14 прогонов), набор `f`
(N0 и N0K на итоговых редакциях всех семи, 4 прогона). Расход
прогонов всей группы - $5.81 (`total_cost_usd`, 67 прогонов), активации - около $1.9, потолок $30. Кейсы лежат в `runs/` того скилла, чей
предмет они мерят; общие кейсы N0 и N0K - в `python-pytorch/runs/`, RV-DDP - там же.

Число прогонов - решение 2 эпика не принято: контроль дважды, снятие при 2/2 в каждом кейсе, где единица применима.

**Кейсы скилла:** ревью RV-TF (`keras-train`, F2-F15 и приманки), N0, N0K. Ключ - [`_projects/shelfwatch/README.md`](../_projects/shelfwatch/README.md#ключ), коммит `44692c54`.

## Потребители

Загрузка `[справочно]` в `model-trainer`, `model-debugger`, `ml-experimenter`, `data-pipeline-builder`; бандл `ml-engineer`; кейс активации `python-tensorflow-in`. Вызовов узлов dex-auto нет. Нижний тир - sonnet.

## Неточности текста

- «`model(x)` без `training=` держит BatchNorm и Dropout в режиме train» - неверно для Keras: вне `fit` слой вызывается с `training=False` по умолчанию. Контроль не поднял пункт ни разу (приманка FB1), значит пункт ловил то, чего нет.
- «Нужен `LossScaleOptimizer`» при `mixed_float16` - `compile` оборачивает оптимизатор сам (проверено на keras 3.15.1: `LossScaleOptimizer`); приманка FB2, не поднята ни разу.
- «Custom layer без `get_config()` - `model.save()` падает» - на keras 3.15.1 `save` проходит, падает загрузка (`TypeError` при `load_model`); последствие в пункте указано неверно.
- «`.h5` не поддерживает Keras 3» - формат читается и пишется (проверено), он устаревший и теряет custom-объекты.

## Контроль и вердикт

Контроль - без скилла, `c1`, `c2` на кейс (K-NLP - ещё `c3`, `c4`); выходы - `runs/<кейс>-c<N>/`, у общих кейсов - в `python-pytorch/runs/`. Единица снята, если контроль 2/2 в каждом кейсе, где она применима. «Ступень» - лестница формы ([SKILL_FRAMEWORK.md](../../../docs/SKILL_FRAMEWORK.md#форма-пункта)); набор `n` - редакция `n1`, `m` и `f` - итоговая.

| Код | Единица | Кейс | Контроль | Исход |
|---|---|---|---|---|
| F1 | `training=` не передаётся в `call()` | RV-TF (приманка FB1) | не поднята | снята: утверждение неверно для Keras |
| F2 | `from_logits` не согласован с активацией | RV-TF | 2/2 (blocker) | снята |
| F3 | `EarlyStopping` без `restore_best_weights` | RV-TF | 2/2 | снята |
| F4 | `fit()` без `validation_data` | RV-TF | 2/2 | снята |
| F5 | `shuffle()` после `batch()` | RV-TF | 2/2 | снята |
| F6 | маленький shuffle buffer | RV-TF | 2/2 (minor) | снята |
| F7 | `map()` без `num_parallel_calls` | RV-TF | 0/2 | ступень 1: `n` 2/2; пункт-название |
| F8 | нет `prefetch` в конце конвейера | RV-TF | 2/2 | снята |
| F9 | `.h5` вместо `.keras` | RV-TF | 2/2 | снята |
| F10 | custom layer без `get_config()` | RV-TF | 2/2 | снята |
| F11 | subclassed-модель через `save()` | RV-TF | 2/2 | снята |
| F12 | выходной слой в float16 | RV-TF | 2/2 | снята |
| F13 | нет `LossScaleOptimizer` | RV-TF (приманка FB2) | не поднята | снята: `compile` оборачивает сам |
| F14 | модель создана вне `strategy.scope()` | RV-TF | 2/2 | снята |
| F15 | Python `print`/`if` вместо `tf.print`/`tf.cond` в `@tf.function` | RV-TF | 2/2 | снята |

**Итоговая редакция** - 1 пункт:

- `map` в `tf.data` без `num_parallel_calls`

**Охват и приманки.** RV-TF `n1`, `n2`: F7 поднята 2/2 (`map(augment)` без `num_parallel_calls`, major); остальные находки контроля сохранены (13-14 против 12), X1 (путь `/home/dmitry`), X2 (`assert`) - оба прогона; FB1 и FB2 не поднимались. N0 и N0K с редакциями всех семи скиллов - как в `python-pytorch`.

## Дубли (шаг 0)

DDP (`python-pytorch` = `python-ml-optimization`), `no_grad` (тот же двойник), AMP (`python-pytorch`, `python-tensorflow`, `python-ml-optimization`) и GridSearch (`python-ml-optimization`; в `python-classical-ml` единицы нет, есть только слово в `description`) решены до кейсов: единица мерится в одном кейсе, двойник наследует вердикт. Все DDP-, `no_grad`- и AMP-единицы сняты контролем 2/2 (RV-PT, RV-DDP, RV-TF), GridSearch снят (RV-OPT). Заморозка backbone: V8 (`python-computer-vision`) и N8 (`python-nlp-transformers`) сняты контролем 2/2, поэтому противоречие без условия исчезло вместе с пунктами.

## Открыто

- Сторона автора не мерилась: кодовых кейсов на Keras нет.
- F12 (выход в float16), F14 (`strategy.scope()`), F15 (`@tf.function`): вердикты по коду; поведение на нескольких GPU и численные последствия не мерились.
- F9: контроль называл причину («H5 не сохраняет subclassed-модель»), которая неточна (`save` в `.h5` проходит, проверено); единица снята по месту и последствию «сервис не загрузит», а не по формулировке причины.
- Решение 2 эпика (число прогонов) не принято: контроль по 2 прогона, возможны ложные снятия; перепрогон - при его принятии.
- Рез `optimize-for-llm`: у исполнителя нет `Skill`, `dex-skill-optimize-for-llm:optimize-for-llm` не вызывался - `unverifiable`; редакция в десять строк, резать нечего.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `python-tensorflow/SKILL.md` | 5515 символов, 104 строк | 369 символов, 10 строк | 15 единиц (ловушки, чек-лист, таблицы) -> 1 пункт |
| `description` | триггеры по ловушкам | предмет пунктов; поле без слов снятых ловушек и домена фикстуры; кейс `python-tensorflow-in` переписан вопросом об оставшихся пунктах (ревью PR #370), 3/3 (`node tools/run-activation.js --runs 3`, модель sonnet, 2026-10-20) |

Норма письма (`dex-skill-norm-writing`): носитель меньше, чем до правки; пункт - одно утверждение без оговорок, называет ситуацию, решение выводит исполнитель; факт версии (где есть) назван с версией и источником. Числа без источника в пункты не вошли.

## Синхронизации

Версия скилла 2.0.1 -> 2.1.0 (`plugin.json`, `marketplace.json`). Витрина (`plugin.json` `description`) переписана по телу и разошлась в `marketplace.json` генератором. Агенты `ml-experimenter`, `model-debugger`, `model-trainer` (1.6.0 -> 1.6.1): скобки с перечнем снятых ловушек у ссылок на скиллы заменены предметом пунктов. Бандлы и каталог не меняются: состав плагинов прежний. Кейс активации - в `tests/activation/cases.json`.

По ревью PR #370: `deployment-assistant` (`dex-ml-deployer` 1.5.0 -> 1.5.1) загрузку скилла снял - оставшийся пункт про входной конвейер обучения; `data-pipeline-builder` (tf.data) загрузку сохраняет.
