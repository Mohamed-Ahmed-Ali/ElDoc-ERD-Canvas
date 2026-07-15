import * as fs from "node:fs";
import * as path from "node:path";
import { exportToSql, parseBundle, serializeBundle } from "@mc/okf";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export function createEldocServer() {
  const server = new Server(
    {
      name: "eldoc-modeler",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "generate_sql",
          description:
            "Generates SQL DDL for an ElDoc/OKF model. Takes into account Glossary and KPIs for inline comments.",
          inputSchema: {
            type: "object",
            properties: {
              graphJson: {
                type: "string",
                description: "The JSON representation of the ElDoc model graph.",
              },
              dialect: {
                type: "string",
                description: "The SQL dialect (e.g. 'postgres', 'snowflake', 'bigquery').",
                default: "postgres",
              },
            },
            required: ["graphJson"],
          },
        },
        {
          name: "get_business_context",
          description:
            "Extracts Glossary terms and KPIs from an ElDoc/OKF model to help the AI reason about business metrics.",
          inputSchema: {
            type: "object",
            properties: {
              graphJson: {
                type: "string",
                description: "The JSON representation of the ElDoc model graph.",
              },
            },
            required: ["graphJson"],
          },
        },
        {
          name: "list_tables",
          description: "Lists all table/node names and descriptions in the model.",
          inputSchema: {
            type: "object",
            properties: {
              graphJson: {
                type: "string",
                description: "The JSON representation of the ElDoc model graph.",
              },
            },
            required: ["graphJson"],
          },
        },
        {
          name: "describe_table",
          description: "Returns the schema (columns, types, roles) for a specific table.",
          inputSchema: {
            type: "object",
            properties: {
              graphJson: {
                type: "string",
                description: "The JSON representation of the ElDoc model graph.",
              },
              tableName: {
                type: "string",
                description: "The name of the table to describe.",
              },
            },
            required: ["graphJson", "tableName"],
          },
        },
        {
          name: "suggest_joins",
          description: "Analyzes schema fields and suggests potential Foreign Key connections.",
          inputSchema: {
            type: "object",
            properties: {
              graphJson: {
                type: "string",
                description: "The JSON representation of the ElDoc model graph.",
              },
            },
            required: ["graphJson"],
          },
        },
        {
          name: "mutate_add_table",
          description: "Adds a new table/node to the ElDoc model OKF file and saves it.",
          inputSchema: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "Absolute path to model.okf",
              },
              tableName: { type: "string" },
              description: { type: "string" },
            },
            required: ["filePath", "tableName"],
          },
        },
        {
          name: "mutate_add_column",
          description: "Adds a column to an existing table in the model.okf file.",
          inputSchema: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "Absolute path to model.okf",
              },
              tableName: { type: "string" },
              columnName: { type: "string" },
              columnType: { type: "string" },
              role: {
                type: "string",
                description: "Optional: pk, fk, or none",
              },
            },
            required: ["filePath", "tableName", "columnName", "columnType"],
          },
        },
        {
          name: "mutate_add_foreign_key",
          description: "Adds a foreign key edge between two tables in the model.okf file.",
          inputSchema: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "Absolute path to model.okf",
              },
              sourceTable: { type: "string" },
              sourceColumn: { type: "string" },
              targetTable: { type: "string" },
              targetColumn: { type: "string" },
            },
            required: ["filePath", "sourceTable", "sourceColumn", "targetTable", "targetColumn"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "generate_sql") {
      const graphJson = String(request.params.arguments?.graphJson);
      const dialect = String(request.params.arguments?.dialect || "postgres");

      try {
        const graph = JSON.parse(graphJson);
        const sql = exportToSql(graph, dialect);
        return {
          content: [{ type: "text", text: sql }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error generating SQL: ${err.message}` }],
          isError: true,
        };
      }
    } else if (request.params.name === "get_business_context") {
      const graphJson = String(request.params.arguments?.graphJson);
      try {
        const graph = JSON.parse(graphJson);
        const glossary = (graph.glossary || [])
          .map((g: any) => `* ${g.term}: ${g.definition}`)
          .join("\n");
        const kpis = (graph.kpis || [])
          .map((k: any) => `* ${k.name}: ${k.expression} (${k.description})`)
          .join("\n");
        let text = "";
        if (glossary) text += `--- GLOSSARY ---\n${glossary}\n\n`;
        if (kpis) text += `--- KPIs ---\n${kpis}\n\n`;
        return {
          content: [{ type: "text", text: text || "No business context found." }],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading business context: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    } else if (request.params.name === "list_tables") {
      const graphJson = String(request.params.arguments?.graphJson);
      try {
        const graph = JSON.parse(graphJson);
        const tables = graph.nodes
          .map(
            (n: any) =>
              `- ${n.title} (${n.inputSource})${n.description ? `: ${n.description}` : ""}`,
          )
          .join("\n");
        return {
          content: [{ type: "text", text: tables || "No tables found." }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error reading tables: ${err.message}` }],
          isError: true,
        };
      }
    } else if (request.params.name === "describe_table") {
      const graphJson = String(request.params.arguments?.graphJson);
      const tableName = String(request.params.arguments?.tableName);
      try {
        const graph = JSON.parse(graphJson);
        const table = graph.nodes.find(
          (n: any) => n.title.toLowerCase() === tableName.toLowerCase() || n.key === tableName,
        );
        if (!table) {
          return {
            content: [{ type: "text", text: `Table '${tableName}' not found.` }],
            isError: true,
          };
        }
        const schema = table.schema
          .map((f: any) => {
            let desc = `  - ${f.name} (${f.type})`;
            if (f.role && f.role !== "none") desc += ` [Role: ${f.role}]`;
            if (f.pii) desc += " [PII]";
            if (f.description) desc += ` - ${f.description}`;
            return desc;
          })
          .join("\n");
        return {
          content: [{ type: "text", text: `Schema for ${table.title}:\n${schema}` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error describing table: ${err.message}` }],
          isError: true,
        };
      }
    } else if (request.params.name === "suggest_joins") {
      const graphJson = String(request.params.arguments?.graphJson);
      try {
        const graph = JSON.parse(graphJson);
        const suggestions: string[] = [];

        // find pk columns
        const pks: { table: any; field: any }[] = [];
        for (const n of graph.nodes) {
          for (const f of n.schema) {
            if (f.role === "pk") pks.push({ table: n, field: f });
          }
        }

        // match FK-like column names against PKs
        for (const n of graph.nodes) {
          for (const f of n.schema) {
            if (
              f.role === "fk" ||
              f.name.toLowerCase().endsWith("_id") ||
              f.name.toLowerCase().endsWith("id")
            ) {
              for (const pk of pks) {
                if (n.key === pk.table.key) continue; // Skip self
                const targetName = pk.table.title.toLowerCase().replace(/s$/, ""); // Basic singularization
                if (
                  f.name.toLowerCase().startsWith(targetName) ||
                  f.name.toLowerCase() === pk.field.name.toLowerCase()
                ) {
                  suggestions.push(
                    `Suggest joining ${n.title}.${f.name} -> ${pk.table.title}.${pk.field.name}`,
                  );
                }
              }
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: suggestions.length > 0 ? suggestions.join("\n") : "No join suggestions found.",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error analyzing joins: ${err.message}` }],
          isError: true,
        };
      }
    } else if (request.params.name === "mutate_add_table") {
      const filePath = String(request.params.arguments?.filePath);
      const tableName = String(request.params.arguments?.tableName);
      const description = request.params.arguments?.description
        ? String(request.params.arguments?.description)
        : undefined;

      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const graph = JSON.parse(raw);

        const counter = Math.max(
          0,
          ...graph.nodes.map((n: any) => {
            const m = /(\d+)$/.exec(n.key);
            return m ? Number(m[1]) : 0;
          }),
        );
        const key = `n${counter + 1}`;

        graph.nodes.push({
          key,
          type: "mart",
          title: tableName,
          description,
          inputSource: "SQL",
          schema: [],
          position: { x: Math.random() * 500, y: Math.random() * 500 },
          status: "pending",
        });

        fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
        return {
          content: [{ type: "text", text: `Table ${tableName} added to ${filePath}.` }],
        };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    } else if (request.params.name === "mutate_add_column") {
      const filePath = String(request.params.arguments?.filePath);
      const tableName = String(request.params.arguments?.tableName);
      const columnName = String(request.params.arguments?.columnName);
      const columnType = String(request.params.arguments?.columnType);
      const role = request.params.arguments?.role ? String(request.params.arguments?.role) : "none";

      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const graph = JSON.parse(raw);
        const table = graph.nodes.find(
          (n: any) => n.title.toLowerCase() === tableName.toLowerCase() || n.key === tableName,
        );
        if (!table) throw new Error(`Table ${tableName} not found`);

        table.schema.push({
          name: columnName,
          type: columnType,
          role,
          keyType: role === "pk" ? "surrogateSequence" : "attribute",
          isComposite: false,
        });

        fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
        return {
          content: [
            {
              type: "text",
              text: `Column ${columnName} added to ${tableName}.`,
            },
          ],
        };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    } else if (request.params.name === "mutate_add_foreign_key") {
      const filePath = String(request.params.arguments?.filePath);
      const sourceTable = String(request.params.arguments?.sourceTable);
      const sourceColumn = String(request.params.arguments?.sourceColumn);
      const targetTable = String(request.params.arguments?.targetTable);
      const targetColumn = String(request.params.arguments?.targetColumn);

      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const graph = JSON.parse(raw);

        const src = graph.nodes.find(
          (n: any) => n.title.toLowerCase() === sourceTable.toLowerCase() || n.key === sourceTable,
        );
        const tgt = graph.nodes.find(
          (n: any) => n.title.toLowerCase() === targetTable.toLowerCase() || n.key === targetTable,
        );
        if (!src) throw new Error(`Source table ${sourceTable} not found`);
        if (!tgt) throw new Error(`Target table ${targetTable} not found`);

        const counter = Math.max(
          0,
          ...graph.edges.map((e: any) => {
            const m = /(\d+)$/.exec(e.id);
            return m ? Number(m[1]) : 0;
          }),
        );
        const edgeId = `e${counter + 1}`;

        graph.edges.push({
          id: edgeId,
          from: src.key,
          to: tgt.key,
          keys: [{ left: sourceColumn, right: targetColumn }],
          bidirectional: false,
          lineType: "bezier",
          animated: true,
        });

        fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
        return {
          content: [
            {
              type: "text",
              text: `Foreign key ${sourceTable}.${sourceColumn} -> ${targetTable}.${targetColumn} added.`,
            },
          ],
        };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  return server;
}
