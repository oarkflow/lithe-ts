import { createHostRenderer } from './renderer.ts';
export function createNativeRenderer(driver){return createHostRenderer(driver);}
export function createMemoryNativeDriver(){
  const detach=node=>{const p=node?.parent;if(!p)return;const i=p.children.indexOf(node);if(i>=0)p.children.splice(i,1);node.parent=null;};
  return{
    createRoot(type='root'){return{type,props:{},children:[],parent:null};},
    createElement(type){return{type,props:{},children:[],parent:null};},
    createText(value){return{type:'#text',value:String(value),children:[],parent:null};},
    insert(parent,node,before=null){detach(node);node.parent=parent;const i=before?parent.children.indexOf(before):-1;if(i>=0)parent.children.splice(i,0,node);else parent.children.push(node);},
    remove(node,parent=node?.parent){if(!node||!parent)return;const i=parent.children.indexOf(node);if(i>=0)parent.children.splice(i,1);node.parent=null;},
    setProperty(node,key,value){node.props[key]=value;},
    snapshot(root){const clean=n=>n.type==='#text'?n.value:{type:n.type,props:{...n.props},children:n.children.map(clean)};return clean(root);}
  };
}
