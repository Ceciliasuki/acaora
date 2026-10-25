import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import ts from 'typescript';

const source = await readFile(new URL('../app/lib/research-delivery.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
const {buildResearchDocx, buildResearchLatex} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const table = Array.from({length: 256}, (_, value) => {for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0;});
function crc(bytes) {let checksum = 0xffffffff; for (const byte of bytes) checksum = table[(checksum ^ byte) & 255] ^ checksum >>> 8; return (checksum ^ 0xffffffff) >>> 0;}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4); length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, checksum]);
}
function png() {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 34, 90, 180, 255, 240, 240, 240, 255]))), chunk('IEND', Buffer.alloc(0))]));
}
function document() {return {
  title: '睡眠 & 学习 <研究交付>', subtitle: '研究者记录；样本与设置需要复核。',
  sections: [{heading: '模型结果与来源', paragraphs: ['保留中文、α、🙂，以及 <script> & 原文。\n第二行。', '文字中的 \\input{secret}、50%、x_y、#、$、~ 和 ^ 都应保持为文字。'],
    table: {caption: '主模型与敏感性分析', headers: ['变量与测量说明', '系数', '95% 区间'], rows: [['睡眠时长 & 测量值', '0.23', '[0.10, 0.36]'], ['控制变量', '—', '未估计']], note: '注：HC3 标准误。样本 N=80，登记值不能替代真实复现。'},
    figures: [{id: 'coef-main', title: '系数 < 95% 区间', png: png(), width: 2, height: 1, note: '图注：合成像素，仅用于导出结构验证。'}]}],
  bibliography: [{key: 'confirmed_2024', authors: ['作者甲', 'A. Researcher'], year: 2024, title: 'A title & measurement', venue: 'Methods journal', doi: '10.1234/measure_1', url: 'https://example.org/measure_1?q=a%20b#data'}, {key: 'incomplete_source', authors: [], year: null, title: '仅确认标题的来源', venue: '', doi: '', url: ''}],
};}

function entries(bytes) {
  const buffer = Buffer.from(bytes), files = new Map(); let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0, 'ZIP/STORE expected'); assert.equal(buffer.readUInt16LE(offset + 6), 0x800, 'UTF-8 flag');
    const size = buffer.readUInt32LE(offset + 18), length = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28), name = buffer.subarray(offset + 30, offset + 30 + length).toString('utf8'), start = offset + 30 + length + extra;
    assert.equal(size, buffer.readUInt32LE(offset + 22)); assert.equal(buffer.readUInt16LE(offset + 12), 33, 'valid Jan 1 1980 DOS date');
    const data = buffer.subarray(start, start + size); assert.equal(crc(data), buffer.readUInt32LE(offset + 14), `CRC ${name}`); assert.equal(files.has(name), false);
    assert.equal(name.startsWith('/'), false); assert.equal(name.split('/').includes('..'), false);
    files.set(name, data); offset = start + size;
  }
  const directoryOffset = offset;
  for (const name of files.keys()) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const length = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    assert.equal(buffer.subarray(offset + 46, offset + 46 + length).toString('utf8'), name);
    assert.equal(buffer.readUInt32LE(buffer.readUInt32LE(offset + 42)), 0x04034b50, 'central entry points to a local header');
    offset += 46 + length + extra + comment;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x06054b50); assert.equal(buffer.readUInt16LE(offset + 10), files.size);
  assert.equal(buffer.readUInt32LE(offset + 16), directoryOffset); assert.equal(offset + 22, buffer.length); return files;
}

