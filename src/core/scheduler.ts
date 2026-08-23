export type Priority = 'sync'|'userBlocking'|'normal'|'transition'|'background'|'idle';
type Task = () => unknown;

const queues:Record<Priority,Task[]> = {
  sync: [],
  userBlocking: [],
  normal: [],
  transition: [],
  background: [],
  idle: []
};

let pending = false;
let flushing = false;

const enqueueMicrotask:(fn:()=>void)=>void = globalThis.queueMicrotask
  ? queueMicrotask.bind(globalThis)
  : (fn) => { void Promise.resolve().then(fn); };

function runQueue(name:Priority):void {
  const queue = queues[name];
  while (queue.length) {
    const task = queue.shift()!;
    try { task(); } catch (error) { enqueueMicrotask(() => { throw error; }); }
  }
}

function flush():void {
  if (flushing) return;
  flushing = true;
  pending = false;
  try {
    runQueue('sync');
    runQueue('userBlocking');
    runQueue('normal');
    runQueue('transition');
    runQueue('background');
    if (queues.idle.length) {
      const runIdle = () => runQueue('idle');
      if (typeof requestIdleCallback === 'function') requestIdleCallback(runIdle);
      else setTimeout(runIdle, 0);
    }
  } finally {
    flushing = false;
    if (Object.values(queues).some((q) => q.length)) requestFlush();
  }
}

function requestFlush():void {
  if (pending) return;
  pending = true;
  enqueueMicrotask(flush);
}

export function schedule(task:Task, priority:Priority = 'normal'):()=>void {
  if (!queues[priority]) priority = 'normal';
  queues[priority].push(task);
  requestFlush();
  return () => {
    const q = queues[priority];
    const i = q.indexOf(task);
    if (i >= 0) q.splice(i, 1);
  };
}

export function flushSync(task?:()=>unknown):void {
  if (task) task();
  runQueue('sync');
  runQueue('userBlocking');
  runQueue('normal');
}

export function transition<T>(task:()=>T|Promise<T>):Promise<T> {
  return new Promise<T>((resolve, reject) => {
    schedule(async () => {
      try { resolve(await task()); } catch (error) { reject(error); }
    }, 'transition');
  });
}

export const scheduler = Object.freeze({
  sync: (fn:Task) => schedule(fn, 'sync'),
  userBlocking: (fn:Task) => schedule(fn, 'userBlocking'),
  normal: (fn:Task) => schedule(fn, 'normal'),
  transition: (fn:Task) => schedule(fn, 'transition'),
  background: (fn:Task) => schedule(fn, 'background'),
  idle: (fn:Task) => schedule(fn, 'idle')
});
