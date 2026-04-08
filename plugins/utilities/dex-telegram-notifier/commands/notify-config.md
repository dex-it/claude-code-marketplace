---
description: Показать текущую конфигурацию Telegram уведомлений
allowed-tools: Bash
---

# /notify-config

**Goal:** Показать текущие значения всех переменных окружения Telegram-нотификатора и их статус (установлено / не установлено).

**Output:**

Секции с текущими значениями переменных:

- Обязательные: TELEGRAM_BOT_TOKEN (маскированный), TELEGRAM_CHAT_ID
- События: TELEGRAM_NOTIFY_STOP, TELEGRAM_NOTIFY_WAITING, TELEGRAM_NOTIFY_SUBAGENT, TELEGRAM_NOTIFY_DELAY
- Компоненты сообщений: TELEGRAM_INCLUDE_MESSAGE, TELEGRAM_INCLUDE_THINKING, TELEGRAM_INCLUDE_TODO, TELEGRAM_INCLUDE_TOOLS, TELEGRAM_INCLUDE_PLAN, TELEGRAM_INCLUDE_QUESTIONS
- Прочие: TELEGRAM_LANGUAGE, TELEGRAM_MESSAGE_LIMIT, TELEGRAM_THREAD_ID

**Constraints:**

- Маскировать TELEGRAM_BOT_TOKEN (показывать первые 10 и последние 5 символов)
- Показывать default-значения для неустановленных переменных
- Не выводить полный токен бота в открытом виде
