/** Minimal ZIP/STORE writer: UTF-8 filenames, CRC32, no compression or executable code. */
export function zipFiles(files:Array<{name:string;content:string}>){
  const encoder=new TextEncoder(),chunks:Uint8Array[]=[],directory:Uint8Array[]=[];let offset=0;
  const crc=(bytes:Uint8Array)=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let j=0;j<8;j++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;};
  if(files.length>100)throw new Error('复现包文件过多。');
  for(const file of files){if(!/^[a-zA-Z0-9_.-]+$/.test(file.name))throw new Error('复现包文件名无效。');const name=encoder.encode(file.name),body=encoder.encode(file.content),checksum=crc(body),header=new Uint8Array(30+name.length),view=new DataView(header.buffer);view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint32(14,checksum,true);view.setUint32(18,body.length,true);view.setUint32(22,body.length,true);view.setUint16(26,name.length,true);header.set(name,30);chunks.push(header,body);
    const central=new Uint8Array(46+name.length),dv=new DataView(central.buffer);dv.setUint32(0,0x02014b50,true);dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint16(8,0x800,true);dv.setUint32(16,checksum,true);dv.setUint32(20,body.length,true);dv.setUint32(24,body.length,true);dv.setUint16(28,name.length,true);dv.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=header.length+body.length;
  }
  const length=directory.reduce((s,b)=>s+b.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);dv.setUint32(0,0x06054b50,true);dv.setUint16(8,files.length,true);dv.setUint16(10,files.length,true);dv.setUint32(12,length,true);dv.setUint32(16,offset,true);const result=new Uint8Array(offset+length+22);let cursor=0;for(const b of [...chunks,...directory,end]){result.set(b,cursor);cursor+=b.length;}return result;
}
