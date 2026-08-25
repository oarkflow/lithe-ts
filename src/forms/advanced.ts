import { createForm, getPath, setPath } from './form.ts';
function uid() {
    return globalThis.crypto?.randomUUID?.() || `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
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
                dirty();
            },
            remove(i) {
                arr().splice(i, 1);
                list.splice(i, 1);
                dirty();
            },
            move(a, b) {
                const [v] = arr().splice(a, 1);
                arr().splice(b, 0, v);
                const [id] = list.splice(a, 1);
                list.splice(b, 0, id);
                dirty();
            },
            replace(v) {
                setPath(form.values, name, [...v]);
                list = v.map(() => uid());
                ids.set(name, list);
                dirty();
            }
        };
    };
    form.restoreDraft = async () => {
        let draft;
        if (typeof options.restoreDraft === 'function') draft = await options.restoreDraft(); else try {
            draft = JSON.parse((await storage?.getItem?.(key)) || 'null');
        } catch { }
        if (!draft) return false;
        form.reset(draft);
        return true;
    };
    form.clearDraft = async () => typeof options.clearDraft === 'function' ? options.clearDraft() : storage?.removeItem?.(key);
    return form;
}
