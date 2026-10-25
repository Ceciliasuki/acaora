import type {Page} from '@playwright/test';

export function trackBrowserRuntimeErrors(page:Page){
 const errors:string[]=[],cancelled=new Set<string>();
 page.on('pageerror',error=>errors.push(`${page.url()}: ${error.stack??error.message}`));
 page.on('requestfailed',request=>{
  if(request.url().includes('_rsc=')&&request.failure()?.errorText==='Load request cancelled')cancelled.add(request.url());
 });
 return (browserName:string)=>{
  // WebKit reports aborted Next prefetches as page errors. Require the exact
  // failed request and explicit network cancellation; never waive API errors.
  const knownCancellation=(error:string)=>browserName==='webkit'&&error.includes('due to access control checks')&&[...cancelled].some(url=>error.includes(url.replace(/^https?:\/\//,'')));
  return {unexpected:errors.filter(error=>!knownCancellation(error)),cancelledPrefetches:errors.filter(knownCancellation)};
 };
}
