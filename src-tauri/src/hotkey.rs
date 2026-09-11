use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, Manager, Runtime};
use serde::{Deserialize, Serialize};

pub static IS_FULLSCREEN: AtomicBool = AtomicBool::new(false);
pub static CURRENT_BOUND_KEY: Mutex<Option<String>> = Mutex::new(None);
pub static HOTKEY_SUCCESS: AtomicBool = AtomicBool::new(false);
pub static SYSTEM_TIME_VISIBLE: AtomicBool = AtomicBool::new(true);

fn default_stroke_size_vw() -> f32 { 0.08 }
fn default_stroke_size_px() -> f32 { 1.5 }
fn default_padding_x_vw() -> f32 { 0.4 }
fn default_padding_y_vw() -> f32 { 0.2 }
fn default_offset_top_vw() -> f32 { 0.8 }
fn default_offset_right_vw() -> f32 { 1.0 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemTimeConfig {
    pub visible: bool,
    pub font_size_vw: f32,
    pub text_color: String,
    pub text_opacity: u32,
    pub stroke_color: String,
    pub stroke_opacity: u32,
    #[serde(default = "default_stroke_size_vw")]
    pub stroke_size_vw: f32,
    #[serde(default = "default_stroke_size_px")]
    pub stroke_size_px: f32,
    pub background_color: String,
    pub background_opacity: u32,
    pub border_radius_percent: u32,
    pub global_opacity: u32,
    #[serde(default = "default_padding_x_vw")]
    pub padding_x_vw: f32,
    #[serde(default = "default_padding_y_vw")]
    pub padding_y_vw: f32,
    #[serde(default = "default_offset_top_vw")]
    pub offset_top_vw: f32,
    #[serde(default = "default_offset_right_vw")]
    pub offset_right_vw: f32,
}

impl Default for SystemTimeConfig {
    fn default() -> Self {
        Self {
            visible: true,
            font_size_vw: 1.2,
            text_color: "#ffffff".to_string(),
            text_opacity: 100,
            stroke_color: "#000000".to_string(),
            stroke_opacity: 100,
            stroke_size_vw: 0.08,
            stroke_size_px: 1.5,
            background_color: "#000000".to_string(),
            background_opacity: 40,
            border_radius_percent: 20,
            global_opacity: 100,
            padding_x_vw: 0.4,
            padding_y_vw: 0.2,
            offset_top_vw: 0.8,
            offset_right_vw: 1.0,
        }
    }
}

pub static SYSTEM_TIME_CONFIG: Mutex<Option<SystemTimeConfig>> = Mutex::new(None);

#[cfg(target_os = "windows")]
static HOTKEY_THREAD_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

#[cfg(target_os = "windows")]
pub const WM_CMD_UNBIND: u32 = 0x0400 + 10;
#[cfg(target_os = "windows")]
pub const WM_CMD_REBIND: u32 = 0x0400 + 11;
#[cfg(target_os = "windows")]
pub const WM_CMD_TOGGLE_FS: u32 = 0x0400 + 12;

#[derive(Clone, Copy)]
pub struct HotkeyCandidate {
    pub name: &'static str,
    pub modifiers: u32,
    pub vk: u32,
}

pub const CANDIDATES: &[HotkeyCandidate] = &[
    HotkeyCandidate { name: "F12", modifiers: 0, vk: 0x7B },
    HotkeyCandidate { name: "F11", modifiers: 0, vk: 0x7A },
    // F10 is explicitly skipped per user requirements!
    HotkeyCandidate { name: "F9",  modifiers: 0, vk: 0x78 },
    HotkeyCandidate { name: "F8",  modifiers: 0, vk: 0x77 },
    HotkeyCandidate { name: "F7",  modifiers: 0, vk: 0x76 },
    HotkeyCandidate { name: "F6",  modifiers: 0, vk: 0x75 },
    HotkeyCandidate { name: "F5",  modifiers: 0, vk: 0x74 },
    HotkeyCandidate { name: "F4",  modifiers: 0, vk: 0x73 },
    HotkeyCandidate { name: "F3",  modifiers: 0, vk: 0x72 },
    HotkeyCandidate { name: "F2",  modifiers: 0, vk: 0x71 },
    HotkeyCandidate { name: "F1",  modifiers: 0, vk: 0x70 },
    HotkeyCandidate { name: "Control + F12", modifiers: 0x0002, vk: 0x7B }, // MOD_CONTROL
];

#[cfg(target_os = "windows")]
mod ffi {
    use std::ffi::c_void;

    pub type HWND = *mut c_void;
    pub type BOOL = i32;
    pub type UINT = u32;
    pub type WPARAM = usize;
    pub type LPARAM = isize;

    #[repr(C)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }

    #[repr(C)]
    pub struct MSG {
        pub hwnd: HWND,
        pub message: UINT,
        pub wParam: WPARAM,
        pub lParam: LPARAM,
        pub time: u32,
        pub pt: POINT,
    }

    pub const WM_HOTKEY: UINT = 0x0312;
    pub const WM_USER: UINT = 0x0400;
    pub const PM_NOREMOVE: UINT = 0x0000;
    pub const MOD_NOREPEAT: UINT = 0x4000;

    #[link(name = "user32")]
    extern "system" {
        pub fn RegisterHotKey(hWnd: HWND, id: i32, fsModifiers: UINT, vk: UINT) -> BOOL;
        pub fn UnregisterHotKey(hWnd: HWND, id: i32) -> BOOL;
        pub fn GetMessageW(lpMsg: *mut MSG, hWnd: HWND, wMsgFilterMin: UINT, wMsgFilterMax: UINT) -> BOOL;
        pub fn PeekMessageW(lpMsg: *mut MSG, hWnd: HWND, wMsgFilterMin: UINT, wMsgFilterMax: UINT, wRemoveMsg: UINT) -> BOOL;
        pub fn PostThreadMessageW(idThread: u32, Msg: UINT, wParam: WPARAM, lParam: LPARAM) -> BOOL;
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn GetCurrentThreadId() -> u32;
    }
}

#[cfg(target_os = "windows")]
pub fn post_thread_command(cmd: u32) {
    let tid = HOTKEY_THREAD_ID.load(Ordering::SeqCst);
    if tid != 0 {
        unsafe {
            ffi::PostThreadMessageW(tid, cmd, 0, 0);
        }
    }
}

#[cfg(target_os = "windows")]
unsafe fn try_register(candidate: &HotkeyCandidate) -> bool {
    let _ = ffi::UnregisterHotKey(std::ptr::null_mut(), 0x4242);
    let res = ffi::RegisterHotKey(
        std::ptr::null_mut(),
        0x4242,
        candidate.modifiers | ffi::MOD_NOREPEAT,
        candidate.vk,
    );
    if res != 0 {
        return true;
    }
    let res2 = ffi::RegisterHotKey(
        std::ptr::null_mut(),
        0x4242,
        candidate.modifiers,
        candidate.vk,
    );
    res2 != 0
}

#[cfg(target_os = "windows")]
pub fn init_hotkey<R: Runtime>(app: tauri::AppHandle<R>) {
    std::thread::spawn(move || {
        unsafe {
            let mut msg: ffi::MSG = std::mem::zeroed();
            ffi::PeekMessageW(&mut msg, std::ptr::null_mut(), ffi::WM_USER, ffi::WM_USER, ffi::PM_NOREMOVE);
            let tid = ffi::GetCurrentThreadId();
            HOTKEY_THREAD_ID.store(tid, Ordering::SeqCst);

            let mut bound_candidate: Option<HotkeyCandidate> = None;
            for candidate in CANDIDATES {
                if try_register(candidate) {
                    bound_candidate = Some(*candidate);
                    break;
                }
            }

            if let Some(cand) = bound_candidate {
                HOTKEY_SUCCESS.store(true, Ordering::SeqCst);
                *CURRENT_BOUND_KEY.lock().unwrap() = Some(cand.name.to_string());

                let _ = app.emit("internal-update-hotkey-tray", serde_json::json!({
                    "text": format!("Full Screen Hotkey: {}", cand.name),
                    "checked": true,
                    "enabled": true
                }));

                let is_f12 = cand.name == "F12";
                if is_f12 {
                    if let Some(overlay) = app.get_webview_window("overlay") {
                        let _ = overlay.unmaximize();
                        let _ = overlay.set_decorations(false);
                        let _ = overlay.set_fullscreen(true);
                    }
                    IS_FULLSCREEN.store(true, Ordering::SeqCst);
                } else {
                    IS_FULLSCREEN.store(false, Ordering::SeqCst);
                }

                let _ = app.emit("hotkey-status", serde_json::json!({
                    "success": true,
                    "key": cand.name,
                    "is_fullscreen": is_f12
                }));
            } else {
                HOTKEY_SUCCESS.store(false, Ordering::SeqCst);
                *CURRENT_BOUND_KEY.lock().unwrap() = None;
                IS_FULLSCREEN.store(false, Ordering::SeqCst);

                let _ = app.emit("internal-update-hotkey-tray", serde_json::json!({
                    "text": "Full Screen Hotkey: None",
                    "checked": false,
                    "enabled": false
                }));

                let _ = app.emit("hotkey-status", serde_json::json!({
                    "success": false,
                    "key": serde_json::Value::Null,
                    "is_fullscreen": false
                }));
            }

            while ffi::GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                if msg.message == ffi::WM_HOTKEY && msg.wParam == 0x4242 {
                    toggle_fullscreen_impl(&app, &bound_candidate);
                } else if msg.message == WM_CMD_UNBIND {
                    if bound_candidate.is_some() {
                        ffi::UnregisterHotKey(std::ptr::null_mut(), 0x4242);
                        bound_candidate = None;
                        HOTKEY_SUCCESS.store(false, Ordering::SeqCst);
                        *CURRENT_BOUND_KEY.lock().unwrap() = None;

                        if IS_FULLSCREEN.load(Ordering::SeqCst) {
                            if let Some(overlay) = app.get_webview_window("overlay") {
                                let _ = overlay.set_fullscreen(false);
                                let _ = overlay.set_decorations(false);
                                let _ = overlay.maximize();
                            }
                            IS_FULLSCREEN.store(false, Ordering::SeqCst);
                            let _ = app.emit("fullscreen-changed", serde_json::json!({
                                "is_fullscreen": false,
                                "hotkey": serde_json::Value::Null
                            }));
                        }

                        let _ = app.emit("internal-update-hotkey-tray", serde_json::json!({
                            "checked": false
                        }));
                        let _ = app.emit("hotkey-status", serde_json::json!({
                            "success": false,
                            "key": serde_json::Value::Null,
                            "is_fullscreen": false
                        }));
                    }
                } else if msg.message == WM_CMD_REBIND {
                    ffi::UnregisterHotKey(std::ptr::null_mut(), 0x4242);
                    bound_candidate = None;
                    for candidate in CANDIDATES {
                        if try_register(candidate) {
                            bound_candidate = Some(*candidate);
                            break;
                        }
                    }

                    if let Some(cand) = bound_candidate {
                        HOTKEY_SUCCESS.store(true, Ordering::SeqCst);
                        *CURRENT_BOUND_KEY.lock().unwrap() = Some(cand.name.to_string());
                        let _ = app.emit("internal-update-hotkey-tray", serde_json::json!({
                            "text": format!("Full Screen Hotkey: {}", cand.name),
                            "checked": true,
                            "enabled": true
                        }));
                        let _ = app.emit("hotkey-status", serde_json::json!({
                            "success": true,
                            "key": cand.name,
                            "is_fullscreen": IS_FULLSCREEN.load(Ordering::SeqCst)
                        }));
                    } else {
                        HOTKEY_SUCCESS.store(false, Ordering::SeqCst);
                        *CURRENT_BOUND_KEY.lock().unwrap() = None;
                        let _ = app.emit("internal-update-hotkey-tray", serde_json::json!({
                            "text": "Full Screen Hotkey: None",
                            "checked": false,
                            "enabled": false
                        }));
                        let _ = app.emit("hotkey-status", serde_json::json!({
                            "success": false,
                            "key": serde_json::Value::Null,
                            "is_fullscreen": false
                        }));
                    }
                } else if msg.message == WM_CMD_TOGGLE_FS {
                    toggle_fullscreen_impl(&app, &bound_candidate);
                }
            }
        }
    });
}

