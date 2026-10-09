# Ошибки 500 на POST /shipments - выборка из лога shipping-api

Стенд stage; виджет партнёра подключён к нему 2 октября (интеграция заказов с сайтов магазинов). Записи -
запрос и ответ целиком, `x-request-id` - из заголовка запроса. Через сайт за то же время ошибок 500 нет.

## 1. 2026-10-02T11:47:13Z, x-request-id: wdg-7c1e09a2, источник: виджет партнёра

    POST /shipments
    {"weight":"1,5","postcode":"10115","express":false}

    500
    {"error":"Cannot read properties of undefined (reading 'price')","stack":"TypeError: Cannot read properties of undefined (reading 'price')\n    at quote (file:///app/src/quote.js:15:60)\n    at createShipment (file:///app/src/shipments.js:11:33)\n    at postShipment (file:///app/src/app.js:27:37)\n    at handle (file:///app/src/app.js:42:52)\n    at Server.<anonymous> (file:///app/platform/http.js:58:28)"}

## 2. 2026-10-03T09:02:51Z, x-request-id: wdg-31f0b6d4, источник: виджет партнёра

    POST /shipments
    {"weight":"2,3","postcode":"50667"}

    500
    {"error":"Cannot read properties of undefined (reading 'price')","stack":"TypeError: Cannot read properties of undefined (reading 'price')\n    at quote (file:///app/src/quote.js:15:60)\n    at createShipment (file:///app/src/shipments.js:11:33)\n    at postShipment (file:///app/src/app.js:27:37)\n    at handle (file:///app/src/app.js:42:52)\n    at Server.<anonymous> (file:///app/platform/http.js:58:28)"}

## 3. 2026-10-04T16:20:05Z, x-request-id: wdg-e2a95c17, источник: виджет партнёра

    POST /shipments
    {"weight":2,"postcode":"01067","note":"Hinterhof, 2. OG"}

    500
    {"error":"Cannot read properties of undefined (reading 'bands')","stack":"TypeError: Cannot read properties of undefined (reading 'bands')\n    at quote (file:///app/src/quote.js:15:22)\n    at createShipment (file:///app/src/shipments.js:11:33)\n    at postShipment (file:///app/src/app.js:27:37)\n    at handle (file:///app/src/app.js:42:52)\n    at Server.<anonymous> (file:///app/platform/http.js:58:28)"}
