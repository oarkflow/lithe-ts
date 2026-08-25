import { flushSync } from '../core/scheduler.ts';
import { mount } from '../dom/dom.ts';
export function render(view, options = {}) {
    if (typeof document === 'undefined') throw new Error('DOM testing requires a browser-like DOM. Core/server modules can be tested with node:test directly.');
    const root = options.root || document.createElement('div');
    const dispose = mount(root, view, options);
    return {
        root,
        dispose,
        text: () => root.textContent,
        html: () => root.innerHTML,
        query: selector => root.querySelector(selector),
        queryAll: selector => [...root.querySelectorAll(selector)]
    };
}
export function tick(fn) {
    if (fn) fn();
    flushSync();
    return Promise.resolve();
}
export function click(element) {
    element.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true
    }));
    flushSync();
}
export function input(element, value) {
    element.value = value;
    element.dispatchEvent(new Event('input', {
        bubbles: true,
        cancelable: true
    }));
    flushSync();
}
export function assert(condition, message = 'Assertion failed') {
    if (!condition) throw new Error(message);
}