#[cfg(target_os = "windows")]
fn toggle_fullscreen_impl<R: Runtime>(app: &tauri::AppHandle<R>, bound: &Option<HotkeyCandidate>) {
    let key_name = match bound {
        Some(cand) => cand.name,
        None => return,
    };

    let is_fs = IS_FULLSCREEN.load(Ordering::SeqCst);
    if let Some(overlay) = app.get_webview_window("overlay") {
        if is_fs {
            // 【退出全屏】
            // 1. 先退出全屏
            let _ = overlay.set_fullscreen(false);
            // 2. 强制剥离 Windows 重新注入的标题栏/边框样式
            let _ = overlay.set_decorations(false);
            // 3. 重新最大化
            let _ = overlay.maximize();

            IS_FULLSCREEN.store(false, Ordering::SeqCst);
            let _ = app.emit("fullscreen-changed", serde_json::json!({
                "is_fullscreen": false,
                "hotkey": key_name
            }));
        } else {
            // 【进入全屏】
            // 1. 必须先解除最大化限制，突破 Work Area 约束以覆盖任务栏
            let _ = overlay.unmaximize();
            // 2. 确保无边框样式
            let _ = overlay.set_decorations(false);
            // 3. 进入真正的全屏
            let _ = overlay.set_fullscreen(true);

            IS_FULLSCREEN.store(true, Ordering::SeqCst);
            let _ = app.emit("fullscreen-changed", serde_json::json!({
                "is_fullscreen": true,
                "hotkey": key_name
            }));
        }
    }
}

