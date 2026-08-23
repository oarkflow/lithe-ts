import { performance } from 'node:perf_hooks';

let activeObserver: any = null;
let tracking = true;
let batchDepth = 0;
let reactiveSeq = 0;
let pendingHead: any = null;
let pendingTail: any = null;

const STATE_CLEAN = 0;
const STATE_DIRTY = 1;

class Dependency {
	id = ++reactiveSeq;
	version = 0;
	label: string;
	kind: string;
	_sub1: any = null;
	_subs: any[] | null = null;

	constructor(label = '', kind = 'dependency') {
		this.label = label;
		this.kind = kind;
	}

	track() {
		if (!tracking || !activeObserver) return;
		activeObserver.addDependency(this);
	}

	addSubscriber(sub: any) {
		if (!this._sub1) {
			this._sub1 = sub;
		} else if (this._sub1 === sub) {
			return;
		} else if (!this._subs) {
			this._subs = [this._sub1, sub];
		} else {
			if (this._subs.indexOf(sub) === -1) {
				this._subs.push(sub);
			}
		}
	}

	removeSubscriber(sub: any) {
		if (this._sub1 === sub) {
			if (this._subs && this._subs.length > 1) {
				this._subs.splice(this._subs.indexOf(sub), 1);
				this._sub1 = this._subs[0];
			} else {
				this._sub1 = null;
				this._subs = null;
			}
		} else if (this._subs) {
			const idx = this._subs.indexOf(sub);
			if (idx !== -1) this._subs.splice(idx, 1);
		}
	}

	notify() {
		this.version++;
		if (this._subs) {
			const len = this._subs.length;
			for (let i = 0; i < len; i++) {
				this._subs[i].markDirty(this);
			}
		} else if (this._sub1) {
			this._sub1.markDirty(this);
		}
	}
}

class SignalImpl<T> extends Dependency {
	_value: T;
	__litheSignal = true;

	constructor(initial: T, name = '') {
		super(name, 'signal');
		this._value = initial;
	}

	get value(): T {
		if (tracking && activeObserver) activeObserver.addDependency(this);
		return this._value;
	}

	set value(next: T | ((prev: T) => T)) {
		const resolved = typeof next === 'function' ? (next as any)(this._value) : next;
		if (Object.is(this._value, resolved)) return;
		this._value = resolved;
		this.version++;
		if (this._subs) {
			const len = this._subs.length;
			for (let i = 0; i < len; i++) this._subs[i].markDirty(this);
		} else if (this._sub1) {
			this._sub1.markDirty(this);
		}
	}

	peek(): T { return this._value; }
}

class ComputedImpl<T> extends Dependency {
	_fn: () => T;
	_value: T = undefined as any;
	_state: number = STATE_DIRTY;
	_deps: Dependency[] = [];
	_depVersions: number[] = [];
	__litheSignal = true;
	__computed = true;

	constructor(fn: () => T, name = '') {
		super(name, 'computed');
		this._fn = fn;
	}

	addDependency(dep: Dependency) {
		this._deps.push(dep);
		dep.addSubscriber(this);
	}

	markDirty(cause?: Dependency) {
		if (this._state === STATE_DIRTY) return;
		this._state = STATE_DIRTY;
		if (this._subs) {
			const len = this._subs.length;
			for (let i = 0; i < len; i++) this._subs[i].markDirty(this);
		} else if (this._sub1) {
			this._sub1.markDirty(this);
		}
	}

	_update() {
		if (this._state === STATE_CLEAN) return;
		const len = this._deps.length;
		if (len > 0) {
			let anyChanged = false;
			for (let i = 0; i < len; i++) {
				const dep = this._deps[i];
				if (dep instanceof ComputedImpl && dep._state !== STATE_CLEAN) {
					dep._update();
				}
				if (this._depVersions[i] !== dep.version) {
					anyChanged = true;
					break;
				}
			}
			if (!anyChanged && len > 0) {
				this._state = STATE_CLEAN;
				return;
			}
		}

		if (len > 0) {
			for (let i = 0; i < len; i++) {
				this._deps[i].removeSubscriber(this);
			}
			this._deps.length = 0;
			this._depVersions.length = 0;
		}

		const prevObserver = activeObserver;
		activeObserver = this;
		try {
			const nextVal = this._fn();
			if (!Object.is(this._value, nextVal)) {
				this._value = nextVal;
				this.version++;
			}
			this._state = STATE_CLEAN;
			const newLen = this._deps.length;
			for (let i = 0; i < newLen; i++) {
				this._depVersions.push(this._deps[i].version);
			}
		} finally {
			activeObserver = prevObserver;
		}
	}

	get value(): T {
		if (tracking && activeObserver) activeObserver.addDependency(this);
		if (this._state !== STATE_CLEAN) {
			this._update();
		}
		return this._value;
	}

	peek(): T {
		if (this._state !== STATE_CLEAN) this._update();
		return this._value;
	}
}

// 1. Diamond test
const root = new SignalImpl(1);
const b1 = new ComputedImpl(() => root.value * 2);
const b2 = new ComputedImpl(() => root.value + 3);
const c1 = new ComputedImpl(() => b1.value + b2.value);
const c2 = new ComputedImpl(() => b1.value * b2.value);
const top = new ComputedImpl(() => c1.value + c2.value);

const start1 = performance.now();
for (let i = 0; i < 10000; i++) {
	root.value = i;
	const _ = top.value;
}
const elapsed1 = performance.now() - start1;
console.log('Push-pull Diamond 10,000 cycles:', elapsed1.toFixed(3), 'ms');

// 2. 10,000 1:1 Signals
const sources = Array.from({ length: 10000 }, (_, i) => new SignalImpl(i));
const derivations = sources.map(s => new ComputedImpl(() => s.value * 2));

const start2 = performance.now();
for (let i = 0; i < 10000; i++) {
	sources[i].value = i + 1;
	const _ = derivations[i].value;
}
const elapsed2 = performance.now() - start2;
console.log('10,000 1:1 Derivations:', elapsed2.toFixed(3), 'ms');

// 3. 1:500 Fan-out (50 sweeps)
const fanRoot = new SignalImpl(10);
const fanListeners = Array.from({ length: 500 }, (_, i) => new ComputedImpl(() => fanRoot.value + i));
const start3 = performance.now();
for (let i = 0; i < 50; i++) {
	fanRoot.value = i;
	for (let j = 0; j < 500; j++) {
		const _ = fanListeners[j].value;
	}
}
const elapsed3 = performance.now() - start3;
console.log('1:500 Fan-out (50 sweeps):', elapsed3.toFixed(3), 'ms');
