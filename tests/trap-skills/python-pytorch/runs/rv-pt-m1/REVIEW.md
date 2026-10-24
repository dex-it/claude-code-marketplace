src/shelfwatch/torch_train.py:41-42 - `shuffle=True` вместе с `sampler` в DataLoader: PyTorch бросает ValueError при создании загрузчика, обучение не стартует - blocker
src/shelfwatch/torch_train.py:110 - `scheduler.step()` без метрики для ReduceLROnPlateau: TypeError после первой эпохи при `--sched plateau` - blocker
src/shelfwatch/torch_train.py:61-64 - нет `optimizer.zero_grad()`: градиенты копятся по всем батчам и эпохам, обучение расходится или не сходится - blocker
src/shelfwatch/torch_train.py:110 - OneCycleLR рассчитан на `epochs * len(train_loader)` шагов, а шагает раз в эпоху: lr почти не выходит из разогрева, расписание не выполняется - major
src/shelfwatch/torch_train.py:69-72 - `evaluate` без `model.eval()`: BatchNorm в режиме обучения и обновляет статистики на валидации, macro-F1 искажён и выбор модели по нему ненадёжен - major
src/shelfwatch/torch_train.py:97-98 - `--resume` грузит только веса: оптимизатор (momentum), планировщик и номер эпохи не сохраняются, цикл идёт с эпохи 0 и расписание начинается заново, возобновление не продолжает прежний прогон - major
src/shelfwatch/torch_train.py:20 - `CLASSES` в порядке full/empty/misplaced, а ImageFolder сортирует папки по алфавиту (empty/full/misplaced): индексы модели не совпадают с именами, потребитель `predict` подпишет классы неверно - major
src/shelfwatch/torch_train.py:22 - токен загрузки зашит в исходники (в репозиторий уходит секрет; сейчас значение тестовое, но схема вшита) - major
src/shelfwatch/torch_train.py:123-124 - `except Exception: pass` глотает любой сбой выгрузки: модель молча не попадает в хранилище, а экспорт выглядит успешным - major
src/shelfwatch/torch_train.py:134 - `export` нигде не вызывается (ни из `fit`, ни из `main`): заявленный экспорт в хранилище не работает - major
src/shelfwatch/torch_train.py:117 - `torch.save(model)` пикли́т класс целиком: артефакт привязан к версии кода и путям модулей, загрузка небезопасна (`weights_only=True` не сработает); экспортировать надо `state_dict` - major
src/shelfwatch/torch_train.py:65 - `loss.item()` на каждом батче: синхронизация CPU с GPU, простои GPU; копить тензор и читать раз за эпоху - minor
src/shelfwatch/torch_train.py:82-83 - `predict` без `torch.no_grad()`: строится граф, лишняя память в сервисе разметки - minor
src/shelfwatch/torch_train.py:91 - `torch.load` без `map_location`: чекпоинт с GPU не загрузится на машине без CUDA - minor
src/shelfwatch/torch_train.py:111 - `last.pt` перезаписывается напрямую: обрыв во время записи портит единственный чекпоинт, лучшая по F1 модель не сохраняется - minor
src/shelfwatch/torch_train.py:33-34 - ждёт `shelf/train` и `shelf/val`, а docs/data.md описывает `shelf/` как 600 фото без разбиения; откуда берётся сплит, не определено, возможна утечка между выборками - minor
tests/test_torch_train.py:6-10 - тест только на `predict` (и со скачиванием весов ImageNet); цикл обучения, resume, планировщики и экспорт не покрыты, поэтому блокеры выше не пойманы - minor
