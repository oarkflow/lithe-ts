import { signal, computed } from '../core/reactive.ts';
import { h } from '../dom/vnode.ts';

function lowerBound(offsets,value){let lo=0,hi=offsets.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(offsets[mid]<value)lo=mid+1;else hi=mid;}return Math.max(0,lo-1);}
export function createVirtualizer(options){
  const scrollTop=signal(0),viewport=signal(options.viewport||600),revision=signal(0),measurements=new Map();
  const count=typeof options.count==='function'?options.count:()=>options.count,estimate=options.estimate||40,overscan=options.overscan??5;
  const layout=computed(()=>{revision.value;const total=count(),offsets=new Array(total+1);offsets[0]=0;for(let i=0;i<total;i++)offsets[i+1]=offsets[i]+(measurements.get(i)||estimate);return{offsets,size:offsets[total]||0};});
  const range=computed(()=>{const {offsets,size}=layout.value,total=count();const start=Math.max(0,lowerBound(offsets,scrollTop.value)-overscan);let end=start;const limit=scrollTop.value+viewport.value;while(end<total&&offsets[end]<limit)end++;end=Math.min(total,end+overscan);return{start,end,total,size,offset:offsets[start]||0,offsets};});
  return{scrollTop,viewport,range,estimate,measure(index,size){if(size>0&&!Object.is(measurements.get(index),size)){measurements.set(index,size);revision.value++;}},clearMeasurements(){measurements.clear();revision.value++;},offsetFor(index){return layout.value.offsets[index]||0;},sizeFor(index){return measurements.get(index)||estimate;}};
}
export function VirtualList(props){
  const items=()=>typeof props.items==='function'?props.items():props.items||[];const v=createVirtualizer({count:()=>items().length,estimate:props.estimate||40,viewport:props.height||500,overscan:props.overscan});
  const groupOf=(item,index)=>props.groupBy?props.groupBy(item,index):null;
  const renderItems=()=>{const r=v.range.value,all=items(),children=[];for(let i=r.start;i<r.end;i++){const index=i;let ro;const ref=el=>{ro?.disconnect();ro=null;if(!el)return;const measure=()=>v.measure(index,el.getBoundingClientRect().height);measure();if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(measure);ro.observe(el);}};const group=groupOf(all[i],i),previous=i>0?groupOf(all[i-1],i-1):Symbol('first'),header=props.renderGroup&&group!==previous?props.renderGroup(group,i):null;children.push(h('div',{key:all[i]?.id??i,ref,style:()=>({position:'absolute',left:0,right:0,top:v.offsetFor(index)})},header,props.children(all[i],i)));}return children;};
  const sticky=()=>{if(!props.stickyGroups||!props.groupBy||!props.renderGroup)return null;const r=v.range.value,all=items(),i=Math.min(r.start,Math.max(0,all.length-1));if(!all.length)return null;return h('div',{style:{position:'sticky',top:0,zIndex:2}},props.renderGroup(groupOf(all[i],i),i));};
  return h('div',{style:{overflow:'auto',height:props.height||500,position:'relative'},onScroll:e=>{v.scrollTop.value=e.target.scrollTop;v.viewport.value=e.target.clientHeight;}},sticky,h('div',{style:()=>({height:v.range.value.size,position:'relative'})},renderItems));
}
export function createGridVirtualizer(options){const rows=createVirtualizer({count:options.rows,row:undefined,estimate:options.rowEstimate||40,viewport:options.height||600,overscan:options.overscan}),cols=createVirtualizer({count:options.columns,estimate:options.columnEstimate||120,viewport:options.width||800,overscan:options.overscan});return{rows,columns:cols,onScroll(event){rows.scrollTop.value=event.target.scrollTop;cols.scrollTop.value=event.target.scrollLeft;rows.viewport.value=event.target.clientHeight;cols.viewport.value=event.target.clientWidth;}};}
