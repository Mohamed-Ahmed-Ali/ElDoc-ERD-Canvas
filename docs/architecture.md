# 🌌 Universal Monorepo Architecture

To accomplish your "Holy Grail" vision of **Write Once, Compile Everywhere**, we have split the architecture into a core logic package and multiple distribution wrappers. This solves the HTTP timeout, huge payload, and enterprise security problems you mentioned regarding Vercel.

## The Core Package (`packages/mcp-core`)
This contains **100% of the MCP logic**, tools (`generate_sql`), prompts, and resources. 
- It has **no dependencies** on HTTP, WebSockets, stdio, or specific Node.js APIs.
- It exposes a clean `createEldocServer()` function.

## The 4 Distribution Targets

### 1. The Desktop Approach: Tauri Standalone `.exe`
**How it works:**
The Tauri App is the native Windows/macOS wrapper around the React canvas. But inside it, we bundle the `mcp-cli` compiled as a raw `.exe` (which we just built using Bun!). 
- **Security:** Fully local. No enterprise data leaves the machine. No HTTP latency.
- **How to connect:** The user points Claude Desktop's config file (`claude_desktop_config.json`) to `C:\Program Files\ElDoc\mcp-cli-win.exe`.
- **Status:** **In Progress (Compiling Now!)**

### 2. The Cloud Approach: Vercel SSE Server (`apps/mcp-cloud`)
**How it works:**
A Next.js/Express app that imports `@mc/mcp-core` and binds it to `@modelcontextprotocol/sdk/server/sse.js`.
- **The Timeout Problem:** Vercel drops connections after 10s. If we must use the cloud, we deploy it to a long-running platform (Render/Railway), OR use a Vercel Edge Function with `responseLimit: false`. 
- **The Huge Payload Problem:** Instead of sending the full `.okf` JSON file back and forth, the user's graph is saved in a Cloud Database (like Supabase). The MCP Server reads the graph directly from the DB using a short `projectId` token.
- **Status:** **Pending (Phase 2)**

### 3. The IDE Approach: VS Code Extension
**How it works:**
A VS Code extension (`apps/vscode`) that runs inside the editor. It imports `@mc/mcp-core` directly into the extension's runtime context.
- VS Code acts as the MCP Client.
- The extension watches the active `.okf` file in the user's workspace. As the user edits the model, the extension automatically feeds the changes into the MCP Server context. GitHub Copilot or Claude Code can interact with it instantly.
- **Status:** **Pending (Phase 4)**

### 4. The Open Source / Developer Approach: CLI
**How it works:**
Developers run `npx eldoc-mcp` or download the binary from GitHub Releases.
- It imports `@mc/mcp-core` and binds it to `stdio`.
- **Status:** **Completed (Phase 1)**

By isolating the logic in `mcp-core`, we only have to write a tool once, and it instantly works across all 4 platforms!
