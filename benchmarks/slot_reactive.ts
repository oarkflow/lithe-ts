import { performance } from 'node:perf_hooks';

let Listener: any = null;
let Owner: any = null;
let Updates: any[] | null = null;
let Effects: any[] | null = null;
let ExecCount = 0;

const STALE = 1;
const PENDING = 2;
const CLEAN = 0;

function readSignal(this: any) {
	if (this.sources && this.state) {
		if (this.state === STALE) updateComputation(this);
		else {
			const updates = Updates;
			Updates = null;
			runUpdates(() => lookUpstream(this), false);
			Updates = updates;
		}
	}
	if (Listener) {
		const sSlot = this.observers ? this.observers.length : 0;
		if (!Listener.sources) {
			Listener.sources = [this];
			Listener.sourceSlots = [sSlot];
		} else {
			Listener.sources.push(this);
			Listener.sourceSlots.push(sSlot);
		}
		if (!this.observers) {
			this.observers = [Listener];
			this.observerSlots = [Listener.sources.length - 1];
		} else {
			this.observers.push(Listener);
			this.observerSlots.push(Listener.sources.length - 1);
		}
	}
	return this.value;
}

function writeSignal(node: any, value: any) {
	if (node.value !== value) {
		node.value = value;
		if (node.observers && node.observers.length) {
			runUpdates(() => {
				for (let i = 0; i < node.observers.length; i++) {
					const o = node.observers[i];
					if (!o.state) {
						if (o.pure) Updates!.push(o);
						else Effects!.push(o);
						if (o.observers) markDownstream(o);
					}
					o.state = STALE;
				}
			}, false);
		}
	}
	return value;
}

function markDownstream(node: any) {
	for (let i = 0; i < node.observers.length; i++) {
		const o = node.observers[i];
		if (!o.state) {
			o.state = PENDING;
			if (o.pure) Updates!.push(o);
			else Effects!.push(o);
			if (o.observers) markDownstream(o);
		}
	}
}

function lookUpstream(node: any) {
	node.state = CLEAN;
	for (let i = 0; i < node.sources.length; i++) {
		const source = node.sources[i];
		if (source.sources) {
			if (source.state === STALE) {
				if (!source.updatedAt || source.updatedAt < ExecCount) runTop(source);
			} else if (source.state === PENDING) lookUpstream(source);
		}
	}
}

function runTop(node: any) {
	if (node.state === CLEAN) return;
	if (node.state === PENDING) return lookUpstream(node);
	updateComputation(node);
}

function updateComputation(node: any) {
	if (!node.fn) return;
	cleanNode(node);
	const time = ExecCount;
	const prevListener = Listener;
	const prevOwner = Owner;
	Listener = Owner = node;
	try {
		const next = node.fn(node.value);
		if (node.updatedAt != null && 'observers' in node) {
			writeSignal(node, next);
		} else {
			node.value = next;
		}
		node.updatedAt = time;
	} finally {
		Listener = prevListener;
		Owner = prevOwner;
	}
}

function cleanNode(node: any) {
	if (node.sources) {
		while (node.sources.length) {
			const source = node.sources.pop();
			const index = node.sourceSlots.pop();
			const obs = source.observers;
			if (obs && obs.length) {
				const last = obs.pop();
				const lastSlot = source.observerSlots.pop();
				if (index < obs.length) {
					last.sourceSlots[lastSlot] = index;
					obs[index] = last;
					source.observerSlots[index] = lastSlot;
				}
			}
		}
	}
}

function runUpdates(fn: () => void, init: boolean) {
	if (Updates) return fn();
	Updates = [];
	if (!Effects) Effects = [];
	ExecCount++;
	try {
		const res = fn();
		if (Updates) {
			for (let i = 0; i < Updates.length; i++) runTop(Updates[i]);
			Updates = null;
		}
		return res;
	} finally {
		Updates = null;
		Effects = null;
	}
}

class FastSignal<T> {
	value: T;
	observers: any[] | null = null;
	observerSlots: any[] | null = null;
	__litheSignal = true;

	constructor(val: T) {
		this.value = val;
	}

	get() {
		return readSignal.call(this);
	}

	set(val: T) {
		return writeSignal(this, val);
	}
}

class FastComputed<T> {
	fn: () => T;
	value: T = undefined as any;
	state: number = STALE;
	sources: any[] | null = null;
	sourceSlots: any[] | null = null;
	observers: any[] | null = null;
	observerSlots: any[] | null = null;
	updatedAt: number | null = null;
	pure = true;
	__litheSignal = true;
	__computed = true;

	constructor(fn: () => T) {
		this.fn = fn;
		updateComputation(this);
	}

	get() {
		return readSignal.call(this);
	}
}

// 1. Diamond test
const root = new FastSignal(1);
const b1 = new FastComputed(() => root.get() * 2);
const b2 = new FastComputed(() => root.get() + 3);
const c1 = new FastComputed(() => b1.get() + b2.get());
const c2 = new FastComputed(() => b1.get() * b2.get());
const top = new FastComputed(() => c1.get() + c2.get());

const start1 = performance.now();
for (let i = 0; i < 10000; i++) {
	root.set(i);
	const _ = top.get();
}
const elapsed1 = performance.now() - start1;
console.log('Fast Diamond 10,000 cycles:', elapsed1.toFixed(3), 'ms');

// 2. 10,000 1:1 Signals
const sources = Array.from({ length: 10000 }, (_, i) => new FastSignal(i));
const derivations = sources.map(s => new FastComputed(() => s.get() * 2));

const start2 = performance.now();
for (let i = 0; i < 10000; i++) {
	sources[i].set(i + 1);
	const _ = derivations[i].get();
}
const elapsed2 = performance.now() - start2;
console.log('10,000 1:1 Derivations:', elapsed2.toFixed(3), 'ms');

// 3. 1:500 Fan-out (50 sweeps)
const fanRoot = new FastSignal(10);
const fanListeners = Array.from({ length: 500 }, (_, i) => new FastComputed(() => fanRoot.get() + i));
const start3 = performance.now();
for (let i = 0; i < 50; i++) {
	fanRoot.set(i);
	for (let j = 0; j < 500; j++) {
		const _ = fanListeners[j].get();
	}
}
const elapsed3 = performance.now() - start3;
console.log('1:500 Fan-out (50 sweeps):', elapsed3.toFixed(3), 'ms');
