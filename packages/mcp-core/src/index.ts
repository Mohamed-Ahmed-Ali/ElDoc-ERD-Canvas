import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { parseBundle, exportToSql, serializeBundle } from "@mc/okf";

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
          content: [{ type: "text", text: `Error reading business context: ${err.message}` }],
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
            if (f.pii) desc += ` [PII]`;
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
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  return server;
}
