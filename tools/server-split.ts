import crypto from 'node:crypto';
import path from 'node:path';

export function serverModuleId(relativePath){return crypto.createHash('sha256').update(relativePath.replace(/\\/g,'/')).digest('hex').slice(0,16);}
export function isServerSpecifier(spec){return /(?:^|\/)\.?[^/]*\.server(?:\.(?:js|jsx|ts|tsx))?$/.test(spec)||/\.server\//.test(spec);}
export function splitServerImports(code,file,sourceRoot){
  const refs=[];let needsHelper=false;
  code=code.replace(/import\s*\{([^}]+)\}\s*from\s*(['"])(\.[^'"]*\.server(?:\.(?:js|jsx|ts|tsx))?)\2\s*;?/g,(full,body,q,spec)=>{
    const abs=path.resolve(path.dirname(file),spec),rel=path.relative(sourceRoot,abs).replace(/\\/g,'/').replace(/\.(?:jsx|tsx|ts)$/i,'.js');const id=serverModuleId(rel),lines=[];
    for(const part of body.split(',').map(x=>x.trim()).filter(Boolean)){const m=part.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);if(!m)throw new Error(`Unsupported server import binding: ${part}`);const exported=m[1],local=m[2]||exported;lines.push(`const ${local}=__litheServerReference(${JSON.stringify(id)},${JSON.stringify(exported)});`);refs.push({id,module:rel,exportName:exported,local});}
    needsHelper=true;return lines.join('\n');
  });
  code=code.replace(/import\s+([A-Za-z_$][\w$]*)\s+from\s*(['"])(\.[^'"]*\.server(?:\.(?:js|jsx|ts|tsx))?)\2\s*;?/g,(full,local,q,spec)=>{const abs=path.resolve(path.dirname(file),spec),rel=path.relative(sourceRoot,abs).replace(/\\/g,'/').replace(/\.(?:jsx|tsx|ts)$/i,'.js'),id=serverModuleId(rel);refs.push({id,module:rel,exportName:'default',local});needsHelper=true;return`const ${local}=__litheServerReference(${JSON.stringify(id)},"default");`;});
  if(needsHelper)code=`import { serverReference as __litheServerReference } from '@lithe/rpc';\n${code}`;
  return{code,refs};
}
