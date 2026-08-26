import { schedule } from './scheduler.ts';
let batteryState = {
    supported: false,
    low: false
},
    batteryInit = null,
    batteryRef = null;
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
    batteryInit = (async () => {
        if (typeof navigator === 'undefined' || !navigator.getBattery) return batteryState;
        try {
            batteryRef = await navigator.getBattery();
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
            return batteryState;
        } catch {
            return batteryState;
        }
    })();
    return batteryInit;
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
        queue = [];
    const drain = () => {
        const budget = prefetchBudget(),
            limit = options.concurrency ?? (budget.enabled ? budget.concurrency : 1);
        while (active < Math.max(1, limit) && queue.length) {
            const job = queue.shift();
            active++;
            Promise.resolve(adaptiveSchedule(job.task, job.kind)).then(job.resolve, job.reject).finally(() => {
                active--;
                drain();
            });
        }
    };
    return {
        schedule(task, kind = 'normal') {
            return new Promise((resolve, reject) => {
                queue.push({
                    task,
                    kind,
                    resolve,
                    reject
                });
                drain();
            });
        },
        get profile() {
            return deviceProfile();
        },
        get pending() {
            return queue.length;
        }
    };
}
