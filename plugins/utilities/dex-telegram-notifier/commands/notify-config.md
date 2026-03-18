---
description: Показать текущую конфигурацию Telegram уведомлений
allowed-tools: Bash
---

# /notify-config

Показывает текущую конфигурацию Telegram уведомлений.

## Процесс

1. **Показать статус конфигурации:**
```bash
echo "📱 Конфигурация Telegram Notifier"
echo "=================================="
echo ""

# Required variables
echo "🔑 Обязательные переменные:"
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    # Mask token for security (show first 10 and last 5 chars)
    TOKEN_MASKED="${TELEGRAM_BOT_TOKEN:0:10}...${TELEGRAM_BOT_TOKEN: -5}"
    echo "  TELEGRAM_BOT_TOKEN: $TOKEN_MASKED ✅"
else
    echo "  TELEGRAM_BOT_TOKEN: не установлен ❌"
fi

if [ -n "$TELEGRAM_CHAT_ID" ]; then
    echo "  TELEGRAM_CHAT_ID: $TELEGRAM_CHAT_ID ✅"
else
    echo "  TELEGRAM_CHAT_ID: не установлен ❌"
fi

echo ""
echo "⚙️ Настройки событий:"
echo "  TELEGRAM_NOTIFY_STOP: ${TELEGRAM_NOTIFY_STOP:-true}"
echo "  TELEGRAM_NOTIFY_WAITING: ${TELEGRAM_NOTIFY_WAITING:-true}"
echo "  TELEGRAM_NOTIFY_SUBAGENT: ${TELEGRAM_NOTIFY_SUBAGENT:-true}"
echo "  TELEGRAM_NOTIFY_DELAY: ${TELEGRAM_NOTIFY_DELAY:-0} сек"

echo ""
echo "📝 Компоненты сообщений:"
echo "  TELEGRAM_INCLUDE_MESSAGE: ${TELEGRAM_INCLUDE_MESSAGE:-true}"
echo "  TELEGRAM_INCLUDE_THINKING: ${TELEGRAM_INCLUDE_THINKING:-false}"
echo "  TELEGRAM_INCLUDE_TODO: ${TELEGRAM_INCLUDE_TODO:-true}"
echo "  TELEGRAM_INCLUDE_TOOLS: ${TELEGRAM_INCLUDE_TOOLS:-true}"
echo "  TELEGRAM_INCLUDE_PLAN: ${TELEGRAM_INCLUDE_PLAN:-true}"
echo "  TELEGRAM_INCLUDE_QUESTIONS: ${TELEGRAM_INCLUDE_QUESTIONS:-true}"

echo ""
echo "🌍 Прочие настройки:"
echo "  TELEGRAM_LANGUAGE: ${TELEGRAM_LANGUAGE:-ru}"
echo "  TELEGRAM_MESSAGE_LIMIT: ${TELEGRAM_MESSAGE_LIMIT:-4000}"
if [ -n "$TELEGRAM_THREAD_ID" ]; then
    echo "  TELEGRAM_THREAD_ID: $TELEGRAM_THREAD_ID"
fi
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `TELEGRAM_BOT_TOKEN` | - | Токен бота от @BotFather (обязательно) |
| `TELEGRAM_CHAT_ID` | - | ID чата для уведомлений (обязательно) |
| `TELEGRAM_NOTIFY_STOP` | `true` | Уведомлять о завершении работы |
| `TELEGRAM_NOTIFY_WAITING` | `true` | Уведомлять об ожидании ответа |
| `TELEGRAM_NOTIFY_SUBAGENT` | `true` | Уведомлять о субагентах |
| `TELEGRAM_NOTIFY_DELAY` | `0` | Задержка (сек) для Notification |
| `TELEGRAM_INCLUDE_MESSAGE` | `true` | Включать последнее сообщение |
| `TELEGRAM_INCLUDE_THINKING` | `false` | Включать Ultrathink |
| `TELEGRAM_INCLUDE_TODO` | `true` | Включать статус TODO |
| `TELEGRAM_INCLUDE_TOOLS` | `true` | Включать используемые инструменты |
| `TELEGRAM_INCLUDE_PLAN` | `true` | Включать план |
| `TELEGRAM_INCLUDE_QUESTIONS` | `true` | Включать вопросы |
| `TELEGRAM_LANGUAGE` | `ru` | Язык сообщений (ru/en) |
| `TELEGRAM_MESSAGE_LIMIT` | `4000` | Лимит символов в сообщении |
| `TELEGRAM_THREAD_ID` | - | ID топика для супергрупп |

## Пример вывода

```
📱 Конфигурация Telegram Notifier
==================================

🔑 Обязательные переменные:
  TELEGRAM_BOT_TOKEN: 8457185021...Xd6g ✅
  TELEGRAM_CHAT_ID: 960257093 ✅

⚙️ Настройки событий:
  TELEGRAM_NOTIFY_STOP: true
  TELEGRAM_NOTIFY_WAITING: true
  TELEGRAM_NOTIFY_SUBAGENT: true
  TELEGRAM_NOTIFY_DELAY: 0 сек

📝 Компоненты сообщений:
  TELEGRAM_INCLUDE_MESSAGE: true
  TELEGRAM_INCLUDE_THINKING: false
  TELEGRAM_INCLUDE_TODO: true
  TELEGRAM_INCLUDE_TOOLS: true
  TELEGRAM_INCLUDE_PLAN: true
  TELEGRAM_INCLUDE_QUESTIONS: true

🌍 Прочие настройки:
  TELEGRAM_LANGUAGE: ru
  TELEGRAM_MESSAGE_LIMIT: 4000
```
