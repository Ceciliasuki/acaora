"""Acaora processed-table reproduction runtime. Read README.txt before running."""
import hashlib
import json
import math
import platform
import re
from pathlib import Path
import numpy as np
import scipy
from scipy import stats
import statsmodels
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parent

def canonical_json(value):
    """The manifest's JS canonical JSON (UTF-16 key order, finite JS numbers)."""
    if value is None or isinstance(value, (str, bool)):
        quoted = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        return ''.join('\\u%04x' % ord(c) if 0xd800 <= ord(c) <= 0xdfff else c for c in quoted)
    if isinstance(value, (int, float)):
        number = float(value)
        if not math.isfinite(number): raise ValueError('Non-finite verification setting')
        if number == 0: return '0'
        negative = '-' if number < 0 else ''; token = repr(abs(number)).lower()
        mantissa, _, exponent = token.partition('e'); power = int(exponent or '0')
        whole, _, fraction = mantissa.partition('.'); digits = (whole + fraction).rstrip('0')
        point = len(whole) + power
        if 1e-6 <= abs(number) < 1e21:
            body = '0.' + '0' * (-point) + digits if point <= 0 else digits + '0' * (point-len(digits)) if point >= len(digits) else digits[:point]+'.'+digits[point:]
        else:
            power = point-1; body = digits[0] + ('.'+digits[1:] if len(digits)>1 else '') + 'e' + ('+' if power>=0 else '') + str(power)
        return negative + body
    if isinstance(value, list): return '[' + ','.join(canonical_json(v) for v in value) + ']'
    if isinstance(value, dict):
        return '{' + ','.join(canonical_json(k)+':'+canonical_json(value[k]) for k in sorted(value, key=lambda k:k.encode('utf-16-be', errors='surrogatepass'))) + '}'
    raise ValueError('Unsupported verification setting')

def verification_identity(manifest, actual_fingerprint):
    if 'verificationIdentity' not in manifest: return None
    identity = manifest['verificationIdentity']; keys = {'engine','settingsHash','dataFingerprint','sourceFingerprint'}
    if not isinstance(identity, dict) or set(identity) != keys or any(not isinstance(identity[k],str) for k in keys): raise ValueError('Invalid verificationIdentity')
    if any(not re.fullmatch('[a-f0-9]{64}', identity[k]) for k in keys-{'engine'}): raise ValueError('Invalid verification fingerprint')
    analysis = manifest['analysis']; engines = {'basic':'acaora-stats-v2','ols':'acaora-ols-v2','advanced':'acaora-advanced-v4'}
    if identity['engine'] != engines.get(analysis['kind']): raise ValueError('Verification engine mismatch')
    if identity['dataFingerprint'] != actual_fingerprint: raise ValueError('Verification data SHA-256 mismatch')
    settings = canonical_json({'kind':analysis['kind'],'config':analysis['config']}).encode('utf-8')
    if identity['settingsHash'] != hashlib.sha256(settings).hexdigest(): raise ValueError('Verification settings SHA-256 mismatch')
    # The original source is not in this pack: sourceFingerprint is a declaration.
    return dict(identity)

def verification_metrics(analysis, result):
    if analysis['kind'] == 'basic':
        keys = {'describe':['n','mean','sd','min','median','max'], 'relation':['n','r','p','slope','intercept','r2','t']}.get(analysis['config']['method'])
        if not keys or any(k not in result for k in keys): return None
        metrics = [[k,result[k]] for k in keys]
    elif analysis['kind'] == 'ols':
        keys = {'n':'n','r2':'r2','adjustedR2':'adjusted_r2','rmse':'residual_se'}
        fields = {'estimate':'coefficients','se':'se','t':'t','p':'p','low':'low','high':'high','vif':'vif'}
        if any(k not in result for k in [*keys.values(),*fields.values(),'labels']): return None
        labels = result['labels']
        if not labels or any(len(result[k]) != len(labels) for k in fields.values()): return None
        names = ['截距' if i == 0 and label == 'Intercept' else label for i,label in enumerate(labels)]
        if len(set(names)) != len(names): return None
        metrics = [[key,result[field]] for key,field in keys.items()]
        metrics += [[f'coef:{name}:{key}',result[field][i]] for i,name in enumerate(names) for key,field in fields.items()]
    else: return None
    metrics = clean(metrics)
    if any(value is not None and (isinstance(value,bool) or not isinstance(value,(int,float))) for _,value in metrics): return None
    return metrics

