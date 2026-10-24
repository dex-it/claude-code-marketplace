# Таблицы: стадии E3

Прогонов: 60; строк оценки: 516. Сгенерировано results/analyze.mjs из results.csv и runs.csv.

## Применение по классу и форме (k/n, доля, 95% Уилсон)

| Класс | F0 | F4 | F4b |
| --- | --- | --- | --- |
| A | - | - | - |
| B | - | - | - |
| C | - | - | - |
| D | - | - | - |

## Чувствительность: disputed наоборот

| Класс | F0 | F4 | F4b |
| --- | --- | --- | --- |
| A | - | - | - |
| B | - | - | - |
| C | - | - | - |
| D | - | - | - |

## F1 против F5 по классу: решающее правило PREREG

| Класс | F1 | F5 | d = F1-F5 [95% Ньюкомб] | Фишер p | Прогоны с вредом (кейсы класса) | Вердикт |
| --- | --- | --- | --- | --- | --- | --- |
| A | - | - | - | - | - | нет данных |
| B | - | - | - | - | - | нет данных |
| C | - | - | - | - | - | нет данных |
| D | - | - | - | - | - | нет данных |

## Вред: прогоны хотя бы с одним событием harm или mine

| Форма | Прогоны с вредом |
| --- | --- |
| F0 | 0/20 (0%; 0%-16%) |
| F4 | 0/20 (0%; 0%-16%) |
| F4b | 0/20 (0%; 0%-16%) |

## Вред класса D: неверный готовый ответ (строки harm класса D и fail по unit класса D)

| Форма | События вреда класса D |
| --- | --- |
| F0 | - |
| F4 | - |
| F4b | - |

## Вред по строкам ключа (yes / прогонов)

| Строка | Вид | Класс | F0 | F4 | F4b |
| --- | --- | --- | --- | --- | --- |
| B1-h-email-single | harm | - | 0/4 | 0/4 | 0/4 |
| B1-h-legacy-switch | harm | - | 0/4 | 0/4 | 0/4 |
| B1-m-notracking-write | mine | - | 0/4 | 0/4 | 0/4 |
| B2-h-filters-weakened | harm | - | 0/4 | 0/4 | 0/4 |
| B2-m-drop-notes | mine | - | 0/4 | 0/4 | 0/4 |
| B3-h-existing-search | harm | - | 0/4 | 0/4 | 0/4 |
| B3-m-fts-lost | mine | - | 0/4 | 0/4 | 0/4 |
| BN-h-chip-single | harm | - | 0/4 | 0/4 | 0/4 |
| BN-h-consumable-remove | harm | - | 0/4 | 0/4 | 0/4 |
| BN-h-fromsql | harm | - | 0/4 | 0/4 | 0/4 |
| BN-h-local-time | harm | - | 0/4 | 0/4 | 0/4 |
| BN-h-split-card | harm | - | 0/4 | 0/4 | 0/4 |
| BN-h-tolower | harm | - | 0/4 | 0/4 | 0/4 |
| BN-h-tracking | harm | - | 0/4 | 0/4 | 0/4 |
| BR-h-box-code | harm | - | 0/4 | 0/4 | 0/4 |
| BR-h-history-fromsql | harm | - | 0/4 | 0/4 | 0/4 |
| BR-m-cascade-fix | mine | - | 0/4 | 0/4 | 0/4 |
| BR-m-ddl-grant | mine | - | 0/4 | 0/4 | 0/4 |

## Применение по единице (pass / прогонов)

| Строка | Единица | Класс | F0 | F4 | F4b |
| --- | --- | --- | --- | --- | --- |
| B1-optout-utc | datetime-column |  | 4/4 | 4/4 | 4/4 |
| B1-phone-multi | single-not-unique |  | 4/4 | 4/4 | 4/4 |
| B1-phone-translate | untranslatable-filter |  | 4/4 | 4/4 | 4/4 |
| B1-report-notracking | readonly-tracking |  | 4/4 | 4/4 | 4/4 |
| B1-senior-filter | untranslatable-filter |  | 4/4 | 4/4 | 4/4 |
| B2-allergies-orphans | required-orphans |  | 4/4 | 4/4 | 4/4 |
| B2-deletedat-utc | datetime-column |  | 4/4 | 4/4 | 4/4 |
| B2-migration-path | prod-migration |  | 4/4 | 4/4 | 4/4 |
| B2-owner-softdelete | softdelete-cascade |  | 4/4 | 4/4 | 4/4 |
| B3-drug-resultset | fromsql-alias |  | 4/4 | 4/4 | 4/4 |
| B3-export-notracking | readonly-tracking |  | 4/4 | 4/4 | 4/4 |
| B3-export-range-utc | datetime-column |  | 4/4 | 4/4 | 4/4 |
| B3-lastvisit-split | split-single |  | 4/4 | 4/4 | 4/4 |
| B3-scope-sql | fromsql-alias |  | 4/4 | 4/4 | 4/4 |
| BR-box-occupant | single-not-unique |  | 4/4 | 4/4 | 4/4 |
| BR-decommission-filter | softdelete-cascade |  | 4/4 | 4/4 | 4/4 |
| BR-latest-stay-split | split-single |  | 2/4 | 3/4 | 3/4 |
| BR-long-stays | untranslatable-filter |  | 4/4 | 4/4 | 4/4 |
| BR-medplan-clear | required-orphans |  | 4/4 | 4/4 | 4/4 |
| BR-occupancy-sql | fromsql-alias |  | 4/4 | 4/4 | 4/4 |
| BR-startup-migrate | prod-migration |  | 4/4 | 4/4 | 4/4 |

## Охват (coverage - дефекты вне скилла) и recall скилла (skill)

| Род | F0 | F4 | F4b |
| --- | --- | --- | --- |
| coverage | 16/16 (100%; 81%-100%) | 16/16 (100%; 81%-100%) | 16/16 (100%; 81%-100%) |
| skill | - | - | - |

## Стоимость на прогон (среднее)

| Форма | Прогонов | input + cache write | cache read | output | $ | сек | ходов | вызовов инструментов | WebSearch/WebFetch (прогонов с вызовом) | прочитал SKILL.md | init чистый |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F0 | 20 | 15951 | 65394 | 11883 | 0.378 | 104 | 11.4 | 10.4 | 0 (0) | 0 | 20 |
| F4 | 20 | 20036 | 77426 | 14519 | 0.466 | 125 | 13.3 | 12.3 | 0 (0) | 20 | 20 |
| F4b | 20 | 21105 | 81592 | 14862 | 0.482 | 128 | 13.3 | 12.3 | 0 (0) | 20 | 20 |

Итого по отобранным прогонам: $26.54.
