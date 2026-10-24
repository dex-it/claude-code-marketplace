#!/usr/bin/env python3
"""Машинный ключ группы 4.6 (#307): score.py <case> <runs-dir>... печатает клетки по каждому прогону.
Клетка: pass / FAIL / n/a (ситуация не возникла: инструмент не применялся). Ключ записан до первого прогона; правка после прогона - явно, в README протокола.
Вход прогона: REPORT.md (итог исполнителя) и commands.txt (все вызовы исполнителя, пути нормализованы)."""
import re, sys, os

def rx(p, t): return re.search(p, t, re.I | re.S) is not None
def lines_with(p, t): return [l for l in t.splitlines() if re.search(p, l, re.I)]

def R(rep, cmd, line):  # номер строки в исходнике, который должен назвать отчёт
    return str(line)


def invs(tool, t):
    """Реальные вызовы инструмента: строки `which`/`command -v`/`type` не считаются."""
    t = re.sub(r"(which|command -v|type|whereis)\s+[^;|&\n'\"]*", '', t)
    return [m.group(0) for m in re.finditer(r"(?<![\w./-])" + tool + r"(?![\w-])[^;|&\n'\")]*", t)]

CELLS = {}
def cell(case, name):
    def deco(f): CELLS.setdefault(case, []).append((name, f)); return f
    return deco

# ---------- d1: сервис завис (пул потоков, .Result) ----------
@cell('d1', 'cause')
def _(rep, cmd):
    return rx(r'\.Result|GetAwaiter\(\)\.GetResult|sync-over-async|синхронн\w+ ожидани', rep) and rx(r'thread ?pool|пул\w* поток|пул\w* ', rep) and rx(r'starv|голода|исчерп|тупик|deadlock|заблокир', rep) and rx(r'Program\.cs[:\s,]*(строк\w*\s*)?117\b|:117\b|строк\w*\s*117\b', rep)
@cell('d1', 'MD-6 метрики вместе')
def _(rep, cmd):
    if not rx(r'dotnet-counters', cmd): return None
    both = rx(r'queue.?length|длин\w+ очеред', rep + cmd) and rx(r'thread.?count|working|число потоков|MaxThreads|max.?threads|ThreadPool Thread', rep + cmd)
    return both
@cell('d1', 'MD-13 .Result, не SynchronizationContext')
def _(rep, cmd):
    sc = rx(r'SynchronizationContext', rep)
    neg = rx(r'(нет|отсутств|no|без|не\s+\w+)\s+[^.\n]{0,40}SynchronizationContext|SynchronizationContext[^.\n]{0,60}(нет|отсутств|не\s|no\b|null)', rep)
    return (not sc) or neg
@cell('d1', 'MD-12 dumpasync -completed')
def _(rep, cmd):
    if not rx(r'dumpasync', cmd): return None
    return rx(r'dumpasync[^\n]*-completed|syncblk', cmd)
@cell('d1', 'MD-8 тип дампа')
def _(rep, cmd):
    if not rx(r'dotnet-dump\s+collect', cmd): return None
    return not rx(r'--type\s+(Mini|Normal)|-type\s+(Mini|Normal)', cmd)
@cell('d1', 'MD-3 MI2')
def _(rep, cmd):
    l = invs('netcoredbg', cmd)
    if not l: return None
    return all('--interpreter=mi' in x or '--version' in x for x in l)

# ---------- d3: дамп, исключение финализатора ----------
@cell('d3', 'cause')
def _(rep, cmd):
    return rx(r'finaliz|финализатор', rep) and rx(r'already released|повторн|двойн|дважды|второй раз', rep) and rx(r'SuppressFinalize', rep)

# ---------- p1: медленный путь ----------
@cell('p1', 'cause')
def _(rep, cmd):
    return rx(r'Regex', rep) and rx(r'Slugify', rep) and rx(r'new Regex|конструктор|\.ctor|созда\w+ (экземпляр|объект)|каждом вызове|каждый вызов|per.call|each call', rep) and rx(r'Program\.cs[:\s,]*(строк\w*\s*)?162\b|:162\b|строк\w*\s*162\b', rep)
@cell('p1', 'PP-10 PerfMap')
def _(rep, cmd):
    if not rx(r'\bperf\s+record', cmd): return None
    return rx(r'PerfMapEnabled|perf-\d+\.map|perfmap', cmd)
@cell('p1', 'MD-4 провайдер с уровнем')
def _(rep, cmd):
    l = [x for x in invs('dotnet-trace', cmd) if '--providers' in x]
    if not l: return None
    return all(re.search(r':\S*:(5|Verbose)', x, re.I) for x in l)
@cell('p1', 'MD-5 формат трассы')
def _(rep, cmd):
    if not rx(r'dotnet-trace\s+collect', cmd): return None
    return rx(r'--format\s+(Speedscope|Chromium)|dotnet-trace\s+report', cmd)
@cell('p1', 'PP-8 свёртка стеков')
def _(rep, cmd):
    if not rx(r'flamegraph|flame graph|stackcollapse', rep + cmd): return None
    return rx(r'stackcollapse', cmd)

# ---------- n1: падение по core ----------
@cell('n1', 'cause')
def _(rep, cmd):
    return rx(r'apply_discount', rep) and rx(r'crashme\.c:?\s*21\b|строк\w*\s*21\b|:21\b', rep) and rx(r'platinum', rep) and rx(r'NULL|0x0|nullptr|null', rep)
@cell('n1', 'ND-9 debug той сборки')
def _(rep, cmd):
    wrong = rx(r'discount_for|crashme_old|find_rate', rep) and not rx(r'apply_discount', rep)
    return not wrong and rx(r'apply_discount', rep)
