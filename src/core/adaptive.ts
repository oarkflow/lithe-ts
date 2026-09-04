import { schedule } from './scheduler.ts';
import { getOwner, onCleanup } from './owner.ts';
let batteryState = {
    supported: false,
    low: false
},
    batteryInit = null,
    batteryRef = null,
    batteryCleanup = null,
    batteryGeneration = 0;
function connectionProfile() {
    const c = typeof navigator !== 'undefined' ? navigator.connection : null;
    return {
        saveData: Boolean(c?.saveData),
        connection: c?.effectiveType || 'unknown',
        downlink: c?.downlink ?? null,
        rtt: c?.rtt ?? null
    };
}
export function deviceProfile() {
    if (typeof navigator === 'undefined') return {
        memory: null,
        cores: null,
        saveData: false,
        connection: 'unknown',
        downlink: null,
        rtt: null,
        batteryLow: false,
        lowPower: false
    };
    const c = connectionProfile(),
        memory = navigator.deviceMemory ?? null,
        cores = navigator.hardwareConcurrency ?? null,
        batteryLow = Boolean(batteryState.low);
    return {
        memory,
        cores,
        ...c,
        batteryLow,
        lowPower: batteryLow || c.saveData || ['slow-2g', '2g'].includes(c.connection) || memory != null && memory <= 2 || cores != null && cores <= 2
    };
}
export function adaptivePriority(kind = 'normal') {
    const p = deviceProfile();
    if (kind === 'prefetch' || kind === 'analytics') return p.lowPower ? 'idle' : 'background';
    if (kind === 'compute') return p.lowPower ? 'background' : 'normal';
    if (kind === 'transition' && p.lowPower) return 'normal';
    return kind;
}
export function adaptiveSchedule(task, kind = 'normal') {
    if (typeof navigator !== 'undefined' && !batteryInit) initBatteryAdaptation().catch(e => console.warn('[lithe:adaptive] Battery adaptation failed:', e));
    return schedule(task, adaptivePriority(kind));
}
export async function batteryProfile() {
    if (typeof navigator === 'undefined' || !navigator.getBattery) return {
        supported: false,
        low: false
    };
    try {
        const b = await navigator.getBattery(),
            state = {
                supported: true,
                charging: b.charging,
                level: b.level,
                low: !b.charging && b.level < 0.2
            };
        batteryState = state;
        return state;
    } catch {
        return {
            supported: false,
            low: false
        };
    }
}
export async function initBatteryAdaptation() {
    if (batteryInit) return batteryInit;
    const generation = batteryGeneration;
    batteryInit = (async () => {
        if (typeof navigator === 'undefined' || !navigator.getBattery) return batteryState;
        try {
            batteryRef = await navigator.getBattery();
            if (generation !== batteryGeneration) return batteryState;
            const update = () => {
                batteryState = {
                    supported: true,
                    charging: batteryRef.charging,
                    level: batteryRef.level,
                    low: !batteryRef.charging && batteryRef.level < 0.2
                };
            };
            update();
            batteryRef.addEventListener?.('chargingchange', update);
            batteryRef.addEventListener?.('levelchange', update);
            batteryCleanup = () => {
                batteryRef?.removeEventListener?.('chargingchange', update);
                batteryRef?.removeEventListener?.('levelchange', update);
                batteryCleanup = null;
            };
            return batteryState;
        } catch {
            return batteryState;
        }
    })();
    return batteryInit;
}
export function disposeBatteryAdaptation(): void {
    batteryGeneration++;
    batteryCleanup?.();
    batteryRef = null;
    batteryInit = null;
    batteryState = {
        supported: false,
        low: false
    };
}
export function prefetchBudget() {
    const p = deviceProfile();
    if (p.saveData || p.batteryLow || ['slow-2g', '2g'].includes(p.connection)) return {
        enabled: false,
        concurrency: 0,
        distance: 0
    };
    if (p.memory != null && p.memory <= 2) return {
        enabled: true,
        concurrency: 1,
        distance: 1
    };
    if (p.connection === '3g') return {
        enabled: true,
        concurrency: 1,
        distance: 2
    };
    return {
        enabled: true,
        concurrency: Math.max(2, Math.min(6, Math.floor((p.cores || 4) / 2))),
        distance: p.memory && p.memory >= 8 ? 6 : 3
    };
}
export function createAdaptiveScheduler(options = {}) {
    let active = 0,
        queue = [],
        disposed = false;
    const maxPending = options.maxPending === 0 ? Infinity : Math.max(1, Number(options.maxPending ?? 1000) || 1000);
    const drain = () => {
        if (disposed) return;
        const budget = prefetchBudget(),
            limit = options.concurrency ?? (budget.enabled ? budget.concurrency : 1);
        while (active < Math.max(1, limit) && queue.length) {
            const job = queue.shift();
            active++;
            Promise.resolve(adaptiveSchedule(job.task, job.kind)).then(job.resolve, job.reject).finally(() => {
                active--;
                if (!disposed) drain();
            });
        }
    };
    const api = {
        schedule(task, kind = 'normal') {
            return new Promise((resolve, reject) => {
                if (disposed) {
                    reject(new Error('Adaptive scheduler has been disposed.'));
                    return;
                }
                if (queue.length >= maxPending) {
                    reject(new Error('Adaptive scheduler queue limit exceeded.'));
                    return;
                }
                queue.push({
                    task,
                    kind,
                    resolve,
                    reject
                });
                drain();
            });
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            const pending = queue.splice(0);
            for (const job of pending) job.reject(new Error('Adaptive scheduler has been disposed.'));
        },
        get profile() {
            return deviceProfile();
        },
        get pending() {
            return queue.length;
        }
    };
    if (getOwner()) onCleanup(api.dispose);
    return api;
}
