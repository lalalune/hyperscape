//! Hyperscape Tauri Application
//!
//! Core application logic for both desktop and mobile platforms.
//! Uses Tauri v2 for native windowing and system integration.
//! Includes Steam Deck optimizations for fullscreen gaming.

use tauri::{AppHandle, Emitter, Manager, LogicalSize, PhysicalSize};

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

/// Check if we should run in Steam Deck mode
fn should_use_steam_deck_mode() -> bool {
    std::env::var("SteamOS").is_ok()
        || std::env::var("SteamDeck").is_ok()
        || std::env::var("STEAM_DECK").is_ok()
        || std::env::var("SteamGamepadUI").is_ok()
        || is_steam_deck_hardware()
}

/// Application setup hook - runs after window creation
fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Configure deep link handler for OAuth
    setup_deep_link_handler(app);
    
    // Log platform info
    let is_steam_deck = should_use_steam_deck_mode();
    log::info!("Hyperscape starting on {} {} (Steam Deck: {})", 
        std::env::consts::OS, 
        std::env::consts::ARCH,
        is_steam_deck
    );

    // Configure window for Steam Deck
    if let Some(window) = app.get_webview_window("main") {
        if is_steam_deck {
            log::info!("[Hyperscape] Configuring for Steam Deck mode");
            
            // Steam Deck native resolution: 1280x800
            let _ = window.set_size(LogicalSize::new(1280, 800));
            
            // Fullscreen for Game Mode, borderless for better UX
            let _ = window.set_fullscreen(true);
            let _ = window.set_decorations(false);
            
            // Disable cursor in Game Mode (Steam handles virtual cursor)
            let _ = window.eval(r#"
                document.body.style.cursor = 'none';
                document.documentElement.classList.add('steam-deck-mode');
                document.documentElement.classList.add('gamepad-mode');
                console.log('[Hyperscape] Steam Deck mode enabled');
            "#);
        }

        // Log WebGPU status from the webview
        let _ = window.eval(r#"
            (async () => {
                if (navigator.gpu) {
                    const adapter = await navigator.gpu.requestAdapter();
                    console.log('[Hyperscape] WebGPU available:', !!adapter);
                    if (adapter) {
                        const info = await adapter.requestAdapterInfo();
                        console.log('[Hyperscape] GPU:', info.vendor, info.architecture, info.description);
                    }
                } else {
                    console.warn('[Hyperscape] WebGPU not available in this webview');
                }
            })();
        "#);
    }
    
    Ok(())
}

/// Tauri command: Get platform information including Steam Deck detection
/// Called from frontend to detect platform and apply appropriate settings
#[tauri::command]
fn get_platform_info() -> serde_json::Value {
    // Detect Steam Deck via environment variables set by SteamOS
    let is_steam_deck = std::env::var("SteamOS").is_ok()
        || std::env::var("SteamDeck").is_ok()
        || std::env::var("STEAM_DECK").is_ok()
        || is_steam_deck_hardware();

    // Detect if running in Steam Game Mode
    let is_steam_game_mode = std::env::var("SteamGamepadUI").is_ok()
        || std::env::var("STEAM_RUNTIME").is_ok();

    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
        "isSteamDeck": is_steam_deck,
        "isSteamGameMode": is_steam_game_mode,
    })
}

/// Check if running on Steam Deck hardware by checking for AMD APU characteristics
fn is_steam_deck_hardware() -> bool {
    #[cfg(target_os = "linux")]
    {
        // Check for Steam Deck's specific CPU model in /proc/cpuinfo
        if let Ok(cpuinfo) = std::fs::read_to_string("/proc/cpuinfo") {
            // Steam Deck uses AMD Custom APU 0405 (Van Gogh)
            if cpuinfo.contains("AMD Custom APU 0405") {
                return true;
            }
        }

        // Check DMI product name
        if let Ok(product_name) = std::fs::read_to_string("/sys/class/dmi/id/product_name") {
            if product_name.trim().contains("Jupiter") || product_name.trim().contains("Galileo") {
                return true; // Steam Deck LCD or OLED
            }
        }
    }

    false
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
        .expect("error while running Hyperscape");
}
