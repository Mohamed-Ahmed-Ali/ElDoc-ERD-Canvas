import { renderFrontmatter, slugify } from "./slug";
import type { Cardinality, ModelGraph, ModelNode } from "./types";

const FLIP_CARDINALITY: Record<Cardinality, Cardinality> = {
  "1:1": "1:1",
  "N:N": "N:N",
  "1:N": "N:1",
  "N:1": "1:N",
};

export interface OkfBundle {
  files: Record<string, string>;
}

export function serializeBundle(graph: ModelGraph, projectTitle = "Data Marts"): OkfBundle {
  const folder = slugify(projectTitle, "data-marts");
  const slugByKey = new Map<string, string>();
  const taken = new Set<string>();
  for (const n of graph.nodes) {
    const s = slugify(n.title, n.key);
    let u = s;
    let i = 2;
    while (taken.has(u)) u = `${s}-${i++}`;
    taken.add(u);
    slugByKey.set(n.key, u);
  }
  const files: Record<string, string> = {};
  for (const n of graph.nodes)
    files[`${folder}/${slugByKey.get(n.key)}.md`] = renderNode(n, graph, slugByKey);
  const rows = graph.nodes
    .map(
      (n) =>
        `| [${n.title}](./${slugByKey.get(n.key)}.md) | ${n.inputSource} | ${graph.storageId ?? "—"} |`,
    )
    .join("\n");
  const indexFrontmatter: Record<string, any> = {
    type: "index",
    title: projectTitle,
    description: "Index of exported ElDoc data marts.",
    tags: ["eldoc", "index"],
  };
  if (graph.tags?.length) {
    indexFrontmatter.graphTags = graph.tags;
  }

  files[`${folder}/index.md`] =
    `---\n${renderFrontmatter(indexFrontmatter)}\n---\n\n# ${projectTitle}\n\n| Data Mart | Type | Storage |\n|-----------|------|---------|\n${rows}\n`;
  return { files };
}

// map each of a node's own FK columns to the target mart it points at, so the
// fK note can be rendered inside that column's Description cell.
function fkColumns(
  n: ModelNode,
  g: ModelGraph,
  slugByKey: Map<string, string>,
): Map<string, { title: string; slug: string }> {
  const out = new Map<string, { title: string; slug: string }>();
  for (const e of g.edges) {
    if (e.from === n.key) {
      const t = g.nodes.find((x) => x.key === e.to)!;
      for (const k of e.keys) out.set(k.left, { title: t.title, slug: slugByKey.get(e.to)! });
    } else if (e.bidirectional && e.to === n.key) {
      const t = g.nodes.find((x) => x.key === e.from)!;
      for (const k of e.keys) out.set(k.right, { title: t.title, slug: slugByKey.get(e.from)! });
    }
  }
  return out;
}

function renderNode(n: ModelNode, g: ModelGraph, slugByKey: Map<string, string>): string {
  const frontmatterObj: Record<string, any> = {
    type: "ElDoc Data Mart",
    title: n.title,
    description: n.description || undefined,
    tags: ["eldoc", n.inputSource.toLowerCase(), ...(n.tags || [])],
  };
  if (n.color !== undefined) frontmatterObj.color = n.color;
  if (n.isHidden !== undefined) frontmatterObj.isHidden = n.isHidden;

  const fm = renderFrontmatter(frontmatterObj);
  const overview = [
    "## Overview",
    "",
    `- **ID:** \`${n.eldocId ?? "—"}\``,
    `- **Status:** ${n.status === "created" ? "PUBLISHED" : "DRAFT"}`,
    `- **Definition type:** ${n.inputSource}`,
    `- **Storage:** ${g.storageId ?? "—"}`,
    "",
  ].join("\n");

  const fk = fkColumns(n, g, slugByKey);
  const schema = n.schema.length
    ? `# Schema\n\n| Column | Type | Description |\n|--------|------|-------------|\n${n.schema
        .map((f) => {
          const parts: string[] = [];
          if (f.role && f.role.toLowerCase() === "pk") {
            parts.push("PK.");
          } else if (f.role && f.role !== "none") {
            parts.push(`**Role:** ${f.role.toUpperCase()}.`);
          }
          if (f.keyType && f.keyType !== "attribute") {
            let kStr = `**Key:** ${f.keyType}`;
            if (f.keyType === "surrogateHash" && f.hashConfig) {
              kStr += ` (${f.hashConfig.algorithm}(${f.hashConfig.sourceColumns.join(",")}))`;
            }
            parts.push(`${kStr}.`);
          }
          if (f.isComposite && f.compositeGroup)
            parts.push(`**Composite Group:** ${f.compositeGroup}.`);
          if (f.pii) parts.push("**PII.**");
          if (f.isMeasure) parts.push(`**Measure** (${f.measureType || "additive"}).`);
          if (f.alias) parts.push(`**Alias:** ${f.alias}.`);
          if (f.description) parts.push(f.description);
          const ref = fk.get(f.name);
          if (ref) {
            parts.push(`FK to [${ref.title}](./${ref.slug}.md)`);
          } else if (f.role === "fk" && f.foreignKeyRef?.targetTable) {
            parts.push(
              `FK to ${f.foreignKeyRef.targetTable}.${f.foreignKeyRef.targetColumn || f.name}`,
            );
          }
          return `| \`${f.name}\` | ${f.type} | ${parts.join(" ").trim()} |`;
        })
        .join("\n")}\n\n`
    : "";

  const definition = n.definition?.trim()
    ? `## Definition\n\n\`\`\`${n.inputSource === "SQL" ? "sql" : "text"}\n${n.definition.trim()}\n\`\`\`\n\n`
    : "";

  const outgoing = g.edges.filter((e) => e.from === n.key || (e.bidirectional && e.to === n.key));
  const joins = outgoing.length
    ? `## Joins\n\n${outgoing
        .map((e) => {
          const forward = e.from === n.key;
          const otherKey = forward ? e.to : e.from;
          const other = g.nodes.find((x) => x.key === otherKey)!;
          const keys = forward ? e.keys : e.keys.map((k) => ({ left: k.right, right: k.left }));
          const cond = keys.map((k) => `\`${k.left} = ${k.right}\``).join(", ");
          const card = e.cardinality
            ? forward
              ? e.cardinality
              : FLIP_CARDINALITY[e.cardinality]
            : undefined;
          let dirLabel = "";
          if (e.direction && e.direction !== "unspecified") {
            let encodedDir = e.direction;
            if (encodedDir === "from_to") encodedDir = forward ? "from_to" : "to_from";
            else if (encodedDir === "to_from") encodedDir = forward ? "to_from" : "from_to";
            dirLabel = ` {dir: ${encodedDir}}`;
          }
          let wpLabel = "";
          if (e.waypoints && e.waypoints.length > 0) {
            const wps = forward ? e.waypoints : [...e.waypoints].reverse();
            wpLabel = ` {waypoints: ${JSON.stringify(wps)}}`;
          }
          const suffix = (card ? ` [${card}]` : "") + dirLabel + wpLabel;
          return `- [${other.title}](./${slugByKey.get(otherKey)}.md) — ${cond}${suffix}`;
        })
        .join("\n")}\n`
    : "";

  return `---\n${fm}\n---\n\n# ${n.title}\n${n.description ? `\n${n.description}\n` : ""}\n${overview}${schema}${definition}${joins}`;
}

