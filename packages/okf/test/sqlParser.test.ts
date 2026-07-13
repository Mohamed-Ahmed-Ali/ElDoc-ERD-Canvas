import { describe, it, expect } from "vitest";
import { parseSql } from "../src/sql";

describe("sqlParser", () => {
  it("should parse standard CREATE TABLE statements", () => {
    const sql = `
      CREATE TABLE users (
        id INT PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        created_at TIMESTAMP
      );
    `;
    const graph = parseSql(sql);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].title).toBe("users");
    expect(graph.nodes[0].schema).toHaveLength(3);
    expect(graph.nodes[0].schema[0].name).toBe("id");
    expect(graph.nodes[0].schema[0].role).toBe("pk");
    expect(graph.nodes[0].schema[1].name).toBe("email");
  });

  it("should parse CREATE TABLE AS SELECT statements", () => {
    const sql = `
      CREATE TABLE active_users AS 
      SELECT u.id, u.email, profile.avatar_url AS avatar 
      FROM users u 
      JOIN profiles profile ON u.id = profile.user_id;
    `;
    const graph = parseSql(sql);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].title).toBe("active_users");
    expect(graph.nodes[0].schema).toHaveLength(3);
    expect(graph.nodes[0].schema[0].name).toBe("id");
    expect(graph.nodes[0].schema[1].name).toBe("email");
    expect(graph.nodes[0].schema[2].name).toBe("avatar");
  });

  it("should parse CREATE VIEW AS SELECT statements", () => {
    const sql = `
      CREATE OR REPLACE VIEW user_summary AS
      SELECT id, COUNT(order_id) AS total_orders, SUM(amount) AS total_spent
      FROM orders
      GROUP BY id;
    `;
    const graph = parseSql(sql);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].title).toBe("user_summary");
    expect(graph.nodes[0].inputSource).toBe("VIEW");
    expect(graph.nodes[0].schema).toHaveLength(3);
    expect(graph.nodes[0].schema[0].name).toBe("id");
    expect(graph.nodes[0].schema[1].name).toBe("total_orders");
    expect(graph.nodes[0].schema[2].name).toBe("total_spent");
  });

  it("should fallback to raw SELECT statements if no table is created", () => {
    const sql = `
      -- Some descriptive comment
      SELECT 
        user_id,
        first_name,
        last_name AS surname,
        email
      FROM customers;
    `;
    const graph = parseSql(sql);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].title).toBe("Query Result");
    expect(graph.nodes[0].schema).toHaveLength(4);
    expect(graph.nodes[0].schema[0].name).toBe("user_id");
    expect(graph.nodes[0].schema[1].name).toBe("first_name");
    expect(graph.nodes[0].schema[2].name).toBe("surname");
    expect(graph.nodes[0].schema[3].name).toBe("email");
  });
});