test('DOCX is genuine OpenXML with safe package relationships, editable tables and exact binary figures', () => {
  const doc = document(), bytes = buildResearchDocx(doc), files = entries(bytes), content = files.get('word/document.xml').toString('utf8');
  assert.deepEqual([...files.keys()].sort(), ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml', 'docProps/app.xml', 'word/media/figure-coef-main.png'].sort());
  assert.match(files.get('[Content_Types].xml').toString(), /wordprocessingml.document.main\+xml/);
  assert.match(files.get('_rels/.rels').toString(), /Target="word\/document.xml"/);
  assert.match(files.get('word/_rels/document.xml.rels').toString(), /Id="rIdImage1"[^>]*Target="media\/figure-coef-main.png"/);
  assert.deepEqual(new Uint8Array(files.get('word/media/figure-coef-main.png')), doc.sections[0].figures[0].png);
  assert.match(content, /<w:tbl>/); assert.match(content, /<w:tblHeader\/>/); assert.doesNotMatch(content, /w:trHeight/);
  assert.match(content, /<w:pgSz w:w="11906" w:h="16838"\/>/); assert.match(content, /<w:br\/>/);
  assert.match(content, /睡眠 &amp; 学习 &lt;研究交付&gt;/); assert.match(content, /α、🙂/); assert.doesNotMatch(content, /<script>/);
  assert.match(content, /表 1 {2}主模型与敏感性分析/); assert.match(content, /图 1 {2}系数 &lt; 95% 区间/);
  assert.match(content, /r:embed="rIdImage1"/); assert.match(files.get('word/styles.xml').toString(), /w:eastAsia="宋体"/);
  const widths = [...content.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(match => Number(match[1]));
  assert.equal(widths.reduce((sum, value) => sum + value, 0), 9026); assert.ok(widths[0] > widths[1], 'descriptive labels get more room than numeric values');
  assert.deepEqual(buildResearchDocx(doc), bytes, 'same inputs produce the same package without invented timestamps');
});

test('LaTeX escapes prose and uses proper tables, separately supplied figures and exact bibliography metadata', () => {
  const {tex, bib} = buildResearchLatex(document());
  assert.match(tex, /\\documentclass\[UTF8,a4paper,11pt\]\{ctexart\}/); assert.match(tex, /booktabs,longtable,array,graphicx/);
  assert.match(tex, /\\toprule/); assert.match(tex, /\\endfirsthead/); assert.match(tex, /\\endhead/);
  assert.match(tex, /\\includegraphics\[[^\]]*\]\{figure-coef-main\.png\}/); assert.match(tex, /\\label\{fig:coef-main\}/);
  assert.match(tex, /睡眠 \\& 学习 <研究交付>/); assert.match(tex, /\\textbackslash\{\}input\\\{secret\\\}/);
  assert.doesNotMatch(tex, /(?<!textbackslash\{\})\\input\{secret\}/); assert.match(tex, /50\\%/); assert.match(tex, /x\\_y/);
  assert.match(tex, /\\bibliography\{references\}/); assert.match(tex, /\\nocite\{confirmed_2024,incomplete_source\}/);
  assert.match(bib, /author = \{\{作者甲\} and \{A\. Researcher\}\}/); assert.match(bib, /year = \{2024\}/);
  assert.match(bib, /\\url\{https:\/\/example\.org\/measure_1\?q=a%20b#data\}/);
  const incomplete = bib.split('@misc{incomplete_source,')[1]; assert.ok(incomplete); assert.doesNotMatch(incomplete, /author\s*=|year\s*=/);
  assert.doesNotMatch(bib + tex, /Unknown author|Anonymous|n\.d\.|2026/);
});

test('unknown fields, unsafe or duplicate identifiers and untrusted bibliography destinations are rejected', () => {
  const cases = [];
  let doc = document(); doc.unrecognised = true; cases.push(doc);
  doc = document(); doc.sections[0].unrecognised = true; cases.push(doc);
  doc = document(); doc.sections[0].figures[0].extraPath = '/tmp/escape'; cases.push(doc);
  for (const id of ['../escape', 'bad/name', 'bad\\name', '', 'bad:id']) {doc = document(); doc.sections[0].figures[0].id = id; cases.push(doc);}
  doc = document(); doc.sections[0].figures.push({...doc.sections[0].figures[0]}); cases.push(doc);
  doc = document(); doc.bibliography[1].key = 'confirmed_2024'; cases.push(doc);
  for (const url of ['javascript:alert(1)', 'https://name:password@example.org/private', 'https://example.org/line\nbreak']) {doc = document(); doc.bibliography[0].url = url; cases.push(doc);}
  for (const invalid of cases) {assert.throws(() => buildResearchDocx(invalid)); assert.throws(() => buildResearchLatex(invalid));}
});

test('inconsistent rows, invalid scalar types, control characters and oversized values never enter a package', () => {
  const cases = [];
  let doc = document(); doc.sections[0].table.rows[0].pop(); cases.push(doc);
  doc = document(); doc.sections[0].table.rows[0][1] = 0.23; cases.push(doc);
  doc = document(); doc.sections[0].paragraphs[0] = 'bad\u0000text'; cases.push(doc);
  doc = document(); doc.title = '\ud800'; cases.push(doc);
  doc = document(); doc.title = ''; cases.push(doc);
  doc = document(); doc.sections[0].table.headers = Array(13).fill('header'); cases.push(doc);
  doc = document(); doc.sections[0].table.rows = Array(2001).fill(['one', 'two', 'three']); cases.push(doc);
  doc = document(); doc.bibliography[0].year = '2024'; cases.push(doc);
  doc = document(); doc.bibliography[0].doi = 'not-a-doi'; cases.push(doc);
  for (const invalid of cases) {assert.throws(() => buildResearchDocx(invalid)); assert.throws(() => buildResearchLatex(invalid));}
});

test('PNG structure, checksum and declared geometry must agree before either delivery format is generated', () => {
  for (const mutate of [figure => {figure.width = 3;}, figure => {figure.png = figure.png.slice(0, -1);}, figure => {figure.png = new Uint8Array(figure.png); figure.png[figure.png.length - 5] ^= 1;}, figure => {figure.png = new Uint8Array([1, 2, 3]);}, figure => {figure.height = 100000;}]) {
    const doc = document(); mutate(doc.sections[0].figures[0]); assert.throws(() => buildResearchDocx(doc)); assert.throws(() => buildResearchLatex(doc));
  }
});

test('documents without figures or bibliography remain valid and do not invent missing sources', () => {
  const doc = {title: '研究记录', sections: [{heading: '尚待补充', paragraphs: ['保留研究者已有文字。']}]};
  const files = entries(buildResearchDocx(doc)), {tex, bib} = buildResearchLatex(doc);
  assert.equal(files.has('word/media/figure-undefined.png'), false); assert.equal(bib, ''); assert.doesNotMatch(tex, /\\nocite|\\bibliography\{/);
  assert.doesNotMatch(files.get('word/document.xml').toString(), /参考文献|Unknown author|Anonymous/);
});
