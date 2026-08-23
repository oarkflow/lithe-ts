export type PathSegment = string | number;
export interface ValidationIssue { path:PathSegment[]; message:string; code:string }
export interface ParseResult<T> { success:true; data:T }
export interface ParseFailure { success:false; error:ValidationError; issues:ValidationIssue[] }
export type SafeParseResult<T> = ParseResult<T> | ParseFailure;
export type Infer<S> = S extends Schema<infer T> ? T : never;
export type SchemaShape = Record<string,Schema<any>>;
export type InferShape<S extends SchemaShape> = { [K in keyof S]: Infer<S[K]> };

type ParseFn<T> = (value:unknown,path:PathSegment[],issues:ValidationIssue[])=>T;

export class ValidationError extends Error {
  issues:ValidationIssue[];
  constructor(issues:ValidationIssue[]) { super('Validation failed'); this.name='ValidationError'; this.issues=issues; }
}

export class Schema<T=unknown> {
  _parse:ParseFn<T>;
  meta:Record<string,unknown>;
  constructor(parse:ParseFn<T>, meta:Record<string,unknown>={}) { this._parse=parse; this.meta=meta; }
  parse(value:unknown):T { const issues:ValidationIssue[]=[]; const data=this._parse(value,[],issues); if(issues.length)throw new ValidationError(issues); return data; }
  safeParse(value:unknown):SafeParseResult<T> { try{return{success:true,data:this.parse(value)}}catch(error){const e=error instanceof ValidationError?error:new ValidationError([{path:[],message:error instanceof Error?error.message:String(error),code:'unknown'}]);return{success:false,error:e,issues:e.issues}} }
  optional():Schema<T|undefined>{return new Schema((v,p,i)=>v==null?undefined:this._parse(v,p,i),{...this.meta,optional:true});}
  nullable():Schema<T|null>{return new Schema((v,p,i)=>v===null?null:this._parse(v,p,i),{...this.meta,nullable:true});}
  default(defaultValue:T|(()=>T)):Schema<T>{return new Schema((v,p,i)=>this._parse(v===undefined?(typeof defaultValue==='function'?(defaultValue as()=>T)():defaultValue):v,p,i),{...this.meta,default:defaultValue});}
  refine(predicate:(value:T)=>boolean,message='Invalid value'):Schema<T>{return new Schema((v,p,i)=>{const parsed=this._parse(v,p,i);if(!predicate(parsed))i.push({path:p,message,code:'custom'});return parsed;},this.meta);}
}

function issue(issues:ValidationIssue[],path:PathSegment[],message:string,code:string):void{issues.push({path,message,code});}

export interface StringOptions { min?:number; max?:number; pattern?:RegExp; [key:string]:unknown }
class StringSchema extends Schema<string>{
  options:StringOptions;
  constructor(options:StringOptions={}){super((value,path,issues)=>{if(typeof value!=='string'){issue(issues,path,'Expected string','type');return'';}if(options.min!=null&&value.length<options.min)issue(issues,path,`Must contain at least ${options.min} characters`,'min');if(options.max!=null&&value.length>options.max)issue(issues,path,`Must contain at most ${options.max} characters`,'max');if(options.pattern&&!options.pattern.test(value))issue(issues,path,'Invalid format','pattern');return value;},{type:'string',...options});this.options=options;}
  min(n:number):StringSchema{return new StringSchema({...this.options,min:n});}
  max(n:number):StringSchema{return new StringSchema({...this.options,max:n});}
  pattern(regex:RegExp):StringSchema{return new StringSchema({...this.options,pattern:regex});}
}
export function string(options:StringOptions={}):StringSchema{return new StringSchema(options);}

export interface NumberOptions { coerce?:boolean; min?:number; max?:number; integer?:boolean; [key:string]:unknown }
export function number(options:NumberOptions={}):Schema<number>{return new Schema((value,path,issues)=>{const n=options.coerce?Number(value):value;if(typeof n!=='number'||Number.isNaN(n)){issue(issues,path,'Expected number','type');return 0;}if(options.min!=null&&n<options.min)issue(issues,path,`Must be >= ${options.min}`,'min');if(options.max!=null&&n>options.max)issue(issues,path,`Must be <= ${options.max}`,'max');if(options.integer&&!Number.isInteger(n))issue(issues,path,'Expected integer','integer');return n;},{type:'number',...options});}

export interface BooleanOptions { coerce?:boolean; [key:string]:unknown }
export function boolean(options:BooleanOptions={}):Schema<boolean>{return new Schema((value,path,issues)=>{if(options.coerce&&(value==='true'||value==='1'||value===1))return true;if(options.coerce&&(value==='false'||value==='0'||value===0))return false;if(typeof value!=='boolean'){issue(issues,path,'Expected boolean','type');return false;}return value;},{type:'boolean',...options});}

export function literal<const T>(expected:T):Schema<T>{return new Schema((value,path,issues)=>{if(!Object.is(value,expected))issue(issues,path,`Expected ${String(expected)}`,'literal');return value as T;},{type:'literal',expected});}
export function enumOf<const T extends readonly unknown[]>(values:T):Schema<T[number]>{const set=new Set<unknown>(values);return new Schema((value,path,issues)=>{if(!set.has(value))issue(issues,path,`Expected one of ${values.join(', ')}`,'enum');return value as T[number];},{type:'enum',values});}

export interface ArrayOptions { min?:number; max?:number; [key:string]:unknown }
export function array<T>(item:Schema<T>,options:ArrayOptions={}):Schema<T[]>{return new Schema((value,path,issues)=>{if(!Array.isArray(value)){issue(issues,path,'Expected array','type');return [];}if(options.min!=null&&value.length<options.min)issue(issues,path,`Expected at least ${options.min} items`,'min');if(options.max!=null&&value.length>options.max)issue(issues,path,`Expected at most ${options.max} items`,'max');return value.map((entry,index)=>item._parse(entry,[...path,index],issues));},{type:'array',item,...options});}

export function object<S extends SchemaShape>(shape:S,options:{passthrough?:boolean;[key:string]:unknown}={}):Schema<InferShape<S>>{return new Schema((value,path,issues)=>{if(!value||typeof value!=='object'||Array.isArray(value)){issue(issues,path,'Expected object','type');return{} as InferShape<S>;}const input=value as Record<string,unknown>,out:Record<string,unknown>={};for(const[key,schema]of Object.entries(shape))out[key]=schema._parse(input[key],[...path,key],issues);if(options.passthrough)for(const[key,val]of Object.entries(input))if(!(key in shape))out[key]=val;return out as InferShape<S>;},{type:'object',shape,...options});}

export function union<const S extends readonly Schema<any>[]>(schemas:S):Schema<Infer<S[number]>>{return new Schema((value,path,issues)=>{for(const schema of schemas){const result=schema.safeParse(value);if(result.success)return result.data as Infer<S[number]>;}issue(issues,path,'No union variant matched','union');return value as Infer<S[number]>;},{type:'union',schemas});}

export interface DateOptions { coerce?:boolean; [key:string]:unknown }
export function date(options:DateOptions={}):Schema<Date>{return new Schema((value,path,issues)=>{const parsed=value instanceof Date?value:options.coerce?new Date(value as string|number):value;if(!(parsed instanceof Date)||Number.isNaN(parsed.getTime())){issue(issues,path,'Expected valid date','date');return new Date(0);}return parsed;},{type:'date',...options});}
export function email():Schema<string>{return string().refine(value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),'Invalid email address');}
export function url():Schema<string>{return string().refine(value=>{try{new URL(value);return true}catch{return false}},'Invalid URL');}
