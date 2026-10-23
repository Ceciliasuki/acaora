import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Compile the actual pure TypeScript parser with the project's existing compiler.
const source = await readFile(new URL('../app/papers/pdf-text.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
const {readingOrderLines, inferPdfTitle, detectSection, stripRepeatedMargins, buildPdfJoinEvidence, joinPdfLines, inferTextLanguage} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function rows(offset = 0, numeric = false) {
  return Array.from({length: 6}, (_, index) => [
    {text: numeric ? `111111${index} 222222${index} 333333${index} 444444${index} 555555${index}` : `Left paragraph ${index} describes the study population and sample rules.`, x: 40, y: 680 - index * 20, width: 320, size: 10},
    {text: numeric ? `666666${index} 777777${index} 888888${index} 999999${index} 000000${index}` : `Right paragraph ${index} describes the model validation and limitations.`, x: 540, y: 680 - index * 20 - offset, width: 320, size: 10},
  ]).flat();
}

test('offset baselines do not interleave two columns', () => {
  const result = readingOrderLines(rows(1), 1000).map(line => line.text);
  assert.equal(result[5], 'Left paragraph 5 describes the study population and sample rules.');
  assert.equal(result[6], 'Right paragraph 0 describes the model validation and limitations.');
});

test('numeric table cells retain horizontal row associations', () => {
  const result = readingOrderLines(rows(0, true), 1000).map(line => line.text);
  assert.equal(result[0], '1111110 2222220 3333330 4444440 5555550 6666660 7777770 8888880 9999990 0000000');
  assert.equal(result.length, 6);
});

test('full-width text separates column bands in reading order', () => {
  const items = rows().concat({text: 'Full width heading spans both columns', x: 40, y: 630, width: 900, size: 14});
  const result = readingOrderLines(items, 1000).map(line => line.text);
  assert.equal(result[5], 'Right paragraph 2 describes the model validation and limitations.');
  assert.equal(result[6], 'Full width heading spans both columns');
  assert.equal(result[7], 'Left paragraph 3 describes the study population and sample rules.');
});

test('single-column multiline title remains top-to-bottom', () => {
  const result = readingOrderLines([
    {text: 'First title line', x: 40, y: 700, width: 120, size: 18},
    {text: 'Second title line', x: 40, y: 675, width: 125, size: 18},
    {text: 'A normal body paragraph', x: 40, y: 630, width: 200, size: 10},
  ], 1000);
  assert.deepEqual(result.map(line => line.text), ['First title line', 'Second title line', 'A normal body paragraph']);
});

test('fragmented full-width headings stay together between column bands', () => {
  const result = readingOrderLines(rows().concat([
    {text: 'A full width heading begins', x: 40, y: 630, width: 450, size: 14},
    {text: 'and continues across the gutter', x: 500, y: 630, width: 400, size: 14},
  ]), 1000).map(line => line.text);
  assert.equal(result[6], 'A full width heading begins and continues across the gutter');
  assert.equal(result[5], 'Right paragraph 2 describes the model validation and limitations.');
  assert.equal(result[7], 'Left paragraph 3 describes the study population and sample rules.');
});

test('numeric rows below two-column prose keep both sides on each row', () => {
  const table = rows(0, true).map(item => ({...item, y: item.y - 160}));
  const result = readingOrderLines(rows().concat(table), 1000).map(line => line.text);
  assert.equal(result[12], '1111110 2222220 3333330 4444440 5555550 6666660 7777770 8888880 9999990 0000000');
  assert.equal(result[13], '1111111 2222221 3333331 4444441 5555551 6666661 7777771 8888881 9999991 0000001');
});

test('sequential indented prose blocks are not mistaken for simultaneous columns', () => {
  const items = [700, 680, 660, 600, 580, 560, 500, 480, 460].map((y, index) => ({text: `Sequential line ${index} is part of a single ordered document flow.`, x: index >= 3 && index < 6 ? 540 : 40, y, width: 320, size: 10}));
  assert.deepEqual(readingOrderLines(items, 1000).map(line => line.text), items.map(item => item.text));
});

test('title inference combines adjacent title lines and stops before smaller author text', () => {
  assert.equal(inferPdfTitle([
    {text: 'A Study of Transparent Research', size: 18, y: 700},
    {text: 'Across Multiple Independent Cohorts', size: 18, y: 676},
    {text: 'Alex Researcher and Robin Scholar', size: 11, y: 630},
  ], 'fallback'), 'A Study of Transparent Research Across Multiple Independent Cohorts');
});

test('numbered subsections and roman headings need typography for unknown labels', () => {
  assert.equal(detectSection('2.1 Models for 2020 Data', true), 'Models for 2020 Data');
  assert.equal(detectSection('II. Empirical Strategy', true), 'Empirical Strategy');
  assert.equal(detectSection('2.1 Models for 2020 Data'), '');
  assert.equal(detectSection('2 15 2019 0.05', true), '');
  assert.equal(detectSection('3 We find that the estimates vary across each of the many observed groups', true), '');
  assert.equal(detectSection('3. We find a difference.', true), '');
  assert.equal(detectSection('1.2 Methods'), 'Methods');
});

const proseLine = (text, y, extra = {}) => ({text, y, size: 10, x: 40, width: 420, ...extra});

test('margin filtering removes only repeated outer-margin prose and page numbers', () => {
  const pages = [1, 2, 3].map(number => ({height: 800, lines: [
    proseLine('Journal of Controlled Studies', 770, {size: 8}),
    proseLine(`Page ${number} of 3`, 25, {size: 8}),
    proseLine('A repeated sentence belongs to every body section.', 400),
    proseLine('1 2 3 4 5 6', 30),
    proseLine('x = y + 2', 765),
  ]}));
  for (const page of stripRepeatedMargins(pages)) {
    assert.deepEqual(page.lines.map(line => line.text), ['A repeated sentence belongs to every body section.', '1 2 3 4 5 6', 'x = y + 2']);
  }
  assert.equal(stripRepeatedMargins(pages.slice(0, 1))[0].lines.length, 5);
});

test('unique margin content and title-sized repeated lines remain intact', () => {
  const pages = [1, 2, 3].map(number => ({height: 800, lines: [
    proseLine(`Unique footer content ${number}`, 25, {size: 8}),
    proseLine('Repeated large heading', 770, {size: 16}),
    proseLine('A sufficiently long body sentence sets the normal type size.', 400),
  ]}));
  assert.deepEqual(stripRepeatedMargins(pages), pages);
});

test('line-end repair requires layout and independent whole-word evidence', () => {
  const lines = [proseLine('We describe an inter-', 600), proseLine('vention using controlled data.', 586, {width: 310})];
  assert.equal(joinPdfLines(lines, 'The intervention was preregistered.'), 'We describe an intervention using controlled data.');
  assert.equal(joinPdfLines(lines), 'We describe an inter- vention using controlled data.');
  assert.equal(joinPdfLines(lines.map(({text,size,y}) => ({text,size,y})), 'The intervention was preregistered.'), 'We describe an inter- vention using controlled data.');
  assert.equal(joinPdfLines([lines[0], {...lines[1], x: 540, y: 700}], 'The intervention was preregistered.'), 'We describe an inter- vention using controlled data.');
});

test('true compounds, minus signs, numbers and formulas retain their characters', () => {
  const lines = [proseLine('A cross-', 600), proseLine('sectional study of well-being has coefficient -0.5 and x-y = -2.', 586)];
  assert.equal(joinPdfLines(lines, 'We also use crosssectional spelling.'), 'A cross- sectional study of well-being has coefficient -0.5 and x-y = -2.');
  assert.equal(joinPdfLines([proseLine('An inter-', 600), proseLine('vention appears.', 586)], 'The words inter-vention and intervention both occur.'), 'An inter- vention appears.');
  assert.equal(joinPdfLines([proseLine('An inter\u00ad', 600), proseLine('vention appears.', 586)]), 'An intervention appears.');
});

test('one shared document index preserves conservative repairs across paragraph flushes', () => {
  const evidence = buildPdfJoinEvidence('The INTERVENTION was preregistered. Both inter-vention and intervention occur. Crosssectional is a word.');
  const cases = [
    [proseLine('An inter-', 600), proseLine('vention appears.', 586)],
    [proseLine('A cross-', 600), proseLine('sectional study.', 586)],
    [proseLine('An inter\u00ad', 600), proseLine('vention appears.', 586)],
    [proseLine('Coefficient -0.5 and x-y = -2.', 600), proseLine('Other numbers 123-456.', 586)],
  ];
  for (let index = 0; index < 500; index++) {
    assert.equal(joinPdfLines(cases[index % cases.length], evidence), [
      'An inter- vention appears.', 'A cross- sectional study.',
      'An intervention appears.', 'Coefficient -0.5 and x-y = -2. Other numbers 123-456.',
    ][index % cases.length]);
  }
  assert.equal(joinPdfLines(cases[0], buildPdfJoinEvidence('The INTERVENTION was preregistered.')), 'An intervention appears.');
});

test('plain paragraphs do not scan document evidence and indexed flushes never rescan it', () => {
  const document = 'The intervention was preregistered with controlled observations. '.repeat(7000);
  const original = String.prototype.toLowerCase;
  let documentScans = 0;
  String.prototype.toLowerCase = function () {
    if (String(this) === document) documentScans++;
    return original.call(this);
  };
  try {
    const plain = [proseLine('No line break repair is needed.', 600), proseLine('The next sentence is complete.', 586)];
    assert.equal(joinPdfLines(plain, document), 'No line break repair is needed. The next sentence is complete.');
    assert.equal(documentScans, 0);
    const evidence = buildPdfJoinEvidence(document);
    const broken = [proseLine('An inter-', 600), proseLine('vention appears.', 586)];
    for (let index = 0; index < 500; index++) assert.equal(joinPdfLines(broken, evidence), 'An intervention appears.');
    assert.equal(documentScans, 1);
  } finally {
    String.prototype.toLowerCase = original;
  }
});

test('language inference labels only sufficiently clear English or Chinese', () => {
  assert.equal(inferTextLanguage('The study evaluates the results of our model using observations from multiple cohorts and reports uncertainty in the estimates.'), 'en');
  assert.equal(inferTextLanguage('本研究使用多个样本比较统计模型的结果，并报告估计的不确定性。'), 'zh');
  for (const text of ['Introduction', 'x-y = -2', 'Une étude quantitative sur plusieurs cohortes avec des résultats statistiques.', '中文与 English terminology mixed in this short title']) assert.equal(inferTextLanguage(text), undefined);
});
