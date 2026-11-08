import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { z } from 'zod';
import { resolveVerifiedTenantContext } from './tenantRequestContext';

/** Restricted repository; intentionally exposes no SDK refs, queries or native db. */
export class TenantAwareFirestoreRepository {
  readonly #db: Firestore;
  readonly #prefix: string;

  /** decodedToken MUST come from verifyIdToken(token, true), not request input. */
  constructor(db: Firestore, decodedToken: unknown) {
    const principal = resolveVerifiedTenantContext(decodedToken);
    this.#db = db;
    this.#prefix = `tenants/${principal.tenant}/`;
  }

  #documentPath(relativePath: string): string {
    if (typeof relativePath !== 'string') throw new Error('tenant_document_path_invalid');
    const parts = relativePath.split('/');
    if (parts.length < 2 || parts.length % 2 !== 0 || parts[0] === 'tenants'
        || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) {
      throw new Error('tenant_document_path_invalid');
    }
    return this.#prefix + relativePath;
  }

  async read<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
    const snapshot = await this.#db.doc(this.#documentPath(path)).get();
    return snapshot.exists ? schema.parse(snapshot.data()) : null;
  }

  async write<T extends DocumentData>(path: string, schema: z.ZodType<T>, input: unknown): Promise<void> {
    const scopedPath = this.#documentPath(path);
    const data = schema.parse(input);
    await this.#db.doc(scopedPath).set(data);
  }

  async delete(path: string): Promise<void> {
    await this.#db.doc(this.#documentPath(path)).delete();
  }
}
