//! Hyperia Tauri Application
//!
//! Core application logic for both desktop and mobile platforms.
//! Uses Tauri v2 for native windowing and system integration.

use tauri::{AppHandle, Emitter, Manager};

/// Initialize and configure all Tauri plugins
fn setup_plugins(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
}

/// Handle deep link events for OAuth callbacks
fn setup_deep_link_handler(app: &AppHandle) {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        
        let app_handle = app.clone();
        app.deep_link().on_open_url(move |event| {
            for url in event.urls() {
                let url_str = url.as_str();
                log::info!("Deep link received: {}", url_str);
                
                // Emit event to frontend for OAuth handling
                let _ = app_handle.emit("deep-link", url_str.to_string());
            }
        });
    }
    
    #[cfg(desktop)]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        
        let app_handle = app.clone();
        if let Ok(Some(urls)) = app.deep_link().get_current() {
            for url in urls {
                let url_str = url.as_str();
                log::info!("Deep link on launch: {}", url_str);
                let _ = app_handle.emit("deep-link", url_str.to_string());
            }
        }
        
        let app_handle = app.clone();
        app.deep_link().on_open_url(move |event| {
            for url in event.urls() {
                let url_str = url.as_str();
                log::info!("Deep link received: {}", url_str);
                let _ = app_handle.emit("deep-link", url_str.to_string());
            }
        });
    }
}

/// JavaScript to inject MWA intent bridge on Android.
/// The Solana Mobile Wallet Adapter protocol uses `solana-wallet://` custom scheme URLs
/// to launch wallet apps. Android WebView doesn't resolve custom schemes automatically,
/// so we intercept `window.location.assign()` calls and forward matching URLs to the
/// system via Tauri's `open_external` command. This enables MWA on Saga/Seeker in the
/// Tauri WebView, not just in Android Chrome.
#[cfg(target_os = "android")]
const MWA_INTENT_BRIDGE_JS: &str = r#"
(function() {
    var origAssign = window.location.assign;
    window.location.assign = function(url) {
        try {
            var s = String(url);
            if (s.indexOf('solana-wallet:') === 0 || s.indexOf('intent:') === 0) {
                console.log('[Hyperia] MWA: forwarding intent to system:', s);
                if (window.__TAURI__ && window.__TAURI__.core) {
                    window.__TAURI__.core.invoke('open_external', { url: s });
                }
                return;
            }
        } catch (e) {}
        return origAssign.call(window.location, url);
    };
})();
"#;

/// JavaScript to check WebGPU availability in the webview
const WEBGPU_CHECK_JS: &str = r#"
(async () => {
    if (navigator.gpu) {
        const adapter = await navigator.gpu.requestAdapter();
        console.log('[Hyperia] WebGPU available:', !!adapter);
        if (adapter) {
            const info = await adapter.requestAdapterInfo();
            console.log('[Hyperia] GPU:', info.vendor, info.architecture, info.description);
        }
    } else {
        console.warn('[Hyperia] WebGPU not available in this webview');
    }
})();
"#;

/// Application setup hook - runs after window creation
fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Configure deep link handler for OAuth
    setup_deep_link_handler(app);

    // Log platform info
    log::info!("Hyperia starting on {} {}",
        std::env::consts::OS,
        std::env::consts::ARCH
    );

    if let Some(window) = app.get_webview_window("main") {
        // On Android, inject MWA intent bridge so solana-wallet:// URLs
        // are forwarded to the system to launch wallet apps (Saga/Seeker)
        #[cfg(target_os = "android")]
        {
            let _ = window.eval(MWA_INTENT_BRIDGE_JS);
            log::info!("Hyperia: MWA intent bridge injected for Android");
        }

        // Log WebGPU status
        let _ = window.eval(WEBGPU_CHECK_JS);
    }
    
    Ok(())
}

/// Tauri command: Check WebGPU availability message
/// Called from frontend to show appropriate error if WebGPU unavailable
#[tauri::command]
fn get_platform_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
    })
}

/// Tauri command: Open external URL in system browser
#[tauri::command]
async fn open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

/// Main application runner - called from main.rs (desktop) and mobile entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    let builder = setup_plugins(builder);
    
    builder
        .invoke_handler(tauri::generate_handler![
            get_platform_info,
            open_external,
        ])
        .setup(|app| {
            setup(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Hyperia");
}
