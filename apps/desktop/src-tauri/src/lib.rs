use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Spawn the bundled MCP CLI sidecar. The binary lives at `bin/eldoc-mcp`
      // in the source tree and Tauri resolves the per-platform suffix at build
      // time (e.g. `eldoc-mcp-x86_64-pc-windows-msvc.exe` on Windows). In dev
      // (`tauri dev`) the binary is not yet bundled, so we look for the
      // workspace build output at `apps/mcp-cli/dist/index.cjs` and fall back to
      // a no-op spawn with a clear log line. The two helper commands
      // `start_mcp_server` and `stop_mcp_server` are exposed to the webview
      // so the in-app "Connect to AI" button can manage its lifecycle.
      let handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        match handle.shell().sidecar("bin/eldoc-mcp") {
          Ok(cmd) => {
            match cmd.spawn() {
              Ok((mut rx, _child)) => {
                while let Some(event) = rx.recv().await {
                  match event {
                    CommandEvent::Stdout(line) => log::info!("[mcp] {}", String::from_utf8_lossy(&line)),
                    CommandEvent::Stderr(line) => log::warn!("[mcp] {}", String::from_utf8_lossy(&line)),
                    CommandEvent::Error(e) => log::error!("[mcp] {}", e),
                    CommandEvent::Terminated(p) => {
                      log::info!("[mcp] terminated with status {:?}", p.code);
                      break;
                    }
                    _ => {}
                  }
                }
              }
              Err(e) => log::warn!("Failed to spawn MCP sidecar: {e}. If in dev, this is expected if the binary is missing."),
            }
          }
          Err(e) => log::warn!(
            "MCP sidecar not bundled yet ({e}); run `pnpm --filter @mc/mcp-cli build` \
             and place the binary in apps/desktop/src-tauri/bin/ before `tauri build`."
          ),
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
