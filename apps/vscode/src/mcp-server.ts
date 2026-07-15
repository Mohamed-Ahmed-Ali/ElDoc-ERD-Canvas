import { createEldocServer } from "@mc/mcp-core";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function run() {
  const server = createEldocServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((error) => {
  console.error("MCP Server Error:", error);
  process.exit(1);
});
