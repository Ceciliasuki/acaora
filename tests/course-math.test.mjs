import assert from 'node:assert/strict';
import test from 'node:test';
import {renderCourseMath} from '../app/courses/course-math.mjs';
test('valid formulas include accessible MathML',()=>{
  const result=renderCourseMath('\\frac{1}{2}',true);
  assert.equal(result.error,null);assert.match(result.html,/<math/);
});
test('invalid TeX remains an explicit fallback instead of crashing the page',()=>{
  const result=renderCourseMath('\\frac{');
  assert.ok(result.error);assert.equal(result.html,'');
});
test('KaTeX cannot inject links or HTML through trusted commands',()=>{
  for(const source of ['\\href{javascript:alert(1)}{x}','\\htmlClass{evil}{x}','\\includegraphics{https://example.org/track}']) {
    const result=renderCourseMath(source);
    assert.doesNotMatch(result.html,/href=|class="evil"|<img/);
  }
});
