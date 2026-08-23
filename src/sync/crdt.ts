function newer(a,b){if(!b)return true;if((a.clock||0)!==(b.clock||0))return(a.clock||0)>(b.clock||0);return String(a.actor||'')>String(b.actor||'');}
function uid(){return globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;}
export class LWWMap{
  constructor(actor=uid()){this.actor=actor;this.clock=0;this.records=new Map();}
  stamp(){return{clock:++this.clock,actor:this.actor};}
  set(key,value){const op={type:'set',key,value,...this.stamp()};this.apply(op);return op;}
  delete(key){const op={type:'delete',key,...this.stamp()};this.apply(op);return op;}
  apply(op){this.clock=Math.max(this.clock,op.clock||0);const current=this.records.get(op.key);if(newer(op,current))this.records.set(op.key,{...op,tombstone:op.type==='delete'});return this;}
  merge(ops){for(const op of ops||[])this.apply(op);return this;}
  get(key){const r=this.records.get(key);return r&&!r.tombstone?r.value:undefined;}
  entries(){return[...this.records].filter(([,r])=>!r.tombstone).map(([k,r])=>[k,r.value]);}
  operations(){return[...this.records.values()].map(x=>({...x}));}
  toJSON(){return Object.fromEntries(this.entries());}
}

export class ORSet{
  constructor(actor=uid()){this.actor=actor;this.clock=0;this.adds=new Map();this.removes=new Set();this.ops=new Map();}
  stamp(){return{clock:++this.clock,actor:this.actor};}
  add(value){const s=this.stamp(),tag=`${s.actor}:${s.clock}:${uid()}`,op={type:'orset:add',value,tag,...s};this.apply(op);return op;}
  remove(value){const tags=[...(this.adds.get(value)||[])].filter(t=>!this.removes.has(t)),s=this.stamp(),op={type:'orset:remove',value,tags,...s,id:`${s.actor}:${s.clock}`};this.apply(op);return op;}
  apply(op){this.clock=Math.max(this.clock,op.clock||0);const id=op.tag||op.id||`${op.actor}:${op.clock}:${op.type}`;if(this.ops.has(id))return this;this.ops.set(id,{...op});if(op.type==='orset:add'){let set=this.adds.get(op.value);if(!set)this.adds.set(op.value,set=new Set());set.add(op.tag);}else if(op.type==='orset:remove')for(const tag of op.tags||[])this.removes.add(tag);return this;}
  merge(ops){for(const op of ops||[])this.apply(op);return this;}
  has(value){return[...(this.adds.get(value)||[])].some(t=>!this.removes.has(t));}
  values(){return[...this.adds.keys()].filter(v=>this.has(v));}
  operations(){return[...this.ops.values()].map(x=>({...x,tags:x.tags?[...x.tags]:x.tags}));}
  toJSON(){return this.values();}
}

export class RGAList{
  constructor(actor=uid()){this.actor=actor;this.clock=0;this.nodes=new Map();this.ops=new Map();}
  stamp(){return{clock:++this.clock,actor:this.actor};}
  insert(value,after=null){const s=this.stamp(),id=`${s.actor}:${s.clock}:${uid()}`,op={type:'rga:insert',id,after,value,...s};this.apply(op);return op;}
  remove(id){const s=this.stamp(),op={type:'rga:remove',id,target:id,...s,opId:`${s.actor}:${s.clock}`};this.apply(op);return op;}
  apply(op){this.clock=Math.max(this.clock,op.clock||0);const opId=op.opId||`${op.type}:${op.id}:${op.actor}:${op.clock}`;if(this.ops.has(opId))return this;this.ops.set(opId,{...op});if(op.type==='rga:insert'){const current=this.nodes.get(op.id);if(!current||newer(op,current))this.nodes.set(op.id,{id:op.id,after:op.after??null,value:op.value,clock:op.clock,actor:op.actor,deleted:false,deleteStamp:null});}else if(op.type==='rga:remove'){const n=this.nodes.get(op.target);if(n&&newer(op,n.deleteStamp))n.deleted=true,n.deleteStamp={clock:op.clock,actor:op.actor};}return this;}
  merge(ops){for(const op of ops||[])this.apply(op);return this;}
  orderedNodes(){const children=new Map();for(const n of this.nodes.values()){const key=n.after??'__root__';if(!children.has(key))children.set(key,[]);children.get(key).push(n);}for(const list of children.values())list.sort((a,b)=>(a.clock-b.clock)||String(a.actor).localeCompare(String(b.actor))||String(a.id).localeCompare(String(b.id)));const out=[];const visit=key=>{for(const n of children.get(key)||[]){out.push(n);visit(n.id);}};visit('__root__');return out;}
  values(){return this.orderedNodes().filter(n=>!n.deleted).map(n=>n.value);}
  entries(){return this.orderedNodes().filter(n=>!n.deleted).map(n=>[n.id,n.value]);}
  idAt(index){return this.entries()[index]?.[0]??null;}
  operations(){return[...this.ops.values()].map(x=>({...x}));}
  toJSON(){return this.values();}
}

