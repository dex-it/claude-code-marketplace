#!/usr/bin/env python3
"""Оценка дерева волны или одиночной сессии: скрытый оракул, `npm test`, состояние git.

    python3 -I grade.py <дерево> [--branch B]

Печатает JSON: сколько проверок оракула прошло по модулям, зелёный ли `npm test`, число коммитов от
базового. Код выхода 0 - оракул 31 из 31 и `npm test` зелёный.
"""
import argparse, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('tree')
ap.add_argument('--branch')
a = ap.parse_args()
tree = os.path.abspath(a.tree)
if a.branch:
    subprocess.run(['git', '-C', tree, 'checkout', '-q', a.branch], check=True)

def run(cmd, **kw):
    return subprocess.run(cmd, cwd=kw.pop('cwd', tree), capture_output=True, text=True, **kw)

per = {}
for name in ('duration', 'lru', 'semver', 'lru-ttl', 'shared'):
    r = run(['node', '--test', os.path.join(HERE, 'oracle', name + '.test.mjs')], env={**os.environ, 'ORACLE_REPO': tree})
    m_pass = re.search(r'^# pass (\d+)|^ℹ pass (\d+)', r.stdout, re.M)
    m_fail = re.search(r'^# fail (\d+)|^ℹ fail (\d+)', r.stdout, re.M)
    p = int(next(g for g in m_pass.groups() if g)) if m_pass else 0
    f = int(next(g for g in m_fail.groups() if g)) if m_fail else 0
    # файл, не загрузившийся (нет модуля), - вся его группа провалена
    per[name] = {'pass': p, 'fail': f, 'loaded': bool(m_pass)}
expected = {'duration': 8, 'lru': 9, 'semver': 7, 'lru-ttl': 4, 'shared': 3}
passed = sum(v['pass'] for v in per.values())
total = sum(expected.values())
npm = run(['npm', 'test', '--silent'])
npm_pass = re.search(r'ℹ pass (\d+)', npm.stdout)
npm_fail = re.search(r'ℹ fail (\d+)', npm.stdout)
base = run(['git', 'rev-list', '--max-parents=0', 'HEAD']).stdout.split()[0]
commits = len(run(['git', 'rev-list', '--no-merges', f'{base}..HEAD']).stdout.split())
merges = len(run(['git', 'rev-list', '--merges', f'{base}..HEAD']).stdout.split())
status = run(['git', 'status', '--porcelain']).stdout.strip()
out = {'tree': tree, 'oracle': {'passed': passed, 'of': total, 'per_module': per},
       'npm_test': {'ok': npm.returncode == 0, 'pass': int(npm_pass.group(1)) if npm_pass else None,
                    'fail': int(npm_fail.group(1)) if npm_fail else None},
       'commits_from_base': commits, 'merge_commits': merges, 'dirty': bool(status),
       'conflict_markers': bool(run(['git', 'grep', '-l', '-E', '^(<<<<<<<|>>>>>>>) ', 'HEAD']).stdout.strip())}
print(json.dumps(out, ensure_ascii=False, indent=1))
sys.exit(0 if passed == total and npm.returncode == 0 else 1)
