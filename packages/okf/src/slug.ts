import yaml from "js-yaml";

export function slugify(text: string, fallback = ""): string {
  const s = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}

export function renderFrontmatter(obj: Record<string, unknown>): string {
  // use js-yaml to cleanly handle escaping, quotes, and colons in descriptions.
  return yaml.dump(obj, { skipInvalid: true, noRefs: true }).trimEnd();
}

export function parseFrontmatter(text: string): { data: Record<string, any>; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  // jSON_SCHEMA coerces scalars to native JS types (booleans, numbers) when
  // unambiguous and refuses to parse a bare string into a Date — both of which
  // match the behavior the old handwritten parser had (a `true` token was
  // returned as the boolean, an unquoted number as Number, everything else as
  // string). Without JSON_SCHEMA, a YAML 1.1 timestamp like `2024-01-02` would
  // round-trip as a Date object, which is not what OKF expects.
  const parsed = yaml.load(m[1], { schema: yaml.JSON_SCHEMA });
  return {
    data: (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, any>,
    body: m[2],
  };
}
