// Produces a standalone browser module registering a compiled Lithe component as a Custom Element.
export function customElementModule({
    name,
    componentImport,
    exportName = 'default',
    observedAttributes = [],
    shadow = true
}) {
    if (!/^[a-z][a-z0-9.-]*-[a-z0-9.-]+$/.test(name)) throw new Error('Custom element name must contain a hyphen.');
    return `import Component from ${JSON.stringify(componentImport)};\nimport { defineElement } from '@lithe/interop';\ndefineElement(${JSON.stringify(name)}, Component, ${JSON.stringify({
        observedAttributes,
        shadow
    })});\nexport default customElements.get(${JSON.stringify(name)});\n`.replace('import Component', exportName === 'default' ? 'import Component' : `import { ${exportName} as Component }`);
}
