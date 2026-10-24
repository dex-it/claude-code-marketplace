src/shelfwatch/torch_train.py:41 - `shuffle=True` вместе с `sampler` - DataLoader бросает ValueError, обучение не стартует; убрать shuffle - blocker
src/shelfwatch/torch_train.py:61 - нет `optimizer.zero_grad()` в цикле: градиенты копятся между батчами, обучение расходится/даёт мусор - blocker
src/shelfwatch/torch_train.py:110 - `ReduceLROnPlateau.step()` без метрики - TypeError на первой эпохе при `--sched plateau`; нужно `scheduler.step(score)` - blocker
src/shelfwatch/torch_train.py:110 - `OneCycleLR` рассчитан на шаг после каждого батча (total_steps=epochs*len(loader)), а шаг делается раз в эпоху: LR почти не уходит со старта, расписание не выполняется (а при полном числе батчей ещё и возможен ValueError при выходе за total_steps при resume/повторах) - major
src/shelfwatch/torch_train.py:69 - `evaluate` без `model.eval()`: BatchNorm/в режиме train, после train_epoch метрика macro-F1 считается на батч-статистиках и портит running stats; оценка нестабильна и занижена - major
src/shelfwatch/torch_train.py:97 - `--resume` грузит только веса: optimizer (momentum), scheduler и номер эпохи не сохраняются, цикл идёт с эпохи 0 и OneCycle стартует заново - возобновление не продолжает прерванный запуск; при отсутствии last.pt - необработанный FileNotFoundError - major
src/shelfwatch/torch_train.py:20 - порядок `CLASSES` задан вручную, а ImageFolder индексирует классы по алфавиту (empty, full, misplaced): индекс 0 в модели - "empty", а в CLASSES - "full"; потребитель `predict` подпишет классы неверно - major
src/shelfwatch/torch_train.py:22 - токен загрузки зашит в исходник и уйдёт в git; даже если тестовый, шаблон закрепляет секрет в коде - читать из окружения - major
src/shelfwatch/torch_train.py:115 - `export` нигде не вызывается (ни из `fit`, ни из `main`): обещанного в MR экспорта в хранилище не происходит - major
src/shelfwatch/torch_train.py:123 - `except Exception: pass` глотает любую ошибку загрузки (в т.ч. 401/таймаут): модель не выгружена, а процесс завершается успешно - major
src/shelfwatch/torch_train.py:117 - `torch.save(model)` пиклит класс целиком: загрузка требует `weights_only=False` (выполнение произвольного кода из pickle) и ломается при смене кода/версий; сохранять `state_dict` - minor
src/shelfwatch/torch_train.py:83 - `predict` без `torch.no_grad()`: строится граф автограда, лишняя память на каждом вызове сервиса - minor
src/shelfwatch/torch_train.py:65 - `loss.item()` на каждом батче: синхронизация CPU с GPU на каждом шаге, простаивает GPU; копить `loss.detach()` тензором и читать раз за эпоху - minor
src/shelfwatch/torch_train.py:111 - чекпоинт пишется прямо в `last.pt` без временного файла: падение в момент записи портит единственный чекпоинт; лучшая по macro-F1 эпоха не сохраняется, остаётся последняя - minor
src/shelfwatch/torch_train.py:33 - нет аугментаций и фиксированного seed на 600 фото: быстрое переобучение и невоспроизводимые прогоны - minor
tests/test_torch_train.py:6 - тест покрывает только `predict` на нулевом тензоре (и тянет претрейн-веса из сети); цикл обучения, resume, планировщики, evaluate не проверены - minor