#[cfg(target_os = "windows")]
pub fn toggle_hotkey_from_tray<R: Runtime>(_app: &tauri::AppHandle<R>) {
    let is_bound = CURRENT_BOUND_KEY.lock().unwrap().is_some();
    if is_bound {
        post_thread_command(WM_CMD_UNBIND);
    } else {
        post_thread_command(WM_CMD_REBIND);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn init_hotkey<R: Runtime>(_app: tauri::AppHandle<R>) {}

#[cfg(not(target_os = "windows"))]
pub fn toggle_hotkey_from_tray<R: Runtime>(_app: &tauri::AppHandle<R>) {}

#[tauri::command]
pub fn get_hotkey_status() -> serde_json::Value {
    let key = CURRENT_BOUND_KEY.lock().unwrap().clone();
    let is_fs = IS_FULLSCREEN.load(Ordering::SeqCst);
    let success = HOTKEY_SUCCESS.load(Ordering::SeqCst);
    serde_json::json!({
        "success": success,
        "key": key,
        "is_fullscreen": is_fs
    })
}

#[tauri::command]
pub fn toggle_fullscreen<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        post_thread_command(WM_CMD_TOGGLE_FS);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
    }
    Ok(())
}

#[tauri::command]
pub fn get_system_time_config() -> SystemTimeConfig {
    let mut lock = SYSTEM_TIME_CONFIG.lock().unwrap();
    if let Some(ref cfg) = *lock {
        cfg.clone()
    } else {
        let def = SystemTimeConfig::default();
        *lock = Some(def.clone());
        def
    }
}

