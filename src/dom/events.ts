const ROOT_EVENTS = Symbol('lithe.events');

function eventName(prop) {
  return prop.slice(2).toLowerCase();
}

export function isEventProp(key) { return /^on[A-Z]/.test(key); }

export function setDirectEvent(element, prop, handler, previous) {
  const name = eventName(prop);
  if (previous) element.removeEventListener(name, previous);
  if (handler) element.addEventListener(name, handler);
}

export function installDelegatedEvents(root, eventTypes = ['click', 'input', 'change', 'submit', 'keydown', 'keyup', 'pointerdown', 'pointerup']) {
  if (root[ROOT_EVENTS]) return root[ROOT_EVENTS];
  const disposers = [];
  for (const type of eventTypes) {
    const listener = (event) => {
      let node = event.target;
      const key = `__lithe_${type}`;
      while (node && node !== root.parentNode) {
        const handler = node[key];
        if (handler) {
          handler.call(node, event);
          if (event.cancelBubble) break;
        }
        if (node === root) break;
        node = node.parentNode;
      }
    };
    root.addEventListener(type, listener);
    disposers.push(() => root.removeEventListener(type, listener));
  }
  const dispose = () => { for (const fn of disposers) fn(); delete root[ROOT_EVENTS]; };
  root[ROOT_EVENTS] = dispose;
  return dispose;
}

export function setDelegatedEvent(element, prop, handler) {
  element[`__lithe_${eventName(prop)}`] = handler;
}
