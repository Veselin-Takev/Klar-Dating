/**
 * Klar Platform - Storage Security Rules Validation Engine
 * 
 * Formal verification and execution model for storage.rules:
 * - /verification/{uid}/{datei}:
 *   - all Firebase client operations DENIED: legacy gesture/photo KYC retired
 *   - only IAM-authorized Admin SDK can handle retained files (separate policy)
 * - /profiles/{uid}/{datei}:
 *   - read: signedIn, non-anonymous, requester AND target server-owned users/{uid}
 *     isAdult === true AND accountStatus === 'active'
 *   - write: same active adult owner + own folder + valid image <8MB
 *   - delete: same active adult owner only
 *   - users/{uid} is the canonical age source; NOT an optional JWT claim
 */

export interface StorageAuthContext {
  uid: string;
  token?: {
    firebase?: {
      sign_in_provider?: string;
    };
    isAdult?: boolean; // Legacy claim, deliberately ignored for authorization.
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
  /** Server-authoritative users/{auth.uid}, never mutable age/JWT data. */
  requesterUserIsAdult?: boolean;
  requesterAccountStatus?: string;
  /** Server-authoritative users/{uid} for cross-profile reads. */
  targetUserIsAdult?: boolean;
  targetAccountStatus?: string;
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
  const requesterActiveAdult = request.requesterUserIsAdult === true
    && request.requesterAccountStatus === 'active';
  const targetActiveAdult = request.targetUserIsAdult === true
    && request.targetAccountStatus === 'active';

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

    // No Firebase client may create or replace a retired biometric photo.
    if (request.operation === 'write') {
      return {
        allowed: false,
        reason: 'Die clientseitige Fotoverifizierung ist eingestellt; Uploads sind gesperrt.',
        rulePath,
        code: 'PERMISSION_DENIED',
      };
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
      if (!requesterActiveAdult) {
        return { allowed: false, reason: 'Serverseitige Altersfreigabe und aktiver Kontostatus erforderlich.', rulePath, code: 'PERMISSION_DENIED' };
      }
      if (!targetActiveAdult) {
        return { allowed: false, reason: 'Zielprofil ist nicht volljährig und aktiv freigegeben.', rulePath, code: 'PERMISSION_DENIED' };
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
      if (!requesterActiveAdult) {
        return { allowed: false, reason: 'Serverseitige Altersfreigabe und aktiver Kontostatus erforderlich.', rulePath, code: 'PERMISSION_DENIED' };
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
      if (!requesterActiveAdult) {
        return { allowed: false, reason: 'Serverseitige Altersfreigabe und aktiver Kontostatus erforderlich.', rulePath, code: 'PERMISSION_DENIED' };
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
