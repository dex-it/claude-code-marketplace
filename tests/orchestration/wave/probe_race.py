#!/usr/bin/env python3
"""E1/E2 без модели: гонки worktree.py и ledger.py при N параллельных целях в одном репозитории; дерево от заданной базы.

    DEX_AUTO_DIR=<плагин dex-auto> python3 -I probe_race.py [N=8] [раундов=25]

Каждый раунд: N целей параллельно (`worktree.py path`, `ledger.py open/set`), затем сверка деревьев и меток
каталога запуска и параллельный `worktree.py drop`. В конце - дерево от базы: без ветки (от HEAD главного
дерева), с заранее заведённой веткой `auto/<TASK>` от ветки предшественника, при главном дереве на ветке
предшественника. Рабочие каталоги временные, удаляются.
"""
import json, os, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

DEX_AUTO = os.environ.get('DEX_AUTO_DIR') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../plugins/auto/dex-auto'))
HOOKS = os.path.join(DEX_AUTO, 'hooks/scripts')
N = int(sys.argv[1]) if len(sys.argv) > 1 else 8
ROUNDS = int(sys.argv[2]) if len(sys.argv) > 2 else 25

work = os.path.realpath(tempfile.mkdtemp(prefix='wave-probe-'))
repo = os.path.join(work, 'repo')
cfg = os.path.join(work, 'cfg')
os.makedirs(repo); os.makedirs(cfg)
env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_') and k != 'DEX_AUTO_CWD'}
env.update({'CLAUDE_CONFIG_DIR': cfg, 'CLAUDE_CODE_SESSION_ID': 'probe-session'})

def sh(*a, cwd=repo, check=True, **kw):
    r = subprocess.run(list(a), cwd=cwd, env=env, text=True, capture_output=True, **kw)
    if check and r.returncode != 0:
        raise RuntimeError('%s -> %s %s' % (a, r.returncode, r.stderr))
    return r

sh('git', 'init', '-q', '-b', 'main')
sh('git', 'config', 'user.email', 'p@p'); sh('git', 'config', 'user.name', 'p')
open(os.path.join(repo, 'a.txt'), 'w').write('a\n')
sh('git', 'add', '-A'); sh('git', 'commit', '-qm', 'c0')
c0 = sh('git', 'rev-parse', 'HEAD').stdout.strip()

def goal_i(i):
    t = 'T%d' % i
    out = {}
    r = sh('python3', '-I', HOOKS + '/worktree.py', 'path', t, check=False)
    out['path_rc'] = r.returncode; out['path_err'] = r.stderr.strip()[:200]; out['path'] = r.stdout.strip()
    for args in (['open', t], ['set', t, 'Режим', 'autonomous'], ['set', t, 'Ожидает', ''], ['set', t, 'Нехватка', 'x%d' % i]):
        r = sh('python3', '-I', HOOKS + '/ledger.py', *args, check=False)
        if r.returncode != 0:
            out.setdefault('ledger_err', []).append((args[0], r.returncode, r.stderr.strip()[:200]))
    return out

