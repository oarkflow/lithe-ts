import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { walk, formatBytes } from './shared.ts';

export async function analyzeProject(projectDir){
  const root=path.resolve(projectDir); const target=await fs.stat(path.join(root,'dist')).then(()=>path.join(root,'dist')).catch(()=>path.join(root,'src'));
  const files=(await walk(target)).filter(f=>/\.(js|css|html)$/.test(f)); const rows=[]; let total=0,gzip=0;
  for(const file of files){ const data=await fs.readFile(file); const gz=zlib.gzipSync(data); rows.push({file:path.relative(target,file),size:formatBytes(data.length),gzip:formatBytes(gz.length),bytes:data.length,gzipBytes:gz.length}); total+=data.length; gzip+=gz.length; }
  rows.sort((a,b)=>b.gzipBytes-a.gzipBytes); return {target,files:rows,total,gzip};
}

