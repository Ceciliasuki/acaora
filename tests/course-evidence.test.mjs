import test from 'node:test';
import assert from 'node:assert/strict';
import {auditNumericalEvidence,auditMathMarkup} from '../app/courses/course-evidence.mjs';
const numeric={id:'check-q',type:'numeric',answer:.5,tolerance:1e-6};
const lessons=[{id:'lesson-1',examples:[{calculationId:'check-example'}],questions:[numeric]}];
const record=(id,declared=.5)=>({id,inputs:{population:10},method:'Exact enumeration',computed:declared,declared,tolerance:1e-6,status:'passed'});
test('numerical evidence rejects missing, stale and failed records rather than trusting count',()=>{
 assert.equal(auditNumericalEvidence(lessons,[],{checks:[record('check-q'),record('check-example')]}).length,0);
 assert.match(auditNumericalEvidence(lessons,[],{checks:[record('check-q')]}).join(' '),/check-example/);
 assert.match(auditNumericalEvidence(lessons,[],{checks:[record('check-q',.6),record('check-example')]}).join(' '),/check-q/);
 assert.match(auditNumericalEvidence(lessons,[],{checks:[{...record('check-q'),status:'failed'},record('check-example')]}).join(' '),/check-q/);
 assert.match(auditNumericalEvidence(lessons,[],{checks:[{...record('check-q'),computed:Infinity},record('check-example')]}).join(' '),/check-q/);
});
test('numerical evidence rejects duplicate identities, empty methods and permissive proof tolerances',()=>{
 assert.ok(auditNumericalEvidence(lessons,[],{checks:[record('check-q'),record('check-q'),record('check-example')]}).length);
 assert.ok(auditNumericalEvidence(lessons,[],{checks:[{...record('check-q'),method:''},record('check-example')]}).length);
 assert.ok(auditNumericalEvidence(lessons,[],{checks:[{...record('check-q'),tolerance:1},record('check-example')]}).length);
});
test('math audit checks block and inline formulas including question solutions',()=>{
 assert.equal(auditMathMarkup({sections:[{formulas:['x^2']}],questions:[{explanation:String.raw`\(\frac12\)`}]}).length,0);
 assert.ok(auditMathMarkup({sections:[{formulas:[String.raw`\unknownmacro{x}`]}]}).length);
 assert.ok(auditMathMarkup({questions:[{explanation:String.raw`\(\href{javascript:x}{click}\)`}]}).length);
});
