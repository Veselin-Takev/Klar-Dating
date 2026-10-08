/**
 * Klar Platform - Storage Security Rules Validation Engine
 * 
 * Formal verification and execution model for storage.rules:
 * - /verification/{uid}/{datei}:
 *   - read: false (Strict zero-read Art. 9 biometric data protection)
 *   - write: adult gate + signedIn() + !istGast() + auth.uid == uid + image + <8MB
 *   - delete: false (only server-side admin cleanup)
 * - /profiles/{uid}/{datei}:
 *   - read: requester adult + target owner adult + signedIn() + !istGast()
 *   - write: adult gate + signedIn() + !istGast() + auth.uid == uid + image + <8MB
 *   - delete: adult gate + signedIn() + !istGast() + auth.uid == uid
 */

export interface StorageAuthContext {
  uid: string;
  token?: {
    firebase?: {
      sign_in_provider?: string;
    };
    isAdult?: boolean;
    [key: string]: unknown;
  };
}

export interface StorageResourceContext {
  size?: number;
  contentType?: string;
}

export interface StorageSecurityRequest {
  operation: 'read' | 'write' | 'delete';
  path: string;
  auth: StorageAuthContext | null;
  /** Server-resolved adult state of the target profile owner. Required for profile reads. */
  targetUserIsAdult?: boolean;
  resource?: StorageResourceContext;
}

export interface StorageSecurityDecision {
  allowed: boolean;
  reason?: string;
  rulePath?: string;
  code?: 'PERMISSION_DENIED' | 'UNAUTHENTICATED' | 'ANONYMOUS_BLOCKED' | 'INVALID_MIME' | 'SIZE_LIMIT_EXCEEDED' | 'ALLOWED';
}

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

export function isImageContentType(mime?: string): boolean {
  if (!mime || typeof mime !== 'string') return false;
  return ALLOWED_IMAGE_MIMES.includes(mime.toLowerCase().trim());
}

export function isGuestAuth(auth: StorageAuthContext | null): boolean {
  if (!auth) return false;
  return auth.token?.firebase?.sign_in_provider === 'anonymous';
}

/**
 * Deterministically evaluates an incoming Cloud Storage request against storage.rules.
 */
