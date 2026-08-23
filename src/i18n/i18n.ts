import { signal, computed } from '../core/reactive.ts';

function getPath(obj, path) { return String(path).split('.').reduce((o,k) => o?.[k], obj); }
function interpolate(text, vars) { return String(text).replace(/\{(\w+)\}/g, (_,k) => vars?.[k] ?? `{${k}}`); }

export function createI18n(options = {}) {
  const locale = signal(options.locale || options.fallbackLocale || 'en');
  const dictionaries = new Map(Object.entries(options.messages || {}));
  const fallback = options.fallbackLocale || 'en';
  const load = async (next) => {
    if (!dictionaries.has(next) && options.loader) dictionaries.set(next, await options.loader(next));
    locale.value = next;
  };
  const t = (key, vars = {}) => {
    const dictionary = dictionaries.get(locale.value) || dictionaries.get(fallback) || {};
    let value = getPath(dictionary,key);
    if (value == null && locale.value !== fallback) value = getPath(dictionaries.get(fallback) || {},key);
    if (value == null) return options.missing?.(key,locale.value) ?? key;
    if (typeof value === 'object' && vars.count != null) {
      const rule = new Intl.PluralRules(locale.value).select(Number(vars.count));
      value = value[rule] ?? value.other ?? value.one;
    }
    return interpolate(value,vars);
  };
  return {
    locale, t, load,
    number:(v,opts) => new Intl.NumberFormat(locale.value,opts).format(v),
    date:(v,opts) => new Intl.DateTimeFormat(locale.value,opts).format(v instanceof Date ? v : new Date(v)),
    relative:(v,unit,opts) => new Intl.RelativeTimeFormat(locale.value,opts).format(v,unit),
    direction:computed(() => new Intl.Locale(locale.value).textInfo?.direction || (/^(ar|fa|he|ur)/.test(locale.value) ? 'rtl' : 'ltr')),
    addMessages(lang,messages) { dictionaries.set(lang,{...(dictionaries.get(lang)||{}),...messages}); }
  };
}
