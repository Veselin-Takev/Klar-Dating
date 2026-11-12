import type { Firestore } from 'firebase-admin/firestore';
import { vi } from 'vitest';
import { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
type Data = Record<string, unknown>;
type Ref = {path: string};
type Clause = readonly [string, string, unknown];
/** SDK port double; the production repository supplies all path enforcement. */
export function tenantRepositoryHarness(initial: Record<string, Data> = {}, fail?: (path: string, action: 'read' | 'write') => void, onWrite?: (path: string, data: Data, options?: {merge?:boolean}) => void) {
  const prefix = 'tenants/default/', store = new Map(Object.entries(initial).map(([path,data]) => [prefix+path,data]));
  const set = vi.fn(), create = vi.fn(), remove = vi.fn(), paths = vi.fn(), queries = vi.fn();
  const check = (path: string, action: 'read' | 'write') => { if (!path.startsWith(prefix)) throw new Error('unscoped_test_sdk_access'); fail?.(path, action); };
  const snapshot = (path: string) => {check(path,'read'); const data=store.get(path);return {id:path.split('/').at(-1)!, exists:data !== undefined, data:()=>data ? {...data} : undefined};};
  const write = (path: string, data: Data, options?: {merge?:boolean}) => {check(path,'write');set(data, options);onWrite?.(path,data,options);store.set(path,options?.merge ? {...store.get(path),...data} : {...data});};
  const doc = (path: string) => {paths(path);return {path, get:async()=>snapshot(path), set:async(data:Data,options?:{merge?:boolean})=>write(path,data,options), create:async(data:Data)=>{check(path,'write');if(store.has(path))throw new Error('Already exists');create(data);onWrite?.(path,data);store.set(path,{...data});}, delete:async()=>{check(path,'write');remove(path);store.delete(path);}};};
  const millis=(value:unknown):unknown => value instanceof Date ? value.getTime() : value;
  function collection(path:string, clauses:Clause[]=[], order?:string, direction='asc', count=200, cursor?:string) {
    return {path, where:(field:string,op:string,value:unknown)=>collection(path,[...clauses,[field,op,value]],order,direction,count,cursor),
      orderBy:(field:string,dir='asc')=>collection(path,clauses,field,dir,count,cursor), limit:(n:number)=>collection(path,clauses,order,direction,n,cursor), startAfter:(id:string)=>collection(path,clauses,order,direction,count,id),
      get:async()=>{
        check(path,'read');queries(path,{clauses,order,direction,count,cursor});
        let rows=[...store].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')).map(([key,data])=>({id:key.split('/').at(-1)!,data}));
        for(const [field,op,wanted] of clauses) rows=rows.filter(row=>{
          const value=row.data[field];
          if(op==='==')return value===wanted;
          if(op==='array-contains')return Array.isArray(value)&&value.includes(wanted);
          if(op==='in')return Array.isArray(wanted)&&wanted.includes(value);
          if(op==='<=')return (millis(value) as number)<=(millis(wanted) as number);
          throw new Error('unsupported_test_operator');
        });
        rows.sort((a,b)=>{const left=order&&order!=='__name__'?millis(a.data[order]):a.id,right=order&&order!=='__name__'?millis(b.data[order]):b.id;return(left===right?0:(left as string)<(right as string)?-1:1)*(direction==='desc'?-1:1);});
        if(cursor)rows=rows.filter(row=>row.id>cursor!);
        return {docs:rows.slice(0,count).map(row=>({id:row.id,data:()=>({...row.data})}))};
      }};
  }
  const native={doc,collection,runTransaction:async<T>(callback:(tx:unknown)=>Promise<T>)=>callback({
    get:async(ref:Ref&{get?:()=>Promise<unknown>})=>ref.get ? ref.get() : snapshot(ref.path),
    set:(ref:Ref,data:Data,options?:{merge?:boolean})=>write(ref.path,data,options),
    create:(ref:Ref,data:Data)=>{check(ref.path,'write');if(store.has(ref.path))throw new Error('Already exists');create(data);onWrite?.(ref.path,data);store.set(ref.path,{...data});},
    delete:(ref:Ref)=>{check(ref.path,'write');remove(ref.path);store.delete(ref.path);},
  })};
  return {repo:new TenantAwareFirestoreRepository(native as unknown as Firestore,'default'),store,set,create,remove,paths,queries};
}
