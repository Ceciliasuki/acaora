"""Independent original-model optimization, resource constraints and welfare integration."""
import csv
import json
from fractions import Fraction
from pathlib import Path
from xml.etree import ElementTree as ET
import numpy as np
from scipy.integrate import quad
from scipy.optimize import brentq, minimize_scalar


def verify(ctx):
    def example(i,value,expected,method,inputs):ctx.check(f'TRADE-305-example-{i}',value,expected,method,inputs,tolerance=1e-8)
    example(1,Fraction(1,2),.5,'Exact labor reallocation ratio in original technology.',{'home':[1,2],'foreign':[6,3]})
    ctx.numeric('TRADE-305-l1-q2',Fraction(2,4),'Exact opportunity-cost ratio with Y/X units.',{'labor_X':2,'labor_Y':4})
    example(2,Fraction(1,1)/Fraction(1,3),3,'Exact competitive wage from output price per labor requirement.',{'home_aX':1,'foreign_aY':3,'prices':[1,1]})
    ctx.check('TRADE-305-wage-lower',Fraction(3,2),1.5,'Derive foreign Y unit-cost inequality.',{'foreign_aY':3,'home_aY':2})
    ctx.check('TRADE-305-wage-upper',Fraction(6,1),6,'Derive home X unit-cost inequality.',{'foreign_aX':6,'home_aX':1})
    ctx.numeric('TRADE-305-l2-q2',Fraction(1,2)/Fraction(1,3),'Exact price/productivity wage ratio.',{'home_aX':2,'foreign_aY':3,'prices':[1,1]})
    optimum=minimize_scalar(lambda lx:-(2*np.sqrt(lx)+np.sqrt(100-lx)),bounds=(0,100),method='bounded',options={'xatol':1e-11})
    interior=brentq(lambda lx:1/np.sqrt(lx)-1/(2*np.sqrt(100-lx)),.01,99.99)
    example(3,interior,80,'Root of marginal-value difference on actual resource interval; independently compare original objective optimum.',{'production':'sqrt(Lx),sqrt(Ly)','L':100,'prices':[2,1]})
    ctx.check('TRADE-305-allocation-objective',-optimum.fun,10*np.sqrt(5),'Check direct bounded optimization objective independently of marginal-condition root.',{'L':100,'prices':[2,1]},tolerance=1e-12)
    ctx.numeric('TRADE-305-l3-q2',brentq(lambda lx:1/(2*np.sqrt(lx))-1/(2*np.sqrt(100-lx)),.01,99.99),'Root of two original marginal-value schedules.',{'L':100,'prices':[1,1]})
    A=np.array([[2.,1.],[1.,2.]])
    wr=np.linalg.solve(A,[3.3,3]);example(4,wr[0],1.2,'Solve actual two-good zero-profit equations.',{'technology':A.tolist(),'prices':[3.3,3]})
    ctx.check('TRADE-305-capital-return',wr[1],.9,'Check other factor from same independent system.',{'technology':A.tolist(),'prices':[3.3,3]})
    ctx.numeric('TRADE-305-l4-q2',np.linalg.solve(A,[3.6,3])[0],'Linear algebra on independently specified zero-profit inputs.',{'technology':A.tolist(),'prices':[3.6,3]})
    ctx.check('TRADE-305-real-wage-X',wr[0]/3.3,4/11,'Check wage purchase power in X after price change.',{'wage':float(wr[0]),'price_X':3.3})
    example(5,Fraction(100)*Fraction(6,5),120,'Exact revenue budget expressed in import units.',{'export_quantity':100,'relative_price':'6/5'})
    ctx.numeric('TRADE-305-l5-q2',Fraction(60)*Fraction(3,2),'Exact import purchase capacity with given TOT.',{'export_quantity':60,'relative_price':'3/2'})
    directory=Path(__file__).resolve().parents[2]/'content/courses/TRADE-305'
    with (directory/'data/policy-scenarios.csv').open(encoding='utf-8',newline='') as f:rows=list(csv.DictReader(f))
    scenarios=[]
    for row in rows:
        params={k:float(v) for k,v in row.items()};D=lambda p:params['demand_intercept']+params['demand_slope']*p;S=lambda p:params['supply_intercept']+params['supply_slope']*p
        autarky=brentq(lambda p:D(p)-S(p),20,100);pw=params['world_price'];tax=params['tariff'];p=min(pw+tax,autarky);m=max(D(p)-S(p),0)
        cs=-quad(D,pw,p)[0];ps=quad(S,pw,p)[0];revenue=tax*m;welfare=cs+ps+revenue
        scenarios.append({'inputs':params,'autarky_price':autarky,'price':p,'consumption':D(p),'production':S(p),'imports':m,'consumer_change':cs,'producer_change':ps,'revenue':revenue,'national_change':welfare})
    scenario=next(s for s in scenarios if s['inputs']['tariff']==10)
    example(6,-scenario['national_change'],100,'Read fixed CSV, numerically solve autarky then integrate original demand/supply between prices and add domestic revenue.',scenario['inputs'])
    ctx.numeric('TRADE-305-l6-q2',next(s for s in scenarios if s['inputs']['tariff']==5)['imports'],'Original schedules at bounded equilibrium price from actual input CSV.',{'file':'policy-scenarios.csv','tariff':5})
    ctx.numeric('TRADE-305-case-dwl',-scenario['national_change'],'Independent welfare integration on original policy case.',scenario['inputs'])
    for key,expected in [('consumer_change',-550),('producer_change',250),('revenue',200),('imports',20)]:ctx.check('TRADE-305-case-'+key,scenario[key],expected,'Separate incidence component from independent integration.',scenario['inputs'])
    prohibitive=next(s for s in scenarios if s['inputs']['tariff']==40)
    for key,expected in [('price',60),('imports',0),('revenue',0)]:ctx.check('TRADE-305-prohibitive-'+key,prohibitive[key],expected,'Solve original autarky constraint, with nonnegative imports.',prohibitive['inputs'])
    va0=Fraction(100)-Fraction(60);va1=Fraction(110)-Fraction(63)
    example(7,(va1-va0)/va0,.175,'Exact before/after value-added budgets with taxed input cost.',{'output_price':100,'input_value':60,'output_tax':'.10','input_tax':'.05'})
    ctx.numeric('TRADE-305-l7-q2',(Fraction(110)-60-va0)/va0,'Exact value-added protection with zero input tariff.',{'output_price':100,'input_value':60,'output_tax':'.10','input_tax':'0'})
    quantities=np.linalg.solve(A,[110,80]);example(8,quantities[0],140/3,'Solve both actual resource constraints simultaneously.',{'technology':A.tolist(),'resources':[110,80]})
    ctx.numeric('TRADE-305-l8-q2',np.linalg.solve(A,[100,80])[0],'Independent baseline resource solve.',{'technology':A.tolist(),'resources':[100,80]})
    ctx.check('TRADE-305-output-Y',quantities[1],50/3,'Check other output and interior feasibility.',{'technology':A.tolist(),'resources':[110,80]})
    example(9,Fraction(100)-60,40,'Exact single-stage production-value accounting under declared assumptions.',{'export':100,'direct_import_input':60,'indirect_import_input':0})
    ctx.numeric('TRADE-305-l9-q2',Fraction(120)-70,'Exact one-stage local value added.',{'export':120,'direct_import_input':70,'indirect_import_input':0})
    root=directory.parents[2];svg=ET.parse(root/'public/courses/TRADE-305/small-country-tariff.svg').getroot();ns={'s':'http://www.w3.org/2000/svg'}
    paths=[p.attrib['d'] for p in svg.findall('.//s:path',ns)]
    assert 'M290,70L570,230' in paths # actual demand p=100-q at q30,70
    assert 'M80,270L430,70' in paths # actual supply p=q+20 at q0,50
    for i,poly in enumerate(svg.findall('.//s:polygon',ns)):
        pixels=np.array([[float(v) for v in point.split(',')] for point in poly.attrib['points'].split()]);coordinates=np.column_stack(((pixels[:,0]-80)/7,(350-pixels[:,1])/4))
        area=abs(np.dot(coordinates[:,0],np.roll(coordinates[:,1],1))-np.dot(coordinates[:,1],np.roll(coordinates[:,0],1)))/2
        ctx.check(f'TRADE-305-actual-svg-area-{i}',area,50,'Parse actual exported SVG, invert plotting transform and compute shoelace area.',{'vertices':coordinates.tolist()})
    (directory/'data/reference-analysis.json').write_text(json.dumps({'scenarios':scenarios,'scope':'Original small-country competitive model, not observed policy evidence.'},indent=2)+'\n',encoding='utf-8')
