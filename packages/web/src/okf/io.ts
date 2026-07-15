import { type ModelGraph, exportToSql, graphToDbml, parseBundle, serializeBundle } from "@mc/okf";
export function graphToBundleFiles(g: ModelGraph, projectTitle: string): Record<string, string> {
  return serializeBundle(g, projectTitle).files;
}

export function graphToSqlFile(g: ModelGraph, dialect = "postgres"): string {
  return exportToSql(g, dialect);
}

export function graphToDbmlFile(g: ModelGraph): string {
  return graphToDbml(g);
}

export function graphToCsv(g: ModelGraph): string {
  const rows = [
    [
      "Table Name",
      "Table Description",
      "Column Name",
      "Data Type",
      "Role",
      "Key Type",
      "Foreign Key To",
      "Column Description",
      "PII",
      "Alias",
      "Composite Group",
      "Is Measure",
      "Measure Type",
      "Nullable",
      "Default Value",
      "Unique",
      "Check Expression",
      "Lineage Type",
      "Lineage Logic",
    ].join(","),
  ];
  for (const node of g.nodes) {
    for (const field of node.schema) {
      let fkTo = "";
      for (const edge of g.edges) {
        if (edge.from === node.key) {
          const keyMatch = edge.keys.find((k) => k.left === field.name);
          if (keyMatch) {
            const toNode = g.nodes.find((n) => n.key === edge.to);
            if (toNode) fkTo = `${toNode.title}.${keyMatch.right}`;
          }
        }
      }
      rows.push(
        [
          JSON.stringify(node.title),
          JSON.stringify(node.description || ""),
          JSON.stringify(field.name),
          JSON.stringify(field.type),
          JSON.stringify(field.role || "none"),
          JSON.stringify(field.keyType || "attribute"),
          JSON.stringify(fkTo),
          JSON.stringify(field.description || ""),
          field.pii ? "Yes" : "No",
          JSON.stringify(field.alias || ""),
          JSON.stringify(field.compositeGroup || ""),
          field.isMeasure ? "Yes" : "No",
          JSON.stringify(field.measureType || ""),
          field.nullable !== false ? "Yes" : "No",
          JSON.stringify(field.defaultValue || ""),
          field.unique ? "Yes" : "No",
          JSON.stringify(field.checkExpression || ""),
          JSON.stringify(field.lineageType || "none"),
          JSON.stringify(field.lineageLogic || ""),
        ].join(","),
      );
    }
  }
  return rows.join("\n");
}

export function filesToGraph(files: Record<string, string>): ModelGraph {
  return parseBundle(expandBundles(files));
}

// a downloaded OKF bundle is a single .md file with every doc concatenated
// behind `<!-- path -->` markers (see downloadBundle). When such a file is
// uploaded, expand it back into its constituent files so each doc keeps its
// own frontmatter; otherwise parseBundle treats the whole blob as one document.
const BUNDLE_MARKER = /<!--\s*.+?\s*-->\n/;
function expandBundles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    if (BUNDLE_MARKER.test(content)) Object.assign(out, parsePastedMarkdown(content));
    else out[name] = content;
  }
  return out;
}

// ponytail: browser can download text directly, no need for fflate/zip
export function downloadBundle(files: Record<string, string>, name = "model") {
  const content = Object.entries(files)
    .map(([path, text]) => `<!-- ${path} -->\n${text}`)
    .join("\n\n");
  const blob = new Blob([content], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.okf.md`;
  a.click();
}

export function downloadSql(sql: string, name = "model") {
  const blob = new Blob([sql], { type: "application/sql" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.sql`;
  a.click();
}

export function downloadCsv(csv: string, name = "model_dictionary") {
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
}

export function downloadDbml(dbml: string, name = "model") {
  const blob = new Blob([dbml], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.dbml`;
  a.click();
}

export function parsePastedMarkdown(text: string): Record<string, string> {
  const parts = text.split(/<!--\s*(.+?)\s*-->\n/).slice(1);
  if (parts.length === 0) return { "pasted/doc.md": text };
  const files: Record<string, string> = {};
  for (let i = 0; i < parts.length; i += 2) files[parts[i]] = parts[i + 1] || "";
  return files;
}
