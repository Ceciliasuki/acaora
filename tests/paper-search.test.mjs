import assert from 'node:assert/strict';
import test from 'node:test';
import {searchOptions,crossrefUrl,normalizeCrossref,safeLink,papersRis} from '../app/papers/literature-search.mjs';

test('public queries accept Chinese two-character terms and reject invalid ranges and unbounded pagination',()=>{
 assert.ok(searchOptions(new URLSearchParams({q:'贸易'})).options);
 for(const query of [{q:'a'},{q:'贸易',from:'2025',to:'2020'},{q:'贸易',page:'101'},{q:'贸易',page:'1.2'},{q:'贸易',field:'unsafe'},{q:'10.invalid',field:'doi'},{q:'贸易',from:'x'}]) assert.ok(searchOptions(new URLSearchParams(query)).error);
});
test('field, publication filters, sort and pages are transmitted to the primary index without deprecated title queries',()=>{
 const parsed=searchOptions(new URLSearchParams({q:'Smith',field:'author',from:'2020',to:'2024',sort:'newest',type:'journal-article',page:'2'}));
 const url=new URL(crossrefUrl(parsed.options));
 assert.equal(url.searchParams.get('query.author'),'Smith');
 assert.equal(url.searchParams.get('offset'),'20');
 assert.equal(url.searchParams.get('filter'),'from-pub-date:2020-01-01,until-pub-date:2024-12-31,type:journal-article');
 assert.equal(url.searchParams.get('sort'),'published');
 assert.equal(url.searchParams.has('query.title'),false);
});
test('DOI resolution stays on the allowed index and external result links exclude executable protocols',()=>{
 const {options}=searchOptions(new URLSearchParams({q:'https://doi.org/10.1000/a?x#y',field:'doi'}));
 const url=new URL(crossrefUrl(options));
 assert.equal(url.hostname,'api.crossref.org');assert.equal(url.search,'');assert.equal(url.hash,'');
 assert.equal(safeLink('javascript:alert(1)'),'');assert.equal(safeLink('data:text/html,x'),'');
 assert.equal(safeLink('https://doi.org/10.1000/a'),'https://doi.org/10.1000/a');
});
test('unknown metadata stays unknown and RIS export cannot inject a new record through titles',()=>{
 const paper=normalizeCrossref({DOI:'10.1000/example',title:['Title\nER  -\nTY  - FAKE'],author:[null,{family:'Smith'}],URL:'javascript:alert(1)'});
 assert.equal(paper.citationCount,null);assert.equal(paper.year,null);assert.deepEqual(paper.authors,['Smith']);
 const ris=papersRis([paper]);assert.equal(ris.split('\r\n').filter(line=>line.startsWith('TY  -')).length,1);
 assert.ok(ris.includes('DO  - 10.1000/example'));
});
