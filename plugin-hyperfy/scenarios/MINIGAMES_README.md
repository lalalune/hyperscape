# Eliza Minigames

Visual AI-powered social deduction games featuring Mafia and Among Us scenarios.

## 🎮 Available Games

### 🎭 Mafia
Classic social deduction game where 8 AI agents with unique personalities sit around a table trying to identify the hidden mafia members.

**Features:**
- 8 unique AI personalities (Detective Donut, Suspicious Susan, etc.)
- Day/night cycle with dynamic lighting
- Visual voting indicators
- Death animations
- Real-time game state display

### 🚀 Among Us
Spatial deduction game where crewmates complete tasks in a maze while impostors hunt them down.

**Features:**
- Procedurally generated maze
- Line-of-sight kill mechanics
- Task completion system
- Emergency meetings
- Visual dead bodies

## 🚀 Quick Start

### Method 1: Web Interface (Recommended)

1. Start the development server:
```bash
npm run dev
```

2. Browser will automatically open to `http://localhost:3000/minigames.html`

3. Click on either game to launch it

4. Open browser console (F12) and run:
   - For Mafia: `window.runMafiaScenario()`
   - For Among Us: `window.runAmongUsScenario()`

### Method 2: Direct Access

1. Start the dev server:
```bash
npm run dev
```

2. Navigate directly to:
   - Mafia: `http://localhost:3000/mafia.html`
   - Among Us: `http://localhost:3000/amongus.html`

3. Run the scenario from console as above

### Method 3: Command Line (Non-Visual)

```bash
# Run Mafia game
bun scenarios/mafia-game-runner.ts

# Run Among Us game
bun scenarios/among-us-runner.ts
```

## 🎨 Visual Controls

### Camera Controls
- **Left Click + Drag**: Rotate camera
- **Right Click + Drag**: Pan camera
- **Scroll**: Zoom in/out

### Mafia Game Controls
- Watch the circular table from any angle
- Observe voting arrows between players
- See day/night lighting transitions
- Track player eliminations

### Among Us Game Controls
- Overhead view of the maze
- Watch players navigate and complete tasks
- See kill animations and dead bodies
- Monitor task progress and meetings

## 🔧 Development

### Project Structure
```
scenarios/
├── mafia-game-scenario.ts      # Mafia game logic
├── mafia-game-runner.ts        # Mafia runner
├── among-us-scenario.ts        # Among Us game logic
├── among-us-runner.ts          # Among Us runner
└── MINIGAMES_README.md         # This file

src/worlds/
├── mafia-world.ts              # Mafia 3D world
└── among-us-world.ts           # Among Us 3D world

public/
├── minigames.html              # Games menu
├── mafia.html                  # Mafia game page
└── amongus.html                # Among Us game page
```

### Adding New Games

1. Create scenario logic in `scenarios/`
2. Create 3D world in `src/worlds/`
3. Create HTML entry in `public/`
4. Update `minigames.html` with new game
5. Add route to `vite.config.ts`

## 🐛 Troubleshooting

### Game Not Loading
- Check browser console for errors
- Ensure npm packages are installed: `npm install`
- Try clearing browser cache

### Visual Issues
- Update graphics drivers
- Try different browser (Chrome/Firefox recommended)
- Check WebGL support: https://get.webgl.org/

### Performance Issues
- Reduce browser window size
- Close other tabs/applications
- Lower quality settings in code if needed

## 📝 Notes

- Games run entirely in the browser using Three.js
- AI agents make decisions based on game state
- All scenarios are deterministic with random elements
- Visual display updates in real-time
- Console logs provide detailed game information 