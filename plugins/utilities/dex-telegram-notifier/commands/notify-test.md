---
description: Отправить тестовое уведомление в Telegram для проверки конфигурации
allowed-tools: Bash
---

# /notify-test

Отправляет тестовое сообщение в Telegram для проверки конфигурации.

## Процесс

1. **Проверить конфигурацию:**
```bash
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo "ОШИБКА: Переменные TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID не установлены"
    echo ""
    echo "Для настройки:"
    echo "  1. Создайте бота через @BotFather в Telegram"
    echo "  2. Получите Chat ID (отправьте боту сообщение, затем откройте"
    echo "     https://api.telegram.org/bot<TOKEN>/getUpdates)"
    echo "  3. Установите переменные окружения:"
    echo "     export TELEGRAM_BOT_TOKEN='your-bot-token'"
    echo "     export TELEGRAM_CHAT_ID='your-chat-id'"
    exit 1
fi
```

2. **Отправить тестовое сообщение:**
```bash
LANG="${TELEGRAM_LANGUAGE:-ru}"
if [ "$LANG" = "en" ]; then
    MSG="🧪 <b>Test notification</b>\n\nClaude Code Telegram notifications are configured correctly!"
else
    MSG="🧪 <b>Тестовое уведомление</b>\n\nTelegram уведомления Claude Code настроены корректно!"
fi

RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=$TELEGRAM_CHAT_ID" \
    -d "parse_mode=HTML" \
    --data-urlencode "text=$MSG")

if echo "$RESPONSE" | jq -e '.ok == true' > /dev/null 2>&1; then
    echo "✅ Тестовое сообщение успешно отправлено!"
else
    ERROR=$(echo "$RESPONSE" | jq -r '.description // "Unknown error"')
    echo "❌ Ошибка отправки: $ERROR"
fi
```

## Возможные ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `Unauthorized` | Неверный токен бота | Проверьте TELEGRAM_BOT_TOKEN |
| `Chat not found` | Неверный Chat ID | Проверьте TELEGRAM_CHAT_ID |
| `Bot was blocked` | Пользователь заблокировал бота | Разблокируйте бота в Telegram |

## Пример вывода

```
✅ Тестовое сообщение успешно отправлено!
```
