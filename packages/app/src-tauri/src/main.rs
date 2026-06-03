//! Hyperia Desktop Entry Point
//!
//! Main entry point for desktop platforms (Windows, macOS, Linux).
//! Mobile platforms use lib.rs via the mobile_entry_point attribute.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hyperia_lib::run()
}
