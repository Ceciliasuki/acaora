import {mkdirSync,writeFileSync} from 'node:fs';
const directory='public/courses/ECON-204';mkdirSync(directory,{recursive:true});
const xml=t=>String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function plot({file,title,xMax,yMax,curves,points,areas=[],notes=[]}) {
 const left=80,top=50,width=540,height=290;
 const xy=(x,y)=>[left+x/xMax*width,top+height-y/yMax*height];
 const coords=rows=>rows.map(([x,y])=>xy(x,y).map(n=>n.toFixed(3)).join(',')).join(' ');
 const text=(x,y,label,color='#26364a')=>`<text x="${x}" y="${y}" fill="${color}" paint-order="stroke" stroke="white" stroke-width="5" stroke-linejoin="round">${xml(label)}</text>`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420"><rect width="720" height="420" fill="white"/><g font-family="Microsoft YaHei,Arial,sans-serif" font-size="21">${text(80,32,title)}<path d="M80 50V340H650" fill="none" stroke="#26364a" stroke-width="2"/>${text(54,49,'P / y')}${text(639,371,'Q / x')}`;
 for(const area of areas)svg+=`<polygon points="${coords(area.points)}" fill="${area.color}"/>`;
 for(const curve of curves){const samples=Array.from({length:101},(_,i)=>{const x=curve.from+(curve.to-curve.from)*i/100;return[x,curve.fn(x)];});svg+=`<polyline points="${coords(samples)}" stroke="${curve.color}" stroke-width="3" fill="none"/>`;const [x,y]=xy(...curve.labelAt);svg+=text(x,y,curve.label,curve.color);}
 for(const point of points){const [x,y]=xy(point.x,point.y);svg+=`<path d="M80 ${y}H${x}V340" stroke="#748296" stroke-dasharray="5 5" fill="none"/><circle cx="${x}" cy="${y}" r="5" fill="#26364a"/>${text(x+(point.dx??8),y+(point.dy??-10),point.label)}${text(x-10,368,point.x)}${text(40,y+6,point.y)}`;}
 notes.forEach((n,i)=>{svg+=text(80,395+i*22,n);});svg+='</g></svg>\n';writeFileSync(`${directory}/${file}.svg`,svg);
}
plot({file:'consumer-budget',title:'内点消费选择：预算与等效用曲线',xMax:55,yMax:110,
 curves:[{from:0,to:50,fn:x=>100-2*x,color:'#315679',label:'2x+y=100',labelAt:[2,50]},{from:12.5,to:50,fn:x=>1250/x,color:'#805330',label:'xy=1250',labelAt:[12,10]}],
 points:[{x:25,y:50,label:'最优 (25,50)'}],notes:['m=100，pₓ=2，pᵧ=1；效用 √(xy)，两线斜率均为 −2。']});
plot({file:'market-tax',title:'竞争市场从量税：价格楔与交易减少',xMax:60,yMax:120,
 curves:[{from:0,to:60,fn:q=>100-q,color:'#315679',label:'需求：P=100−Q',labelAt:[29,110]},{from:0,to:60,fn:q=>20+q,color:'#805330',label:'供给：P=20+Q',labelAt:[29,97]},{from:0,to:60,fn:q=>40+q,color:'#215734',label:'供给+税：P=40+Q',labelAt:[29,84]}],
 points:[{x:40,y:60,label:'税前 E',dx:24,dy:30},{x:30,y:70,label:'买方价 70',dx:-130,dy:-15},{x:30,y:50,label:'卖方价 50',dx:-160,dy:70}],areas:[{points:[[30,50],[30,70],[40,60]],color:'#f2d6b9'}],notes:['税额 t=20；Q 从 40 减至 30；三角形无谓损失为 100。']});
const evidence={courseId:'ECON-204',figures:[{file:'consumer-budget.svg',domain:{xMax:55,yMax:110},curves:[{equation:'y=100-2x',from:0,to:50},{equation:'y=1250/x',from:12.5,to:50}],points:[[25,50]],budget:{m:100,px:2,py:1},utility:'sqrt(x*y)'},{file:'market-tax.svg',domain:{xMax:60,yMax:120},curves:[{equation:'p=100-q'},{equation:'p=20+q'},{equation:'p=40+q'}],points:[[40,60],[30,70],[30,50]],tax:20,dwl:100,triangle:[[30,50],[30,70],[40,60]]}]};
writeFileSync('content/courses/ECON-204/figures.json',JSON.stringify(evidence,null,2)+'\n');