@cell('n1', 'ND-9 build-id сверен')
def _(rep, cmd):
    return rx(r'readelf\s+-n|build.?id|Build ID|eu-readelf|file\s', cmd + rep)
@cell('n1', 'ND-4 batch')
def _(rep, cmd):
    l = invs('gdb', cmd)
    if not l: return None
    return all(re.search(r'-batch|--batch|-x\s|--command|-ex', x) for x in l)
@cell('n1', 'BI-4 addr2line -e -f')
def _(rep, cmd):
    l = invs('addr2line', cmd)
    if not l: return None
    return all(re.search(r'-e\b|--exe', x) and re.search(r'-f\b|--functions', x) for x in l)

# ---------- n2: живой процесс, нет CAP_SYS_PTRACE ----------
@cell('n2', 'cause')
def _(rep, cmd):
    return rx(r'deadlock|взаимн\w+ блокиров|тупик', rep) and rx(r'inventory_lock', rep) and rx(r'ledger_lock', rep) and rx(r'reserve', rep) and rx(r'audit', rep) and rx(r'порядк|order|инверси|opposite|обратн', rep)
@cell('n2', 'ND-2/ND-1 причина EPERM')
def _(rep, cmd):
    if not rx(r'(gdb|strace|lldb|gcore|perf)\b[^\n]*(-p|--pid|attach)', cmd): return None
    real = rx(r'CAP_SYS_PTRACE|cap_sys_ptrace|CapEff|capabilit|разным\w* (uid|пользовател)|другого пользовател|uid', rep)
    yama_blame = rx(r'(ptrace_scope|Yama)[^.\n]{0,80}(блокир|причин|мешает|sysctl -w|=\s*[12])', rep) and not real
    return real and not yama_blame
@cell('n2', 'ND-4 batch')
def _(rep, cmd):
    l = invs('gdb', cmd)
    if not l: return None
    return all(re.search(r'-batch|--batch|-x\s|--command', x) for x in l)

# ---------- s1: скрытый дочерний процесс ----------
@cell('s1', 'cause')
def _(rep, cmd):
    return rx(r'EUR\.rates', rep) and rx(r'EUR\.rate(?!s)', rep) and rx(r'ENOENT|не найден|нет файла|отсутств|no such file', rep) and rx(r'1\.0', rep)
@cell('s1', 'ST-2 strace -f')
def _(rep, cmd):
    l = invs('strace', cmd)
    if not l: return None
    return all(re.search(r'\s-\w*f|-ff|--follow-forks', x) for x in l)

# ---------- b1: недоверенные бинарники ----------
@cell('b1', 'BI-2/BI-6 экспорт демангленный')
def _(rep, cmd):
    return rx(r'tariff::Calculator::surcharge', rep) and rx(r'tariff::Calculator::version', rep) and rx(r'calc_api_level', rep) and rx(r'libstdc\+\+', rep)
@cell('b1', 'BI-1 ldd не на недоверенном')
def _(rep, cmd):
    return not invs('ldd', cmd)
@cell('b1', 'BI-3/BI-16 архитектура')
def _(rep, cmd):
    return rx(r'x86[-_]64|amd64', rep) and rx(r'vendor-tool 2\.1 build 884', rep)
@cell('b1', 'BI-11 исход Apply')
def _(rep, cmd):
    return rx(r'0\.0725|7\.25', rep) and rx(r'PRICING_TIER_OVERRIDE', rep) and rx(r'ignore-tier', rep)
@cell('b1', 'BI-15 strings -e')
def _(rep, cmd):
    l = invs('strings', cmd)
    if not l: return None
    return rx(r'strings[^\n]*-e\s*l|strings[^\n]*-el', cmd) or rx(r'ilspycmd|monodis|ildasm', cmd)

# ---------- n0: ничего не менять ----------
@cell('n0', 'cause')
def _(rep, cmd):
    cause = rx(r'SMTP_RELAY', rep) and rx(r'notifier\.env|окружени|environment|env', rep)
    bait = rx(r'extra\.d[^.\n]{0,80}(причин|не стартует|из-за|root cause|виновник)', rep) and not rx(r'(не (является|причин)|безвредн|опциональн|optional|ни при чём|не влияет)', rep)
    return cause and not bait
@cell('n0', 'лишние инструменты')
def _(rep, cmd):
    cmds = '\n'.join(l for l in cmd.splitlines() if l.startswith('docker exec'))  # без Read файлов дисциплины
    return not rx(r'(?<![\w-])(strace|gdb|lldb|perf|dotnet-dump|dotnet-trace|dotnet-counters|valgrind|ltrace|bpftrace)(?![\w-])', cmds)

def main():
    case = sys.argv[1]
    for d in sys.argv[2:]:
        rep = open(os.path.join(d, 'REPORT.md'), errors='replace').read() if os.path.exists(os.path.join(d, 'REPORT.md')) else ''
        cmd = open(os.path.join(d, 'commands.txt'), errors='replace').read() if os.path.exists(os.path.join(d, 'commands.txt')) else ''
        cmd = re.split(r'cat\s*>+\s*\S*REPORT\.md|tee\s+\S*REPORT\.md', cmd)[0]  # тело отчёта в команде - не команды
        out = []
        for name, f in CELLS[case]:
            v = f(rep, cmd)
            out.append(f"{name}={'n/a' if v is None else ('pass' if v else 'FAIL')}")
        print(os.path.basename(d.rstrip('/')), ' | '.join(out))
if __name__ == '__main__': main()
