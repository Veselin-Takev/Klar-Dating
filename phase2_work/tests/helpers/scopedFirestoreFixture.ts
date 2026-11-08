import type { Firestore } from 'firebase-admin/firestore';
import { getDb as nativeDatabase } from '../../src/server/db';
const fixtures = new WeakMap<Firestore, Firestore>();
/** Native emulator fixtures use the staged default namespace. Never a production adapter. */
export function scopedFirestoreFixture(): Firestore {
  const host=process.env.FIRESTORE_EMULATOR_HOST;
  if(!host||!/^(localhost|127\.0\.0\.1|\[::1\]):[0-9]+$/.test(host)) throw new Error('tenant_fixture_requires_loopback_emulator');
  const db=nativeDatabase(), cached=fixtures.get(db);
  if(cached)return cached;
  const scoped=(path:string)=>path.startsWith('tenants/')?path:'tenants/default/'+path;
  const proxy=new Proxy(db, {get(target,key,receiver){
    if(key==='doc')return(path:string)=>target.doc(scoped(path));
    if(key==='collection')return(path:string)=>target.collection(scoped(path));
    const value=Reflect.get(target,key,receiver);return typeof value==='function'?value.bind(target):value;
  }});
  fixtures.set(db,proxy);return proxy;
}
