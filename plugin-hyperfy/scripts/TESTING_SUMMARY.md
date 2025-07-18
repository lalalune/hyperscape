# Visual Minigames Testing Summary

## 🎮 What's Been Created

### Visual Minigames
1. **Mafia Game** - Classic social deduction with 8 AI agents around a table
2. **Among Us** - Spatial deduction in a procedurally generated maze

### Testing Infrastructure

#### 1. **Full Visual Test Suite** (`scripts/test-visual-minigames.js`)
- Launches browser with Puppeteer
- Opens each game and runs scenarios
- Takes screenshots at different stages
- Verifies 3D scenes load correctly
- **Usage:** `npm run minigames:test`

#### 2. **Continuous Test Loop** (`scripts/minigames-test-loop.js`)
- Runs tests every 15 seconds
- Monitors game health continuously
- Quick mode for single test run
- **Usage:** 
  - `npm run minigames:test:loop` (continuous)
  - `npm run minigames:test:quick` (single run)

#### 3. **Manual Verification** (`scripts/verify-minigames.js`)
- Checks all required files exist
- Provides detailed manual testing checklist
- Includes curl commands for quick checks
- **Usage:** `node scripts/verify-minigames.js`

## 📋 Quick Start Testing

### Option 1: Manual Visual Testing
```bash
# Start the dev server
npm run minigames

# Open browser to http://localhost:3000/minigames.html
# Click on either game
# Run in console: window.runMafiaScenario() or window.runAmongUsScenario()
```

### Option 2: Automated Testing (requires Chrome)
```bash
# Full test with screenshots
npm run minigames:test

# Continuous monitoring
npm run minigames:test:loop
```

### Option 3: File Verification Only
```bash
node scripts/verify-minigames.js
```

## 🔍 What the Tests Verify

### Visual Elements
- ✅ 3D scenes render correctly
- ✅ UI overlays display properly
- ✅ Game objects spawn as expected
- ✅ Animations and lighting work

### Functionality
- ✅ Scenarios can be launched from browser
- ✅ AI agents appear and interact
- ✅ Game state updates in real-time
- ✅ Camera controls work

### File Structure
- ✅ All HTML files in place
- ✅ 3D world implementations exist
- ✅ Scenario logic files present
- ✅ Runner scripts configured

## 📸 Screenshot Locations

When running automated tests, screenshots are saved to:
- `test-screenshots/menu.png` - Minigames menu
- `test-screenshots/mafia-initial.png` - Mafia before game starts
- `test-screenshots/mafia-gameplay.png` - Mafia during game
- `test-screenshots/mafia-final.png` - Mafia after running
- `test-screenshots/amongus-initial.png` - Among Us before game
- `test-screenshots/amongus-gameplay.png` - Among Us during game
- `test-screenshots/amongus-final.png` - Among Us after running

## 🛠️ Troubleshooting

### Server Not Starting
- Check if port 3000 is in use
- Ensure dependencies are installed: `npm install`
- Try `npm run build` first

### Visual Tests Fail (Puppeteer)
- Chrome/Chromium must be installed
- For WSL: May need to install Chrome in Windows
- Alternative: Use manual testing instructions

### Games Not Loading
- Check browser console for errors
- Ensure Three.js is properly imported
- Verify vite.config.ts has correct routes

## 📊 Test Scripts Summary

| Script | Purpose | Requirements |
|--------|---------|--------------|
| `minigames:test` | Full visual test with screenshots | Chrome/Puppeteer |
| `minigames:test:loop` | Continuous monitoring | Chrome/Puppeteer |
| `minigames:test:quick` | Single quick test | Chrome/Puppeteer |
| `verify-minigames.js` | File verification & manual guide | None |
| `minigames:mafia` | Run Mafia scenario (CLI) | None |
| `minigames:amongus` | Run Among Us scenario (CLI) | None |

## ✨ Key Features Tested

### Mafia Game
- Circular table with 8 chairs
- Day/night lighting transitions
- Voting arrow visualizations
- Player elimination animations
- Real-time UI updates

### Among Us
- Procedural maze generation
- Task placement and completion
- Line-of-sight mechanics
- Emergency meeting system
- Dead body visuals

Both games feature full 3D visualization, camera controls, and real-time AI agent interactions! 