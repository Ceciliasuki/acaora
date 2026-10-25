"use client";

import { ChangeEvent, DragEvent, MouseEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpFromLine, ChevronDown, HardDrive, RotateCcw } from "lucide-react";
import WorkflowGuide from '../components/workflow-guide';
import ResearchProjectTrail from '../components/research-project-trail';
import ResultTools, {type AnalysisResult} from './result-tools';
import AnalysisRecipeTools from './analysis-recipe-tools';
import DataWorkbench from './data-workbench';
import ResearchJoinTools from './research-join-tools';
import type {JoinReceipt} from './research-joins';
import {fingerprintDataset} from './analysis-recipe';
import {ResearchProvider,type JoinHistory} from './research-context';
import type {WorkflowResult,VariableEntry} from './data-workflow';
import {authChangeEvent} from '../lib/auth-client';
import {AnalysisHistory} from './research-history';
import DataExplorer from './data-explorer';
import dynamic from 'next/dynamic';
import AppSidebar from "../components/app-sidebar";
import ui from './data-studio.module.css';
import craft from '../operational-craft.module.css';
import SectionNavigation from '../components/section-navigation';
import {navigateTabs} from '../components/tab-keyboard';
import MotionNavigation from '../components/motion-navigation';
import { Badge, PageHeader } from "../components/ui";
import { acceptedDataFormats, formatLabel, readDataFile } from "./file-readers";
import {
  categoricalColumns,
  DataSet,
  formatNumber,
  formatP,
  histogram,
  isMissing,
  numericColumns,
  regression,
  sampleData,
  summarize,
  welchTest,
} from "../stats";

const stages = [['import','导入数据'],['analysis','分析结果'],['data-workbench','数据处理'],['quality','变量检查'],['history','分析历史'],['preview','处理表预览']] as const;

type AnalysisTab = "describe" | "relation" | "test" | 'multiple' | 'advanced';
const MultipleRegressionPanel=dynamic(()=>import('./multiple-regression-panel'),{loading:()=> <p role="status">正在载入回归工作台…</p>});
const AdvancedPanel=dynamic(()=>import('./advanced-panel'),{loading:()=> <p role="status">正在载入进阶方法…</p>});

