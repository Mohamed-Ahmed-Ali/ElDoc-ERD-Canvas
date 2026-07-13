import { describe, it, expect } from "vitest";
import initSqlJs from "sql.js";
import { exportToSql } from "../src/sql";
import type { ModelGraph } from "../src/types";

describe("SQL Integration", () => {
  it("should generate valid sqlite DDL that sql.js can execute", async () => {
    const graph: ModelGraph = {
      storageId: "test-db",
      version: 1,
      nodes: [
        {
          key: "users",
          title: "users",
          type: "mart",
          inputSource: "TABLE",
          schema: [
            { name: "id", type: "UUID", role: "pk" },
            { name: "email", type: "STRING", role: "none" },
            { name: "created_at", type: "TIMESTAMP", role: "none", nullable: true },
          ],
          position: { x: 0, y: 0 },
        },
        {
          key: "orders",
          title: "orders",
          type: "mart",
          inputSource: "TABLE",
          schema: [
            { name: "id", type: "UUID", role: "pk" },
            { name: "user_id", type: "UUID", role: "fk" },
            { name: "amount", type: "DECIMAL", role: "none" },
          ],
          position: { x: 100, y: 0 },
        },
      ],
      edges: [],
    };

    const ddl = exportToSql(graph, "postgres"); // We use postgres dialect but it's largely standard DDL

    // sQLite does not support ALTER TABLE ADD CONSTRAINT FOREIGN KEY
    const sqliteCompatibleDdl = ddl
      .split(";")
      .filter((stmt) => !stmt.trim().startsWith("ALTER TABLE"))
      .join(";");

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // execute the generated DDL
    // note: SQLite ignores some PostgreSQL specifics, but basic CREATE TABLE works.
    expect(() => db.exec(sqliteCompatibleDdl)).not.toThrow();

    // verify the tables were created by querying the SQLite master table
    const result = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'orders')",
    );

    expect(result.length).toBeGreaterThan(0);
    const tables = result[0].values.map((row) => row[0] as string);

    expect(tables).toHaveLength(2);
    expect(tables).toContain("users");
    expect(tables).toContain("orders");

    // clean up
    db.close();
  });
});
