/** Editable delivery formats. No source data, executable code, or network calls. */
export type DeliveryDocument = {
  title: string;
  subtitle?: string;
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    table?: {caption: string; headers: string[]; rows: string[][]; note: string};
    figures?: Array<{id: string; title: string; png: Uint8Array; width: number; height: number; note: string}>;
  }>;
  bibliography?: Array<{key: string; authors: string[]; year: number | null; title: string; venue: string; doi: string; url: string}>;
};

type Figure = NonNullable<DeliveryDocument['sections'][number]['figures']>[number];
type DeliveryTable = NonNullable<DeliveryDocument['sections'][number]['table']>;
const encoder = new TextEncoder();
const safeId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const MAX_BYTES = 32 * 1024 * 1024;
const BODY_TWIPS = 9026;
const xml = (value: string) => value.replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[character]!));
const tex = (value: string) => value.replace(/\r\n?/g, '\n').replace(/[\\{}%$#&_~^]/g, character => ({'\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '%': '\\%', '$': '\\$', '#': '\\#', '&': '\\&', '_': '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}'}[character]!));
const texLine = (value: string) => tex(value.replace(/[\r\n\t]+/g, ' '));
const texFlow = (value:string) => value.split(/([A-Za-z0-9_-]{24,})/g).map(part=>/^[A-Za-z0-9_-]{24,}$/.test(part)?(part.match(/.{1,16}/g)??[]).map(tex).join('\\allowbreak{}'):tex(part)).join('').replace(/\n/g,'\\newline{}');
const bibliographyUrl = (value: string) => new URL(value).href.replace(/[{}\\]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function keys(value: unknown, allowed: string[], required: string[]) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) throw new Error('交付内容包含未知或缺失字段。');
}
function text(value: unknown, max = 60000, required = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) throw new Error('交付文字为空、过长或格式不正确。');
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (!(point === 9 || point === 10 || point === 13 || point >= 0x20 && point <= 0xd7ff || point >= 0xe000 && point <= 0xfffd || point >= 0x10000 && point <= 0x10ffff)) throw new Error('交付文字包含不受支持的控制字符。');
  }
}
function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);}
  return (value ^ 0xffffffff) >>> 0;
}
function validatePng(figure: Figure) {
  const png = figure.png;
  if (!(png instanceof Uint8Array) || png.byteLength < 45 || png.byteLength > 20 * 1024 * 1024 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => png[index] === byte)) throw new Error('图件必须是有效的 PNG，且不超过 20 MB。');
  if (!Number.isInteger(figure.width) || !Number.isInteger(figure.height) || figure.width < 1 || figure.height < 1 || figure.width > 8192 || figure.height > 8192 || figure.width * figure.height > 24000000) throw new Error('图件尺寸无效或过大。');
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8, count = 0, hasData = false, ended = false;
  while (offset + 12 <= png.length) {
    if (++count > 1000) throw new Error('PNG 图件包含过多数据块。');
    const size = view.getUint32(offset), end = offset + size + 12;
    if (end > png.length) throw new Error('PNG 图件数据不完整。');
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (crc32(png.subarray(offset + 4, offset + 8 + size)) !== view.getUint32(offset + 8 + size)) throw new Error('PNG 图件校验失败。');
    if (count === 1 && (type !== 'IHDR' || size !== 13 || view.getUint32(offset + 8) !== figure.width || view.getUint32(offset + 12) !== figure.height)) throw new Error('图件尺寸与 PNG 内容不一致。');
    if (type === 'IDAT') hasData = true;
    if (type === 'acTL') throw new Error('交付图件应为静态 PNG。');
    offset = end;
    if (type === 'IEND') {ended = size === 0 && offset === png.length; break;}
  }
  if (!hasData || !ended) throw new Error('PNG 图件缺少完整图像数据。');
}
function validate(doc: DeliveryDocument) {
  keys(doc, ['title', 'subtitle', 'sections', 'bibliography'], ['title', 'sections']);
  text(doc.title, 500, true); if (doc.subtitle !== undefined) text(doc.subtitle, 4000);
  if (!Array.isArray(doc.sections) || !doc.sections.length || doc.sections.length > 2500) throw new Error('交付文档需要 1–2500 个章节。');
  let characters = doc.title.length + (doc.subtitle?.length ?? 0), bytes = 0;
  const figureIds = new Set<string>(), bibliographyKeys = new Set<string>();
  for (const section of doc.sections) {
    keys(section, ['heading', 'paragraphs', 'table', 'figures'], ['heading']); text(section.heading, 500, true); characters += section.heading.length;
    if (section.paragraphs !== undefined) {
      if (!Array.isArray(section.paragraphs) || section.paragraphs.length > 100) throw new Error('章节段落格式或数量不正确。');
      for (const paragraph of section.paragraphs) {text(paragraph); characters += paragraph.length;}
    }
    if (section.table !== undefined) {
      const table = section.table; keys(table, ['caption', 'headers', 'rows', 'note'], ['caption', 'headers', 'rows', 'note']);
      text(table.caption, 1000, true); text(table.note, 6000); characters += table.caption.length + table.note.length;
      if (!Array.isArray(table.headers) || !table.headers.length || table.headers.length > 12 || !Array.isArray(table.rows) || table.rows.length > 2000) throw new Error('交付表格支持 1–12 列，最多 2,000 行。');
      for (const header of table.headers) {text(header, 1000, true); characters += header.length;}
      for (const row of table.rows) {if (!Array.isArray(row) || row.length !== table.headers.length) throw new Error('交付表格行列不匹配。'); for (const cell of row) {text(cell, 6000); characters += cell.length;}}
    }
    if (section.figures !== undefined) {
      if (!Array.isArray(section.figures) || section.figures.length > 30) throw new Error('章节图件格式或数量不正确。');
      for (const figure of section.figures) {
        keys(figure, ['id', 'title', 'png', 'width', 'height', 'note'], ['id', 'title', 'png', 'width', 'height', 'note']);
        if (typeof figure.id !== 'string' || !safeId.test(figure.id) || figureIds.has(figure.id)) throw new Error('图件标识不安全或重复。');
        figureIds.add(figure.id); text(figure.title, 1000, true); text(figure.note, 6000); validatePng(figure);
        bytes += figure.png.length; characters += figure.title.length + figure.note.length;
      }
    }
  }
  if (doc.bibliography !== undefined) {
    if (!Array.isArray(doc.bibliography) || doc.bibliography.length > 300) throw new Error('参考文献格式或数量不正确。');
    for (const item of doc.bibliography) {
      keys(item, ['key', 'authors', 'year', 'title', 'venue', 'doi', 'url'], ['key', 'authors', 'year', 'title', 'venue', 'doi', 'url']);
      if (typeof item.key !== 'string' || !safeId.test(item.key) || bibliographyKeys.has(item.key)) throw new Error('引用标识不安全或重复。');
      bibliographyKeys.add(item.key);
      if (!Array.isArray(item.authors) || item.authors.length > 100 || !(item.year === null || Number.isInteger(item.year) && item.year >= 1000 && item.year <= 2200)) throw new Error('参考文献作者或年份格式不正确。');
      for (const author of item.authors) {text(author, 500, true); characters += author.length;}
      text(item.title, 2000, true); text(item.venue, 1000); text(item.doi, 300); text(item.url, 2048); characters += item.title.length + item.venue.length + item.doi.length + item.url.length;
      if (item.doi && !/^10\.\d{4,9}\/[^\s<>"{}]+$/i.test(item.doi)) throw new Error('参考文献 DOI 格式不正确。');
      if (item.url) {let url: URL; try {url = new URL(item.url);} catch {throw new Error('参考文献 URL 格式不正确。');} if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || /\s/.test(item.url)) throw new Error('参考文献 URL 不安全。');}
    }
  }
  if (characters > 1000000 || bytes + characters * 4 > MAX_BYTES || figureIds.size > 100) throw new Error('交付文档过大，请分批导出。');
}
function zip(files: Array<{name: string; bytes: Uint8Array}>): Uint8Array {
  const chunks: Uint8Array[] = [], directory: Uint8Array[] = [], names = new Set<string>(); let offset = 0;
  if (files.length > 512) throw new Error('交付文件过多。');
  for (const file of files) {
    if (!/^[A-Za-z0-9_[\]./-]+$/.test(file.name) || file.name.length > 200 || file.name.split('/').some(segment => !segment || segment === '.' || segment === '..') || names.has(file.name)) throw new Error('交付文件路径不安全或重复。');
    names.add(file.name); const name = encoder.encode(file.name), checksum = crc32(file.bytes), local = new Uint8Array(30 + name.length), view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true); view.setUint16(12, 33, true); view.setUint32(14, checksum, true); view.setUint32(18, file.bytes.length, true); view.setUint32(22, file.bytes.length, true); view.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true); cv.setUint16(14, 33, true); cv.setUint32(16, checksum, true); cv.setUint32(20, file.bytes.length, true); cv.setUint32(24, file.bytes.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
    chunks.push(local, file.bytes); directory.push(central); offset += local.length + file.bytes.length;
  }
  const directorySize = directory.reduce((sum, chunk) => sum + chunk.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, directorySize, true); ev.setUint32(16, offset, true);
  if (offset + directorySize + 22 > MAX_BYTES) throw new Error('交付文件超过 32 MB。');
  const result = new Uint8Array(offset + directorySize + 22); let cursor = 0;
  for (const chunk of [...chunks, ...directory, end]) {result.set(chunk, cursor); cursor += chunk.length;}
  return result;
}
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function runs(value: string, bold = false) {return value.replace(/\r\n?/g, '\n').split('\n').map((line, index) => `${index ? '<w:r><w:br/></w:r>' : ''}<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join('');}
function paragraph(value: string, style = 'Normal', keepNext = false) {return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${keepNext ? '<w:keepNext/>' : ''}</w:pPr>${runs(value)}</w:p>`;}
function numericColumn(table: DeliveryTable, column: number) {const values = table.rows.map(row => row[column]).filter(value => value.trim() && value !== '—'); return values.length > 0 && values.every(value => /^[\s<>≤≥+−\-()\d.,%eE]+$/.test(value));}
function weights(table: DeliveryTable) {return table.headers.map((header, column) => numericColumn(table, column) ? 1 : Math.min(3, Math.max(1.6, Math.sqrt(Math.max(header.length, ...table.rows.slice(0, 100).map(row => Math.min(row[column].length, 80)))) / 2)));}
function wordTable(table: DeliveryTable) {
  const proportions = weights(table), total = proportions.reduce((sum, value) => sum + value, 0), widths = proportions.map(value => Math.floor(value / total * BODY_TWIPS)); widths[widths.length - 1] += BODY_TWIPS - widths.reduce((sum, value) => sum + value, 0);
  const row = (values: string[], header: boolean) => `<w:tr>${header ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : ''}${values.map((value, column) => `<w:tc><w:tcPr><w:tcW w:w="${widths[column]}" w:type="dxa"/><w:vAlign w:val="center"/>${header ? '<w:shd w:val="clear" w:fill="F1F4F8"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:jc w:val="${numericColumn(table, column) ? 'right' : 'left'}"/></w:pPr>${runs(value, header)}</w:p></w:tc>`).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${BODY_TWIPS}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(edge => `<w:${edge} w:val="single" w:sz="4" w:color="D9D9D9"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${row(table.headers, true)}${table.rows.map(values => row(values, false)).join('')}</w:tbl>`;
}
function wordFigure(figure: Figure, index: number) {
  const scale = Math.min(1, BODY_TWIPS * 635 / (figure.width * 9525), 5486400 / (figure.height * 9525)), width = Math.round(figure.width * 9525 * scale), height = Math.round(figure.height * 9525 * scale);
  return `<w:p><w:pPr><w:jc w:val="center"/>${figure.note ? '<w:keepNext/>' : ''}</w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${index}" name="${xml(figure.id)}" descr="${xml(figure.title)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${index}" name="figure-${xml(figure.id)}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage${index}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}
const styles = `${declaration}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体"/><w:color w:val="000000"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="320" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="200"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="280" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Note"><w:name w:val="Research note"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160"/></w:pPr><w:rPr><w:sz w:val="18"/></w:rPr></w:style></w:styles>`;

export function buildResearchDocx(doc: DeliveryDocument): Uint8Array {
  validate(doc);
  const body = [paragraph(doc.title, 'Title', true)], figures: Figure[] = []; let tableCount = 0;
  if (doc.subtitle) body.push(paragraph(doc.subtitle, 'Subtitle'));
  for (const section of doc.sections) {
    body.push(paragraph(section.heading, 'Heading1', true));
    for (const value of section.paragraphs ?? []) body.push(paragraph(value));
    if (section.table) {body.push(paragraph(`表 ${++tableCount}  ${section.table.caption}`, 'Caption', true), wordTable(section.table)); if (section.table.note) body.push(paragraph(section.table.note, 'Note'));}
    for (const figure of section.figures ?? []) {figures.push(figure); body.push(paragraph(`图 ${figures.length}  ${figure.title}`, 'Caption', true), wordFigure(figure, figures.length)); if (figure.note) body.push(paragraph(figure.note, 'Note'));}
  }
  if (doc.bibliography?.length) {
    body.push(paragraph('参考文献', 'Heading1', true));
    for (const item of doc.bibliography) body.push(paragraph(`[${item.key}] ${[item.authors.join('; '), item.year === null ? '' : String(item.year), item.title, item.venue, item.doi ? `DOI: ${item.doi}` : '', item.url].filter(Boolean).join('. ')}`));
  }
  const document = `${declaration}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const relationshipNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships', office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const files: Array<{name: string; bytes: Uint8Array}> = [
    {name: '[Content_Types].xml', content: `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`},
    {name: '_rels/.rels', content: `${declaration}<Relationships xmlns="${relationshipNamespace}"><Relationship Id="rIdDocument" Type="${office}/officeDocument" Target="word/document.xml"/><Relationship Id="rIdCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rIdApp" Type="${office}/extended-properties" Target="docProps/app.xml"/></Relationships>`},
    {name: 'word/document.xml', content: document}, {name: 'word/styles.xml', content: styles},
    {name: 'word/_rels/document.xml.rels', content: `${declaration}<Relationships xmlns="${relationshipNamespace}"><Relationship Id="rIdStyles" Type="${office}/styles" Target="styles.xml"/>${figures.map((figure, index) => `<Relationship Id="rIdImage${index + 1}" Type="${office}/image" Target="media/figure-${figure.id}.png"/>`).join('')}</Relationships>`},
    {name: 'docProps/core.xml', content: `${declaration}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(doc.title)}</dc:title>${doc.subtitle ? `<dc:description>${xml(doc.subtitle)}</dc:description>` : ''}</cp:coreProperties>`},
    {name: 'docProps/app.xml', content: `${declaration}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Acaora research delivery</Application></Properties>`},
  ].map(file => ({name: file.name, bytes: encoder.encode(file.content)}));
  for (const figure of figures) files.push({name: `word/media/figure-${figure.id}.png`, bytes: figure.png});
  return zip(files);
}

export function buildResearchLatex(doc: DeliveryDocument): {tex: string; bib: string} {
  validate(doc);
  const lines = ['% Compile with XeLaTeX; place references.bib and figure-ID.png beside this file.', '\\documentclass[UTF8,a4paper,11pt]{ctexart}', '\\usepackage[margin=25mm]{geometry}', '\\usepackage{booktabs,longtable,array,graphicx}', '\\usepackage[hidelinks]{hyperref}', '\\setlength{\\parindent}{0pt}', '\\setlength{\\parskip}{6pt}', '\\raggedright', '\\begin{document}', `\\begin{center}\\LARGE\\bfseries ${texLine(doc.title)}\\end{center}`];
  if (doc.subtitle) lines.push(`\\begin{center}${texLine(doc.subtitle)}\\end{center}`);
  for (const section of doc.sections) {
    lines.push(`\\section{${texLine(section.heading)}}`);
    for (const value of section.paragraphs ?? []) lines.push(texFlow(value), '');
    if (section.table) {
      const table = section.table, proportions = weights(table), total = proportions.reduce((sum, value) => sum + value, 0), available = 160 - (table.headers.length - 1) * 2.811;
      const columns = proportions.map((weight, column) => `>{${numericColumn(table, column) ? '\\raggedleft' : '\\raggedright'}\\arraybackslash}p{${(available * weight / total).toFixed(2)}mm}`).join('');
      const header = `${table.headers.map(texLine).join(' & ')} \\\\`;
      lines.push('\\begingroup', '\\small', '\\setlength{\\tabcolsep}{4pt}', `\\begin{longtable}{@{}${columns}@{}}`, `\\caption{${texLine(table.caption)}}\\\\`, '\\toprule', header, '\\midrule', '\\endfirsthead', '\\toprule', header, '\\midrule', '\\endhead', '\\bottomrule', '\\endfoot', ...table.rows.map(row => `${row.map(texLine).join(' & ')} \\\\`), '\\end{longtable}', '\\endgroup');
      if (table.note) lines.push(`{\\small ${tex(table.note).replace(/\n/g, '\\newline{}')}}`, '');
    }
    for (const figure of section.figures ?? []) lines.push('\\begin{figure}[htbp]', '\\centering', `\\includegraphics[width=\\linewidth,height=.72\\textheight,keepaspectratio]{figure-${figure.id}.png}`, `\\caption{${texLine(figure.title)}}`, `\\label{fig:${figure.id}}`, ...(figure.note ? [`\\par\\small ${tex(figure.note).replace(/\n/g, '\\newline{}')}`] : []), '\\end{figure}');
  }
  const bibliography = (doc.bibliography ?? []).map(item => {
    const fields = [`  title = {${texLine(item.title)}}`];
    if (item.authors.length) fields.push(`  author = {${item.authors.map(author => `{${texLine(author)}}`).join(' and ')}}`);
    if (item.year !== null) fields.push(`  year = {${item.year}}`);
    if (item.venue) fields.push(`  howpublished = {${texLine(item.venue)}}`);
    if (item.doi) fields.push(`  doi = {${texLine(item.doi)}}`);
    const notes = [...(item.doi ? [`DOI: ${texLine(item.doi)}`] : []), ...(item.url ? [`\\url{${bibliographyUrl(item.url)}}`] : [])];
    if (notes.length) fields.push(`  note = {${notes.join('; ')}}`);
    return `@misc{${item.key},\n${fields.join(',\n')}\n}`;
  }).join('\n\n');
  if (doc.bibliography?.length) lines.push('\\clearpage', '\\bibliographystyle{plain}', `\\nocite{${doc.bibliography.map(item => item.key).join(',')}}`, '\\bibliography{references}');
  lines.push('\\end{document}', '');
  return {tex: lines.join('\n'), bib: bibliography ? `${bibliography}\n` : ''};
}

export function buildResearchLatexArchive(doc: DeliveryDocument):Uint8Array {
 const {tex,bib}=buildResearchLatex(doc);
 return zip([{name:'main.tex',bytes:encoder.encode(tex)},{name:'references.bib',bytes:encoder.encode(bib)},...doc.sections.flatMap(section=>(section.figures??[]).map(figure=>({name:`figure-${figure.id}.png`,bytes:figure.png})))]);
}
