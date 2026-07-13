import { describe, it, expect, beforeEach } from "vitest";
import { loadViewMode, persistViewMode } from "./viewMode";

describe("viewMode persistence", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to physical when nothing is stored", () => {
    expect(loadViewMode()).toBe("physical");
  });

  it("round-trips a persisted mode", () => {
    persistViewMode("logical");
    expect(loadViewMode()).toBe("logical");
  });

  it("falls back to physical for an unrecognised stored value", () => {
    localStorage.setItem("mc.viewMode.v1", "bogus");
    expect(loadViewMode()).toBe("physical");
  });
});
