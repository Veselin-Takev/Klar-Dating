import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({auth:{currentUser:{uid:'viewer'} as {uid:string}|null},changed:undefined as ((user:{uid:string}|null)=>void)|undefined,request:vi.fn(),unsubscribe:vi.fn()}));
vi.mock('../src/lib/firebase',()=>({auth:state.auth}));
vi.mock('../src/lib/authFetch',()=>({authFetch:state.request}));
vi.mock('firebase/auth',()=>({onIdTokenChanged:(_auth:unknown,changed:(user:{uid:string}|null)=>void)=>{state.changed=changed;changed(state.auth.currentUser);return state.unsubscribe;}}));
import {ProtectedImage} from '../src/components/ProtectedImage';
const create=vi.fn(()=> 'blob:protected-image'),revoke=vi.fn();
Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});
Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke});
afterEach(()=>{cleanup();vi.clearAllMocks();state.auth.currentUser={uid:'viewer'};state.changed=undefined;});
it('uses a credentialed no-store request, then releases the local blob on logout',async()=>{
 state.request.mockResolvedValue(new Response('synthetic',{status:200}));
 render(<ProtectedImage src="/api/media/profiles/owner/photo.jpg" alt="Profilbild" />);
 await waitFor(()=>expect(screen.getByAltText('Profilbild')).toHaveAttribute('src','blob:protected-image'));
 expect(state.request).toHaveBeenCalledWith('/api/media/profiles/owner/photo.jpg',expect.objectContaining({cache:'no-store',signal:expect.any(AbortSignal)}));
 await act(async()=>{state.auth.currentUser=null;state.changed?.(null)});
 expect(screen.getByAltText('Profilbild')).not.toHaveAttribute('src');expect(revoke).toHaveBeenCalledWith('blob:protected-image');
});
it('aborts in-flight media and refuses to render its eventual result after sign-out',async()=>{
 let resolve!:(response:Response)=>void;
 state.request.mockImplementation(()=>new Promise<Response>(done=>{resolve=done}));
 render(<ProtectedImage src="/api/media/profiles/owner/photo.jpg" alt="Privat" />);
 const signal=state.request.mock.calls[0]![1].signal as AbortSignal;
 await act(async()=>{state.auth.currentUser=null;state.changed?.(null);resolve(new Response('synthetic',{status:200}))});
 expect(signal.aborted).toBe(true);expect(create).not.toHaveBeenCalled();expect(screen.getByAltText('Privat')).not.toHaveAttribute('src');
});
