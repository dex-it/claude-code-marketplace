#!/usr/bin/env python3
"""Оценка дерева wave-xl: скрытый оракул по файлам `oracle/*.test.mjs`, `npm test`, состояние git.

    python3 -I grade.py <дерево>
    python3 -I grade.py --selfcheck     # эталон oracle/ref, пишет oracle/expected.json

Код выхода 0 - оракул целиком и `npm test` зелёный.
"""
import argparse, glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ORACLE = os.path.join(HERE, 'oracle')
ap = argparse.ArgumentParser()
ap.add_argument('tree', nargs='?')
ap.add_argument('--selfcheck', action='store_true')
a = ap.parse_args()
tree = os.path.join(ORACLE, 'ref') if a.selfcheck else os.path.abspath(a.tree)

def run(cmd, **kw):
    return subprocess.run(cmd, cwd=kw.pop('cwd', tree), capture_output=True, text=True, **kw)

def count(pattern, text):
    m = re.search(pattern, text, re.M)
    return int(m.group(1)) if m else 0

per = {}
for f in sorted(glob.glob(os.path.join(ORACLE, '*.test.mjs'))):
    name = os.path.basename(f)[:-len('.test.mjs')]
    r = run(['node', '--test', '--test-reporter=spec', f], env={**os.environ, 'ORACLE_REPO': tree})
    # файл, не загрузившийся (нет модуля), - вся его группа провалена
    per[name] = {'pass': count(r'^ℹ pass (\d+)', r.stdout), 'fail': count(r'^ℹ fail (\d+)', r.stdout)}
exp_path = os.path.join(ORACLE, 'expected.json')
if a.selfcheck:
    bad = {k: v for k, v in per.items() if v['fail'] or not v['pass']}
    json.dump({k: v['pass'] for k, v in per.items()}, open(exp_path, 'w'), indent=1)
    print(json.dumps({'per_module': per, 'bad': bad}, indent=1))
    sys.exit(1 if bad else 0)
expected = json.load(open(exp_path))
passed = sum(min(per.get(k, {}).get('pass', 0), n) for k, n in expected.items())
total = sum(expected.values())
# reporter явно: без TTY Node < 23 печатает tap, и разбор `ℹ pass` молча дал бы 0
npm = run(['npm', 'test', '--silent', '--', '--test-reporter=spec'])
base = run(['git', 'rev-list', '--max-parents=0', 'HEAD']).stdout.split()[0]
out = {'tree': tree, 'oracle': {'passed': passed, 'of': total,
                                'per_module': {k: f"{per.get(k, {}).get('pass', 0)}/{n}" for k, n in expected.items()}},
       'npm_test': {'ok': npm.returncode == 0, 'pass': count(r'ℹ pass (\d+)', npm.stdout),
                    'fail': count(r'ℹ fail (\d+)', npm.stdout)},
       'commits_from_base': len(run(['git', 'rev-list', f'{base}..HEAD']).stdout.split()),
       'dirty': bool(run(['git', 'status', '--porcelain']).stdout.strip())}
print(json.dumps(out, ensure_ascii=False, indent=1))
sys.exit(0 if passed == total and npm.returncode == 0 else 1)
