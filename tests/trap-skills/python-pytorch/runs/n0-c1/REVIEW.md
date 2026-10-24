src/shelfwatch/clean_train.py:41 - evaluate делит на seen без проверки: пустой загрузчик даст ZeroDivisionError в конце эпохи - minor
src/shelfwatch/clean_train.py:60 - churn_baseline_score не проверяет порядок строк, TimeSeriesSplit молча считает данные упорядоченными; при перемешанном x метрика будет оптимистичной утечкой из будущего - minor
src/shelfwatch/clean_train.py:19 - shuffle=True без генератора/seed: обучение невоспроизводимо, а чекпоинт не хранит состояние RNG, так что возобновление не даёт тот же результат - minor
tests/test_clean_train.py:5 - тест покрывает только make_loader (assert N_FEATURES == 40 тавтологичен); train_epoch, evaluate, save_checkpoint и churn_baseline_score не проверены, регрессии в шаге планировщика и чекпоинте не поймаются - minor
