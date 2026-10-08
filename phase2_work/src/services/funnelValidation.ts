import { z } from 'zod';

export const FunnelStepSchema = z.enum(['onboarding_started', 'profile_basic_completed', 'biometrics_started', 'biometrics_success', 'biometrics_failed', 'onboarding_completed']);
export const BiometricErrorCodeSchema = z.enum(['FACE_NOT_DETECTED', 'POOR_LIGHTING', 'MOTION_BLUR', 'MULTIPLE_FACES', 'CAMERA_PERMISSION_DENIED', 'SERVER_TIMEOUT']);
// An allowlist prevents names, free text, URLs and nested personal data from entering telemetry.
export const FunnelEventPayloadSchema = z.object({
  step: FunnelStepSchema,
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  timestamp: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  metadata: z.object({
    errorCode: BiometricErrorCodeSchema.optional(),
    referrer: z.enum(['organic', 'referral', 'campaign']).optional(),
    device: z.enum(['mobile', 'desktop', 'tablet']).optional(),
  }).strict().optional(),
}).strict();
export type FunnelEventInput = z.infer<typeof FunnelEventPayloadSchema>;
