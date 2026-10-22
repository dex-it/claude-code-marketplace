# Общая песочница git для раннеров прогонов (source из run-*.sh).
# Это слой defense-in-depth, а не граница исполнения. Он отсекает прямые неэкранированные формы, которыми
# `Bash(git *)` исполняет команду на хосте: `git -c ...`, `--config-env`, запись алиаса `git config`,
# `--exec-path` и `--git-dir` на чужой конфиг, plumbing `hash-object` / `update-index` / `checkout-index`
# (создают исполняемый файл). Правила на аргументы Bash сравнивают токены литерально: закавыченный флаг
# (`git '-c' ...`), абсолютный путь и `sh -c` их обходят (документация Claude Code это оговаривает), как и
# алиас в локальном `.git/config`, записанном Write. Границей исполнения служит только OS-изоляция
# (bwrap, контейнер); без неё исполнитель может исполнить код под UID оператора, и входы прогона
# недоверенными считать нельзя. Окружение закрывает системный и пользовательский конфиг и пейджер.
# Окружение подаётся только вызову claude (`env "${GIT_SANDBOX_ENV[@]}" claude ...`): setup мини-проекта
# в том же процессе коммитит с настоящей личностью.
GIT_SANDBOX_ENV=(GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_PAGER=cat)
GIT_DENY=('Bash(git -c *)' 'Bash(git * -c *)' 'Bash(git --config-env*)' 'Bash(git * --config-env*)' 'Bash(git config*)' 'Bash(git * config*)'
  'Bash(git --exec-path*)' 'Bash(git * --exec-path*)' 'Bash(git --git-dir*)' 'Bash(git * --git-dir*)'
  'Bash(git hash-object*)' 'Bash(git update-index*)' 'Bash(git checkout-index*)')