def lcg(seed):
    state = int(seed) & 0xffffffff
    while True:
        state = (state * 1664525 + 1013904223) & 0xffffffff
        yield state / 4294967296

def js_sorted(values):
    return sorted(set(values), key=lambda s: s.encode('utf-16-be'))

def assignments(n, k, random):
    order = list(range(n))
    for i in range(n - 1, 0, -1):
        j = int(next(random) * (i + 1))
        order[i], order[j] = order[j], order[i]
    out = np.zeros(n, dtype=int)
    offset = 0
    for f in range(k):
        size = n // k + (f < n % k)
        out[order[offset:offset + size]] = f
        offset += size
    return out

def missing(v):
    return v.strip().lower() in ('', 'na', 'null', 'nan')

def number(v):
    # Match JS Number for ordinary decimal and 0x/0b/0o strings.
    t = v.strip()
    try:
        return float(int(t, 0)) if t.lower().startswith(('0x', '0b', '0o')) else float(t)
    except (ValueError, OverflowError):
        return math.nan

def required(a):
    c = a['config']; m = c.get('method')
    if a['kind'] == 'basic':
        return [c['x']] if m == 'describe' else [c['x'], c['y']] if m == 'relation' else [c['group'], c['value']]
    if a['kind'] == 'ols':
        return [c['outcome']] + c['predictors'] + [v['name'] for v in c.get('categoricals', [])]
    if m in ('pca', 'kmeans'): return c['predictors']
    if m in ('paired', 'wilcoxon'): return [c['outcome'], c['second']]
    if m in ('anova', 'welchanova', 'posthoc', 'mannwhitney'): return [c['outcome'], c['group']]
    if m == 'bootstrap':
        return [c['outcome']] + ([c['second']] if c.get('bootstrapStatistic') in ('paired-difference', 'correlation') else []) + ([c['group']] if c.get('bootstrapStatistic') == 'difference' else []) + ([c['bootstrapCluster']] if c.get('bootstrapUnit') == 'cluster' else [])
    return [c['outcome']] + c['predictors'] + [v['name'] for v in c.get('categoricals', [])] + ([c['group']] if m in ('cluster', 'fixed') or c.get('validation') == 'group' else []) + ([c['time']] if m in ('cv', 'classification') and c.get('validation') == 'time' else [])

def design(rows, c, train=None):
    train = rows if train is None else train
    columns = [np.array([number(r[h]) for r in rows]) for h in c['predictors']]
    labels = list(c['predictors'])
    for spec in c.get('categoricals', []):
        h, ref = spec['name'], spec['reference']; levels = js_sorted(r[h].strip() for r in train)
        if ref not in levels or not 2 <= len(levels) <= 12: raise ValueError(f'Invalid training categories/reference: {h}')
        if any(r[h].strip() not in levels for r in rows): raise ValueError(f'Unseen validation level: {h}')
        for level in levels:
            if level != ref:
                columns.append(np.array([float(r[h].strip() == level) for r in rows]))
                labels.append(f'{h} [{level} vs {ref}]')
    if not 1 <= len(columns) <= 12: raise ValueError('Expanded predictor count outside 1..12')
    return np.column_stack(columns), labels

def safe_logistic(x, y):
    if set(y) != {0., 1.}: raise ValueError('Both binary classes required in each training fold')
    if len(y) <= x.shape[1]: raise ValueError('Insufficient training rows')
    if np.linalg.matrix_rank(x) != x.shape[1]: raise ValueError('Rank deficient design')
    fit = sm.GLM(y, x, family=sm.families.Binomial()).fit(maxiter=100, tol=1e-10)
    if not fit.converged or np.min(fit.fittedvalues * (1-fit.fittedvalues)) < 1e-12: raise ValueError('Separation or nonconvergence')
    return fit

