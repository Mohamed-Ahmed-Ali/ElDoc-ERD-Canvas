import { describe, expect, it } from "vitest";
import { parseBundle, serializeBundle } from "../src/index";
import type { ModelGraph } from "../src/types";

const graph: ModelGraph = {
  storageId: "stor_1",
  nodes: [
    {
      key: "fb",
      title: "Facebook Ads",
      inputSource: "CONNECTOR",
      description: "ads",
      schema: [{ name: "campaign_id", type: "STRING" }],
      position: { x: 10, y: 20 },
      status: "pending",
      eldocId: null,
    },
    {
      key: "camp",
      title: "Campaigns",
      inputSource: "VIEW",
      schema: [{ name: "id", type: "STRING", role: "pk" }],
      position: { x: 200, y: 20 },
      status: "pending",
      eldocId: null,
    },
  ],
  edges: [
    {
      id: "e1",
      from: "fb",
      to: "camp",
      keys: [{ left: "campaign_id", right: "id" }],
      bidirectional: false,
    },
  ],
};

describe("okf round-trip", () => {
  it("serializes to files and parses back to an equivalent graph", () => {
    const bundle = serializeBundle(graph, "Demo");
    expect(Object.keys(bundle.files)).toContain("demo/index.md");
    expect(Object.keys(bundle.files)).toContain("demo/facebook-ads.md");
    expect(bundle.files["demo/facebook-ads.md"]).toContain("## Joins");
    const back = parseBundle(bundle.files);
    expect(back.nodes.map((n) => n.key).sort()).toEqual(["campaigns", "facebook-ads"]);
    expect(back.edges).toHaveLength(1);
    expect(back.edges[0]).toMatchObject({
      from: "facebook-ads",
      to: "campaigns",
      keys: [{ left: "campaign_id", right: "id" }],
    });
  });
  it("round-trips per-field description (alias is not preserved in the superset format), and reads the legacy 3-column form", () => {
    const g: ModelGraph = {
      storageId: null,
      nodes: [
        {
          key: "u",
          title: "Users",
          inputSource: "SQL",
          position: { x: 0, y: 0 },
          status: "pending",
          eldocId: null,
          schema: [
            { name: "id", type: "STRING", role: "pk", alias: "user_id", description: "Unique id" },
            { name: "email", type: "STRING" },
          ],
        },
      ],
      edges: [],
    };
    const back = parseBundle(serializeBundle(g, "P").files);
    expect(back.nodes[0].schema).toEqual([
      { name: "id", type: "STRING", role: "pk", description: "Unique id" },
      { name: "email", type: "STRING" },
    ]);
    // legacy 3-column table still imports.
    const legacy = parseBundle({
      "p/a.md": `${frontless("a", "A")}\n## Schema\n\n| Column | Type | PK |\n|--|--|--|\n| \`x\` | INTEGER | ✓ |\n`,
    });
    expect(legacy.nodes[0].schema).toEqual([{ name: "x", type: "INTEGER", role: "pk" }]);
  });

  it("collapses mutual Joins lines into one bidirectional edge", () => {
    const files = {
      "p/a.md": `${frontless("a", "A")}\n## Joins\n- [B](./b.md) — \`x = y\`\n`,
      "p/b.md": `${frontless("b", "B")}\n## Joins\n- [A](./a.md) — \`y = x\`\n`,
    };
    const g = parseBundle(files);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].bidirectional).toBe(true);
  });
});
function frontless(key: string, title: string) {
  return `---\ntype: "ElDoc Data Mart"\ntitle: "${title}"\neldoc:\n  key: "${key}"\n  inputSource: "SQL"\n  position: { x: 0, y: 0 }\n---\n# ${title}`;
}

