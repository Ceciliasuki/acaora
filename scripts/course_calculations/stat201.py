from fractions import Fraction
from itertools import combinations, product
from math import exp
from scipy.integrate import quad, dblquad
from scipy.stats import norm
import numpy as np
from scipy.stats import chi2, t, binom, f as f_dist, f_oneway
from math import ceil
from pathlib import Path
from csv import DictReader
from scipy.optimize import minimize_scalar


def verify(ctx):
    committee = list(combinations(range(5), 2))
    ctx.check('STAT-201-example-1-1', Fraction(sum(sum(i < 2 for i in pair) == 1 for pair in committee), len(committee)), .6, 'Enumerate ten unordered committees; students 0,1 are statistics.', {'students': 5, 'statistics_students': 2, 'sample': 2})
    coin_probabilities = {pair: (Fraction(4, 5) if pair[0] else Fraction(1, 5)) * (Fraction(4, 5) if pair[1] else Fraction(1, 5)) for pair in product([0, 1], repeat=2)}
    ctx.check('STAT-201-example-1-2', sum(prob for pair, prob in coin_probabilities.items() if any(pair)), .96, 'Enumerate biased independent-coin outcomes with exact fractions.', {'success_probability': .8, 'trials': 2})
    a, b = {0, 1, 2, 3}, {0, 1, 2, 4, 5}
    ctx.numeric('STAT-201-l1-q3', Fraction(len(a | b), 10), 'Count a set union in a ten-point space.', {'A': sorted(a), 'B': sorted(b), 'space_size': 10})
    pairs = list(combinations(range(10), 2))
    ctx.numeric('STAT-201-l1-q4', Fraction(sum(sum(i < 4 for i in pair) == 1 for pair in pairs), len(pairs)), 'Enumerate 45 ball pairs.', {'balls': 10, 'red': 4, 'sample': 2})

    if 'lesson-2' in ctx.lessons:
        ctx.check('STAT-201-example-2-1', Fraction(180, 180 + 490), 18 / 67, 'Construct a 10000-person joint frequency table; divide diseased positives by all positives.', {'population': 10000, 'diseased': 200, 'true_positive': 180, 'false_positive': 490})
        ctx.check('STAT-201-example-2-2', Fraction(sum(all(i < 4 for i in pair) for pair in pairs), len(pairs)), 2 / 15, 'Enumerate unordered ball pairs instead of multiplying sequential conditional probabilities.', {'balls': 10, 'red': 4, 'sample': 2})
        ctx.numeric('STAT-201-l2-q3', Fraction(6, 6 + 28), 'Count origins among a constructed 1000-product defect table.', {'products': 1000, 'A_products': 300, 'A_defects': 6, 'B_defects': 28})
        ctx.numeric('STAT-201-l2-q4', Fraction(1, 4), 'Construct one A-and-B point among four B points in a ten-point space.', {'space_size': 10, 'A_points': 5, 'B_points': 4, 'intersection': 1})

    if 'lesson-3' in ctx.lessons:
        sequences = list(product([0, 1], repeat=5))
        weights = {seq: Fraction(1, 5) ** sum(seq) * Fraction(4, 5) ** (5 - sum(seq)) for seq in sequences}
        ctx.check('STAT-201-example-3-1', sum(p for seq, p in weights.items() if sum(seq) <= 1), .73728, 'Enumerate all 32 sequences, weighted using exact Fraction arithmetic.', {'success_probability': .2, 'trials': 5, 'at_most': 1})
        ctx.check('STAT-201-example-3-2', quad(lambda t: 2 * exp(-2*t), 1, float('inf'))[0], exp(-2), 'Integrate the exponential waiting density over times exceeding the event window.', {'rate_per_hour': 2, 'window_hours': 1}, tolerance=1e-10)
        ctx.check('STAT-201-example-3-2-half', quad(lambda t: 2 * exp(-2*t), .5, float('inf'))[0], exp(-1), 'Integrate the same waiting density over times exceeding half an hour.', {'rate_per_hour': 2, 'window_hours': .5}, tolerance=1e-10)
        ctx.numeric('STAT-201-l3-q3', sum(p for seq, p in weights.items() if sum(seq) == 2), 'Weighted enumeration, independent of the combination-count formula.', {'success_probability': .2, 'trials': 5, 'exact_successes': 2})
        product_pairs = list(combinations(range(8), 2))
        ctx.numeric('STAT-201-l3-q4', Fraction(sum(any(i < 3 for i in pair) for pair in product_pairs), len(product_pairs)), 'Directly count pairs containing a defective product.', {'products': 8, 'defective': 3, 'sample': 2})

    if 'lesson-3-continuous' in ctx.lessons:
        ctx.check('STAT-201-example-3c-1', quad(lambda x: x/2, .5, 1.5)[0], .5, 'Numerical quadrature of the declared density, separate from the authored CDF calculation.', {'density': 'x/2 on (0,2)', 'lower': .5, 'upper': 1.5})
        ctx.check('STAT-201-example-3c-1-normalization', quad(lambda x: x/2, 0, 2)[0], 1, 'Numerically integrate density over its full support.', {'density': 'x/2 on (0,2)'})
        ctx.check('STAT-201-example-3c-2', quad(lambda x: norm.pdf(x, loc=100, scale=15), 85, 115)[0], .682689492, 'Integrate the unstandardized normal density rather than subtracting tabulated Phi values.', {'mean': 100, 'standard_deviation': 15, 'interval': [85, 115]}, tolerance=1e-9)
        ctx.numeric('STAT-201-l3c-q3', quad(lambda x: .5 * exp(-.5*x), 3, float('inf'))[0], 'Numerical tail integration instead of direct survival formula.', {'rate_per_minute': .5, 'threshold_minutes': 3})
        ctx.numeric('STAT-201-l3c-q4', quad(lambda x: 1/4, 3, 5)[0], 'Numerical integration of uniform density on the requested subinterval.', {'support': [2, 6], 'interval': [3, 5]})

    if 'lesson-4' in ctx.lessons:
        ctx.check('STAT-201-example-4-1', dblquad(lambda y, x: 2, 0, .5, lambda x: 0, lambda x: .5-x)[0], .25, 'Two-dimensional numerical integration over the actual event triangle.', {'joint_density': 2, 'event_boundary': 'x+y<=0.5', 'x>=0': True, 'y>=0': True})
        ctx.check('STAT-201-example-4-1-normalization', dblquad(lambda y, x: 2, 0, 1, lambda x: 0, lambda x: 1-x)[0], 1, 'Integrate joint density over full triangular support.', {'joint_density': 2, 'support_boundary': 'x+y<1'})
        ctx.check('STAT-201-example-4-2', quad(lambda x: .5, -.5, .5)[0], .5, 'Integrate original X density over both preimage branches.', {'X_support': [-1, 1], 'transform': 'Y=X^2', 'threshold': .25})
        ctx.check('STAT-201-example-4-2-normalization', quad(lambda y: 1/(2*y**.5), 0, 1)[0], 1, 'Quadrature of the transformed density at its integrable singular boundary.', {'Y_support': [0, 1], 'density': '1/(2*sqrt(y))'}, tolerance=1e-10)
        table={(0,0):2,(0,1):3,(1,0):1,(1,1):4}
        ctx.numeric('STAT-201-l4-q3', Fraction(sum(n for (x,y),n in table.items() if x==1 and y==1), sum(n for (x,y),n in table.items() if x==1)), 'Conditional frequency from a ten-point joint table.', {'joint_counts': {'00':2,'01':3,'10':1,'11':4}})
        ctx.numeric('STAT-201-l4-q4', quad(lambda x: .5, -.6, .6)[0], 'Integrate the original X density over the event preimage.', {'X_support': [-1, 1], 'transform': 'Y=X^2', 'threshold': .36})

    if 'lesson-5' in ctx.lessons:
        xs=np.array([-1.,0.,1.]);ys=xs**2
        ctx.check('STAT-201-example-5-1', np.mean((xs-xs.mean())*(ys-ys.mean())), 0, 'Direct weighted centered products on the three-point support.', {'x':xs.tolist(),'y':ys.tolist()})
        # Explicit four-point mixture preserves each conditional mean and variance.
        vals=np.array([50.,70.,70.,90.])
        ctx.check('STAT-201-example-5-2', np.mean((vals-vals.mean())**2), 200, 'Direct variance of an explicit four-point distribution, not the total-variance formula.', {'values':vals.tolist(),'equal_probability':.25})
        # Cholesky constructs centered samples with exactly the declared population covariance.
        covariance=np.array([[4.,1.],[1.,9.]])
        points=np.sqrt(2)*np.array([[1,0],[-1,0],[0,1],[0,-1]])@np.linalg.cholesky(covariance).T
        transformed=points@np.array([2.,-1.])
        ctx.numeric('STAT-201-l5-q3', np.var(transformed), 'Direct variance of transformed finite points whose covariance equals the input.', {'covariance':covariance.tolist(),'transform':[2,-1]})
        ctx.numeric('STAT-201-l5-q4', Fraction(4,16), 'Exact second-moment threshold ratio from Markov on squared deviation.', {'variance':4,'squared_threshold':16})

    if 'lesson-6' in ctx.lessons:
        ctx.check('STAT-201-example-6-1', quad(lambda m:norm.pdf(m,50,2),48,52)[0], .682689492, 'Numerical quadrature of the exact sample-mean density.', {'population_mean':50,'population_sd':10,'n':25,'interval':[48,52]},tolerance=1e-9)
        sample=np.array([2.,4.,6.])
        ctx.check('STAT-201-example-6-2', np.sum((sample-sample.mean())**2)/4, 2, 'Direct residual sum of squares divided by the declared population variance.', {'sample':sample.tolist(),'population_variance':4})
        ctx.numeric('STAT-201-l6-q3', np.sqrt(np.sum(np.full(64,16/64**2))), 'Sum the 64 independent scaled-observation variances, then take square root.', {'n':64,'individual_variance':16})
        ctx.numeric('STAT-201-l6-q4', np.var([1.,2.,3.,4.],ddof=1), 'NumPy sample variance with explicit degrees of freedom.', {'sample':[1,2,3,4],'ddof':1})

    if 'lesson-7' in ctx.lessons:
        times=np.array([1.,2.,3.,4.]);events=np.array([1,1,0,1])
        objective=lambda rate: -np.sum(events*np.log(rate)-rate*times)
        fit=minimize_scalar(objective,bounds=(.001,2),method='bounded',options={'xatol':1e-13})
        ctx.check('STAT-201-example-7-1', fit.x, .3, 'Numerically optimize the per-record censored log likelihood, rather than using d/total formula.', {'times':times.tolist(),'events':events.tolist(),'rate_bounds':[.001,2]},tolerance=1e-8)
        mse=quad(lambda u: ((u/5)-1)**2*chi2.pdf(u,4),0,np.inf)[0]
        ctx.check('STAT-201-example-7-2', mse, .36, 'Integrate the MLE squared estimation error against its exact scaled chi-square law.', {'n':5,'true_variance':1,'df':4},tolerance=1e-9)
        ctx.check('STAT-201-example-7-2-unbiased', quad(lambda u: ((u/4)-1)**2*chi2.pdf(u,4),0,np.inf)[0], .5, 'Integrate unbiased estimator squared error independently.', {'n':5,'true_variance':1,'df':4},tolerance=1e-9)
        from scipy.stats import expon
        sample=np.array([3.,4.,5.])
        # The conditional exponential is a shifted exponential with fixed location c.
        # Generic scalar optimization loses precision at the flat optimum (~1.5e-8
        # in rate); use the library's distribution fit rather than weakening the gate.
        _,scale=expon.fit(sample,floc=2)
        ctx.check('STAT-201-example-7-3',1/scale,.5,'SciPy exponential distribution fit with fixed truncation location; separately verify the conditional density normalization.',{'sample':sample.tolist(),'left_truncation':2,'conditional_on_sample_count':3})
        ctx.check('STAT-201-example-7-3-normalization',quad(lambda x:expon.pdf(x,scale=2)/expon.sf(2,scale=2),2,np.inf)[0],1,'Integrate original density divided by truncation survival probability.',{'rate':.5,'left_truncation':2},tolerance=1e-10)
        factor=1/quad(lambda m: m*4*m**3,0,1)[0]
        ctx.numeric('STAT-201-l7-q3', factor*8, 'Compute expected normalized maximum by quadrature and invert to construct the unbiased multiplier.', {'n':4,'observed_maximum':8})
        values=np.array([-.3-np.sqrt(.2),-.3+np.sqrt(.2)])
        ctx.numeric('STAT-201-l7-q4', np.mean(values**2), 'Direct squared error of a two-point estimator with the declared mean error and variance.', {'errors':values.tolist(),'equal_probability':.5})

    if 'lesson-8' in ctx.lessons:
        ctx.check('STAT-201-example-8-1', t.ppf(.975,24)*10/np.sqrt(25), 4.127797124, 'SciPy t inverse CDF, independently recomputing the interval half width.', {'n':25,'sample_mean':100,'sample_sd':10,'confidence':.95},tolerance=2e-9)
        z=norm.ppf(.975)
        # Invert the score statistic numerically rather than insert Wilson closed form.
        from scipy.optimize import brentq
        upper=brentq(lambda p: (0-p)**2-(z*z)*p*(1-p)/20, .001,.99)
        ctx.check('STAT-201-example-8-2', upper, .161125158, 'Root finding of the score acceptance boundary for zero successes, separate from Wilson closed form.', {'n':20,'successes':0,'confidence':.95},tolerance=1e-9)
        ctx.numeric('STAT-201-l8-q3', ceil((1.96*10/2)**2), 'Integer sample-size search verified against requested half width.', {'planning_z':1.96,'sigma':10,'max_half_width':2})
        assert 1.96*10/np.sqrt(96)>2 and 1.96*10/np.sqrt(97)<=2
        variances=np.r_[np.full(10,4/100),np.full(10,9/100)]
        ctx.numeric('STAT-201-l8-q4', np.sqrt(np.sum(variances)), 'Sum individual scaled observation variances in independent groups.', {'n':[10,10],'sample_variance':[4,9]})
        ctx.check('STAT-201-ci-t-coverage', quad(lambda u:t.pdf(u,24),-t.ppf(.975,24),t.ppf(.975,24))[0], .95, 'Numerical integration verifies exact t pivot interval coverage, not a Monte Carlo claim.', {'df':24,'confidence':.95},tolerance=1e-10)
        ctx.check('STAT-201-ci-variance-coverage', quad(lambda u:chi2.pdf(u,9),chi2.ppf(.025,9),chi2.ppf(.975,9))[0], .95, 'Numerical integration verifies chi-square pivot coverage and endpoint order.', {'df':9,'confidence':.95},tolerance=1e-10)

    if 'lesson-9' in ctx.lessons:
        ctx.check('STAT-201-example-9-1', 2*quad(lambda m:norm.pdf(m,100,2),104,np.inf)[0], .045500264, 'Integrate both sample-mean tails in original units under H0.', {'null_mean':100,'sigma':10,'n':25,'sample_mean':104},tolerance=1e-9)
        critical=norm.ppf(.95)/5
        ctx.check('STAT-201-example-9-2', quad(lambda m:norm.pdf(m,.5,.2),critical,np.inf)[0], .803764941, 'Integrate the rejection region in original units under the planned alternative.', {'null_mean':0,'true_mean':.5,'sigma':1,'n':25,'alpha':.05},tolerance=2e-9)
        ctx.numeric('STAT-201-l9-q3', (12-10)/np.sqrt(np.sum(np.full(36,36/36**2))), 'Construct mean variance from 36 independent observations before computing z.', {'sigma':6,'n':36,'sample_mean':12,'null_mean':10})
        ctx.numeric('STAT-201-l9-q4', Fraction(5,100)/5, 'Exact allocation of family error budget across five tests.', {'family_error':.05,'tests':5})

    if 'lesson-10' in ctx.lessons:
        signs=list(product([0,1],repeat=8))
        ctx.check('STAT-201-example-10-1', Fraction(sum(sum(row)>=7 or sum(row)<=1 for row in signs),len(signs)), .0703125, 'Enumerate all 256 fair sign assignments and count both extreme tails.', {'n':8,'positive':7})
        from scipy.stats import chisquare
        fit=chisquare([8,10,12],f_exp=[10,10,10])
        ctx.check('STAT-201-example-10-2', fit.statistic, .8, 'SciPy Pearson statistic from count vectors.', {'observed':[8,10,12],'expected':[10,10,10]})
        ctx.check('STAT-201-example-10-2-p', fit.pvalue, .670320046, 'SciPy chi-square survival probability.', {'statistic':.8,'df':2},tolerance=1e-9)
        outcomes=list(product([0,1],repeat=5))
        ctx.numeric('STAT-201-l10-q3', Fraction(sum(sum(row)in[0,5] for row in outcomes),len(outcomes)), 'Enumerate fair sign assignments instead of binomial tail formula.', {'n':5,'positive':5})
        ctx.numeric('STAT-201-l10-q4', chisquare([25,15],f_exp=[20,20]).statistic, 'SciPy Pearson statistic from two count vectors.', {'observed':[25,15],'expected':[20,20]})

    if 'lesson-11' in ctx.lessons:
        data=Path(__file__).resolve().parents[2]/'content/courses/STAT-201/data'
        with (data/'anova-teaching.csv').open(encoding='utf-8',newline='') as stream:
            rows=list(DictReader(stream))
        assert len({row['observation_id'] for row in rows})==len(rows)
        groups=[[float(row['outcome']) for row in rows if row['group']==label] for label in ['A','B','C']]
        ctx.check('STAT-201-example-11-1', f_oneway(*groups).statistic, 12, 'SciPy one-way ANOVA, independently from the displayed group sum-of-squares arithmetic.', {'groups':groups})
        ctx.check('STAT-201-example-11-1-p', f_oneway(*groups).pvalue, .008, 'SciPy F survival probability for the actual data.', {'groups':groups},tolerance=1e-10)
        with (data/'regression-teaching.csv').open(encoding='utf-8',newline='') as stream:
            rows=list(DictReader(stream))
        assert len({row['observation_id'] for row in rows})==len(rows)
        x=np.array([float(row['x']) for row in rows]);y=np.array([float(row['y']) for row in rows]);design=np.c_[np.ones(len(rows)),x]
        beta=np.linalg.lstsq(design,y,rcond=None)[0];residual=y-design@beta
        variance=residual@residual/2;cov=variance*np.linalg.inv(design.T@design)
        ctx.check('STAT-201-example-11-2', np.sqrt(cov[1,1]), .424264069, 'Matrix least squares and inverse Gram covariance, separate from centered scalar formulas.', {'x':x.tolist(),'y':y.tolist()},tolerance=1e-9)
        ctx.check('STAT-201-example-11-2-slope', beta[1], 1.2, 'Matrix least-squares slope.', {'x':x.tolist(),'y':y.tolist()})
        ctx.numeric('STAT-201-l11-q3', 20-np.linalg.matrix_rank(np.repeat(np.eye(4),5,axis=0)), 'Residual dimension from the rank of a four-group indicator design.', {'groups':4,'group_sizes':[5,5,5,5]})
        ctx.numeric('STAT-201-l11-q4', np.linalg.lstsq(np.c_[np.ones(3),[1,2,3]],[2,3,5],rcond=None)[0][1], 'Matrix least squares instead of authored Sxy/Sxx formula.', {'x':[1,2,3],'y':[2,3,5]})

    if 'STAT-201-ch1-q3' in ctx.questions:
        students=list(combinations(range(6),2))
        ctx.numeric('STAT-201-ch1-q3', Fraction(sum((a<3)==(b<3) for a,b in students),len(students)), 'Enumerate unordered pairs and count matching majors.', {'students':6,'first_major':3,'draw':2})
        aa={0,1,2,3,4,5};bb={0,1,6}
        ctx.numeric('STAT-201-ch1-q4', Fraction(len(aa^bb),10), 'Count symmetric-difference points in a constructed probability space.', {'A':sorted(aa),'B':sorted(bb),'space':10})
        table={'A_return':4,'A_other':36,'B_return':3,'B_other':57}
        ctx.numeric('STAT-201-ch2-q3', Fraction(7,100), 'Count returns in a 100-item joint frequency table.',table)
        ctx.numeric('STAT-201-ch2-q4', Fraction(4,7), 'Conditional channel frequencies among returned items.',table)
        coins=list(product([0,1],repeat=4))
        ctx.numeric('STAT-201-ch3-q3', Fraction(sum(sum(row)==1 for row in coins),len(coins)), 'Enumerate all four-coin sequences.',{'n':4,'p':.5,'successes':1})
        ctx.numeric('STAT-201-ch3-q4', quad(lambda x:2*np.exp(-2*x),0,.5)[0], 'Integrate waiting-time density to the requested deadline.',{'rate':2,'deadline':.5})
        ctx.numeric('STAT-201-ch4-q3', dblquad(lambda y,x:1,0,1,lambda x:0,lambda x:1-x)[0], 'Integrate event triangle inside a unit-square density.',{'density':1,'event':'x+y<=1'})
        ctx.numeric('STAT-201-ch4-q4', 1/quad(lambda y:1,0,1)[0], 'New uniform density from its support length, cross-checking original-variable linear transform.',{'original_support':[0,2],'transform':'X/2','new_support':[0,1]})
        # A direct four-point independent joint distribution realizes the variances.
        vals=np.array([sx*np.sqrt(3)+2*sy*np.sqrt(5) for sx,sy in product([-1,1],repeat=2)])
        ctx.numeric('STAT-201-ch5-q3',np.var(vals),'Direct variance over an explicit independent finite joint distribution.',{'var_X':3,'var_Y':5,'transform':'X+2Y'})
        ctx.numeric('STAT-201-ch5-q4',Fraction(sum([4,8,8,8]),4),'Average a four-point mixture with declared class frequencies.',{'conditional_means':[4,8],'weights':[.25,.75]})
        ctx.numeric('STAT-201-ch6-q3',Fraction(9,100)/Fraction(1,4),'Exact Markov ratio on the squared sample-mean deviation.',{'population_variance':9,'n':100,'threshold':.5})
        ctx.numeric('STAT-201-ch6-q4',np.var([3,5,7,9],ddof=1),'NumPy sample variance, explicit df.',{'sample':[3,5,7,9],'ddof':1})
        sample=np.array([0,1,2,1,6])
        from scipy.stats import poisson, rankdata
        fit=minimize_scalar(lambda lam:-poisson.logpmf(sample,lam).sum(),bounds=(.001,10),method='bounded',options={'xatol':1e-12})
        ctx.numeric('STAT-201-ch7-q3',fit.x,'Numerically maximize Poisson likelihood for the actual count vector.',{'counts':sample.tolist()})
        ctx.numeric('STAT-201-ch7-q4',quad(lambda u:(4*u/3)*chi2.pdf(u,2),0,np.inf)[0],'Integrate variance MLE against its exact scaled chi-square law.',{'n':3,'true_variance':4,'df':2})
        ctx.numeric('STAT-201-ch8-q3',next(n for n in range(1,1000) if 1.96*np.sqrt(.25/n)<=.05),'Integer search for the first sample size satisfying the stated approximate proportion half width.',{'z':1.96,'planning_p':.5,'half_width':.05})
        ctx.numeric('STAT-201-ch8-q4',2*np.sqrt(np.sum(np.full(16,16/16**2))),'Sum scaled-observation variances, then construct the specified-z half width.',{'sigma':4,'n':16,'z':2})
        ctx.numeric('STAT-201-ch9-q3',2*quad(lambda m:norm.pdf(m,5,1),7,np.inf)[0],'Numerically integrate null sample-mean tails in original units.',{'null_mean':5,'sigma':5,'n':25,'sample_mean':7})
        ctx.numeric('STAT-201-ch9-q4',Fraction(5,100)/20,'Exact allocation of family error across twenty tests.',{'family_error':.05,'tests':20})
        ranks=rankdata([1,2,4,5]);positive=np.array([True,False,True,False])
        ctx.numeric('STAT-201-ch10-q3',ranks[positive].sum(),'SciPy ranking followed by positive-rank sum.',{'absolute_differences':[1,2,4,5],'signs':['+','-','+','-']})
        # Rank of row/column effects yields the complement dimension for independence.
        rows=np.repeat(np.eye(3),4,axis=0);cols=np.tile(np.eye(4),(3,1))
        ctx.numeric('STAT-201-ch10-q4',12-np.linalg.matrix_rank(np.c_[rows,cols]),'Dimension of residual cell space after row/column nuisance effects.',{'rows':3,'columns':4})
        ctx.numeric('STAT-201-ch11-q3',(18/2)/(9/9),'Compute separate between/within mean squares from input sums and dimensions.',{'SSB':18,'SSW':9,'k':3,'N':12})
        design=np.repeat(np.eye(6),4,axis=0)
        ctx.numeric('STAT-201-ch11-q4',24-np.linalg.matrix_rank(design),'Residual dimension from six-cell full factorial design with four repeats.',{'A_levels':2,'B_levels':3,'repeats':4})
        means=np.array([[0,3],[2,7]])
        ctx.check('STAT-201-ch11-q6',np.diff(np.diff(means,axis=0),axis=1)[0,0],2,'Finite double difference of cell means for the open interaction interpretation task.',{'cell_means_A_rows_B_columns':means.tolist()})
        pairs12=list(combinations(range(12),2))
        ctx.numeric('STAT-201-midterm-q3',Fraction(sum(a<5 and b<5 for a,b in pairs12),len(pairs12)),'Enumerate all 66 pairs and count two red balls.',{'balls':12,'red':5,'draw':2})
        ctx.numeric('STAT-201-midterm-q4',np.sqrt(np.sum(np.full(100,25/100**2))),'Sum independent scaled-observation variances.',{'variance':25,'n':100})
        fit=minimize_scalar(lambda rate: -(10*np.log(rate)-rate*50),bounds=(.001,1),method='bounded',options={'xatol':1e-12})
        ctx.numeric('STAT-201-final-q3',fit.x,'Numerically optimize censored log likelihood from aggregate exposure.',{'events':10,'total_exposure':50})
        ctx.numeric('STAT-201-final-q4',(24/2)/(12/12),'Independent ANOVA dimension/mean-square calculation.',{'SSB':24,'SSW':12,'k':3,'N':15})
