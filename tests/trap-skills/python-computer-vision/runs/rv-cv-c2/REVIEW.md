src/shelfwatch/detect.py:16 - аугментации без bbox_params: HorizontalFlip отражает изображение, а боксы в augmented() (стр. 29) остаются прежними, обучение идёт на неверной разметке - blocker
src/shelfwatch/detect.py:36 - YOLO-разметка пишется в пикселях с .1f, а формат (и load_sample) ожидает нормированные 0..1; записанные файлы нечитаемы для YOLO-загрузчиков и несовместимы с load_sample - major
src/shelfwatch/detect.py:39 - num_classes не используется, голова Faster R-CNN не заменяется (остаётся 91 класс COCO); обучение под классы товаров пойдёт в чужие классы - major
src/shelfwatch/detect.py:42 - заморозка первых 30 параметров backbone по индексу, BatchNorm не переведены в eval/frozen, а lr головы 1e-3 для AdamW завышен; нестабильное дообучение - minor
src/shelfwatch/detect.py:52 - NMS с iou 0.9 почти не удаляет дубли, без порога по score и без учёта класса (не batched_nms); на выходе много задвоенных боксов, завышенное число товаров - major
src/shelfwatch/detect.py:56 - merge_tiles делает NMS без сдвига боксов тайлов в координаты снимка и без учёта класса; боксы из разных тайлов окажутся в одних координатах и склеятся неверно - major
src/shelfwatch/detect.py:62 - "AP" это precision*recall при одном пороге, а не площадь под PR-кривой; метрика не сопоставима с mAP и вводит в заблуждение при выборе модели - major
src/shelfwatch/vision_data.py:21 - VerticalFlip и RandomRotation(180) для фото полок, которые всегда сняты вертикально; обучение на нереалистичных ракурсах снижает качество - minor
src/shelfwatch/vision_data.py:44 - cv2.imread даёт BGR, в ToPILImage он трактуется как RGB (в embed_shelf и detect.py конвертация есть); каналы перепутаны относительно ImageNet-весов, качество падает - major
src/shelfwatch/vision_data.py:49 - val-датасет использует train_tf со случайными аугментациями; метрики валидации шумные и не воспроизводимы - major
src/shelfwatch/vision_data.py:60 - полное дообучение ResNet-50 на 600 снимках с AdamW lr=1e-3 для всех слоёв разрушает предобученные веса, переобучение; нет eval на val и выбора эпохи - major
src/shelfwatch/vision_data.py:77 - embed_shelf без Normalize(IMAGENET_MEAN/STD), хотя веса обучены с нормализацией, и с Resize((224,224)) искажает пропорции 640x480; признаки хуже, поиск похожих полок менее точен - major
src/shelfwatch/vision_data.py:73 - модель ResNet-50 создаётся заново на каждый вызов embed_shelf; на каждый снимок лишняя загрузка весов, поиск по базе очень медленный - minor
src/shelfwatch/vision_data.py:83 - os.system с неэкранированными path и backup_dir: пробелы ломают команду, спецсимволы в имени файла дают выполнение произвольных команд - major
src/shelfwatch/segment.py:31 - на входе, не кратном 16 (в тесте 100x100: 25 -> 12 -> up 24 против skip 25), torch.cat падает с несовпадением размеров; тест test_unet_output_shape упадёт, а инференс на 640x480 сработает только случайно - blocker
src/shelfwatch/segment.py:35 - обычный CrossEntropyLoss при 3% пикселей пустых мест: модель сойдётся к "везде не пусто" с хорошей accuracy и нулевым recall по целевому классу; нужны веса классов/Dice/Focal - major
