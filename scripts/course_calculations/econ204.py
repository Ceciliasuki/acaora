from fractions import Fraction
from pathlib import Path
from scipy.optimize import minimize, minimize_scalar, linprog, brentq, root
from scipy.integrate import quad
import numpy as np
import json
import xml.etree.ElementTree as ET


def consumer(alpha,m,px,py):
    if m==0:
        return np.array([0.,0.])
    solution=minimize_scalar(lambda x: -(x**alpha)*((m-px*x)/py)**(1-alpha),bounds=(1e-12,m/px-1e-12),method='bounded',options={'xatol':1e-12})
    return np.array([solution.x,(m-px*solution.x)/py])


def expenditure(target,px,py):
    fit=minimize_scalar(lambda x:px*x+py*target**2/x,bounds=(1e-8,10000),method='bounded',options={'xatol':1e-12})
    return fit.fun


def verify(ctx):
    if 'lesson-1' in ctx.lessons:
        fit=minimize(lambda v:-(12*v[0]-v[0]**2),[2.],bounds=[(0,4)],method='SLSQP',options={'ftol':1e-12})
        ctx.check('ECON-204-example-1-1',-fit.fun,32,'Constrained numerical maximization on the feasible interval.',{'objective':'12q-q^2','bounds':[0,4]},tolerance=1e-9)
        price=brentq(lambda p:max(100-p,0)-max(p-20,0),20,100)
        ctx.check('ECON-204-example-1-2',max(100-price,0),40,'Root of nonnegative truncated demand/supply functions.',{'demand_intercept':100,'supply_reservation':20})
        no_trade=[max(100-p,0)-max(p-120,0) for p in np.linspace(100,120,21)]
        ctx.check('ECON-204-example-1-2-no-trade',max(abs(v) for v in no_trade),0,'Check the zero-trade price interval directly in truncated functions.',{'prices':np.linspace(100,120,21).tolist(),'demand_reservation':100,'supply_reservation':120})
        fit=minimize(lambda v:-(8*v[0]-v[0]**2),[2.],bounds=[(0,10)],method='SLSQP',options={'ftol':1e-12})
        ctx.numeric('ECON-204-l1-q3',fit.x[0],'Constrained numerical optimization instead of inserting first-order root.',{'objective':'8x-x^2','bounds':[0,10]})
        p=brentq(lambda p:max(60-p,0)-max(2*p-15,0),7.5,60)
        ctx.numeric('ECON-204-l1-q4',max(60-p,0),'Root find nonnegative demand and supply, then compute feasible trade.',{'demand_intercept':60,'supply_intercept':-15,'supply_slope':2})

    if 'lesson-2' in ctx.lessons:
        bundle=consumer(.5,100,2,1)
        ctx.check('ECON-204-example-2-1',np.sqrt(np.prod(bundle)),np.sqrt(1250),'Direct bounded utility maximization, separate from constant-share demand formula.',{'alpha':.5,'income':100,'prices':[2,1],'optimized_bundle':bundle.tolist()},tolerance=1e-8)
        fit=linprog([-3.,-1.],A_ub=[[2,1]],b_ub=[12],bounds=[(0,None),(0,None)],method='highs')
        ctx.check('ECON-204-example-2-2',-fit.fun,18,'Linear programming of the substitute utility objective and original budget.',{'utility_weights':[3,1],'income':12,'prices':[2,1]})
        fit=linprog([0.,0.,-1.],A_ub=[[2,1,0],[-1,0,1],[0,-1,1]],b_ub=[12,0,0],bounds=[(0,None)]*3,method='highs')
        ctx.check('ECON-204-example-2-2-complement',fit.x[2],4,'Epigraph linear program for min(x,y), not a preset ratio formula.',{'income':12,'prices':[2,1]})
        ctx.numeric('ECON-204-l2-q3',consumer(.25,80,4,2)[0],'Numerically maximize raw Cobb-Douglas utility on the budget.',{'alpha':.25,'income':80,'prices':[4,2]})
        fit=linprog([0.,0.,-1.],A_ub=[[3,4,0],[-.5,0,1],[0,-1,1]],b_ub=[30,0,0],bounds=[(0,None)]*3,method='highs')
        ctx.numeric('ECON-204-l2-q4',fit.x[1],'Epigraph linear program for min(x/2,y).',{'income':30,'prices':[3,4],'utility':'min(x/2,y)'})

    if 'lesson-3' in ctx.lessons:
        h=1e-4
        demand=lambda p:100-2*p
        derivative=(demand(20+h)-demand(20-h))/(2*h)
        ctx.check('ECON-204-example-3-1',derivative*20/demand(20),-2/3,'Numerical centered demand derivative times price/quantity.',{'demand':'100-2p','price':20,'step':h},tolerance=1e-8)
        ctx.check('ECON-204-example-3-2',np.dot([2,1],[2,1]),5,'Direct dot product at the second observed budget prices.',{'prices':[2,1],'bundle':[2,1],'second_income':3})
        demand=lambda p:120-3*p
        derivative=(demand(20+h)-demand(20-h))/(2*h)
        ctx.numeric('ECON-204-l3-q3',derivative*20/demand(20),'Numerical centered derivative; declared answer used only for comparison.',{'demand':'120-3p','price':20,'step':h})
        ctx.numeric('ECON-204-l3-q4',np.dot([2,3],[4,2]),'Direct vector dot product.',{'prices':[2,3],'bundle':[4,2]})

    if 'lesson-4' in ctx.lessons:
        ctx.check('ECON-204-example-4-1',expenditure(10,4,1),40,'Numerically minimize cost over the utility constraint xy>=100.',{'target_utility':10,'prices':[4,1]},tolerance=1e-8)
        ctx.check('ECON-204-example-4-2',expenditure(50,4,1)-100,100,'Re-optimize expenditure at new prices and the original utility.',{'income':100,'old_prices':[1,1],'new_prices':[4,1],'target_utility':50},tolerance=1e-8)
        ctx.check('ECON-204-example-4-2-EV',100-expenditure(25,1,1),50,'Re-optimize at old prices and new utility for equivalent variation.',{'income':100,'old_prices':[1,1],'new_utility':25},tolerance=1e-8)
        ctx.check('ECON-204-example-4-2-CS',quad(lambda p:50/p,1,4)[0],50*np.log(4),'Numerical integration over uncompensated demand, independently from logarithm evaluation.',{'demand':'50/p','price_change':[1,4]},tolerance=1e-9)
        ctx.numeric('ECON-204-l4-q3',expenditure(6,1,4),'Numerically minimize original expenditure subject to target product.',{'target_utility':6,'prices':[1,4]})
        # Each Hicks demand is separately solved from its cost-optimal stationarity condition.
        hx=lambda p:brentq(lambda x:p-2500/x**2,1,100,xtol=1e-13)
        ctx.numeric('ECON-204-l4-q4',(hx(1+1e-4)-hx(1-1e-4))/(2e-4),'Centered derivative of independently root-solved compensated optimum.',{'target_utility':50,'py':1,'px':1,'step':1e-4})

    if 'lesson-5' in ctx.lessons:
        fit=minimize(lambda v: -np.log(v[0])-np.log(120-v[0]),[20.],bounds=[(.001,40)],method='SLSQP',options={'ftol':1e-12})
        ctx.check('ECON-204-example-5-1',fit.x[0],40,'Constrained numerical utility maximization with no borrowing.',{'income':[40,80],'rate':0,'beta':1,'first_period_upper_bound':40},tolerance=1e-8)
        fit=minimize_scalar(lambda c:-np.log(c)-np.log(120-c),bounds=(.001,119.999),method='bounded',options={'xatol':1e-12})
        ctx.check('ECON-204-example-5-1-unconstrained',fit.x,60,'Numerical maximization under unrestricted intertemporal transfer.',{'income':[40,80],'rate':0,'beta':1},tolerance=1e-6)
        ce=brentq(lambda value:np.log(value)-np.mean(np.log([50.,100.])),50,100)
        ctx.check('ECON-204-example-5-2',ce,np.sqrt(5000),'Root solve utility equal to expected state utility instead of using geometric-mean formula.',{'wealth':[50,100],'probabilities':[.5,.5],'utility':'log'},tolerance=1e-10)
        ctx.check('ECON-204-example-5-2-premium',75-ce,75-np.sqrt(5000),'Mean wealth minus the independently solved certainty equivalent.',{'wealth':[50,100],'probabilities':[.5,.5]},tolerance=1e-10)
        fit=minimize_scalar(lambda c:-np.log(c)-np.log(100-c),bounds=(.001,99.999),method='bounded',options={'xatol':1e-12})
        ctx.numeric('ECON-204-l5-q3',fit.x,'Numerically maximize the two-period objective on the full present-value budget.',{'income':[30,70],'beta':1,'rate':0})
        values=[100-Fraction(1,4)*40-loss+repayment for loss,repayment in [(0,0),(40,40)]]
        assert values[0]==values[1]
        ctx.numeric('ECON-204-l5-q4',values[0],'Construct insured state cash flows and verify identical wealth in both states.',{'initial_wealth':100,'loss':40,'probability':.25,'coverage':40})

    if 'lesson-6' in ctx.lessons:
        def cost(q,r,w):
            fit=minimize(lambda v:r*v[0]+w*v[1],[q,q],bounds=[(1e-9,None)]*2,constraints=[{'type':'ineq','fun':lambda v:np.sqrt(v[0]*v[1])-q}],method='SLSQP',options={'ftol':1e-12,'maxiter':1000})
            assert fit.success and np.sqrt(np.prod(fit.x))>=q-1e-7
            return fit
        fit=cost(10,4,1)
        ctx.check('ECON-204-example-6-1',fit.fun,40,'Constrained two-input numerical cost minimization using the original production function.',{'target_output':10,'r':4,'w':1,'inputs':fit.x.tolist()},tolerance=1e-7)
        required_labour=brentq(lambda labour:np.sqrt(4*labour)-6,.001,100)
        ctx.check('ECON-204-example-6-2',4+required_labour,13,'Root solve production for labor under fixed capital, then add expenditure.',{'output':6,'fixed_capital':4,'r':1,'w':1},tolerance=1e-10)
        ctx.numeric('ECON-204-l6-q3',cost(8,2,2).fun,'Constrained numerical optimization rather than inserting cost function.',{'output':8,'r':2,'w':2})
        total=lambda q:10+2*q+q*q
        ctx.numeric('ECON-204-l6-q4',(total(3+1e-4)-total(3-1e-4))/(2e-4),'Centered derivative of total cost.',{'cost':'10+2q+q^2','output':3,'step':1e-4})

    if 'lesson-7' in ctx.lessons:
        fit=minimize_scalar(lambda q: -((100-q)*q-20*q),bounds=(0,100),method='bounded',options={'xatol':1e-12})
        ctx.check('ECON-204-example-7-1',-fit.fun,1600,'Numerically maximize profit over nonnegative, nonnegative-price output.',{'inverse_demand':'100-q','cost':'20q'},tolerance=1e-8)
        q=brentq(lambda q:(100-q)-(20+q)-20,0,40)
        ctx.check('ECON-204-example-7-2',20*q,600,'Solve price-wedge equilibrium numerically, then compute revenue.',{'inverse_demand':'100-q','inverse_supply':'20+q','tax':20})
        ctx.check('ECON-204-example-7-2-DWL',quad(lambda x:(100-x)-(20+x),q,40)[0],100,'Integrate lost gains from trade, separate from triangle formula.',{'lost_quantity_interval':[q,40],'tax':20},tolerance=1e-10)
        fit=minimize_scalar(lambda q:-((80-2*q)*q-20*q),bounds=(0,40),method='bounded',options={'xatol':1e-12})
        ctx.numeric('ECON-204-l7-q3',fit.x,'Direct nonnegative-output profit maximization.',{'inverse_demand':'80-2q','cost':'20q'})
        surplus=lambda q:quad(lambda x:(100-x)-(20+x)-100,0,q)[0]
        fit=minimize(lambda v:-surplus(v[0]),[1.],bounds=[(0,40)],method='SLSQP',options={'ftol':1e-12})
        ctx.numeric('ECON-204-l7-q4',fit.x[0],'Constrained optimum of post-tax gains from nonnegative trade, independently rejecting negative algebraic quantity.',{'tax':100,'quantity_bounds':[0,40]})

    if 'lesson-8' in ctx.lessons:
        def cournot(a,b,c):
            solution=root(lambda q:[a-c-b*(2*q[0]+q[1]),a-c-b*(q[0]+2*q[1])],[1.,1.])
            assert solution.success and np.all(solution.x>=0)
            return solution.x
        quantities=cournot(100,1,10)
        price=100-quantities.sum()
        ctx.check('ECON-204-example-8-1',(price-10)*quantities[0],900,'Numerically solve the joint individual profit first-order system, then calculate profit.',{'a':100,'b':1,'c':10,'quantities':quantities.tolist()},tolerance=1e-8)
        leader=brentq(lambda q:45-q,0,90)
        follower=minimize_scalar(lambda q:-((100-leader-q-10)*q),bounds=(0,90),method='bounded',options={'xatol':1e-12}).x
        ctx.check('ECON-204-example-8-2',(100-leader-follower-10)*leader,1012.5,'Solve leader stationarity and independently maximize follower profit after the commitment.',{'a':100,'b':1,'c':10,'leader':leader,'follower':follower},tolerance=1e-5)
        ctx.numeric('ECON-204-l8-q3',cournot(70,1,10)[0],'Numerical joint first-order system instead of symmetric quantity formula.',{'a':70,'b':1,'c':10})
        leader=brentq(lambda q:30-q,0,60)
        follower=minimize_scalar(lambda q:-((70-leader-q-10)*q),bounds=(0,60),method='bounded',options={'xatol':1e-12}).x
        ctx.numeric('ECON-204-l8-q4',follower,'Numerically maximize follower original profit at the optimal leader commitment.',{'a':70,'b':1,'c':10,'leader_quantity':leader})

    if 'lesson-8-factor' in ctx.lessons:
        fit=minimize_scalar(lambda labour:-(20*np.sqrt(labour)-5*labour),bounds=(0,100),method='bounded',options={'xatol':1e-12})
        ctx.check('ECON-204-example-8f-1',fit.x,4,'Direct nonnegative labor profit maximization.',{'production':'10sqrt(L)','output_price':2,'wage':5},tolerance=1e-6)
        revenue=lambda labour:20*labour-labour**2
        fit=minimize_scalar(lambda labour:-(revenue(labour)-(2+labour)*labour),bounds=(0,10),method='bounded',options={'xatol':1e-12})
        ctx.check('ECON-204-example-8f-2',2+fit.x,6.5,'Optimize original revenue less the full uniform wage bill, then recover wage.',{'revenue':'20L-L^2','wage':'2+L','bounds':[0,10]},tolerance=1e-6)
        profit=lambda labour:revenue(labour)-max(8,2+labour)*labour
        candidates=[0,6,10]+[minimize_scalar(lambda labour:-profit(labour),bounds=bounds,method='bounded').x for bounds in [(0,6),(6,10)]]
        opt=max(candidates,key=profit)
        ctx.check('ECON-204-example-8f-2-minimum-wage',opt,6,'Global piecewise profit comparison, including kink and feasible boundaries.',{'minimum_wage':8,'candidates':candidates})
        fit=minimize_scalar(lambda labour:-(8*np.sqrt(labour)-2*labour),bounds=(0,100),method='bounded',options={'xatol':1e-12})
        ctx.numeric('ECON-204-l8f-q3',fit.x,'Direct numerical profit maximization.',{'production':'8sqrt(L)','output_price':1,'wage':2})
        bill=lambda labour:(3+2*labour)*labour
        ctx.numeric('ECON-204-l8f-q4',(bill(5+1e-4)-bill(5-1e-4))/(2e-4),'Centered derivative of the entire wage bill, not of the wage rate.',{'wage':'3+2L','labour':5,'step':1e-4})

    if 'lesson-9' in ctx.lessons:
        excess=lambda price:((8*price+2)+(2*price+8))/(2*price)-10
        price=brentq(excess,.1,10)
        income=8*price+2
        a=consumer(.5,income,price,1)
        ctx.check('ECON-204-example-9-1',a[0],5,'Root find resource clearing with endogenous endowment wealth; independently optimize individual utility.',{'endowments':[[8,2],[2,8]],'normalized_py':1,'solved_px':price},tolerance=1e-6)
        ctx.check('ECON-204-example-9-2',np.sqrt(2*2),2,'Direct utility at the feasible unequal allocation; confirm both MRS are identical.',{'allocation':[[2,2],[8,8]],'resources':[10,10]})
        ctx.check('ECON-204-example-9-2-MRS',2/2-8/8,0,'Compare both directional marginal rates at the interior allocation.',{'allocation':[[2,2],[8,8]]})
        ctx.numeric('ECON-204-l9-q3',np.dot([2,1],[8,2]),'Direct value of original endowment at specified prices.',{'prices':[2,1],'endowment':[8,2]})
        u=lambda x,y:np.sqrt(x*y)
        ux=(u(4+1e-4,8)-u(4-1e-4,8))/(2e-4)
        uy=(u(4,8+1e-4)-u(4,8-1e-4))/(2e-4)
        ctx.numeric('ECON-204-l9-q4',ux/uy,'Ratio of numerical utility partial derivatives, independent of y/x insertion.',{'bundle':[4,8],'utility':'sqrt(xy)','step':1e-4})

    if 'lesson-10' in ctx.lessons:
        welfare=lambda q:quad(lambda x:(100-x)-(20+x)-10,0,q)[0]
        fit=minimize_scalar(lambda q:-welfare(q),bounds=(0,100),method='bounded',options={'xatol':1e-12})
        ctx.check('ECON-204-example-10-1',welfare(fit.x)-welfare(40),25,'Numerically integrate social net benefits and optimize quantity, then compare against private allocation.',{'MB':'100-q','PMC':'20+q','MD':10},tolerance=1e-8)
        mb=lambda q:max(10-q,0)+max(6-q,0)
        optimum=brentq(lambda q:mb(q)-8,0,10)
        ctx.check('ECON-204-example-10-2',optimum,4,'Root of piecewise vertically aggregated public-good marginal benefits.',{'individual_MB_intercepts':[10,6],'MC':8})
        a=brentq(lambda q:max(10-q,0)-8,0,10)
        assert max(6-a,0)<8
        ctx.check('ECON-204-example-10-2-voluntary',a,2,'Solve A contribution incentive and check B zero-contribution best response.',{'A_MB':'max(10-G,0)','B_MB':'max(6-G,0)','MC':8})
        fit=minimize_scalar(lambda q:-quad(lambda x:(90-x)-(10+x)-20,0,q)[0],bounds=(0,90),method='bounded',options={'xatol':1e-12})
        ctx.numeric('ECON-204-l10-q3',fit.x,'Numerically optimize social surplus rather than insert linear optimum.',{'MB':'90-q','PMC':'10+q','MD':20})
        ctx.numeric('ECON-204-l10-q4',brentq(lambda g:max(8-g,0)+max(4-g,0)-6,0,8),'Root solve the actual piecewise aggregate benefit condition.',{'MB_intercepts':[8,4],'MC':6})

    if 'lesson-11' in ctx.lessons:
        ctx.check('ECON-204-example-11-1',Fraction(10)-3,7,'Construct net high-type signal payoff and independently verify the low-type no-mimic inequality.',{'high_wage':10,'low_wage':4,'signal':3,'costs_per_unit':[1,3]})
        assert 10-3*3<4 and 10-3>4
        fit=linprog([1.],A_ub=[[-.4],[-.8]],b_ub=[-1,-1],bounds=[(0,None)],method='highs')
        ctx.check('ECON-204-example-11-2',.8*(10-fit.x[0]),6,'Linear programming over IC and PC, then compute expected principal payoff.',{'high_success':.8,'low_success':.4,'effort_cost':1,'outside':0,'success_value':10})
        ctx.check('ECON-204-example-11-2-bonus',fit.x[0],2.5,'Separate contract bonus from principal payoff.',{'IC_coeff':.4,'cost':1,'PC_coeff':.8,'outside':0})
        fit=linprog([1.],A_ub=[[-.4]],b_ub=[-2],bounds=[(0,None)],method='highs')
        ctx.numeric('ECON-204-l11-q3',fit.x[0],'Linear program for the stated incentive constraint.',{'high_success':.9,'low_success':.5,'effort_cost':2})
        fit=linprog([1.],A_ub=[[-3.]],b_ub=[-6],bounds=[(0,None)],method='highs')
        ctx.numeric('ECON-204-l11-q4',fit.x[0],'Linear program for low-type no-mimic constraint.',{'high_wage':10,'low_wage':4,'low_type_cost_per_unit':3})

    if 'ECON-204-ch1-q3' in ctx.questions:
        fit=minimize(lambda v:-(10*v[0]-v[0]**2),[1.],bounds=[(0,3)],method='SLSQP',options={'ftol':1e-12})
        ctx.numeric('ECON-204-ch1-q3',-fit.fun,'Constrained numerical maximization on the actual capacity interval.',{'objective':'10x-x^2','bounds':[0,3]})
        ctx.numeric('ECON-204-ch1-q4',brentq(lambda p:max(80-2*p,0)-max(p-5,0),5,40),'Root find the truncated demand/supply equilibrium.',{'demand':'max(80-2p,0)','supply':'max(p-5,0)'})
        fit=linprog([-2.,-1.],A_ub=[[3,2]],b_ub=[18],bounds=[(0,None)]*2,method='highs')
        ctx.numeric('ECON-204-ch2-q3',fit.x[0],'Linear program for substitute utility with original budget.',{'income':18,'prices':[3,2],'utility_weights':[2,1]})
        fit=linprog([0.,0.,-1.],A_ub=[[2,1,0],[-1,0,1],[0,-1,3]],b_ub=[24,0,0],bounds=[(0,None)]*3,method='highs')
        ctx.numeric('ECON-204-ch2-q4',fit.x[1],'Epigraph linear program for min(x,y/3).',{'income':24,'prices':[2,1],'utility':'min(x,y/3)'})
        demand=lambda p:200/p;h=1e-4
        ctx.numeric('ECON-204-ch3-q3',(demand(10+h)-demand(10-h))/(2*h)*10/demand(10),'Centered numerical derivative of inverse demand quantity.',{'demand':'200/p','price':10,'step':h})
        ctx.numeric('ECON-204-ch3-q4',np.dot([1,2],[2,1]),'Original-bundle expenditure at second-period prices.',{'price':[1,2],'bundle':[2,1],'income':5})
        p1=np.array([2,1]);p2=np.array([1,2]);aa=np.array([2,1]);bb=np.array([1,2])
        ctx.check('ECON-204-ch3-q5',min(p1@aa-p1@bb,p2@bb-p2@aa),1,'Both strict affordability gaps in the open revealed-preference consistency task.',{'prices':[p1.tolist(),p2.tolist()],'bundles':[aa.tolist(),bb.tolist()]})
        ctx.numeric('ECON-204-ch4-q3',expenditure(3,9,1),'Numerical expenditure minimization under original target utility.',{'target_utility':3,'prices':[9,1]})
        ctx.numeric('ECON-204-ch4-q4',quad(lambda p:10/p,1,2)[0],'Independent adaptive quadrature for the quasi-linear welfare path.',{'demand':'10/p','prices':[1,2],'numeraire_interior':True})
        wealth=40+66/1.1
        # Scalar objective values are flat near the optimum; root the monotone
        # marginal-utility condition to retain the original 1e-6 answer gate.
        consumption=brentq(lambda c:1/c-1/(wealth-c),.001,wealth-.001,xtol=1e-12)
        ctx.numeric('ECON-204-ch5-q3',40-consumption,'Root solve marginal intertemporal utility and recover signed saving.',{'income':[40,66],'rate':.1,'beta':1})
        utility=lambda q:.75*np.log(100-.27*q)+.25*np.log(80+.73*q)
        derivative=lambda q: -.75*.27/(100-.27*q)+.25*.73/(80+.73*q)
        optimum=brentq(derivative,0,20)
        assert utility(optimum)>max(utility(0),utility(20))
        ctx.numeric('ECON-204-ch5-q4',optimum,'Root solve the state-weighted utility derivative and compare both feasible insurance boundaries.',{'wealth':100,'loss':20,'loss_probability':.25,'premium_per_unit':.27,'bounds':[0,20]})
        fit=linprog([3.,1.],A_ub=[[-1,0],[0,-1]],b_ub=[-10,-5],bounds=[(0,None)]*2,method='highs')
        ctx.numeric('ECON-204-ch6-q3',fit.fun,'Linear cost minimization using the separate Leontief production bottlenecks.',{'output':5,'technology':'min(K/2,L)','r':3,'w':1})
        production=lambda k,l:k**.4*l**.8
        ctx.numeric('ECON-204-ch6-q4',production(2,2)/production(1,1),'Evaluate actual production before/after simultaneous input scaling.',{'exponents':[.4,.8],'input_scale':2})
        q=brentq(lambda q:(120-2*q)-(20+q)-10,0,40)
        ctx.numeric('ECON-204-ch7-q3',20+q,'Root solve tax-wedge equilibrium then recover net seller price.',{'inverse_demand':'120-2q','inverse_supply':'20+q','tax':10})
        fit=minimize_scalar(lambda q:-(6*q-(2*q+q*q)),bounds=(0,20),method='bounded',options={'xatol':1e-12})
        ctx.numeric('ECON-204-ch7-q4',fit.x,'Direct incremental-profit maximization with the sunk fixed cost excluded.',{'price':6,'variable_cost':'2q+q^2','sunk_fixed_cost':20})
        q=root(lambda v:[90-2*v[i]-sum(v[j] for j in range(3) if j!=i) for i in range(3)],[10.,10.,10.]).x
        ctx.numeric('ECON-204-ch8-q3',q[0],'Solve the three-firm joint first-order system instead of reusing two-firm quantities.',{'firms':3,'a':100,'b':1,'c':10})
        fit=minimize_scalar(lambda l:-(18*l-l*l-(2+2*l)*l),bounds=(0,9),method='bounded',options={'xatol':1e-12})
        ctx.numeric('ECON-204-ch8-q4',fit.x,'Numerically maximize revenue less the complete uniform wage bill.',{'revenue':'18L-L^2','wage':'2+2L'})
        p=brentq(lambda p:(12*p+8)/(2*p)-12,.1,10)
        ctx.numeric('ECON-204-ch9-q3',p,'Root solve aggregate resource clearing with endowment wealth.',{'total_endowment':[12,8],'Cobb_share':.5,'normalized_py':1})
        u=lambda x,y:np.sqrt(x*y);h=1e-4
        ctx.numeric('ECON-204-ch9-q4',((u(3+h,6)-u(3-h,6))/(2*h))/((u(3,6+h)-u(3,6-h))/(2*h)),'Ratio of numerical utility partial derivatives.',{'bundle':[3,6],'step':h})
        fit=minimize_scalar(lambda q:-quad(lambda x:(100-x)-(10+x)-x,0,q)[0],bounds=(0,100),method='bounded',options={'xatol':1e-12})
        ctx.numeric('ECON-204-ch10-q3',fit.x,'Integrate quantity-dependent external damage in welfare, then numerically optimize.',{'MB':'100-q','PMC':'10+q','MD':'q'})
        ctx.numeric('ECON-204-ch10-q4',brentq(lambda g:3*max(6-g,0)-9,0,6),'Root solve piecewise vertically aggregated benefits of three people.',{'people':3,'individual_MB':'max(6-G,0)','MC':9})
        fit=linprog([1.],A_ub=[[-.5],[-.75]],b_ub=[-3,-5],bounds=[(0,None)],method='highs')
        ctx.numeric('ECON-204-ch11-q3',fit.x[0],'Linear program enforcing both incentive and nonzero-outside-option participation constraints.',{'p_high':.75,'p_low':.25,'cost':3,'outside':2})
        fit=linprog([1.],A_ub=[[-2.]],b_ub=[-6],bounds=[(0,None)],method='highs')
        ctx.numeric('ECON-204-ch11-q4',fit.x[0],'Linear program for the low-type non-mimic constraint.',{'high_wage':10,'low_wage':4,'cost_per_unit':2})
        ctx.numeric('ECON-204-midterm-q3',consumer(.4,150,3,2)[1],'Direct bounded consumer utility optimization.',{'share_x':.4,'income':150,'prices':[3,2]})
        fit=cost(12,9,1)
        ctx.numeric('ECON-204-midterm-q4',fit.fun,'Original-production constrained cost minimization.',{'output':12,'r':9,'w':1})
        ctx.numeric('ECON-204-final-q3',brentq(lambda q:(90-q)-(10+q)-20,0,40),'Numerical root of original tax price wedge.',{'inverse_demand':'90-q','inverse_supply':'10+q','tax':20})
        fit=linprog([1.],A_ub=[[-.6]],b_ub=[-1.5],bounds=[(0,None)],method='highs')
        ctx.numeric('ECON-204-final-q4',fit.x[0],'Linear program for the stated action incentive constraint.',{'p_high':.8,'p_low':.2,'cost':1.5})

    verify_figures(ctx)


