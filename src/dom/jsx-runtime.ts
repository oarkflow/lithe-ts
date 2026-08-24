export { h as jsx, h as jsxs, h as jsxDEV, Fragment } from './vnode.ts';

export namespace JSX {
  export type Element = any;
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicAttributes {
    key?: any;
  }
  export interface HTMLAttributes {
    class?: string | (() => string) | any;
    className?: string | (() => string) | any;
    id?: string | (() => string);
    style?: string | Record<string, any> | (() => any);
    title?: string | (() => string);
    hidden?: boolean | (() => boolean);
    tabIndex?: number | (() => number);
    role?: string;
    type?: string;
    value?: any;
    placeholder?: string | (() => string);
    disabled?: boolean | (() => boolean);
    checked?: boolean | (() => boolean);
    href?: string;
    src?: string;
    alt?: string;
    target?: string;
    rel?: string;
    name?: string;
    for?: string;
    htmlFor?: string;
    children?: any;
    onClick?: any;
    onInput?: any;
    onChange?: any;
    onSubmit?: any;
    onKeyDown?: any;
    onKeyUp?: any;
    onFocus?: any;
    onBlur?: any;
    onMouseEnter?: any;
    onMouseLeave?: any;
    [key: string]: any;
  }
  export interface IntrinsicElements {
    [elemName: string]: HTMLAttributes;
  }
}
