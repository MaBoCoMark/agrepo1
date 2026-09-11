use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, EventTarget, Manager, Runtime, WebviewUrl, WebviewWindowBuilder,
    Listener
};

pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let show_config = MenuItemBuilder::with_id("show_config", "Open Configurator").build(app)?;
    
    let system_time_item = CheckMenuItemBuilder::with_id("system_time", "System Time")
        .checked(crate::hotkey::SYSTEM_TIME_VISIBLE.load(std::sync::atomic::Ordering::SeqCst))
        .build(app)?;

    #[cfg(target_os = "windows")]
    let hotkey_item = CheckMenuItemBuilder::with_id("hotkey_toggle", "Full Screen Hotkey: Initializing...")
        .checked(false)
        .build(app)?;

    #[cfg(not(target_os = "windows"))]
    let no_hotkey_item = MenuItemBuilder::with_id("no_hotkey", "No Hotkey on MAC")
        .enabled(false)
        .build(app)?;

    let quit = MenuItemBuilder::with_id("quit", "Exit").build(app)?;

    #[cfg(debug_assertions)]
    let open_devtools = MenuItemBuilder::with_id("open_devtools", "Open Overlay DevTools").build(app)?;

    #[cfg(all(debug_assertions, target_os = "windows"))]
    let menu = MenuBuilder::new(app)
        .items(&[&show_config, &system_time_item, &hotkey_item, &open_devtools, &quit])
        .build()?;

    #[cfg(all(debug_assertions, not(target_os = "windows")))]
    let menu = MenuBuilder::new(app)
        .items(&[&show_config, &system_time_item, &no_hotkey_item, &open_devtools, &quit])
        .build()?;

    #[cfg(all(not(debug_assertions), target_os = "windows"))]
    let menu = MenuBuilder::new(app)
        .items(&[&show_config, &system_time_item, &hotkey_item, &quit])
        .build()?;

    #[cfg(all(not(debug_assertions), not(target_os = "windows")))]
    let menu = MenuBuilder::new(app)
        .items(&[&show_config, &system_time_item, &no_hotkey_item, &quit])
        .build()?;

    #[cfg(target_os = "windows")]
    {
        let hotkey_clone = hotkey_item.clone();
        app.listen("internal-update-hotkey-tray", move |event| {
            if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                if let Some(text) = payload.get("text").and_then(|v| v.as_str()) {
                    let _ = hotkey_clone.set_text(text);
                }
                if let Some(checked) = payload.get("checked").and_then(|v| v.as_bool()) {
                    let _ = hotkey_clone.set_checked(checked);
                }
                if let Some(enabled) = payload.get("enabled").and_then(|v| v.as_bool()) {
                    let _ = hotkey_clone.set_enabled(enabled);
                }
            }
        });
    }

    let system_time_clone = system_time_item.clone();
    app.listen("internal-set-system-time-visible", move |event| {
        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            if let Some(visible) = payload.get("visible").and_then(|v| v.as_bool()) {
                let _ = system_time_clone.set_checked(visible);
            }
        }
    });

    let system_time_for_event = system_time_item.clone();
    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show_config" => {
                open_configurator_window(app);
            }
            "system_time" => {
                // Ensure tray checkbox reflects actual state and does not flip on opening
                let current_visible = crate::hotkey::SYSTEM_TIME_VISIBLE.load(std::sync::atomic::Ordering::SeqCst);
                let _ = system_time_for_event.set_checked(current_visible);
                open_system_time_configurator_window(app);
            }
            "hotkey_toggle" => {
                #[cfg(target_os = "windows")]
                {
                    crate::hotkey::toggle_hotkey_from_tray(app);
                }
            }
            #[cfg(debug_assertions)]
            "open_devtools" => {
                if let Some(window) = app.get_webview_window("overlay") {
                    let _ = window.open_devtools();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn open_configurator_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    #[cfg(target_os = "windows")]
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.set_decorations(false);
    }
    if let Some(window) = app.get_webview_window("configurator") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = window.emit_to(
            EventTarget::webview_window("configurator"),
            "configurator-shown",
            (),
        );
    } else {
        let overlay = app.get_webview_window("overlay");
        
        let mut builder = WebviewWindowBuilder::new(
            app, 
            "configurator", 
            WebviewUrl::App("configurator.html".into())
        )
        .title("Configurator")
        .inner_size(400.0, 600.0)
        .always_on_top(true);

        if let Some(ref ov) = overlay {
            builder = builder.parent(ov).expect("Failed to set parent");
        }

        if let Ok(config_window) = builder.build() {
            if let Some(ov) = app.get_webview_window("overlay") {
                if let (Ok(size), Ok(scale)) = (ov.inner_size(), ov.scale_factor()) {
                    let config_clone = config_window.clone();
                    tauri::async_runtime::spawn(async move {
                        std::thread::sleep(std::time::Duration::from_millis(150));
                        let _ = config_clone.emit_to(
                            EventTarget::webview_window("configurator"),
                            "overlay-metrics",
                            (size.width, size.height, scale),
                        );
                    });
                }
            }
        }
    }
}

fn open_system_time_configurator_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    #[cfg(target_os = "windows")]
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.set_decorations(false);
    }
    if let Some(window) = app.get_webview_window("system_time_configurator") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    } else {
        let overlay = app.get_webview_window("overlay");
        
        let mut builder = WebviewWindowBuilder::new(
            app, 
            "system_time_configurator", 
            WebviewUrl::App("time-configurator.html".into())
        )
        .title("System Time Configurator")
        .inner_size(380.0, 640.0)
        .min_inner_size(320.0, 480.0)
        .resizable(true)
        .always_on_top(true);

        if let Some(ref ov) = overlay {
            builder = builder.parent(ov).expect("Failed to set parent");
        }

        let _ = builder.build();
    }
}
