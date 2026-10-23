import {test,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {installApiMocks} from './helpers';

test('REV-PERF data variable interaction controlled sample',async({page})=>{
  test.setTimeout(90000);
  await installApiMocks(page);
  await page.goto('/data');
  const csv='x,y,z,group\n'+Array.from({length:30000},(_,i)=>`${i%97},${i%131+(i%3)/10},${i%57},${i%2?'A':'B'}`).join('\n');
  await page.getByLabel('选择数据文件').setInputFiles({name:'controlled-30000.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.locator('.chart-toolbar select')).toBeVisible();
  const samples=await page.evaluate(async()=>{
    const select=document.querySelector<HTMLSelectElement>('.chart-toolbar select')!;
    const numbers:number[]=[];
    for(let i=0;i<16;i++){
      const start=performance.now();
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!;
      setter.call(select,i%2?'x':'y');select.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      if(i>=4)numbers.push(performance.now()-start);
    }
    return numbers;
  });
  const sorted=[...samples].sort((a,b)=>a-b);
  const output={phase:process.env.REVISION_PERF_PHASE??'after',rows:30000,columns:4,mode:'Next dev, Chrome, no throttle, warm 4 then 12 samples',measurement:'DOM change dispatch to two animation frames; laboratory sample, not field INP',quantiles:'median averages two middle observations; p90 uses nearest rank',samples,median:(sorted[5]+sorted[6])/2,p90:sorted[Math.ceil(.9*sorted.length)-1]};
  await mkdir('outputs/revision-2026-10-23',{recursive:true});
  await writeFile(`outputs/revision-2026-10-23/performance-${output.phase}.json`,JSON.stringify(output,null,2));
  console.log(JSON.stringify(output));
});
