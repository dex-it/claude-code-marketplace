# FUL-35: Elasticsearch - поиск по каталогу

Добавляю индекс товаров и поиск на витрине (`Elastic.Clients.Elasticsearch` 9.x).

- `ProductIndexer` создаёт индекс `products-v3` и загружает каталог из `ICatalogSource`.
- `GET /search` ищет по названию и описанию, фильтры по категории и цене, сортировка, список категорий рядом с выдачей.
- `GET /search/export` отдаёт всю выдачу потоком для партнёра (до 200 тысяч), `GET /search/by-name` - точный поиск по названию.
- `POST /internal/catalog/rebuild` пересобирает индекс через `ReindexService`.
