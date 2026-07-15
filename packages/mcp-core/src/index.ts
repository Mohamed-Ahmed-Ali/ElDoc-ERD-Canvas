import * as fs from "node:fs";
import * as path from "node:path";
import { exportToSql, parseBundle, serializeBundle } from "@mc/okf";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export function createEldocServer() {
  const validateGraph = (graph: any) => {
    if (!graph || typeof graph !== "object") {
      throw new Error("Invalid model graph format: expected a JSON object.");
    }
    if (!Array.isArray(graph.nodes)) {
      throw new Error("Invalid model graph format: 'nodes' must be an array of table definitions.");
    }
    if (!Array.isArray(graph.edges)) {
      throw new Error("Invalid model graph format: 'edges' must be an array of relationships.");
    }
    return graph;
  };

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
              type: {
                type: "string",
                description: "Object type. Optional: mart, bridge, domain, lookup. Default: mart",
              },
              namespace: { type: "string", description: "Optional namespace (e.g. crm)" },
              tableName: { type: "string", description: "The physical table name or title" },
              title: { type: "string", description: "Optional display title (defaults to tableName)" },
              description: { type: "string" },
              definition: { type: "string", description: "Optional markdown definition of the table" },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Optional list of tags",
              },
              inputSource: {
                type: "string",
                description: "Optional: SQL, CONNECTOR, VIEW, TABLE. Default: SQL",
              },
              materialization: {
                type: "string",
                description: "Optional: table, view, ephemeral, materialized_view",
              },
              dataTier: {
                type: "string",
                description: "Optional: bronze, silver, gold, raw, staged, curated",
              },
              updateFrequency: {
                type: "string",
                description: "Optional: real-time, hourly, daily, weekly, monthly, manual",
              },
              partitioning: { type: "string", description: "Optional partitioning string" },
              grain: { type: "string", description: "Optional grain string" },
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
              description: { type: "string", description: "Optional column description" },
              alias: { type: "string", description: "Optional column alias" },
              role: {
                type: "string",
                description: "Optional: pk, fk, or none",
              },
              keyType: {
                type: "string",
                description: "Optional: attribute, surrogateSequence, surrogateUUID, natural",
              },
              isComposite: {
                type: "boolean",
                description: "Optional: true if part of a composite key",
              },
              pii: {
                type: "boolean",
                description: "Optional: true if contains PII",
              },
              lineageType: {
                type: "string",
                description: "Optional: DIRECT, DERIVED, JOIN, AGGREGATE, CONSTANT, FILTER",
              },
              lineageLogic: {
                type: "string",
                description: "Optional logic/expression JSON string",
              },
              scdType: {
                type: "string",
                description: "Optional: type1, type2, type3",
              },
              dataClassification: {
                type: "string",
                description: "Optional: public, internal, confidential, restricted",
              },
              maskingPolicy: {
                type: "string",
                description: "Optional masking policy string",
              },
              dataQualityRules: {
                type: "string",
                description: "Optional data quality rules string",
              },
              checkExpression: {
                type: "string",
                description: "Optional SQL check constraint expression (e.g. amount > 0)",
              },
              unique: {
                type: "boolean",
                description: "Optional: true if column has a unique constraint",
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
        const graph = validateGraph(JSON.parse(graphJson));
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
        const graph = validateGraph(JSON.parse(graphJson));
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
        const graph = validateGraph(JSON.parse(graphJson));
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
        const graph = validateGraph(JSON.parse(graphJson));
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
            if (f.lineageType && f.lineageType !== "none") desc += ` [Lineage: ${f.lineageType}]`;
            if (f.lineageLogic) desc += ` [Logic: ${f.lineageLogic}]`;
            if (f.scdType) desc += ` [SCD: ${f.scdType}]`;
            if (f.dataClassification) desc += ` [Classification: ${f.dataClassification}]`;
            if (f.maskingPolicy) desc += ` [Masking: ${f.maskingPolicy}]`;
            if (f.dataQualityRules) desc += ` [Quality Rules: ${f.dataQualityRules}]`;
            if (f.alias) desc += ` [Alias: ${f.alias}]`;
            if (f.keyType) desc += ` [KeyType: ${f.keyType}]`;
            if (f.isComposite) desc += " [Composite]";
            if (f.checkExpression) desc += ` [Check: ${f.checkExpression}]`;
            if (f.unique) desc += " [Unique]";
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
        const graph = validateGraph(JSON.parse(graphJson));
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
      const title = request.params.arguments?.title ? String(request.params.arguments?.title) : tableName;
      const description = request.params.arguments?.description ? String(request.params.arguments?.description) : undefined;
      const type = request.params.arguments?.type ? String(request.params.arguments?.type) : "mart";
      const namespace = request.params.arguments?.namespace ? String(request.params.arguments?.namespace) : undefined;
      const definition = request.params.arguments?.definition ? String(request.params.arguments?.definition) : undefined;
      const inputSource = request.params.arguments?.inputSource ? String(request.params.arguments?.inputSource) : "SQL";
      const tags = Array.isArray(request.params.arguments?.tags) ? request.params.arguments?.tags : undefined;

      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const graph = validateGraph(JSON.parse(raw));

        const counter = Math.max(
          0,
          ...graph.nodes.map((n: any) => {
            const m = /(\d+)$/.exec(n.key);
            return m ? Number(m[1]) : 0;
          }),
        );
        const key = `n${counter + 1}`;

        const materialization = request.params.arguments?.materialization ? String(request.params.arguments?.materialization) : undefined;
        const dataTier = request.params.arguments?.dataTier ? String(request.params.arguments?.dataTier) : undefined;
        const updateFrequency = request.params.arguments?.updateFrequency ? String(request.params.arguments?.updateFrequency) : undefined;
        const partitioning = request.params.arguments?.partitioning ? String(request.params.arguments?.partitioning) : undefined;
        const grain = request.params.arguments?.grain ? String(request.params.arguments?.grain) : undefined;

        graph.nodes.push({
          key,
          type,
          title,
          ...(tableName && { tableName }),
          ...(description && { description }),
          inputSource,
          ...(namespace && { namespace }),
          ...(definition && { definition }),
          ...(tags && { tags }),
          schema: [],
          position: { x: Math.random() * 500, y: Math.random() * 500 },
          status: "pending",
          ...(materialization && { materialization }),
          ...(dataTier && { dataTier }),
          ...(updateFrequency && { updateFrequency }),
          ...(partitioning && { partitioning }),
          ...(grain && { grain }),
        });

        fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
        return {
          content: [{ type: "text", text: `Table ${title} added to ${filePath}.` }],
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
      const keyType = request.params.arguments?.keyType ? String(request.params.arguments?.keyType) : (role === "pk" ? "surrogateSequence" : "attribute");
      const isComposite = request.params.arguments?.isComposite ? Boolean(request.params.arguments?.isComposite) : false;
      const pii = request.params.arguments?.pii ? Boolean(request.params.arguments?.pii) : false;
      const alias = request.params.arguments?.alias ? String(request.params.arguments?.alias) : undefined;
      const description = request.params.arguments?.description ? String(request.params.arguments?.description) : undefined;
      const checkExpression = request.params.arguments?.checkExpression ? String(request.params.arguments?.checkExpression) : undefined;
      const unique = request.params.arguments?.unique ? Boolean(request.params.arguments?.unique) : false;
      const lineageType = request.params.arguments?.lineageType ? String(request.params.arguments?.lineageType) : undefined;
      const lineageLogic = request.params.arguments?.lineageLogic ? String(request.params.arguments?.lineageLogic) : undefined;

      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const graph = validateGraph(JSON.parse(raw));
        const table = graph.nodes.find(
          (n: any) => n.title.toLowerCase() === tableName.toLowerCase() || n.key === tableName,
        );
        if (!table) throw new Error(`Table ${tableName} not found`);

        const newField: any = {
          name: columnName,
          type: columnType,
          role,
          keyType,
          isComposite,
          ...(pii && { pii }),
          ...(alias && { alias }),
          ...(description && { description }),
          ...(checkExpression && { checkExpression }),
          ...(unique && { unique }),
        };
        const scdType = request.params.arguments?.scdType ? String(request.params.arguments?.scdType) : undefined;
        const dataClassification = request.params.arguments?.dataClassification ? String(request.params.arguments?.dataClassification) : undefined;
        const maskingPolicy = request.params.arguments?.maskingPolicy ? String(request.params.arguments?.maskingPolicy) : undefined;
        const dataQualityRules = request.params.arguments?.dataQualityRules ? String(request.params.arguments?.dataQualityRules) : undefined;

        if (lineageType) newField.lineageType = lineageType;
        if (lineageLogic) newField.lineageLogic = lineageLogic;
        if (scdType) newField.scdType = scdType;
        if (dataClassification) newField.dataClassification = dataClassification;
        if (maskingPolicy) newField.maskingPolicy = maskingPolicy;
        if (dataQualityRules) newField.dataQualityRules = dataQualityRules;

        table.schema.push(newField);

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
        const graph = validateGraph(JSON.parse(raw));

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
