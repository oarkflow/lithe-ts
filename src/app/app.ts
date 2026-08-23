import { createRouter } from '../router/router.ts';
import { mount } from '../dom/dom.ts';
import { h } from '../dom/vnode.ts';
import { createNetworkState } from '../offline/offline.ts';
import { createDevtools } from '../devtools/devtools.ts';

export function defineApp(config) { return Object.freeze({...config}); }

export function startApp(config) {
  const router=config.router || (config.routes ? createRouter({routes:config.routes,notFound:config.notFound}) : null);
  const network=createNetworkState();
  const cleanups=[network.start()];
  if(router) cleanups.push(router.start());
  const root=typeof config.root==='string'?document.querySelector(config.root):config.root||document.getElementById('app');
  const App=config.component || (()=>router?h(router.View,{}):null);
  cleanups.push(mount(root,h(App,{router,network}),config.mount));
  let devtools;
  if(config.devtools!==false && globalThis.location?.hostname==='localhost'){ devtools=createDevtools(); cleanups.push(devtools.installGlobal()); cleanups.push(()=>devtools.dispose()); }
  return {router,network,dispose(){cleanups.reverse().forEach(fn=>fn?.());}};
}
