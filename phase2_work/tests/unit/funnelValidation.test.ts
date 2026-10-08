import { describe, it, expect } from "vitest";
import { FunnelEventPayloadSchema } from "../../src/services/funnelValidation";

describe("FunnelEventPayloadSchema - Enterprise Data Quality", () => {
  it("validates a compliant funnel payload successfully", () => {
    const valid = {
      step: "onboarding_started",
      sessionId: "sess_1234567890abcdef",
      timestamp: Date.now(),
      metadata: { referrer: "organic", device: "mobile" },
    };
    const result = FunnelEventPayloadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects telemetry payloads containing raw email addresses (PII Guard)", () => {
    const piiLeak = {
      step: "profile_basic_completed",
      sessionId: "sess_1234567890abcdef",
      metadata: { contact: "user@example.com" },
    };
    const result = FunnelEventPayloadSchema.safeParse(piiLeak);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("rejects unknown funnel steps", () => {
    const invalidStep = {
      step: "unknown_custom_step",
      sessionId: "sess_1234567890abcdef",
    };
    const result = FunnelEventPayloadSchema.safeParse(invalidStep);
    expect(result.success).toBe(false);
  });
});

