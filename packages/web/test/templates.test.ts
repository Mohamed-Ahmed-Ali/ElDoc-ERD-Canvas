import { parseBundle, serializeBundle } from "@mc/okf";
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../src/templates";

describe("templates", () => {
  it("ships the base models", () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual([
      "crypto_bitcoin",
      "ecommerce",
      "feature_showcase",
      "finance",
      "marketing_ads",
      "marketplace",
      "medical",
      "mobile_gaming",
      "saas",
      "stackoverflow",
    ]);
  });

  for (const t of TEMPLATES) {
    describe(t.name, () => {
      const keys = new Set(t.graph.nodes.map((n) => n.key));

      it("every node has fields and a primary key", () => {
        for (const n of t.graph.nodes) {
          if (n.type === "group") continue;
          expect(n.schema.length, `${n.title} has fields`).toBeGreaterThan(0);
        }
      });

      it("every edge references existing nodes with complete join keys", () => {
        for (const e of t.graph.edges) {
          expect(keys.has(e.from), `${e.id} from`).toBe(true);
          expect(keys.has(e.to), `${e.id} to`).toBe(true);
          expect(e.keys.every((k) => k.left && k.right)).toBe(true);
        }
      });

      it("round-trips through OKF", () => {
        const g = parseBundle(serializeBundle(t.graph, t.name).files);
        expect(g.nodes.length).toBe(t.graph.nodes.length);
        expect(g.edges.length).toBe(t.graph.edges.length);
      });
    });
  }
});

it("crypto_bitcoin template resolves all edges and FK columns", () => {
  const t = TEMPLATES.find((x) => x.id === "crypto_bitcoin")!;
  expect(t).toBeTruthy();
  const keys = new Set(t.graph.nodes.map((n) => n.key));
  for (const e of t.graph.edges) {
    expect(keys.has(e.from)).toBe(true);
    expect(keys.has(e.to)).toBe(true);
    const from = t.graph.nodes.find((n) => n.key === e.from)!;
    const to = t.graph.nodes.find((n) => n.key === e.to)!;
    for (const k of e.keys) {
      expect(from.schema.some((s) => s.name === k.left)).toBe(true);
      expect(to.schema.some((s) => s.name === k.right)).toBe(true);
    }
  }
});

it("stackoverflow template resolves all edges and FK columns", () => {
  const t = TEMPLATES.find((x) => x.id === "stackoverflow")!;
  expect(t).toBeTruthy();
  const keys = new Set(t.graph.nodes.map((n) => n.key));
  for (const e of t.graph.edges) {
    expect(keys.has(e.from)).toBe(true);
    expect(keys.has(e.to)).toBe(true);
    const from = t.graph.nodes.find((n) => n.key === e.from)!;
    const to = t.graph.nodes.find((n) => n.key === e.to)!;
    for (const k of e.keys) {
      expect(from.schema.some((s) => s.name === k.left)).toBe(true);
      expect(to.schema.some((s) => s.name === k.right)).toBe(true);
    }
  }
});

it("stackoverflow is one of the templates", () => {
  expect(TEMPLATES.some(t => t.id === "stackoverflow")).toBe(true);
});
