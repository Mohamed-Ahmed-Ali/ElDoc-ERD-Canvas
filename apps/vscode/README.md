# ElDoc ERD Canvas (VS Code Extension)

This extension brings the ElDoc ERD Canvas directly into your VS Code editor. It allows you to visually design data models and instantly use AI agents to generate SQL or documentation.

## How it Works

1. **The Canvas**: Run `ElDoc: Open Canvas` from the command palette. This opens a Webview panel running the full React ERD Canvas.
2. **Workspace Sync**: When you make changes in the canvas, the extension automatically saves a `model.okf` (or `model.json`) file into the root of your active VS Code workspace.
3. **AI Integration**: The true power of this extension is integrating it with your favorite AI tools (like GitHub Copilot Chat, Claude Code, Cline, or Roo Code).

## Configuring AI Agents (MCP)

ElDoc ships with an MCP (Model Context Protocol) server. By pointing your AI agent to the ElDoc MCP server, the agent can instantly read the `model.okf` file in your workspace and understand your data models to write perfect SQL.

### If using Cline / Roo Code / Roo Cline (VS Code Extensions)
Create a `mcp.json` file in your workspace or global settings:

```json
{
  "mcpServers": {
    "eldoc": {
      "command": "npx",
      "args": ["eldoc-mcp"]
    }
  }
}
```

### If using Claude Desktop
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "eldoc": {
      "command": "npx",
      "args": ["eldoc-mcp"]
    }
  }
}
```

Now, just ask your AI: "Write a dbt model to calculate monthly recurring revenue based on my data model", and the AI will use the MCP server to inspect the Canvas you just drew!
