import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadViewMode, persistViewMode } from "./viewMode";

const store: Record<string, string> = {};
globalThis.localStorage = {
  clear: () => {
    for (const key in store) delete store[key];
  },
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
} as any;

describe("viewMode persistence", () => {
  beforeEach(() => globalThis.localStorage.clear());

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
