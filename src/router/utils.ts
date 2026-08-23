function normalizePath(pathname=''){const value=String(pathname||'').replace(/\/+/g,'/');if(!value)return'/';return(value.startsWith('/')?'':'/')+value.replace(/\/$/,'')||'/';}
function joinPath(parent,child){if(!child)return normalizePath(parent||'/');if(child.startsWith('/'))return normalizePath(child);return normalizePath(`${parent==='/'?'':parent}/${child}`);}
function compilePattern(pattern){const keys=[];const escaped=normalizePath(pattern).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/:([A-Za-z_$][\w$]*)/g,(_,key)=>{keys.push(key);return'([^/]+)';}).replace(/\\\*([A-Za-z_$][\w$]*)/g,(_,key)=>{keys.push(key);return'(.*)';});return{regex:new RegExp(`^${escaped==='/'?'/?':escaped+'/?'}$`),keys};}
function flattenRoutes(routes,parentPath='/',chain=[],out=[]){for(const route of routes||[]){const fullPath=joinPath(parentPath,route.path??''),next=[...chain,route];if(route.component||route.index||!route.children?.length)out.push({route,chain:next,fullPath,_compiled:compilePattern(fullPath)});if(route.children?.length)flattenRoutes(route.children,fullPath,next,out);}return out;}
export function Outlet(props){return props.outlet??props.children??null;}
export function defineRoutes(routes){return routes;}
export function routePath(route,params={}){return normalizePath(route.replace(/:([A-Za-z_$][\w$]*)/g,(_,k)=>{if(params[k]==null)throw new Error(`Missing route param ${k}`);return encodeURIComponent(params[k]);}));}
export function routeManifest(routes){return flattenRoutes(routes).map(x=>({path:x.fullPath,params:x._compiled.keys,chain:x.chain.map(r=>r.name||r.path||'index'),outlets:Object.keys(x.route.outlets||{})}));}

export function sharedTransition(id){return{viewTransitionName:String(id).replace(/[^A-Za-z0-9_-]/g,'-')};}
