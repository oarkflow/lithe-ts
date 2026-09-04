export const routes:string[]=['/','/about'];

function page(title:string,body:string):string{
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/app.css"></head><body><div id="app">${body}</div><script type="module" src="/src/index.tsx"></script></body></html>`;
}

export function render(route:string):string{
  if(route==='/about')return page('About · Lithe','<main><h1>About</h1><p>This page is prerendered from a TypeScript configuration.</p><a href="/">Back</a></main>');
  return page('Lithe TypeScript Demo','<main><h1>Lithe TypeScript</h1><p>Loading fine-grained application…</p></main>');
}
