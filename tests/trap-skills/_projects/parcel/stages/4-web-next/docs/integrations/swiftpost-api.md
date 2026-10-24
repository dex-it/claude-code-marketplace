# SwiftPost API для интеграторов

Версия 2.0, март 2026. Документ получен от SwiftPost при подписании договора.

## Аутентификация

Каждый запрос - с заголовком `Authorization: Bearer <token>`. Токен выдаёт менеджер SwiftPost.

## Создание отправки

`POST /v2/shipments`

Заголовки: `Content-Type: application/json`, `Authorization: Bearer <token>`.

Тело:

```json
{
  "reference": "1042",
  "weight_kg": 1.2,
  "service": "standard",
  "recipient": {
    "name": "Мария Белова",
    "phone": "+79213456703",
    "address": { "postcode": "190121", "line": "Санкт-Петербург, наб. Крюкова канала, 4, кв. 9" }
  }
}
```

| Поле | Тип | Описание |
|---|---|---|
| `reference` | строка | номер заказа отправителя, обязателен |
| `weight_kg` | число | вес посылки, кг |
| `service` | строка | `standard` или `express` |
| `recipient.name`, `recipient.phone` | строка | получатель |
| `recipient.address.postcode`, `recipient.address.line` | строка | адрес доставки, индекс - шесть цифр |

Ответ `201 Created`:

```json
{
  "shipment_id": "a1f0c2d4-7d1e-4f55-9a1b-2c3d4e5f6a7b",
  "tracking_number": "SP0001234567",
  "eta": "2026-10-02",
  "label_url": "https://api.swiftpost.example/v2/labels/a1f0c2d4.pdf"
}
```

- `tracking_number` - трек-номер для клиента;
- `eta` - плановая дата доставки, `YYYY-MM-DD`;
- `label_url` - этикетка для печати.

## Ошибки

Ошибки валидации и доставки - `422 Unprocessable Entity`:

```json
{ "error": { "code": "ADDRESS_UNDELIVERABLE", "message": "Адрес вне зоны доставки" } }
```

| `error.code` | Когда |
|---|---|
| `ADDRESS_UNDELIVERABLE` | адрес вне зоны доставки SwiftPost |
| `WEIGHT_LIMIT` | вес больше допустимого |

`503 Service Unavailable` - сервис временно недоступен; заголовок `Retry-After` - через сколько секунд
повторить запрос.

## Песочница

Для разработки - песочница SwiftPost, адрес выдаёт SwiftPost при подключении (у команды - в переменной
окружения `SWIFTPOST_SANDBOX_URL`). Тестовый токен - `sbx_parcel_dev`. Режим недоступности (ответ 503) -
`POST /__sandbox/mode`. Подробнее - README проекта.