def binary_metrics(y, p, threshold):
    if set(y) != {0., 1.}: raise ValueError('Both classes required for pooled validation')
    positive = sum(y); negative = len(y)-positive
    order = sorted(range(len(y)), key=lambda i: -p[i]); tp=fp=0; roc=[[None,0.,0.]]; pr=[[None,0.,1.]]; auc=ap=last_fpr=last_rec=0.
    i=0
    while i<len(order):
        j=i
        while j<len(order) and p[order[j]]==p[order[i]]:
            tp+=y[order[j]]; fp+=1-y[order[j]]; j+=1
        rec=tp/positive; fpr=fp/negative; precision=tp/(tp+fp)
        auc+=(fpr-last_fpr)*(rec+last_rec)/2; ap+=(rec-last_rec)*precision
        roc.append([p[order[i]],fpr,rec]); pr.append([p[order[i]],rec,precision]); last_fpr=fpr; last_rec=rec; i=j
    pred=p>=threshold; tp=int(sum(pred & (y==1))); fp=int(sum(pred & (y==0))); tn=int(sum(~pred & (y==0))); fn=int(sum(~pred & (y==1)))
    clipped=np.clip(p,1e-15,1-1e-15)
    bins=[]
    for b in range(10):
        select=np.minimum(9,np.floor(p*10))==b
        bins.append([b/10,(b+1)/10,int(sum(select)),float(np.mean(p[select])) if any(select) else None,float(np.mean(y[select])) if any(select) else None])
    return dict(auc=auc,ap=ap,brier=np.mean((p-y)**2),logloss=-np.mean(y*np.log(clipped)+(1-y)*np.log1p(-clipped)),tp=tp,fp=fp,tn=tn,fn=fn,precision=tp/(tp+fp) if tp+fp else None,recall=tp/(tp+fn),specificity=tn/(tn+fp),f1=2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None,roc=roc,pr=pr,calibration=bins)

