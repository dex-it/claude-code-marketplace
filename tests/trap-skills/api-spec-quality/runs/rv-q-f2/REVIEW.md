verdict: failed
api/openapi.yaml:599 - participantsCount добавлен в required запроса createBooking: существующие клиенты без поля получат 400, а CHANGELOG и описание MR называют изменение совместимым; ломающее изменение без перечня потребителей, плана миграции и срока прежней версии - blocker
api/openapi.yaml:365 - у extendBooking `security: []` снимает apiKey: продлевать чужие брони сможет любой аноним, при этом FR-12 требует ключ - blocker
api/openapi.yaml:373 - $ref на несуществующую схему ExtendRequst (опечатка; определена ExtendBookingRequest на :649): спека невалидна, генерация клиента упадёт - blocker
api/openapi.yaml:209 - новая операция searchBookings сразу помечена deprecated (:214) без замены и срока поддержки, при этом в CHANGELOG описана как новая функция: клиенты получат устаревшую операцию без пути ухода - major
api/openapi.yaml:359 - POST extend неидемпотентен, повтор после потерянного ответа продлит бронь второй раз (и спишет price); нет Idempotency-Key или описания поведения повтора - major
api/openapi.yaml:359 - у extendBooking нет x-traced-from: операция не привязана к требованию, а все остальные привязаны - major
api/openapi.yaml:388 - у extendBooking нет ответов 400/401/403/404/409/422 и ни одного примера ошибки, только default "500" без problem+json: клиент не знает, как обрабатывать пересечение со следующей бронью и неактивную бронь - major
api/openapi.yaml:331 - ответ 422 переноса описан инлайн как {message} без problem+json, `code` и примера, вопреки соглашению об ошибках (description:7) и общим responses: клиент не сможет разобрать ошибку единым обработчиком - major
api/openapi.yaml:535 - у BookingStatus убрана фраза «Клиент игнорирует неизвестные значения», хотя добавлен pending: старые клиенты со строгим enum упадут на десериализации лент и getBooking; в RoomFeature (:494) то же самое сделано правильно - major
api/openapi.yaml:574 - externalRef добавлен в Booking без описания в MR, без примера и не включён в запросы; поле заявлено в CHANGELOG, но не в описании MR (расхождение объёма) - minor
api/openapi.yaml:493 - phonebooth в RoomFeature не заявлен в описании MR (только в CHANGELOG): объём MR шире заявленного - minor
api/openapi.yaml:649 - ExtendBookingRequest.minutes без minimum/maximum/format и кратности 15 (FR-08), note без maxLength; ExtendResult без required, extendedUntil без format date-time: клиент видит неограниченные значения, сервер получит непредсказуемый ввод - minor
api/openapi.yaml:668 - price: number без format и валюты, и в брони цены нигде нет: непонятная единица, ошибки округления у клиентов - minor
api/openapi.yaml:378 - пример запроса extend без пояснений по FR-08/ограничению окна продления, а в ExtendResult нет version брони: клиент не сможет сделать перенос после продления без повторного чтения - minor
api/CHANGELOG.md:3 - запись 1.3.0 называет всё «совместимым», хотя participantsCount обязателен, и не указывает deprecated у search и снятие security у extend: потребители не узнают о рисках - minor
