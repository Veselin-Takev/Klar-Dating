import { expect, test } from '@playwright/test';
import { authHeaders, completeAgeAndConsent, createAccount, enterGuestPreview } from './identity-helpers';

test('guest age completion never authorizes profile/media APIs', async ({page}) => {
  await enterGuestPreview(page);
  await completeAgeAndConsent(page);
  for(const path of ['/api/recommendations','/api/chats','/api/date-planner/connections']) {
    const response=await page.request.get(path,{headers:await authHeaders(page)});
    expect(response.status()).toBe(403);
    expect(await response.json()).not.toHaveProperty('recommendations');
  }
});

test('authoritative minor state denies profile APIs despite an authenticated session',async({request})=>{
  const actor=await createAccount(request);
  const seeded=await request.patch(`http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents/tenants/default/users/${actor.uid}?updateMask.fieldPaths=isAdult&updateMask.fieldPaths=mediaAccessState`,{
    headers:{Authorization:'Bearer owner'},data:{fields:{isAdult:{booleanValue:false},mediaAccessState:{stringValue:'blocked'}}},
  });
  expect(seeded.status()).toBe(200);
  const response=await request.get('/api/recommendations',{headers:actor.headers});
  expect(response.status()).toBe(401);
  expect(await response.json()).not.toHaveProperty('recommendations');
});

test('deletion acceptance persists the media fence and denies further API/media writes',async({request})=>{
  const actor=await createAccount(request);
  const accepted=await request.post('/api/account/delete',{headers:actor.headers,data:{}});
  expect(accepted.status()).toBe(202);
  expect(await accepted.json()).toMatchObject({status:'pending'});
  const saved=await request.get(`http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents/tenants/default/users/${actor.uid}`,{headers:{Authorization:'Bearer owner'}});
  expect((await saved.json()).fields.mediaAccessState.stringValue).toBe('erasing');
  const job=await request.get(`http://127.0.0.1:8080/v1/projects/demo-klar/databases/(default)/documents/tenants/default/account_deletions/${actor.uid}`,{headers:{Authorization:'Bearer owner'}});
  expect((await job.json()).fields.status.stringValue).toBe('pending');
  const response=await request.get('/api/recommendations',{headers:actor.headers});
  expect([401,409]).toContain(response.status());
  const upload=await request.post(`http://127.0.0.1:9199/v0/b/demo-klar.appspot.com/o?uploadType=media&name=${encodeURIComponent(`verification/${actor.uid}/after-delete.jpg`)}`,{headers:{...actor.headers,'Content-Type':'image/jpeg'},data:Buffer.from([0xff,0xd8,0xff,0xe0])});
  expect([401,403]).toContain(upload.status());
});
