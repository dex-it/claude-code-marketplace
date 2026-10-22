# Общая песочница git для раннеров прогонов (source из run-*.sh).
# `Bash(git *)` без этого пускает исполнение произвольной команды через git: `git -c core.pager=...`,
# `git -c alias.x=!...`, `--config-env`, запись алиаса командой `git config`. Запреты стоят отдельным
# списком (deny сильнее allow), окружение закрывает системный и пользовательский конфиг и пейджер.
# Окружение подаётся только вызову claude (`env "${GIT_SANDBOX_ENV[@]}" claude ...`): setup мини-проекта
# в том же процессе коммитит с настоящей личностью.
GIT_SANDBOX_ENV=(GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_PAGER=cat)
GIT_DENY=('Bash(git -c *)' 'Bash(git * -c *)' 'Bash(git --config-env*)' 'Bash(git * --config-env*)' 'Bash(git config*)' 'Bash(git * config*)')
