#!/usr/bin/env python3
"""Фикстура wave-xl: репозиторий textkit с базовым коммитом и ТЗ на двенадцать модулей и сквозные правки.

    python3 -I gen.py <каталог>

Каталог не должен существовать. Скрытый оракул (`oracle/`) в дерево не кладётся: проверка идёт
`grade.py <дерево>`.
"""
import os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
dest = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else sys.exit('usage: gen.py <dir>')
if os.path.exists(dest):
    sys.exit('каталог занят: ' + dest)
repo = os.path.join(dest, 'repo')
shutil.copytree(os.path.join(HERE, 'base'), repo)
shutil.copy(os.path.join(HERE, 'TASK.md'), os.path.join(repo, 'TASK.md'))
env = {**os.environ, 'GIT_AUTHOR_NAME': 'probe', 'GIT_AUTHOR_EMAIL': 'probe@local',
       'GIT_COMMITTER_NAME': 'probe', 'GIT_COMMITTER_EMAIL': 'probe@local'}
for cmd in (['git', 'init', '-q', '-b', 'main'], ['git', 'add', '-A'], ['git', 'commit', '-qm', 'textkit 0.1.0']):
    subprocess.run(cmd, cwd=repo, env=env, check=True)
print(repo)