export function evaluateStorageSecurityRule(request: StorageSecurityRequest): StorageSecurityDecision {
  const normalizedPath = request.path.startsWith('/') ? request.path : `/${request.path}`;
  const segments = normalizedPath.split('/').filter(Boolean);

  if (segments.length < 3) {
    return {
      allowed: false,
      reason: 'Path must match a registered collection pattern (/verification/{uid}/{file} or /profiles/{uid}/{file})',
      code: 'PERMISSION_DENIED',
    };
  }

  const [topCollection, uid, ...rest] = segments;
  if (!topCollection || !uid || rest.length === 0) {
    return {
      allowed: false,
      reason: 'Incomplete path specification',
      code: 'PERMISSION_DENIED',
    };
  }

  const signedIn = request.auth !== null && typeof request.auth.uid === 'string' && request.auth.uid.trim().length > 0;
  const isOwner = signedIn && request.auth?.uid === uid;
  const isGuest = isGuestAuth(request.auth);

  // ── 1. Match /verification/{uid}/{datei} ─────────────────────────────────
  if (topCollection === 'verification') {
    const rulePath = '/verification/{uid}/{datei}';

    // read: if false; (Biometric Art. 9: No client reads permitted, even owner)
    if (request.operation === 'read') {
      return {
        allowed: false,
        reason: 'Verifizierungsfotos dürfen clientseitig niemals gelesen werden (Art. 9 DSGVO Schutz biometrischer Daten).',
        rulePath,
        code: 'PERMISSION_DENIED',
      };
    }

    // delete: if false; (Only server-side admin functions can delete)
    if (request.operation === 'delete') {
      return {
        allowed: false,
        reason: 'Löschung von Verifizierungsfotos ist dem Server vorbehalten.',
        rulePath,
        code: 'PERMISSION_DENIED',
      };
    }

    // write: if istVolljaehrig() && request.auth.uid == uid && istBild() && request.resource.size < 8 * 1024 * 1024;
    if (request.operation === 'write') {
      if (!signedIn) {
        return { allowed: false, reason: 'Nicht authentifiziert.', rulePath, code: 'UNAUTHENTICATED' };
      }
      if (isGuest) {
        return { allowed: false, reason: 'Gäste dürfen keine Verifizierungsfotos hochladen.', rulePath, code: 'ANONYMOUS_BLOCKED' };
      }
      if (request.auth?.token?.isAdult !== true) {
        return { allowed: false, reason: 'Altersfreigabe erforderlich.', rulePath, code: 'PERMISSION_DENIED' };
      }
      if (!isOwner) {
        return { allowed: false, reason: 'Schreiben nur in den eigenen Pfad erlaubt.', rulePath, code: 'PERMISSION_DENIED' };
      }
      if (!isImageContentType(request.resource?.contentType)) {
        return { allowed: false, reason: 'Nur Bildformate (JPEG, PNG, WebP) sind erlaubt.', rulePath, code: 'INVALID_MIME' };
      }
      if (typeof request.resource?.size !== 'number' || request.resource.size >= MAX_FILE_SIZE_BYTES) {
        return { allowed: false, reason: 'Dateigröße überschreitet das Limit von 8 MB.', rulePath, code: 'SIZE_LIMIT_EXCEEDED' };
      }

      return { allowed: true, rulePath, code: 'ALLOWED' };
    }
  }

  // ── 2. Match /profiles/{uid}/{datei} ─────────────────────────────────────
  if (topCollection === 'profiles') {
    const rulePath = '/profiles/{uid}/{datei}';

    // read: requester must be adult and the target profile owner must also be adult.
    if (request.operation === 'read') {
      if (!signedIn) {
        return { allowed: false, reason: 'Profilbilder erfordern eine Anmeldung.', rulePath, code: 'UNAUTHENTICATED' };
      }
      if (isGuest) {
        return { allowed: false, reason: 'Gäste dürfen keine Profilbilder lesen.', rulePath, code: 'ANONYMOUS_BLOCKED' };
      }
      if (request.auth?.token?.isAdult !== true) {
        return { allowed: false, reason: 'Altersfreigabe erforderlich.', rulePath, code: 'PERMISSION_DENIED' };
      }
      if (request.targetUserIsAdult !== true) {
        return { allowed: false, reason: 'Zielprofil ist nicht als volljährig freigegeben.', rulePath, code: 'PERMISSION_DENIED' };
      }
      return { allowed: true, rulePath, code: 'ALLOWED' };
    }

    // write: if istVolljaehrig() && request.auth.uid == uid && istBild() && request.resource.size < 8 * 1024 * 1024;
    if (request.operation === 'write') {
      if (!signedIn) {
        return { allowed: false, reason: 'Nicht authentifiziert.', rulePath, code: 'UNAUTHENTICATED' };
      }
      if (isGuest) {
        return { allowed: false, reason: 'Gäste dürfen keine Profilbilder hochladen.', rulePath, code: 'ANONYMOUS_BLOCKED' };
      }
      if (request.auth?.token?.isAdult !== true) {
        return { allowed: false, reason: 'Altersfreigabe erforderlich.', rulePath, code: 'PERMISSION_DENIED' };
      }
      if (!isOwner) {
        return { allowed: false, reason: 'Profilbilder dürfen nur im eigenen Ordner hochgeladen werden.', rulePath, code: 'PERMISSION_DENIED' };
      }
      if (!isImageContentType(request.resource?.contentType)) {
        return { allowed: false, reason: 'Nur Bildformate (JPEG, PNG, WebP) sind zulässig.', rulePath, code: 'INVALID_MIME' };
      }
      if (typeof request.resource?.size !== 'number' || request.resource.size >= MAX_FILE_SIZE_BYTES) {
        return { allowed: false, reason: 'Dateigröße überschreitet 8 MB.', rulePath, code: 'SIZE_LIMIT_EXCEEDED' };
      }

      return { allowed: true, rulePath, code: 'ALLOWED' };
    }

    // delete: if istVolljaehrig() && request.auth.uid == uid;
    if (request.operation === 'delete') {
      if (!signedIn) {
        return { allowed: false, reason: 'Nicht authentifiziert.', rulePath, code: 'UNAUTHENTICATED' };
      }
      if (isGuest) {
        return { allowed: false, reason: 'Gäste dürfen keine Profilbilder löschen.', rulePath, code: 'ANONYMOUS_BLOCKED' };
      }
      if (request.auth?.token?.isAdult !== true) {
        return { allowed: false, reason: 'Altersfreigabe erforderlich.', rulePath, code: 'PERMISSION_DENIED' };
      }
      if (!isOwner) {
        return { allowed: false, reason: 'Nur eigene Profilbilder dürfen gelöscht werden.', rulePath, code: 'PERMISSION_DENIED' };
      }

      return { allowed: true, rulePath, code: 'ALLOWED' };
    }
  }

  // Default deny-all
  return {
    allowed: false,
    reason: 'Keine übereinstimmende Sicherheitsregel gefunden (Default Deny).',
    code: 'PERMISSION_DENIED',
  };
}
