import {applyDataWorkflow} from './data-workflow';
import {auditPanel} from './panel-audit';
self.onmessage=e=>{try{self.postMessage(e.data.task==='panel'?{audit:auditPanel(e.data.data,e.data.entity,e.data.time,e.data.interval,e.data.variables)}:{workflow:applyDataWorkflow(e.data.data,e.data.steps)});}catch(cause){self.postMessage({error:cause instanceof Error?cause.message:'处理失败。'});}};
