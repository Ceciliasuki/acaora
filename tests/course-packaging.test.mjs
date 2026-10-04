import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url),picomatch=require('next/dist/compiled/picomatch');
const source=await readFile(new URL('../next.config.ts',import.meta.url),'utf8');
const emitted=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {default:config}=await import('data:text/javascript;base64,'+Buffer.from(emitted).toString('base64'));
const contentRoot=fileURLToPath(new URL('../content/courses/',import.meta.url));
const files=(await readdir(contentRoot,{recursive:true,withFileTypes:true})).filter(entry=>entry.isFile()).map(entry=>'./content/courses/'+relative(contentRoot,join(entry.parentPath,entry.name)).replaceAll('\\','/'));
const matchesFile=(pattern,file)=>picomatch(pattern.replace(/^\.\//,''))(file.replace(/^\.\//,''));

test('EdgeOne include patterns never schedule parallel copies to the same content path',()=>{
 // EdgeOne flattens route-specific globs before parallel cp, without deduplication.
 // Replay its config reader against our real source, then resolve content paths.
 const body=source.match(/outputFileTracingIncludes\s*:\s*\{([\s\S]*?)(?=\n\s*\}[,;\s]*\n|\n\s*\}\s*[,\n])/)[1];
 const pairs=[...body.matchAll(/['"]([^'"]+)['"]\s*:\s*\[([\s\S]*?)\]/g)];
 const patterns=pairs.flatMap(pair=>[...pair[2].matchAll(/['"]([^'"]+)['"]/g)].map(match=>match[1]));
 assert.ok(patterns.length);
 const scheduled=patterns.flatMap(pattern=>files.filter(file=>matchesFile(pattern,file)));
 assert.equal(scheduled.length,new Set(scheduled).size,'duplicate destinations cause EdgeOne cp/unlink races');
 assert.deepEqual([...new Set(scheduled)].sort(),files.sort(),'all original course content remains packaged');
});

test('server routes retain all course content in Next file traces',()=>{
 for(const route of ['/courses','/courses/STAT-201','/courses/STAT-201/lesson-1','/courses/STAT-201/assessments/case-study','/courses/STAT-201/review','/api/courses/STAT-201/progress']){
  const patterns=Object.entries(config.outputFileTracingIncludes).filter(([glob])=>picomatch(glob)(route)).flatMap(([,patterns])=>patterns);
  assert.ok(patterns.length,route);
  for(const file of files)assert.ok(patterns.some(pattern=>matchesFile(pattern,file)),route+' missing '+file);
 }
});
