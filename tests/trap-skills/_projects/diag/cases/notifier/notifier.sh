#!/bin/sh
# notifier: рассылка уведомлений. Читает настройки из окружения.
LOG=/work/notifier/logs/notifier.log
echo "$(date -u +%FT%TZ) INFO notifier starting" >> "$LOG"
[ -d /work/notifier/extra.d ] || echo "$(date -u +%FT%TZ) WARN optional dir /work/notifier/extra.d not found, skipping" >> "$LOG"
if [ -z "$SMTP_RELAY" ]; then
  echo "$(date -u +%FT%TZ) ERROR SMTP_RELAY is not set" >> "$LOG"
  exit 78
fi
echo "$(date -u +%FT%TZ) INFO relay=$SMTP_RELAY" >> "$LOG"
