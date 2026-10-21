export type PaperChartSpec={kind:'forest'|'scree'|'error'|'roc'|'pr'|'calibration';title:string;xLabel:string;yLabel:string;source:string;n:number;method:string;note:string;points:Array<{label:string;value:number;x?:number;low?:number|null;high?:number|null;secondary?:number}>;metadata?:unknown};
export type PaperChartOptions={title:string;xLabel:string;yLabel:string;note:string;width:number};
export const xml=(v:unknown)=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const wrap=(s:string,count:number)=>{const chars=Array.from(s);return Array.from({length:Math.max(1,Math.ceil(chars.length/count))},(_,i)=>chars.slice(i*count,(i+1)*count).join(''));};
const text=(x:number,y:number,s:string,size=16,anchor='start')=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${xml(s)}</text>`;
const multiline=(x:number,y:number,lines:string[],size=16,anchor='start')=>lines.map((s,i)=>text(x,y+i*(size+5),s,size,anchor)).join('');
const tick=(v:number)=>v!==0&&(Math.abs(v)<.001||Math.abs(v)>=100000)?v.toExponential(2):Number(v.toPrecision(4)).toString();
export function createPaperChartSvg(spec:PaperChartSpec,o:PaperChartOptions){
  if(![900,1200,1600].includes(o.width)||!o.title.trim()||o.title.length>160||o.xLabel.length>160||o.yLabel.length>160||o.note.length>600)throw new Error('请填写标题并控制标题/坐标轴在 160 字内、图注在 600 字内。');
  const curve=['roc','pr','calibration'].includes(spec.kind);
  if(!spec.points.length||spec.points.length>(curve?10001:12)||spec.points.some(p=>!Number.isFinite(p.value)||(curve&&(!Number.isFinite(p.x)||p.x!<0||p.x!>1||p.value<0||p.value>1))||(p.low!=null&&!Number.isFinite(p.low))||(p.high!=null&&!Number.isFinite(p.high))||(p.secondary!==undefined&&!Number.isFinite(p.secondary))))throw new Error('图形需要 1–12 个有限数值点。');
  const w=o.width,forest=spec.kind==='forest',left=forest?300:110,right=w-64,plotWidth=right-left,top=120,labels=spec.points.map(p=>wrap(p.label,18));
  const rowHeights=labels.map(lines=>Math.max(48,lines.length*21+14)),bodyHeight=forest?rowHeights.reduce((s,v)=>s+v,0):380,bottom=top+bodyHeight;
  const footer=wrap(`数据：${spec.source} · N=${spec.n} · ${spec.method}`,Math.floor((w-96)/9)).concat(wrap(o.note,Math.floor((w-96)/9))),h=bottom+105+footer.length*21;
  if(h>4096||w*h*4>32000000)throw new Error('标签或图注过长，图形超过导出尺寸预算。请在源文件中缩短列名，或缩短图注。');
  const titleLines=wrap(o.title,Math.floor((w-96)/19));if(titleLines.length>2)throw new Error('标题在当前尺寸下超过两行，请缩短标题或增大图宽。');
  let content=multiline(48,42,titleLines,24);
  if(forest){
    const values=spec.points.flatMap(p=>[p.value,...(p.low==null?[]:[p.low]),...(p.high==null?[]:[p.high])]);let min=Math.min(0,...values),max=Math.max(0,...values),range=max-min||1;min-=range*.08;max+=range*.08;range=max-min;
    const x=(v:number)=>left+(v-min)/range*plotWidth;
    for(let i=0;i<=4;i++){const v=min+i*range/4,px=x(v);content+=`<path d="M${px} ${top-12}V${bottom}" stroke="#d8dee8"/>`+text(px,bottom+27,tick(v),14,'middle');}
    content+=`<path d="M${x(0)} ${top-12}V${bottom}" stroke="#475569" stroke-dasharray="5 4"/>`;
    let offset=0;spec.points.forEach((p,i)=>{const cy=top+offset+rowHeights[i]/2;content+=multiline(left-20,cy-(labels[i].length-1)*10.5+5,labels[i],16,'end');if(p.low!=null&&p.high!=null)content+=`<path d="M${x(p.low)} ${cy}H${x(p.high)}M${x(p.low)} ${cy-5}V${cy+5}M${x(p.high)} ${cy-5}V${cy+5}" stroke="#315bce" stroke-width="2" fill="none"/>`;content+=`<circle cx="${x(p.value)}" cy="${cy}" r="5" fill="#315bce"><title>${xml(p.label)}: ${xml(p.value)}</title></circle>`;offset+=rowHeights[i];});
    content+=text((left+right)/2,bottom+65,o.xLabel,16,'middle');content+=text(48,top-23,o.yLabel,15);
  }else if(curve){
    const x=(v:number)=>left+v*plotWidth,y=(v:number)=>bottom-v*bodyHeight;
    for(let i=0;i<=5;i++){const v=i/5;content+=`<path d="M${x(v)} ${top}V${bottom}M${left} ${y(v)}H${right}" stroke="#d8dee8"/>`+text(x(v),bottom+27,tick(v),14,'middle')+text(left-12,y(v)+5,tick(v),14,'end');}
    if(spec.kind!=='pr')content+=`<path d="M${x(0)} ${y(0)}L${x(1)} ${y(1)}" stroke="#64748b" stroke-dasharray="5 4"/>`;
    let path='';spec.points.forEach((p,i)=>{path+=i===0?`M${x(p.x!)} ${y(p.value)}`:spec.kind==='pr'?`V${y(p.value)}H${x(p.x!)}`:`L${x(p.x!)} ${y(p.value)}`;});
    content+=`<path d="${path}" stroke="#315bce" stroke-width="2.5" fill="none"/>`;
    if(spec.kind==='calibration')spec.points.forEach(p=>{content+=`<circle cx="${x(p.x!)}" cy="${y(p.value)}" r="5" fill="#315bce"><title>${xml(p.label)}</title></circle>`;});
    content+=text((left+right)/2,bottom+65,o.xLabel,16,'middle')+text(left,top-27,o.yLabel,15);
  }else{
    const maximum=Math.max(...spec.points.flatMap(p=>[p.value,p.secondary??0]))*1.12||1,x=(i:number)=>left+(i+.5)/spec.points.length*plotWidth,y=(v:number)=>bottom-v/maximum*bodyHeight;
    for(let i=0;i<=4;i++){const v=maximum*i/4,py=y(v);content+=`<path d="M${left} ${py}H${right}" stroke="#d8dee8"/>`+text(left-12,py+5,tick(v),14,'end');}
    content+=`<path d="M${left} ${top}V${bottom}H${right}" stroke="#475569" fill="none"/>`;
    const series=(secondary=false)=>{const points=spec.points.map((p,i)=>`${x(i)},${y(secondary?p.secondary!:p.value)}`).join(' '),color=secondary?'#475569':'#315bce';let svg=`<polyline points="${points}" stroke="${color}" stroke-width="2.5" ${secondary?'stroke-dasharray="7 4"':''} fill="none"/>`;spec.points.forEach((p,i)=>{const py=y(secondary?p.secondary!:p.value);svg+=secondary?`<rect x="${x(i)-4}" y="${py-4}" width="8" height="8" fill="${color}"/>`:`<circle cx="${x(i)}" cy="${py}" r="5" fill="${color}"/>`;});return svg;};
    content+=series();if(spec.kind==='error'&&spec.points.every(p=>p.secondary!==undefined)){content+=series(true);content+=`<path d="M${right-225} ${top-32}h24" stroke="#315bce" stroke-width="2"/><circle cx="${right-213}" cy="${top-32}" r="4" fill="#315bce"/>`+text(right-194,top-27,'RMSE',14)+`<path d="M${right-128} ${top-32}h24" stroke="#475569" stroke-width="2" stroke-dasharray="5 3"/><rect x="${right-120}" y="${top-36}" width="8" height="8" fill="#475569"/>`+text(right-96,top-27,'MAE',14);}
    spec.points.forEach((p,i)=>{content+=text(x(i),bottom+27,p.label,14,'middle');});content+=text((left+right)/2,bottom+65,o.xLabel,16,'middle');content+=text(left,top-27,o.yLabel,15);
  }
  content+=multiline(48,bottom+105,footer,14);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">${xml(o.title)}</title><desc id="chart-desc">${xml(`${spec.method}；数据 ${spec.source}；N=${spec.n}；${o.note}`)}</desc><metadata>${xml(JSON.stringify({format:'acaora-paper-chart-v1',source:spec.source,n:spec.n,method:spec.method,points:spec.points,options:o,analysis:spec.metadata}))}</metadata><rect width="${w}" height="${h}" fill="white"/><g fill="#1f2937" font-family="Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif">${content}</g></svg>`;
}
