# ElDoc ERD Canvas: Comprehensive Feature List

The ElDoc ERD Canvas is an enterprise-grade, local-first Entity Relationship Diagram (ERD) and data modeling tool. It is engineered from the ground up to be fully compatible with modern AI assistants (via the Model Context Protocol) while maintaining absolute data sovereignty.

Below is an exhaustive breakdown of the features and capabilities.

## 1. AI-Native Architecture (Model Context Protocol)
- **Built-in MCP Server**: The `mcp-core` package natively implements an MCP server over standard input/output (stdio), allowing seamless integration with Claude, Cursor, Copilot, and other MCP-aware agents.
- **Context Injection**: AI agents can read the current state of your canvas, understand the layout of your databases, and instantly generate context-aware SQL queries or new tables based on plain English prompts.
- **No Cloud Required**: The MCP logic is bundled directly into the local application. Your database schemas are never sent to a third-party server or Vercel backend.
- **AI Authoring Guides**: The application includes built-in guides (`okf-format.md`) that users can copy to instruct LLMs on how to perfectly format schema data for import.

## 2. Multi-Platform Distribution
The underlying data-modeling engine (`okf`) and user interface (`web`) are abstracted so they can be compiled to four distinct environments:
- **Global Web Application**: A fully static, zero-cost Single Page Application (SPA). Because there is no backend, it can be hosted for free on GitHub Pages, Vercel, or Netlify, processing all logic entirely in the user's browser.
- **Native Desktop Application**: Built with Tauri and Rust, providing an air-gapped, highly performant `.exe` / `.app` that can be distributed to enterprise teams with strict security requirements.
- **VS Code Extension (IDE View)**: An integrated Webview panel for Visual Studio Code. It watches local `.okf` files and updates the canvas in real-time, placing the ERD directly next to your code.
- **CLI Tool**: A terminal interface (`npx eldoc-mcp`) allowing headless operations and direct MCP binding for developers setting up custom automation.

## 3. Interactive Data Modeling Canvas
- **React Flow Engine**: A hardware-accelerated, buttery-smooth drag-and-drop canvas supporting infinite panning and semantic zooming.
- **Visual Cardinality**: Draw relationships between tables and explicitly define them as `1:1`, `1:N`, or `N:M` (many-to-many). The canvas visually represents these connections with distinct edge styling.
- **Real-Time Minimap**: A corner minimap helps you navigate massive schemas with hundreds of tables.
- **Auto-Layout & Snapping**: Intelligent node positioning helps maintain clean diagrams even as schemas grow in complexity.
- **Clear Canvas Utility**: Safely wipe the canvas with a single click (prompting a confirmation dialogue to prevent accidental data loss).

## 4. Deep Object Inspector & Semantic Definitions
Clicking on any node opens a powerful right-hand Inspector Panel:
- **Table Metadata**: Define the Table Name, Namespace (e.g., `analytics.users`), and a descriptive summary.
- **Node Types**: Classify tables visually into logical types: `logical` (blue), `physical` (purple), `mart` (green), `source` (orange), or `bridge` (grey).
- **Column Management**: Add, reorder, and edit columns directly from the inspector.
- **Physical vs. Logical Typing**: Assign both a logical concept (e.g., "Email Address") and a physical data type (e.g., `VARCHAR(255)` or `INT64`).
- **Measure vs. Dimension**: Flag specific columns as quantitative measures (Sum, Count, Average) or qualitative dimensions for BI reporting.

## 5. Advanced SQL Generator
The engine instantly compiles visual nodes into production-ready SQL DDL statements (`CREATE TABLE`):
- **Namespaces / Schemas**: Automatically prefixes tables (e.g., `CREATE TABLE public.users`).
- **Primary & Foreign Keys**: Maps visual connections directly to explicit `FOREIGN KEY (id) REFERENCES...` statements.
- **Nullable / Not Null**: Toggle strict nullability constraints on any field.
- **Default Values**: Hardcode default initializations like `DEFAULT CURRENT_DATE`.
- **Unique Constraints**: Easily enforce `UNIQUE` bounds on critical fields like email addresses.
- **Check Expressions**: Write raw SQL check rules (e.g., `CHECK (age > 18)`).
- **Inline Documentation**: Field descriptions are generated as inline SQL comments (`-- User's email`).

## 6. Intelligent SQL Importer & Parser
Paste raw SQL scripts directly into the app to instantly visualize an existing database:
- **Forgiving Mode (Default)**: The parser uses a "best-effort" algorithm to extract table definitions. It gracefully bypasses unknown syntax from niche SQL dialects.
- **Warning Telemetry**: When non-standard tokens are bypassed in Forgiving Mode, the UI generates an explicit checklist of warnings, showing exactly which Line and Column were ignored.
- **Strict Mode**: A UI toggle that enforces strict syntax checking. If an unknown token is encountered, the import halts entirely, guaranteeing perfect dialect preservation.
- **Markdown & Codeblock Extraction**: The importer automatically strips out markdown (` ```sql `) wrappers, meaning you can paste a direct response from ChatGPT without having to format it first.

## 7. Export & Persistence
- **JSON Serialization**: The canvas state is serialized into a lightweight JSON tree.
- **Clipboard Sync**: Instantly copy your entire schema as raw SQL, or as the standard `.okf` JSON format.
- **Merge vs. Replace**: When importing new data, you have the granular choice to either completely replace your current canvas, or merge the new tables into your existing layout.

## 8. Enterprise Accessibility (a11y)
- **Screen Reader Support**: Core UI elements are wrapped in semantic HTML with explicit `aria-labels`, `role="button"`, and `role="application"` tags.
- **Keyboard Navigation**: Important panels, dialogues, and nodes are assigned `tabIndex` attributes, allowing users to navigate the tool without a mouse.

## 9. Modern Developer Experience
- **Monorepo Architecture**: Managed via `pnpm` workspaces for extreme modularity.
- **Lightning Fast Builds**: Uses Vite and esbuild for sub-second hot-module reloading.
- **Strict Linting**: Configured with Biome for instantaneous formatting and linting (replacing slower tools like Prettier and ESLint).
- **Testing Suite**: Comprehensive unit testing powered by Vitest, covering serialization, slugification, and SQL integration.
