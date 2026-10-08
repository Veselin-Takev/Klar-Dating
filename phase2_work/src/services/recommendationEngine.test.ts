import { afterEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../data";
import { getLearnedInterestWeights, recordInteraction } from "./recommendationEngine";

vi.mock("../lib/fehler", () => ({ melde: vi.fn() }));

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
});

describe("recommendation interaction learning", () => {
  it("learns from the canonical nachricht interaction key that recordInteraction writes", () => {
    recordInteraction(candidate(["Klettern"]), "nachricht");
    expect(JSON.parse(localStorage.getItem("klar_interactions_nachricht") || "[]")).toEqual(["Klettern"]);
    expect(getLearnedInterestWeights([]).fitness).toBe(2);
  });

  it("keeps historical like data readable during migration", () => {
    localStorage.setItem("klar_interactions_like", JSON.stringify(["Kaffee"]));
    expect(getLearnedInterestWeights([]).coffee).toBe(2);
  });

  it("fails closed on malformed storage instead of breaking profile ranking", () => {
    localStorage.setItem("klar_interactions_nachricht", "{broken");
    expect(() => getLearnedInterestWeights(["Wandern"])).not.toThrow();
    expect(getLearnedInterestWeights(["Wandern"]).nature).toBe(10);
  });

  it("bounds learned interaction history", () => {
    for (let index = 0; index < 205; index++) {
      recordInteraction(candidate(["Klettern"]), "nachricht");
    }
    const stored = JSON.parse(localStorage.getItem("klar_interactions_nachricht") || "[]");
    expect(stored).toHaveLength(200);
  });
});
