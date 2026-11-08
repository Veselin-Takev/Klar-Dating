import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';

/** Transitional SDK fixture adapter, for unit doubles only. Never used by app code.
 * Assert the production repository's full tenant prefix before mapping to the
 * unit fixture's relative-key tables. Native emulator suites verify isolation.
 */
export function scopedSdkFixture(fixture: unknown): TenantAwareFirestoreRepository {
  // Legacy fixture contracts vary; this boundary is intentionally test-only.
  const db = fixture as any;
  const relative = (path: string) => { assert.match(path, /^tenants\/default\//); return path.slice('tenants/default/'.length); };
  const collectionAt = (path: string): any => {
    const parts=path.split('/'); let col=db.collection(parts[0]);
    for(let i=1;i<parts.length;i+=2){const doc=col.doc(parts[i]);col=typeof doc.collection==='function'?doc.collection(parts[i+1]):db.collection(parts.slice(0,i+2).join('/'));}
    return col;
  };
  const docAt=(path:string):any=>{const parts=path.split('/'),id=parts.pop()!;return collectionAt(parts.join('/')).doc(id);};
  const query=(value:any):any=>({isQuery:true,
    where:(...args:unknown[])=>query(value.where(...args)),orderBy:(...args:unknown[])=>query(value.orderBy(...args)),startAfter:(...args:unknown[])=>query(value.startAfter(...args)),limit:(...args:unknown[])=>query(value.limit(...args)),
    get:async()=>{const snap=await value.get();if(Array.isArray(snap.docs))return snap;const docs:any[]=[];snap.forEach?.((doc:any)=>docs.push(doc));return{...snap,docs};},
  });
  const native={
    doc:(path:string)=>docAt(relative(path)),collection:(path:string)=>query(collectionAt(relative(path))),
    runTransaction:<T>(callback:(tx:unknown)=>Promise<T>):Promise<T>=>{
      const adapt=(tx:any)=>callback({
        get:async(ref:any)=>ref.isQuery?ref.get():tx.getAll?(await tx.getAll(ref))[0]:tx.get(ref),
        set:(ref:any,data:unknown,options?:{merge:boolean})=>options?.merge&&tx.update?tx.update(ref,data):tx.set(ref,data,options),
        create:(ref:any,data:unknown)=>tx.create?tx.create(ref,data):tx.set(ref,data),delete:(ref:any)=>tx.delete(ref),
      });
      return db.runTransaction?db.runTransaction(adapt):adapt({get:(ref:any)=>ref.get(),set:(ref:any,data:unknown,options:unknown)=>ref.set(data,options),create:(ref:any,data:unknown)=>ref.create?ref.create(data):ref.set(data),delete:(ref:any)=>ref.delete()});
    },
  };
  return new TenantAwareFirestoreRepository(native as unknown as Firestore,'default');
}
