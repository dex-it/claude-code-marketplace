# MR !231: Процедурный кабинет

## Зачем

Процедурный кабинет ведёт бумажный журнал. Переносим его в систему: запись на процедуру и перенос,
карточка процедуры с расходниками и заметками персонала, лист дня, поиск, отчёт по расходу материалов,
расчёт объёма препарата для инфузии.

## Что сделано

- `Domain/Procedures.cs` - новые `Procedure`, `ConsumableLine`, `StaffNote`; в `Pet` добавлены
  `ChipNumber` (номер микрочипа) и `WeightGrams` (вес с последнего взвешивания).
- `Data/ClinicDbContext.cs` - конфигурация.
- `Services/ProcedureService.cs` - запись, перенос, карточка, удаление строки расходников, поиск
  питомца по чипу, расчёт объёма препарата.
- `Services/ProcedureSheetService.cs` - лист дня, поиск по названию и по заметкам, отчёт по расходникам.
- Миграция `AddProcedures` (сгенерирована, в MR не показана).

## Контракт API

- `POST /procedures` - тело `{ petId, title, scheduledLocal, durationMinutes }`, `scheduledLocal`
  без смещения, например `2026-10-05T10:30:00`.
- `GET /procedures/day-sheet?date=2026-10-05&page=1` - страницы нумеруются **с 1**, по 30 строк.
- `GET /procedures/{id}/dose?drugMgPerKg=2.5&concentrationMgPerMl=10` - объём препарата в мл.
- `GET /procedures/consumption?month=2026-09-01&sort=item|total`.

## Примечания

- У длительных процедур (инфузия в стационаре) бывают сотни строк расходников и заметок.

## Изменённые файлы

- `Domain/Procedures.cs` (новый), `Domain/Pet.cs`
- `Data/ClinicDbContext.cs`
- `Services/ProcedureService.cs` (новый)
- `Services/ProcedureSheetService.cs` (новый)

Не менялся, приложен для контекста: `README.md`.
