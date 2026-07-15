import { parseFrontmatter } from "./slug";
import type {
  Cardinality,
  InputSource,
  ModelEdge,
  ModelGraph,
  ModelNode,
  SchemaField,
} from "./types";

const FLIP_CARDINALITY: Record<Cardinality, Cardinality> = {
  "1:1": "1:1",
  "N:N": "N:N",
  "1:N": "N:1",
  "N:1": "1:N",
};

// resolve a link target by its basename, tolerating ./rel paths, nested dirs,
// and (in the prose pass) absolute paths. The strict join regex only produces ./rel.
function basename(path: string): string {
  return path.split(/[\\/]/).pop()!.replace(/\.md$/i, "");
}

export function parseBundle(files: Record<string, string>): ModelGraph {
  const docs = Object.entries(files)
    .filter(([p]) => p.endsWith(".md") && !p.endsWith("index.md"))
    .filter(([, text]) => isMartDoc(text));

  const indexDoc = files[Object.keys(files).find((p) => p.endsWith("index.md")) || ""];
  let graphTags: any[] | undefined = undefined;
  if (indexDoc) {
    const { data } = parseFrontmatter(indexDoc);
    if (data.graphTags) graphTags = data.graphTags;
  }

  const nodes: ModelNode[] = [];
  const slugToKey = new Map<string, string>();
  const pkByKey = new Map<string, string | undefined>();
  for (const [path, text] of docs) {
    const { data, body } = parseFrontmatter(text);
    const eldoc = data.eldoc || {};
    const ov = parseOverview(body);
    const title = data.title || "Untitled";
    const fileSlug = basename(path);
    const key = eldoc.key || fileSlug;
    slugToKey.set(fileSlug, key);
    const schema = parseSchema(body);
    pkByKey.set(key, schema.find((f) => f.role === "pk")?.name);
    const inputSource = (eldoc.inputSource ||
      ov.definitionType ||
      inferSource(data.tags) ||
      sourceFromType(data.type) ||
      "SQL") as InputSource;

    const parsedTags = Array.isArray(data.tags)
      ? data.tags.filter(
          (t: any) => typeof t === "string" && t !== "eldoc" && t !== inputSource.toLowerCase(),
        )
      : [];

    nodes.push({
      key,
      title,
      ...(data.tableName !== undefined ? { tableName: String(data.tableName) } : {}),
      inputSource,
      description: data.description ? String(data.description) : "",
      definition: parseDefinition(body),
      schema,
      position: eldoc.position || { x: 0, y: 0 },
      ...(data.color !== undefined ? { color: String(data.color) } : {}),
      ...(data.isHidden !== undefined ? { isHidden: Boolean(data.isHidden) } : {}),
      ...(parsedTags.length > 0 ? { tags: parsedTags } : {}),
      ...(ov.grain ? { grain: ov.grain } : {}),
      ...(ov.materialization ? { materialization: ov.materialization as any } : {}),
      ...(ov.partitioning ? { partitioning: ov.partitioning } : {}),
      ...(ov.updateFrequency ? { updateFrequency: ov.updateFrequency as any } : {}),
      ...(ov.dataTier ? { dataTier: ov.dataTier as any } : {}),
    });
  }

  const raw: {
    from: string;
    to: string;
    keys: { left: string; right: string }[];
    cardinality?: Cardinality;
    direction?: any;
    waypoints?: any;
  }[] = [];
  for (const [path, text] of docs) {
    const { data, body } = parseFrontmatter(text);
    const fromSlug = basename(path);
    const fromKey = data.eldoc?.key || fromSlug;
    const fromSchema = parseSchema(body);
    for (const ln of body.split("\n")) {
      const m = ln.match(/^- \[.*?\]\(\.\/(.+?)\.md\)\s*(?:—|--)?\s*(.*)$/);
      if (!m) continue;
      const toKey = slugToKey.get(basename(m[1]));
      if (!toKey) continue;
      let keys = [...m[2].matchAll(/`([^`]+?)\s*=\s*([^`]+?)`/g)].map((g) => ({
        left: g[1].trim(),
        right: g[2].trim(),
      }));
      if (keys.length === 0) {
        // faithful-ElDoc join: recover from a `FK to [Target]` note + target PK.
        const targetTitle = nodes.find((n) => n.key === toKey)?.title ?? "";
        const fkCol = fromSchema.find((f) =>
          (f.description || "").includes(`FK to [${targetTitle}]`),
        );
        const rightPk = pkByKey.get(toKey);
        if (fkCol && rightPk) keys = [{ left: fkCol.name, right: rightPk }];
      }
      const cm = m[2].match(/\[(1:1|1:N|N:1|N:N)\]/);
      const cardinality = cm ? (cm[1] as Cardinality) : undefined;
      const dm = m[2].match(/\{dir:\s*(from_to|to_from|bidirectional)\}/);
      const direction = dm ? (dm[1] as any) : undefined;
      const wm = m[2].match(/\{waypoints:\s*(\[.*?\])\}/);
      let waypoints: { x: number; y: number }[] | undefined;
      if (wm) {
        try {
          waypoints = JSON.parse(wm[1]);
        } catch (e) {}
      }
      raw.push({ from: fromKey, to: toKey, keys, cardinality, direction, waypoints });
    }
  }

  // tolerant pass for Google OKF v0.1 prose joins, e.g.
  //   "...can be joined with the [users](users.md) table on `user_id`..."
  // conservative: only lines that mention "join" AND link to a known mart, and
  // never list-item lines (those are the strict parser's job). An `on `key``
  // binds to the most recent preceding link; links without a key become keyless
  // edges. A discovered key upgrades an existing keyless edge for the same pair.
  const addProseEdge = (from: string, to: string, key: string | undefined) => {
    const keys = key ? [{ left: key, right: pkByKey.get(to) ?? key }] : [];
    const ex = raw.find(
      (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from),
    );
    if (ex) {
      if (keys.length && ex.keys.length === 0) {
        ex.keys = ex.from === from ? keys : keys.map((k) => ({ left: k.right, right: k.left }));
      }
      return;
    }
    raw.push({ from, to, keys });
  };
  for (const [path, text] of docs) {
    const { data, body } = parseFrontmatter(text);
    if (typeof data.type === "string" && /^eldoc data mart$/i.test(data.type.trim())) continue;
    const fromKey = data.eldoc?.key || basename(path);
    for (const ln of body.split("\n")) {
      if (!/join/i.test(ln)) continue;
      if (/^[-*]\s+\[/.test(ln.trim())) continue; // strict-parser list items
      let pending: string | null = null;
      for (const tk of ln.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)|on\s+`([^`]+)`/gi)) {
        if (tk[1]) {
          if (pending) addProseEdge(fromKey, pending, undefined);
          const toKey = slugToKey.get(basename(tk[1]));
          pending = toKey && toKey !== fromKey ? toKey : null;
        } else if (tk[2] && pending) {
          addProseEdge(fromKey, pending, tk[2].trim());
          pending = null;
        }
      }
      if (pending) addProseEdge(fromKey, pending, undefined);
    }
  }

  const edges: ModelEdge[] = [];
  const seen = new Map<string, ModelEdge>();
  for (const r of raw) {
    const pairKey = [r.from, r.to].sort().join("|");
    const ex = seen.get(pairKey);
    if (ex) {
      ex.bidirectional = true;
      ex.direction = "bidirectional";
      if (!ex.cardinality && r.cardinality) {
        ex.cardinality = ex.from === r.from ? r.cardinality : FLIP_CARDINALITY[r.cardinality];
      }
      if (!ex.direction && r.direction) {
        ex.direction = r.direction;
      }
      if (!ex.waypoints && r.waypoints) {
        ex.waypoints = r.waypoints;
      }
      continue;
    }
    const e: ModelEdge = {
      id: `e${edges.length + 1}`,
      from: r.from,
      to: r.to,
      keys: r.keys,
      bidirectional: false,
    };
    if (r.cardinality) e.cardinality = r.cardinality;
    if (r.direction) e.direction = r.direction;
    else if (e.bidirectional) e.direction = "bidirectional";
    if (r.waypoints) e.waypoints = r.waypoints;
    seen.set(pairKey, e);
    edges.push(e);
  }
  const storageId = (docs[0] && parseFrontmatter(docs[0][1]).data.eldoc?.storageId) || null;
  return { storageId, nodes, edges, ...(graphTags ? { tags: graphTags } : {}) };
}

function inferSource(tags: unknown): InputSource | undefined {
  const list = (Array.isArray(tags) ? tags : []).map((t) => String(t).toUpperCase());
  return (["SQL", "CONNECTOR", "VIEW", "TABLE"] as const).find((s) => list.includes(s));
}

// a doc is a mart unless its OKF type marks it as a non-table reference/dataset.
// elDoc docs (type: "ElDoc Data Mart") and untyped docs are always marts.
const NON_MART_TYPE = /^(reference|bigquery dataset)\b/i;
function isMartDoc(text: string): boolean {
  const t = parseFrontmatter(text).data.type;
  return !(typeof t === "string" && NON_MART_TYPE.test(t.trim()));
}

// map Google's frontmatter type onto our InputSource. ElDoc docs never reach the
// "SQL" fallback via this path because they carry eldoc.inputSource/Overview.
function sourceFromType(type: unknown): InputSource | undefined {
  const t = String(type ?? "").toLowerCase();
  if (t.startsWith("bigquery view")) return "VIEW";
  if (t.startsWith("bigquery table")) return "TABLE";
  return undefined;
}

function parseOverview(body: string): {
  definitionType?: string;
  grain?: string;
  materialization?: string;
  partitioning?: string;
  updateFrequency?: string;
  dataTier?: string;
} {
  const out: {
    definitionType?: string;
    grain?: string;
    materialization?: string;
    partitioning?: string;
    updateFrequency?: string;
    dataTier?: string;
  } = {};
  const grab = (label: string) => {
    const m = body.match(new RegExp(`^- \\*\\*${label}:\\*\\*\\s*\`?([^\`\\n]+?)\`?\\s*$`, "im"));
    return m ? m[1].trim() : undefined;
  };
  out.definitionType = grab("Definition type");
  out.grain = grab("Grain");
  out.materialization = grab("Materialization");
  out.partitioning = grab("Partitioning");
  out.updateFrequency = grab("Update Frequency");
  out.dataTier = grab("Data Tier");
  return out;
}

