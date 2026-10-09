import json,glob,os,itertools,collections,sys
root=sys.argv[1]
cfgs=['haiku-medium','haiku-high','sonnet-low','sonnet-medium','sonnet-high','opus-medium']
res=collections.defaultdict(list)
for f in glob.glob(root+'/*/*/*/result.json'):
    if os.path.getsize(f)==0: continue
    parts=f.split('/'); cfg,case=parts[-4],parts[-2]
    d=json.loads(open(f).read().strip().split('\n')[0]); res[(cfg,case)].append((bool(d['ok']),d['run']['cost_usd'] or 0,d['run']['wall_ms']/1000))
cases=['O-%02d'%i for i in range(1,14)]
def avg(cfg,case,i): 
    r=res[(cfg,case)]; return r[i%len(r)] if r else None
policies={
 'sonnet-medium всем':['sonnet-medium'],
 'sonnet-high всем':['sonnet-high'],
 'opus-medium всем':['opus-medium'],
 'лестница, 3 попытки: haiku-m, haiku-h, sonnet-m':['haiku-medium','haiku-high','sonnet-medium'],
 'лестница, 4 попытки: + sonnet-h':['haiku-medium','haiku-high','sonnet-medium','sonnet-high'],
 'лестница, 5 попыток: + opus-m':['haiku-medium','haiku-high','sonnet-medium','sonnet-high','opus-medium'],
 'sonnet-m -> sonnet-h -> opus-m':['sonnet-medium','sonnet-high','opus-medium'],
 'haiku-m -> sonnet-low -> opus-m':['haiku-medium','sonnet-low','opus-medium'],
}
print('%-34s %8s %10s %10s %10s'%('политика','pass','$/кейс','$ всего','мин (посл.)'))
for name,chain in policies.items():
    tot=0; passed=0; n=0; wall=0
    for case in cases:
        # перебор пар независимых прогонов: индекс прогона на каждой ступени
        for combo in itertools.product(range(2),repeat=len(chain)):
            ok=False; cost=0; w=0
            for step,cfg in enumerate(chain):
                r=avg(cfg,case,combo[step])
                if r is None: break
                cost+=r[1]; w+=r[2]
                if r[0]: ok=True; break
            tot+=cost; passed+=ok; n+=1; wall+=w
    print('%-34s %5.0f%% %10.3f %10.2f %10.1f'%(name,100*passed/n,tot/n,tot/n*13,wall/n*13/60))
