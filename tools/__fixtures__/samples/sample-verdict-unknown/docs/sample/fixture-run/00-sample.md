# Образец с вердиктом вне перечня

| Поле | Значение |
|---|---|
| `status` | `complete` |

## `quality-checks` пакета

| Артефакт | Проверка | Вердикт |
|---|---|---|
| фикстура | `requirement-quality` | verdict: unknown-verdict |
| фикстура-2 | `requirement-set-quality` | `rejected` |

| Артефакт | Статус | Почему не выше |
|---|---|---|
| фикстура | `review` | апрува оператора в `autonomous` нет |