def verify_figures(ctx):
    root=Path(__file__).resolve().parents[2]
    metadata=json.loads((root/'content/courses/ECON-204/figures.json').read_text(encoding='utf-8'))
    ns={'s':'http://www.w3.org/2000/svg'}
    functions=[[lambda x:100-2*x,lambda x:1250/x],[lambda x:100-x,lambda x:20+x,lambda x:40+x]]
    for spec,expected_curves in zip(metadata['figures'],functions):
        source=(root/'public/courses/ECON-204'/spec['file']).read_text(encoding='utf-8')
        assert '<script' not in source and 'href=' not in source and '<foreignObject' not in source
        tree=ET.fromstring(source)
        traces=tree.findall('.//s:polyline',ns)
        assert len(traces)==len(expected_curves)
        maximum=0
        for element,fn in zip(traces,expected_curves):
            pixels=np.array([[float(v) for v in point.split(',')] for point in element.attrib['points'].split()])
            assert len(pixels)==101
            x=(pixels[:,0]-80)*spec['domain']['xMax']/540
            y=(340-pixels[:,1])*spec['domain']['yMax']/290
            maximum=max(maximum,float(np.max(np.abs(y-np.array([fn(value) for value in x])))))
        ctx.check('ECON-204-figure-'+spec['file'],maximum,0,'Parse the actual SVG polylines, invert graph coordinates and check all sampled points against independent model equations.',{'file':spec['file'],'curves':spec['curves'],'samples_per_curve':101,'coordinate_rounding_pixels':.001},tolerance=.002)
    ctx.check('ECON-204-figure-consumer-tangency',-1250/25**2,-2,'Independently compare indifference slope and budget slope at the displayed optimum.',{'point':[25,50],'indifference_product':1250,'prices':[2,1]})
    svg=ET.fromstring((root/'public/courses/ECON-204/market-tax.svg').read_text(encoding='utf-8'))
    polygon=svg.find('.//s:polygon',ns)
    pixels=np.array([[float(v) for v in point.split(',')] for point in polygon.attrib['points'].split()])
    points=np.c_[(pixels[:,0]-80)*60/540,(340-pixels[:,1])*120/290]
    assert np.allclose(points,metadata['figures'][1]['triangle'],atol=.001,rtol=0)
    area=abs(np.dot(points[:,0],np.roll(points[:,1],1))-np.dot(points[:,1],np.roll(points[:,0],1)))/2
    ctx.check('ECON-204-figure-tax-area',area,100,'Parse actual SVG polygon, invert graph coordinates and compute shoelace area.',{'vertices':points.tolist(),'coordinate_rounding_pixels':.001},tolerance=.002)
    from scipy.optimize import brentq
    ctx.numeric('ECON-204-case-quantity',brentq(lambda q:100-q-(20+q+20),0,100),'Numerically solve original buyer-price minus seller-price and tax equilibrium equation.',{'demand_intercept':100,'supply_intercept':20,'slopes':[-1,1],'tax':20})
