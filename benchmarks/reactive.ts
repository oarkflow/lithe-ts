import { performance } from 'node:perf_hooks';
import { signal, computed } from '../src/core/reactive.ts';
const count=100000; const values=Array.from({length:1000},(_,i)=>signal(i)); const total=computed(()=>values.reduce((s,x)=>s+x.value,0));
const start=performance.now(); for(let i=0;i<count;i++) values[i%values.length].value=i; const elapsed=performance.now()-start;
console.log(JSON.stringify({updates:count,signals:values.length,elapsedMs:Number(elapsed.toFixed(2)),updatesPerSecond:Math.round(count/(elapsed/1000)),finalTotal:total.value},null,2));
