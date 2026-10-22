import json,glob,re,os,sys

# Диагностика прогонов по журналу stream-json: какие источники ключа исполнитель открыл (путь в команде
# или инструменте) и какие id попали в выдачу инструментов. Пишет sources.json в каталог прогона.
# Использование: BIG_WORK=<каталог прогонов> python3 sources-from-log.py
# Граница мерила: источник считается открытым, если его путь или id встретились в любом вводе инструмента, в том
# числе Glob и ls - листинг каталога засчитывается как чтение. Для диагностики годится, вердикты по нему одному не выносятся.
LOG=os.environ['BIG_WORK']+'/log/'
RUNS=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','codebase-conventions','runs')
TOK={'f1':['ADR-0026','ADR-0021','RUL-0009','SHP-ADR-002','ADR-0012','RUL-0011','engineering-rules'],
     'r1':['ADR-0026','ADR-0021','RUL-0009','PAY-ADR-001','PAY-ADR-003','PAY-ADR-004','RUL-0011','RUL-0018','engineering-rules'],
     'n0':['CAT-ADR-002','ADR-0025','RUL-0016','engineering-rules']}
for f in sorted(glob.glob(LOG+'big-*.jsonl')):
    rid=os.path.basename(f)[:-6]; case=rid.split('-')[1]
    opened=set(); seen=set(); inputs=[]
    for l in open(f):
        try:m=json.loads(l)
        except: continue
        c=m.get('message',{}).get('content') if isinstance(m.get('message'),dict) else None
        if not isinstance(c,list): continue
        for x in c:
            if x.get('type')=='tool_use':
                i=x['input']; s=' '.join(str(v) for v in i.values()); inputs.append(s)
            if x.get('type')=='tool_result':
                t=x.get('content'); t=' '.join(y.get('text','') for y in t) if isinstance(t,list) else str(t)
                for k in TOK[case]:
                    if k in t: seen.add(k)
    for k in TOK[case]:
        if any(k in s for s in inputs): opened.add(k)  # id/path названы в команде или пути
    # файл открыт: ищем чтение файла по имени ADR/RUL-файла
    pats={'ADR-0026':'ADR-0026','ADR-0021':'ADR-0021','RUL-0009':'data-and-money','RUL-0011':'messaging','RUL-0018':'testing-and-style','RUL-0016':'testing-and-style',
          'SHP-ADR-002':'SHP-ADR-002','PAY-ADR-001':'PAY-ADR-001','PAY-ADR-003':'PAY-ADR-003','PAY-ADR-004':'PAY-ADR-004','CAT-ADR-002':'CAT-ADR-002','ADR-0025':'ADR-0025','ADR-0012':'ADR-0012','engineering-rules':'engineering-rules'}
    op={k for k in TOK[case] if any(pats[k] in s for s in inputs)}
    out={'opened_by_path':sorted(op),'seen_in_output':sorted(seen)}
    p=os.path.join(RUNS,rid)
    if os.path.isdir(p): json.dump(out,open(p+'/sources.json','w'),ensure_ascii=False)
    print(rid,'opened:',','.join(sorted(op)) or '-','| seen:',','.join(sorted(seen)) or '-')
