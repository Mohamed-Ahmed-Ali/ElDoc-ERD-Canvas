// One-off: build a shareable #m= hash for a nicely-positioned template, so we can
// render a populated-canvas hero screenshot headlessly. Not shipped. Run:
//   pnpm dlx tsx scripts/gen-hero-hash.ts   (or: node --import tsx scripts/gen-hero-hash.ts)
import { TEMPLATES } from "../packages/web/src/templates";
import { encodeModel } from "../packages/web/src/share/url";

// Curated compact-view positions (nodes are 200×90) — a clean e-commerce star.
const POS: Record<string, [number, number]> = {
  dim_customer: [40, 70],
  dim_product: [40, 360],
  fct_orders: [340, 70],
  fct_order_items: [340, 360],
  fct_sessions: [640, 70],
  fct_returns: [640, 360],
};

const g = TEMPLATES.find((t) => t.id === "ecommerce")!.graph;
const laid = {
  ...g,
  nodes: g.nodes.map((n) => ({
    ...n,
    position: { x: POS[n.key]?.[0] ?? 0, y: POS[n.key]?.[1] ?? 0 },
  })),
};
process.stdout.write(encodeModel(laid));
