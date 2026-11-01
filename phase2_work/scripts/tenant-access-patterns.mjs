/**
 * Heuristic, read-only source patterns for P0 #254.
 * Candidate detection only: false positives and false negatives are possible.
 * Do not use regex matches as authorization or retention-policy proof.
 */
export const detectionRules = Object.freeze([
  ['admin_firestore', /\b(?:getFirestore|getDb|admin\.firestore|firebase-admin\/firestore)\b/],
  ['firestore_client', /\b(?:collection|collectionGroup|doc|getDoc|getDocs|onSnapshot|query|runTransaction|writeBatch)\s*\(|\.(?:collection|collectionGroup|doc|where|orderBy|limit|listDocuments|listCollections|runTransaction)\s*\(/],
  ['storage_access', /\b(?:getStorage|getDownloadURL|getBlob|getBytes|uploadBytes|uploadBytesResumable|deleteObject|getSignedUrl)\s*\(|\.(?:bucket|file|download|getSignedUrl)\s*\(/],
  ['user_sensitive_path', /\b(?:users|chats|messages|subscriptions|verification_events|referrals|payments|tenants|verification|profiles|consent_ledger)\s*\/|['"`]\s*(?:users|chats|messages|subscriptions|verification_events|referrals|payments|tenants|verification|profiles|consent_ledger)\s*['"`]/],
  ['database_mutation', /\b(?:setDoc|addDoc|updateDoc|deleteDoc|create|update|delete)\s*\(/],
]);

export function categoriesForLine(line) {
  if (typeof line !== 'string') throw new TypeError('source line must be a string');
  return detectionRules.filter(([, pattern]) => pattern.test(line)).map(([category]) => category);
}
