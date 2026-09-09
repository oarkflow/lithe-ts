import { batch, effect, isSignal, signal, state as reactiveState } from '../core/reactive.ts';
import { ARRAY_MUTATION, ARRAY_TRACK } from '../core/internal.ts';
import { createScope, onCleanup } from '../core/owner.ts';
import { SuspenseContext } from '../core/suspense.ts';
import { dynamic } from './dom.ts';
import { h, Fragment } from './vnode.ts';
function read(value) {
    return isSignal(value) ? value.value : typeof value === 'function' ? value() : value;
}
function removeRow(row) {
    row?.scope?.dispose();
    for (const node of row?.nodes || []) node.remove();
}
function itemAt(items, rawItems, index) {
    const item = rawItems[index];
    return rawItems === items || item === null || typeof item !== 'object' ? item : reactiveState(item);
}
class ListIndex {
    __litheSignal = true;
    source = null;
    constructor(value) {
        this.current = value;
    }
    ensure() {
        return this.source ||= signal(this.current);
    }
    get value() {
        return this.ensure().value;
    }
    set value(next) {
        if (this.source) this.source.value = next;
        else this.current = typeof next === 'function' ? next(this.current) : next;
    }
    peek() {
        return this.source ? this.source.peek() : this.current;
    }
    update(fn) {
        this.value = fn(this.peek());
        return this.peek();
    }
    subscribe(fn, options) {
        return this.ensure().subscribe(fn, options);
    }
    toJSON() { return this.peek(); }
    valueOf() { return this.peek(); }
    toString() { return String(this.peek()); }
}
function indexSignal(value) {
    return new ListIndex(value);
}
function keyFor(item, index, key) {
    if (typeof key === 'function') return key(item, index);
    if (typeof key === 'string') return item?.[key];
    if (item && typeof item === 'object') return item.id ?? item.key ?? item;
    return item;
}
const NEGATIVE_ZERO = Symbol('lithe.negative-zero');
function bucketKey(key) {
    return typeof key === 'number' && Object.is(key, -0) ? NEGATIVE_ZERO : key;
}
function renderScope(mountAny, view, options) {
    const fragment = document.createDocumentFragment(),
        scope = createScope(() => mountAny(fragment, view, null, options), { detached: true });
    return {
        fragment,
        scope,
        nodes: [...scope.value.nodes]
    };
}
export function Show(props) {
    return dynamic(() => {
        const when = read(props.when);
        if (when) return typeof props.children === 'function' ? props.children(when) : props.children;
        return typeof props.fallback === 'function' ? props.fallback() : props.fallback ?? null;
    });
}
// Claims a row's already-rendered SSR markup starting at `node` instead of
// creating fresh DOM in a detached fragment (renderScope's job for normal
// mounting). Wrapping the claim() call in its own owner scope mirrors
// renderScope's `scope` so removeRow() can dispose a claimed row exactly
// like a freshly-mounted one.
function claimRow(claim, parent, node, view, options) {
    let result;
    const scope = createScope(() => {
        result = claim(parent, node, view, options);
    }, { detached: true });
    return {
        scope,
        nodes: result.nodes,
        next: result.next
    };
}
function moveRowBefore(parent, row, anchor) {
    for (let i = 0; i < row.nodes.length; i++) parent.insertBefore(row.nodes[i], anchor);
}
// Avoid constructing Maps, Sets, an LIS and several N-element scratch arrays
// for the two tiny edits that dominate interactive keyed lists. Identity is
// deliberately required: replacing an item object must still rebuild its
// closure-backed view with the new object.
function fastStructuralEdit(state, items, rawItems, parent, end) {
    const rows = state.rows;
    if (!rows.length || !state.byKey) return false;
    const mutation = items[ARRAY_MUTATION];
    if (items.length === rows.length) {
        if (mutation?.method === 'set' && mutation.previousLength === rows.length && mutation.indices?.length === 2) {
            const left = mutation.indices[0], right = mutation.indices[1];
            if (left !== right && left >= 0 && right >= 0 && left < rows.length && right < rows.length &&
                itemAt(items, rawItems, left) === rows[right].item && itemAt(items, rawItems, right) === rows[left].item) {
                const first = Math.min(left, right), second = Math.max(left, right);
                const firstRow = rows[first], secondRow = rows[second];
                if (!firstRow.nodes.length || !secondRow.nodes.length) return false;
                let afterSecond = end;
                for (let i = second + 1; i < rows.length; i++) {
                    if (rows[i].nodes.length) {
                        afterSecond = rows[i].nodes[0];
                        break;
                    }
                }
                moveRowBefore(parent, secondRow, firstRow.nodes[0]);
                moveRowBefore(parent, firstRow, afterSecond);
                rows[first] = secondRow;
                rows[second] = firstRow;
                secondRow.index.value = first;
                firstRow.index.value = second;
                return true;
            }
        }
        let first = -1, second = -1;
        for (let i = 0; i < items.length; i++) {
            if (itemAt(items, rawItems, i) === rows[i].item) continue;
            if (first === -1) first = i;
            else if (second === -1) second = i;
            else return false;
        }
        if (first === -1) return true;
        if (second === -1 || itemAt(items, rawItems, first) !== rows[second].item || itemAt(items, rawItems, second) !== rows[first].item) return false;
        const firstRow = rows[first], secondRow = rows[second];
        if (!firstRow.nodes.length || !secondRow.nodes.length) return false;
        let afterSecond = end;
        for (let i = second + 1; i < rows.length; i++) {
            if (rows[i].nodes.length) {
                afterSecond = rows[i].nodes[0];
                break;
            }
        }
        const firstAnchor = firstRow.nodes[0];
        moveRowBefore(parent, secondRow, firstAnchor);
        moveRowBefore(parent, firstRow, afterSecond);
        rows[first] = secondRow;
        rows[second] = firstRow;
        secondRow.index.value = first;
        firstRow.index.value = second;
        return true;
    }
    if (items.length !== rows.length - 1) return false;
    let removed = -1;
    if (mutation?.method === 'splice' && mutation.previousLength === rows.length && mutation.args.length >= 2 && mutation.args.length === 2) {
        const rawStart = Number(mutation.args[0]) || 0;
        const start = rawStart < 0 ? Math.max(rows.length + rawStart, 0) : Math.min(rawStart, rows.length);
        const deleted = Math.min(Math.max(Number(mutation.args[1]) || 0, 0), rows.length - start);
        if (deleted === 1) removed = start;
    }
    if (removed === -1) {
        for (let i = 0; i < items.length; i++) {
            if (itemAt(items, rawItems, i) === rows[i].item) continue;
            removed = i;
            break;
        }
        if (removed === -1) removed = rows.length - 1;
        for (let i = removed; i < items.length; i++) {
            if (itemAt(items, rawItems, i) !== rows[i + 1].item) return false;
        }
    }
    const row = rows[removed];
    const bucket = state.byKey.get(bucketKey(row.base));
    // Duplicate-key occurrence bookkeeping needs the general path.
    if (!bucket || bucket.length !== 1 || bucket[0] !== row) return false;
    removeRow(row);
    rows.splice(removed, 1);
    state.byKey.delete(bucketKey(row.base));
    batch(() => {
        for (let i = removed; i < rows.length; i++) rows[i].index.value = i;
    });
    return true;
}
// Runs one keyed-diff pass for <For>, given the current `state.rows`/
// `state.fallback`. Shared between __litheMount (state starts empty, so the
// first pass builds every row from scratch) and __litheClaim (state starts
// pre-populated from claimed SSR DOM, so this only ever needs to run again
// for a genuine later update) so the two paths can never diverge.
function syncForRows(state, items, parent, end, renderer, props, options, mountAny) {
    if (!Array.isArray(items)) throw new TypeError('<For each> must be an array.');
    // Subscribe once to structural changes, then read indices from the raw
    // array. Tracking every index made each update detach and reattach more
    // than a thousand dependencies before reconciliation even started.
    const rawItems = items[ARRAY_TRACK] || items;
    if (!items.length) {
        for (const row of state.rows) removeRow(row);
        state.rows = [];
        state.byKey = null;
        if (!state.fallback && props.fallback != null) {
            state.fallback = renderScope(mountAny, read(props.fallback), options);
            parent.insertBefore(state.fallback.fragment, end);
        }
        return;
    }
    if (state.fallback) {
        removeRow(state.fallback);
        state.fallback = null;
    }
    if (fastStructuralEdit(state, items, rawItems, parent, end)) return;
    // `state.byKey` is the keyed lookup this same pass built last time it
    // ran, kept around instead of rebuilt from `state.rows` on every call.
    // Rebuilding it from scratch here was an O(previous row count) Map
    // build paid on *every* update no matter how small — even removing a
    // single row out of a thousand rebuilt the whole index. The new index
    // for *this* pass gets built as a side effect of the loop below (it
    // already visits every item once to match/create rows), so there's
    // nothing left to precompute up front.
    const oldRows = state.rows,
        oldByKey = state.byKey,
        newByKey = new Map(),
        next = [];
    // Newly-created rows are appended into one shared fragment and inserted
    // with a single insertBefore call below, instead of one insertBefore
    // per row — for an initial N-row render (nothing to reuse yet) that's
    // the difference between 1 DOM insertion and N of them. Their relative
    // order within the fragment already matches `next`'s order (each is
    // appended in iteration order), so the contiguity pass below finds
    // nothing left to fix for a plain "populate an empty list" render.
    let pendingNewRows = null;
    for (let i = 0; i < items.length; i++) {
        // Read `items[i]` exactly once per row. `items` is very often a
        // reactive state() proxy — every index read goes through its `get`
        // trap (tracks a Dependency, and re-wraps an object element through
        // the proxy cache), and this loop used to read it up to four times
        // per row (key, identity check, renderer call, stored item), for
        // work that's identical every time. A CPU profile of create1k
        // showed that redundant re-entry into the proxy trap as one of the
        // larger non-DOM costs.
        const currentItem = itemAt(items, rawItems, i);
        const base = keyFor(currentItem, i, props.key);
        const bucketId = bucketKey(base);
        let newBucket = newByKey.get(bucketId);
        const occ = newBucket ? newBucket.length : 0;
        let row = oldByKey?.get(bucketId)?.[occ];
        if (row && row.item !== currentItem) {
            row = null;
        }
        if (!row) {
            const index = indexSignal(i),
                built = renderScope(mountAny, renderer(currentItem, index), options);
            row = {
                ...built,
                base,
                occ,
                item: currentItem,
                index
            };
            (pendingNewRows ??= document.createDocumentFragment()).appendChild(built.fragment);
        } else if (row.index.peek() !== i) {
            // A reused row whose position genuinely hasn't changed (the
            // common case for an update/append that isn't a reorder) skips
            // the signal write entirely, so nothing downstream that reads
            // `index` re-runs just because this pass happened to touch it.
            row.index.value = i;
        }
        if (!newBucket) newByKey.set(bucketId, newBucket = []);
        newBucket.push(row);
        next.push(row);
    }
    if (pendingNewRows) parent.insertBefore(pendingNewRows, end);
    const retained = new Set(next);
    for (const row of oldRows) if (!retained.has(row)) removeRow(row);
    state.rows = next;
    state.byKey = newByKey;
    if (!oldRows.length) {
        // Pure initial populate: every row is brand new, and the
        // pendingNewRows fragment above already inserted all of them, in
        // order, in one shot. There is nothing to reposition.
        return;
    }
    // Move only the rows that actually need to move. A naive left-to-right
    // "is this row's first node already right after the previous row's last
    // node" check looks cheap, but a SINGLE row that changed position
    // poisons every comparison after it: once one row gets relocated, the
    // "previous node" the check compares against no longer matches physical
    // reality for anything that follows, so the rest of the list — however
    // untouched — cascades into being re-inserted too (this is exactly why
    // swapping two rows out of a thousand cost as much as building all
    // thousand from scratch). The fix used by other fast keyed-diff
    // implementations (Vue's patchKeyedChildren, Inferno) is to find the
    // longest run of rows whose *relative order* against the previous
    // render hasn't changed — a longest increasing subsequence of their old
    // positions — and only touch rows outside that run. Newly-created rows
    // (oldPosition -1) are never part of it, since they still need to move
    // from wherever pendingNewRows physically landed them into their real
    // position when mixed in among reused rows.
    const oldIndexOf = new Map();
    for (let i = 0; i < oldRows.length; i++) oldIndexOf.set(oldRows[i], i);
    const oldPositions = next.map(row => oldIndexOf.has(row) ? oldIndexOf.get(row) : -1);
    const stable = longestIncreasingRun(oldPositions);
    let anchor = end;
    for (let i = next.length - 1; i >= 0; i--) {
        const nodes = next[i].nodes;
        if (!nodes.length) continue;
        if (!stable.has(i)) {
            for (const node of nodes) parent.insertBefore(node, anchor);
        }
        anchor = nodes[0];
    }
}
// Index set of a longest strictly-increasing subsequence of `seq`, treating
// -1 (a row with no previous position — i.e. brand new) as never eligible.
// Standard O(n log n) patience-sorting LIS with predecessor backtracking so
// the *set of indices to leave alone* falls out directly, rather than the
// subsequence's values (which callers here have no use for).
function longestIncreasingRun(seq) {
    const tails = [],
        tailIndices = [],
        prev = new Array(seq.length).fill(-1);
    for (let i = 0; i < seq.length; i++) {
        const v = seq[i];
        if (v === -1) continue;
        let lo = 0,
            hi = tails.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (tails[mid] < v) lo = mid + 1; else hi = mid;
        }
        if (lo > 0) prev[i] = tailIndices[lo - 1];
        tails[lo] = v;
        tailIndices[lo] = i;
    }
    const result = new Set();
    let idx = tailIndices.length ? tailIndices[tailIndices.length - 1] : -1;
    while (idx !== -1) {
        result.add(idx);
        idx = prev[idx];
    }
    return result;
}
export function For(props) {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children;
    return dynamic(() => {
        const items = read(props.each) || [];
        return items.length ? items.map((item, i) => renderer(item, indexSignal(i))) : props.fallback ?? null;
    });
}
For.__litheMount = ({
    parent,
    before,
    props,
    options,
    mountAny
}) => {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children,
        start = document.createComment('lithe:for'),
        end = document.createComment('/lithe:for');
    parent.insertBefore(start, before);
    parent.insertBefore(end, before);
    const state = {
        rows: [],
        byKey: null,
        fallback: null
    };
    effect(() => {
        syncForRows(state, read(props.each) || [], parent, end, renderer, props, options, mountAny);
    }, {
        sync: true
    });
    onCleanup(() => {
        for (const row of state.rows) removeRow(row);
        removeRow(state.fallback);
        start.remove();
        end.remove();
    });
    return {
        nodes: [start, end]
    };
};
For.__litheClaim = ({
    parent,
    node,
    props,
    options,
    claim,
    mountAny
}) => {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children,
        start = document.createComment('lithe:for');
    parent.insertBefore(start, node);
    const items = read(props.each) || [];
    const state = {
        rows: [],
        byKey: null,
        fallback: null
    };
    let cursor = node;
    if (!items.length) {
        if (props.fallback != null) {
            const claimed = claimRow(claim, parent, cursor, read(props.fallback), options);
            state.fallback = {
                scope: claimed.scope,
                nodes: claimed.nodes
            };
            cursor = claimed.next;
        }
    } else {
        const occurrences = new Map();
        for (let i = 0; i < items.length; i++) {
            const base = keyFor(items[i], i, props.key),
                bucketId = bucketKey(base),
                occ = occurrences.get(bucketId) || 0;
            occurrences.set(bucketId, occ + 1);
            const index = indexSignal(i),
                claimed = claimRow(claim, parent, cursor, renderer(items[i], index), options);
            state.rows.push({
                scope: claimed.scope,
                nodes: claimed.nodes,
                base,
                occ,
                item: items[i],
                index
            });
            cursor = claimed.next;
        }
    }
    const end = document.createComment('/lithe:for');
    parent.insertBefore(end, cursor);
    // Deliberately NOT skipped on the first run (unlike a "first ? return :
    // ..." guard): read(props.each) alone does not track anything by
    // itself — it's accessing items.length/items[i] inside syncForRows that
    // registers the reactive dependency on the underlying array/proxy. A
    // skipped first run would never touch those properties, so later
    // mutations (push/splice/etc) would never re-trigger this effect at
    // all. Running syncForRows unconditionally is also safe to do against
    // the just-claimed `state.rows`: since each claimed row's `item` is
    // `===` the current array element by identity, the very first pass's
    // keyed-bucket matching finds and reuses every claimed row rather than
    // building fresh ones — it only ever behaves as a genuine update from
    // the second real change onward.
    effect(() => {
        syncForRows(state, read(props.each) || [], parent, end, renderer, props, options, mountAny);
    }, {
        sync: true
    });
    onCleanup(() => {
        for (const row of state.rows) removeRow(row);
        removeRow(state.fallback);
        start.remove();
        end.remove();
    });
    return {
        next: end.nextSibling,
        nodes: [start, end]
    };
};
function syncIndexRows(state, items, parent, end, renderer, props, options, mountAny) {
    if (!items.length) {
        for (const row of state.rows) removeRow(row);
        state.rows = [];
        if (!state.fallback && props.fallback != null) {
            state.fallback = renderScope(mountAny, read(props.fallback), options);
            parent.insertBefore(state.fallback.fragment, end);
        }
        return;
    }
    if (state.fallback) {
        removeRow(state.fallback);
        state.fallback = null;
    }
    // Same batching as syncForRows above: accumulate every newly-created
    // row into one fragment and insert once, rather than once per row.
    // Index never reorders existing rows (it only updates them in place or
    // appends/truncates), so unlike For there is no analogous "skip a
    // reposition that isn't needed" pass required here.
    let pendingNewRows = null;
    for (let i = 0; i < items.length; i++) {
        if (state.rows[i]) state.rows[i].item.value = items[i]; else {
            const item = signal(items[i]),
                built = renderScope(mountAny, renderer(item, i), options);
            state.rows[i] = {
                ...built,
                item
            };
            (pendingNewRows ??= document.createDocumentFragment()).appendChild(built.fragment);
        }
    }
    if (pendingNewRows) parent.insertBefore(pendingNewRows, end);
    while (state.rows.length > items.length) removeRow(state.rows.pop());
}
export function Index(props) {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children;
    return dynamic(() => {
        const items = read(props.each) || [];
        return items.length ? items.map((item, i) => renderer(signal(item), i)) : props.fallback ?? null;
    });
}
Index.__litheMount = ({
    parent,
    before,
    props,
    options,
    mountAny
}) => {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children,
        start = document.createComment('lithe:index'),
        end = document.createComment('/lithe:index');
    parent.insertBefore(start, before);
    parent.insertBefore(end, before);
    const state = {
        rows: [],
        fallback: null
    };
    effect(() => {
        syncIndexRows(state, read(props.each) || [], parent, end, renderer, props, options, mountAny);
    }, {
        sync: true
    });
    onCleanup(() => {
        for (const row of state.rows) removeRow(row);
        removeRow(state.fallback);
        start.remove();
        end.remove();
    });
    return {
        nodes: [start, end]
    };
};
Index.__litheClaim = ({
    parent,
    node,
    props,
    options,
    claim,
    mountAny
}) => {
    const renderer = Array.isArray(props.children) ? props.children[0] : props.children,
        start = document.createComment('lithe:index');
    parent.insertBefore(start, node);
    const items = read(props.each) || [];
    const state = {
        rows: [],
        fallback: null
    };
    let cursor = node;
    if (!items.length) {
        if (props.fallback != null) {
            const claimed = claimRow(claim, parent, cursor, read(props.fallback), options);
            state.fallback = {
                scope: claimed.scope,
                nodes: claimed.nodes
            };
            cursor = claimed.next;
        }
    } else {
        for (let i = 0; i < items.length; i++) {
            const item = signal(items[i]),
                claimed = claimRow(claim, parent, cursor, renderer(item, i), options);
            state.rows.push({
                scope: claimed.scope,
                nodes: claimed.nodes,
                item
            });
            cursor = claimed.next;
        }
    }
    const end = document.createComment('/lithe:index');
    parent.insertBefore(end, cursor);
    // See the identical comment in For.__litheClaim: this must not skip its
    // first run, or the effect never establishes a tracked dependency on
    // the underlying array and later mutations go unnoticed. Running
    // syncIndexRows against the just-claimed `state.rows` on the first pass
    // just reassigns each row's item signal to the same value it already
    // holds (a no-op), so it only behaves as a real update from the next
    // genuine change onward.
    effect(() => {
        syncIndexRows(state, read(props.each) || [], parent, end, renderer, props, options, mountAny);
    }, {
        sync: true
    });
    onCleanup(() => {
        for (const row of state.rows) removeRow(row);
        removeRow(state.fallback);
        start.remove();
        end.remove();
    });
    return {
        next: end.nextSibling,
        nodes: [start, end]
    };
};
export function Switch(props) {
    const children = Array.isArray(props.children) ? props.children : [props.children];
    return dynamic(() => {
        for (const child of children) if (child?.type === Match && read(child.props.when)) return child.props.children;
        return props.fallback ?? null;
    });
}
export function Match() {
    return null;
}
export function Dynamic(props) {
    return dynamic(() => {
        const component = read(props.component);
        if (!component) return null;
        const {
            component: _ignored,
            children,
            ...rest
        } = props;
        return h(component, rest, ...(children || []));
    });
}
export function Portal(props) {
    return props.children || null;
}
Portal.__litheMount = ({
    props,
    options,
    mountAny
}) => {
    const target = read(props.mount || props.target) || document.body,
        scope = createScope(() => mountAny(target, props.children, null, options));
    onCleanup(() => {
        scope.dispose();
        for (const n of scope.value.nodes) n.remove();
    });
    return {
        nodes: []
    };
};
Portal.__litheClaim = ({
    parent,
    node,
    props,
    options,
    claim
}) => {
    // SSR has no concept of "render this elsewhere" — Portal's plain
    // function body just returns props.children (see above), so the
    // server places its markup inline, in the Portal's original tree
    // position (ssr.ts renders whatever the component returns). Claim the
    // children where they actually are, then relocate the resulting real
    // DOM nodes to the target, matching what a fresh client mount does.
    // Moving already-claimed nodes doesn't disturb their bindings: those
    // closures still reference the same node objects regardless of parent.
    const target = read(props.mount || props.target) || document.body;
    let result;
    const scope = createScope(() => {
        result = claim(parent, node, props.children, options);
    });
    const claimedNodes = result.nodes;
    for (const n of claimedNodes) target.appendChild(n);
    onCleanup(() => {
        scope.dispose();
        for (const n of claimedNodes) n.remove();
    });
    return {
        next: result.next,
        nodes: []
    };
};
export function Island(props) {
    if (typeof document === 'undefined') return {
        __litheIsland: true,
        children: props.children
    };
    return props.fallback ?? null;
}
Island.__litheMount = ({
    parent,
    before,
    props,
    options,
    mountAny
}) => {
    const placeholder = document.createComment(`lithe:island:${props.when || props.policy || 'load'}`);
    parent.insertBefore(placeholder, before);
    let scope = null,
        disposed = false,
        marker = null,
        cancelActivation = () => { };
    const activate = () => {
        if (disposed || scope) return;
        const fragment = document.createDocumentFragment();
        scope = createScope(() => mountAny(fragment, props.children, null, options));
        parent.insertBefore(fragment, placeholder);
        placeholder.remove();
    };
    const policy = props.when || props.policy || 'load';
    if (policy === 'load') queueMicrotask(activate); else if (policy === 'idle') {
        if (typeof globalThis.requestIdleCallback === 'function') {
            const id = globalThis.requestIdleCallback(activate);
            cancelActivation = () => globalThis.cancelIdleCallback?.(id);
        } else {
            const id = setTimeout(activate, 1);
            cancelActivation = () => clearTimeout(id);
        }
    } else if (policy === 'visible' && typeof IntersectionObserver !== 'undefined') {
        marker = document.createElement('span');
        marker.hidden = true;
        parent.insertBefore(marker, placeholder);
        const io = new IntersectionObserver(es => {
            if (es.some(e => e.isIntersecting)) {
                io.disconnect();
                marker.remove();
                activate();
            }
        });
        io.observe(marker);
        onCleanup(() => io.disconnect());
    } else if (policy === 'media' && typeof matchMedia === 'function') {
        const mq = matchMedia(props.media || 'all'),
            fn = () => {
                if (mq.matches) {
                    mq.removeEventListener?.('change', fn);
                    activate();
                }
            };
        mq.addEventListener?.('change', fn);
        fn();
        onCleanup(() => mq.removeEventListener?.('change', fn));
    } else activate();
    onCleanup(() => {
        disposed = true;
        cancelActivation();
        marker?.remove();
        scope?.dispose();
        placeholder.remove();
    });
    return {
        nodes: [placeholder]
    };
};
Island.__litheClaim = ({
    parent,
    node,
    props,
    options,
    claim
}) => {
    // ssr.ts always renders an island's real children (it unwraps the
    // __litheIsland marker and renders `value.children` directly) — unlike
    // a fresh CSR mount, there is no placeholder-vs-content swap to
    // perform, because the correct markup already exists in the DOM. The
    // plain Island(props) function returns the fallback whenever `document`
    // is defined, which is true during hydration too; claiming that
    // fallback's shape against DOM that actually holds the real children
    // was a structural mismatch that forced a full client remount. Claim
    // the real children directly instead.
    //
    // The load/idle/visible/media activation policies are a CSR-mount
    // optimization for content that doesn't exist yet on the page; once
    // server-rendered markup is already visible, delaying when its
    // reactivity attaches has no remaining benefit worth the complexity of
    // computing this claim's DOM extent without performing it — so
    // hydration claims immediately regardless of `props.when`/`policy`.
    return claim(parent, node, props.children, options);
};
export function ErrorBoundary(props) {
    // `props.children` here is already-built (unmounted) vnode data — merely
    // returning it can never throw. The component call that can actually
    // throw (mounting/invoking the child component tree) happens later, in
    // the caller's __mountChild/__mountAny, outside this function's own
    // stack frame, so this try/catch by itself never catches anything. The
    // real error-catching behavior lives in __litheMount below, which mounts
    // the children itself instead of handing them back for generic mounting.
    return props.children || null;
}
ErrorBoundary.__litheMount = ({
    parent,
    before,
    props,
    options,
    mountAny
}) => {
    const mount = content => {
        // Mount into a detached fragment first and only insert it into the
        // real DOM once mounting succeeds. If it throws partway through
        // (e.g. a component further down the tree throws), whatever was
        // already built lives only in the discarded, never-attached
        // fragment — nothing partial leaks into `parent`.
        const fragment = document.createDocumentFragment();
        const scope = createScope(() => mountAny(fragment, content, null, options));
        parent.insertBefore(fragment, before);
        onCleanup(scope.dispose);
        return scope.value;
    };
    try {
        return mount(props.children);
    } catch (error) {
        return mount(typeof props.fallback === 'function' ? props.fallback(error) : props.fallback);
    }
};
export function Await(props) {
    return dynamic(() => {
        const resource = props.resource;
        if (resource.loading) return props.pending ?? null;
        if (resource.error) return typeof props.error === 'function' ? props.error(resource.error) : props.error ?? null;
        const child = Array.isArray(props.children) ? props.children[0] : props.children;
        return typeof child === 'function' ? child(resource.data) : child;
    });
}
// A boundary that shows `fallback` while any query()/resource() started
// anywhere in its subtree is actually fetching, and swaps to the real
// content once every one of them has settled — without each descendant
// needing to manually check its own `.loading`. Descendants report a
// pending fetch to the nearest Suspense ancestor via SuspenseContext
// (see core/suspense.ts); query()/resource() do this automatically.
//
// props.children is mounted exactly ONCE, for this boundary's entire
// lifetime — not every time `pending` toggles. An earlier version swapped
// between fallback/children with a single dynamic() region driven by
// `pending`, which seemed natural but was actually broken: swapping back to
// "children" from "fallback" re-invoked every descendant component from
// scratch, so a component whose query() call isn't itself cached would
// register a brand-new pending promise on that remount and immediately flip
// back to the fallback again — the boundary could never settle. Toggling
// only whether the already-mounted content nodes are attached to the
// visible DOM (leaving their owner scope alive) shows/hides the same
// mounted instance instead of recreating it, so a resource it already
// resolved is never re-fetched just because the boundary's pending count
// happened to change.
function suspenseController(pending) {
    return {
        register(promise) {
            pending.value++;
            const settle = () => {
                pending.value = Math.max(0, pending.value - 1);
            };
            Promise.resolve(promise).then(settle, settle);
        }
    };
}
function suspenseToggle(parent, contentNodes, contentMarker, pending, props, options, mountAny) {
    let contentAttached = true,
        fallbackBuilt = null;
    const removeFallback = () => {
        if (!fallbackBuilt) return;
        fallbackBuilt.scope.dispose();
        for (const n of fallbackBuilt.nodes) n.remove();
        fallbackBuilt = null;
    };
    const dispose = effect(() => {
        if (pending.value > 0) {
            if (contentAttached) {
                for (const n of contentNodes) n.remove();
                contentAttached = false;
            }
            if (!fallbackBuilt) {
                fallbackBuilt = renderScope(mountAny, props.fallback ?? null, options);
                parent.insertBefore(fallbackBuilt.fragment, contentMarker);
            }
        } else {
            removeFallback();
            if (!contentAttached) {
                for (const n of contentNodes) parent.insertBefore(n, contentMarker);
                contentAttached = true;
            }
        }
    }, {
        sync: true
    });
    return () => {
        dispose();
        removeFallback();
    };
}
export function Suspense(props) {
    // SSR (and any other non-__litheMount/__litheClaim consumer) just gets
    // the children directly — there is no client-only DOM to keep alive
    // across a pending toggle in that context.
    return props.children ?? null;
}
Suspense.__litheMount = ({
    parent,
    before,
    props,
    options,
    mountAny
}) => {
    const pending = signal(0);
    const controller = suspenseController(pending);
    const content = renderScope(mountAny, h(SuspenseContext.Provider, {
        value: controller
    }, props.children), options);
    const contentMarker = document.createComment('lithe:suspense');
    parent.insertBefore(contentMarker, before);
    parent.insertBefore(content.fragment, contentMarker);
    const disposeToggle = suspenseToggle(parent, content.nodes, contentMarker, pending, props, options, mountAny);
    onCleanup(() => {
        disposeToggle();
        content.scope.dispose();
        for (const n of content.nodes) n.remove();
        contentMarker.remove();
    });
    return {
        nodes: [contentMarker, ...content.nodes]
    };
};
Suspense.__litheClaim = ({
    parent,
    node,
    props,
    options,
    claim,
    mountAny
}) => {
    const pending = signal(0);
    const controller = suspenseController(pending);
    let claimed;
    const scope = createScope(() => {
        claimed = claim(parent, node, h(SuspenseContext.Provider, {
            value: controller
        }, props.children), options);
    });
    const contentNodes = claimed.nodes;
    const contentMarker = document.createComment('lithe:suspense');
    parent.insertBefore(contentMarker, claimed.next);
    const disposeToggle = suspenseToggle(parent, contentNodes, contentMarker, pending, props, options, mountAny);
    onCleanup(() => {
        disposeToggle();
        scope.dispose();
        for (const n of contentNodes) n.remove();
        contentMarker.remove();
    });
    return {
        next: contentMarker.nextSibling,
        nodes: [contentMarker, ...contentNodes]
    };
};
export function lazy(loader, options = {}) {
    let component = null,
        promise = null;
    // Shared once per lazy()-wrapped component, not per Lazy() instance: the
    // load itself is already shared (component/promise above), but each
    // instance previously created its own local `tick` signal, so only
    // whichever instance happened to be first to see `!component && !promise`
    // ever got notified when the module resolved. Any other instance
    // mounted while that load was still pending kept re-reading a `tick`
    // nobody bumped and stayed stuck on the fallback forever.
    const tick = signal(0);
    return function Lazy(props) {
        if (!component && !promise) promise = Promise.resolve(loader()).then(mod => {
            component = mod?.default || mod;
            tick.value++;
            return component;
        }).catch(error => {
            promise = null;
            if (options.onError) options.onError(error); else queueMicrotask(() => {
                throw error;
            });
        });
        return dynamic(() => {
            tick.value;
            if (!component) return typeof options.fallback === 'function' ? options.fallback() : options.fallback ?? null;
            return h(component, props, ...(props.children || []));
        });
    };
}
export function lazyEvent(loader, exportName = 'default') {
    let loaded;
    return async function (...args) {
        loaded ||= Promise.resolve(loader()).then(mod => mod?.[exportName] ?? (exportName === 'default' ? mod?.default : undefined));
        const fn = await loaded;
        if (typeof fn !== 'function') throw new TypeError(`Lazy event export ${exportName} is not a function.`);
        return fn.apply(this, args);
    };
}
export { Fragment };