export class CRDTDocument{
  constructor(actor=uid(),schema={}){this.actor=actor;this.schema=schema;this.fields=new Map();this.log=new Map();for(const[field,type]of Object.entries(schema))this.ensure(field,type);}
  ensure(field,type='map'){if(this.fields.has(field))return this.fields.get(field);const value=type==='set'?new ORSet(this.actor):type==='list'?new RGAList(this.actor):new LWWMap(this.actor);this.fields.set(field,value);return value;}
  set(field,key,value){const op={...this.ensure(field,'map').set(key,value),field,crdt:'map'};this.record(op);return op;}
  delete(field,key){const op={...this.ensure(field,'map').delete(key),field,crdt:'map'};this.record(op);return op;}
  add(field,value){const op={...this.ensure(field,'set').add(value),field,crdt:'set'};this.record(op);return op;}
  remove(field,value){const op={...this.ensure(field,'set').remove(value),field,crdt:'set'};this.record(op);return op;}
  insert(field,value,after=null){const op={...this.ensure(field,'list').insert(value,after),field,crdt:'list'};this.record(op);return op;}
  removeAt(field,index){const list=this.ensure(field,'list'),id=list.idAt(index);if(!id)return null;const op={...list.remove(id),field,crdt:'list'};this.record(op);return op;}
  record(op){this.log.set(`${op.actor}:${op.clock}:${op.type}:${op.id||op.key||op.tag||''}`,{...op});return op;}
  apply(op){const type=op.crdt||this.schema[op.field]||(/orset/.test(op.type)?'set':/rga/.test(op.type)?'list':'map'),field=this.ensure(op.field,type);field.apply(op);this.record(op);return this;}
  merge(ops){for(const op of ops||[])this.apply(op);return this;}
  operations(){return[...this.log.values()].map(x=>({...x}));}
  get(field,key){const f=this.fields.get(field);return f instanceof LWWMap?f.get(key):undefined;}
  value(field){const f=this.fields.get(field);return f?.toJSON?.();}
  toJSON(){return Object.fromEntries([...this.fields].map(([k,v])=>[k,v.toJSON()]));}
}

export function createCRDTSync(document,options={}){let stop=null,sending=false,pending=[];const emit=async ops=>{if(!ops?.length)return;pending.push(...ops);if(sending||!options.send)return;sending=true;try{while(pending.length){const batch=pending.splice(0,options.batchSize||100);await options.send(batch,{actor:document.actor,snapshot:document.toJSON()});}}catch(error){options.onError?.(error);throw error;}finally{sending=false;}};const apply=ops=>{document.merge(ops);options.onChange?.(document.toJSON(),ops);};if(options.subscribe)stop=options.subscribe(apply);return{document,apply,emit,local(op){document.apply(op);options.onChange?.(document.toJSON(),[op]);return emit([op]);},dispose(){stop?.();stop=null;},get pending(){return pending.length;}};}

export const conflictStrategies={clientWins({local}){return local;},serverWins({remote}){return remote;},latest({local,remote,localAt=0,remoteAt=0}){return remoteAt>=localAt?remote:local;},merge({local,remote}){return{...(remote||{}),...(local||{})};}};
