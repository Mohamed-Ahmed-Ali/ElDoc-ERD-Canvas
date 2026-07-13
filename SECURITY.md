# Security Policy

## Reporting a vulnerability

Please report security issues **privately** by opening a private security advisory on GitHub or emailing the repository maintainers directly.

- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- the affected component (`packages/okf`, `packages/web`, `packages/mcp-core`, `apps/vscode`, etc).

## Supported versions

This is an actively developed project; security fixes target the latest `main`. There are no long-term support branches.

## Security model (context for reporters)

The ElDoc ERD Canvas is a **100% strictly local** application. 
- It uses no backend server.
- The `packages/web` is a Static Single Page Application (SPA).
- The `packages/mcp-core` and CLI tools run locally and communicate via stdio.
- No data is sent to external servers.
