# Contributing to ElDoc ERD Canvas

Thanks for your interest! ElDoc ERD Canvas is a free, open-source visual editor for data models in the **Open Knowledge Format (OKF)**. Bug reports, fixes, templates, and OKF-compatibility improvements are all welcome.

By contributing, you agree that your contributions are licensed under the project's [Apache License 2.0](LICENSE), and that you follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Project layout (pnpm monorepo)

- `packages/okf` — pure shared lib: `ModelGraph` ↔ OKF markdown bundle (parse/serialize). No I/O.
- `packages/mcp-core` — Core MCP Server logic for generating SQL.
- `packages/web` — React + Vite + React Flow SPA: the canvas, ERD view, inspector, OKF import/export, templates.
- `apps/vscode` — VS Code Extension wrapping the canvas.
- `apps/desktop` — Tauri Desktop wrapper for the canvas.
- `apps/mcp-cli` — Node.js CLI wrapper for the MCP Server.

## Local setup

```bash
pnpm install
pnpm dev:web                     # Vite dev server (SPA) on :5173
```

The canvas works fully anonymously entirely in your browser.

## Tests & checks

```bash
pnpm -r test     # okf + web (Vitest)
pnpm build       # builds okf + web + apps
```

Please make sure tests and the build pass before opening a PR. Add or update tests for behavior changes — the OKF parser/serializer in `packages/okf` is well covered, and new parsing rules should come with a fixture.

## Pull requests

- Branch from `main` and keep each PR focused on one change.
- `main` is protected — changes land via PR and review, not direct pushes.
- Use clear, conventional commit subjects, e.g. `feat(web): ...`, `fix(okf): ...`, `docs: ...`, `chore: ...`.
- Match the surrounding code's style and comment density.

## Working with OKF

The format the app reads and writes is documented at [`packages/web/public/okf-format.md`](packages/web/public/okf-format.md) (served live at `/okf-format.md`). If you're improving import compatibility (e.g. with Google's OKF v0.1 bundles), keep changes **additive** — don't change how the app exports its own bundles, and keep the export↔import round-trip stable.

## Reporting bugs & ideas

Open a GitHub issue with steps to reproduce (a shared model link or a small OKF snippet helps a lot). For **security vulnerabilities**, do **not** open a public issue — see [SECURITY.md](SECURITY.md).
