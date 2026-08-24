import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const chromium = process.env.CHROMIUM || '/usr/bin/chromium';
const debugPort = Number(process.env.LITHE_BENCH_PORT || 9444);

async function waitJSON(url: string, timeout = 8000): Promise<any> {
  const end = Date.now() + timeout;
  let last: unknown;
  while (Date.now() < end) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      last = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw last || new Error(`Timed out waiting for ${url}`);
}

function connectCDP(url: string) {
  const ws = new WebSocket(url), pending = new Map<number, any>();
  let seq = 0;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  });
  return {
    ready,
    send(method: string, params: Record<string, unknown> = {}) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { ws.close(); }
  };
}

const html = `<!doctype html><meta charset="utf-8"><div id="app"></div><script>
const ADJ=['pretty','large','big','small','tall','short','long','plain'];
const COLORS=['red','yellow','blue','green','pink','white','black'];
const NOUNS=['table','chair','house','desk','car','keyboard'];
function data(n){return Array.from({length:n},(_,i)=>({id:i+1,label:ADJ[i%ADJ.length]+' '+COLORS[i%COLORS.length]+' '+NOUNS[i%NOUNS.length]}));}
function row(r){const tr=document.createElement('tr');tr.dataset.id=r.id;tr.innerHTML='<td>'+r.id+'</td><td><a>'+r.label+'</a></td><td><span>x</span></td>';return tr;}
function measure(name,fn,iters=20){for(let i=0;i<3;i++)fn();const t=performance.now();for(let i=0;i<iters;i++)fn();return {name,ms:Number((performance.now()-t).toFixed(3)),iters};}
const app=document.getElementById('app');
const out=[];
out.push(measure('vanilla-create-1000',()=>{app.textContent='';const table=document.createElement('table'),tbody=document.createElement('tbody');for(const r of data(1000))tbody.appendChild(row(r));table.appendChild(tbody);app.appendChild(table);},5));
let rows=data(1000);app.textContent='';const table=document.createElement('table'),tbody=document.createElement('tbody');for(const r of rows)tbody.appendChild(row(r));table.appendChild(tbody);app.appendChild(table);
out.push(measure('vanilla-update-every-10th',()=>{for(let i=0;i<rows.length;i+=10){rows[i].label+=' !';tbody.children[i].children[1].firstChild.textContent=rows[i].label;}},50));
out.push(measure('vanilla-swap-two',()=>{const a=tbody.children[4],b=tbody.children[992],after=b.nextSibling;tbody.insertBefore(b,a);tbody.insertBefore(a,after);},50));
globalThis.__BENCH_RESULTS__={browser:navigator.userAgent,results:out};
</script>`;

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lithe-browser-bench-'));
  const file = path.join(dir, 'index.html');
  await fs.writeFile(file, html);
  const profile = path.join(dir, 'profile');
  const browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, `file://${file}`], { stdio: 'ignore' });
  try {
    const version = await waitJSON(`http://127.0.0.1:${debugPort}/json/version`);
    const cdp = connectCDP(version.webSocketDebuggerUrl);
    await cdp.ready;
    const pages = await waitJSON(`http://127.0.0.1:${debugPort}/json/list`);
    const page = connectCDP(pages[0].webSocketDebuggerUrl);
    await page.ready;
    const result = await page.send('Runtime.evaluate', { expression: 'globalThis.__BENCH_RESULTS__', returnByValue: true });
    console.log(JSON.stringify({ at: new Date().toISOString(), ...result.result.value }, null, 2));
    page.close();
    cdp.close();
  } finally {
    browser.kill('SIGKILL');
    await fs.rm(dir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
