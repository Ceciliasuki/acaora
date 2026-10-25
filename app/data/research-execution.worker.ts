import {executeResearchAnalysis} from './research-execution';
import {applyDataWorkflow,type DataStep} from './data-workflow';
import {fingerprintDataset} from './analysis-recipe';
import type {DataSet} from '../stats';
self.onmessage=async(event:MessageEvent<{data:DataSet;analysis:{kind:string;config:unknown};steps?:DataStep[]}>)=>{try{
 const workflow=applyDataWorkflow(event.data.data,event.data.steps??[]);
 const result=executeResearchAnalysis(workflow.data,event.data.analysis);
 self.postMessage({result,dataFingerprint:await fingerprintDataset(workflow.data),rows:workflow.data.rows.length,columns:workflow.data.headers.length});
}catch(cause){self.postMessage({error:cause instanceof Error?cause.message:'研究分析未完成。'});}};
