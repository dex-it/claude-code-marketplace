# MR Analyze: dex/service-b !3001

Сценарий: два предложения одного прогона конфликтуют -- пример «Плохо» первой
ловушки демонстрирует конструкцию, которую запрещает вторая ловушка. Cross-check
обязан поймать это до записи output file. Здесь конфликт **разрешён переписыванием**
примера; неразрешимый случай уехал бы в `Dropped` с `conflicts-with-sibling-proposal`.

## Proposed skill additions

### dex-skill-dotnet-ef-core: Материализация после фильтра

**Целевой skill:** dex-skill-dotnet-ef-core
**H2-секция:** список чек-листа (skill без H2)

**Critical assessment:**
- Generalization confidence: high -- правило про двойную материализацию не зависит от домена
- Systemic vs incidental: systemic
- False positive risk: low
- FP counter-examples: `Where(...).Count()` без промежуточной материализации, когда коллекция нужна один раз -- правило адресует ПОВТОРНЫЙ проход того же источника, единичный перебор не осуждает
- Already covered elsewhere: no
- Non-obviousness: medium -- для `IQueryable` повторный `Where` = второй round-trip в БД (неочевидно), для in-memory -- лишь повторный проход
- Axis fit: dex-skill-dotnet-ef-core (список чек-листа) | new-skill -- повторное выполнение выборки не ложится ни на один пункт чек-листа EF Core; в фикстуре оставлена в этом skill намеренно, как и вторая ловушка
- Label correctness: n/a
- Fact check: verified (websearch) -- повторное выполнение запроса при повторном `Where` для `IQueryable` сверено

Recommendation for reviewer: apply as-is

**Основание:**

**Плохо:**

```csharp
var filtered = items.Where(x => x.IsActive).ToList();
var count = items.Where(x => x.IsActive).Count();
```

**Правильно:** материализовать выборку один раз в переменную, далее работать с готовой коллекцией -- `filtered.Count`.

**Почему:** повторный `Where(...)` заново проходит источник; для `IQueryable` это второй round-trip в БД.

**Drop-in:**

- Двойная материализация одной выборки

### dex-skill-dotnet-ef-core: Индексация без guard

**Целевой skill:** dex-skill-dotnet-ef-core
**H2-секция:** список чек-листа (skill без H2)

**Critical assessment:**
- Generalization confidence: high -- правило про пустую коллекцию универсально
- Systemic vs incidental: systemic
- False positive risk: low
- FP counter-examples: `Single()` там, где элемент гарантирован инвариантом (PK-lookup) -- правило адресует выборку ПОСЛЕ фильтра, где пустота возможна; гарантированный случай не задевает
- Already covered elsewhere: no
- Non-obviousness: medium
- Axis fit: dex-skill-dotnet-ef-core (список чек-листа) | new-skill -- `First()` на пустой выборке - корректность LINQ: ни один пункт чек-листа EF Core её не вмещает, skill с такой осью в каталоге нет. В фикстуре оставлена в том же skill намеренно -- сценарий демонстрирует **cross-check** (конфликт примеров), не Axis fit; чтобы две ловушки были соседями одного skill и могли конфликтовать. Промах оси рекомендацию не понижает (адрес, не качество)
- Label correctness: n/a
- Fact check: verified (websearch) -- `First()` бросает `InvalidOperationException` на пустой последовательности сверено

Recommendation for reviewer: apply as-is

**Основание:**

**Плохо:**

```csharp
var first = items.Where(x => x.IsActive).First();
```

**Правильно:** после фильтра коллекция может быть пуста -- `FirstOrDefault()` + проверка на `null`.

**Почему:** `First()` / `[0]` на пустой выборке бросает исключение; фильтр не гарантирует наличие элементов.

**Drop-in:**

- Индексация результата без проверки на пустоту

## Skipped (already covered)

(пусто)

## Dropped (not actionable)

(пусто)

---

**Ожидаемое поведение cross-check:** исходно «Плохо» первой ловушки могло содержать
`items.Where(x => x.IsActive).First()` как побочную конструкцию -- это нарушает правило
второй ловушки («индексация без guard»). Cross-check ловит коллизию и переписывает
пример первой ловушки на `.ToList()` / `.Count()`, не задевающий чужое правило. Обе
ловушки остаются в `Proposed skill additions`. `Dropped` пуст, потому что переписать
удалось без потери смысла. Если бы переписать было нельзя -- одна ловушка осталась бы
(по `generalization confidence`, затем `false positive risk`), вторая ушла бы в
`Dropped (not actionable)` с причиной `conflicts-with-sibling-proposal`.
