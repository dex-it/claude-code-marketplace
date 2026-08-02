# Образец с вердиктом вне перечня

| Поле | Значение |
|---|---|
| `status` | `complete` |

## `quality-checks` пакета

| Артефакт | Проверка | Вердикт |
|---|---|---|
| фикстура | `requirement-quality` | verdict: approved |
| фикстура-2 | `requirement-set-quality` | `rejected` |

| Артефакт | `stage` | Почему не выше |
|---|---|---|
| фикстура | `checked` | апрува оператора в `autonomous` нет |