function freshWorkflow(data:DataSet):WorkflowResult{return {data,sourceRows:data.rows.map((_,i)=>i+1),records:[],fittedColumns:[],fittedSelection:false};}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const readLock = useRef(false), readEpoch=useRef(0);
  const [joinHistory,setJoinHistory]=useState<JoinHistory[]>([]);
  const [sourceData,setSourceData]=useState<DataSet>(sampleData),[sourceKey,setSourceKey]=useState(0);
  const [workflow,setWorkflow]=useState<WorkflowResult>(()=>freshWorkflow(sampleData)),[dictionary,setDictionary]=useState<VariableEntry[]>([]);

  const [showAllVariables, setShowAllVariables] = useState(false);
  const [fileStatus, setFileStatus] = useState("");
  const [datasetKey, setDatasetKey] = useState(0);
  const [data, setData] = useState<DataSet>(sampleData);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [isSample, setIsSample] = useState(true);
  const [tab, setTab] = useState<AnalysisTab>("describe");
  const [verticalMethods, setVerticalMethods] = useState(false);
  const [xVariable, setXVariable] = useState("睡眠时长");
  const [yVariable, setYVariable] = useState("统计学成绩");
  const [groupVariable, setGroupVariable] = useState("性别");
  const [testVariable, setTestVariable] = useState("统计学成绩");

  useEffect(()=>{const media=matchMedia('(min-width:1181px)'),update=()=>setVerticalMethods(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);

  function navigateMethods(event:KeyboardEvent<HTMLElement>){
    if(verticalMethods&&(event.key==='ArrowDown'||event.key==='ArrowUp')){
      const methods=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
      const index=methods.findIndex(method=>method===event.target);if(index<0)return;
      event.preventDefault();const next=methods[(index+(event.key==='ArrowDown'?1:-1)+methods.length)%methods.length];next.focus();next.click();
    }else navigateTabs(event);
  }

  useEffect(()=>{const clear=()=>{readEpoch.current++;readLock.current=false;setReading(false);setSourceData(sampleData);setData(sampleData);setWorkflow(freshWorkflow(sampleData));setDictionary([]);setJoinHistory([]);setSourceKey(k=>k+1);setDatasetKey(k=>k+1);setIsSample(true);setFileStatus('登录状态已变化，已清除当前数据与分析，请重新导入。');};window.addEventListener(authChangeEvent,clear);return()=>window.removeEventListener(authChangeEvent,clear);},[]);

  const numeric = useMemo(() => numericColumns(data), [data]);
  const categorical = useMemo(() => categoricalColumns(data), [data]);
  const summaries = useMemo(() => numeric.map((header) => summarize(data, header)), [data, numeric]);
  const missingCount = useMemo(() => data.rows.reduce(
    (total, row) => total + row.filter(isMissing).length,
    0,
  ), [data]);
  const completeness = Math.max(0, 100 - (missingCount / Math.max(1, data.rows.length * data.headers.length)) * 100);
  const activeX = numeric.includes(xVariable) ? xVariable : numeric[0] ?? "";
  const activeY = numeric.includes(yVariable) && yVariable !== activeX ? yVariable : numeric.find((item) => item !== activeX) ?? activeX;
  const activeGroup = categorical.includes(groupVariable) ? groupVariable : categorical[0] ?? "";
  const activeTest = numeric.includes(testVariable) ? testVariable : numeric[0] ?? "";
  const distribution = useMemo(() => tab === 'describe' && activeX ? histogram(data, activeX) : [], [data, activeX, tab]);
  const maxBin = Math.max(1, ...distribution.map((bin) => bin.count));
  const model = useMemo(() => tab === 'relation' && activeX && activeY && activeX !== activeY ? regression(data, activeX, activeY) : null, [data, activeX, activeY, tab]);
  const test = useMemo(() => tab === 'test' && activeGroup && activeTest ? welchTest(data, activeGroup, activeTest) : null, [data, activeGroup, activeTest, tab]);
  const histogramUnit = dictionary.find(entry=>entry.name===activeX)?.unit.trim() || '单位未提供';
  const activeSummary = summaries.find(summary=>summary.name===activeX);

  const result: AnalysisResult | null = (() => {
    const source = {source:data.name,sample:isSample};
    if (tab === "describe" && activeX) {
      const summary = activeSummary!;
      return {...source,method:"描述统计",context:`分析变量：${activeX}`,metrics:[["有效样本",String(summary.n)],["均值",formatNumber(summary.mean)],["标准差",formatNumber(summary.sd)],["最小值",formatNumber(summary.min)],["中位数",formatNumber(summary.median)],["最大值",formatNumber(summary.max)]]};
    }
    if (tab === "relation" && model) return {...source,method:"Pearson 相关与一元回归",context:`X：${activeX}；Y：${activeY}`,metrics:[["有效样本",String(model.n)],["相关系数 r",formatNumber(model.r,3)],["p",formatP(model.p)],["回归斜率",formatNumber(model.slope,3)],["截距",formatNumber(model.intercept,3)],["R²",formatNumber(model.r2,3)],["t 统计量",formatNumber(model.t,3)]]};
    if (tab === "test" && test) return {...source,method:"双侧 Welch 独立样本 t 检验",context:`分组：${activeGroup}；因变量：${activeTest}；α = 0.05`,metrics:test.groups.flatMap((group,index):Array<readonly [string,string]> => [[`${group} 有效样本`,String(test.samples[index].length)],[`${group} 均值`,formatNumber(test.means[index])]]).concat([["t 统计量",formatNumber(test.t,3)],["自由度",formatNumber(test.degreesOfFreedom,1)],["p",formatP(test.p)],["Cohen's d",formatNumber(test.effect,3)]])};
    return null;
  })();

  async function loadFile(file?: File) {
    if (!file || readLock.current) return;
    if (file.size === 0) {
      setError("这个文件是空的，请选择包含表头和数据行的文件。");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("文件超过 20 MB。请先抽样或拆分后再导入，以免浏览器失去响应。");
      return;
    }
    const epoch=++readEpoch.current;
    readLock.current = true;
    setReading(true);
    setFileStatus(`正在读取 ${file.name}…`);
    try {
      const parsed = await readDataFile(file);
      if(epoch!==readEpoch.current)return;
      const parsedNumeric = numericColumns(parsed);
      const parsedCategorical = categoricalColumns(parsed);
      if (!parsed.headers.length || !parsed.rows.length) throw new Error("文件中没有可分析的数据行。");
      setData(parsed);setSourceData(parsed);setWorkflow(freshWorkflow(parsed));setDictionary([]);setJoinHistory([]);setSourceKey(k=>k+1);
      setDatasetKey(key => key + 1);
      setShowAllVariables(false);
      setFileStatus(`已读取 ${file.name}：${parsed.rows.length} 行，${parsed.headers.length} 列。本次分析有效，刷新后需重新选择原文件。`);
      setIsSample(false);
      setXVariable(parsedNumeric[0] ?? "");
      setYVariable(parsedNumeric[1] ?? parsedNumeric[0] ?? "");
      setTestVariable(parsedNumeric[0] ?? "");
      setGroupVariable(parsedCategorical[0] ?? "");
      setError("");
    } catch (cause) {
      if(epoch!==readEpoch.current)return;
      setFileStatus("");
      setError(cause instanceof Error ? cause.message : "文件读取失败，请检查格式。" );
    } finally {
      if(epoch===readEpoch.current){readLock.current = false;setReading(false);}
    }
  }

  async function applyJoin(joined:DataSet,receipt:JoinReceipt){
    if(readLock.current)throw new Error('正在读取其他文件，请完成导入后重新预览合并。');if(joinHistory.length>=50)throw new Error('合并历史已达50次，请先导出快照与凭证后另建分析。');const token=++readEpoch.current,captured=sourceData,steps=structuredClone(workflow.records),definitions=structuredClone(dictionary);const fingerprint=await fingerprintDataset(captured);if(token!==readEpoch.current||readLock.current)throw new Error('数据或账户已变化，本次合并未应用。');
    setJoinHistory(history=>[...history,{receipt,leftWorkflow:steps,leftSourceFingerprint:fingerprint,dictionary:definitions}]);setSourceData(joined);setData(joined);setWorkflow(freshWorkflow(joined));setDictionary(definitions.filter(entry=>joined.headers.includes(entry.name)));setSourceKey(key=>key+1);setDatasetKey(key=>key+1);setIsSample(false);setFileStatus('合并结果已作为新的分析原表。前序处理步骤与两表指纹保留在合并历史，未上传数据行。');setError('');
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    void loadFile(event.dataTransfer.files?.[0]);
  }

  function restoreSample() {
    if (readLock.current) return;
    setFileStatus("已恢复示例数据。");
    setShowAllVariables(false);
    setData(sampleData);setSourceData(sampleData);setWorkflow(freshWorkflow(sampleData));setDictionary([]);setJoinHistory([]);setSourceKey(k=>k+1);
    setDatasetKey(key => key + 1);
    setIsSample(true);
    setXVariable("睡眠时长");
    setYVariable("统计学成绩");
    setGroupVariable("性别");
    setTestVariable("统计学成绩");
    setError("");
  }

  function revealSection(event:MouseEvent<HTMLDivElement>){
    const link=(event.target as Element).closest<HTMLAnchorElement>('.data-stage-nav a');
    if(!link)return;const section=document.getElementById(link.hash.slice(1)),disclosure=section?.querySelector<HTMLDetailsElement>(':scope > details');
    if(disclosure&&!disclosure.open){disclosure.open=true;requestAnimationFrame(()=>section?.scrollIntoView({block:'start'}));}
  }

  return (
    <ResearchProvider data={data} source={sourceData} sample={isSample} joinHistory={joinHistory} workflow={workflow} dictionary={dictionary}><main className={`student-app data-app workspace-refresh ${craft.craft} ${ui.studio}`}>
      <AppSidebar active="data" profileTitle="DataLab 工作台" profileSubtitle="数据仅在当前设备处理" />

      <section className="workspace data-main data-shell" id="workspace">
        <PageHeader className="workspace-header" title="数据分析" description="在当前设备读取文件，从样本检查开始分析。" actions={isSample && <Badge tone="warning">示例数据</Badge>} />

        <div className={`page-body page-body--wide ${ui.body}`} onClickCapture={revealSection}>

        <ResearchProjectTrail/>
        <WorkflowGuide kind="data" />
        <SectionNavigation sections={stages} className="data-stage-nav" label="数据分析分区" />
        <section className={ui.dataset} id="import" aria-label="当前数据集">
          <div className={ui.datasetRow}><div className={ui.sourceName}><span className={ui.fileType}>{formatLabel(data.name)}</span><div><h2 title={data.name}>{data.name}</h2><p>{isSample?'示例数据':'当前处理表'}{workflow.records.length?` · 已应用 ${workflow.records.length} 个处理步骤`:''}</p></div></div><dl className={ui.sampleFacts}><div><dt>观测</dt><dd>{data.rows.length}</dd></div><div><dt>变量</dt><dd>{data.headers.length}</dd></div><div><dt>缺失值</dt><dd>{missingCount}</dd></div></dl><button type="button" className={ui.changeFile} disabled={reading} onClick={()=>inputRef.current?.click()}><ArrowUpFromLine size={16} aria-hidden="true"/>{reading?'正在读取…':'导入 / 更换数据'}</button></div>
          {fileStatus && <p className="data-load-status" role="status">{fileStatus}</p>}{error && <p className="error-message" role="alert">{error}</p>}
          <p className={ui.storageSummary}>原文件不上传；当前数据与固定结果仅在本次页面会话，刷新后需重选文件。方案需导出保存；命名快照仅保存在本机，登录后按账户隔离、匿名时仅在当前标签页，不含数据行，不作云同步。</p>
          <div className={ui.importOptions}><details className={ui.importDetails}><summary>文件格式与导入说明<ChevronDown size={16} aria-hidden="true"/></summary>
          <div className="upload-panel">
            <div className="panel-heading">
              <div><h2>导入数据</h2></div>
              <span className="privacy-pill"><HardDrive size={15} aria-hidden="true" />仅本地处理</span>
            </div>
            <button
              className={`dropzone ${dragging ? "dragging" : ""}`} disabled={reading} aria-busy={reading}
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span className="upload-icon"><ArrowUpFromLine size={24} aria-hidden="true" /></span>
              <strong>{reading ? "正在识别并读取数据…" : dragging ? "松开即可读取文件" : "拖入文件，或点击选择"}</strong>
              <small>CSV · Excel · Stata · SPSS · SAS · R 数据文件</small>
            </button>
            <input ref={inputRef} className="sr-only" type="file" accept={acceptedDataFormats} aria-label="选择数据文件" disabled={reading} onChange={onFileChange} />
            <div className="format-support" role="group" aria-label="支持的数据格式">
              <span>Excel <small>.xlsx .xls .ods</small></span>
              <span>Stata <small>.dta</small></span>
              <span>SPSS / SAS <small>.sav .xpt</small></span>
              <span>R <small>.rds .RData</small></span>
            </div>
            <div className="file-chip">
              <span className="csv-badge">{formatLabel(data.name)}</span>
              <div><strong title={data.name}>{data.name}</strong><small>{data.rows.length} 行 × {data.headers.length} 列{isSample ? " · 示例数据" : ""}</small></div>
              <span className="ready-dot">读取正常</span>
            </div>
          </div>

          </details><button className={ui.restoreSample} type="button" onClick={restoreSample} disabled={reading || isSample}><RotateCcw size={14} aria-hidden="true"/>恢复示例数据</button></div>
        </section>

        <section className="analysis-panel" id="analysis">
          <div className="analysis-header">
            <div><h2>分析方法</h2></div>
            <MotionNavigation as="div" className="analysis-tabs" role="tablist" orientation={verticalMethods?'vertical':'horizontal'} label="分析方法" value={tab} onKeyDown={navigateMethods}>
              <button role="tab" id="analysis-tab-describe" aria-controls="analysis-result" tabIndex={tab === "describe" ? 0 : -1} aria-selected={tab === "describe"} className={tab === "describe" ? "active" : ""} onClick={() => setTab("describe")} type="button">描述统计</button>
              <button role="tab" id="analysis-tab-relation" aria-controls="analysis-result" tabIndex={tab === "relation" ? 0 : -1} aria-selected={tab === "relation"} className={tab === "relation" ? "active" : ""} onClick={() => setTab("relation")} type="button">相关与回归</button>
              <button role="tab" id="analysis-tab-test" aria-controls="analysis-result" tabIndex={tab === "test" ? 0 : -1} aria-selected={tab === "test"} className={tab === "test" ? "active" : ""} onClick={() => setTab("test")} type="button">独立样本 t 检验</button>
              <button role="tab" id="analysis-tab-multiple" aria-controls="analysis-result" tabIndex={tab==='multiple'?0:-1} aria-selected={tab==='multiple'} className={tab==='multiple'?'active':''} onClick={()=>setTab('multiple')} type="button">多元回归</button>
              <button role="tab" id="analysis-tab-advanced" aria-controls="analysis-result" tabIndex={tab==='advanced'?0:-1} aria-selected={tab==='advanced'} className={tab==='advanced'?'active':''} onClick={()=>setTab('advanced')} type="button">进阶方法</button>
            </MotionNavigation>
          </div>

          <div className={ui.analysisCanvas}>
          {tab!=='multiple'&&tab!=='advanced'&&<AnalysisRecipeTools key={`recipe-${datasetKey}`} datasetKey={String(datasetKey)} data={data} config={{method:tab,x:activeX,y:activeY,group:activeGroup,value:activeTest}} onApply={config=>{setXVariable(config.x);setYVariable(config.y);setGroupVariable(config.group);setTestVariable(config.value);setTab(config.method);}}/>}

          <div className="analysis-content" key={tab} id="analysis-result" role="tabpanel" aria-labelledby={`analysis-tab-${tab}`} tabIndex={0}>{numeric.length === 0 ? (
            <div className="empty-state"><strong>没有检测到数值变量</strong><p>请确认数值列中没有混入大量文字或特殊符号。</p></div>
          ) : tab==='advanced'?<AdvancedPanel key={`advanced-${datasetKey}`} data={data} isSample={isSample}/>:tab==='multiple'?<MultipleRegressionPanel key={`model-${datasetKey}`} data={data} isSample={isSample}/>:tab === "describe" ? (
            <div className="analysis-grid">
              <div className="chart-card">
                <div className="chart-toolbar">
                  <div><p>分布直方图</p><h3>{activeX}</h3></div>
                  <label>分析变量<select value={activeX} onChange={(event) => setXVariable(event.target.value)}>{numeric.map((item) => <option key={item}>{item}</option>)}</select></label>
                </div>
                <div className={`histogram ${ui.continuousHistogram}`} role="img" aria-label={`${activeX}的直方图；${histogramUnit}；分组频数见下表`}>
                  {distribution.map((bin, index) => (
                    <div className="histogram-column" key={index}>
                      <span>{bin.count || ""}</span>
                      <i title={`${formatNumber(bin.from,6)} 至 ${formatNumber(bin.to,6)}：${bin.count}`} style={{ height: `calc(${(bin.count / maxBin) * 100}% - ${(bin.count / maxBin) * 22}px)`,minHeight:bin.count?'2px':'0' }} />
                    </div>
                  ))}
                </div>
                <div className="axis-labels"><span>{formatNumber(distribution[0]?.from ?? 0, 1)}</span><strong>{activeX}</strong><span>{formatNumber(distribution.at(-1)?.to ?? 0, 1)}</span></div>
                <details className={ui.frequency}><summary>查看区间与频数表 · {histogramUnit}</summary><p>按有效数值的最小值至最大值等宽分为 9 组，左闭右开；最后一组包含右端点。常量列使用组宽 1。缺失值不计入频数。</p><table><caption>{activeX} · 原始区间端点与频数</caption><thead><tr><th scope="col">区间</th><th scope="col">频数</th></tr></thead><tbody>{distribution.map((bin,index)=><tr key={index}><th scope="row">[{bin.from}, {bin.to}{index===distribution.length-1?']':')'}</th><td>{bin.count}</td></tr>)}</tbody></table></details>
              </div>
              <div className="result-card">
                <p className="result-label">统计摘要</p>
                {(() => {
                  const current = activeSummary??summarize(data,activeX);
                  return <>
                    <div className="big-result"><span>均值</span><strong>{formatNumber(current.mean)}</strong><small>标准差 {formatNumber(current.sd)}</small></div>
                    <dl className="stats-list">
                      <div><dt>有效样本</dt><dd>{current.n}</dd></div>
                      <div><dt>最小值</dt><dd>{formatNumber(current.min)}</dd></div>
                      <div><dt>中位数</dt><dd>{formatNumber(current.median)}</dd></div>
                      <div><dt>最大值</dt><dd>{formatNumber(current.max)}</dd></div>
                    </dl>
                  </>;
                })()}
              </div>
              <div className="summary-table-card">
                <div className="table-title"><strong>全部数值变量</strong></div>
                <div className="table-wrap" role="region" aria-label="数值变量统计表，可横向滚动">
                  <button
                    type="button"
                    className="sr-only"
                    aria-label="使用左右方向键横向滚动数值变量统计表"
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                      event.preventDefault();
                      event.currentTarget.parentElement?.scrollBy({ left: event.key === "ArrowRight" ? 160 : -160 });
                    }}
                  >横向滚动表格</button>
                  <table>
                    <thead><tr><th>变量</th><th>N</th><th>均值</th><th>标准差</th><th>最小</th><th>中位数</th><th>最大</th></tr></thead>
                    <tbody>{summaries.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.n}</td><td>{formatNumber(item.mean)}</td><td>{formatNumber(item.sd)}</td><td>{formatNumber(item.min)}</td><td>{formatNumber(item.median)}</td><td>{formatNumber(item.max)}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : tab === "relation" ? (
            <div className="analysis-grid relation-grid">
              <div className="chart-card scatter-card">
                <div className="chart-toolbar two-selects">
                  <div><p>散点图</p><h3>{activeX} × {activeY}</h3></div>
                  <div className="select-pair">
                    <label>X<select value={activeX} onChange={(event) => setXVariable(event.target.value)}>{numeric.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label>Y<select value={activeY} onChange={(event) => setYVariable(event.target.value)}>{numeric.map((item) => <option key={item}>{item}</option>)}</select></label>
                  </div>
                </div>
                {model && <ScatterPlot pairs={model.pairs} xLabel={activeX} yLabel={activeY} />}
              </div>
              <div className="result-card correlation-result">
                <p className="result-label">Pearson 相关</p>
                {model ? <>
                  <div className="big-result"><span>相关系数 r</span><strong>{formatNumber(model.r, 3)}</strong><small>p {formatP(model.p)} · n = {model.n}</small></div>
                  <dl className="stats-list">
                    <div><dt>回归斜率</dt><dd>{formatNumber(model.slope, 3)}</dd></div>
                    <div><dt>截距</dt><dd>{formatNumber(model.intercept, 3)}</dd></div>
                    <div><dt>R²</dt><dd>{formatNumber(model.r2, 3)}</dd></div>
                    <div><dt>t 统计量</dt><dd>{formatNumber(model.t, 3)}</dd></div>
                  </dl>
                  <div className="plain-conclusion"><span>结果解释</span><p>{Math.abs(model.r) >= 0.7 ? "两变量呈较强" : Math.abs(model.r) >= 0.4 ? "两变量呈中等" : "两变量呈较弱"}{model.r >= 0 ? "正" : "负"}相关；在 α = 0.05 水平下{model.p < 0.05 ? "具有统计学意义" : "未达到统计学意义"}。</p></div>
                </> : <p role="status">请选择两个不同且有变动的数值变量；相关与回归至少需要 3 对完整观测。</p>}
              </div>
            </div>
          ) : (
            <div className="analysis-grid test-grid">
              <div className="test-config-card">
                <p className="result-label">Welch 独立样本 t 检验</p>
                <h3>比较两个独立组的均值</h3>
                <label>分组变量<select value={activeGroup} onChange={(event) => setGroupVariable(event.target.value)}>{categorical.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>因变量<select value={activeTest} onChange={(event) => setTestVariable(event.target.value)}>{numeric.map((item) => <option key={item}>{item}</option>)}</select></label>
                <p className="method-note">默认使用双侧 Welch t 检验，不要求两组方差相等。</p>
              </div>
              <div className="result-card test-result-card">
                {test ? <>
                  <p className="result-label">检验结果</p>
                  <div className="group-comparison">
                    {test.groups.map((group, index) => <div key={group}><span>{activeGroup} = {group}</span><strong>{formatNumber(test.means[index])}</strong><small>n = {test.samples[index].length}</small></div>)}
                  </div>
                  <div className="test-stat-line"><span>t({formatNumber(test.degreesOfFreedom, 1)}) = {formatNumber(test.t, 3)}</span><strong>p {formatP(test.p)}</strong></div>
                  <dl className="stats-list compact-list"><div><dt>Cohen&apos;s d</dt><dd>{formatNumber(test.effect, 3)}</dd></div><div><dt>显著性水平</dt><dd>α = 0.05</dd></div></dl>
                  <div className="plain-conclusion"><span>统计结论</span><p>两组的 {activeTest} 均值差异{test.p < 0.05 ? "具有统计学意义" : "未达到统计学意义"}（p {formatP(test.p)}）。</p></div>
                </> : <div className="empty-state"><strong>暂时无法执行检验</strong><p>分组变量需要恰好包含两个有效组，每组至少有两个有效数值观测，且至少一组存在变动。</p></div>}
              </div>
            </div>
          )}</div>
          {tab!=='multiple'&&tab!=='advanced'&&<ResultTools key={datasetKey} analysis={{kind:'basic',config:{method:tab,x:activeX,y:activeY,group:activeGroup,value:activeTest}}} result={result} />}
          </div>
        </section>
        <DataWorkbench key={sourceKey} onApply={w=>{setData(w.data);setWorkflow(w);setDatasetKey(k=>k+1);}} onDictionary={setDictionary}/>
        <section className="quality-panel" id="quality"><details className={ui.disclosure}>
          <summary className="panel-heading compact">
            <div><h2>变量检查</h2></div>
            <span className="quality-score">完整度 {completeness.toFixed(1)}%</span><ChevronDown size={17} aria-hidden="true"/>
          </summary>
          <div className="variable-strip" id="data-variables">
            {(showAllVariables ? data.headers : data.headers.slice(0, 8)).map((header, column) => {
              const missing = data.rows.filter((row) => isMissing(row[column])).length;
              const isNumeric = numeric.includes(header);
              return (
                <article className="variable-card" key={`${header}-${column}`}>
                  <div><span className={isNumeric ? "type-number" : "type-text"}>{isNumeric ? "123" : "ABC"}</span><strong>{header}</strong></div>
                  <small>{isNumeric ? "数值型" : "分类型"} · 缺失 {missing}</small>
                  <i><b style={{ width: `${100 - (missing / Math.max(1, data.rows.length)) * 100}%` }} /></i>
                </article>
              );
            })}
          </div>
          {data.headers.length > 8 && <button type="button" className="data-variable-disclosure" aria-controls="data-variables" aria-expanded={showAllVariables} onClick={() => setShowAllVariables(value => !value)}>{showAllVariables ? "收起变量" : `查看全部 ${data.headers.length} 个变量`}</button>}
        </details></section>

        <div className={ui.exploration}><DataExplorer key={`explorer-${datasetKey}`} data={data} onSelectPair={(x,y)=>{setXVariable(x);setYVariable(y);setTab('relation');requestAnimationFrame(()=>document.getElementById('analysis-tab-relation')?.focus());}}/></div>
        <ResearchJoinTools data={data} onApply={(joined,receipt)=>applyJoin(joined,receipt)}/>
        <span id="research-operations" aria-hidden="true"/><section id="history" className={ui.historySection}><AnalysisHistory/></section>

        <section className="data-preview" id="preview">
          <div className="panel-heading compact">
            <div><h2>当前处理表 · {data.name}</h2></div>
            <div className="status-copy"><span /> 显示前 {Math.min(8, data.rows.length)} 行</div>
          </div>
          <div className="table-wrap preview-table" role="region" aria-label="当前处理表预览，可横向滚动">
            <button
              type="button"
              className="sr-only"
              aria-label="使用左右方向键横向滚动当前处理表预览"
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                event.currentTarget.parentElement?.scrollBy({ left: event.key === "ArrowRight" ? 160 : -160 });
              }}
            >横向滚动表格</button>
            <table>
              <thead><tr>{data.headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead>
              <tbody>{data.rows.slice(0, 8).map((row, rowIndex) => <tr key={rowIndex}>{data.headers.map((_, column) => <td className={isMissing(row[column] ?? "") ? "missing-cell" : ""} key={column}>{isMissing(row[column] ?? "") ? "缺失" : row[column]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>

        <footer><span>Acaora · DataLab</span><p>用于探索性学习与课程项目；正式研究请结合研究设计与专业判断。</p></footer>
        </div>

      </section>
    </main></ResearchProvider>
  );
}

function ScatterPlot({ pairs, xLabel, yLabel }: { pairs: [number, number][]; xLabel: string; yLabel: string }) {
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return (
    <div className="scatter-wrap">
      <span className="y-axis-title">{yLabel}</span>
      <div className="scatterplot" role="img" aria-label={`${xLabel}和${yLabel}的散点图`}>
        {pairs.map(([x, y], index) => <i key={index} style={{ left: `${8 + ((x - minX) / (maxX - minX || 1)) * 84}%`, bottom: `${8 + ((y - minY) / (maxY - minY || 1)) * 84}%` }} />)}
      </div>
      <div className="axis-labels"><span>{formatNumber(minX, 1)}</span><strong>{xLabel}</strong><span>{formatNumber(maxX, 1)}</span></div>
    </div>
  );
}
