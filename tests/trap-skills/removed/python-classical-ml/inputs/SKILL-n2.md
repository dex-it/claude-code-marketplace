---
name: python-classical-ml
description: Classical ML - дисбаланс классов и ранняя остановка при обучении sklearn и XGBoost. Активируется при scikit-learn, xgboost, RandomForest, class_weight, scale_pos_weight, early_stopping_rounds, дисбаланс классов, редкий класс, отток, классификатор
---

# Classical ML - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Редкий класс, а модель обучена без весов классов
- XGBoost с `n_estimators` без ранней остановки по отложенной выборке
