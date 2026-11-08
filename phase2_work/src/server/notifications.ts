import { getMessaging } from 'firebase-admin/messaging';
import { getServiceRepository } from './firestoreRepository/nativeDatabase';
import { z } from 'zod';
const record = z.record(z.string(), z.unknown());
export async function sendPushNotification(userId: string, title: string, body: string) {
  try {
    const db = getServiceRepository('auth');
    if (await db.read(`account_deletions/${userId}`, record)) return;
    const rows = await db.listAll(`users/${userId}/fcmTokens`, record);
    for (let offset=0;offset<rows.length;offset+=500) {
      if (await db.read(`account_deletions/${userId}`, record)) return;
      const tokens=rows.slice(offset,offset+500).map(row=>row.id);
      const response=await getMessaging().sendEachForMulticast({tokens,notification:{title,body},data:{click_action:'FLUTTER_NOTIFICATION_CLICK'}});
      const invalid=response.responses.flatMap((result,index)=>['messaging/invalid-registration-token','messaging/registration-token-not-registered'].includes(result.error?.code??'')&&tokens[index]?[tokens[index]!]:[]);
      if(invalid.length)await db.transaction(async tx=>{for(const token of invalid)tx.delete(`users/${userId}/fcmTokens/${token}`);});
    }
  } catch { console.error('notification_dispatch_unavailable'); }
}
