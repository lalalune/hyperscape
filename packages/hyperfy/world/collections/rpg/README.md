# Hyperscape RPG App

This directory contains the built Hyperfy app for the RPG system.

## Files

- `bundle.js` - Main application bundle
- `manifest.json` - App manifest with permissions and configuration
- `bundle.meta.json` - Build metadata and system information
- `config/` - Game configuration files

## Installation

1. Copy this entire directory to your Hyperfy apps folder
2. Load the app in your Hyperfy world
3. The RPG system will initialize automatically

## Features

- 9 Skills: Attack, Strength, Defense, Constitution, Range, Woodcutting, Fishing, Firemaking, Cooking
- Combat system with melee and ranged combat
- Banking system for item storage
- Equipment system with Bronze, Steel, Mithril tiers
- NPC interactions and shops
- Multiplayer synchronization
- AI agent support via ElizaOS

## Configuration

Edit `manifest.json` to customize:
- Debug mode: `config.debug`
- World generation: `config.worldGen`
- System toggles: `config.systems`
- Visual settings: `config.visuals`

## Build Info

- Version: 1.0.0
- Build Time: 2025-07-18T08:41:28.521Z
- Bundle Size: 23.78 KB
- Format: hyperfy-app