#[tauri::command]
pub fn save_system_time_config<R: Runtime>(app: tauri::AppHandle<R>, config: SystemTimeConfig) -> Result<(), String> {
    SYSTEM_TIME_VISIBLE.store(config.visible, Ordering::SeqCst);
    {
        let mut lock = SYSTEM_TIME_CONFIG.lock().unwrap();
        *lock = Some(config.clone());
    }
    let _ = app.emit("internal-set-system-time-visible", serde_json::json!({ "visible": config.visible }));
    let _ = app.emit("system-time-visibility-changed", serde_json::json!({ "visible": config.visible }));
    let _ = app.emit("update-system-time-config", &config);
    Ok(())
}

#[tauri::command]
pub fn set_system_time_visible<R: Runtime>(app: tauri::AppHandle<R>, visible: bool) -> Result<(), String> {
    SYSTEM_TIME_VISIBLE.store(visible, Ordering::SeqCst);
    {
        let mut lock = SYSTEM_TIME_CONFIG.lock().unwrap();
        if let Some(ref mut cfg) = *lock {
            cfg.visible = visible;
        } else {
            let mut def = SystemTimeConfig::default();
            def.visible = visible;
            *lock = Some(def);
        }
    }
    let _ = app.emit("internal-set-system-time-visible", serde_json::json!({ "visible": visible }));
    let _ = app.emit("system-time-visibility-changed", serde_json::json!({ "visible": visible }));
    Ok(())
}

#[tauri::command]
pub fn get_system_time_visible() -> bool {
    SYSTEM_TIME_VISIBLE.load(Ordering::SeqCst)
}
