# python-pytorch: сжатие по свидетельству, группа 4.5

Скилл `dex-skill-python-pytorch` 2.0.1 ([`inputs/`](inputs/): SKILL-2.0.1.md, SKILL-n1.md, SKILL-n2.md (итоговая)), эпик #291, группа 4.5 (#306). Исход - **сжат**: 2.0.1 -> 2.1.0.

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

**Кейсы скилла:** ревью RV-PT (`torch-train`, T1-T9), RV-DDP (`torch-ddp`, D1-D7), N0 (`clean-diff`), N0K (`task-metrics`). Ключ - [`_projects/shelfwatch/README.md`](../_projects/shelfwatch/README.md#ключ), коммит `44692c54`.

## Потребители

Загрузка `[справочно]` в агентах `model-trainer`, `model-debugger`, `ml-experimenter` (каталог `plugins/specialists/ml`); бандл `ml-engineer`; кейс активации `python-pytorch-in`, `pytorch-near`. Вызовов узлов dex-auto нет. Нижний тир - sonnet.

## Неточности текста

- `ReduceLROnPlateau.step()` без метрики - не «LR никогда не изменится», а `TypeError` (проверено на torch 2.14.1); пункт описывал последствие неверно.
- «shuffle и sampler одновременно - RuntimeError» - на 2.14.1 `ValueError` при построении `DataLoader`.
- «`backward()` внутри `autocast` даёт численную нестабильность» - в документации PyTorch это «не рекомендуется»; в контроле находка minor.
- «`persistent_workers` обязателен при `num_workers>0`» - рекомендация, а не дефект: контроль не поднял её ни в одном прогоне (приманка PB1).

## Контроль и вердикт

Контроль - без скилла, `c1`, `c2` на кейс (K-NLP - ещё `c3`, `c4`); выходы - `runs/<кейс>-c<N>/`, у общих кейсов - в `python-pytorch/runs/`. Единица снята, если контроль 2/2 в каждом кейсе, где она применима. «Ступень» - лестница формы ([SKILL_FRAMEWORK.md](../../../docs/SKILL_FRAMEWORK.md#форма-пункта)); набор `n` - редакция `n1`, `m` и `f` - итоговая.

| Код | Единица | Кейс | Контроль | Исход |
|---|---|---|---|---|
| T1 | `model.eval()` забыт при inference | RV-PT | 2/2 | снята |
| T2 | `optimizer.zero_grad()` пропущен | RV-PT | 2/2 | снята |
| T3 | `torch.no_grad()` забыт при inference | RV-PT | 2/2 (minor) | снята; дубль в `python-ml-optimization` наследует вердикт |
| T4 | `.item()` внутри training loop | RV-PT | 0/2 | ступень 1: `n1` 1/2 -> ступень 2 (факт) `m` 2/2; пункт |
| T5 | сохранение только `model.state_dict()` | RV-PT | 2/2 | снята |
| T6 | `torch.save(model)` вместо `state_dict()` | RV-PT | 2/2 | снята |
| T7 | OneCycleLR `step()` раз в эпоху | RV-PT | 2/2 | снята |
| T8 | ReduceLROnPlateau `step()` без метрики | RV-PT | 2/2 | снята |
| T9 | `shuffle` и `sampler` одновременно | RV-PT | 2/2 | снята |
| PB1 | `num_workers` без `persistent_workers` | RV-PT (приманка) | не поднята ни разу (major/blocker) | снята: рекомендация, не дефект |
| T11 | `backward()` внутри `autocast` | RV-DDP | 2/2 (minor) | снята; дубль AMP, шаг 0 |
| D1 | `DistributedSampler` без `set_epoch` | RV-DDP | 2/2 | снята; дубль `python-ml-optimization`, шаг 0 |
| T12 | `state_dict` с префиксом `module.` | RV-DDP | 2/2 | снята |
| T13 | разная логика на рангах (оценка на rank 0 через обёртку DDP) | RV-DDP | 2/2 | снята; вердикт по коду, зависание в рантайме не мерилось - «Открыто» |

**Итоговая редакция** - 1 пункт:

- `loss.item()` на каждом батче цикла обучения: каждый вызов синхронизирует CPU с GPU (PyTorch Performance Tuning Guide)

**Охват и приманки.** Итоговая редакция `m` на RV-PT: T1-T3, T5-T9 поднимаются как в контроле, X1 и X2 (токен-литерал, `except: pass`) в обоих прогонах; PB1 не поднята. Находок 16-17 против 18-19 в контроле: сужения нет. RV-DDP со скиллом не гонялся: все его единицы сняты контролем, пункт T4 к кейсу не относится; приманка DB1 (`estimate_class_prior` на каждом ранге) в контроле 2/2 поднята major - дефект кейса (находка по существу резонна, глобальную долю можно взять из `targets`), в счёт не идёт. N0 (чистый дифф, итоговые редакции всех семи скиллов) - `f1`, `f2`: по предметам скиллов находок нет (одна minor по тесту в `f1`); контроль `c1`, `c2` - только minor, в `c2` ещё одна major по «`scheduler.step()` на каждом батче» - не хуже контроля. N0K - только `metrics.py` и тесты, зависимостей нет: 4/4 (`m`, `f`) с редакциями и 2/2 в контроле.

## Дубли (шаг 0)

DDP (`python-pytorch` = `python-ml-optimization`), `no_grad` (тот же двойник), AMP (`python-pytorch`, `python-tensorflow`, `python-ml-optimization`) и GridSearch (`python-ml-optimization`; в `python-classical-ml` единицы нет, есть только слово в `description`) решены до кейсов: единица мерится в одном кейсе, двойник наследует вердикт. Все DDP-, `no_grad`- и AMP-единицы сняты контролем 2/2 (RV-PT, RV-DDP, RV-TF), GridSearch снят (RV-OPT). Заморозка backbone: V8 (`python-computer-vision`) и N8 (`python-nlp-transformers`) сняты контролем 2/2, поэтому противоречие без условия исчезло вместе с пунктами.

## Открыто

- T4: вердикт по коду; величина простоя GPU (`.item()` как точка синхронизации) не мерилась - нет GPU. Источник факта - PyTorch Performance Tuning Guide («Avoid unnecessary CPU-GPU synchronization», `cuda_tensor.item()`).
- T13 (оценка на rank 0 через обёртку DDP): зависание видно только в рантайме на нескольких GPU - `unverifiable` по поведению; снята по тому, что оба прогона назвали асимметрию коллективных операций в коде.
- Сторона автора для T1-T3, T5-T9 и DDP-единиц не мерилась: кодовых кейсов на PyTorch в наборе нет; снятие держится на ревью, как допускает шаг 2 метода.
- Дефект кейса: приманка DB1 поднята контролем major - перепрогон на исправленной приманке не делался.
- Решение 2 эпика (число прогонов) не принято: контроль по 2 прогона, возможны ложные снятия; перепрогон - при его принятии.
- Рез `optimize-for-llm`: у исполнителя нет `Skill`, `dex-skill-optimize-for-llm:optimize-for-llm` не вызывался - `unverifiable`; редакция в десять строк, резать нечего.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `python-pytorch/SKILL.md` | 5039 символов, 98 строк | 447 символов, 10 строк | 14 единиц (ловушки, чек-лист, таблицы) -> 1 пункт |
| `description` | триггеры по ловушкам | предмет пунктов; поле без слов снятых ловушек и домена фикстуры; кейс `python-pytorch-in` переписан вопросом об оставшихся пунктах (ревью PR #370), 3/3, `pytorch-near` 0/3 (молчит) (`node tools/run-activation.js --runs 3`, модель sonnet, 2026-10-20) |

Норма письма (`dex-skill-norm-writing`): носитель меньше, чем до правки; пункт - одно утверждение без оговорок, называет ситуацию, решение выводит исполнитель; факт версии (где есть) назван с версией и источником. Числа без источника в пункты не вошли.

## Синхронизации

Версия скилла 2.0.1 -> 2.1.0 (`plugin.json`, `marketplace.json`). Витрина (`plugin.json` `description`) переписана по телу и разошлась в `marketplace.json` генератором. Агенты `ml-experimenter`, `model-debugger`, `model-trainer` (1.6.0 -> 1.6.1): скобки с перечнем снятых ловушек у ссылок на скиллы заменены предметом пунктов. Бандлы и каталог не меняются: состав плагинов прежний. Кейс активации - в `tests/activation/cases.json`.

По ревью PR #370: `data-pipeline-builder` (`dex-data-pipeline` 1.7.0 -> 1.7.1) - строка pytorch снята, пункта про `DataLoader` больше нет; `deployment-assistant` (`dex-ml-deployer` 1.5.0 -> 1.5.1) - загрузки pytorch, tensorflow и classical-ml сняты: оставшиеся пункты про обучение, не про export и serving; записанный там фолбэк («профильного skill по export/serving в каталоге нет») сохранён.