def run(a, data, verification=False):
    c=a['config']; m=c['method'] if a['kind']!='ols' else 'ols'; cols=required(a)
    if len(cols)!=len(set(cols)) or any(h not in data['headers'] for h in cols): raise ValueError('Invalid/missing required columns')
    text={s['name'] for s in c.get('categoricals',[])}
    if m in ('cluster','fixed','anova','welchanova','posthoc','mannwhitney','test') or (m in ('cv','classification') and c.get('validation')=='group') or (m=='bootstrap' and c.get('bootstrapStatistic')=='difference'): text.add(c['group'])
    if m=='bootstrap' and c.get('bootstrapUnit')=='cluster': text.add(c['bootstrapCluster'])
    indices=[data['headers'].index(h) for h in cols]; rows=[]; row_numbers=[]
    for i,raw in enumerate(data['rows']):
        row={h:raw[j] for h,j in zip(cols,indices)}
        if all(not missing(v) and (h in text or math.isfinite(number(v))) for h,v in row.items()): rows.append(row); row_numbers.append(i+1)
    n=len(rows)
    if n < (1 if m=='describe' else 3): raise ValueError('Insufficient complete observations')
    out={'method':m,'n':n,'excluded':len(data['rows'])-n,'current_table_rows':row_numbers}
    num=lambda h:np.array([number(r[h]) for r in rows])
    if m=='describe':
        x=num(c['x']); out.update(mean=np.mean(x),sd=np.std(x,ddof=1),min=min(x),median=np.median(x),max=max(x),q1=np.quantile(x,.25),q3=np.quantile(x,.75)); return out
    if m=='relation':
        x=num(c['x']); y=num(c['y']); fit=sm.OLS(y,sm.add_constant(x)).fit(); out.update(r=stats.pearsonr(x,y).statistic,coefficients=fit.params,p=fit.pvalues[1],r2=fit.rsquared)
        if verification: out.update(slope=fit.params[1],intercept=fit.params[0],t=fit.tvalues[1])
        return out
    if m in ('paired','wilcoxon'):
        d=num(c['outcome'])-num(c['second']); out['differences']=d
        if m=='paired':
            se=np.std(d,ddof=1)/math.sqrt(n); t=np.mean(d)/se; crit=stats.t.ppf(.975,n-1); out.update(estimate=np.mean(d),se=se,t=t,p=2*stats.t.sf(abs(t),n-1),df=n-1,low=np.mean(d)-crit*se,high=np.mean(d)+crit*se)
        else:
            nonzero=d[d!=0]; fit=stats.wilcoxon(nonzero,zero_method='wilcox',correction=True,method='approx'); out.update(w=fit.statistic,p=fit.pvalue)
        return out
    if m in ('test','anova','welchanova','posthoc','mannwhitney'):
        h=c['value'] if m=='test' else c['outcome']; groups=js_sorted(r[c['group']].strip() for r in rows); samples=[np.array([number(r[h]) for r in rows if r[c['group']].strip()==g]) for g in groups]
        out['groups']=[dict(name=g,n=len(x),mean=np.mean(x),sd=np.std(x,ddof=1)) for g,x in zip(groups,samples)]
        if m in ('test','mannwhitney') and len(groups)!=2: raise ValueError('Exactly two groups required')
        if m=='test':
            fit=stats.ttest_ind(*samples,equal_var=False); out.update(t=fit.statistic,p=fit.pvalue,df=fit.df)
        elif m=='mannwhitney':
            fit=stats.mannwhitneyu(*samples,alternative='two-sided',method='asymptotic',use_continuity=True); out.update(u=fit.statistic,p=fit.pvalue)
        elif m=='anova':
            fit=stats.f_oneway(*samples); out.update(f=fit.statistic,p=fit.pvalue)
        elif m=='welchanova':
            from statsmodels.stats.oneway import anova_oneway
            fit=anova_oneway(samples,use_var='unequal',welch_correction=True); out.update(f=fit.statistic,p=fit.pvalue,df=list(fit.df))
        else:
            pairs=[]
            for i in range(len(groups)):
                for j in range(i+1,len(groups)):
                    if c.get('posthocFamily')=='reference' and c['posthocReference'] not in (groups[i],groups[j]): continue
                    left,right=(i,j) if c.get('posthocFamily')!='reference' or groups[j]==c['posthocReference'] else (j,i)
                    x,y=samples[left],samples[right]; fit=stats.ttest_ind(x,y,equal_var=False); delta=np.mean(x)-np.mean(y); se=math.sqrt(np.var(x,ddof=1)/len(x)+np.var(y,ddof=1)/len(y)); crit=stats.t.ppf(.975,fit.df)
                    pairs.append(dict(left=groups[left],right=groups[right],estimate=delta,se=se,t=fit.statistic,df=fit.df,p=fit.pvalue,low=delta-crit*se,high=delta+crit*se))
            from statsmodels.stats.multitest import multipletests
            for pair,padj in zip(pairs,multipletests([p['p'] for p in pairs],method='holm')[1]): pair['holm_p']=padj
            out['contrasts']=pairs
        return out
    if m=='bootstrap':
        stat=c.get('bootstrapStatistic','mean'); unit=c.get('bootstrapUnit','row'); B=c.get('bootstrapIterations',500); random=lcg(c['seed']); groups=js_sorted(r[c['group']].strip() for r in rows) if stat=='difference' else []
        if not 100<=B<=2000 or B*n>20000000: raise ValueError('Bootstrap budget exceeded')
        if stat=='difference' and len(groups)!=2: raise ValueError('Exactly two groups required')
        def estimate(sample):
            x=np.array([number(r[c['outcome']]) for r in sample])
            if stat=='mean': return np.mean(x)
            if stat=='paired-difference': return np.mean([number(r[c['outcome']])-number(r[c['second']]) for r in sample])
            if stat=='correlation':
                y=np.array([number(r[c['second']]) for r in sample]); return np.corrcoef(x,y)[0,1] if np.std(x)>0 and np.std(y)>0 else math.nan
            a=[number(r[c['outcome']]) for r in sample if r[c['group']].strip()==groups[0]]; b=[number(r[c['outcome']]) for r in sample if r[c['group']].strip()==groups[1]]
            return np.mean(a)-np.mean(b) if a and b else math.nan
        if unit=='cluster':
            keys=list(dict.fromkeys(r[c['bootstrapCluster']].strip() for r in rows)); units=[[r for r in rows if r[c['bootstrapCluster']].strip()==k] for k in keys]
            if len(keys)<2: raise ValueError('At least two subjects required')
        else: units=[[r for r in rows if r[c['group']].strip()==g] for g in groups] if stat=='difference' else [rows]
        replicates=[]; visits=0
        for _ in range(B):
            sample=[]
            if unit=='cluster':
                for _ in units: sample.extend(units[int(next(random)*len(units))])
            else:
                for group in units: sample.extend(group[int(next(random)*len(group))] for _ in group)
            visits+=len(sample)
            if unit=='cluster' and visits>25000000: raise ValueError('Actual resampling budget exceeded')
            value=estimate(sample); replicates.append([value if math.isfinite(value) else None,len(sample)])
        valid=np.array([r[0] for r in replicates if r[0] is not None]);
        if len(valid)<B*.95: raise ValueError('Fewer than 95% valid replicates')
        out.update(estimate=estimate(rows),se=np.std(valid,ddof=1),low=np.quantile(valid,.025),high=np.quantile(valid,.975),valid=len(valid),failed=B-len(valid),replicates=replicates); return out
    x,labels=design(rows,c)
    if m in ('pca','kmeans'):
        means=x.mean(axis=0); scales=x.std(axis=0,ddof=1); z=(x-means)/scales; out.update(means=means,scales=scales)
        if m=='pca':
            u,s,vt=np.linalg.svd(z,full_matrices=False); vectors=vt.T
            for j in range(vectors.shape[1]):
                if vectors[np.argmax(np.abs(vectors[:,j])),j]<0: vectors[:,j]*=-1
            eigen=s*s/(n-1); out.update(eigenvalues=eigen,explained=eigen/sum(eigen),weights=vectors[:,:c['components']],scores=z@vectors[:,:c['components']])
        else:
            k=c['clusters']; random=lcg(c['seed']); best=None
            for _ in range(5):
                centers=[z[int(next(random)*n)].copy()]
                while len(centers)<k:
                    d=np.min(np.sum((z[:,None,:]-np.array(centers)[None,:,:])**2,axis=2),axis=1); centers.append(z[int(np.argmax(d))].copy())
                centers=np.array(centers); old=np.full(n,-1)
                for it in range(200):
                    pred=np.argmin(np.sum((z[:,None,:]-centers[None,:,:])**2,axis=2),axis=1)
                    if any(sum(pred==j)==0 for j in range(k)): break
                    centers=np.array([z[pred==j].mean(axis=0) for j in range(k)])
                    if np.array_equal(pred,old):
                        inertia=np.sum((z-centers[pred])**2)
                        if best is None or inertia<best[0]: best=(inertia,centers.copy(),pred.copy(),it+1)
                        break
                    old=pred
            if best is None: raise ValueError('K-means did not converge')
            out.update(inertia=best[0],centers=best[1]*scales+means,labels=best[2]+1,iterations=best[3])
        return out
    y=num(c['outcome'])
    if m in ('cv','classification'):
        k=c['folds']; mode=c.get('validation','random'); random=lcg(c['seed'])
        if mode=='group':
            groups=js_sorted(r[c['group']].strip() for r in rows); mapping=dict(zip(groups,assignments(len(groups),k,random))); folds=np.array([mapping[r[c['group']].strip()] for r in rows])
        elif mode=='time':
            times=sorted(set(num(c['time']))); mapping={}; offset=0
            if len(times)<k+1: raise ValueError('Insufficient distinct times')
            for chunk in range(k+1):
                size=len(times)//(k+1)+(chunk<len(times)%(k+1))
                for t in times[offset:offset+size]: mapping[t]=chunk-1
                offset+=size
            folds=np.array([mapping[t] for t in num(c['time'])])
        else: folds=assignments(n,k,random)
        predictions=np.full(n,np.nan); baseline=np.full(n,np.nan); fold_outputs=[]
        for f in range(k):
            train=(folds<f) if mode=='time' else (folds!=f); held=folds==f; train_rows=[r for r,s in zip(rows,train) if s]
            # No full-sample category schema is used for fitting.
            xt,lab=design(train_rows,c,train_rows); xh,_=design([r for r,s in zip(rows,held) if s],c,train_rows)
            if m=='classification':
                fit=safe_logistic(sm.add_constant(xt,has_constant='add'),y[train]); predictions[held]=fit.predict(sm.add_constant(xh,has_constant='add'))
            else:
                mu=xt.mean(axis=0); sd=xt.std(axis=0,ddof=1); fit=sm.OLS(y[train],sm.add_constant((xt-mu)/sd,has_constant='add')).fit(); predictions[held]=fit.predict(sm.add_constant((xh-mu)/sd,has_constant='add')); baseline[held]=np.mean(y[train])
            fold_outputs.append(dict(fold=f+1,train=int(sum(train)),held=int(sum(held)),labels=lab))
        valid=np.isfinite(predictions); out.update(folds=folds+1,predictions=[float(v) if math.isfinite(v) else None for v in predictions],folds_detail=fold_outputs)
        if m=='classification': out.update(binary_metrics(y[valid],predictions[valid],c.get('threshold',.5)))
        else:
            e=y[valid]-predictions[valid]; denom=np.sum((y[valid]-np.mean(y[valid]))**2); out.update(rmse=np.sqrt(np.mean(e**2)),mae=np.mean(np.abs(e)),r2=1-np.sum(e**2)/denom if denom else None,baseline_rmse=np.sqrt(np.mean((y[valid]-baseline[valid])**2)))
        return out
    if m=='fixed':
        groups=js_sorted(r[c['group']].strip() for r in rows); keys=np.array([r[c['group']].strip() for r in rows]); xd=x.copy(); yd=y.copy()
        for g in groups:
            select=keys==g; xd[select]-=x[select].mean(axis=0); yd[select]-=y[select].mean()
        fit=sm.OLS(yd,xd).fit(); e=fit.resid; bread=np.linalg.inv(xd.T@xd); meat=np.zeros_like(bread)
        for g in groups:
            score=xd[keys==g].T@e[keys==g]; meat+=np.outer(score,score)
        df=n-len(groups)-x.shape[1]; covariance=bread@meat@bread*len(groups)/(len(groups)-1)*(n-1)/df; se=np.sqrt(np.diag(covariance)); t=fit.params/se; crit=stats.t.ppf(.975,len(groups)-1)
        out.update(labels=labels,coefficients=fit.params,se=se,t=t,p=2*stats.t.sf(abs(t),len(groups)-1),low=fit.params-crit*se,high=fit.params+crit*se,r2=fit.rsquared); return out
    xx=sm.add_constant(x,has_constant='add')
    if m=='logistic': fit=safe_logistic(xx,y); out.update(predictions=fit.predict(xx),odds_ratio=np.exp(fit.params))
    elif m=='cluster': fit=sm.OLS(y,xx).fit(cov_type='cluster',cov_kwds={'groups':[r[c['group']].strip() for r in rows],'use_correction':True},use_t=True)
    else: fit=sm.OLS(y,xx).fit(cov_type=c.get('standardErrors','classical') if c.get('standardErrors')=='HC3' else 'nonrobust',use_t=True)
    ci=fit.conf_int(); out.update(labels=['Intercept']+labels,coefficients=fit.params,se=fit.bse,t=fit.tvalues,p=fit.pvalues,low=ci[:,0],high=ci[:,1])
    if m!='logistic': out.update(r2=fit.rsquared,adjusted_r2=fit.rsquared_adj,residual_se=math.sqrt(fit.mse_resid))
    if verification and a['kind']=='ols':
        inverse=np.linalg.inv(xx.T@xx); centered_ss=np.sum((x-np.mean(x,axis=0))**2,axis=0)
        out['vif']=[None]+list(centered_ss*np.diag(inverse)[1:])
    return out

def clean(value):
    if isinstance(value,np.ndarray): return clean(value.tolist())
    if isinstance(value,np.generic): return clean(value.item())
    if isinstance(value,float) and not math.isfinite(value): return None
    if isinstance(value,dict): return {k:clean(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)): return [clean(v) for v in value]
    return value

def main():
    manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8')); raw=(ROOT/'analysis-data.json').read_bytes()
    fingerprint=hashlib.sha256(raw).hexdigest()
    if fingerprint!=manifest['dataset']['fingerprint']: raise ValueError('Data SHA-256 mismatch; export exact analysis-data.json from the original workspace')
    identity=verification_identity(manifest,fingerprint)
    data=json.loads(raw); result=run(manifest['analysis'],data,identity is not None)
    if identity is not None:
        result['verificationIdentity']=identity
        metrics=verification_metrics(manifest['analysis'],result)
        if metrics is not None: result['verificationMetrics']=metrics
    result['versions']={'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'statsmodels':statsmodels.__version__}
    (ROOT/'python-results.json').write_text(json.dumps(clean(result),ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8'); print('Wrote python-results.json')

if __name__=='__main__': main()
