import type { ModelEdge, ModelGraph, ModelNode, SchemaField } from "./types";

export interface ParseWarning {
  line: number;
  col: number;
  message: string;
}

export interface ParseResult extends ModelGraph {
  warnings?: ParseWarning[];
}

type Token = {
  type: "ident" | "string" | "number" | "symbol" | "keyword";
  value: string;
  line: number;
  col: number;
};

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const advance = () => {
    if (i < sql.length) {
      if (sql[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  const isAlpha = (c: string) => /[a-zA-Z_]/.test(c);
  const isDigit = (c: string) => /[0-9]/.test(c);
  const isIdent = (c: string) => /[a-zA-Z0-9_.]/.test(c);
  const isSpace = (c: string) => /\s/.test(c);

  while (i < sql.length) {
    const c = sql[i];
    const startLine = line;
    const startCol = col;

    if (isSpace(c)) {
      advance();
      continue;
    }

    // single line comment
    if (c === "-" && sql[i + 1] === "-") {
      advance();
      advance();
      while (i < sql.length && sql[i] !== "\n") advance();
      continue;
    }

    // multi line comment
    if (c === "/" && sql[i + 1] === "*") {
      advance();
      advance();
      while (i < sql.length - 1 && !(sql[i] === "*" && sql[i + 1] === "/")) advance();
      advance();
      advance();
      continue;
    }

    // string literals and quoted identifiers
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      let val = "";
      advance();
      while (i < sql.length && sql[i] !== quote) {
        val += sql[i];
        advance();
      }
      advance(); // skip closing quote
      tokens.push({
        type: quote === "'" ? "string" : "ident",
        value: val,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // numbers
    if (isDigit(c)) {
      let val = "";
      while (i < sql.length && (isDigit(sql[i]) || sql[i] === ".")) {
        val += sql[i];
        advance();
      }
      tokens.push({ type: "number", value: val, line: startLine, col: startCol });
      continue;
    }

    // identifiers / keywords
    if (isAlpha(c)) {
      let val = "";
      while (i < sql.length && isIdent(sql[i])) {
        val += sql[i];
        advance();
      }
      const upper = val.toUpperCase();
      const keywords = new Set([
        "CREATE",
        "TABLE",
        "IF",
        "NOT",
        "EXISTS",
        "ALTER",
        "ADD",
        "CONSTRAINT",
        "FOREIGN",
        "KEY",
        "REFERENCES",
        "PRIMARY",
        "UNIQUE",
        "INDEX",
        "DEFAULT",
        "NULL",
        "VIEW",
        "OR",
        "REPLACE",
        "AS",
        "SELECT",
        "FROM",
      ]);
      if (keywords.has(upper)) {
        tokens.push({ type: "keyword", value: upper, line: startLine, col: startCol });
      } else {
        tokens.push({ type: "ident", value: val, line: startLine, col: startCol });
      }
      continue;
    }

    // symbols
    tokens.push({ type: "symbol", value: c, line: startLine, col: startCol });
    advance();
  }

  return tokens;
}

function parseSelectColumns(
  tokens: Token[],
  startIndex: number,
): { fields: SchemaField[]; endIndex: number } {
  let j = startIndex;
  const fields: SchemaField[] = [];

  // skip to SELECT keyword
  while (j < tokens.length && !(tokens[j].value.toUpperCase() === "SELECT")) {
    j++;
  }
  if (j >= tokens.length) return { fields, endIndex: j };
  j++; // skip SELECT

  let parenDepth = 0;
  while (j < tokens.length) {
    const t = tokens[j];
    if (t.type === "symbol" && t.value === "(") {
      parenDepth++;
      j++;
      continue;
    }
    if (t.type === "symbol" && t.value === ")") {
      parenDepth--;
      j++;
      continue;
    }

    if (parenDepth === 0 && t.value.toUpperCase() === "FROM") {
      break;
    }

    if (parenDepth === 0) {
      // we are at a select list item
      const exprTokens: Token[] = [];
      while (j < tokens.length) {
        const curr = tokens[j];
        if (curr.type === "symbol" && curr.value === "(") {
          parenDepth++;
        } else if (curr.type === "symbol" && curr.value === ")") {
          parenDepth--;
        }

        if (
          parenDepth === 0 &&
          ((curr.type === "symbol" && curr.value === ",") || curr.value.toUpperCase() === "FROM")
        ) {
          break;
        }
        exprTokens.push(curr);
        j++;
      }

      if (exprTokens.length > 0) {
        let colName = "";
        const last = exprTokens[exprTokens.length - 1];
        if (last.type === "ident" || last.type === "string" || last.type === "keyword") {
          const prev = exprTokens[exprTokens.length - 2];
          if (prev && prev.value.toUpperCase() === "AS") {
            colName = last.value;
          } else {
            colName = last.value;
          }
        }

        colName = colName.replace(/['"`]/g, "");
        if (colName && colName !== "*" && !/^[0-9]+$/.test(colName)) {
          const dotParts = colName.split(".");
          const finalCol = dotParts[dotParts.length - 1];
          if (finalCol && finalCol !== "*" && !/^[0-9]+$/.test(finalCol)) {
            fields.push({ name: finalCol, type: "STRING", pk: false });
          }
        }
      }

      if (j < tokens.length && tokens[j].type === "symbol" && tokens[j].value === ",") {
        j++;
      }
    } else {
      j++;
    }
  }

  return { fields, endIndex: j };
}

export function parseSqlRobust(sql: string, strict = false): ParseResult {
  const tokens = tokenize(sql);
  const nodes: ModelNode[] = [];
  const edges: ModelEdge[] = [];
  const warnings: ParseWarning[] = [];

  let i = 0;

  const matchToken = (type?: string, value?: string) => {
    if (i >= tokens.length) return false;
    const t = tokens[i];
    if (type && t.type !== type) return false;
    if (value && t.value.toUpperCase() !== value.toUpperCase()) return false;
    return true;
  };

  const expect = (type?: string, value?: string) => {
    if (matchToken(type, value)) {
      i++;
      return true;
    }
    return false;
  };

  const getIdent = () => {
    if (i >= tokens.length) return null;
    let val = "";

    // handle SQL Server [bracket] identifiers
    if (tokens[i].type === "symbol" && tokens[i].value === "[") {
      i++;
      while (i < tokens.length && !(tokens[i].type === "symbol" && tokens[i].value === "]")) {
        val += tokens[i].value;
        i++;
      }
      if (i < tokens.length) i++; // skip ']'
    } else if (
      tokens[i].type === "ident" ||
      tokens[i].type === "keyword" ||
      tokens[i].type === "string"
    ) {
      // strings can be quoted identifiers if using double quotes or backticks
      val = tokens[i].value;
      i++;
    } else {
      return null;
    }

    // stitch together dot-separated identifiers (e.g. schema.table)
    while (i < tokens.length && tokens[i].type === "symbol" && tokens[i].value === ".") {
      val += ".";
      i++;

      if (i < tokens.length) {
        if (tokens[i].type === "symbol" && tokens[i].value === "[") {
          i++;
          while (i < tokens.length && !(tokens[i].type === "symbol" && tokens[i].value === "]")) {
            val += tokens[i].value;
            i++;
          }
          if (i < tokens.length) i++;
        } else if (
          tokens[i].type === "ident" ||
          tokens[i].type === "keyword" ||
          tokens[i].type === "string"
        ) {
          val += tokens[i].value;
          i++;
        }
      }
    }

    return val.replace(/['"`]/g, ""); // strip quotes for the final name
  };

  while (i < tokens.length) {
    if (expect("keyword", "CREATE")) {
      let isTable = false;
      let isView = false;
      if (expect("keyword", "TABLE")) {
        isTable = true;
      } else if (expect("keyword", "VIEW")) {
        isView = true;
      } else if (expect("keyword", "OR")) {
        expect("keyword", "REPLACE");
        if (expect("keyword", "VIEW")) {
          isView = true;
        }
      }

      if (isView) {
        const viewName = getIdent();
        if (viewName && expect("keyword", "AS")) {
          expect("symbol", "("); // optional open paren
          const { fields, endIndex } = parseSelectColumns(tokens, i);
          i = endIndex;
          while (
            i < tokens.length &&
            !matchToken("symbol", ";") &&
            !matchToken("keyword", "CREATE") &&
            !matchToken("keyword", "ALTER")
          ) {
            i++;
          }
          expect("symbol", ";");

          nodes.push({
            key: viewName,
            title: viewName,
            inputSource: "VIEW",
            status: "pending",
            schema: fields,
            position: { x: 0, y: 0 },
          });
        } else {
          while (
            i < tokens.length &&
            !matchToken("symbol", ";") &&
            !matchToken("keyword", "CREATE") &&
            !matchToken("keyword", "ALTER")
          )
            i++;
        }
        continue;
      }

      if (isTable) {
        expect("keyword", "IF");
        expect("keyword", "NOT");
        expect("keyword", "EXISTS");

        const tableName = getIdent();
        if (!tableName) {
          i++;
          continue;
        }

        if (!expect("symbol", "(")) {
          if (expect("keyword", "AS")) {
            expect("symbol", "("); // optional open paren
            const { fields, endIndex } = parseSelectColumns(tokens, i);
            i = endIndex;
            while (
              i < tokens.length &&
              !matchToken("symbol", ";") &&
              !matchToken("keyword", "CREATE") &&
              !matchToken("keyword", "ALTER")
            ) {
              i++;
            }
            expect("symbol", ";");

            nodes.push({
              key: tableName,
              title: tableName,
              inputSource: "SQL",
              status: "pending",
              schema: fields,
              position: { x: 0, y: 0 },
            });
          } else {
            i++;
          }
        } else {
          const schema: SchemaField[] = [];
          const pkSet = new Set<string>();

          // parse columns and constraints
          while (i < tokens.length && !matchToken("symbol", ")")) {
            if (expect("keyword", "PRIMARY")) {
              expect("keyword", "KEY");
              if (expect("symbol", "(")) {
                while (i < tokens.length && !matchToken("symbol", ")")) {
                  const col = getIdent();
                  if (col) pkSet.add(col);
                  else i++;
                  expect("symbol", ",");
                }
                expect("symbol", ")");
              }
            } else if (expect("keyword", "FOREIGN")) {
              expect("keyword", "KEY");
              const sourceCols: string[] = [];
              if (expect("symbol", "(")) {
                while (i < tokens.length && !matchToken("symbol", ")")) {
                  const col = getIdent();
                  if (col) sourceCols.push(col);
                  else i++;
                  expect("symbol", ",");
                }
                expect("symbol", ")");
              }
              if (expect("keyword", "REFERENCES")) {
                const targetTable = getIdent();
                const targetCols: string[] = [];
                if (expect("symbol", "(")) {
                  while (i < tokens.length && !matchToken("symbol", ")")) {
                    const col = getIdent();
                    if (col) targetCols.push(col);
                    else i++;
                    expect("symbol", ",");
                  }
                  expect("symbol", ")");
                }

                if (targetTable && sourceCols.length && targetCols.length) {
                  sourceCols.forEach((col) => {
                    const field = schema.find((f) => f.name === col);
                    if (field) field.fk = true;
                  });
                  edges.push({
                    id: `e${edges.length + 1}`,
                    from: tableName,
                    to: targetTable,
                    keys: sourceCols.map((left, idx) => ({ left, right: targetCols[idx] || left })),
                    bidirectional: false,
                  });
                }
              }
            } else if (expect("keyword", "CONSTRAINT")) {
              getIdent(); // skip constraint name
              // next iteration will catch PRIMARY KEY, FOREIGN KEY, or UNIQUE
              continue;
            } else if (
              expect("keyword", "INDEX") ||
              expect("keyword", "KEY") ||
              expect("keyword", "UNIQUE")
            ) {
              if (tokens[i - 1].value.toUpperCase() === "UNIQUE") {
                if (expect("keyword", "INDEX") || expect("keyword", "KEY")) {
                }
              }
              getIdent(); // optional index name
              if (expect("symbol", "(")) {
                while (i < tokens.length && !matchToken("symbol", ")")) {
                  const col = getIdent();
                  if (col) {
                    const field = schema.find((f) => f.name === col);
                    if (field) field.index = true;
                  } else {
                    i++;
                  }
                  expect("symbol", ",");
                }
                expect("symbol", ")");
              }
            } else {
              // column definition
              const colName = getIdent();
              if (colName) {
                // next is type, which could be multiple words like "DOUBLE PRECISION" or include parens like "VARCHAR(255)"
                let typeStr = "";
                while (
                  i < tokens.length &&
                  !matchToken("symbol", ",") &&
                  !matchToken("symbol", ")") &&
                  !matchToken("keyword", "PRIMARY") &&
                  !matchToken("keyword", "FOREIGN")
                ) {
                  if (matchToken("symbol", "(")) {
                    typeStr += "(";
                    i++;
                    while (i < tokens.length && !matchToken("symbol", ")")) {
                      typeStr += tokens[i].value;
                      i++;
                    }
                    if (expect("symbol", ")")) typeStr += ")";
                  } else {
                    typeStr += `${tokens[i].value} `;
                    i++;
                  }
                }
                typeStr = typeStr.trim();
                schema.push({ name: colName, type: typeStr, pk: false });
                // if the next tokens are PRIMARY KEY, consume them and mark as pk:
                if (expect("keyword", "PRIMARY")) {
                  if (expect("keyword", "KEY")) {
                    schema[schema.length - 1].role = "pk";
                  }
                }

                // check for Surrogate Keys / generation rules
                const autoIncMatch = typeStr.match(
                  /\b(?:AUTO_INCREMENT|IDENTITY\s*\([^)]*\)|SERIAL|BIGSERIAL|SMALLSERIAL)\b/i,
                );
                if (autoIncMatch) {
                  schema[schema.length - 1].sk = true;
                  schema[schema.length - 1].generationRule = autoIncMatch[0].trim();
                  typeStr = typeStr.replace(autoIncMatch[0], "").trim();
                } else {
                  const defaultMatch = typeStr.match(/\bDEFAULT\s+([^,\)]+)/i);
                  if (defaultMatch?.[1].toLowerCase().includes("uuid")) {
                    schema[schema.length - 1].sk = true;
                    schema[schema.length - 1].generationRule = defaultMatch[0].trim();
                    typeStr = typeStr.replace(defaultMatch[0], "").trim();
                  }
                }

                // check for inline UNIQUE or INDEX
                if (/\b(?:UNIQUE|INDEX)\b/i.test(typeStr)) {
                  schema[schema.length - 1].index = true;
                  typeStr = typeStr.replace(/\b(?:UNIQUE|INDEX)\b/i, "").trim();
                }

                schema[schema.length - 1].type = typeStr.replace(/\s+/g, " ").trim();
              } else {
                i++;
              }
            }

            if (expect("symbol", ",")) {
              // continue next column/constraint
            } else if (i < tokens.length && !matchToken("symbol", ")")) {
              // if we didn't see a comma and didn't see a closing parenthesis, we must advance to avoid infinite loop
              i++;
            }
          }

          expect("symbol", ")");

          for (const f of schema) {
            if (pkSet.has(f.name)) {
              f.role = "pk";
            }
          }

          nodes.push({
            key: tableName,
            title: tableName,
            inputSource: "SQL",
            status: "pending",
            schema,
            position: { x: 0, y: 0 },
          });
        }
      }
    } else if (expect("keyword", "ALTER")) {
      if (expect("keyword", "TABLE")) {
        const fromTable = getIdent();
        if (expect("keyword", "ADD")) {
          if (expect("keyword", "CONSTRAINT")) getIdent(); // skip name

          if (expect("keyword", "FOREIGN")) {
            expect("keyword", "KEY");
            const sourceCols: string[] = [];
            if (expect("symbol", "(")) {
              while (i < tokens.length && !matchToken("symbol", ")")) {
                const col = getIdent();
                if (col) sourceCols.push(col);
                else i++;
                expect("symbol", ",");
              }
              expect("symbol", ")");
            }
            if (expect("keyword", "REFERENCES")) {
              const targetTable = getIdent();
              const targetCols: string[] = [];
              if (expect("symbol", "(")) {
                while (i < tokens.length && !matchToken("symbol", ")")) {
                  const col = getIdent();
                  if (col) targetCols.push(col);
                  else i++;
                  expect("symbol", ",");
                }
                expect("symbol", ")");
              }

              if (fromTable && targetTable && sourceCols.length && targetCols.length) {
                const node = nodes.find((n) => n.key === fromTable);
                if (node) {
                  sourceCols.forEach((col) => {
                    const field = node.schema.find((f) => f.name === col);
                    if (field) field.fk = true;
                  });
                }
                edges.push({
                  id: `e${edges.length + 1}`,
                  from: fromTable,
                  to: targetTable,
                  keys: sourceCols.map((left, idx) => ({ left, right: targetCols[idx] || left })),
                  bidirectional: false,
                });
              }
            }
          }
        }
      }
    } else {
      const t = tokens[i];
      const msg = `Unexpected token: ${t.value}`;
      if (strict) throw new Error(`Parse error at line ${t.line}, col ${t.col}: ${msg}`);
      warnings.push({ line: t.line, col: t.col, message: msg });
      i++;
    }
  }

  if (nodes.length === 0) {
    const { fields } = parseSelectColumns(tokens, 0);
    if (fields.length > 0) {
      nodes.push({
        key: "Query_Result",
        title: "Query Result",
        inputSource: "SQL",
        status: "pending",
        schema: fields,
        position: { x: 0, y: 0 },
      });
    }
  }

  return { storageId: null, nodes, edges, warnings };
}
