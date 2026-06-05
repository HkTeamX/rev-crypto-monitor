// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 构建托盘图标
            let _tray = TrayIconBuilder::new()
                // 使用默认图标或指定路径图标
                .icon(app.default_window_icon().unwrap().clone())
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app_handle = tray.app_handle();
                        if let Some(window) = app_handle.get_webview_window("main") {
                            // 如果最小化了则恢复
                            if window.is_minimized().unwrap_or(false) {
                                let _ = window.unminimize();
                            }
                            // 如果隐藏了则显示
                            if !window.is_visible().unwrap_or(false) {
                                let _ = window.show();
                            }
                            // 解除鼠标穿透状态并通知前端同步
                            let _ = window.set_ignore_cursor_events(false);
                            let _ = window.emit("click-through-changed", false);
                            // 如果当前未置顶，临时置顶以确保窗口在最前方
                            let was_on_top = window.is_always_on_top().unwrap_or(false);
                            if !was_on_top {
                                let _ = window.set_always_on_top(true);
                            }
                            let _ = window.set_focus();
                            // 如果是临时置顶，延迟恢复
                            if !was_on_top {
                                let app = app_handle.clone();
                                let window_label = window.label().to_string();
                                std::thread::spawn(move || {
                                    std::thread::sleep(std::time::Duration::from_millis(50));
                                    if let Some(w) = app.get_webview_window(&window_label) {
                                        let _ = w.set_always_on_top(false);
                                    }
                                });
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
