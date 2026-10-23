'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {DataSet} from '../stats';
import {fingerprintDataset} from './analysis-recipe';
import type {VariableEntry,WorkflowResult} from './data-workflow';
export type ResearchContextValue={data:DataSet;source:DataSet;workflow:WorkflowResult;dictionary:VariableEntry[];dataFingerprint:string;sourceFingerprint:string;fingerprintError:string};
const Context=createContext<ResearchContextValue|null>(null);
export function useResearchContext(){return useContext(Context);}
export function ResearchProvider({data,source,workflow,dictionary,children}:{data:DataSet;source:DataSet;workflow:WorkflowResult;dictionary:VariableEntry[];children:ReactNode}){
  const [identity,setIdentity]=useState<{data:DataSet;source:DataSet;dataHash:string;sourceHash:string;error:string}|null>(null);
  useEffect(()=>{let active=true;const dataHashPromise=fingerprintDataset(data);void Promise.all([dataHashPromise,data===source?dataHashPromise:fingerprintDataset(source)]).then(([dataHash,sourceHash])=>{if(active)setIdentity({data,source,dataHash,sourceHash,error:''});}).catch(cause=>{if(active)setIdentity({data,source,dataHash:'',sourceHash:'',error:cause instanceof Error?cause.message:'无法生成数据指纹。'});});return()=>{active=false;};},[data,source]);
  const current=identity?.data===data&&identity.source===source?identity:null;
  return <Context.Provider value={{data,source,workflow,dictionary,dataFingerprint:current?.dataHash??'',sourceFingerprint:current?.sourceHash??'',fingerprintError:current?.error??''}}>{children}</Context.Provider>;
}
export function validationLeakage(context:ResearchContextValue|null,required:string[]){return Boolean(context&&(context.workflow.fittedSelection||required.some(h=>context.workflow.fittedColumns.includes(h))));}
