"""Independent linear algebra/scientific reference for the guided regression course."""
import csv
import json
from pathlib import Path
import numpy as np
from scipy.linalg import lstsq
from scipy.optimize import minimize_scalar
from scipy.special import expit


def verify(ctx):
    directory=Path(__file__).resolve().parents[2]/'content/courses/STAT-302'
    with (directory/'data/regression.csv').open(encoding='utf-8',newline='') as f:
        rows=list(csv.DictReader(f))
    train=np.array([[float(r['x']),float(r['y'])] for r in rows if r['split']=='train'])
    test=np.array([[float(r['x']),float(r['y'])] for r in rows if r['split']=='test'])
    X=np.c_[np.ones(len(train)),train[:,0]]; y=train[:,1]
    b=lstsq(X,y)[0];e=y-X@b;s2=e@e/(len(y)-X.shape[1]);cov=s2*np.linalg.solve(X.T@X,np.eye(2))
    prediction=np.c_[np.ones(len(test)),test[:,0]]@b
    mse=np.mean((test[:,1]-prediction)**2)
    def example(i,value,expected,method,inputs):ctx.check(f'STAT-302-example-{i}',value,expected,method,inputs,tolerance=1e-9)
    example(1,np.linalg.matrix_rank(np.c_[np.ones(3),np.arange(3)]),2,'SVD rank of actual three-row design.',{'x':[0,1,2],'intercept':True})
    ctx.numeric('STAT-302-l1-q2',8-np.linalg.matrix_rank(np.c_[np.ones(8),np.arange(8),np.arange(8)**2]),'Residual subspace dimension from actual full-rank design.',{'n':8,'columns':['1','x','x^2']})
    example(2,lstsq(np.c_[np.ones(3),[1,2,3]],[2,3,5])[0][1],1.5,'SciPy least squares on original paired data.',{'x':[1,2,3],'y':[2,3,5]})
    ctx.numeric('STAT-302-l2-q2',lstsq(np.c_[np.ones(3),[0,1,2]],[1,3,4])[0][1],'SciPy least squares rather than authored Sxy arithmetic.',{'x':[0,1,2],'y':[1,3,4]})
    example(3,np.array([1,2,1])@np.array([1,2,3]),8,'Independent row-vector coefficient multiplication.',{'row':[1,2,1],'coefficients':[1,2,3]})
    ctx.numeric('STAT-302-l3-q2',np.array([1,4,2])@np.array([2,1.5,-.5]),'Independent coefficient dot product.',{'row':[1,4,2],'coefficients':[2,1.5,-.5]})
    example(4,np.sqrt(cov[1,1]),0.13502330360721743,'Read teaching CSV, solve least squares, estimate residual variance and covariance.',{'train':train.tolist(),'p':2,'df':4})
    ctx.check('STAT-302-csv-intercept',b[0],17/21,'SciPy coefficient from actual CSV, compared with exact hand calculation.',{'train':train.tolist()},tolerance=1e-12)
    ctx.check('STAT-302-csv-slope',b[1],33/35,'SciPy coefficient from actual CSV, compared with exact hand calculation.',{'train':train.tolist()},tolerance=1e-12)
    ctx.check('STAT-302-csv-sse',e@e,134/105,'Original-data residual norm squared.',{'train':train.tolist()},tolerance=1e-12)
    ctx.numeric('STAT-302-l4-q2',((30-20)/2)/(20/10),'Nested residual mean-square ratio.',{'SSE_R':30,'SSE_U':20,'restrictions':2,'df':10})
    example(5,np.array([1,4,1,4])@np.array([10,3,2,1]),28,'Construct actual categorical-interaction row and multiply.',{'x':4,'D':1,'coefficients':[10,3,2,1]})
    ctx.numeric('STAT-302-l5-q2',np.array([1,4,1,4])@np.array([5,2,3,-1]),'Construct categorical-interaction row.',{'x':4,'D':1,'coefficients':[5,2,3,-1]})
    small=np.c_[np.ones(3),[0,1,2]]; Q=np.linalg.qr(small,mode='reduced')[0]
    example(6,np.diag(Q@Q.T)[-1],5/6,'QR column-space projection rather than scalar leverage formula.',{'x':[0,1,2],'intercept':True})
    ctx.numeric('STAT-302-l6-q2',np.linalg.inv(np.array([[1,np.sqrt(.8)],[np.sqrt(.8),1]]))[0,0],'Diagonal of inverse standardized two-column correlation matrix.',{'correlation_squared':.8})
    example(7,lstsq(np.sqrt([1,3])[:,None],np.sqrt([1,3])*[1,3])[0][0],2.5,'Whiten the original intercept-only model by known covariance and solve.',{'y':[1,3],'variances':[1,1/3]})
    ctx.numeric('STAT-302-l7-q2',lstsq(np.sqrt([1,.25])[:,None],np.sqrt([1,.25])*[2,8])[0][0],'Whiten model and solve least squares using inverse variance weights.',{'y':[2,8],'variances':[1,4]})
    bt=lstsq(np.c_[np.ones(3),[0,1,2]],[1,2,3])[0]
    example(8,np.mean((np.array([3,5])-np.c_[np.ones(2),[3,4]]@bt)**2),.5,'Fit only training pairs, then predict fixed test pairs.',{'train_x':[0,1,2],'train_y':[1,2,3],'test_x':[3,4],'test_y':[3,5]})
    ctx.numeric('STAT-302-l8-q2',np.mean((np.array([2,5])-np.array([3,3]))**2),'Vector test squared-error aggregation.',{'actual':[2,5],'predicted':[3,3]})
    example(9,minimize_scalar(lambda coef:np.sum((np.array([-1,0,1])-coef*np.array([-1,0,1]))**2)+2*coef**2).x,.5,'Numerically minimize the explicitly authored ridge objective.',{'x':[-1,0,1],'y':[-1,0,1],'lambda':2})
    ctx.numeric('STAT-302-l9-q2',minimize_scalar(lambda coef:(3-2*coef)**2+2*coef**2).x,'Numerically minimize a compatible original ridge problem.',{'x':[2],'y':[3],'lambda':2,'xTy':6,'xTx':4})
    example(10,expit(-2+2),.5,'Scientific logistic-link implementation.',{'intercept':-2,'coefficient':1,'x':2})
    ctx.numeric('STAT-302-l10-q2',expit(np.log(3)),'Scientific logistic-link implementation.',{'linear_predictor':'log(3)'})
    ctx.numeric('STAT-302-case-mse',mse,'Read actual CSV, fit only its fixed train rows and predict untouched test rows.',{'train':train.tolist(),'test':test.tolist(),'coefficients':b.tolist(),'predictions':prediction.tolist()})
    (directory/'data/reference-analysis.json').write_text(json.dumps({'data':'regression.csv','method':'SciPy least squares on train only','coefficients':b.tolist(),'sse':float(e@e),'df':4,'slope_se':float(np.sqrt(cov[1,1])),'test_predictions':prediction.tolist(),'test_mse':float(mse),'scope':'Constructed teaching data; no causal or future-performance claim.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
