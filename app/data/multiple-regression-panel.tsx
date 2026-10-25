'use client';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Button} from '../components/ui';
import {formatNumber,formatP,numericColumns,type DataSet} from '../stats';
import ResultTools,{type AnalysisResult} from './result-tools';
import {statisticsCsv} from './data-exploration';
import {MAX_PREDICTORS,regressionConfigErrors,type RegressionConfig} from './regression-config';
import type {RegressionFit} from './multiple-regression';
import RegressionRecipeTools,{downloadRegressionFile} from './regression-recipe-tools';
import CategoricalControls from './categorical-controls';
import PaperChart from './paper-chart';
import {regressionPaperChart} from './paper-charts';
import {encodingDescription} from './categorical-design';
import styles from './multiple-regression.module.css';

function ScrollRegion({label,children}:{label:string;children:ReactNode}){
  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need focus to scroll a labelled wide table.
  return <div className={styles.scroll} role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
const number=(value:number|null,digits=3)=>value===null?'—':formatNumber(value,digits);
const seName=(config:RegressionConfig)=>config.standardErrors==='HC3'?'HC3 稳健':'常规';
export default function MultipleRegressionPanel({data,isSample}:{data:DataSet;isSample:boolean}){
  const numeric=useMemo(()=>numericColumns(data),[data]);
  const [config,setConfig]=useState<RegressionConfig>(()=>{const outcome=numeric.includes('统计学成绩')?'统计学成绩':numeric.at(-1)??'';return {outcome,predictors:numeric.filter(name=>name!==outcome).slice(0,2),standardErrors:'HC3'};});
  const [query,setQuery]=useState('');
  const [fit,setFit]=useState<RegressionFit|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const worker=useRef<Worker|null>(null),mounted=useRef(true),lock=useRef(false);
  const chart=useMemo(()=>fit?regressionPaperChart(fit):null,[fit]);
  const errors=regressionConfigErrors(data,config);
  const stale=fit&&JSON.stringify(fit.config)!==JSON.stringify(config);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;worker.current?.terminate();worker.current=null;};},[]);
  function cancel(){worker.current?.terminate();worker.current=null;lock.current=false;setBusy(false);}
  function run(){
    if(lock.current||errors.length)return;lock.current=true;setBusy(true);setError('');
    try{
      const job=new Worker(new URL('./multiple-regression.worker.ts',import.meta.url),{type:'module'});worker.current=job;
      const finish=()=>{job.terminate();worker.current=null;lock.current=false;setBusy(false);};
      job.onmessage=(event:MessageEvent<{result?:RegressionFit;error?:string}>)=>{
        if(!mounted.current||worker.current!==job)return;
        if(event.data.result)setFit(event.data.result);else setError(event.data.error??'模型没有返回有效结果。');finish();
      };
      job.onerror=()=>{if(!mounted.current||worker.current!==job)return;setError('计算 Worker 无法运行，请刷新或使用支持 Worker 的浏览器。');finish();};
      const headers=[config.outcome,...config.predictors,...(config.categoricals??[]).map(c=>c.name)],indices=headers.map(header=>data.headers.indexOf(header));
      job.postMessage({data:{name:data.name,headers,rows:data.rows.map(row=>indices.map(index=>row[index]??''))},config});
    }catch(cause){cancel();setError(cause instanceof Error?cause.message:'无法开始拟合。');}
  }
  const result:AnalysisResult|null=fit?{source:fit.source,sample:isSample,method:'含截距的多元线性回归（OLS）',context:`因变量：${fit.config.outcome}；解释变量：${[fit.config.predictors.join('、'),encodingDescription(fit.config.categoricals)].filter(Boolean).join('、')}；${seName(fit.config)}标准误；95% 区间；t 参考自由度 ${fit.dfResidual}`,metrics:[['有效 N',String(fit.n)],['排除观测',String(fit.excluded)],['R²',number(fit.r2)],['调整 R²',number(fit.adjustedR2)],['残差标准误',number(fit.rmse)],...fit.coefficients.flatMap(coefficient=>[[`${coefficient.name} 系数`,number(coefficient.estimate)],[`${coefficient.name} 标准误`,number(coefficient.se)],[`${coefficient.name} p`,coefficient.p===null?'—':formatP(coefficient.p)],[`${coefficient.name} 95% CI`,`${number(coefficient.low)} 至 ${number(coefficient.high)}`]] as Array<readonly [string,string]>)]}:null;
  function exportResults(diagnostics=false){
    if(!fit)return;
    const context=[fit.source,fit.config.outcome,[fit.config.predictors.join(' + '),encodingDescription(fit.config.categoricals)].filter(Boolean).join(' + '),fit.config.standardErrors,fit.n,fit.dfResidual];
    const headers=['数据源','因变量','解释变量','标准误方式','有效 N','残差自由度'];
    const rows=diagnostics?[headers.concat(['观测行（表头不计）','拟合值','残差','内部标准化残差','杠杆值','Cook D']),...fit.observations.map(row=>[...context,row.row,row.fitted,row.residual,row.standardizedResidual,row.leverage,row.cook])]:[headers.concat(['变量','系数','标准误','t','p','95% 下限','95% 上限','VIF']),...fit.coefficients.map(row=>[...context,row.name,row.estimate,row.se,row.t,row.p,row.low,row.high,row.vif])];
    downloadRegressionFile(statisticsCsv(rows),diagnostics?'acaora-regression-diagnostics.csv':'acaora-regression-coefficients.csv');
  }
  const terms=[...config.predictors,...(config.categoricals??[]).map(c=>`${c.name}（参考：${c.reference}）`)];
  return <div className={`${styles.workbench} ${styles.analysisLayout} ${!fit?styles.modelPending:''}`}><section className={`${styles.setup} ${styles.modelSetup}`} aria-label="回归分析设置"><h3>模型设置</h3>
    <p className={styles.intro}>依次选择因变量、解释变量与标准误。模型包含截距，仅使用所选字段均完整的观测。</p>
    <div className={styles.modelFields}>
    <div className={`${styles.controls} ${styles.modelOutcome}`}><label className={styles.control}>回归因变量<select aria-label="回归因变量" disabled={busy} value={config.outcome} onChange={event=>{const outcome=event.target.value;setConfig(current=>({...current,outcome,predictors:current.predictors.filter(name=>name!==outcome),categoricals:(current.categoricals??[]).filter(c=>c.name!==outcome)}));}}>{numeric.map(header=><option key={header}>{header}</option>)}</select></label></div>
    <fieldset className={styles.predictors} disabled={busy}><legend>数值解释变量 · 已选 {config.predictors.length} / {MAX_PREDICTORS}</legend><label className={styles.control}>查找解释变量<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="输入变量名称"/></label><div className={styles.choices}>{numeric.filter(name=>name!==config.outcome&&!(config.categoricals??[]).some(c=>c.name===name)&&name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(name=><label className={styles.check} key={name}><input type="checkbox" checked={config.predictors.includes(name)} disabled={!config.predictors.includes(name)&&config.predictors.length>=MAX_PREDICTORS} onChange={event=>setConfig(current=>({...current,predictors:event.target.checked?[...current.predictors,name]:current.predictors.filter(value=>value!==name)}))}/>{name}</label>)}</div><p className={styles.help}>已选：{config.predictors.join('、')||'尚未选择'}。</p></fieldset>
    <CategoricalControls data={data} value={config.categoricals??[]} exclude={[config.outcome,...config.predictors]} disabled={busy} onChange={categoricals=>setConfig(c=>({...c,categoricals}))}/>
    <div className={`${styles.controls} ${styles.modelStandardErrors}`}><label className={styles.control}>标准误方式<select aria-label="标准误方式" disabled={busy} value={config.standardErrors} onChange={event=>setConfig(current=>({...current,standardErrors:event.target.value as RegressionConfig['standardErrors']}))}><option value="HC3">HC3 稳健标准误</option><option value="classical">常规标准误</option></select></label><p className={styles.help}>HC3 允许异方差；两种方式均要求观测独立，不能替代聚类或时间序列稳健估计。</p></div>
    <details className={styles.modelNotes}><summary>模型条件、编码与计算上限</summary><p className={styles.help}>常规标准误依赖同方差等模型条件。两种方式均以残差自由度的 t 分布给出双侧 p 和 95% 区间；HC3 的 t 推断为近似。</p><p className={styles.help}>分类字段按参考组进行哑变量编码，与数值变量合计最多 12 个解释列。最多 50,000 个完整观测，不自动抽样拟合；超过上限时会明确报错。</p></details>
    </div>
    <div className={styles.fitBar}>
    <p className={styles.modelFormula}>{config.outcome||'请选择因变量'} ~ {terms.length?terms.join(' + '):'请选择解释变量'} + 截距</p>
    <p className={styles.help}>完整样本数：{fit&&!stale?`${fit.n}（本次拟合）`:'尚未计算，拟合后确认'}{stale?'；当前设置尚未拟合。':''}</p>
    {errors.length>0&&<ul role="status">{errors.map(message=><li key={message}>{message}</li>)}</ul>}
    <div className={styles.actions}><Button disabled={busy||errors.length>0} onClick={run}>{busy?'正在拟合…':'拟合模型'}</Button>{busy&&<Button variant="secondary" onClick={cancel}>取消计算</Button>}</div>
    {busy&&<p role="status">正在计算…</p>}{error&&<p role="alert">{error}</p>}
    </div>
    <RegressionRecipeTools data={data} config={config} busy={busy} onApply={setConfig}/>
    </section>
    {!fit&&<p className={styles.modelEmpty}>拟合后在此查看系数、置信区间、模型诊断与可导出的图表。</p>}
    {fit&&<section className={styles.result} aria-label="多元回归结果">
      <h3>回归结果</h3><p>因变量：{fit.config.outcome}；解释变量：{[fit.config.predictors.join('、'),encodingDescription(fit.config.categoricals)].filter(Boolean).join('、')}；{seName(fit.config)}标准误</p>
      {stale&&<p role="status">模型设置已修改。下方仍是上次拟合结果，请重新拟合以更新。</p>}
      <dl className={styles.metrics}><div><dt>有效 / 总观测</dt><dd>{fit.n} / {fit.totalRows}</dd></div><div><dt>整行排除</dt><dd>{fit.excluded}</dd></div><div><dt>残差自由度</dt><dd>{fit.dfResidual}</dd></div><div><dt>R² / 调整 R²</dt><dd>{number(fit.r2)} / {number(fit.adjustedR2)}</dd></div><div><dt>残差标准误</dt><dd>{number(fit.rmse)}</dd></div></dl>
      {fit.warnings.length>0&&<ul className={styles.warnings} aria-label="模型诊断提示">{fit.warnings.map(message=><li key={message}>{message}</li>)}</ul>}
      <ResultTools result={result} analysis={{kind:'ols',config:fit.config,tables:[{title:'回归系数',headers:['变量','系数','标准误','t','p','95% 下限','95% 上限','VIF'],rows:fit.coefficients.map(c=>[c.name,c.estimate,c.se,c.t,c.p,c.low,c.high,c.vif])}],charts:chart?[chart]:[]}}/><div className={styles.actions}><Button variant="secondary" size="sm" onClick={()=>exportResults()}>导出系数 CSV</Button><Button variant="ghost" size="sm" onClick={()=>exportResults(true)}>导出逐行诊断 CSV</Button></div>
      <ScrollRegion label="回归系数表，可横向滚动"><table><caption>系数与 95% 置信区间 · {seName(fit.config)}标准误</caption><thead><tr>{['变量','系数','标准误','t','p','95% 下限','95% 上限','VIF'].map(name=><th key={name} scope="col">{name}</th>)}</tr></thead><tbody>{fit.coefficients.map((coefficient,index)=><tr key={index}><th scope="row">{coefficient.name}</th><td>{number(coefficient.estimate)}</td><td>{number(coefficient.se)}</td><td>{number(coefficient.t)}</td><td>{coefficient.p===null?'—':formatP(coefficient.p)}</td><td>{number(coefficient.low)}</td><td>{number(coefficient.high)}</td><td>{number(coefficient.vif,2)}</td></tr>)}</tbody></table></ScrollRegion>
      <p className={styles.help}>— 表示不适用或无法稳定计算。系数是控制所选变量后的条件关联，不能仅凭本结果解释为因果效应。</p>
      {chart&&<PaperChart key={JSON.stringify(chart)} spec={chart}/>}
      <RegressionDiagnostics fit={fit}/>
    </section>}
  </div>;
}
function RegressionDiagnostics({fit}:{fit:RegressionFit}){
  const diagnostics=useMemo(()=>{
    const flagged=fit.observations.filter(row=>(row.cook??0)>4/fit.n||row.leverage>2*fit.parameters/fit.n);
    return {flagged,top:[...fit.observations].sort((a,b)=>(b.cook??-1)-(a.cook??-1)).slice(0,20)};
  },[fit]);
  const points=fit.observations.filter((_,index)=>index%Math.max(1,Math.ceil(fit.n/500))===0);
  const minX=fit.observations.reduce((m,row)=>Math.min(m,row.fitted),Infinity),maxX=fit.observations.reduce((m,row)=>Math.max(m,row.fitted),-Infinity),extent=fit.observations.reduce((m,row)=>Math.max(m,Math.abs(row.residual)),0)||1;
  return <section className={styles.diagnostics} aria-label="回归诊断"><h3>残差与影响点</h3>
    <figure className={styles.figure}><svg viewBox="0 0 720 260" width="100%" role="img" aria-label="残差与拟合值散点图"><desc>横轴是拟合值，纵轴是残差，水平线为残差零。图上按观测顺序等间隔显示最多 500 个点，全部有效观测用于拟合和诊断。</desc><line x1="24" x2="696" y1="130" y2="130" stroke="currentColor" strokeOpacity=".4"/>{points.map(row=><circle key={row.row} cx={24+(row.fitted-minX)/(maxX-minX||1)*672} cy={130-row.residual/extent*108} r="3" fill="currentColor" opacity=".6"/>)}</svg><div className={styles.axis}><span>拟合值 {number(minX)}</span><span>{number(maxX)}</span></div><figcaption>纵轴残差范围约 ±{number(extent)}。显示 {points.length} / {fit.n} 个等间隔观测点；这是探索图，不替代对完整数据和模型条件的检查。</figcaption></figure>
    <p>经验阈值下需留意的观测：{diagnostics.flagged.length} 行。下表按 Cook D 降序显示前 {diagnostics.top.length} 行；没有自动删除。</p><p className={styles.help}>Cook D &gt; 4/N 或杠杆值 &gt; 2p/N 仅为排查提示，p 包含截距。内部标准化残差与 Cook D 使用常规残差均方作诊断参考；VIF ≥ 10 也是经验提示。</p>
    <ScrollRegion label="回归观测诊断表，可横向滚动"><table><thead><tr>{['观测行（表头不计）','拟合值','残差','内部标准化残差','杠杆值','Cook D'].map(name=><th key={name} scope="col">{name}</th>)}</tr></thead><tbody>{diagnostics.top.map(row=><tr key={row.row}><th scope="row">{row.row}</th><td>{number(row.fitted)}</td><td>{number(row.residual)}</td><td>{number(row.standardizedResidual)}</td><td>{number(row.leverage)}</td><td>{number(row.cook)}</td></tr>)}</tbody></table></ScrollRegion>
  </section>;
}
