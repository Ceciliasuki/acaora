"""Original moments, panel design and scientific likelihood reference, not author-script arithmetic."""
import csv
import json
from pathlib import Path
import numpy as np
from scipy.linalg import lstsq,solve_discrete_lyapunov
from scipy.optimize import minimize_scalar
from scipy.stats import binom,t


def verify(ctx):
    def example(i,computed,expected,method,inputs):ctx.check(f'ECON-301-example-{i}',computed,expected,method,inputs,tolerance=1e-9)
    example(1,np.mean([0,2,4,6]),3,'Aggregate complete constructed potential-effect vector.',{'effects':[0,2,4,6]})
    ctx.numeric('ECON-301-l1-q2',np.mean([-1,1,3]),'Mean of explicit teaching potential effects.',{'effects':[-1,1,3]})
    example(2,np.linalg.solve([[4]],[2*4+3*2])[0],3.5,'Solve omitted-model population normal equation from complete-model moments.',{'beta':2,'gamma':3,'varX':4,'covXZ':2})
    ctx.numeric('ECON-301-l2-q2',np.linalg.solve([[2]],[1*2+2*1])[0],'Solve population projection normal equation.',{'beta':1,'gamma':2,'varX':2,'covXZ':1})
    example(3,np.divide(np.subtract(2,0),.5),4,'Standardize estimate-minus-null by the given standard error.',{'estimate':2,'null':0,'se':.5})
    ctx.numeric('ECON-301-l3-q2',np.dot([2,.5],[1,1.96]),'Linear endpoint transformation using the specifically provided rounded z value.',{'estimate':2,'se':.5,'z':1.96})
    z=np.c_[np.ones(4),[0,0,1,1]];x=np.c_[np.ones(4),[0,1,2,3]];y=np.array([1,2,4,5])
    xhat=z@lstsq(z,x)[0]
    example(4,lstsq(xhat,y)[0][1],1.5,'Project actual explanatory design onto instruments then fit second-stage coefficients.',{'z':[0,0,1,1],'x':[0,1,2,3],'y':y.tolist(),'intercept':True})
    ctx.numeric('ECON-301-l4-q2',np.linalg.solve([[3]],[6])[0],'Solve scalar external-instrument population moment equation.',{'covZY':6,'covZX':3})
    unit_x=np.array([[0,1],[0,1.]]);unit_y=np.array([[1,3],[5,7.]])
    within_x=(unit_x-unit_x.mean(axis=1,keepdims=True)).reshape(-1,1);within_y=(unit_y-unit_y.mean(axis=1,keepdims=True)).ravel()
    example(5,lstsq(within_x,within_y)[0][0],2,'Demean actual two-unit panel and solve within regression.',{'x':unit_x.tolist(),'y':unit_y.tolist(),'time_effect':False})
    ctx.numeric('ECON-301-l5-q2',lstsq(np.array([1,2.])[:,None],[2,3])[0][0],'Solve explicitly intercept-free differenced design.',{'delta_x':[1,2],'delta_y':[2,3],'common_time_effect':False})
    cells=np.c_[np.ones(4),[0,0,1,1],[0,1,0,1],[0,0,0,1]]
    example(6,lstsq(cells,[10,12,12,17])[0][-1],3,'Solve saturated four-cell treatment-by-period regression rather than repeated subtraction.',{'control_pre':10,'control_post':12,'treated_pre':12,'treated_post':17})
    ctx.numeric('ECON-301-l6-q2',lstsq(cells,[8,11,10,16])[0][-1],'Saturated four-cell least squares interaction.',{'control_pre':8,'control_post':11,'treated_pre':10,'treated_post':16})
    left=lstsq(np.c_[np.ones(2),[49,49.5]],[19,19.5])[0];right=lstsq(np.c_[np.ones(2),[50.5,51]],[23.5,24])[0]
    example(7,np.array([1,50])@(right-left),3,'Independently reconstruct both given local mean functions and evaluate cutoff limits.',{'cutoff':50,'left_mean':'x-30','right_mean':'x-27'})
    ctx.numeric('ECON-301-l7-q2',np.diff([4.,6.])[0],'Assigned-treatment mean contrast.',{'assigned_treatment_mean':6,'assigned_control_mean':4})
    example(8,np.dot([1,.5],[1,6]),4,'Evaluate original AR transition row at current state.',{'intercept':1,'phi':.5,'current':6})
    ctx.check('ECON-301-AR-mean',np.linalg.solve([[1-.5]],[1])[0],2,'Solve stationary expectation fixed point.',{'intercept':1,'phi':.5})
    ctx.numeric('ECON-301-l8-q2',solve_discrete_lyapunov(np.array([[.5]]),np.array([[3.]]))[0,0],'Solve stationary covariance Lyapunov equation with scientific linear algebra.',{'phi':.5,'innovation_variance':3})
    fit=minimize_scalar(lambda p:-binom.logpmf(3,5,p),bounds=(.0001,.9999),method='bounded',options={'xatol':1e-12})
    example(9,2*(binom.logpmf(3,5,fit.x)-binom.logpmf(3,5,.5)),0.20135513550688877,'Optimize actual binomial probability then compare null and fitted log likelihoods.',{'successes':3,'n':5,'null_p':.5})
    ctx.check('ECON-301-Bernoulli-mle',fit.x,.6,'Scientific binomial-likelihood optimization.',{'successes':3,'n':5},tolerance=1e-7)
    fit10=minimize_scalar(lambda p:-binom.logpmf(7,10,p),bounds=(.0001,.9999),method='bounded')
    ctx.numeric('ECON-301-l9-q2',fit10.x,'Numerically optimize the original binomial likelihood.',{'successes':7,'n':10})
    example(10,minimize_scalar(lambda mu:2*np.mean(np.array([1.,2.,3.])-mu)**2).x,2,'Numerically minimize stated sample-moment distance.',{'observations':[1,2,3],'weight':2})
    ctx.numeric('ECON-301-l10-q2',minimize_scalar(lambda mu:np.mean(np.array([2.,4.,6.])-mu)**2).x,'Numerically minimize positive-weight single sample-moment distance.',{'observations':[2,4,6],'weight':1})
    directory=Path(__file__).resolve().parents[2]/'content/courses/ECON-301'
    with (directory/'data/policy-panel.csv').open(encoding='utf-8',newline='') as f:records=list(csv.DictReader(f))
    grouped={}
    for row in records:grouped.setdefault(int(row['unit']),{})[int(row['time'])]=row
    changes={u:float(rows[1]['outcome'])-float(rows[0]['outcome']) for u,rows in grouped.items()}
    treated=np.array([v for u,v in changes.items() if int(grouped[u][0]['treated'])==1]);control=np.array([v for u,v in changes.items() if int(grouped[u][0]['treated'])==0])
    design=np.array([[1,*[int(int(r['unit'])==u) for u in range(2,7)],int(r['time']),int(r['treated'])*int(r['time'])] for r in records],dtype=float)
    outcome=np.array([float(r['outcome']) for r in records]);coefficients=lstsq(design,outcome)[0]
    ctx.numeric('ECON-301-case-did',coefficients[-1],'Read CSV, construct actual individual/time design and estimate interaction; cross-check paired group-change contrast.',{'records':records,'design_rank':int(np.linalg.matrix_rank(design)),'changes':changes})
    ctx.check('ECON-301-case-contrast',treated.mean()-control.mean(),coefficients[-1],'Compare paired mean-change estimator and full panel design coefficient.',{'treated_changes':treated.tolist(),'control_changes':control.tolist()},tolerance=1e-12)
    se=np.sqrt(treated.var(ddof=1)/len(treated)+control.var(ddof=1)/len(control))
    df=(treated.var(ddof=1)/3+control.var(ddof=1)/3)**2/((treated.var(ddof=1)/3)**2/2+(control.var(ddof=1)/3)**2/2)
    ci=[float(coefficients[-1]-t.ppf(.975,df)*se),float(coefficients[-1]+t.ppf(.975,df)*se)]
    ctx.check('ECON-301-case-change-variance',treated.var(ddof=1),16,'Sample variance of actual treated paired changes from CSV.',{'changes':treated.tolist(),'ddof':1})
    ctx.check('ECON-301-case-ci-lower',ci[0],-6.0678317421100765,'Welch quantile and variance from fixed paired changes, under explicitly stated independent normal-change illustration.',{'treated':treated.tolist(),'control':control.tolist(),'df':float(df),'se':float(se)},tolerance=1e-9)
    ctx.check('ECON-301-case-ci-upper',ci[1],12.067831742110076,'Upper endpoint from the same actual teaching data and conditional Welch model.',{'treated':treated.tolist(),'control':control.tolist(),'df':float(df),'se':float(se)},tolerance=1e-9)
    assert ci[0]<0<ci[1]
    (directory/'data/reference-analysis.json').write_text(json.dumps({'data':'policy-panel.csv','paired_changes':changes,'treatment_change_mean':float(treated.mean()),'control_change_mean':float(control.mean()),'did':float(coefficients[-1]),'welch_df':float(df),'welch_se':float(se),'welch_95_interval':ci,'non_significant_interval_preserved':True,'inference_conditions':'Independent normal unit changes across and within groups; teaching illustration only.','identification':'Parallel untreated trends, no anticipation/interference and appropriate composition remain assumptions; one pre-period cannot establish pre-trends.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
