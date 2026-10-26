'use client';
import {useId,useState,type MouseEvent,type KeyboardEvent,type CSSProperties} from 'react';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {sampleData,regression,formatNumber,isMissing} from '../stats';
import styles from '../home-details.module.css';
import HomeSectionTitle from './home-section-title';

export default function HomeAnalysisPreview() {
  const [variable,setVariable]=useState('睡眠时长');
  const [activeId,setActiveId]=useState<string|null>(null);
  const [pinned,setPinned]=useState(false);
  const [showFit,setShowFit]=useState(true);
  const chartId=useId(),helpId=useId(),clipId=useId(),outcome='统计学成绩';
  const model=regression(sampleData,variable,outcome);
  if(!model)return null;
  const xIndex=sampleData.headers.indexOf(variable),yIndex=sampleData.headers.indexOf(outcome);
  // Stable record keys preserve identity when changing variables and excluding missing pairs.
  const points=sampleData.rows.filter(row=>!isMissing(row[xIndex])&&!isMissing(row[yIndex]))
    .map(row=>({id:row[0],x:Number(row[xIndex]),y:Number(row[yIndex])}))
    .filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y));
  const xs=points.map(point=>point.x),ys=points.map(point=>point.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const x=(value:number)=>28+(value-minX)/(maxX-minX)*444;
  const y=(value:number)=>246-(value-minY)/(maxY-minY)*220;
  const active=points.find(point=>point.id===activeId);
  const nearest=(event:MouseEvent<HTMLButtonElement>)=>{
    const bounds=event.currentTarget.getBoundingClientRect();
    const px=(event.clientX-bounds.left)/bounds.width*500,py=(event.clientY-bounds.top)/bounds.height*280;
    let closest:typeof points[number]|undefined,distance=Infinity;
    points.forEach(point=>{
      const d=Math.hypot((x(point.x)-px)*bounds.width/500,(y(point.y)-py)*bounds.height/280);
      if(d<distance){distance=d;closest=point;}
    });
    return distance<=32?closest:undefined;
  };
  const clear=()=>{setActiveId(null);setPinned(false);};
  const onKeyDown=(event:KeyboardEvent<HTMLButtonElement>)=>{
    if(event.key==='Escape'){event.preventDefault();clear();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();
    const index=points.findIndex(point=>point.id===activeId);
    const next=event.key==='Home'?0:event.key==='End'?points.length-1:
      index<0?0:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+points.length)%points.length;
    setActiveId(points[next].id);setPinned(false);
  };
  return <section className={styles.section} aria-labelledby="home-analysis-title">
    <header className={styles.intro}><HomeSectionTitle id="home-analysis-title">变量之间</HomeSectionTitle></header>
    <div className={styles.analysis}>
      <header className={styles.toolbar}><span>{sampleData.name} · 示例数据</span><div className={styles.variableSwitch} role="group" aria-label="X 变量">{['睡眠时长','手机使用'].map(name=><button type="button" key={name} aria-pressed={variable===name} onClick={()=>{setVariable(name);clear();}}>{name}</button>)}</div></header>
      <figure className={styles.figure}>
        <div className={styles.chartHeading}><h3>{variable}与{outcome}</h3><button className={styles.fitToggle} type="button" aria-pressed={showFit} onClick={()=>setShowFit(!showFit)}><span aria-hidden="true"/>拟合线</button></div>
        <div className={styles.plot} data-active={Boolean(active)}><div className={styles.yRange} aria-hidden="true"><span>{maxY}</span><span>{minY}</span></div><span className={styles.yLabel}>成绩（分）</span>
          <div className={styles.chartCanvas}>
          <svg viewBox="0 0 500 280" role="img" aria-labelledby={chartId}>
            <title id={chartId}>{`${variable}与${outcome}散点图，共 ${model.n} 对完整观测`}</title>
            <defs><clipPath id={clipId}><rect x="28" y="26" width="444" height="220"/></clipPath></defs>
            {[0,.25,.5,.75,1].map(t=><g key={t} className={styles.grid}><line x1="28" y1={26+t*220} x2="472" y2={26+t*220}/>{t>0&&t<1&&<line className={styles.verticalGrid} x1={28+t*444} y1="26" x2={28+t*444} y2="246"/>}</g>)}
            <g clipPath={`url(#${clipId})`} className={styles.fit} data-visible={showFit} aria-hidden="true"><path key={variable} pathLength="1" d={`M 28 ${y(model.intercept+model.slope*minX)} L 472 ${y(model.intercept+model.slope*maxX)}`}/></g>
            {active&&<g className={styles.crosshair} aria-hidden="true"><line x1={x(active.x)} y1="26" x2={x(active.x)} y2="246"/><line x1="28" y1={y(active.y)} x2="472" y2={y(active.y)}/></g>}
            {points.map(point=><g key={point.id} className={styles.pointPosition} data-point-id={point.id} data-selected={activeId===point.id} style={{transform:`translate(${x(point.x)}px, ${y(point.y)}px)`}}><circle r="4.5" className={styles.point}/>{activeId===point.id&&<ellipse rx="9" ry="9" className={styles.pointRing}/>}</g>)}
          </svg>
          <button type="button" className={styles.plotControl} aria-label="探索散点" aria-describedby={helpId} aria-pressed={pinned} onPointerMove={event=>{if(!pinned&&event.pointerType!=='touch')setActiveId(nearest(event)?.id??null);}} onPointerLeave={()=>{if(!pinned)setActiveId(null);}} onClick={event=>{
            if(event.detail===0){if(active){setPinned(!pinned);}else{setActiveId(points[0].id);setPinned(true);}return;}
            const point=nearest(event);
            if(!point||(pinned&&point.id===activeId)){clear();return;}
            setActiveId(point.id);setPinned(true);
          }} onKeyDown={onKeyDown} onBlur={()=>{if(!pinned)setActiveId(null);}}/>
          {active&&<div className={styles.pointTooltip} role="status" style={{'--point-x':`${x(active.x)/5}%`,'--point-y':`${y(active.y)/2.8}%`,'--tip-offset':x(active.x)>250?'-100%':'0%'} as CSSProperties}><strong>{active.id}<small>{pinned?'已固定':'观测值'}</small></strong><span>{variable}<b>{formatNumber(active.x,1)} 小时</b></span><span>统计学成绩<b>{active.y} 分</b></span></div>}
          </div>
        </div>
        <div className={styles.xRange}><span>{formatNumber(minX,1)}</span><span>{variable}（小时）</span><span>{formatNumber(maxX,1)}</span></div>
        <figcaption className={styles.chartCaption}><span>悬停查看 · 点击固定</span><button type="button" onClick={clear} disabled={!pinned}>取消固定</button></figcaption>
        <span id={helpId} className={styles.srOnly}>方向键切换记录，回车固定，Esc 清除。每点一条记录，缺失配对不计入。</span>
      </figure>
      <dl className={styles.metrics} aria-live="polite" aria-atomic="true"><div><dt>有效配对</dt><dd>{model.n}</dd></div><div><dt>相关系数 r</dt><dd key={variable} className={styles.metricChange}>{formatNumber(model.r,3)}</dd></div><div><dt>因缺失排除</dt><dd>{sampleData.rows.length-model.n}</dd></div></dl>
      <p className={styles.note}>相关不代表因果。</p>
    </div>
    <div className={styles.sectionAction}><Link href="/data">打开数据分析<ArrowUpRight size={16} aria-hidden="true"/></Link></div>
  </section>;
}
