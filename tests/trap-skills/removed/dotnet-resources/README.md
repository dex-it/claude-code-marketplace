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
| R5 `new HttpClient` | дом - `performance-review` «Клиент на вызов» | - | дубль, снята |
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
| `dotnet-resources/SKILL.md` | 5582 байт, 82 строки | снят | 11 ловушек |
| загрузки у потребителей | 6 агентов, сноска `managed-debug`, строки README бандла, витрины и `AGENT_FRAMEWORK` | сняты | скилл снят |
