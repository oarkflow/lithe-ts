import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import fs from 'node:fs/promises';
function hash(text){return crypto.createHash('sha256').update(text).digest('hex').slice(0,8);}
function kebab(k){return k.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`);}function unit(k,v){return typeof v==='number'&&!/^(opacity|zIndex|flex|fontWeight|lineHeight|order)$/.test(k)?`${v}px`:String(v);}
function declarations(obj){return Object.entries(obj||{}).filter(([,v])=>v!=null&&typeof v!=='object').map(([k,v])=>`${kebab(k)}:${unit(k,v)}`).join(';');}
function rulesToCSS(name,rules){const sel=`.${name}`;let text=`${sel}{${declarations(rules)}}`;for(const[k,v]of Object.entries(rules||{})){if(!v||typeof v!=='object')continue;if(k.startsWith('@media')||k.startsWith('@supports'))text+=`${k}{${sel}{${declarations(v)}}}`;else if(k.startsWith('&'))text+=`${k.replaceAll('&',sel)}{${declarations(v)}}`;else text+=`${sel} ${k}{${declarations(v)}}`;}return text;}
function balanced(code,start){let depth=0;for(let i=start;i<code.length;i++){const c=code[i];if(c==='"'||c==="'"||c==='`'){const q=c;i++;for(;i<code.length;i++){if(code[i]==='\\'){i++;continue;}if(code[i]===q)break;}continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return i+1;}return-1;}
export function extractStaticCSS(code,file='module.js'){
  const chunks=[];let offset=0,out='';const re=/\bcss\s*\(\s*\{/g;let m;
  while((m=re.exec(code))){const brace=code.indexOf('{',m.index),end=balanced(code,brace);if(end<0)break;let close=end;while(/\s/.test(code[close]))close++;if(code[close]!==')'){continue;}const literal=code.slice(brace,end);let rules;try{rules=vm.runInNewContext(`(${literal})`,Object.create(null),{timeout:50});}catch{continue;}const className=`l_${hash(file+literal)}`;out+=code.slice(offset,m.index)+JSON.stringify(className);offset=close+1;chunks.push(rulesToCSS(className,rules));re.lastIndex=offset;}
  return{code:out+code.slice(offset),css:chunks.join('\n'),changed:chunks.length>0};
}

function themeCSS(tokens,selector=':root'){const lines=[];const walk=(obj,prefix=[])=>{for(const[k,v]of Object.entries(obj||{})){if(v&&typeof v==='object'&&!Array.isArray(v))walk(v,[...prefix,k]);else lines.push(`--${[...prefix,k].join('-')}:${v}`);}};walk(tokens);return`${selector}{${lines.join(';')}}`;}
export function extractStaticThemes(code){
  const chunks=[];let offset=0,out='';const re=/(^|[;\n]\s*)defineTheme\s*\(\s*\{/gm;let m;
  while((m=re.exec(code))){const callStart=m.index+m[1].length;const brace=code.indexOf('{',callStart),end=balanced(code,brace);if(end<0)break;let pos=end;while(/\s/.test(code[pos]))pos++;let options={};if(code[pos]===','){pos++;while(/\s/.test(code[pos]))pos++;if(code[pos]!=='{')continue;const oe=balanced(code,pos);if(oe<0)continue;try{options=vm.runInNewContext(`(${code.slice(pos,oe)})`,Object.create(null),{timeout:50});}catch{continue;}pos=oe;while(/\s/.test(code[pos]))pos++;}
    if(code[pos]!==')')continue;let finish=pos+1;while(/\s/.test(code[finish]))finish++;if(code[finish]===';')finish++;let tokens;try{tokens=vm.runInNewContext(`(${code.slice(brace,end)})`,Object.create(null),{timeout:50});}catch{continue;}out+=code.slice(offset,callStart)+'void 0;';offset=finish;chunks.push(themeCSS(tokens,options.selector||':root'));re.lastIndex=offset;
  }
  return{code:out+code.slice(offset),css:chunks.join('\n'),changed:chunks.length>0};
}
export function transformCSSModule(css,identity){const mapping={};let out=css.replace(/\.([A-Za-z_-][\w-]*)/g,(m,name)=>{mapping[name]||=`${name}_${hash(identity+name).slice(0,6)}`;return`.${mapping[name]}`;});return{css:out,mapping};}
export function transformScopedCSS(css,identity){const scope=`s_${hash(identity).slice(0,7)}`;const out=css.split('}').map(block=>{const i=block.indexOf('{');if(i<0)return block;const selector=block.slice(0,i).trim();if(!selector||selector.startsWith('@'))return block;return`:where([data-lithe-scope="${scope}"]) ${selector}{${block.slice(i+1)}`;}).join('}');return{css:out,scope};}
export async function processCSSImports(code,sourceFile,root,collector){
  const dir=path.dirname(sourceFile);
  code=code.replace(/import\s+([A-Za-z_$][\w$]*)\s+from\s+(['"])(\.\/?[^'"]+\.module\.css)\2\s*;?/g,(full,local,q,spec)=>{collector.jobs.push(async()=>{const abs=path.resolve(dir,spec),css=await fs.readFile(abs,'utf8'),r=transformCSSModule(css,path.relative(root,abs));collector.css.push(r.css);collector.replacements.set(`${sourceFile}:${full}`,`const ${local} = ${JSON.stringify(r.mapping)};`);});return`/*__LITHE_CSS_JOB__${collector.jobs.length-1}__*/${full}`;});
  code=code.replace(/import\s+([A-Za-z_$][\w$]*)\s+from\s+(['"])(\.\/?[^'"]+\.scoped\.css)\2\s*;?/g,(full,local,q,spec)=>{collector.jobs.push(async()=>{const abs=path.resolve(dir,spec),css=await fs.readFile(abs,'utf8'),r=transformScopedCSS(css,path.relative(root,abs));collector.css.push(r.css);collector.replacements.set(`${sourceFile}:${full}`,`const ${local} = ${JSON.stringify({scope:r.scope,attr:{'data-lithe-scope':r.scope}})};`);});return`/*__LITHE_CSS_JOB__${collector.jobs.length-1}__*/${full}`;});
  code=code.replace(/import\s+(['"])(\.\/?[^'"]+\.css)\1\s*;?/g,(full,q,spec)=>{collector.jobs.push(async()=>{const abs=path.resolve(dir,spec),css=await fs.readFile(abs,'utf8');collector.css.push(css);collector.replacements.set(`${sourceFile}:${full}`,'');});return`/*__LITHE_CSS_JOB__${collector.jobs.length-1}__*/${full}`;});
  return code;
}
export function removeUnusedNamedImports(code){return code.replace(/import\s*\{([^}]+)\}\s*from\s*(['"][^'"]+['"]);?/g,(full,body,spec)=>{const keep=body.split(',').map(x=>x.trim()).filter(Boolean).filter(part=>{const local=(part.split(/\s+as\s+/)[1]||part.split(/\s+as\s+/)[0]).trim();const rest=code.replace(full,'');return new RegExp(`\\b${local}\\b`).test(rest);});return keep.length?`import { ${keep.join(', ')} } from ${spec};`:'';});}
