'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '../components/ui';
import {createPaperChartSvg,type PaperChartOptions,type PaperChartSpec} from './paper-chart-svg';
import styles from './multiple-regression.module.css';
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function PaperChart({spec}:{spec:PaperChartSpec}){
  const [options,setOptions]=useState<PaperChartOptions>({title:spec.title,xLabel:spec.xLabel,yLabel:spec.yLabel,note:spec.note,width:1200}),[busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const generated=useMemo(()=>{try{return {svg:createPaperChartSvg(spec,options),error:''};}catch(cause){return {svg:'',error:cause instanceof Error?cause.message:'无法绘制图形。'};}},[spec,options]);
  async function png(){
    if(lock.current||!generated.svg)return;lock.current=true;setBusy(true);setError('');const url=URL.createObjectURL(new Blob([generated.svg],{type:'image/svg+xml;charset=utf-8'}));
    try{await document.fonts.ready;const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('浏览器无法绘制此 SVG，请先导出 SVG。'));img.src=url;});const canvas=document.createElement('canvas');canvas.width=img.naturalWidth*2;canvas.height=img.naturalHeight*2;const context=canvas.getContext('2d');if(!context)throw new Error('浏览器不支持 Canvas，请导出 SVG。');context.drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 导出失败，请缩小图宽或导出 SVG。')),'image/png'));if(mounted.current)download(blob,`acaora-${spec.kind}.png`);}
    catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'PNG 导出失败。');}finally{URL.revokeObjectURL(url);lock.current=false;if(mounted.current)setBusy(false);}
  }
  return <section className={styles.diagnostics} aria-label="论文图表"><h3>论文图表</h3><details className={styles.recipe}><summary>编辑图表标题、坐标轴与图注</summary><div className={styles.controls}>{([['title','图表标题'],['xLabel','横轴名称 / 单位'],['yLabel','纵轴名称 / 单位'],['note','图注']] as const).map(([key,label])=><label className={styles.control} key={key}>{label}<input value={options[key]} maxLength={key==='note'?600:160} disabled={busy} onChange={e=>setOptions(o=>({...o,[key]:e.target.value}))}/></label>)}<label className={styles.control}>图宽<select value={options.width} disabled={busy} onChange={e=>setOptions(o=>({...o,width:Number(e.target.value)}))}><option value="900">900 px</option><option value="1200">1200 px</option><option value="1600">1600 px</option></select></label></div></details>
    <div className={styles.actions}><Button variant="secondary" size="sm" disabled={!generated.svg||busy} onClick={()=>download(new Blob([generated.svg],{type:'image/svg+xml;charset=utf-8'}),`acaora-${spec.kind}.svg`)}>导出 SVG</Button><Button variant="ghost" size="sm" disabled={!generated.svg||busy} onClick={()=>void png()}>{busy?'正在生成 PNG…':'导出 PNG（2×）'}</Button></div>
    {(generated.error||error)&&<p role="alert">{generated.error||error}</p>}{generated.svg&&<figure className={styles.paperFigure}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard focus permits scrolling the full chart on narrow screens. */}
      <div className={styles.paperPreview} role="region" aria-label="图表预览，可横向滚动" tabIndex={0}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Locally generated, self-contained SVG must also be the exact exported image. */}
      <img style={{minWidth:Math.min(options.width,900)}} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(generated.svg)}`} alt={options.title}/></div><figcaption className={styles.help}>图形可横向滚动，导出保留所选尺寸。图中保留来源与 N；SVG 可在矢量编辑器中继续修改，PNG 按所选尺寸的 2 倍生成。完整数值以结果 CSV 为准；字体随打开设备的可用字体显示。</figcaption></figure>}
  </section>;
}
