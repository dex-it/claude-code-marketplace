# dex-skill-mr-review-track

Заглушка - перенос без переработки. Источник:
`plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/tracks/mr-review.md`
(старый движок `autonomous-task`).

Ревью входящего MR: read-only, находки с severity, фальсификация каждой против кода, покрытие
тестами отдельным фокусом, ре-ревью дельты через `dex-mr-check-reviewer:mr-check-reviewer`.

Полный редизайн под идиому фаз-контракта - отдельный будущий пакет, не эта поставка.
