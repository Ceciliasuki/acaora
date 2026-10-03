"""Independent cash-flow routes and explicit quote/sign accounting."""
import csv
import json
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
import numpy as np
from scipy.optimize import brentq


def verify(ctx):
    def example(i,value,expected,method,inputs):ctx.check(f'FIN-308-example-{i}',value,expected,method,inputs,tolerance=1e-8)
    example(1,Fraction(5)-23,-18,'Exact separate financial asset and liability transaction accounting under declared BPM6 convention.',{'net_asset_acquisition':5,'net_liability_incurrence':23})
    ctx.check('FIN-308-NEO',Fraction(5)-23-(Fraction(-20)+2),0,'Compute residual financial minus current/capital account, not the opposite convention.',{'CA':-20,'KA':2,'FA':-18})
    ctx.numeric('FIN-308-l1-q2',Fraction(12)-20,'Exact net acquisition minus net incurrence.',{'assets':12,'liabilities':20})
    example(2,Decimal('7')*Decimal('1.2'),8.4,'Follow two unit-compatible currency conversions starting from one EUR.',{'CNY_per_USD':'7','USD_per_EUR':'1.2'})
    ctx.numeric('FIN-308-l2-q2',Decimal('7.2')*100/600,'Convert identical foreign basket to domestic units then divide domestic price.',{'CNY_per_USD':'7.2','foreign_basket_USD':100,'domestic_basket_CNY':600})
    ctx.check('FIN-308-inverse-percent',Fraction(7,8)-1,-.125,'Compute actual inverse-quote percentage when original rises 7 to 8.',{'original_quotes':[7,8]})
    # Compute PPP from independently specified basket levels, not a stored relative formula.
    domestic0=Decimal('700');foreign0=Decimal('100');domestic1=domestic0*Decimal('1.05');foreign1=foreign0*Decimal('1.02')
    example(3,domestic1/foreign1,245/34,'Reprice both original baskets independently and take unit-compatible price ratio.',{'domestic_prices':[str(domestic0),str(domestic1)],'foreign_prices':[str(foreign0),str(foreign1)]})
    ctx.numeric('FIN-308-l3-q2',Decimal('660')/100,'Absolute ratio from independently repriced base baskets.',{'domestic_prices':[600,660],'foreign_prices':[100,100]})
    def forward(spot,rd,rf):return brentq(lambda F:F*(1+rf)/spot-(1+rd),spot*.5,spot*1.5)
    F=forward(7,.04,.02);example(4,F,364/51,'Numerically equate actual maturity cash flows on domestic deposit and fully covered foreign route.',{'spot_domestic_per_foreign':7,'domestic_period_return':.04,'foreign_period_return':.02})
    ctx.check('FIN-308-CIP-routes',F/7*1.02,1.04,'Check both complete maturity cash-flow routes after numerical solution.',{'forward':F,'spot':7,'foreign_return':.02})
    ctx.numeric('FIN-308-l4-q2',forward(10,.03,.01),'Cash-flow root with separate foreign conversion and maturity settlement.',{'spot':10,'domestic_period_return':.03,'foreign_period_return':.01})
    example(5,Fraction(1000)-sum(map(Fraction,[600,200,150])),50,'Exact original expenditure accounting, limited to NX.',{'Y':1000,'C':600,'I':200,'G':150})
    ctx.numeric('FIN-308-l5-q2',Fraction(800)-830,'Exact income minus declared domestic absorption.',{'Y':800,'A':830})
    # Unknown vector [Y,i,e], independent IS, LM, and world-interest constraints.
    A=np.array([[.4,10,-20],[.5,-20,0],[0,1,0.]])
    original=np.linalg.solve(A,[100,150,.05]);example(6,original[0],302,'Solve all three actual IS/LM/world-interest constraints simultaneously.',{'coefficient_matrix':A.tolist(),'rhs':[100,150,.05]})
    ctx.check('FIN-308-MF-quote',original[2],1.065,'Check positive domestic/foreign quote from full system.',{'rhs':[100,150,.05]})
    changed=np.linalg.solve(A,[100,160,.05]);ctx.numeric('FIN-308-l6-q2',changed[0],'Resolve full original equilibrium after money-input change.',{'coefficient_matrix':A.tolist(),'rhs':[100,160,.05]})
    ctx.check('FIN-308-MF-float-change',changed[2],1.465,'New equilibrium quote under explicitly floating constraints.',{'rhs':[100,160,.05]})
    ctx.check('FIN-308-MF-residual',np.linalg.norm(A@original-np.array([100,150,.05])),0,'Check all original equation residuals rather than isolated output.',{'solution':original.tolist()},tolerance=1e-12)
    example(7,Fraction(100)-100,0,'Exact central-bank asset transaction balance, excluding valuation.',{'foreign_asset_purchase_domestic':100,'domestic_asset_sale':100})
    ctx.numeric('FIN-308-l7-q2',Fraction(80)-50,'Exact base-money transaction accounting.',{'foreign_asset_purchase_domestic':80,'domestic_asset_sale':50})
    directory=Path(__file__).resolve().parents[2]/'content/courses/FIN-308'
    with (directory/'data/hedging-scenarios.csv').open(encoding='utf-8',newline='') as f:rows=list(csv.DictReader(f))
    scenarios=[]
    for i,row in enumerate(rows):
        Q=Decimal(row['foreign_amount']);F=Decimal(row['forward_domestic_per_foreign']);spot=Decimal(row['spot_domestic_per_foreign'])
        receipt=Q*spot;forward_settlement=(F-spot)*Q;combined=receipt+forward_settlement
        ctx.check(f'FIN-308-scenario-{i}-combined',combined,714000,'Read actual CSV; separately convert underlying receipt and settle short-foreign forward payoff, then sum.',row)
        scenarios.append({'inputs':row,'unhedged_domestic':str(receipt),'forward_domestic_profit':str(forward_settlement),'combined_domestic':str(combined)})
    example(8,Decimal(scenarios[0]['combined_domestic']),714000,'Complete maturity flow route on original fixed scenario CSV.',rows[0])
    ctx.numeric('FIN-308-l8-q2',Decimal('50000')*Decimal('7.1'),'Exact matching long-foreign forward payment obligation.',{'USD_amount':'50000','CNY_per_USD':'7.1'})
    ctx.numeric('FIN-308-case-receipt',Decimal(scenarios[2]['combined_domestic']),'Independent underlying and forward settlement in adverse comparison scenario.',rows[2])
    ctx.check('FIN-308-scenario-profit-low',Decimal(scenarios[0]['forward_domestic_profit']),34000,'Keep favorable forward comparison scenario.',rows[0])
    ctx.check('FIN-308-scenario-profit-high',Decimal(scenarios[2]['forward_domestic_profit']),-36000,'Keep unfavorable forward comparison scenario; no filtering.',rows[2])
    example(9,Decimal('100000')*8-Decimal('100000')*7,100000,'Separately revalue unchanged foreign principal at two quotes.',{'USD_principal':'100000','CNY_per_USD':[7,8]})
    ctx.numeric('FIN-308-l9-q2',Decimal('50000')*Decimal('6.6')-Decimal('50000')*6,'Subtract complete original and stressed domestic liability values.',{'USD_principal':'50000','CNY_per_USD':['6','6.6']})
    (directory/'data/reference-analysis.json').write_text(json.dumps({'scenarios':scenarios,'quote':'CNY/USD, all synthetic','scope':'Fixed cash-flow amount/tenor, no fees or defaults; comparison is not an exchange-rate forecast or return guarantee.'},indent=2)+'\n',encoding='utf-8')
