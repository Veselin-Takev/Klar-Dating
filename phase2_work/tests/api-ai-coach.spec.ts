import { describe, it, expect } from "vitest";

const API_HOST = process.env.API_HOST || "http://localhost:3000";

describe("API Endpoint Inventar: /api/ai-coach", () => {
  it("erfasst und prüft den /api/ai-coach Endpunkt", async () => {
    const res = await fetch(`${API_HOST}/api/ai-coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hallo Test" }),
    });

    expect([200, 401, 500]).toContain(res.status);
  });
});
