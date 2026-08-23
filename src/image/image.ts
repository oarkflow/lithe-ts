import { h } from '../dom/vnode.ts';

export function Image(props) {
  const { src, alt='', widths=[], sizes, loading='lazy', decoding='async', ...rest } = props;
  const srcset = props.srcset || (widths.length ? widths.map((w)=>`${transformImageURL(src,w,props)} ${w}w`).join(', ') : undefined);
  return h('img',{...rest,src,alt,srcset,sizes,loading,decoding,width:props.width,height:props.height,fetchpriority:props.fetchPriority});
}
export function transformImageURL(src,width,options={}) {if (typeof options.loader === 'function') return options.loader({src,width,quality:options.quality,format:options.format});return src;}
function canvasFor(width,height){if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(width,height);if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}throw new Error('No native canvas implementation is available for image transcoding.');}
async function bitmapFrom(input){if(typeof createImageBitmap!=='function')throw new Error('Native createImageBitmap() is unavailable.');if(input instanceof Blob)return createImageBitmap(input);if(input instanceof ArrayBuffer||ArrayBuffer.isView(input))return createImageBitmap(new Blob([input]));return createImageBitmap(input);}
async function canvasBlob(canvas,type,quality){if(typeof canvas.convertToBlob==='function')return canvas.convertToBlob({type,quality});return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error(`Native encoder does not support ${type}.`)),type,quality));}
export async function transcodeImage(input,options={}){const type=options.type||options.format||'image/webp',bitmap=await bitmapFrom(input);try{const width=options.width||bitmap.width,height=options.height||Math.round(bitmap.height*(width/bitmap.width)),canvas=canvasFor(width,height),ctx=canvas.getContext('2d',{alpha:options.alpha!==false});ctx.drawImage(bitmap,0,0,width,height);const blob=await canvasBlob(canvas,type,options.quality??0.82);if(!blob||blob.type!==type&&options.strict!==false)throw new Error(`Native encoder did not produce ${type}.`);return blob;}finally{bitmap.close?.();}}
export async function supportsImageEncoding(type='image/webp'){try{const canvas=canvasFor(1,1),blob=await canvasBlob(canvas,type,0.8);return Boolean(blob&&blob.type===type);}catch{return false;}}
export async function imageDimensions(input){const bitmap=await bitmapFrom(input);try{return{width:bitmap.width,height:bitmap.height};}finally{bitmap.close?.();}}
