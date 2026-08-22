use tauri::{Manager, Emitter, EventTarget};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_window_event(|window, event| {
            if window.label() == "overlay" {
                match event {
                    tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. } => {
                        let app_handle = window.app_handle();
                        if let Some(config_window) = app_handle.get_webview_window("configurator") {
                            if let (Ok(size), Ok(scale)) = (window.inner_size(), window.scale_factor()) {
                                // Point-to-point delivery directly targeting the configurator webview
                                let _ = config_window.emit_to(
                                    EventTarget::webview_window("configurator"),
                                    "overlay-metrics",
                                    (size.width, size.height, scale)
                                );
                            }
                        }
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
