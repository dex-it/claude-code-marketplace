import json,glob,os,collections,sys
root=sys.argv[1]
cfgs=['haiku-medium','haiku-high','sonnet-low','sonnet-medium','sonnet-high','opus-medium']
res=collections.defaultdict(list)  # (cfg,case)->[(ok,cost,wall)]
for f in glob.glob(root+'/*/*/*/result.json'):
    if os.path.getsize(f)==0: continue
    parts=f.split('/'); cfg,trial,case=parts[-4],parts[-3],parts[-2]
    d=json.loads(open(f).read().strip().split("\n")[0]); res[(cfg,case)].append((d['ok'],d['run']['cost_usd'] or 0,d['run']['wall_ms']/1000,trial))
cases=['O-%02d'%i for i in range(1,14)]
print('case      '+'  '.join('%-16s'%c for c in cfgs))
tot={c:[0,0,0.0,0.0] for c in cfgs}
for case in cases:
    row=[]
    for c in cfgs:
        r=res.get((c,case),[])
        s=''.join('+' if x[0] else '-' for x in r) or '.'
        row.append('%-16s'%s)
        for x in r:
            tot[c][0]+=x[0]; tot[c][1]+=1; tot[c][2]+=x[1]; tot[c][3]+=x[2]
    print('%-9s '%case+'  '.join(row))
print()
for c in cfgs:
    p,n,cost,wall=tot[c]
    if n: print('%-14s pass %2d/%2d (%.0f%%)  cost/run $%.3f  cost/pass $%s  wall/run %.0fs'%(c,p,n,100*p/n,cost/n,('%.3f'%(cost/p) if p else 'n/a'),wall/n))