function parseSchema(body: string): import("./types").SchemaField[] {
  const out: import("./types").SchemaField[] = [];
  const lines = body.split("\n");
  let inSchema = false;
  let legacy = false;
  for (const ln of lines) {
    if (/^##?\s+Schema/i.test(ln)) {
      inSchema = true;
      continue;
    }
    if (!inSchema) continue;
    if (/^##?\s+/.test(ln)) break;
    if (!/^\s*\|/.test(ln)) continue;
    const cells = ln
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 2) continue;
    const name = cells[0].replace(/`/g, "").trim();
    if (!name || name === "Column") {
      legacy = cells.some((c) => /^pk$/i.test(c) || /^alias$/i.test(c)); // header row
      continue;
    }
    if (/^:?-+:?$/.test(name)) continue; // separator
    const type = (cells[1] || "STRING").replace(/`/g, "").trim() || "STRING";
    const field: import("./types").SchemaField = { name, type };
    if (legacy) {
      if (/^(✓|x|X)$/.test((cells[2] || "").trim())) field.role = "pk";
      const alias = (cells[3] || "").trim();
      const desc = (cells[4] || "").trim();
      if (alias) field.alias = alias;
      if (desc) field.description = desc;
    } else {
      let desc = (cells[2] || "").trim();
      if (/^PK\.\s*/.test(desc)) {
        field.role = "pk";
        desc = desc.replace(/^PK\.\s*/, "").trim();
      }

      const prefixes = [
        /^\*\*Role:\*\*\s*[^\s.]+\.\s*/i,
        /^\*\*Key:\*\*\s*[^\n.]+\.\s*/i,
        /^\*\*Composite Group:\*\*\s*[^\n.]+\.\s*/i,
        /^\*\*PII\.\*\*\s*/i,
        /^\*\*Measure\*\*\s*\([^)]+\)\.\s*/i,
        /^\*\*Alias:\*\*\s*[^\s.]+\.\s*/i,
      ];
      for (const pattern of prefixes) {
        if (pattern.test(desc)) {
          desc = desc.replace(pattern, "").trim();
        }
      }

      const lineageMatch = desc.match(/\*\*Lineage:\*\*\s*([A-Z_]+)\./i);
      if (lineageMatch) {
        field.lineageType = lineageMatch[1] as any;
        desc = desc.replace(lineageMatch[0], "").trim();
      }

      const logicMatch = desc.match(/\*\*Logic:\*\*\s*`([^`]+)`\./i);
      if (logicMatch) {
        field.lineageLogic = logicMatch[1];
        desc = desc.replace(logicMatch[0], "").trim();
      }

      const scdMatch = desc.match(/\*\*SCD Type:\*\*\s*([a-zA-Z0-9_]+)\./i);
      if (scdMatch) {
        field.scdType = scdMatch[1] as any;
        desc = desc.replace(scdMatch[0], "").trim();
      }

      const classMatch = desc.match(/\*\*Classification:\*\*\s*([a-zA-Z0-9_]+)\./i);
      if (classMatch) {
        field.dataClassification = classMatch[1] as any;
        desc = desc.replace(classMatch[0], "").trim();
      }

      const maskMatch = desc.match(/\*\*Masking:\*\*\s*([^\.]+)\./i);
      if (maskMatch) {
        field.maskingPolicy = maskMatch[1];
        desc = desc.replace(maskMatch[0], "").trim();
      }

      const qualityMatch = desc.match(/\*\*Quality Rules:\*\*\s*`([^`]+)`\./i);
      if (qualityMatch) {
        field.dataQualityRules = qualityMatch[1];
        desc = desc.replace(qualityMatch[0], "").trim();
      }

      if (desc) field.description = desc;
    }
    out.push(field);
  }
  if (out.length === 0) return parseSchemaBullets(body);
  return out;
}