fails = {'path_rc': 0, 'ledger': 0, 'tree_wrong': 0, 'drop': 0}
errs = []
for rnd in range(ROUNDS):
    with ThreadPoolExecutor(N) as ex:
        res = list(ex.map(goal_i, range(1, N + 1)))
    for i, o in enumerate(res, 1):
        if o['path_rc'] != 0:
            fails['path_rc'] += 1; errs.append(('path', rnd, i, o['path_err']))
        if o.get('ledger_err'):
            fails['ledger'] += 1; errs.append(('ledger', rnd, i, o['ledger_err']))
    # деревья: ровно N, у каждого своя ветка и метка каталога запуска
    wl = sh('git', 'worktree', 'list', '--porcelain').stdout
    trees = [l.split(' ', 1)[1] for l in wl.splitlines() if l.startswith('worktree ')]
    for i in range(1, N + 1):
        p = repo + '-T%d' % i
        if p not in trees:
            fails['tree_wrong'] += 1; errs.append(('tree-missing', rnd, i, p)); continue
        br = sh('git', '-C', p, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.strip()
        gd = sh('git', '-C', p, 'rev-parse', '--absolute-git-dir').stdout.strip()
        mark = open(os.path.join(gd, 'dex-auto-launch')).read().strip() if os.path.exists(os.path.join(gd, 'dex-auto-launch')) else None
        if br != 'auto/T%d' % i or mark != repo:
            fails['tree_wrong'] += 1; errs.append(('tree-wrong', rnd, i, br, mark))
    # изоляция: в одном дереве коммит не виден в других
    if rnd == 0:
        p1 = repo + '-T1'
        open(os.path.join(p1, 'f1.txt'), 'w').write('one\n')
        sh('git', '-C', p1, 'add', '-A'); sh('git', '-C', p1, 'commit', '-qm', 'f1')
    def drop(i):
        r = sh('python3', '-I', HOOKS + '/worktree.py', 'drop', 'T%d' % i, check=False)
        return i, r.returncode, r.stderr.strip()[:200]
    with ThreadPoolExecutor(N) as ex:
        for i, rc, err in ex.map(drop, range(1, N + 1)):
            if rc != 0:
                fails['drop'] += 1; errs.append(('drop', rnd, i, err))

ledger_root = sh('python3', '-I', HOOKS + '/ledger.py', 'root').stdout.strip()
open_goals = sh('python3', '-I', HOOKS + '/ledger.py', 'find').stdout.strip().splitlines()
e1 = {'N': N, 'rounds': ROUNDS, 'fails': fails, 'errors_sample': errs[:6],
      'open_goals_seen': len(open_goals), 'branches': sorted(l.strip() for l in sh('git', 'branch', '--list', 'auto/*').stdout.splitlines()),
      'T1_branch_has_f1': 'f1' in sh('git', 'log', '--format=%s', 'auto/T1').stdout}

# E2: дерево цели от заданной базы
sh('git', 'branch', '-D', *['auto/T%d' % i for i in range(2, N + 1)])
sh('git', 'checkout', '-q', 'auto/T1')
open(os.path.join(repo, 'g.txt'), 'w').write('g\n'); sh('git', 'add', '-A'); sh('git', 'commit', '-qm', 'on-T1')
c1 = sh('git', 'rev-parse', 'HEAD').stdout.strip()
sh('git', 'checkout', '-q', 'main')
r_default = sh('python3', '-I', HOOKS + '/worktree.py', 'path', 'DEFAULT')
head_default = sh('git', '-C', r_default.stdout.strip(), 'rev-parse', 'HEAD').stdout.strip()
sh('git', 'branch', 'auto/DEP', 'auto/T1')                       # ветка от базы заводится заранее
r_dep = sh('python3', '-I', HOOKS + '/worktree.py', 'path', 'DEP')
head_dep = sh('git', '-C', r_dep.stdout.strip(), 'rev-parse', 'HEAD').stdout.strip()
sh('git', 'checkout', '-q', 'auto/T1')                           # главное дерево на ветке предшественника
r_cur = sh('python3', '-I', HOOKS + '/worktree.py', 'path', 'CUR')
head_cur = sh('git', '-C', r_cur.stdout.strip(), 'rev-parse', 'HEAD').stdout.strip()
e2 = {'main_c0': c0[:8], 'T1_head': c1[:8],
      'tree_from_main(no base)': head_default[:8], 'tree_with_precreated_branch(auto/DEP from auto/T1)': head_dep[:8],
      'tree_when_main_tree_on_T1': head_cur[:8]}
print(json.dumps({'E1': e1, 'E2': e2}, ensure_ascii=False, indent=1))
shutil.rmtree(work, ignore_errors=True)
for i in list(range(1, N + 1)) + ['DEFAULT', 'DEP', 'CUR']:
    shutil.rmtree(repo + '-T%s' % i if isinstance(i, int) else repo + '-' + i, ignore_errors=True)
