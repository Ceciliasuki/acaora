// Controlled original, not a published research paper. Exact visible lines are
// checked against the imported text; two pages repeat only their margin labels.
export function columnPdf(pageCount=2){
 const streams=Array.from({length:pageCount},(_,index)=>index+1).map(page=>{
  const lines:[number,number,number,string][]=[
   [8,40,780,'Controlled repeating header'],[8,490,20,String(page)],
   ...(page===1?[[18,40,744,'Controlled Columns and Numeric Tables'] as [number,number,number,string]]:[]),
   [12,40,700,'2 Methods'],
   ...[0,1,2].map(i=>[9,40,650-i*16,`Left line ${page}-${i} describes the study and its source evidence.`] as [number,number,number,string]),
   ...[0,1,2].map(i=>[9,540,650-i*16,`Right line ${page}-${i} reports the results and the uncertainty.`] as [number,number,number,string]),
   [9,40,540,'100 200 300'],[9,540,540,'400 500 600'],
   [9,40,510,'The coefficient is -0.5 and the real term well-being remains unchanged.'],
  ];
  return lines.map(([size,x,y,text])=>`BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`).join('\n');
 });
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${streams.map((_,i)=>`${3+i*2} 0 R`).join(' ')}] /Count ${pageCount} >>`];
 streams.forEach((stream,i)=>{objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 792] /Resources << /Font << /F1 ${3+pageCount*2} 0 R >> >> /Contents ${4+i*2} 0 R >>`,`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);});
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 let body='%PDF-1.4\n';const offsets=objects.map((object,i)=>{const offset=Buffer.byteLength(body);body+=`${i+1} 0 obj\n${object}\nendobj\n`;return offset;});const xref=Buffer.byteLength(body);
 return Buffer.from(body+`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
