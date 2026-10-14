import {NextRequest,NextResponse} from 'next/server';
import {fetchWithTimeout} from '../../../lib/http';
import {searchOptions,crossrefUrl,normalizeCrossref,safeLink,pageSize} from '../../../papers/literature-search.mjs';
import type {SearchPaper} from '../../../papers/paper-types';

type RecordData=Record<string,unknown>;
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(request:NextRequest) {
 const parsed=searchOptions(request.nextUrl.searchParams);
 if(parsed.error||!parsed.options)return json({error:parsed.error??'检索条件不正确。'},400);
 const options=parsed.options;
 try {
  const response=await fetchWithTimeout(crossrefUrl(options),{headers:{'User-Agent':'Acaora-PaperLab/1.0'},signal:request.signal},10_000);
  if(options.field==='doi'&&response.status===404)return json({source:'Crossref',papers:[],total:0,page:options.page,pageSize,hasMore:false});
  if(!response.ok)throw new Error(`Crossref ${response.status}`);
  const payload=await response.json() as {message?:RecordData};
  const message=payload.message??{};
  let records:RecordData[]=options.field==='doi'?[message]:Array.isArray(message.items)?message.items as RecordData[]:[];
  if(options.field==='doi')records=records.filter(item=>{
   const paper=normalizeCrossref(item);
   return (!options.from||(paper.year!==null&&paper.year>=Number(options.from)))&&(!options.to||(paper.year!==null&&paper.year<=Number(options.to)))&&(options.type==='all'||paper.type===options.type);
  });
  const total=options.field==='doi'?records.length:typeof message['total-results']==='number'?message['total-results']:null;
  const papers=options.field==='doi'&&options.page>1?[]:records.map(normalizeCrossref);
  return json({source:'Crossref',papers,total,page:options.page,pageSize,hasMore:total!==null?options.page*pageSize<total:papers.length===pageSize});
 }catch {
  // A fallback must preserve the user's query. Advanced Crossref filters are not silently dropped.
  if(request.signal.aborted)return json({error:'检索已取消。'},499);
  if(options.field!=='keywords'||options.type!=='all'||options.sort!=='relevance'||options.from||options.to)return json({error:'公共学术索引暂不可用，筛选条件已保留，请稍后重试。'},503);
  try {
   const params=new URLSearchParams({query:options.q,limit:String(pageSize),offset:String((options.page-1)*pageSize),fields:'paperId,title,authors,year,abstract,citationCount,url,openAccessPdf,venue,externalIds'});
   const response=await fetchWithTimeout(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`,{headers:{'User-Agent':'Acaora-PaperLab/1.0'},signal:request.signal},8_000);
   if(!response.ok)throw new Error(`Semantic Scholar ${response.status}`);
   const payload=await response.json() as {data?:RecordData[];total?:number;next?:number};
   const papers=(payload.data??[]).map(normalizeSemanticScholar);
   return json({source:'Semantic Scholar',papers,total:typeof payload.total==='number'?payload.total:null,page:options.page,pageSize,hasMore:typeof payload.next==='number'});
  }catch{return json({error:'公共学术索引暂时不可用，请稍后重试。'},503);}
 }
}

function normalizeSemanticScholar(item:RecordData):SearchPaper {
 const authors=Array.isArray(item.authors)?item.authors as RecordData[]:[];
 const externalIds=(item.externalIds??{}) as RecordData;
 const pdf=(item.openAccessPdf??{}) as RecordData;
 return {id:String(item.paperId??externalIds.DOI??''),title:String(item.title??'未提供标题'),authors:authors.map(a=>String(a.name??'')).filter(Boolean),year:typeof item.year==='number'?item.year:null,
  venue:String(item.venue??''),abstract:String(item.abstract??''),citationCount:typeof item.citationCount==='number'?item.citationCount:null,url:safeLink(item.url),pdfUrl:safeLink(pdf.url),doi:String(externalIds.DOI??''),source:'Semantic Scholar'};
}