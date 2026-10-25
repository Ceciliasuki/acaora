'use client';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Button} from '../components/ui';
import {isMissing,numericColumns,formatNumber,type DataSet} from '../stats';
import {statisticsCsv} from './data-exploration';
import {downloadRegressionFile} from './regression-recipe-tools';
import ResultTools,{type AnalysisResult} from './result-tools';
import {ADVANCED_ENGINE,advancedMethods,requiredColumns,usesGroup,type AdvancedConfig,type AdvancedMethod,type AdvancedResult,type Cell} from './advanced-config';
import type {AdvancedCheck} from './advanced-check';
import AdvancedRecipeTools from './advanced-recipe-tools';
import CategoricalControls from './categorical-controls';
import PaperChart from './paper-chart';
import {advancedPaperCharts} from './paper-charts';
import {useResearchContext,validationLeakage} from './research-context';
import {categoryLevels} from './categorical-design';
import styles from './multiple-regression.module.css';

const display=(v:Cell)=>v===null?'—':typeof v==='number'?(v!==0&&(Math.abs(v)<1e-6||Math.abs(v)>=1e9)?v.toExponential(5):formatNumber(v,Number.isInteger(v)?0:6)):v;
function ScrollRegion({label,children}:{label:string;children:ReactNode}){
  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Focus allows keyboard scrolling of wide result tables.
  return <div className={styles.scroll} role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
export default function AdvancedPanel({data,isSample}:{data:DataSet;isSample:boolean}){
  const [method,setMethod]=useState<AdvancedMethod>('logistic');
  const [loaded,setLoaded]=useState<{config:AdvancedConfig;revision:number}|null>(null);
  return <div className={styles.workbench}><div className={styles.controls}><label className={styles.control}>进阶方法<select value={method} onChange={e=>{setLoaded(null);setMethod(e.target.value as AdvancedMethod);}}>{[...new Set(advancedMethods.map(m=>m.group))].map(group=><optgroup key={group} label={group}>{advancedMethods.filter(m=>m.group===group).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>)}</select></label></div><details className={styles.recipe}><summary>如何选择方法</summary><ul><li>0/1 结果的关联分析：Logistic；连续结果有主体内相关：聚类稳健回归；控制主体不变特征：个体固定效应。</li><li>同一对象前后两次测量：配对 t 或 Wilcoxon；多个独立组均值比较：ANOVA，方差不齐时考虑 Welch ANOVA。</li><li>压缩多个相关指标：PCA；探索相似样本分组：K-means。两者都不自动识别因果关系。</li><li>评估预测：独立样本用随机分折，同一主体重复记录用主体分组，未来预测用时间前向；主体与时间同时相关时需更专门的划分。</li></ul><p className={styles.help}>按研究问题和数据结构预先选方法；不要按哪个方法的 p 更小来挑结果。</p></details><MethodPanel key={`${method}-${loaded?.revision??0}`} initial={loaded?.config} data={data} isSample={isSample} method={method} onApply={c=>{setLoaded(l=>({config:c,revision:(l?.revision??0)+1}));setMethod(c.method);}}/></div>;
}
function MethodPanel({data,isSample,method,initial,onApply}:{data:DataSet;isSample:boolean;method:AdvancedMethod;initial?:AdvancedConfig;onApply:(c:AdvancedConfig)=>void}){
  const research=useResearchContext();
  const predicting=method==='cv'||method==='classification';
  const numeric=useMemo(()=>numericColumns(data),[data]),definition=advancedMethods.find(m=>m.id===method)!;
  const paired=['paired','wilcoxon'].includes(method),unsupervised=['pca','kmeans'].includes(method),multi=['cluster','fixed','logistic','pca','kmeans','cv','classification'].includes(method);
  const [config,setConfig]=useState<AdvancedConfig>(()=>{
    if(initial)return structuredClone(initial);
    const binary=numeric.find(h=>{const i=data.headers.indexOf(h),values=data.rows.map(r=>r[i]??'').filter(v=>!isMissing(v));return values.length>0&&values.every(v=>Number(v)===0||Number(v)===1)&&new Set(values.map(Number)).size===2;});
    const outcome=['logistic','classification'].includes(method)?(binary??numeric.at(-1)??''):numeric.at(-1)??'';
    const group=data.headers.find(h=>!numeric.includes(h))??data.headers.find(h=>h!==outcome)??'';
    const grouped=['cluster','fixed','anova','welchanova','posthoc','mannwhitney'].includes(method);
    return {method,outcome,group,second:numeric.find(h=>h!==outcome)??'',predictors:numeric.filter(h=>(unsupervised||h!==outcome)&&(!grouped||h!==group)).slice(0,2),components:2,clusters:3,folds:5,seed:42,validation:'random',time:numeric.find(h=>/time|year|时间|年份|日期/i.test(h))??''};
  });
  const [fit,setFit]=useState<AdvancedResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState('');
  const [check,setCheck]=useState<AdvancedCheck|null>(null),[task,setTask]=useState<'check'|'run'>('run');
  const worker=useRef<Worker|null>(null),mounted=useRef(true),lock=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;worker.current?.terminate();worker.current=null;};},[]);
  const columns=requiredColumns(config),leakage=predicting&&validationLeakage(research,columns),invalid=leakage||columns.some(h=>!h||!data.headers.includes(h))||new Set(columns).size!==columns.length||(multi&&!config.predictors.length&&!(config.categoricals?.length))||(method==='pca'&&(config.predictors.length<2||config.components>config.predictors.length));
  const grouped=usesGroup(config),checkStale=check&&JSON.stringify(check.config)!==JSON.stringify(config);
  const change=<K extends keyof AdvancedConfig>(key:K,value:AdvancedConfig[K])=>setConfig(c=>({...c,[key]:value}));
  function cancel(){worker.current?.terminate();worker.current=null;lock.current=false;setBusy(false);}
  function run(action:'check'|'run'='run'){
    if(lock.current||invalid)return;lock.current=true;setBusy(true);setTask(action);setError('');
    try{
      const job=new Worker(new URL('./advanced-analysis.worker.ts',import.meta.url),{type:'module'});worker.current=job;
      const finish=()=>{job.terminate();worker.current=null;lock.current=false;setBusy(false);};
      job.onmessage=(event:MessageEvent<{result?:AdvancedResult;check?:AdvancedCheck;error?:string}>)=>{if(!mounted.current||worker.current!==job)return;if(event.data.result)setFit(event.data.result);else if(event.data.check)setCheck(event.data.check);else setError(event.data.error??'没有返回计算结果。');finish();};
      job.onerror=()=>{if(!mounted.current||worker.current!==job)return;setError('计算 Worker 无法运行，请刷新或更换支持 Worker 的浏览器。');finish();};
      const indices=columns.map(h=>data.headers.indexOf(h));job.postMessage({task:action,data:{name:data.name,headers:columns,rows:data.rows.map(r=>indices.map(i=>r[i]??''))},config});
    }catch(cause){cancel();setError(cause instanceof Error?cause.message:'无法开始计算。');}
  }
  const result:AnalysisResult|null=fit?{source:fit.source,sample:isSample,method:definition.name,context:fit.context,metrics:[['有效 N',String(fit.n)],['排除观测',String(fit.excluded)],...fit.metrics.map(([k,v])=>[k,String(display(v))] as const)]}:null;
  const stale=fit&&JSON.stringify(fit.config)!==JSON.stringify(config);
  const charts=useMemo(()=>fit?advancedPaperCharts(fit):[],[fit]);
  function downloadSettings(){if(!fit)return;downloadRegressionFile(JSON.stringify({format:'acaora-analysis-record',engine:ADVANCED_ENGINE,source:fit.source,sample:isSample,config:fit.config,n:fit.n,excluded:fit.excluded,context:fit.context,metrics:fit.metrics,warnings:fit.warnings,createdAt:new Date().toISOString()},null,2),'acaora-analysis-record.json');}
  return <div className={styles.analysisLayout}><section className={styles.setup} aria-label="进阶分析设置"><h3>分析设置</h3>
    <p className={styles.intro}>{definition.note}</p>
    <fieldset className={styles.settings} disabled={busy}><legend className="sr-only">{definition.name}设置</legend><div className={styles.controls}>
      {!unsupervised&&<label className={styles.control}>{paired?'第一列':'因变量'}<select aria-label={paired?'第一列':'进阶因变量'} value={config.outcome} onChange={e=>{const outcome=e.target.value;setConfig(c=>({...c,outcome,second:c.second===outcome?(numeric.find(h=>h!==outcome)??''):c.second,group:c.group===outcome?(data.headers.find(h=>h!==outcome)??''):c.group,time:c.time===outcome?'':c.time,predictors:c.predictors.filter(h=>h!==outcome),categoricals:(c.categoricals??[]).filter(v=>v.name!==outcome)}));}}>{numeric.map(h=><option key={h}>{h}</option>)}</select></label>}
      {paired&&<label className={styles.control}>第二列<select value={config.second} onChange={e=>change('second',e.target.value)}>{numeric.filter(h=>h!==config.outcome).map(h=><option key={h}>{h}</option>)}</select></label>}
      {predicting&&<label className={styles.control}>验证划分<select value={config.validation??'random'} onChange={e=>{const validation=e.target.value as AdvancedConfig['validation'];setConfig(c=>({...c,validation,predictors:c.predictors.filter(h=>(validation!=='group'||h!==c.group)&&(validation!=='time'||h!==c.time)),categoricals:(c.categoricals??[]).filter(v=>(validation!=='group'||v.name!==c.group)&&(validation!=='time'||v.name!==c.time))}));}}><option value="random">随机 K 折 · 独立样本</option><option value="group">主体分组 K 折 · 重复记录</option><option value="time">时间前向 · 预测未来</option></select></label>}
      {grouped&&<label className={styles.control}>{method==='fixed'||method==='cluster'||predicting?'主体 / 聚类字段':'分组字段'}<select aria-label="分组字段" value={config.group} onChange={e=>{const group=e.target.value;setConfig(c=>({...c,group,predictors:c.predictors.filter(h=>h!==group),categoricals:(c.categoricals??[]).filter(v=>v.name!==group)}));}}>{data.headers.filter(h=>h!==config.outcome).map(h=><option key={h}>{h}</option>)}</select></label>}
      {predicting&&config.validation==='time'&&<label className={styles.control}>时间字段（数值年份 / 时间戳）<select aria-label="验证时间字段" value={config.time??''} onChange={e=>{const time=e.target.value;setConfig(c=>({...c,time,predictors:c.predictors.filter(h=>h!==time),categoricals:(c.categoricals??[]).filter(v=>v.name!==time)}));}}><option value="">请选择数值时间列</option>{numeric.filter(h=>h!==config.outcome).map(h=><option key={h}>{h}</option>)}</select></label>}
      {method==='pca'&&<label className={styles.control}>保留主成分数<input type="number" min={1} max={config.predictors.length||12} value={config.components} onChange={e=>change('components',Number(e.target.value))}/></label>}
      {method==='kmeans'&&<label className={styles.control}>聚类数 K<input type="number" min={2} max={12} value={config.clusters} onChange={e=>change('clusters',Number(e.target.value))}/></label>}
      {method==='classification'&&<label className={styles.control}>分类阈值（预先指定）<input type="number" min={0} max={1} step={.01} value={config.threshold??.5} onChange={e=>change('threshold',Number(e.target.value))}/></label>}
      {predicting&&<label className={styles.control}>交叉验证折数<input type="number" min={2} max={10} value={config.folds} onChange={e=>change('folds',Number(e.target.value))}/></label>}
      {((predicting&&config.validation!=='time')||method==='kmeans')&&<label className={styles.control}>随机种子<input type="number" min={0} max={4294967295} step={1} value={config.seed} onChange={e=>change('seed',Number(e.target.value))}/></label>}
    </div>
    {method==='bootstrap'&&<div className={styles.controls}><label className={styles.control}>重抽样统计量<select value={config.bootstrapStatistic??'mean'} onChange={e=>change('bootstrapStatistic',e.target.value as AdvancedConfig['bootstrapStatistic'])}><option value="mean">均值</option><option value="paired-difference">配对均值差（第一列 − 第二列）</option><option value="difference">两组均值差（组名排序第一 − 第二）</option><option value="correlation">Pearson 相关</option></select></label>{['paired-difference','correlation'].includes(config.bootstrapStatistic??'mean')&&<label className={styles.control}>Bootstrap 第二列<select value={config.second} onChange={e=>change('second',e.target.value)}>{numeric.filter(h=>h!==config.outcome).map(h=><option key={h}>{h}</option>)}</select></label>}<label className={styles.control}>重抽样单位<select value={config.bootstrapUnit??'row'} onChange={e=>change('bootstrapUnit',e.target.value as 'row'|'cluster')}><option value="row">独立行（两组差时在组内抽样）</option><option value="cluster">完整主体</option></select></label>{config.bootstrapUnit==='cluster'&&<label className={styles.control}>Bootstrap 主体字段<select value={config.bootstrapCluster??''} onChange={e=>change('bootstrapCluster',e.target.value)}><option value="">请选择主体字段</option>{data.headers.filter(h=>h!==config.outcome&&(!['paired-difference','correlation'].includes(config.bootstrapStatistic??'mean')||h!==config.second)&&(config.bootstrapStatistic!=='difference'||h!==config.group)).map(h=><option key={h}>{h}</option>)}</select></label>}<label className={styles.control}>重抽样次数<input type="number" min={100} max={2000} value={config.bootstrapIterations??500} onChange={e=>change('bootstrapIterations',Number(e.target.value))}/></label><label className={styles.control}>Bootstrap 随机种子<input type="number" min={0} max={4294967295} value={config.seed} onChange={e=>change('seed',Number(e.target.value))}/></label></div>}
    {multi&&<fieldset className={styles.predictors}><legend>{unsupervised?'分析变量':'解释变量'} · 已选 {config.predictors.length} / 12</legend><label className={styles.control}>查找变量<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="输入变量名称"/></label><div className={styles.choices}>{numeric.filter(h=>(unsupervised||h!==config.outcome)&&!(config.categoricals??[]).some(v=>v.name===h)&&(!grouped||h!==config.group)&&(!(predicting&&config.validation==='time')||h!==config.time)&&h.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(h=><label key={h} className={styles.check}><input type="checkbox" checked={config.predictors.includes(h)} disabled={!config.predictors.includes(h)&&config.predictors.length>=12} onChange={e=>change('predictors',e.target.checked?[...config.predictors,h]:config.predictors.filter(v=>v!==h))}/>{h}</label>)}</div><p className={styles.help}>已选：{config.predictors.join('、')||'尚未选择'}。{unsupervised?'仅使用数值列。':'分类字段请在下方显式选择并指定参考组。'}</p></fieldset>}
    {['cluster','fixed','logistic','cv','classification'].includes(method)&&<CategoricalControls data={data} value={config.categoricals??[]} exclude={[config.outcome,...config.predictors,...(grouped?[config.group]:[]),...(predicting&&config.validation==='time'?[config.time??'']:[])]} disabled={busy} onChange={categoricals=>setConfig(c=>({...c,categoricals}))}/>}
    {method==='posthoc'&&<div className={styles.controls}><label className={styles.control}>比较范围<select value={config.posthocFamily??'all'} onChange={e=>setConfig(c=>({...c,posthocFamily:e.target.value as 'all'|'reference',posthocReference:c.posthocReference||categoryLevels(data,c.group)[0]||''}))}><option value="all">所有组间比较 · 一个比较族</option><option value="reference">各组对参考组 · 一个比较族</option></select></label>{config.posthocFamily==='reference'&&<label className={styles.control}>比较参考组<select value={config.posthocReference??''} onChange={e=>change('posthocReference',e.target.value)}><option value="">请选择参考组</option>{categoryLevels(data,config.group).map(g=><option key={g}>{g}</option>)}</select></label>}</div>}
    </fieldset>
    <p className={styles.help}>仅对本方法所需字段整行排除缺失或非数值记录，不改写原数据。{['kmeans','classification'].includes(method)?'最多 10,000':method==='bootstrap'?'最多 20,000':'最多 50,000'} 个完整观测；超限将无法计算，不自动抽样。</p>
    {leakage&&<p role="alert">当前所选数据受全样本拟合的填补、标准化或筛选影响。请在数据处理工作台撤销相关步骤后再验证，防止训练与验证信息泄漏。</p>}
    {invalid&&!leakage&&<p role="status">请核对变量：各字段不能重复；PCA 至少选两列，保留主成分数不能超过所选列数。</p>}
    <div className={styles.actions}><Button variant="secondary" disabled={invalid||busy} onClick={()=>run('check')}>{busy&&task==='check'?'正在检查…':'检查数据与设定'}</Button><Button disabled={invalid||busy} onClick={()=>run()}>{busy&&task==='run'?'正在计算…':'运行分析'}</Button>{busy&&<Button variant="secondary" onClick={cancel}>取消计算</Button>}</div>
    {busy&&<p role="status">正在当前设备计算，切换方法或数据将取消本次计算。</p>}{error&&<p role="alert">{error}</p>}
    {check&&<section className={styles.checkResult} aria-label="分析可行性检查"><h3>数据与设定检查</h3><p className={styles.help}>{check.scope}</p>{checkStale&&<p role="status">设置已修改，下面是上次检查，请重新检查。</p>}<p>完整观测 {check.complete??'—'} / {check.total}，排除 {check.excluded??'—'}。{check.errors.length?'存在需处理的问题。':'已完成基础数据检查；是否适合研究问题仍需判断。'}</p>{check.facts.length>0&&<dl className={styles.metrics}>{check.facts.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}{check.errors.length>0&&<ul role="alert">{check.errors.map(e=><li key={e}>{e}</li>)}</ul>}{check.warnings.length>0&&<ul className={styles.help}>{check.warnings.map(w=><li key={w}>{w}</li>)}</ul>}<ScrollRegion label="字段排除原因，可横向滚动"><table><caption>同一行可在多列出现问题，列计数不能直接相加为排除行数。</caption><thead><tr><th scope="col">字段</th><th scope="col">缺失记录</th><th scope="col">非数值记录</th></tr></thead><tbody>{check.columns.map(r=><tr key={r.name}><th scope="row">{r.name}</th><td>{r.missing}</td><td>{r.invalid}</td></tr>)}</tbody></table></ScrollRegion></section>}
    <AdvancedRecipeTools data={data} config={config} busy={busy} onApply={onApply}/>
    </section>
    {!fit&&<div className={styles.pendingResult}><h3>{definition.name}结果</h3><p>选择研究变量后，检查设定并运行分析。</p><p className={styles.help}>摘要、结果表与导出工具会集中显示在这里。</p></div>}
    {fit&&<section className={styles.result} aria-label="进阶分析结果"><h3>{definition.name}结果</h3><p className={styles.help}>{fit.source}{isSample?' · 示例数据':''}；{fit.context}</p>{stale&&<p role="status">设置已修改，下方仍是上次计算结果。请重新运行以更新。</p>}
      <dl className={styles.metrics}><div><dt>完整 / 排除观测</dt><dd>{fit.n} / {fit.excluded}</dd></div>{fit.metrics.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{display(v)}</dd></div>)}</dl>
      {fit.warnings.length>0&&<ul className={styles.warnings} aria-label="方法提示">{fit.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
      <ResultTools result={result} analysis={{kind:'advanced',config:fit.config,tables:fit.tables.filter(t=>!t.observationLevel),charts}}/><div className={styles.actions}><Button variant="secondary" size="sm" onClick={downloadSettings}>导出分析记录 JSON</Button><Button variant="ghost" size="sm" onClick={()=>downloadRegressionFile(statisticsCsv([['数据源','方法','有效 N','排除观测','分析条件','指标','值'],...fit.metrics.map(([k,v])=>[fit.source,definition.name,fit.n,fit.excluded,fit.context,k,v])]),'acaora-analysis-summary.csv')}>导出摘要 CSV</Button></div><p className={styles.help}>记录包含设置与计算口径，不含原始数据行；分析记录用于审阅，再次载入设置请使用上方的进阶方案。CSV 保留原始数值精度，页面显示最多六位小数，极小 p 请查看 CSV。</p>
      {charts.map(chart=><PaperChart key={JSON.stringify(chart)} spec={chart}/>)}
      {fit.tables.map((t,index)=><section key={t.title} className={styles.diagnostics}><div className={styles.tableHeading}><h4>{t.title}</h4><Button variant="ghost" size="sm" onClick={()=>downloadRegressionFile(statisticsCsv([['数据源','方法','分析条件',...t.headers],...t.rows.map(r=>[fit.source,definition.name,fit.context,...r])]),`acaora-${fit.method}-${index+1}.csv`)}>导出{t.title} CSV</Button></div><ScrollRegion label={`${t.title}，可横向滚动`}><table><caption>{t.rows.length>50?`显示前 50 / ${t.rows.length} 行；CSV 导出全部行。`:`共 ${t.rows.length} 行。`}{t.observationLevel?'行号不含表头。':''}</caption><thead><tr>{t.headers.map((h,i)=><th key={i} scope="col">{h}</th>)}</tr></thead><tbody>{t.rows.slice(0,50).map((r,i)=><tr key={i}>{r.map((v,j)=>j===0?<th key={j} scope="row">{display(v)}</th>:<td key={j}>{display(v)}</td>)}</tr>)}</tbody></table></ScrollRegion></section>)}
    </section>}
  </div>;
}
