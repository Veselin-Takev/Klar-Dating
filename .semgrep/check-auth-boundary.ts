import { getFirestore as nativeDb } from 'firebase-admin/firestore';
// ruleid: check-auth-boundary
nativeDb();
import { getFirestore } from 'firebase-admin/firestore';
// ruleid: check-auth-boundary
getFirestore();
// ruleid: check-auth-boundary
admin.firestore();
import * as sdk from 'firebase-admin/firestore';
// ruleid: check-auth-boundary
sdk.getFirestore();
// ruleid: check-auth-boundary
new sdk.Firestore();
// ok: check-auth-boundary
repository.read('users/owner', schema);
