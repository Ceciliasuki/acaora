import {fitMultipleRegression} from './multiple-regression';
import type {DataSet} from '../stats';
import type {RegressionConfig} from './regression-config';
const scope=self as unknown as {onmessage:((event:MessageEvent<{data:DataSet;config:RegressionConfig}>)=>void)|null;postMessage:(value:unknown)=>void};
scope.onmessage=event=>{
  try{scope.postMessage({result:fitMultipleRegression(event.data.data,event.data.config)});}
  catch(error){scope.postMessage({error:error instanceof Error?error.message:'回归计算未完成，请检查数据。'});}
};
