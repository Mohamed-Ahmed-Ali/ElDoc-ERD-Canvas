import type { ModelGraph, ModelNode, ModelEdge, SchemaField, Cardinality } from "./types";
import { slugify } from "./slug";

function mapType(type: string, dialect: string): string {
  const t = type.toUpperCase().trim();
  switch (dialect.toLowerCase()) {
    case "bigquery":
      if (t === "VARCHAR" || t === "TEXT") return "STRING";
      if (t === "INTEGER" || t === "INT") return "INT64";
      if (t === "BOOLEAN") return "BOOL";
      return t;
    case "snowflake":
      if (t === "TEXT") return "VARCHAR";
      if (t === "INTEGER" || t === "INT") return "NUMBER";
      return t;
    case "tsql":
      if (t === "STRING" || t === "TEXT") return "VARCHAR(MAX)";
      if (t === "BOOLEAN") return "BIT";
      if (t === "TIMESTAMP") return "DATETIME2";
      return t;
    case "mysql":
      if (t === "STRING") return "VARCHAR(255)";
      if (t === "BOOLEAN") return "TINYINT(1)";
      if (t === "TIMESTAMP") return "DATETIME";
      return t;
    case "sparksql":
      if (t === "VARCHAR" || t === "TEXT") return "STRING";
      if (t === "INTEGER") return "INT";
      return t;
    case "postgres":
    default:
      if (t === "STRING") return "TEXT";
      return t;
  }
}

export function exportToSql(graph: ModelGraph, dialect: string = "postgres"): string {
  const lines: string[] = [];

  // create tables
  for (const n of graph.nodes) {
    if (n.description) {
      lines.push(`-- ${n.description.replace(/\n/g, "\n-- ")}`);
    }
    let safeTitle = slugify(n.title, n.key).replace(/-/g, "_");
    if (n.namespace) {
      safeTitle = `${n.namespace}.${safeTitle}`;
    }

    const kind = n.inputSource === "VIEW" ? "VIEW" : "TABLE";

    if (kind === "VIEW" && n.definition) {
      lines.push(`CREATE OR REPLACE VIEW ${safeTitle} AS\n${n.definition.trim()};\n`);
      continue;
    }

    lines.push(`CREATE TABLE ${safeTitle} (`);

    const cols: string[] = [];
    const pks: string[] = [];
    for (const f of n.schema) {
      let colDef = `  ${f.name} ${mapType(f.type, dialect)}`;
      if (f.nullable === false || f.role === "pk") {
        colDef += " NOT NULL";
      }
      if (f.defaultValue) {
        colDef += ` DEFAULT ${f.defaultValue}`;
      }
      if (f.unique) {
        colDef += " UNIQUE";
      }
      if (f.checkExpression) {
        colDef += ` CHECK (${f.checkExpression})`;
      }

      if (f.keyType === "surrogateHash" && f.hashConfig) {
        const sourceCols = f.hashConfig.sourceColumns.join(", ");
        const algo = f.hashConfig.algorithm.toUpperCase();
        colDef += ` /* Hash: ${algo}(${sourceCols}) */`;
      }

      const noteParts: string[] = [];
      if (f.alias) noteParts.push(`Alias: ${f.alias}`);
      if (f.pii) noteParts.push("PII");
      if (f.isMeasure) noteParts.push(`Measure: ${f.measureType || "additive"}`);
      if (f.role && f.role !== "none" && f.role !== "pk")
        noteParts.push(`Role: ${f.role.toUpperCase()}`);
      if (f.keyType && f.keyType !== "attribute" && f.keyType !== "surrogateHash")
        noteParts.push(`KeyType: ${f.keyType}`);
      if (f.isComposite && f.compositeGroup) noteParts.push(`Group: ${f.compositeGroup}`);
      if (f.description) noteParts.push(f.description);

      if (noteParts.length > 0) {
        colDef += ` /* ${noteParts.join(" | ").replace(/\/\*/g, "").replace(/\*\//g, "")} */`;
      }
      cols.push(colDef);
      if (f.role === "pk") {
        pks.push(f.name);
      }
    }

    if (pks.length > 0) {
      cols.push(`  PRIMARY KEY (${pks.join(", ")})`);
    }

    lines.push(cols.join(",\n"));
    lines.push(`);\n`);

    // explicit Foreign Keys from Schema (independent of canvas edges)
    for (const f of n.schema) {
      if (f.role === "fk" && f.foreignKeyRef?.targetTable) {
        const target = f.foreignKeyRef.targetTable;
        const targetCol = f.foreignKeyRef.targetColumn || f.name;
        lines.push(
          `ALTER TABLE ${safeTitle} ADD FOREIGN KEY (${f.name}) REFERENCES ${target} (${targetCol});\n`,
        );
      }
    }
  }

  // add foreign keys
  if (graph.edges.length > 0) {
    lines.push(`-- Relationships`);
  }

  const safeName = (key: string) => {
    const node = graph.nodes.find((n) => n.key === key);
    if (!node) return key;
    let name = slugify(node.title, node.key).replace(/-/g, "_");
    if (node.namespace) {
      name = `${node.namespace}.${name}`;
    }
    return name;
  };

  for (const e of graph.edges) {
    const fromName = safeName(e.from);
    const toName = safeName(e.to);

    const leftKeys = e.keys.map((k) => k.left).join(", ");
    const rightKeys = e.keys.map((k) => k.right).join(", ");

    if (leftKeys && rightKeys) {
      lines.push(
        `ALTER TABLE ${fromName} ADD FOREIGN KEY (${leftKeys}) REFERENCES ${toName} (${rightKeys});`,
      );
    }

    if (e.bidirectional) {
      lines.push(
        `ALTER TABLE ${toName} ADD FOREIGN KEY (${rightKeys}) REFERENCES ${fromName} (${leftKeys});`,
      );
    }
  }

  return lines.join("\n");
}

import { parseSqlRobust } from "./sqlParser";
import type { ParseResult } from "./sqlParser";

export function parseSql(sql: string, strict = false): ParseResult {
  return parseSqlRobust(sql, strict);
}
