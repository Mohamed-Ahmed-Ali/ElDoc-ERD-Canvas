import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

class SidebarProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); display: flex; flex-direction: column; align-items: center; text-align: center; }
        button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; width: 100%; margin-top: 20px; font-weight: bold; }
        button:hover { background-color: var(--vscode-button-hoverBackground); }
        .logo { width: 80px; height: 80px; margin-bottom: 12px; border-radius: 12px; object-fit: contain; }
        h2 { font-size: 18px; margin: 0 0 10px 0; }
        p { font-size: 13px; opacity: 0.8; margin: 0; }
      </style>
    </head>
    <body>
      <img class="logo" src="${webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'eldoc-erd-canvas-icon.svg'))}" alt="ElDoc Logo">
      <h2>ElDoc ERD Canvas</h2>
      <p>Design your database models visually and generate SQL.</p>
      <button onclick="openCanvas()">Launch Canvas 🚀</button>
      <script>
        const vscode = acquireVsCodeApi();
        function openCanvas() {
          vscode.postMessage({ command: 'openCanvas' });
        }
      </script>
    </body>
    </html>`;

    webviewView.webview.onDidReceiveMessage(data => {
      if (data.command === 'openCanvas') {
        vscode.commands.executeCommand('eldoc.openCanvas');
      }
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("ElDoc ERD Canvas extension is now active!");

  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("eldoc.sidebarView", sidebarProvider)
  );

  let disposable = vscode.commands.registerCommand("eldoc.openCanvas", () => {
    const panel = vscode.window.createWebviewPanel(
      "eldocCanvas",
      "ElDoc ERD Canvas",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        // we pass an `extensionUri`-rooted `localResourceRoots` so the webview
        // can request built JS/CSS chunks that we place under `dist/webview/`
        // at package time (the webview no longer talks to a Vite dev server).
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")],
      },
    );

    panel.webview.html = getWebviewContent(context, panel);

    // handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "saveOkf":
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
              const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
              const okfPath = path.join(workspacePath, "model.okf");
              const uri = vscode.Uri.file(okfPath);
              await vscode.workspace.fs.writeFile(uri, Buffer.from(message.data, "utf8"));
              vscode.window.showInformationMessage("Saved model.okf to workspace!");
            } else {
              vscode.window.showErrorMessage("No open workspace found to save model.okf");
            }
            return;
          case "loadOkf":
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
              const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
              const okfPath = path.join(workspacePath, "model.okf");
              try {
                const uri = vscode.Uri.file(okfPath);
                const fileData = await vscode.workspace.fs.readFile(uri);
                const graphJson = Buffer.from(fileData).toString("utf8");
                panel.webview.postMessage({ command: "loadOkfResponse", data: graphJson });
              } catch (e) {
                // file doesn't exist yet, ignore
              }
            }
            return;
        }
      },
      undefined,
      context.subscriptions,
    );
  });

  context.subscriptions.push(disposable);
}

// dev-only override: when this env var is set, the webview iframes a local Vite
// server (matches the old `pnpm dev` workflow). In production builds the var is
// unset and the bundled `dist/webview/index.html` is used.
const DEV_WEBVIEW_URL = process.env.ELDOC_WEBVIEW_DEV_URL;

function getWebviewContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
  if (DEV_WEBVIEW_URL) {
    return wrapIframe(panel, DEV_WEBVIEW_URL);
  }
  const webviewRoot = vscode.Uri.joinPath(context.extensionUri, "dist", "webview");
  const indexPath = vscode.Uri.joinPath(webviewRoot, "index.html").fsPath;
  if (!fs.existsSync(indexPath)) {
    return missingBundleMessage(webviewRoot);
  }
  const html = fs.readFileSync(indexPath, "utf8");
  return rewriteAssetUrls(panel, html, webviewRoot);
}

// build an iframe-wrapped HTML shell that proxies messages between the
// react app (which posts `SAVE_OKF` / `LOAD_OKF` to its `window.parent`) and the
// extension host (which listens for `saveOkf` / `loadOkf` commands).
function wrapIframe(panel: vscode.WebviewPanel, src: string) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ElDoc ERD Canvas</title>
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        iframe { width: 100%; height: 100%; border: none; }
      </style>
  </head>
  <body>
      <iframe id="canvasFrame" src="${src}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads"></iframe>
      <script>
        const vscode = acquireVsCodeApi();
        window.addEventListener('message', event => {
          if (event.data?.type === 'SAVE_OKF') {
            vscode.postMessage({ command: 'saveOkf', data: event.data.payload });
          }
          if (event.data?.type === 'LOAD_OKF') {
            vscode.postMessage({ command: 'loadOkf' });
          }
        });
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'loadOkfResponse') {
            const iframe = document.getElementById('canvasFrame');
            iframe.contentWindow.postMessage({ type: 'LOAD_OKF_RESPONSE', payload: message.data }, '*');
          }
        });
      </script>
  </body>
  </html>`;
}

function missingBundleMessage(webviewRoot: vscode.Uri) {
  return `<!DOCTYPE html>
  <html lang="en"><head><meta charset="UTF-8"><title>ElDoc</title>
  <style>body{font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;padding:24px;color:#b91c1c}</style>
  </head><body>
    <h2>Webview bundle is missing</h2>
    <p>The extension expected a built React app at:</p>
    <code>${webviewRoot.fsPath}</code>
    <p>Build it with:</p>
    <pre>pnpm --filter @mc/web build
# then copy the dist into the extension
mkdir -p apps/vscode/dist/webview
cp -r packages/web/dist/* apps/vscode/dist/webview/</pre>
  </body></html>`;
}

// the Vite build emits relative asset paths (`./assets/index-…js`, etc.). We
// rewrite them to `webview.asWebviewUri(...)` so the webview can fetch the
// chunks under its own resource root without violating CSP.
function rewriteAssetUrls(panel: vscode.WebviewPanel, html: string, webviewRoot: vscode.Uri) {
  const toUri = (rel: string) =>
    panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, rel)).toString();
  let rewritten = html
    .replace(
      /(href|src)=("\.\/(assets\/[^"]+)"|'\.\/(assets\/[^']+)')/g,
      (_m, attr, q1, p1, q2, p2) => {
        const quote = q1 || q2;
        const path = p1 || p2;
        return `${attr}=${quote}${toUri(path)}${quote}`;
      },
    )
    // vite also emits `<link rel="stylesheet" href="/assets/...">` with a leading
    // slash in some configs — handle that too.
    .replace(/(href|src)="\/((?:assets|favicon)[^"]*)"/g, (_m, attr, p) => `${attr}="${toUri(p)}"`)
    // VS Code webviews don't support crossorigin on local resources, which Vite adds by default
    .replace(/ crossorigin/g, "");

  // Inject the VS Code API bridge so production React app can communicate with extension host
  const bridgeScript = `
    <script>
      const vscode = acquireVsCodeApi();
      window.addEventListener('message', event => {
        if (event.data?.type === 'SAVE_OKF') {
          vscode.postMessage({ command: 'saveOkf', data: event.data.payload });
        }
        if (event.data?.type === 'LOAD_OKF') {
          vscode.postMessage({ command: 'loadOkf' });
        }
      });
      window.addEventListener('message', event => {
        const message = event.data;
        if (message && message.command === 'loadOkfResponse') {
          window.postMessage({ type: 'LOAD_OKF_RESPONSE', payload: message.data }, '*');
        }
      });
    </script>
  `;
  rewritten = rewritten.replace('</body>', `${bridgeScript}</body>`);
  return rewritten;
}

export function deactivate() {}
