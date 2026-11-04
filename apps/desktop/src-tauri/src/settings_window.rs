use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};

/// 辅助窗口以 `visible(false)` 创建，前端把首帧渲染进 DOM 后再调用本命令显示。
///
/// 这样窗口出现时画面已经是最终内容，不会先露出一个空白框。
/// 等待的是**前端渲染**，不是网络请求：调用方在 `app.mount()` 与路由就绪后立刻发信号，
/// 慢接口只会让状态文案停在「正在检查…」，不影响窗口出现。
#[tauri::command]
pub fn reveal_auxiliary_window(app: AppHandle, label: String) -> Result<(), String> {
    if !crate::AUXILIARY_WINDOW_LABELS.contains(&label.as_str()) {
        return Err("不是可延迟显示的辅助窗口".into());
    }
    match app.get_window(&label) {
        None => Ok(()),
        // 已经可见就不要重复 show，避免抢焦点
        Some(window) if window.is_visible().unwrap_or(false) => Ok(()),
        Some(window) => crate::show_auxiliary_window(&window),
    }
}

fn same_origin(url: &Url, origin: &Url) -> bool {
    url.scheme() == origin.scheme()
        && url.host_str() == origin.host_str()
        && url.port() == origin.port()
}

/// 所有辅助窗口共用主窗口的站点，导航守卫用它把窗口锁在同一来源内。
fn main_origin(app: &AppHandle) -> Result<Url, String> {
    app.get_webview("main")
        .ok_or("主窗口尚未就绪")?
        .url()
        .map_err(|error| error.to_string())
}

/// 把辅助窗口挂到触发它的窗口下面（GWLP_HWNDPARENT 设的是 owner，不是父控件），
/// 这样它总是浮在设置窗口之上，而不是被设置窗口盖住。
fn attach_window_owner(window: &tauri::Window, owner: &tauri::Window) -> Result<(), String> {
    #[cfg(windows)]
    {
        #[link(name = "user32")]
        extern "system" {
            fn SetWindowLongPtrW(hwnd: *mut std::ffi::c_void, index: i32, value: isize) -> isize;
            fn GetWindowLongPtrW(hwnd: *mut std::ffi::c_void, index: i32) -> isize;
        }
        let hwnd = window.hwnd().map_err(|error| error.to_string())?.0;
        let owner_hwnd = owner.hwnd().map_err(|error| error.to_string())?.0 as isize;
        unsafe {
            SetWindowLongPtrW(hwnd, -8, owner_hwnd);
            if GetWindowLongPtrW(hwnd, -8) != owner_hwnd {
                return Err("无法关联窗口".into());
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, owner);
    }
    Ok(())
}

fn position_update_window(window: &tauri::Window, owner: &tauri::Window) -> Result<(), String> {
    attach_window_owner(window, owner)?;
    let origin = owner.inner_position().map_err(|error| error.to_string())?;
    let parent_size = owner.inner_size().map_err(|error| error.to_string())?;
    let size = window.inner_size().map_err(|error| error.to_string())?;
    window
        .set_position(tauri::PhysicalPosition::new(
            origin.x + (parent_size.width as i32 - size.width as i32) / 2,
            origin.y + (parent_size.height as i32 - size.height as i32) / 2,
        ))
        .map_err(|error| error.to_string())
}

/// 创建（不显示）设置窗口。已存在则直接返回。
fn build_settings_window(app: &AppHandle, section: &str) -> Result<(), String> {
    if app.get_window("settings").is_some() {
        return Ok(());
    }
    let origin = main_origin(app)?;
    WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App(format!("index.html#/settings/window?section={section}").into()),
    )
    .title("设置 · library-manage")
    .inner_size(780.0, 600.0)
    .min_inner_size(680.0, 480.0)
    .decorations(false)
    .visible(false)
    .center()
    .on_navigation(move |url| same_origin(&url, &origin))
    .build()
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn build_release_history_window(app: &AppHandle) -> Result<(), String> {
    if app.get_window("release-history").is_some() {
        return Ok(());
    }
    let origin = main_origin(app)?;
    let builder = WebviewWindowBuilder::new(
        app,
        "release-history",
        WebviewUrl::App("index.html#/settings/history".into()),
    )
    .title("更新历史 · library-manage")
    .inner_size(640.0, 680.0)
    .min_inner_size(520.0, 400.0)
    .decorations(false)
    .visible(false)
    .center()
    .on_navigation(move |url| same_origin(&url, &origin));
    // 预创建时还不知道谁会把窗口叫出来，owner 留到显示时再挂，
    // 否则更新历史会挂在主窗口下、被设置窗口盖住。
    builder.build().map_err(|error| error.to_string())?;
    Ok(())
}

/// 创建（不显示）更新弹窗。
///
/// `preload` 为真表示后台预创建：页面不带 `check=1`，且用 `preload=1` 让前端跳过自动检查，
/// 避免启动时就替用户发一次网络请求。真正点开时由 `application-update-check` 事件触发检查。
fn build_update_window(app: &AppHandle, check: bool) -> Result<(), String> {
    if app.get_window("app-update").is_some() {
        return Ok(());
    }
    let origin = main_origin(app)?;
    let route = if check {
        "index.html#/application-update?check=1".to_string()
    } else {
        "index.html#/application-update?check=0&preload=1".to_string()
    };
    WebviewWindowBuilder::new(app, "app-update", WebviewUrl::App(route.into()))
        .title("软件更新")
        .inner_size(480.0, 180.0)
        .min_inner_size(440.0, 180.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .visible(false)
        .center()
        .on_navigation(move |url| same_origin(&url, &origin))
        .build()
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// 启动后只预创建**设置窗口**（最常打开的那个）。
///
/// 三个窗口一起建会把主线程连续占住几百毫秒，启动时更容易被察觉；
/// 更新弹窗和更新历史基本都从设置里进，等设置第一次打开后再补建就来得及，
/// 见 [`prepare_secondary_windows`]。
#[tauri::command]
pub async fn prepare_auxiliary_windows(app: AppHandle) -> Result<(), String> {
    std::thread::spawn(move || {
        // 让主界面先上屏，再来后台准备
        std::thread::sleep(std::time::Duration::from_millis(1500));
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            let _ = build_settings_window(&handle, "general");
        });
    });
    Ok(())
}

/// 设置窗口第一次显示后，再把更新弹窗、更新历史补建起来。
///
/// 分两步错开：窗口创建要走主线程，连续两次会造成可感知的顿挫。
/// 只做一次；即使用户提前点了这两个窗口，也只是退回现场创建，不影响可用性。
fn prepare_secondary_windows(app: &AppHandle) {
    static STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if STARTED.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return;
    }
    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(700));
        let dispatcher = app_handle.clone();
        let builder = app_handle.clone();
        let _ = dispatcher.run_on_main_thread(move || {
            let _ = build_update_window(&builder, false);
        });
        std::thread::sleep(std::time::Duration::from_millis(500));
        let dispatcher = app_handle.clone();
        let builder = app_handle.clone();
        let _ = dispatcher.run_on_main_thread(move || {
            let _ = build_release_history_window(&builder);
        });
    });
}

