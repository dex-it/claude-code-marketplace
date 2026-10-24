src/shelfwatch/torch_train.py:41 - `shuffle=True` вместе с `sampler=` взаимоисключающи, DataLoader бросает ValueError при создании, обучение не стартует - blocker
src/shelfwatch/torch_train.py:61 - нет `optimizer.zero_grad()` перед backward: градиенты копятся между батчами, обучение расходится или не сходится - blocker
src/shelfwatch/torch_train.py:110 - `scheduler.step()` раз в эпоху: OneCycleLR рассчитан на total_steps в батчах, за эпохи пройдёт лишь малую часть цикла (lr застрянет в начале прогрева); у ReduceLROnPlateau `step()` без метрики падает с TypeError - blocker
src/shelfwatch/torch_train.py:111 - чекпоинт содержит только веса: оптимизатор (momentum), планировщик и номер эпохи не сохраняются, `--resume` (стр. 98) начинает с эпохи 0 с новым планировщиком и пересчитанным циклом lr, а не продолжает обучение - major
src/shelfwatch/torch_train.py:69 - `evaluate` не вызывает `model.eval()`: после train_epoch BatchNorm работает в режиме обучения, метрика macro-F1 шумная/занижена, а running stats портятся валидационными батчами - major
src/shelfwatch/torch_train.py:33 - ImageFolder сортирует классы по алфавиту (empty, full, misplaced), а `CLASSES` (стр. 20) = full, empty, misplaced: индексы расходятся, потребитель predict подпишет full как empty и наоборот - major
src/shelfwatch/torch_train.py:123 - `except Exception: pass` глотает любую ошибку загрузки: экспорт молча не удаётся, модель не попадает в хранилище, а ответ и статус не проверяются - major
src/shelfwatch/torch_train.py:115 - `export` нигде не вызывается ни из `fit`, ни из `main`, хотя MR заявляет экспорт модели в хранилище: после обучения ничего не выгружается - major
src/shelfwatch/torch_train.py:65 - `loss.item()` на каждом батче синхронизирует GPU с CPU и останавливает конвейер; копить сумму тензором (`total += loss.detach()`) и вызвать `.item()` один раз в конце эпохи - major
src/shelfwatch/torch_train.py:117 - `torch.save(model)` пикли весь объект: привязка к путям классов/версии torch, не загрузится через `weights_only=True` (стр. 91), небезопасно при загрузке; сохранять `state_dict` - minor
src/shelfwatch/torch_train.py:22 - токен авторизации хранится в исходниках (в репозитории окажется в истории); читать из переменной окружения/секретов - minor
src/shelfwatch/torch_train.py:83 - `predict` без `torch.no_grad()`: строится граф автограда, лишняя память и время на каждом запросе сервиса - minor
src/shelfwatch/torch_train.py:91 - `torch.load` без `map_location`: чекпоинт, сохранённый на GPU, не откроется на машине без CUDA - minor
src/shelfwatch/torch_train.py:94 - нет фиксации seed (torch, sampler, workers): запуски невоспроизводимы, сравнение планировщиков некорректно - minor
tests/test_torch_train.py:6 - тест покрывает только predict; цикл обучения, resume, планировщики и evaluate не проверены (ни одна из ошибок выше не поймана), build_model тянет веса из сети - minor
