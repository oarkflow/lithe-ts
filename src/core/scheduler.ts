export type Priority = 'sync' | 'userBlocking' | 'normal' | 'transition' | 'background' | 'idle';
type Task = () => unknown;
// Scheduled tasks are boxed so cancellation can tombstone a slot in O(1)
// (`slot.task = null`) instead of an O(n) indexOf+splice into a possibly-large
// pending queue, and so draining a full queue (runQueue) can walk the array
// once with a read index instead of Array.prototype.shift()'s per-call
// re-indexing — shift() made draining N pending tasks in one flush O(n^2).
type Slot = { task: Task | null };
const queues: Record<Priority, Slot[]> = {
    sync: [],
    userBlocking: [],
    normal: [],
    transition: [],
    background: [],
    idle: []
};
let pending = false;
let flushing = false;
const enqueueMicrotask: (fn: () => void) => void = globalThis.queueMicrotask ? queueMicrotask.bind(globalThis) : fn => {
    void Promise.resolve().then(fn);
};
function runQueue(name: Priority): void {
    const queue = queues[name];
    let i = 0;
    // The loop condition rereads queue.length on every iteration, so tasks
    // scheduled into this same queue by a task that's currently running are
    // still picked up within this drain (matching the old shift()-based
    // behavior) without needing to re-scan from the front each time.
    while (i < queue.length) {
        const slot = queue[i++];
        const task = slot.task;
        if (!task) continue; // cancelled after being queued
        try {
            task();
        } catch (error) {
            enqueueMicrotask(() => {
                throw error;
            });
        }
    }
    queue.length = 0;
}
function flush(): void {
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
            if (typeof requestIdleCallback === 'function') requestIdleCallback(runIdle); else setTimeout(runIdle, 0);
        }
    } finally {
        flushing = false;
        if (Object.values(queues).some(q => q.length)) requestFlush();
    }
}
function requestFlush(): void {
    if (pending) return;
    pending = true;
    enqueueMicrotask(flush);
}
export function schedule(task: Task, priority: Priority = 'normal'): () => void {
    if (!queues[priority]) priority = 'normal';
    const slot: Slot = { task };
    queues[priority].push(slot);
    requestFlush();
    return () => {
        slot.task = null;
    };
}
export function flushSync(task?: () => unknown): void {
    if (task) task();
    runQueue('sync');
    runQueue('userBlocking');
    runQueue('normal');
}
export function transition<T>(task: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        schedule(async () => {
            try {
                resolve(await task());
            } catch (error) {
                reject(error);
            }
        }, 'transition');
    });
}
export const scheduler = Object.freeze({
    sync: (fn: Task) => schedule(fn, 'sync'),
    userBlocking: (fn: Task) => schedule(fn, 'userBlocking'),
    normal: (fn: Task) => schedule(fn, 'normal'),
    transition: (fn: Task) => schedule(fn, 'transition'),
    background: (fn: Task) => schedule(fn, 'background'),
    idle: (fn: Task) => schedule(fn, 'idle')
});
