import { describe, expect, it } from "vitest";
import { parseFrontmatter, renderFrontmatter, slugify } from "../src/slug";

describe("slugify", () => {
  it("kebab-cases titles", () =>
    expect(slugify("Facebook Ads Insights")).toBe("facebook-ads-insights"));
  it("falls back when empty", () => expect(slugify("", "n1")).toBe("n1"));
});
describe("frontmatter", () => {
  it("round-trips scalars, lists and nested eldoc block", () => {
    const fm = {
      type: "ElDoc Data Mart",
      title: "A",
      tags: ["eldoc", "sql"],
      eldoc: { key: "a", inputSource: "SQL", position: { x: 1, y: 2 } },
    };
    const text = renderFrontmatter(fm);
    expect(parseFrontmatter(`---\n${text}\n---\nbody`).data).toEqual(fm);
  });

  it("survives colons inside unquoted scalars (the bug that motivated swapping to js-yaml)", () => {
    const fm = {
      type: "ElDoc Data Mart",
      title: "URLs",
      description: "See https://example.com for the full spec",
    };
    const text = renderFrontmatter(fm);
    const back = parseFrontmatter(`---\n${text}\n---\nbody`).data;
    expect(back.description).toBe("See https://example.com for the full spec");
  });

  it("survives colons and quotes inside nested eldoc fields", () => {
    const fm = {
      type: "ElDoc Data Mart",
      title: "Orders",
      eldoc: {
        key: "orders",
        inputSource: "SQL",
        description: "PK. order_id joins customers.id (one-to-many)",
      },
    };
    const text = renderFrontmatter(fm);
    const back = parseFrontmatter(`---\n${text}\n---\nbody`).data;
    expect(back.eldoc.description).toBe("PK. order_id joins customers.id (one-to-many)");
  });

  it("parses unquoted yaml boolean/number tokens correctly", () => {
    // `name` is the only safe scalar here; `count` and `flag` are emitted
    // unquoted by the renderer because they look like native primitives.
    const back = parseFrontmatter(
      `---\n${renderFrontmatter({ name: "Orders", count: 42, flag: true })}\n---\nbody`,
    ).data;
    expect(back).toEqual({ name: "Orders", count: 42, flag: true });
  });

  it("returns an empty data object when there is no frontmatter", () => {
    const r = parseFrontmatter("just a body\nwith lines\n");
    expect(r.data).toEqual({});
    expect(r.body).toBe("just a body\nwith lines\n");
  });

  it("rejects yaml that would have been silently misparsed by the old handwritten parser", () => {
    // the old parser would have split on the first colon and dropped the rest
    // of the line. With the new quoted output, the entire description survives
    // a serialize → parse round-trip even when it contains multiple colons,
    // uRLs, and slashes.
    const fm = { title: "X", description: "See URL: https://example.com:8080/path" };
    const back = parseFrontmatter(`---\n${renderFrontmatter(fm)}\n---\nbody`).data;
    expect(back.description).toBe("See URL: https://example.com:8080/path");
  });
});
