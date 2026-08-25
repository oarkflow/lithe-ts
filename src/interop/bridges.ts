import { h } from '../dom/vnode.ts';
import { mount } from '../dom/dom.ts';
import { foreign } from './web-components.ts';
function requireFns(api, names, label) {
    for (const name of names) if (typeof api?.[name] !== 'function') throw new TypeError(`${label} bridge requires ${name}().`);
}
export function createReactBridge(React, ReactDOM) {
    requireFns(React, ['createElement'], 'React');
    if (!ReactDOM?.createRoot && !ReactDOM?.render) throw new TypeError('React bridge requires ReactDOM.createRoot() or ReactDOM.render().');
    const fromReact = Component => foreign((host, props) => {
        const element = React.createElement(Component, props);
        if (ReactDOM.createRoot) {
            const root = ReactDOM.createRoot(host);
            root.render(element);
            return () => root.unmount?.();
        }
        ReactDOM.render(element, host);
        return () => ReactDOM.unmountComponentAtNode?.(host);
    });
    const toReact = Component => {
        if (!React.useRef || !(React.useLayoutEffect || React.useEffect)) throw new TypeError('React toReact() bridge requires hooks.');
        const useEffect = React.useLayoutEffect || React.useEffect;
        return function LitheInReact(props) {
            const ref = React.useRef(null);
            useEffect(() => {
                if (!ref.current) return;
                return mount(ref.current, h(Component, props), {
                    clear: true
                });
            }, [props]);
            return React.createElement('span', {
                ref,
                style: {
                    display: 'contents'
                }
            });
        };
    };
    return {
        fromReact,
        toReact
    };
}
export function createVueBridge(Vue) {
    if (!Vue?.h) throw new TypeError('Vue bridge requires h().');
    const fromVue = Component => foreign((host, props) => {
        if (Vue.createApp) {
            const app = Vue.createApp(Component, props);
            app.mount(host);
            return () => app.unmount?.();
        }
        if (Vue.render) {
            Vue.render(Vue.h(Component, props), host);
            return () => Vue.render(null, host);
        }
        throw new TypeError('Vue bridge requires createApp() or render().');
    });
    const toVue = Component => ({
        name: 'LitheBridge',
        mounted() {
            this.__litheDispose = mount(this.$refs.host, h(Component, this.$props || {}), {
                clear: true
            });
        },
        beforeUnmount() {
            this.__litheDispose?.();
        },
        render() {
            return Vue.h('span', {
                ref: 'host',
                style: {
                    display: 'contents'
                }
            });
        }
    });
    return {
        fromVue,
        toVue
    };
}
export function createSvelteBridge(Svelte = {}) {
    return {
        fromSvelte(Component) {
            return foreign((host, props) => {
                if (typeof Svelte.mount === 'function') {
                    const instance = Svelte.mount(Component, {
                        target: host,
                        props
                    });
                    return () => Svelte.unmount?.(instance);
                }
                const instance = new Component({
                    target: host,
                    props
                });
                return () => instance.$destroy?.();
            });
        },
        mountLithe(target, Component, props = {}) {
            return mount(target, h(Component, props), {
                clear: true
            });
        }
    };
}
export function createExternalBridge(adapter) {
    if (typeof adapter?.mount !== 'function') throw new TypeError('External bridge requires mount(host, component, props).');
    return {
        fromExternal: Component => foreign((host, props) => adapter.mount(host, Component, props)),
        mountLithe(target, Component, props = {}) {
            return mount(target, h(Component, props), {
                clear: true
            });
        }
    };
}
