# Выгрузка тредов ревью

Выгрузка хостинга от 2026-10-10: файл на MR, `mr-<iid>.json`. Поля MR - `iid`, `title`, `author`, `created_at`,
`merged_at`, `state`, `commits` (заголовок и дата; sha - в `git log` по заголовку). Тред - `id`, `author`,
`created_at`, `file`, `body`, `resolved`, `notes` (ответы). Адрес треда в своде - `!<iid>#<id>`.