#[tauri::command]
pub async fn open_application_update_window(
    app: AppHandle,
    webview: tauri::Webview,
    check: Option<bool>,
) -> Result<(), String> {
    static LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    let _guard = LOCK.lock().await;
    let owner = webview.window();
    let want_check = check.unwrap_or(false);
    if let Some(window) = app.get_window("app-update") {
        let already_visible = window.is_visible().unwrap_or(false);
        // 窗口已经摆在用户眼前时，后台检查不抢焦点；只有显式检查才更新它
        if already_visible && !want_check {
            return Ok(());
        }
        position_update_window(&window, &owner)?;
        // 预创建的窗口是按「不检查」加载的，显示前先让它刷新状态
        if want_check || !already_visible {
            let _ = app.emit_to("app-update", "application-update-check", ());
        }
        return crate::show_auxiliary_window(&window);
    }
    build_update_window(&app, want_check)?;
    let window = app.get_window("app-update").ok_or("更新窗口尚未就绪")?;
    position_update_window(&window, &owner)?;
    // 现场创建（预创建还没跑到）时走「首帧画好再显示」，避免先闪空白框
    crate::schedule_auxiliary_fallback(&app, "app-update");
    Ok(())
}

#[tauri::command]
pub async fn open_release_history_window(
    app: AppHandle,
    webview: tauri::Webview,
) -> Result<(), String> {
    let owner = webview.window();
    if let Some(window) = app.get_window("release-history") {
        // 谁点开的就挂在谁下面，保证更新历史浮在设置窗口之上
        attach_window_owner(&window, &owner)?;
        return crate::show_auxiliary_window(&window);
    }
    build_release_history_window(&app)?;
    if let Some(window) = app.get_window("release-history") {
        let _ = attach_window_owner(&window, &owner);
    }
    crate::schedule_auxiliary_fallback(&app, "release-history");
    Ok(())
}

#[tauri::command]
pub async fn open_settings_window(app: AppHandle, section: Option<String>) -> Result<(), String> {
    let section = match section.as_deref() {
        Some("storage") => "storage",
        Some("updates") => "updates",
        _ => "general",
    };
    if let Some(window) = app.get_window("settings") {
        app.emit_to("settings", "settings-section", section)
            .map_err(|e| e.to_string())?;
        prepare_secondary_windows(&app);
        return crate::show_auxiliary_window(&window);
    }
    build_settings_window(&app, section)?;
    prepare_secondary_windows(&app);
    crate::schedule_auxiliary_fallback(&app, "settings");
    Ok(())
}
