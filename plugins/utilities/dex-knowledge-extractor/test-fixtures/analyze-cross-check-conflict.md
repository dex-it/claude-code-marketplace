# MR Analyze: dex/service-b !3001

Сценарий: два предложения одного прогона конфликтуют -- пример «Плохо» первой
ловушки демонстрирует конструкцию, которую запрещает вторая ловушка. Cross-check
обязан поймать это до записи output file. Здесь конфликт **разрешён переписыванием**
примера; неразрешимый случай уехал бы в `Dropped` с `conflicts-with-sibling-proposal`.

## Proposed skill additions

### dex-skill-dotnet-linq-optimization: Материализация после фильтра

**Целевой skill:** dex-skill-dotnet-linq-optimization
**H2-секция:** Материализация

**Critical assessment:**
- Generalization confidence: high -- правило про двойную материализацию не зависит от домена
- Systemic vs incidental: systemic
- False positive risk: low
- Already covered elsewhere: no

**Drop-in:**

### Двойная материализация одной выборки

**Плохо:**

```csharp
var filtered = items.Where(x => x.IsActive).ToList();
var count = items.Where(x => x.IsActive).Count();
```

**Правильно:** материализовать выборку один раз в переменную, далее работать с готовой коллекцией -- `filtered.Count`.

**Почему:** повторный `Where(...)` заново проходит источник; для `IQueryable` это второй round-trip в БД.

### dex-skill-dotnet-linq-optimization: Индексация без guard

**Целевой skill:** dex-skill-dotnet-linq-optimization
**H2-секция:** Материализация

**Critical assessment:**
- Generalization confidence: high -- правило про пустую коллекцию универсально
- Systemic vs incidental: systemic
- False positive risk: low
- Already covered elsewhere: no

**Drop-in:**

### Индексация результата без проверки на пустоту

**Плохо:**

```csharp
var first = items.Where(x => x.IsActive).First();
```

**Правильно:** после фильтра коллекция может быть пуста -- `FirstOrDefault()` + проверка на `null`.

**Почему:** `First()` / `[0]` на пустой выборке бросает исключение; фильтр не гарантирует наличие элементов.

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
