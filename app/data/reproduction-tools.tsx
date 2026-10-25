'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Button} from '../components/ui';
import {useResearchContext} from './research-context';
import type {ResearchAnalysis} from './research-history';
import type {AnalysisResult} from './result-tools';
import {zipFiles} from './reproduction-pack';
import {downloadRegressionFile} from './regression-recipe-tools';
import {ADVANCED_ENGINE} from './advanced-config';
import {REGRESSION_ENGINE} from './regression-config';
import {makeExecutionIdentity} from '../lib/research-verification';
import styles from './multiple-regression.module.css';
export default function ReproductionTools({analysis,result}:{analysis:ResearchAnalysis;result:AnalysisResult}){
  const ctx=useResearchContext(),[include,setInclude]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),mounted=useRef(true),lock=useRef(false),latest=useRef({ctx,analysis,result});
  useLayoutEffect(()=>{latest.current={ctx,analysis,result};});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function download(){if(!ctx||lock.current)return;lock.current=true;setBusy(true);setError('');try{
    if(!ctx.dataFingerprint||!ctx.sourceFingerprint)throw new Error('数据指纹尚未生成。');
    const raw=JSON.stringify({headers:ctx.data.headers,rows:ctx.data.rows});if(include&&new TextEncoder().encode(raw).length>25000000)throw new Error('附带数据超过 25 MB，请单独导出数据文件。');
    const responses=await Promise.all([fetch('/repro/analysis.py'),fetch('/repro/analysis.R'),fetch('/repro/local-runner.py')]);if(responses.some(r=>!r.ok))throw new Error('复现脚本载入失败，请重试。');const [python,r,runner]=await Promise.all(responses.map(r=>r.text()));
    const engine=analysis.kind==='basic'?'acaora-stats-v2':analysis.kind==='ols'?REGRESSION_ENGINE:ADVANCED_ENGINE;
    const verificationIdentity=await makeExecutionIdentity(analysis,engine,ctx.dataFingerprint,ctx.sourceFingerprint);
    const manifest={format:'acaora-reproduction-pack',version:1,engine,verificationIdentity,createdAt:new Date().toISOString(),analysis,dataset:{fingerprint:ctx.dataFingerprint,sourceFingerprint:ctx.sourceFingerprint,rows:ctx.data.rows.length,headers:ctx.data.headers},workflow:ctx.workflow.records,dictionary:ctx.dictionary,joinHistory:ctx.joinHistory,summary:result};
    const readme=`Acaora 分析复现包\n\n本包重算当前处理表上的分析，未自动重放原始文件的处理步骤。manifest.json 保存原表/处理表 SHA-256、实际设置、处理参数和变量来源。分析结果含数值运算差异，PCA 重根的方向可能不同。\n\n数据：${include?'已附带 analysis-data.json（包含所有当前数据行）。':'未附带数据。请在原页面点击“导出复现数据 JSON”，放到本目录并保持文件名 analysis-data.json。'}脚本按完整文件字节校验 SHA-256，修改空格或换行也会拒绝。此 JSON 使用原始字符串，保留缺失标记和数值精度。\n\n本机执行服务：保留四个文件在同一目录（analysis.py、analysis.R、local-runner.py、requirements.txt）。先按下述方式准备自己的环境，再运行 python local-runner.py --allow-origin ${location.origin}，把启动时显示的本机会话令牌填入网页。本机服务只绑定 127.0.0.1，不联网安装依赖；可选 --python 指定已有环境，--rscript 指定 Rscript 路径。浏览器可能要求允许访问本机网络。环境锁记录脚本/依赖清单哈希与实际软件版本，变化后需重新确认。\n\n合并历史：manifest 的 joinHistory 保留合并凭证、前序处理步骤与来源指纹，不附带此前的两份源文件。复现包重算的是当前合并/处理表，重建合并仍须保留所有输入文件。\n\nPython 3.12+：python -m venv .venv；激活环境后 python -m pip install -r requirements.txt；python analysis.py\nR 4.4+：先运行 install.packages(c("jsonlite","digest"))；在本文件夹运行 Rscript analysis.R\n\n输出：python-results.json / r-results.json，逐项摘要、系数、预测或重抽样结果；各自记录依赖版本。verificationIdentity 校验引擎、实际处理表和设置 SHA-256；原表 sourceFingerprint 仅为清单声明，脚本没有原始文件可独立核验。支持的完整精度 verificationMetrics 覆盖描述统计、相关回归、OLS 与配对 t 检验；其他方法保留原结果，不据部分指标判定完整复现。两种脚本使用相同 LCG 分折/抽样。配置文件不能作为可执行代码，脚本不联网、不上传数据。\n\n分类预测的预处理仅在训练折拟合；不要在原表预先按全样本填补或筛选变量。Bootstrap 百分位区间不是 BCa。正式推断应核对研究设计与模型假设。\n`;
    const bytes=zipFiles([{name:'local-runner.py',content:runner},{name:'analysis.py',content:python},{name:'analysis.R',content:r},{name:'manifest.json',content:JSON.stringify(manifest,null,2)},{name:'requirements.txt',content:'numpy==2.5.4\nscipy==1.18.1\nstatsmodels==0.15.0\npandas==3.0.6\n'},{name:'README.txt',content:readme},...(include?[{name:'analysis-data.json',content:raw}]:[])]);
    if(!mounted.current)return;
    const current=latest.current;if(current.ctx?.data!==ctx.data||current.ctx.source!==ctx.source||current.ctx.dataFingerprint!==ctx.dataFingerprint||current.ctx.sourceFingerprint!==ctx.sourceFingerprint||JSON.stringify({kind:current.analysis.kind,config:current.analysis.config})!==JSON.stringify({kind:analysis.kind,config:analysis.config})||JSON.stringify(current.result)!==JSON.stringify(result))throw new Error('数据或分析设置已变化，请按当前结果重新导出。');
    const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/zip'})),link=document.createElement('a');link.href=url;link.download='acaora-reproduction.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'无法生成复现包。');}finally{lock.current=false;if(mounted.current)setBusy(false);}}
  return <div><h4>Python / R 可运行复现包</h4><p className={styles.help}>包含两种脚本、实际配置、依赖清单和运行说明，校验处理表 SHA-256 后重算；处理步骤与来源记录用于审阅。默认不附带数据。</p><label className={styles.check}><input type="checkbox" disabled={busy} checked={include} onChange={e=>setInclude(e.target.checked)}/>附带当前处理表（含全部数据行）</label><div className={styles.actions}><Button variant="secondary" size="sm" disabled={busy||!ctx?.dataFingerprint} onClick={()=>void download()}>{busy?'正在生成…':'下载 Python / R 复现包 ZIP'}</Button><Button variant="ghost" size="sm" disabled={!ctx?.dataFingerprint} onClick={()=>{if(ctx)downloadRegressionFile(JSON.stringify({headers:ctx.data.headers,rows:ctx.data.rows}),'analysis-data.json','application/json');}}>导出复现数据 JSON</Button></div>{error&&<p role="alert">{error}</p>}</div>;
}