const TYPE_WORDS =
  "STRING|BYTES|INTEGER|INT64|FLOAT|FLOAT64|NUMERIC|BIGNUMERIC|BOOLEAN|BOOL|" +
  "TIMESTAMP|DATE|DATETIME|TIME|RECORD|STRUCT|GEOGRAPHY|JSON|INTERVAL";
const TYPE_RE = new RegExp(`\\b(${TYPE_WORDS})\\b`, "i");

// fallback for Google OKF v0.1 bundles, whose `# Schema` sections are bullet
// lists rather than markdown tables. Top-level bullets only; nested RECORD
// children (indented) are skipped. Runs only when the table parser found nothing.
function parseSchemaBullets(body: string): SchemaField[] {
  const out: SchemaField[] = [];
  let inSchema = false;
  let schemaLevel = 0;
  for (const ln of body.split("\n")) {
    const h = ln.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      if (/^schema\b/i.test(h[2].trim())) {
        inSchema = true;
        schemaLevel = level;
        continue;
      }
      if (inSchema && level <= schemaLevel) break; // section ends at same/higher heading
      continue; // sub-header inside Schema (GA4 "## event")
    }
    if (!inSchema) continue;
    const m = ln.match(/^[-*]\s+`([^`]+)`(.*)$/); // top-level bullet, no leading indent
    if (!m) continue;
    const name = m[1].trim();
    if (!/^[\w.]+$/.test(name)) continue; // skip enum-value rows like `key = 'x'`
    out.push(parseFieldRest(name, m[2]));
  }
  return out;
}

// extract type + description from the text after a field's backticked name,
// tolerating: " (TYPE): desc", " (TYPE) - desc", " TYPE MODE: desc", ": TYPE".
function parseFieldRest(name: string, rest: string): SchemaField {
  let type = "STRING";
  let description = "";
  const paren = rest.match(/^\s*\(([^)]+)\)\s*[-:]?\s*(.*)$/);
  if (paren) {
    type = (paren[1].match(TYPE_RE)?.[1] ?? paren[1].trim()).toUpperCase();
    description = paren[2].trim();
  } else {
    const tail = rest.replace(/^\s*[-:]\s*/, ""); // drop a leading separator
    type = (tail.match(TYPE_RE)?.[1] ?? "STRING").toUpperCase();
    const colon = tail.indexOf(":");
    description = colon >= 0 ? tail.slice(colon + 1).trim() : "";
  }
  const field: SchemaField = { name, type };
  if (description) field.description = description;
  return field;
}

function parseDefinition(body: string): string | null {
  const m = body.match(/^##?\s+Definition\s*\n+```[^\n]*\n([\s\S]*?)\n```/im);
  return m ? m[1].trim() : null;
}