describe("serialize → parse round-trip (superset)", () => {
  const graph: ModelGraph = {
    storageId: null,
    nodes: [
      {
        key: "orders",
        title: "Orders",
        inputSource: "VIEW",
        status: "pending",
        eldocId: null,
        position: { x: 0, y: 0 },
        schema: [
          { name: "order_id", type: "STRING", role: "pk", description: "Unique order id" },
          { name: "customer_id", type: "INTEGER" },
        ],
      },
      {
        key: "customers",
        title: "Customers",
        inputSource: "TABLE",
        status: "pending",
        eldocId: null,
        position: { x: 0, y: 0 },
        schema: [{ name: "id", type: "INTEGER", role: "pk" }],
      },
    ],
    edges: [
      {
        id: "e1",
        from: "orders",
        to: "customers",
        keys: [{ left: "customer_id", right: "id" }],
        bidirectional: false,
      },
    ],
  };

  it("preserves nodes, PK, types and join keys", () => {
    const { files } = serializeBundle(graph, "Demo");
    const back = parseBundle(files);
    const orders = back.nodes.find((n) => n.key === "orders")!;
    expect(orders.inputSource).toBe("VIEW");
    expect(orders.schema.find((f) => f.name === "order_id")).toMatchObject({
      role: "pk",
      type: "STRING",
    });
    expect(back.edges).toHaveLength(1);
    expect(back.edges[0]).toMatchObject({
      from: "orders",
      to: "customers",
      keys: [{ left: "customer_id", right: "id" }],
    });
  });

  it("keeps both nodes when two titles slugify to the same value", () => {
    const collidingGraph: ModelGraph = {
      storageId: null,
      nodes: [
        {
          key: "posts",
          title: "Posts Answers",
          inputSource: "SQL",
          status: "pending",
          eldocId: null,
          position: { x: 0, y: 0 },
          schema: [{ name: "id", type: "STRING", role: "pk" }],
        },
        {
          key: "answers",
          title: "Posts & Answers",
          inputSource: "SQL",
          status: "pending",
          eldocId: null,
          position: { x: 0, y: 0 },
          schema: [{ name: "post_id", type: "STRING" }],
        },
      ],
      edges: [
        {
          id: "e1",
          from: "posts",
          to: "answers",
          keys: [{ left: "id", right: "post_id" }],
          bidirectional: false,
        },
      ],
    };

    const { files } = serializeBundle(collidingGraph, "Demo");
    const martFiles = Object.keys(files).filter((f) => !f.endsWith("index.md"));
    expect(martFiles).toHaveLength(2);

    const back = parseBundle(files);
    expect(back.nodes).toHaveLength(2);
    const keys = back.nodes.map((n) => n.key);
    expect(new Set(keys).size).toBe(2);

    expect(back.edges).toHaveLength(1);
    const edge = back.edges[0];
    expect(edge.from).not.toBe(edge.to);
    expect(keys).toContain(edge.from);
    expect(keys).toContain(edge.to);
  });
});

import { describe as descRt, expect as expRt, it as itRt } from "vitest";
import { parseBundle as parRt, serializeBundle as serRt } from "../src/index";
import type { Cardinality as CardRt, ModelGraph as GraphRt } from "../src/types";

descRt("cardinality round-trip", () => {
  const make = (cardinality: CardRt, bidirectional: boolean): GraphRt => ({
    storageId: null,
    nodes: [
      {
        key: "tx",
        title: "Transactions",
        inputSource: "TABLE",
        status: "pending",
        eldocId: null,
        position: { x: 0, y: 0 },
        schema: [{ name: "block_hash", type: "STRING", role: "pk" }],
      },
      {
        key: "blocks",
        title: "Blocks",
        inputSource: "TABLE",
        status: "pending",
        eldocId: null,
        position: { x: 0, y: 0 },
        schema: [{ name: "hash", type: "STRING", role: "pk" }],
      },
    ],
    edges: [
      {
        id: "e1",
        from: "tx",
        to: "blocks",
        keys: [{ left: "block_hash", right: "hash" }],
        bidirectional,
        cardinality,
      },
    ],
  });

  for (const c of ["1:1", "1:N", "N:1", "N:N"] as CardRt[]) {
    itRt(`survives ${c} (one-way)`, () => {
      const back = parRt(serRt(make(c, false), "Demo").files);
      expRt(back.edges[0]).toMatchObject({ from: "transactions", to: "blocks", cardinality: c });
    });
    itRt(`survives ${c} (bidirectional, normalized to from→to)`, () => {
      const back = parRt(serRt(make(c, true), "Demo").files);
      expRt(back.edges[0].cardinality).toBe(c);
      expRt(back.edges[0].bidirectional).toBe(true);
    });
  }
});
