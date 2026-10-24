Изменён один файл:

- `src/Bookings.Api/Validation/BookingRules.cs`: в `IsValidDuration` проверка `< MaxDurationMinutes` заменена на `<= MaxDurationMinutes`, так что 240 минут проходит, а 255 по-прежнему отклоняется.

Сборку и тесты не запускал: в репозитории нет тестового проекта. `api/openapi.yaml` уже описывает `maximum: 240`, поэтому контракт не менялся.
