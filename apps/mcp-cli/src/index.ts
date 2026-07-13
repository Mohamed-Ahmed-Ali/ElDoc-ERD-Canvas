#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createEldocServer } from "@mc/mcp-core/src/index.js";

async function main() {
  const server = createEldocServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ElDoc MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error running MCP server:", error);
  process.exit(1);
});
