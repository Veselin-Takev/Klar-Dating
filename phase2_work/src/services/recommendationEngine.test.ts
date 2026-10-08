import { afterEach, describe, expect, it, vi } from "vitest";
import { klarStorage } from "../lib/userScopedStorage";
import type { Profile } from "../data";
import { getLearnedInterestWeights, recordInteraction } from "./recommendationEngine";

vi.mock("../lib/fehler", () => ({ melde: vi.fn() }));
vi.mock("../lib/firebase", () => ({ auth: { currentUser: { uid: "recommendation-test-user" } } }));

const candidate = (interests: string[]): Profile => ({
  id: "candidate",
  name: "Candidate",
  age: 30,
  location: "Berlin",
  photoUrl: "",
  bio: "",
  interests,
} as Profile);

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  klarStorage.removeItem("klar_interactions_like", "recommendation-test-user");
  klarStorage.removeItem("klar_interactions_nachricht", "recommendation-test-user");
  klarStorage.removeItem("klar_interactions_pass", "recommendation-test-user");
});

describe("recommendation interaction learning", () => {
  it("learns from the canonical nachricht interaction key that recordInteraction writes", () => {
    recordInteraction(candidate(["Klettern"]), "nachricht");
    expect(JSON.parse(klarStorage.getItem("klar_interactions_nachricht", "recommendation-test-user") || "[]")).toEqual(["Klettern"]);
    expect(getLearnedInterestWeights([]).fitness).toBe(2);
  });

  it("keeps historical like data readable during migration", () => {
    klarStorage.setItem("klar_interactions_like", JSON.stringify(["Kaffee"]), "recommendation-test-user");
    expect(getLearnedInterestWeights([]).coffee).toBe(2);
  });

  it("fails closed on malformed storage instead of breaking profile ranking", () => {
    klarStorage.setItem("klar_interactions_nachricht", "{broken", "recommendation-test-user");
    expect(() => getLearnedInterestWeights(["Wandern"])).not.toThrow();
    expect(getLearnedInterestWeights(["Wandern"]).nature).toBe(10);
  });

  it("bounds learned interaction history", () => {
    for (let index = 0; index < 205; index++) {
      recordInteraction(candidate(["Klettern"]), "nachricht");
    }
    const stored = JSON.parse(klarStorage.getItem("klar_interactions_nachricht", "recommendation-test-user") || "[]");
    expect(stored).toHaveLength(200);
  });
});