export function graphToDbml(graph: ModelGraph): string {
  let dbml = "";

  const escapeId = (id: string) => {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) return id;
    return `"${id.replace(/"/g, '""')}"`;
  };

  const escapeString = (str: string) => {
    return `'${str.replace(/'/g, "''")}'`;
  };

  // 1. Enums / Table definitions
  for (const n of graph.nodes) {
    if (n.type === "group") continue; // DBML doesn't natively support "domains/groups", could use TableGroups but let's skip

    let tableSettings = "";
    if (n.color) {
      tableSettings = ` [headercolor: ${n.color}]`;
    }
    dbml += `Table ${escapeId(n.title)}${tableSettings} {\n`;

    for (const f of n.schema) {
      dbml += `  ${escapeId(f.name)} ${f.type || "varchar"}`;

      const settings: string[] = [];
      if (f.role === "pk") settings.push("primary key");

      const noteParts: string[] = [];
      if (f.alias) noteParts.push(`Alias: ${f.alias}`);
      if (f.pii) noteParts.push("PII");
      if (f.isMeasure) noteParts.push(`Measure: ${f.measureType || "additive"}`);
      if (f.keyType && f.keyType !== "attribute") {
        if (f.keyType === "surrogateHash" && f.hashConfig) {
          noteParts.push(
            `Hash: ${f.hashConfig.algorithm}(${f.hashConfig.sourceColumns.join(",")})`,
          );
        } else {
          noteParts.push(`KeyType: ${f.keyType}`);
        }
      }
      if (f.description) noteParts.push(f.description);

      if (noteParts.length > 0) settings.push(`note: ${escapeString(noteParts.join(" | "))}`);

      if (settings.length > 0) {
        dbml += ` [${settings.join(", ")}]`;
      }
      dbml += "\n";
    }

    if (n.description) {
      dbml += `  Note: ${escapeString(n.description)}\n`;
    }

    dbml += "}\n\n";
  }

  // 2. Relationships (Refs)
  for (const e of graph.edges) {
    const fromNode = graph.nodes.find((n) => n.key === e.from);
    const toNode = graph.nodes.find((n) => n.key === e.to);

    if (!fromNode || !toNode) continue;
    if (e.keys.length === 0) continue;

    // for composite keys, DBML supports multiple fields in ref, but let's do simple first or list them
    // format: Ref: table1.col1 > table2.col2

    let op = ">"; // 1:N default (from left > right)
    if (e.cardinality === "1:1") op = "-";
    else if (e.cardinality === "N:1") op = "<";
    else if (e.cardinality === "N:N") op = "<>";

    for (const key of e.keys) {
      dbml += `Ref: ${escapeId(fromNode.title)}.${escapeId(key.left)} ${op} ${escapeId(toNode.title)}.${escapeId(key.right)}\n`;
    }
  }

  return dbml;
}
