import type {DataSet} from '../stats';
import type {DataStep} from './data-workflow';
import type {ResearchExecution} from './research-execution';
export function runResearchWorker(data:DataSet,analysis:{kind:string;config:unknown},steps:DataStep[]=[],signal?:AbortSignal):Promise<{result:ResearchExecution;dataFingerprint:string;rows:number;columns:number}>{
 return new Promise((resolve,reject)=>{if(signal?.aborted){reject(new Error('运行已取消。'));return;}const worker=new Worker(new URL('./research-execution.worker.ts',import.meta.url),{name:'acaora-research-execution'});let done=false;
 const finish=()=>{done=true;worker.terminate();signal?.removeEventListener('abort',abort);};const abort=()=>{if(!done){finish();reject(new Error('运行已取消。'));}};
 signal?.addEventListener('abort',abort,{once:true});worker.onmessage=event=>{finish();if(event.data.error)reject(new Error(event.data.error));else resolve(event.data);};worker.onerror=()=>{finish();reject(new Error('计算线程未完成，请保留数据后重试。'));};worker.postMessage({data,analysis,steps});
 });
}
