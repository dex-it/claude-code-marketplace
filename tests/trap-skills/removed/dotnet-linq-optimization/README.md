# [снят] Протокол испытаний: dex-skill-dotnet-linq-optimization

Предмет - скилл `dex-skill-dotnet-linq-optimization` 2.3.1, копия поданного исполнителю текста -
[`inputs/SKILL-2.3.1.md`](inputs/SKILL-2.3.1.md). Метод - [«Сжатие по свидетельству»](../../../README.md#метод-сжатие-по-свидетельству):
база - прогон без скилла, единица остаётся, только если без неё исполнитель ошибается. Итог
испытаний - скилл снят целиком, строка в реестре [`tests/README.md`](../../../README.md).

Дата прогонов: 2026-09-25. Исполнитель - sonnet (тир `dotnet-coder`), субагент без `Skill` tool.
Код `c` - контроль без скилла, `s` - со скиллом. Вердикт - чтением результата по ключу; ключ
исполнителю не показывался.

## Состав

```
inputs/code/       мини-проект Shop (EF Core 8 + Npgsql 8) для захода 1
inputs/review/     репозиторий Shop с засеянными дефектами для захода 2
inputs/SKILL-*.md  текст скилла, поданный в прогонах `s`
runs/<прогон>/     результат: созданный файл (заход 1) либо REVIEW.md (заход 2)
```

Каждый прогон начинается с копии `inputs/<заход>/` в отдельный каталог вне репозитория.

## Заход 1: написание кода по поручению

Промпт (`<каталог>` - копия `inputs/code/`):

```
Ты .NET-разработчик в команде. Проект Shop (EF Core 8 + Npgsql 8, .NET 8) лежит в каталоге <каталог> .
Прочитай его файлы и выполни поручение, записав код в этот каталог.

[только s:] Перед работой прочитай <путь>/SKILL.md - ловушки LINQ, принятые в команде.

Поручение: <поручение кейса>

Ограничения: не вызывай Skill tool; не читай и не пиши файлы вне этого каталога [s: кроме названного
SKILL.md]; не запускай сборку и dotnet. В ответе - список созданных/изменённых файлов и 2-3 строки о решениях.
```

| Кейс | Поручение | Сверка |
|---|---|---|
| L1 | Добавь сервис CatalogService: (а) Search(string? category, decimal? minPrice, bool onlyActive, int page, int pageSize) - страница карточек каталога для фронта: Id, Name, Price; (б) HasOrders(Guid customerId) - есть ли у клиента хоть один заказ; (в) GetByIds(IReadOnlyList<Guid> ids) - содержимое корзины с фронта, от одного до нескольких тысяч id, вернуть Id, Name, Price, Stock. | проекция без Image/Description; один IQueryable с условными Where и одной материализацией; Any, не Count>0; GetByIds одним запросом (Contains), без цикла по id |
| L2 | Добавь метод RecalculateTotals(IReadOnlyList<Guid> orderIds) в новый OrderMaintenance: для каждого заказа из списка Total = сумма Qty*Price его позиций; сохрани. | нет запроса на каждый id |
| L3 | Добавь отчёт CustomerReport.Build(DateTime from, DateTime to): для каждого клиента с заказами за период - email, число заказов, сумма, и список его заказов (Id, CreatedAt, Total). | фильтр периода на сервере; нет загрузки всей таблицы; конструкция не падает в рантайме EF Core 8 |
| L4 | Добавь PriceImporter.ImportPrices(string csvPath, IReadOnlyList<string> stopListSkus): CSV строки "sku;price", около 200 тысяч строк; обнови цены продуктов (в каталоге около 100 тысяч продуктов); строки с SKU из стоп-листа (около 20 тысяч SKU) пропускай. | стоп-лист в HashSet; продукты по Sku в Dictionary, не FirstOrDefault на строку |
| L5 | Добавь CustomerNotifier.NotifyCustomers(IEnumerable<Guid> customerIds, string text): отправить письмо через IEmailSender каждому клиенту из списка; список приходит из маркетинговой системы. | один клиент - одно письмо (дедуп id); IEnumerable не перечисляется повторно |
| L6 | Добавь ProductRatingService.GetRating(Guid productId): средняя, минимальная и максимальная оценка по одобренным отзывам продукта плюс текст отзыва с самой высокой оценкой среди одобренных. | продукт без одобренных отзывов не бросает (Average/Min/Max/First на пустом) |
| L7 | Добавь OrderImportStats.Compute(string path) поверх OrderFileReader.Read: число заказов в файле, сумма Total, дата самого раннего заказа и число уникальных клиентов (по email). | Read перечисляется один раз (файл до ГБ) |
| L8 | Добавь CustomerMerge.Merge(string exportPathA, string exportPathB): в каждом файле JSON-массив клиентов (Customer, System.Text.Json); верни один список клиентов из обеих выгрузок без повторов. | дедуп по ключу (Id/Email), не Distinct() по ссылке |

### Вердикты захода 1

| Прогон | Вердикт | Разбор |
|---|---|---|
| L1-c1 | pass | AsNoTracking + проекция, AnyAsync, Contains -> ANY, условные Where |
| L1-c2 | pass | то же |
| L2-c1 | pass | Where Contains + Include, один SaveChanges |
| L2-c2 | pass | то же + ранний выход на пустом |
| L3-c1 | pass | один запрос, подзапросы в проекции |
| L3-c2 | pass | фильтр на сервере, группировка в памяти по отфильтрованной проекции |
| L4-c1 | pass | стоп-лист HashSet, батчи Dictionary sku->price, Contains -> ANY |
| L4-c2 | pass | стоп-лист HashSet, батч Dictionary, UPDATE FROM unnest |
| L5-c1 | **fail** | дедупа нет: внутри батча IN схлопывает дубли, между батчами `Chunk(500)` один клиент получит два письма; основание батча - «лимит параметров Npgsql», ложное (EF 8 + Npgsql шлёт массив одним параметром) |
| L5-c2 | pass | `Distinct().ToList()` один раз; батч Contains лишний, но безвредный |
| L5-c3 | pass | Distinct + Chunk |
| L5-c4 | pass | `Distinct().ToArray()` |
| L5-s1 | pass | HashSet; `Chunk(500)` по ловушке «Contains с огромным списком» |
| L5-s2 | pass | HashSet; `Chunk(500)` со ссылкой на ту же ловушку - скилл переносит ложное основание |
| L6-c1 | pass | пустой набор -> null через GroupBy(_ => 1) + SingleOrDefault; FirstAsync только после непустого |
| L6-c2 | pass | null на пустом наборе; текст отдельным запросом по Max |
| L7-c1 | pass | один foreach, HashSet email, пустой файл -> null |
| L7-c2 | pass | один проход, HashSet email |
| L8-c1 | pass | GroupBy Id + First |
| L8-c2 | pass | GroupBy Id + First |

Итог захода 1: без скилла 19/20 (L5 - 3/4), со скиллом L5 2/2, оба с лишним `Chunk(500)` по неверной
ловушке.

## Заход 2: ревью кода с засеянными дефектами

Промпт (`<каталог>` - копия `inputs/review/`):

```
Ты .NET-ревьюер в команде. Репозиторий Shop (EF Core 8 + Npgsql 8, .NET 8) лежит в каталоге <каталог> .

[только s:] Перед работой прочитай <путь>/SKILL.md - ловушки LINQ, принятые в команде.

Сделай ревью MR. В MR файлы: <файлы MR>. <описание MR>. Остальные файлы каталога - существующий код,
читай для контекста.

Запиши находки в REVIEW.md в этом же каталоге: на каждую - файл:строка, что не так, чем это кончится,
severity (blocker/major/minor). Код не правь.

Ограничения: не вызывай Skill tool; не читай и не пиши файлы вне этого каталога [s: кроме названного
SKILL.md]; не запускай сборку и dotnet. В ответе - число находок по severity.
```

- **MR-A:** файлы `SalesReport.cs, CustomerExport.cs, CatalogSearch.cs, StockImport.cs`; «Описания у MR нет».
- **MR-B:** файлы `OrderConfirmation.cs, OrderIntake.cs, PaymentWebhook.cs, ShippingPlanner.cs`; «Описание MR:
  «Приёмка заказов, webhook оплаты, выбор склада отгрузки. Webhook: сохраняем платёж, заказ -> Paid, 1% суммы
  начисляем бонусом на счёт клиента.»».

### Ключ

| id | Дефект | Ловушка скилла |
|---|---|---|
| A1 | SalesReport: GetAllAsync - вся таблица Products с Image, фильтр IsActive в памяти | ToList в начале / вся entity |
| A2 | SalesReport: items.Where(ProductId) на каждый продукт - O(P*I) в памяти, агрегат не в SQL | GroupBy / lookup |
| A3 | CustomerExport: AsNoTracking без identity resolution + Distinct() по ссылке -> клиент дублируется | Distinct по ссылке |
| A4 | CustomerExport.HasOrders: CountAsync() > 0 | Count>0 vs Any |
| A5 | CatalogSearch: материализация в каждой ветке, комбинаторика веток | динамический запрос |
| A6 | StockImport: FirstOrDefault по List на каждую строку - O(n*m) | Dictionary |
| X1 | SalesReport: выручка по неоплаченным / отменённым заказам | вне скилла |
| X2 | StockImport: отрицательное количество проходит без проверки | вне скилла |
| B1 | OrderConfirmation: FindAsync клиента в цикле по заказам | N запросов в цикле |
| B2 | OrderIntake.Accept: ItemsOf (AsEnumerable над IQueryable) перечислен 3 раза -> 3 запроса | многократная итерация |
| B3 | PaymentWebhook: повтор ExternalId (ретрай провайдера) -> двойной платёж и бонус | дубли во входном батче |
| B4 | ShippingPlanner.ChooseWarehouse: First() без склада с остатком | [0]/First без guard |
| B5 | ShippingPlanner: AverageAsync по пустому (новый склад без доставок) бросает | Average на пустом |
| D1 | ShippingPlanner: `withStock.Contains(w.Id)` - EF 8 + Npgsql шлёт один параметр-массив; находка «лимит параметров / Chunk» ложная | приманка |
| B3b | два платежа одного клиента в батче -> SingleOrDefaultAsync не видит Added-счёт -> два BonusAccount | вне скилла |

### Вердикты захода 2

| Прогон | Ключ | Приманка | Вне скилла | Прочие находки вне ключа |
|---|---|---|---|---|
| HA-c1 | A1 (minor) A2 A3 A5 A6; **A4 не найден** - 5/6 | - | X1 X2 - 2/2 | lost update |
| HA-c2 | A1 (minor) A2-A6 - 6/6 | - | X1 X2 - 2/2 | пагинация, дубли счётчика |
| HA-s1 | 6/6 | - | 0/2 | повтор productId в счётчике |
| HA-s2 | 6/6 | - | 0/2 | - |
| HB-c1 | 5/5 | не тронута | B3b | lost update; невалидный OrderId роняет батч |
| HB-c2 | 5/5 | не тронута | B3b | Paid без проверки статуса; Accept без проверки статуса; батч падает целиком |
| HB-s1 | остановлен оператором до записи REVIEW.md | - | - | - |
| HB-s2 | 5/5 | не тронута | B3b | lost update; Paid без проверки статуса |

Итог захода 2: без скилла MR-A 11/12, MR-B 10/10; со скиллом MR-A 12/12, MR-B 5/5. Прибавка скилла -
A4 (minor). Дефекты вне скилла в MR-A: без скилла 2/2, со скиллом 0/2.

## Факты, по которым ловушки признаны неверными

- «Contains с огромным списком»: EF 8-9 передают параметризованную коллекцию одним JSON-параметром
  (OPENJSON на SQL Server, `= ANY` массивом на Npgsql), EF 10 - скалярными параметрами с padding;
  большого `IN` из литералов нет.
- «GroupBy с ToList»: EF 7+ транслирует GroupBy финальным оператором.
