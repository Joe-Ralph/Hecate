mod keyring;

use tauri::{Manager, Emitter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            keyring::store_secret,
            keyring::get_secret,
            keyring::delete_secret
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                // Register global quick-capture shortcut Ctrl/Cmd+Shift+Space
                // On invocation, shows the quick-capture window
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running hecate desktop application");
}
