"""Covariance, invariant geometry and held-out classification reference."""
import csv
import json
from pathlib import Path
import numpy as np
from scipy.linalg import eigh,svdvals
from scipy.optimize import brentq
from scipy.spatial.distance import mahalanobis


def verify(ctx):
    def example(i,value,expected,method,inputs):ctx.check(f'STAT-306-example-{i}',value,expected,method,inputs,tolerance=1e-9)
    small=np.array([[0,0],[1,2],[2,4.]])
    example(1,np.cov(small,rowvar=False,ddof=1)[0,1],2,'Scientific covariance on actual paired matrix.',{'records':small.tolist(),'ddof':1})
    ctx.check('STAT-306-singular-rank',np.linalg.matrix_rank(np.cov(small,rowvar=False)),1,'SVD rank of actual teaching covariance.',{'records':small.tolist()})
    ctx.numeric('STAT-306-l1-q2',np.cov([1,2,3],[2,1,3],ddof=1)[0,1],'Scientific paired covariance.',{'x':[1,2,3],'y':[2,1,3],'ddof':1})
    cov=np.array([[1,.5],[.5,2]]);a=np.array([1,1])
    example(2,(a[None,:]@cov@a[:,None])[0,0],4,'Transform complete covariance by the actual linear-combination matrix.',{'covariance':cov.tolist(),'a':a.tolist()})
    ctx.numeric('STAT-306-l2-q2',np.array([1,-1])@np.array([[4,1],[1,9]])@np.array([1,-1]),'Full covariance quadratic form for difference vector.',{'covariance':[[4,1],[1,9]],'a':[1,-1]})
    example(3,10*np.array([1,1])@np.linalg.solve(np.eye(2),[1,1]),20,'Solve covariance system then compute original Hotelling quadratic form.',{'n':10,'delta':[1,1],'S':np.eye(2).tolist()})
    ctx.check('STAT-306-hotelling-F',20*(10-2)/(2*(10-1)),80/9,'Finite-sample dimension/free-degree conversion of independently checked T-squared.',{'T2':20,'n':10,'p':2})
    ctx.numeric('STAT-306-l3-q2',5*np.array([1,0])@np.linalg.solve(np.diag([2,1]),[1,0]),'Solve covariance system for original one-sample statistic.',{'n':5,'delta':[1,0],'S':[[2,0],[0,1]]})
    S=np.array([[2,1],[1,2.]])
    eigen,V=eigh(S)
    example(4,eigen[-1]/eigen.sum(),.75,'Scientific symmetric eigendecomposition and trace ratio.',{'S':S.tolist()})
    ctx.check('STAT-306-PCA-reconstruction',np.linalg.norm(S-(V*eigen)@V.T),0,'Verify actual covariance reconstruction, allowing eigenvector sign.',{'S':S.tolist(),'eigenvalues':eigen.tolist()},tolerance=1e-12)
    ctx.check('STAT-306-PCA-orthogonality',np.linalg.norm(V.T@V-np.eye(2)),0,'Check orthonormal eigenbasis invariant.',{'eigenvectors':V.tolist()},tolerance=1e-12)
    ctx.numeric('STAT-306-l4-q2',eigh(np.diag([4.,1.]),eigvals_only=True)[-1]/5,'Scientific largest eigenvalue and covariance trace.',{'S':[[4,0],[0,1]]})
    example(5,np.array([.8])@np.array([.8]),.64,'Reconstruct common-factor variance from unit factor covariance.',{'loadings':[.8],'factor_variance':1})
    ctx.check('STAT-306-factor-unique',1-np.array([.8])@np.array([.8]),.36,'Subtract reconstructed common variance from standardized total variance.',{'loading':.8,'total_variance':1})
    ctx.numeric('STAT-306-l5-q2',np.array([.6,.4])@np.eye(2)@np.array([.6,.4]),'Reconstruct variance with explicitly independent unit factors.',{'loadings':[.6,.4],'factor_covariance':np.eye(2).tolist()})
    L=np.array([[.8,.3],[.4,.9],[.5,.2]]);Q=np.array([[1,-1],[1,1]])/np.sqrt(2)
    ctx.check('STAT-306-rotation-invariant',np.linalg.norm(L@L.T-(L@Q)@(L@Q).T),0,'Actual orthogonal factor rotation and covariance reconstruction.',{'loadings':L.tolist(),'Q':Q.tolist()},tolerance=1e-12)
    example(6,mahalanobis([1,1],[0,0],np.linalg.solve(np.diag([1.,4.]),np.eye(2)))**2,1.25,'Scientific distance function using original specified covariance.',{'delta':[1,1],'covariance':[[1,0],[0,4]]})
    ctx.numeric('STAT-306-l6-q2',mahalanobis([2,1],[0,0],np.linalg.solve(np.diag([4.,1.]),np.eye(2)))**2,'Scientific covariance distance squared.',{'delta':[2,1],'covariance':[[4,0],[0,1]]})
    def sse(groups):return sum(np.sum((np.array(group)-np.mean(group))**2) for group in groups)
    example(7,sse([[1,2],[8,9]]),1,'Estimate centers from specified groups and aggregate original point residuals.',{'groups':[[1,2],[8,9]]})
    ctx.numeric('STAT-306-l7-q2',sse([[0,2],[8,10]]),'Independent centroid and within-group sum of squares.',{'groups':[[0,2],[8,10]]})
    def boundary(m0,m1,var):return brentq(lambda x:x*(m1-m0)/var-(m1*m1-m0*m0)/(2*var),min(m0,m1)-10,max(m0,m1)+10)
    example(8,boundary(0,2,1),1,'Numerically equate two model-based equal-prior LDA scores.',{'means':[0,2],'variance':1,'priors':[.5,.5]})
    ctx.numeric('STAT-306-l8-q2',boundary(1,5,2),'Numerically solve discriminant equality under provided model.',{'means':[1,5],'variance':2,'priors':[.5,.5]})
    example(9,svdvals(np.diag([.8,.3]))[0],.8,'Scientific singular values of specified whitened cross covariance.',{'within_covariances':'I2','cross_covariance':[[.8,0],[0,.3]]})
    ctx.numeric('STAT-306-l9-q2',svdvals(np.diag([.6,.2]))[0],'Scientific singular value for independent CCA reference.',{'within_covariances':'I2','cross_covariance':[[.6,0],[0,.2]]})
    directory=Path(__file__).resolve().parents[2]/'content/courses/STAT-306'
    with (directory/'data/classification.csv').open(encoding='utf-8',newline='') as f:rows=list(csv.DictReader(f))
    train=np.array([[float(r['x1']),float(r['x2'])] for r in rows if r['split']=='train']);labels=np.array([int(r['class']) for r in rows if r['split']=='train'])
    test=np.array([[float(r['x1']),float(r['x2'])] for r in rows if r['split']=='test']);truth=np.array([int(r['class']) for r in rows if r['split']=='test'])
    groups=[train[labels==k] for k in [0,1]];means=np.array([g.mean(axis=0) for g in groups])
    pooled=sum((len(g)-1)*np.cov(g,rowvar=False) for g in groups)/(len(train)-2)
    weights=np.linalg.solve(pooled,means.T);offset=np.sum(means*weights.T,axis=1)/2
    scores=test@weights-offset+np.log(.5);prediction=scores.argmax(axis=1);accuracy=np.mean(prediction==truth)
    ctx.numeric('STAT-306-case-accuracy',accuracy,'Read actual CSV, fit equal-prior shared-covariance LDA on train only and preserve all test rows.',{'train':train.tolist(),'labels':labels.tolist(),'test':test.tolist(),'truth':truth.tolist(),'prediction':prediction.tolist()})
    ctx.check('STAT-306-case-pooled',np.linalg.norm(pooled-np.array([[1/3,-1/6],[-1/6,1/3]])),0,'Actual pooled sample covariance compared with manual reference matrix.',{'groups':[g.tolist() for g in groups]},tolerance=1e-12)
    ctx.check('STAT-306-case-LDA-direction',np.linalg.norm((weights[:,1]-weights[:,0])-np.array([12,12])),0,'Compare full covariance-solved score direction with manual boundary.',{'means':means.tolist(),'pooled':pooled.tolist()},tolerance=1e-12)
    ctx.check('STAT-306-case-LDA-intercept',offset[1]-offset[0],32,'Independent equal-prior discriminant offset.',{'means':means.tolist(),'pooled':pooled.tolist()},tolerance=1e-12)
    centered=train-train.mean(axis=0);U,d,Vt=np.linalg.svd(centered,full_matrices=False);ev=d*d/(len(train)-1)
    ctx.check('STAT-306-case-PCA-proportion',ev[0]/ev.sum(),19/22,'Actual training-data SVD variance ratio.',{'train':train.tolist(),'singular_values':d.tolist()},tolerance=1e-12)
    ctx.check('STAT-306-case-PCA-reconstruction',np.linalg.norm(centered-(U*d)@Vt),0,'Actual SVD reconstruction invariant without sign comparison.',{'train':train.tolist()},tolerance=1e-12)
    assert prediction.tolist()==[0,1,1,1] and truth.tolist()==[0,1,0,1]
    (directory/'data/reference-analysis.json').write_text(json.dumps({'data':'classification.csv','training_center':train.mean(axis=0).tolist(),'class_means':means.tolist(),'pooled_covariance':pooled.tolist(),'priors':[.5,.5],'training_PCA_variances':ev.tolist(),'training_PCA_first_fraction':float(ev[0]/ev.sum()),'test_predictions':prediction.tolist(),'test_truth':truth.tolist(),'test_accuracy':float(accuracy),'scope':'Four constructed test records; no future-accuracy or causal claim; test labels were never used to fit.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
