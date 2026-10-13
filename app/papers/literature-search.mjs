const fields=['keywords','author','journal','doi'];
const types=['all','journal-article','proceedings-article','dissertation','book-chapter'];
const sorts=['relevance','newest','citations'];
export const pageSize=20;

/** @param {URLSearchParams} params */
export function searchOptions(params) {
  const q=(params.get('q')??'').trim();
  const field=params.get('field')??'keywords', type=params.get('type')??'all', sort=params.get('sort')??'relevance';
  const page=Number(params.get('page')??1);
  const from=params.get('from')??'', to=params.get('to')??'';
  if ([...q].length<2 || q.length>300) return {error:'请输入2至300个字符的关键词。'};
  if (!fields.includes(field)||!types.includes(type)||!sorts.includes(sort)||!Number.isInteger(page)||page<1||page>100) return {error:'检索条件不正确，请重新选择。'};
  if ([from,to].some(year=>year && (!/^\d{4}$/.test(year)||Number(year)<1000||Number(year)>2100)) || (from&&to&&Number(from)>Number(to))) return {error:'请填写有效年份，起始年份不能晚于结束年份。'};
  if (field==='doi' && !/^10\.\d{4,9}\/\S+$/i.test(q.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,''))) return {error:'请输入完整DOI，例如10.1000/example。'};
  return {options:{q,field,type,sort,page,from,to}};
}

/** @param {{q:string;field:string;type:string;sort:string;page:number;from:string;to:string}} options */
export function crossrefUrl(options) {
  if (options.field==='doi') return `https://api.crossref.org/works/${encodeURIComponent(options.q.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,''))}`;
  const params=new URLSearchParams({rows:String(pageSize),offset:String((options.page-1)*pageSize),select:'DOI,title,author,published,container-title,URL,abstract,is-referenced-by-count,type'});
  params.set(options.field==='author'?'query.author':options.field==='journal'?'query.container-title':'query.bibliographic',options.q);
  const filters=[];
  if(options.from)filters.push(`from-pub-date:${options.from}-01-01`);
  if(options.to)filters.push(`until-pub-date:${options.to}-12-31`);
  if(options.type!=='all')filters.push(`type:${options.type}`);
  if(filters.length)params.set('filter',filters.join(','));
  params.set('sort',options.sort==='newest'?'published':options.sort==='citations'?'is-referenced-by-count':'relevance');
  params.set('order','desc');
  return `https://api.crossref.org/works?${params}`;
}

/** @param {unknown} value */
export function safeLink(value) {
  if(typeof value!=='string')return '';
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}

/** @param {Record<string,any>} item @returns {import('./paper-types').SearchPaper} */
export function normalizeCrossref(item) {
  const strings=value=>Array.isArray(value)?value.filter(v=>typeof v==='string'):[];
  const year=item.published?.['date-parts']?.[0]?.[0];
  return {id:String(item.DOI??''),doi:String(item.DOI??''),title:strings(item.title)[0]??'未提供标题',
    authors:(Array.isArray(item.author)?item.author:[]).filter(a=>a&&typeof a==='object').map(a=>[a.given,a.family].filter(v=>typeof v==='string').join(' ')).filter(Boolean),
    year:Number.isInteger(year)?year:null,venue:strings(item['container-title'])[0]??'',
    abstract:typeof item.abstract==='string'?item.abstract.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'',
    citationCount:typeof item['is-referenced-by-count']==='number'?item['is-referenced-by-count']:null,
    type:typeof item.type==='string'?item.type:'',url:safeLink(item.URL)||(item.DOI?safeLink(`https://doi.org/${encodeURIComponent(String(item.DOI))}`):''),pdfUrl:'',source:'Crossref'};
}

/** @param {import('./paper-types').SearchPaper[]} papers */
export function papersRis(papers) {
  const line=value=>String(value??'').replace(/[\r\n]+/g,' ').trim();
  return papers.map(p=>[`TY  - ${p.type==='journal-article'?'JOUR':p.type==='dissertation'?'THES':'GEN'}`,`TI  - ${line(p.title)}`,
    ...p.authors.map(a=>`AU  - ${line(a)}`),...(p.year?[`PY  - ${p.year}`]:[]),...(p.venue?[`JO  - ${line(p.venue)}`]:[]),
    ...(p.doi?[`DO  - ${line(p.doi)}`]:[]),...(p.url?[`UR  - ${line(p.url)}`]:[]),'ER  -',''].join('\r\n')).join('\r\n');
}
