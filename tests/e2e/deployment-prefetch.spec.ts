import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Replay the current EdgeOne adapter: it sends full .rsc files for any RSC
// request. Apply the app's compiled beforeFiles rules first, as the adapter does.
// This catches failures that a normal `next start` server cannot reproduce.
test('static CDN prefetch returns fresh segment trees and warm navigation needs no new route fetch', async ({page}) => {
  const manifest=JSON.parse(await readFile('.next/routes-manifest.json','utf8'));
  let trees=0;let requests=0;const invalid:string[]=[];
  await page.route('**/*',async route=>{
    const request=route.request();const url=new URL(request.url());const headers=request.headers();
    if(headers.rsc!=='1') {await route.continue();return;}
    requests++;
    const matches=(rule:{regex:string;has?:{key:string;value:string}[]})=>new RegExp(rule.regex).test(url.pathname)&&(rule.has??[]).every(condition=>{
      const match=new RegExp(`^(?:${condition.value})$`).exec(headers[condition.key.toLowerCase()]??'');
      return !!match;
    });
    const rewrite=manifest.rewrites.beforeFiles.find(matches);
    const responseHeaders:Record<string,string>={'content-type':'text/x-component'};
    for(const rule of manifest.headers.filter(matches))for(const header of rule.headers)responseHeaders[header.key.toLowerCase()]=header.value;
    let file:string;
    if(rewrite) {
      // EdgeOne's deployed router did not resolve named header captures. Do
      // not simulate Next's substitution here and hide that platform failure.
      const destination=rewrite.destination;
      file=path.join('.next/static',destination.slice('/_next/static/'.length));
    } else file=path.join('.next/server/app',url.pathname==='/index'?'index.rsc':url.pathname+'.rsc');
    const body=await readFile(file,'utf8');
    if(headers['next-router-segment-prefetch']==='/_tree') {
      trees++;
      if(!body.includes('0:{"tree":')||responseHeaders['x-nextjs-postponed']!=='2')invalid.push(url.pathname);
    }
    await route.fulfill({status:200,headers:responseHeaders,body});
  });
  await page.goto('/dashboard');
  await expect.poll(()=>trees).toBeGreaterThan(3);
  await page.waitForTimeout(1500);
  expect(invalid).toEqual([]);
  expect(trees).toBeLessThan(20);
  const before=requests;
  await page.getByRole('link',{name:'论文研究',exact:true}).click();
  await expect(page.getByRole('heading',{name:'论文研究',exact:true,level:1})).toBeVisible();
  expect(requests-before).toBe(0);
});
