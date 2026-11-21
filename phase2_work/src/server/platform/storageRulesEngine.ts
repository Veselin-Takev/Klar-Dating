/**
 * Klar Platform - Storage Security Rules Validation Engine
 * 
 * Formal verification and execution model for storage.rules:
 * - /verification/{uid}/{datei}:
 *   - all Firebase client operations DENIED: legacy gesture/photo KYC retired
 *   - only IAM-authorized Admin SDK can handle retained files (separate policy)
 * - /profiles/{uid}/{datei}:
 *   - read: false (all profile media reads go through the authenticated backend proxy)
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
  /** Firestore-backed owner state used by the deployable Storage Rules. */
  ownerState?: {
    exists?: boolean;
    isAdult?: boolean;
    active?: boolean;
    isSuspended?: boolean;
    isBlocked?: boolean;
    deletionPending?: boolean;
    status?: string;
  };
  resource?: StorageResourceContext;
}

export interface StorageSecurityDecision {
  allowed: boolean;
  reason?: string;
  rulePath?: string;
  code?: 'PERMISSION_DENIED' | 'UNAUTHENTICATED' | 'ANONYMOUS_BLOCKED' | 'OWNER_STATE_UNVERIFIED' | 'ACCOUNT_DELETION_PENDING' | 'INVALID_MIME' | 'SIZE_LIMIT_EXCEEDED' | 'ALLOWED';
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

    // Direct client reads are denied; media is streamed only by the backend proxy.
    if (request.operation === 'read') {
      return { allowed: false, reason: 'Direkte Client-Lesezugriffe auf Profilmedien sind gesperrt.', rulePath, code: 'PERMISSION_DENIED' };
    }

    const verifyProfileOwner = (): StorageSecurityDecision | null => {
      if (!signedIn) return { allowed: false, reason: 'Nicht authentifiziert.', rulePath, code: 'UNAUTHENTICATED' };
      if (isGuest) return { allowed: false, reason: 'Gäste dürfen keine Profilbilder verwalten.', rulePath, code: 'ANONYMOUS_BLOCKED' };
      if (!isOwner) return { allowed: false, reason: 'Nur der Eigentümer darf den Profilpfad verwalten.', rulePath, code: 'PERMISSION_DENIED' };
      const owner = request.ownerState;
      if (!owner || owner.exists !== true || owner.isAdult !== true || owner.active !== true ||
          owner.isSuspended !== false || owner.isBlocked !== false ||
          owner.status === 'blocked' || owner.status === 'suspended' || owner.status === 'deleted') {
        return { allowed: false, reason: 'Der autoritative Kontostatus des Profilinhabers fehlt oder ist nicht freigegeben.', rulePath, code: 'OWNER_STATE_UNVERIFIED' };
      }
      if (owner.deletionPending !== false) {
        return { allowed: false, reason: 'Kontolöschung ist aktiv oder der Löschstatus ist nicht verifiziert.', rulePath, code: 'ACCOUNT_DELETION_PENDING' };
      }
      return null;
    };

    if (request.operation === 'write') {
      const ownerDenied = verifyProfileOwner();
      if (ownerDenied) return ownerDenied;
      if (!isImageContentType(request.resource?.contentType)) return { allowed: false, reason: 'Nur Bildformate (JPEG, PNG, WebP) sind erlaubt.', rulePath, code: 'INVALID_MIME' };
      if (typeof request.resource?.size !== 'number' || request.resource.size >= MAX_FILE_SIZE_BYTES) return { allowed: false, reason: 'Dateigröße überschreitet das Limit von 8 MB.', rulePath, code: 'SIZE_LIMIT_EXCEEDED' };
      return { allowed: true, rulePath, code: 'ALLOWED' };
    }
    if (request.operation === 'delete') {
      const ownerDenied = verifyProfileOwner();
      if (ownerDenied) return ownerDenied;
      return { allowed: true, rulePath, code: 'ALLOWED' };
    }
  }

  return { allowed: false, reason: 'Keine passende Storage-Regel.', code: 'PERMISSION_DENIED' };
}
