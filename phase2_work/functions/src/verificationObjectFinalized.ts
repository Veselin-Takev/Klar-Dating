import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getMaintenanceBucket, getMaintenanceDb } from './runtime';
import {
  registerFinalizedVerificationObject,
  type FinalizedVerificationObject,
} from '../../src/server/platform/verificationObjectRegistration';

/**
 * Proactively creates the deletion fence as soon as a trusted backend writer
 * finalizes a verification object. Invalid metadata fails closed; the handler
 * never deletes or mutates the finalized object.
 */
export const registerVerificationDeletionFenceOnObjectFinalized = onObjectFinalized({
  region: 'europe-west3',
  retry: true,
}, async event => {
  const bucket = getMaintenanceBucket();
  await registerFinalizedVerificationObject(
    getMaintenanceDb(),
    bucket.name,
    event.data as unknown as FinalizedVerificationObject,
  );
});
