use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, EventTarget, Manager, Runtime, WebviewUrl, WebviewWindowBuilder,
};

pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let show_config = MenuItemBuilder::with_id("show_config", "Open Configurator").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Exit").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show_config, &quit]).build()?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_config" => {
                if let Some(window) = app.get_webview_window("configurator") {
                    let _ = window.set_focus();
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
                                    // Use explicit target naming to pierce child window limits
                                    let _ = config_clone.emit_to(
                                        EventTarget::webview_window("configurator"), 
                                        "overlay-metrics", 
                                        (size.width, size.height, scale)
                                    );
                                });
                            }
                        }
                    }
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}
