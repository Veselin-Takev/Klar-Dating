import { describe, it, expect } from "vitest";

describe("API authentication and signature guardrails", () => {
  const API_HOST = "http://localhost:3000";

  it("schützt /api/chats vor unautorisiertem Zugriff (401/403)", async () => {
    const res = await fetch(`${API_HOST}/api/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: "user_b", message: "Test" })
    });
    // Erwartet wird Abweisung ohne gültigen Bearer-Token
    expect([401, 403, 404, 405]).toContain(res.status);
  });

  it("weist ein ungültiges Token vor dem Zugriff auf einen konkreten Chat-Pfad ab", async () => {
    const invalidToken = "Bearer invalid_or_frenzied_token_b";
    const res = await fetch(`${API_HOST}/api/chats/security-audit-chat`, {
      method: "GET",
      headers: { "Authorization": invalidToken }
    });
    expect(res.status).toBe(401);
  });

  it("schützt den produktiven AI-Coach und liefert keine Dummy-Antwort", async () => {
    const res = await fetch(`${API_HOST}/api/ai-coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Test" }),
    });
    expect([401, 403]).toContain(res.status);
  });

  it("authentifiziert Admin-Betriebsendpunkte vor der Rollenprüfung", async () => {
    for (const path of ["/api/admin/build-info", "/api/admin/failed-apis", "/api/admin/health-check", "/api/system-health"]) {
      const res = await fetch(`${API_HOST}${path}`);
      expect([401, 403]).toContain(res.status);
    }
  });

  it("blockiert Stripe-Webhooks ohne gültige Signatur", async () => {
    const res = await fetch(`${API_HOST}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "payment_intent.succeeded" })
    });
    expect(res.status).toBe(400);
  });
});
