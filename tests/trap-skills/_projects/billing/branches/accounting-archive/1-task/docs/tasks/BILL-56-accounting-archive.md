# BILL-56: Месячный архив счетов для бухгалтерии

- 1-го числа собирается архив за прошлый месяц: zip с `invoices.csv` (id;customerId;amountMinor;currency;status;createdAt)
  и `manifest.txt` с SHA-256 файла csv. Архив кладётся в каталог `Accounting:ArchiveDirectory`
  и загружается в хранилище бухгалтерии (`POST v1/archives/{yyyy-MM}`).
- `GET /accounting/archives/{yyyy-MM}` - скачать архив; бухгалтеры качают архивы пачками, до сотен в час.
- `POST /accounting/corrections` - бухгалтер загружает csv корректировок (до 20 МБ). Первая строка -
  заголовок `invoiceId;amountMinor;currency`, иначе 400; файл сохраняется как есть рядом с архивами.
- Сервис работает неделями без перезапуска.
