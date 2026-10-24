# core-dumps: сжатие по свидетельству, группа 4.6

Скилл `dex-skill-core-dumps` 1.0.0 -> 1.1.0 ([`inputs/SKILL-core-dumps-1.0.0.md`](inputs/SKILL-core-dumps-1.0.0.md), [`inputs/SKILL-core-dumps-1.1.0.md`](inputs/SKILL-core-dumps-1.1.0.md)). Эпик #291, группа 4.6 (#307), мини-проект [`_projects/diag`](../_projects/diag/README.md) (ключ, кейсы и клетки записаны коммитом `5c852db2` до прогонов; правки клеток после первой пары - `a27ce589`, `093e5f21`, ниже).

Карта потребителей, шаг 0 (дубли), среда прогона (образ, раннер, CLI 2.1.303, `CLAUDE.md` на пути нет), наборы `c`, `d`, `f`, `g`, общий контроль и расход - в [`managed-debug/README.md`](../managed-debug/README.md) (общий заход группы 4.6).

## Вердикт

| Единица | Кейс (клетка) | Контроль | Исход |
|---|---|---|---|
| gcore в контейнере без CAP | n2 | наследует вердикт ptrace-класса | снята |
| Build-id mismatch на executable | n1 (ND-9) | 2/2 c, 2/2 d: выбран debug-файл сборки `build-0419`, build-id сверен | снята; двойники `native-debug`, `binary-inspection` |
| Full vs Mini на Linux | d1 (MD-8) | см. `managed-debug` | снята (двойник) |
| dotnet-dump analyze требует matching runtime | - | нет второго runtime в среде | двойник снят, единица живёт в `managed-debug` (`unverifiable`) |
| ulimit -c, core_pattern, coredump_filter, gcore блокирует, coredumpctl x2, mismatched libs, core_pattern контейнера, символы контейнера | - | нет кейса; systemd и образ прода в среде невозможны | `unverifiable`, остались |

## Итоговая редакция

Набор `f`/`g` (итоговые редакции всех шести скиллов поданы каждому прогону): `cause` верен 16 из 16, клетки `pass` там, где применимы, приманки не подняты; `n0` с исходом «ничего не менять» - 2/2 без инструментов (`g`). Не хуже контроля. Для `d1` в `f` исполнитель впервые брал `dotnet-counters` (MD-6 pass 2/2 при применении), в `p1` - `dotnet-trace --providers` с уровнем (MD-4 pass).

## Открыто

- Единицы со статусом `unverifiable` остались как были; список и причины - таблица выше и [README мини-проекта](../_projects/diag/README.md#клетки-и-допустимые-решения).
- Вторая оценка вслепую не привлекалась; клетка исхода `d1 cause` судит номер строки строго, прогонам `d1-c/d/f` засчитан исход по чтению.
- Форма пункта: провалов контроля не было, лестница выше названия не ставилась; оставшиеся H3-ловушки стоят как написаны.
- `description` 1.1.1 без `minidump linux` и `build-id mismatch` (сняты двойниками); `core-dumps-in` перепрогнан в раунде 2 ([`managed-debug/README.md`](../managed-debug/README.md#результаты-раунда-2)): 3/3.
- Пробы тяжёлых сценариев (gcdump на большой куче, `coredumpctl`, Kubernetes, SELinux, Java, LBR) в среде невозможны.

## Бюджет правки

`core-dumps/SKILL.md`: 5752 символов, 86 строк, 13 H3 -> 4300 символов, 60 строк, 9 H3; взамен - вердикт контроля по таблице. Правка - только снятие единиц и сверка фактов, новый текст не вводился (норма письма `dex-skill-norm-writing`: носитель меньше; рез `optimize-for-llm` у исполнителя без `Skill` невозможен - `unverifiable`).
