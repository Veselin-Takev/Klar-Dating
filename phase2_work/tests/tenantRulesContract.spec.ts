// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';

const PROJECT_ID = 'demo-klar';
const TEST_BUCKET = 'gs://demo-klar.appspot.com';
const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

let environment: RulesTestEnvironment;

function emulatorEndpoint(value: string | undefined, name: string): { host: string; port: number } {
  if (!value) throw new Error(`Missing ${name}; this suite must run inside the isolated Firebase emulators.`);
  const separator = value.lastIndexOf(':');
  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));
  if (!host || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${name} endpoint.`);
  }
  return { host, port };
}

function authenticated(uid: string, claims: Record<string, unknown> = {}) {
  return environment.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
    roles: ['user'],
    ...claims,
  });
}

function firestoreAs(uid: string, claims: Record<string, unknown> = {}) {
  return authenticated(uid, claims).firestore();
}

function storageAs(uid: string, claims: Record<string, unknown> = {}) {
  return authenticated(uid, claims).storage(TEST_BUCKET);
}

async function seedMembership(
  tenantId: string,
  uid: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), `tenants/${tenantId}/members/${uid}`), {
      tenantId,
      uid,
      active: true,
      roles: ['user'],
      ...overrides,
    });
  });
}

async function seedProfile(tenantId: string, uid: string): Promise<void> {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), `tenants/${tenantId}/profiles/${uid}`), {
      uid,
      displayLabel: 'synthetic-profile',
      status: 'active',
    });
  });
}

async function seedChat(tenantId: string, chatId: string, participantUids: string[]): Promise<void> {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), `tenants/${tenantId}/chats/${chatId}`), {
      participantUids,
      state: 'active',
    });
  });
}

beforeAll(async () => {
  const firestore = emulatorEndpoint(process.env.FIRESTORE_EMULATOR_HOST, 'FIRESTORE_EMULATOR_HOST');
  const storage = emulatorEndpoint(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 'FIREBASE_STORAGE_EMULATOR_HOST');
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.tenant-candidate.rules', 'utf8'),
      host: firestore.host,
      port: firestore.port,
    },
    storage: {
      rules: readFileSync('storage.tenant-candidate.rules', 'utf8'),
      host: storage.host,
      port: storage.port,
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
});

afterAll(async () => {
  await environment?.cleanup();
});

describe('P0 #254 Package 4 — isolated tenant Rules contract', () => {
  it('1. denies anonymous, unauthenticated, missing-claim and malformed-claim access', async () => {
    await seedMembership(TENANT_A, 'synthetic-owner');
    await seedProfile(TENANT_A, 'synthetic-owner');
    const path = `tenants/${TENANT_A}/profiles/synthetic-owner`;

    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), path)));
    await assertFails(getDoc(doc(authenticated('synthetic-owner', {
      tenantId: TENANT_A,
      firebase: { sign_in_provider: 'anonymous' },
    }).firestore(), path)));
    await assertFails(getDoc(doc(firestoreAs('synthetic-owner'), path)));
    await assertFails(getDoc(doc(firestoreAs('synthetic-owner', {
      tenantId: '../tenant-a',
    }), path)));
  });

  it('2. denies missing, inactive and contradictory server-managed membership', async () => {
    await seedProfile(TENANT_A, 'synthetic-missing-member');
    await seedMembership(TENANT_A, 'synthetic-inactive-member', { active: false });
    await seedMembership(TENANT_A, 'synthetic-contradictory-member', {
      tenantId: TENANT_B,
      uid: 'synthetic-someone-else',
    });
    await assertFails(getDoc(doc(firestoreAs('synthetic-missing-member', {
      tenantId: TENANT_A,
    }), `tenants/${TENANT_A}/profiles/synthetic-missing-member`)));
    await assertFails(getDoc(doc(firestoreAs('synthetic-inactive-member', {
      tenantId: TENANT_A,
    }), `tenants/${TENANT_A}/profiles/synthetic-inactive-member`)));
    await assertFails(getDoc(doc(firestoreAs('synthetic-contradictory-member', {
      tenantId: TENANT_A,
    }), `tenants/${TENANT_A}/profiles/synthetic-contradictory-member`)));
  });

  it('3. denies cross-tenant paths and a signed claim for the wrong tenant', async () => {
    await seedMembership(TENANT_A, 'synthetic-member');
    await seedProfile(TENANT_B, 'synthetic-victim');
    await assertFails(getDoc(doc(firestoreAs('synthetic-member', {
      tenantId: TENANT_A,
    }), `tenants/${TENANT_B}/profiles/synthetic-victim`)));
    await assertFails(getDoc(doc(firestoreAs('synthetic-member', {
      tenantId: TENANT_B,
    }), `tenants/${TENANT_A}/profiles/synthetic-victim`)));
  });

  it('4. denies same-tenant IDOR while allowing the matching profile owner', async () => {
    await seedMembership(TENANT_A, 'synthetic-owner');
    await seedMembership(TENANT_A, 'synthetic-other-user');
    await seedProfile(TENANT_A, 'synthetic-owner');
    await seedProfile(TENANT_A, 'synthetic-other-user');

    await assertSucceeds(getDoc(doc(firestoreAs('synthetic-owner', {
      tenantId: TENANT_A,
    }), `tenants/${TENANT_A}/profiles/synthetic-owner`)));
    await assertFails(getDoc(doc(firestoreAs('synthetic-owner', {
      tenantId: TENANT_A,
    }), `tenants/${TENANT_A}/profiles/synthetic-other-user`)));
  });

  it('5. permits a verified chat participant and denies a non-participant', async () => {
    await seedMembership(TENANT_A, 'synthetic-chat-owner');
    await seedMembership(TENANT_A, 'synthetic-chat-participant');
    await seedMembership(TENANT_A, 'synthetic-chat-outsider');
    await seedChat(TENANT_A, 'synthetic-chat-001', [
      'synthetic-chat-owner',
      'synthetic-chat-participant',
    ]);

    await assertSucceeds(getDoc(doc(firestoreAs('synthetic-chat-participant', {
      tenantId: TENANT_A,
    }), `tenants/${TENANT_A}/chats/synthetic-chat-001`)));
    await assertFails(getDoc(doc(firestoreAs('synthetic-chat-outsider', {
      tenantId: TENANT_A,
    }), `tenants/${TENANT_A}/chats/synthetic-chat-001`)));
  });

  it('6. admin and super_admin claims never bypass owner or participant boundaries', async () => {
    await seedMembership(TENANT_A, 'synthetic-profile-owner');
    await seedMembership(TENANT_A, 'synthetic-admin', { roles: ['admin'] });
    await seedMembership(TENANT_A, 'synthetic-super-admin', { roles: ['super_admin'] });
    await seedProfile(TENANT_A, 'synthetic-profile-owner');
    await seedChat(TENANT_A, 'synthetic-private-chat', ['synthetic-profile-owner']);

    await assertFails(getDoc(doc(firestoreAs('synthetic-admin', {
      tenantId: TENANT_A,
      roles: ['admin'],
    }), `tenants/${TENANT_A}/profiles/synthetic-profile-owner`)));
    await assertFails(getDoc(doc(firestoreAs('synthetic-super-admin', {
      tenantId: TENANT_A,
      roles: ['super_admin'],
    }), `tenants/${TENANT_A}/chats/synthetic-private-chat`)));
  });

  it('7. enforces Storage owner, tenant, MIME, size and read boundaries', async () => {
    await seedMembership(TENANT_A, 'synthetic-storage-owner');
    await seedMembership(TENANT_A, 'synthetic-storage-foreign');
    const ownerStorage = storageAs('synthetic-storage-owner', { tenantId: TENANT_A });
    const ownerPath = `tenants/${TENANT_A}/profiles/synthetic-storage-owner/avatar.jpg`;
    const ownerFile = ref(ownerStorage, ownerPath);

    await assertSucceeds(uploadBytes(ownerFile, JPEG, { contentType: 'image/jpeg' }));
    await assertFails(getDownloadURL(ownerFile));
    await assertFails(uploadBytes(
      ref(ownerStorage, `tenants/${TENANT_A}/profiles/synthetic-storage-foreign/avatar.jpg`),
      JPEG,
      { contentType: 'image/jpeg' },
    ));
    await assertFails(uploadBytes(
      ref(ownerStorage, `tenants/${TENANT_B}/profiles/synthetic-storage-owner/avatar.jpg`),
      JPEG,
      { contentType: 'image/jpeg' },
    ));
    await assertFails(uploadBytes(
      ref(ownerStorage, `tenants/${TENANT_A}/profiles/synthetic-storage-owner/invalid.bin`),
      JPEG,
      { contentType: 'text/plain' },
    ));
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    await assertFails(uploadBytes(
      ref(ownerStorage, `tenants/${TENANT_A}/profiles/synthetic-storage-owner/oversized.jpg`),
      oversized,
      { contentType: 'image/jpeg' },
    ));
    await assertSucceeds(deleteObject(ownerFile));
  });

  it('8. explicitly denies legacy Firestore and Storage path families', async () => {
    await seedMembership(TENANT_A, 'synthetic-legacy-user');
    const db = firestoreAs('synthetic-legacy-user', { tenantId: TENANT_A });
    for (const path of [
      'users/synthetic-legacy-user',
      'public_profiles/synthetic-legacy-user',
      'profiles/synthetic-legacy-user',
      'verification/synthetic-legacy-user',
      'verification_events/synthetic-event',
      'connections/synthetic-connection',
      'blocks/synthetic-block',
      'chats/synthetic-chat',
      'subscriptions/synthetic-subscription',
    ]) {
      await assertFails(getDoc(doc(db, path)));
    }

    const bucket = storageAs('synthetic-legacy-user', { tenantId: TENANT_A });
    for (const path of [
      'users/synthetic-legacy-user/avatar.jpg',
      'profiles/synthetic-legacy-user/avatar.jpg',
      'verification/synthetic-legacy-user/photo.jpg',
      'verification_events/synthetic-event/photo.jpg',
    ]) {
      await assertFails(uploadBytes(ref(bucket, path), JPEG, { contentType: 'image/jpeg' }));
    }
  });

  it('9. denies undefined paths, collection listing and all non-permitted Firestore operations', async () => {
    await seedMembership(TENANT_A, 'synthetic-default-deny');
    await seedProfile(TENANT_A, 'synthetic-default-deny');
    await seedChat(TENANT_A, 'synthetic-default-chat', ['synthetic-default-deny']);
    const db = firestoreAs('synthetic-default-deny', { tenantId: TENANT_A });

    await assertFails(getDoc(doc(db, 'tenants/tenant-a/resources/undefined-document')));
    await assertFails(getDoc(doc(db, 'tenants/tenant-a/members/synthetic-default-deny')));
    await assertFails(getDocs(collection(db, `tenants/${TENANT_A}/profiles`)));
    await assertFails(getDocs(collection(db, `tenants/${TENANT_A}/chats`)));
    await assertFails(setDoc(doc(db, `tenants/${TENANT_A}/profiles/synthetic-default-deny`), {
      uid: 'synthetic-default-deny',
      displayLabel: 'client-write-must-fail',
    }));
    await assertFails(setDoc(doc(db, `tenants/${TENANT_A}/chats/synthetic-default-chat`), {
      participantUids: ['synthetic-default-deny'],
    }));
  });
});
