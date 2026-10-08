import type { z } from 'zod';
import type { FunnelEventPayloadSchema, BiometricErrorCodeSchema, FunnelStepSchema } from '../src/services/funnelValidation';
export type FunnelStep = z.infer<typeof FunnelStepSchema>;
export type BiometricErrorCode = z.infer<typeof BiometricErrorCodeSchema>;
export type FunnelEventPayload = z.infer<typeof FunnelEventPayloadSchema>;
