import { createForm, getPath, setPath } from './form.ts';
import { getOwner, onCleanup } from '../core/owner.ts';
function uid() {
    return globalThis.crypto?.randomUUID?.() || `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
// insert/remove/move re-index the array's data and stable id list together,
// but errors/touched/dirty are keyed by path (e.g. "items.0.name") and were
// left untouched — after a reorder those flags stayed pinned to their old
// index and ended up describing the wrong (shifted) item. mapIndex(oldIndex)
// returns the item's new index, or null if it was removed.
function remapFieldArrayPaths(form, name, mapIndex) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escaped}\\.(\\d+)(\\..*)?$`);
    for (const store of [form.errors, form.touched, form.dirty]) {
        const moves = [];
        for (const key of Object.keys(store)) {
            const m = key.match(re);
            if (!m) continue;
            moves.push({
                key,
                value: store[key],
                newIndex: mapIndex(Number(m[1])),
                suffix: m[2] || ''
            });
        }
        for (const move of moves) delete store[move.key];
        for (const move of moves) {
            if (move.newIndex == null) continue;
            store[`${name}.${move.newIndex}${move.suffix}`] = move.value;
        }
    }
}
export function createAdvancedForm(options = {}) {
    let timer;
    const storage = options.storage || globalThis.localStorage,
        key = options.draftKey || 'lithe:form-draft';
    const schedule = () => {
        if (!options.autosave) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const snapshot = typeof structuredClone === 'function' ? structuredClone(form.values) : JSON.parse(JSON.stringify(form.values));
            if (typeof options.autosave === 'function') await options.autosave(snapshot); else await storage?.setItem?.(key, JSON.stringify(snapshot));
        }, options.autosaveDelay ?? 350);
        timer.unref?.();
    };
    const form = createForm({
        ...options,
        onChange(info) {
            options.onChange?.(info);
            schedule();
        }
    }),
        ids = new Map();
    const disposeForm = form.dispose;
    form.dispose = () => {
        clearTimeout(timer);
        disposeForm();
    };
    if (getOwner()) onCleanup(() => clearTimeout(timer));
    form.fieldArray = name => {
        const arr = () => getPath(form.values, name) || [];
        let list = ids.get(name);
        if (!list) {
            list = arr().map(() => uid());
            ids.set(name, list);
        }
        const dirty = () => {
            form.set(name, arr());
            schedule();
        };
        return {
            get fields() {
                while (list.length < arr().length) list.push(uid());
                list.length = arr().length;
                return arr().map((value, index) => ({
                    id: list[index],
                    index,
                    value,
                    path: `${name}.${index}`
                }));
            },
            append(v) {
                arr().push(v);
                list.push(uid());
                dirty();
            },
            insert(i, v) {
                arr().splice(i, 0, v);
                list.splice(i, 0, uid());
                remapFieldArrayPaths(form, name, old => old >= i ? old + 1 : old);
                dirty();
            },
            remove(i) {
                arr().splice(i, 1);
                list.splice(i, 1);
                remapFieldArrayPaths(form, name, old => old === i ? null : old > i ? old - 1 : old);
                dirty();
            },
            move(a, b) {
                const [v] = arr().splice(a, 1);
                arr().splice(b, 0, v);
                const [id] = list.splice(a, 1);
                list.splice(b, 0, id);
                remapFieldArrayPaths(form, name, old => {
                    if (old === a) return b;
                    if (a < b) return old > a && old <= b ? old - 1 : old;
                    return old >= b && old < a ? old + 1 : old;
                });
                dirty();
            },
            replace(v) {
                setPath(form.values, name, [...v]);
                list = v.map(() => uid());
                ids.set(name, list);
                // A full replace has no correspondence to the old indices'
                // items, so their stale error/touched/dirty flags must not
                // survive to be misread against the new content.
                remapFieldArrayPaths(form, name, () => null);
                dirty();
            }
        };
    };
    form.restoreDraft = async () => {
        let draft;
        if (typeof options.restoreDraft === 'function') draft = await options.restoreDraft(); else try {
            draft = JSON.parse((await storage?.getItem?.(key)) || 'null');
        } catch (e) {
            console.warn('[lithe:forms] Failed to restore draft:', e);
        }
        if (!draft) return false;
        form.reset(draft);
        return true;
    };
    form.clearDraft = async () => typeof options.clearDraft === 'function' ? options.clearDraft() : storage?.removeItem?.(key);
    return form;
}
