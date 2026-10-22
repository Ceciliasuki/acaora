import {runAdvancedAnalysis} from './advanced-analysis';
import {inspectAdvancedData} from './advanced-check';
self.onmessage=event=>{
  try{self.postMessage(event.data.task==='check'?{check:inspectAdvancedData(event.data.data,event.data.config)}:{result:runAdvancedAnalysis(event.data.data,event.data.config)});}
  catch(cause){self.postMessage({error:cause instanceof Error?cause.message:'计算失败，请检查数据与方法条件。'});}
};
