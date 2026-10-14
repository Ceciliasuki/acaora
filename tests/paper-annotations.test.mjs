import assert from 'node:assert/strict';
import test from 'node:test';
import {annotationSegments,validAnnotations} from '../app/papers/paper-annotations.mjs';

const paragraph={id:'p',original:'中文 abc 中文',note:'existing note',annotations:[]};
const annotation=(id,start,end)=>({id,start,end,quote:paragraph.original.slice(start,end),comment:'依据待核对',color:'yellow',createdAt:1});
test('overlapping highlights preserve every code unit of original text and both stored anchors',()=>{
 const p={...paragraph,annotations:[annotation('one',0,6),{...annotation('two',3,8),color:'blue'}]};
 const segments=annotationSegments(p);
 assert.equal(segments.map(s=>s.text).join(''),p.original);
 assert.deepEqual(segments.filter(s=>s.annotation).map(s=>s.annotation.id),['one','two','two']);
 assert.equal(validAnnotations(p).length,2);
 assert.equal(p.note,'existing note');
});
test('old records need no migration and changed or malformed anchors never highlight unrelated text',()=>{
 assert.equal(annotationSegments({...paragraph,annotations:undefined}).map(s=>s.text).join(''),paragraph.original);
 const invalid=[{...annotation('stale',0,2),quote:'wrong'},annotation('negative',-1,2),annotation('long',0,200),{...annotation('float',0,2),start:.5},null];
 assert.equal(validAnnotations({...paragraph,annotations:invalid}).length,0);
});
