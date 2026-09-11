// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod hotkey;
mod tray;

use tauri::{Emitter, EventTarget, Listener, Manager};

#[tauri::command]
fn set_overlay_click_through(app: tauri::AppHandle, ignore: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("overlay") {
            window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())?;
            let _ = window.set_decorations(false);
        }
    }
    #[cfg(not(target_os = "windows"))]
    {   //to ignore issue
        let _ = app;
        let _ = ignore;
    }
    Ok(())
}

#[tauri::command]
fn ensure_overlay_decorations(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.set_decorations(false);
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::Focused(_) => {
                    #[cfg(target_os = "windows")]
                    {
                        let app_handle = window.app_handle();
                        if let Some(overlay) = app_handle.get_webview_window("overlay") {
                            let _ = overlay.set_decorations(false);
                        }
                    }
                }
                tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. } => {
                    if window.label() == "overlay" {
                        let app_handle = window.app_handle();
                        if let Some(config_window) = app_handle.get_webview_window("configurator") {
                            if let (Ok(size), Ok(scale)) = (window.inner_size(), window.scale_factor()) {
                                let _ = config_window.emit_to(
                                    EventTarget::webview_window("configurator"),
                                    "overlay-metrics",
                                    (size.width, size.height, scale),
                                );
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .setup(|app| {
            // Locate the overlay window
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("overlay") {
                    // 1. Force mouse clicks to pass completely through
                    let _ = window.set_ignore_cursor_events(true);
                    
                    // 2. Disable keyboard focus completely (Windows 10 passes keys through)
                    let _ = window.set_focusable(false);

                    // 3. Ensure decorations are false
                    let _ = window.set_decorations(false);
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
                                let _ = window.set_decorations(false);
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

            #[cfg(target_os = "windows")]
            {
                hotkey::init_hotkey(app.handle().clone());
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_overlay_click_through,
            ensure_overlay_decorations,
            hotkey::get_hotkey_status,
            hotkey::toggle_fullscreen,
            hotkey::set_system_time_visible,
            hotkey::get_system_time_visible,
            hotkey::get_system_time_config,
            hotkey::save_system_time_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
