# dotnet-resources: сжатие по свидетельству, группа 2.1 - снят

Скилл `dex-skill-dotnet-resources` 1.0.1 ([`inputs/SKILL-1.0.1.md`](inputs/SKILL-1.0.1.md)) снят
целиком, эпик #291, группа 2.1 (#296).

Вход, исполнитель (`claude-sonnet-5-5`, effort medium, MCP нет), промпты и правило засчитывания - общие
для группы, в протоколе [dotnet-async-patterns](../../dotnet-async-patterns/README.md#заход-группы-21).
Кейсы - RV-R (месячный архив, BILL-56) и R1 в G1 (PDF через внешнюю утилиту, BILL-50), ключ - в
[`_projects/billing`](../../_projects/billing/README.md#группа-21-net-скиллы-кода).

## Потребители

Skill tool в фазе: `dotnet-coder`, `dotnet-performance-analyst` (безусловно), `dotnet-runtime-diagnostician`,
`architect-dotnet`, `debugger`; by-stack: `discover-reviewer` (топик «надёжность»). Сноска `managed-debug`.
Бандлы: `dotnet-developer`, `dotnet-fullstack`, `runtime-diagnostics`. Кейс активации `dotnet-resources-in`.

## Вердикт

| Единица 1.0.1 | Кейс | Контроль | Исход |
|---|---|---|---|
| R1 IDisposable не вызван | G1 (`Process`), RV-R (`FileStream`, `ZipArchive`) | 2/2, 2/2 | снята |
| R2 MemoryStream без Dispose | RV-R (`RecyclableMemoryStream`) | 2/2 | снята |
| R3 StreamReader закрывает поток | RV-R | 2/2; в `c2` minor с оговоркой «зависит от реализации потока» | снята |
| R4 подписка без отписки | RV-R | 2/2 | снята |
| R5 `new HttpClient` | дом - `performance-review`, снят там («Клиент на вызов», K7, KD3 2/2) | - | дубль, снята |
| R6 конкатенация в цикле | дом - `performance-review`, снят там | - | дубль, снята |
| R7 LOH | RV-R | 2/2 | снята |
| R8 `ArrayPool` без `Return` в `finally` | RV-R | 2/2 | снята |
| R9 замыкание удерживает объект | RV-R | 2/2 | снята |
| R10 финализатор без Dispose pattern | RV-R | 2/2 | снята |
| R11 Transient IDisposable в DI | дом - снятый `dotnet-di` | - | дубль, снята |

Восемь измеренных единиц контроль берёт 2/2, три - дубли шага 0: от скилла ничего не остаётся. Набора
n2 нет - он совпадает с контролем. Приманки RV-R (PW `leaveOpen`, PP `ArrayPool` с `finally`, PH typed
client) не подняты blocker/major; O1 - 2/2.

**Неточности текста 1.0.1** (сняты вместе со скиллом): R2 «MemoryStream держит буфер в LOH» верно только
от 85 КБ, у `RecyclableMemoryStream` финализатор возвращает блоки - дефект в задержке возврата; R8 «пул
растёт бесконечно» для `ArrayPool.Shared` ложно - невозвращённый массив собирает GC, теряется
переиспользование.

## Открыто

- `dotnet-performance-analyst` грузил скилл безусловно (memory leak, GC pressure, socket exhaustion);
  поручения анализа производительности не мерились, загрузка снята вместе со скиллом.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `dotnet-resources/SKILL.md` | 4129 символов, 82 строки | снят | 11 ловушек |
| загрузки у потребителей | 6 агентов, сноска `managed-debug`, строки README бандла, витрины и `AGENT_FRAMEWORK` | сняты | скилл снят |

## Бюджет синхронизаций группы 2.1

Носители, тронутые синхронизациями пяти скиллов группы, символы и строки, develop (`53273b68`) -> ветка.
Вырос один: `stack-registry` (+3) - пример маршрута «дедлок async» заменён предметом оставшегося пункта
«фальшивый async», взамен снят прежний пример.

| Носитель | develop | ветка | Разница |
|---|---|---|---|
| `README.md` | 28491, 479 | 28471, 479 | -20 |
| `docs/AGENT_FRAMEWORK.md` | 79239, 1017 | 79180, 1016 | -59 |
| `dex-bundle-runtime-diagnostics/README.md` | 3930, 72 | 3772, 70 | -158 |
| `completeness-mapping/SKILL.md` | 8707, 115 | 8658, 115 | -49 |
| `managed-debug/SKILL.md` | 7303, 104 | 6991, 101 | -312 |
| `stack-registry/SKILL.md` | 5622, 88 | 5625, 88 | +3 |
| `dex-architect-dotnet/README.md` | 3921, 62 | 3918, 62 | -3 |
| `architect-dotnet.md` | 17470, 274 | 17377, 273 | -93 |
| `discover-reviewer.md` | 10503, 129 | 10484, 129 | -19 |
| `debugger.md` | 17447, 178 | 17367, 178 | -80 |
| `security-reviewer.md` | 10101, 131 | 10035, 131 | -66 |
| `dotnet-coder.md` | 13540, 148 | 13462, 147 | -78 |
| `dotnet-performance-analyst.md` | 8646, 139 | 8500, 138 | -146 |
| `dotnet-runtime-diagnostician.md` | 10265, 138 | 10057, 137 | -208 |
| `dotnet-ef-specialist.md` | 6606, 87 | 6593, 87 | -13 |
| `seq-logging-specialist.md` | 8147, 87 | 8146, 87 | -1 |
