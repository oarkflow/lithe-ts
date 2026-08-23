import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import fs from 'node:fs/promises';
function hash(text){return crypto.createHash('sha256').update(text).digest('hex').slice(0,8);}
function kebab(k){return k.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`);}function unit(k,v){return typeof v==='number'&&!/^(opacity|zIndex|flex|fontWeight|lineHeight|order)$/.test(k)?`${v}px`:String(v);}
function declarations(obj){return Object.entries(obj||{}).filter(([,v])=>v!=null&&typeof v!=='object').map(([k,v])=>`${kebab(k)}:${unit(k,v)}`).join(';');}
function rulesToCSS(name,rules){const sel=`.${name}`;let text=`${sel}{${declarations(rules)}}`;for(const[k,v]of Object.entries(rules||{})){if(!v||typeof v!=='object')continue;if(k.startsWith('@media')||k.startsWith('@supports'))text+=`${k}{${sel}{${declarations(v)}}}`;else if(k.startsWith('&'))text+=`${k.replaceAll('&',sel)}{${declarations(v)}}`;else text+=`${sel} ${k}{${declarations(v)}}`;}return text;}
function balanced(code,start){let depth=0;for(let i=start;i<code.length;i++){const c=code[i];if(c==='"'||c==="'"||c==='`'){const q=c;i++;for(;i<code.length;i++){if(code[i]==='\\'){i++;continue;}if(code[i]===q)break;}continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return i+1;}return-1;}
// BUG-4: Use a fully frozen, sealed sandbox context to prevent prototype pollution via vm eval.
const FROZEN_SANDBOX = Object.freeze(Object.create(null));
export function extractStaticCSS(code,file='module.js'){
  const chunks=[];let offset=0,out='';const re=/\bcss\s*\(\s*\{/g;let m;
  while((m=re.exec(code))){const brace=code.indexOf('{',m.index),end=balanced(code,brace);if(end<0)break;let close=end;while(/\s/.test(code[close]))close++;if(code[close]!==')'){continue;}const literal=code.slice(brace,end);let rules;try{rules=vm.runInNewContext(`(${literal})`,FROZEN_SANDBOX,{timeout:50});}catch{continue;}const className=`l_${hash(file+literal)}`;out+=code.slice(offset,m.index)+JSON.stringify(className);offset=close+1;chunks.push(rulesToCSS(className,rules));re.lastIndex=offset;}
  return{code:out+code.slice(offset),css:chunks.join('\n'),changed:chunks.length>0};
}

function themeCSS(tokens,selector=':root'){const lines=[];const walk=(obj,prefix=[])=>{for(const[k,v]of Object.entries(obj||{})){if(v&&typeof v==='object'&&!Array.isArray(v))walk(v,[...prefix,k]);else lines.push(`--${[...prefix,k].join('-')}:${v}`);}};walk(tokens);return`${selector}{${lines.join(';')}}`;}
export function extractStaticThemes(code){
  const chunks=[];let offset=0,out='';const re=/(^|[;\n]\s*)defineTheme\s*\(\s*\{/gm;let m;
  while((m=re.exec(code))){const callStart=m.index+m[1].length;const brace=code.indexOf('{',callStart),end=balanced(code,brace);if(end<0)break;let pos=end;while(/\s/.test(code[pos]))pos++;let options={};if(code[pos]===','){pos++;while(/\s/.test(code[pos]))pos++;if(code[pos]!=='{')continue;const oe=balanced(code,pos);if(oe<0)continue;
    // BUG-4: Use frozen sandbox for options eval too
    try{options=vm.runInNewContext(`(${code.slice(pos,oe)})`,FROZEN_SANDBOX,{timeout:50});}catch{continue;}pos=oe;while(/\s/.test(code[pos]))pos++;}
    if(code[pos]!==')')continue;let finish=pos+1;while(/\s/.test(code[finish]))finish++;if(code[finish]===';')finish++;let tokens;
    // BUG-4: Use frozen sandbox for token eval too
    try{tokens=vm.runInNewContext(`(${code.slice(brace,end)})`,FROZEN_SANDBOX,{timeout:50});}catch{continue;}out+=code.slice(offset,callStart)+'void 0;';offset=finish;chunks.push(themeCSS(tokens,options.selector||':root'));re.lastIndex=offset;
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

// BUG-5: Fix removeUnusedNamedImports — escape the full import statement as a literal string
// when building the "rest" code for reference checking, to avoid regex-special chars in spec paths.
export function removeUnusedNamedImports(code){
  return code.replace(/import\s*\{([^}]+)\}\s*from\s*(['"][^'"]+['"])\s*;?/g,(full,body,spec)=>{
    const keep=body.split(',').map(x=>x.trim()).filter(Boolean).filter(part=>{
      const local=(part.split(/\s+as\s+/)[1]||part.split(/\s+as\s+/)[0]).trim();
      // Use indexOf + slice instead of String.replace to avoid regex-special chars in `full`
      const idx=code.indexOf(full);
      const rest=idx>=0?code.slice(0,idx)+code.slice(idx+full.length):code;
      return new RegExp(`\\b${local}\\b`).test(rest);
    });
    return keep.length?`import { ${keep.join(', ')} } from ${spec};`:'';
  });
}

// FEAT-1: Collect all CSS class name strings referenced in compiled JS output.
// Only collects names matching the extracted-CSS pattern (l_<hash>) and CSS module patterns (name_<hash6>).
// Plain CSS imports are not tree-shaken (they may contain global resets/keyframes).
export function collectCSSClassNames(jsFiles: Map<string,string>): Set<string> {
  const used = new Set<string>();
  // Match string literals containing class names: "l_abc12345", 'name_ab12cd', etc.
  // This covers both: JSON.stringify'd class names from extractStaticCSS and CSS module mappings.
  const re = /["']([A-Za-z_][\w-]*(?:_[A-Za-z0-9]{6,8})?)["']/g;
  for (const code of jsFiles.values()) {
    let m: RegExpExecArray|null;
    re.lastIndex = 0;
    while ((m = re.exec(code))) used.add(m[1]);
  }
  return used;
}

// FEAT-1: Remove CSS rule blocks whose class selector is not in the usedClasses set.
// Only removes rules for classes following the extracted-CSS naming pattern (l_<hash> or name_<hash6>).
// At-rules (@media, @supports, @keyframes) that contain no class selectors are preserved.
// Plain rules (e.g. :root, *, body, element selectors) are always preserved.
export function treeShakeCSS(cssText: string, usedClasses: Set<string>): { css: string; removed: string[] } {
  const removed: string[] = [];
  // Regex for extracted class names: l_<8hex> or <name>_<6alphanum>
  const isExtractedClass = (name: string) => /^l_[0-9a-f]{8}$/.test(name) || /^[A-Za-z][\w-]*_[A-Za-z0-9]{6}$/.test(name);

  // Split CSS into top-level blocks by tracking brace depth.
  // We preserve whitespace/comments between blocks.
  const blocks: string[] = [];
  let i = 0, blockStart = 0;
  while (i < cssText.length) {
    // Skip strings
    if (cssText[i] === '"' || cssText[i] === "'") {
      const q = cssText[i++];
      while (i < cssText.length && cssText[i] !== q) { if (cssText[i] === '\\') i++; i++; }
      i++; continue;
    }
    // Skip comments
    if (cssText[i] === '/' && cssText[i+1] === '*') {
      i += 2; while (i < cssText.length && !(cssText[i] === '*' && cssText[i+1] === '/')) i++; i += 2; continue;
    }
    if (cssText[i] === '{') {
      // Find matching closing brace
      let depth = 1; i++;
      while (i < cssText.length && depth > 0) {
        if (cssText[i] === '"' || cssText[i] === "'") { const q = cssText[i++]; while (i < cssText.length && cssText[i] !== q) { if (cssText[i] === '\\') i++; i++; } i++; continue; }
        if (cssText[i] === '/' && cssText[i+1] === '*') { i+=2; while (i<cssText.length&&!(cssText[i]==='*'&&cssText[i+1]==='/'))i++; i+=2; continue; }
        if (cssText[i] === '{') depth++;
        else if (cssText[i] === '}') depth--;
        i++;
      }
      blocks.push(cssText.slice(blockStart, i));
      blockStart = i;
    } else {
      i++;
    }
  }
  // Capture trailing whitespace/text after last block
  if (blockStart < cssText.length) blocks.push(cssText.slice(blockStart));

  const kept: string[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) { kept.push(block); continue; }

    // Extract the selector (text before the first `{`)
    const braceIdx = trimmed.indexOf('{');
    if (braceIdx < 0) { kept.push(block); continue; }

    const selector = trimmed.slice(0, braceIdx).trim();

    // Check if this is a simple class rule for an extracted class: `.l_abc12345 { ... }`
    // or a nested rule inside @media: detect by selector starting with '.'
    const classMatch = selector.match(/^\.([\w-]+)(?:\s|$|,|\{)/);
    if (classMatch) {
      const className = classMatch[1];
      if (isExtractedClass(className)) {
        if (!usedClasses.has(className)) {
          removed.push(className);
          continue; // drop this block
        }
      }
    }

    // For @media / @supports blocks, recursively filter inner rules
    if (selector.startsWith('@media') || selector.startsWith('@supports')) {
      const innerStart = trimmed.indexOf('{') + 1;
      const innerEnd = trimmed.lastIndexOf('}');
      if (innerStart > 0 && innerEnd > innerStart) {
        const inner = trimmed.slice(innerStart, innerEnd);
        const { css: shakenInner, removed: innerRemoved } = treeShakeCSS(inner, usedClasses);
        removed.push(...innerRemoved);
        const outer = trimmed.slice(0, innerStart) + shakenInner + '}';
        // If the @media block is now empty, drop it
        if (shakenInner.trim()) {
          kept.push(block.startsWith('\n') ? '\n' + outer : outer);
        }
        continue;
      }
    }

    kept.push(block);
  }

  return { css: kept.join(''), removed };
}
