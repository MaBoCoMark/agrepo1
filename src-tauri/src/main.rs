// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod tray;

#[cfg(target_os = "windows")] use tauri::Manager; // Required for window lookups
use tauri::{Listener};

#[tauri::command]
fn set_overlay_click_through(app: tauri::AppHandle, ignore: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("overlay") {
            window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {   //to ignore issue
        let _ = app;
        let _ = ignore;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init()) 
        .setup(|app| {
            // Locate the overlay window
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("overlay") {
                    // 1. Force mouse clicks to pass completely through
                    let _ = window.set_ignore_cursor_events(true);
                    
                    // 2. Disable keyboard focus completely (Windows 10 passes keys through)
                    let _ = window.set_focusable(false);
                }
            }

            let app_handle = app.handle().clone();
            app.listen("toggle-overlay-click-through", move |event| {
                #[cfg(target_os = "windows")]
                {
                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                        if let Some(ignore) = payload.get("ignore").and_then(|v| v.as_bool()) {
                            if let Some(window) = app_handle.get_webview_window("overlay") {
                                let _ = window.set_ignore_cursor_events(ignore);
                            }
                        }
                    }
                }
                #[cfg(not(target_os = "windows"))]
                {   //to ignore issue
                    let _ = event;
                    let _ = app_handle;
                }
            });
            
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_overlay_click_through
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
