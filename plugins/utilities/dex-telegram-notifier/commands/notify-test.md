---
description: Отправить тестовое уведомление в Telegram для проверки конфигурации
allowed-tools: Bash
---

# /notify-test

**Goal:** Отправить тестовое сообщение в Telegram через Bot API для проверки корректности конфигурации (токен, chat ID).

**Output:**

- При успехе: подтверждение отправки
- При ошибке: описание проблемы и способ решения

**Constraints:**

- Перед отправкой проверить наличие TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID
- Использовать Telegram Bot API sendMessage с parse_mode=HTML
- Учитывать TELEGRAM_LANGUAGE (ru/en) для текста сообщения
- При ошибке Unauthorized -- сообщить о неверном токене
- При ошибке Chat not found -- сообщить о неверном Chat ID
