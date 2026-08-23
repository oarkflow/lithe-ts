import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { exists, ensureDir } from './shared.ts';

export type PrerenderRoute = string;
export type PrerenderConfig = {
  routes: PrerenderRoute[] | (() => PrerenderRoute[] | Promise<PrerenderRoute[]>);
  render: (route:PrerenderRoute) => string | Response | Promise<string | Response>;
};
export type PrerenderOptions = { config?:string; outDir?:string };

function outputPath(out:string,route:PrerenderRoute){
  const clean=String(route||'/').split(/[?#]/)[0];
  if(clean==='/'||clean==='')return path.join(out,'index.html');
  return path.join(out,clean.replace(/^\/+|\/+$/g,''),'index.html');
}

async function resolveConfig(root:string,requested?:string){
  if(requested){
    const explicit=path.resolve(root,requested);
    if(await exists(explicit))return explicit;
    throw new Error(`Prerender config not found: ${explicit}.`);
  }
  for(const candidate of ['prerender.ts','prerender.mts','prerender.mjs']){
    const file=path.resolve(root,candidate);
    if(await exists(file))return file;
  }
  throw new Error(`Prerender config not found in ${root}. Create prerender.ts exporting { routes, render }.`);
}

export async function prerenderProject(projectDir:string,options:PrerenderOptions={}){
  const root=path.resolve(projectDir);
  const config=await resolveConfig(root,options.config);
  const mod=await import(`${pathToFileURL(config).href}?t=${Date.now()}`) as Partial<PrerenderConfig>;
  const routes=typeof mod.routes==='function'?await mod.routes():mod.routes;
  if(!Array.isArray(routes))throw new Error(`${path.basename(config)} must export routes as an array or async function.`);
  if(typeof mod.render!=='function')throw new Error(`${path.basename(config)} must export render(route) function.`);
  const out=path.resolve(root,options.outDir||'dist');
  const written:Array<{route:string;file:string}>=[];
  for(const route of routes){
    const value=await mod.render(route);
    const html=value instanceof Response?await value.text():String(value??'');
    const dest=outputPath(out,route);
    await ensureDir(dest);
    await fs.writeFile(dest,html);
    written.push({route:String(route),file:path.relative(out,dest)});
  }
  const manifest=path.join(out,'lithe-prerender.json');
  await fs.writeFile(manifest,JSON.stringify({generatedAt:new Date().toISOString(),routes:written},null,2));
  return{out,routes:written,manifest};
}
