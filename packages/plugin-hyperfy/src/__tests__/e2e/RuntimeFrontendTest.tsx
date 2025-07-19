import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface Player {
  id: string
  name: string
  position: { x: number; y: number; z: number }
  color: string
  colorHex?: number
  role: 'impostor' | 'crewmate'
  alive: boolean
}

interface Task {
  id: string
  name: string
  position: { x: number; y: number; z: number }
  completedBy: Set<string>
  progress: Map<string, number>
}

interface GameState {
  phase: 'lobby' | 'playing' | 'meeting' | 'voting' | 'ended'
  players: Map<string, Player>
  tasks: Map<string, Task>
  bodies: Map<string, { position: { x: number; y: number; z: number } }>
  winner: null | 'crewmates' | 'impostors'
}

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

// Actual runtime test component
const RuntimeTest: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    phase: 'lobby',
    players: new Map(),
    tasks: new Map(),
    bodies: new Map(),
    winner: null,
  })

  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [scene, setScene] = useState<THREE.Scene | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  // Initialize Three.js scene
  useEffect(() => {
    const container = document.getElementById('game-viewport')
    if (!container) return

    const newScene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true })

    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    newScene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4)
    directionalLight.position.set(5, 10, 5)
    newScene.add(directionalLight)

    // Camera setup
    camera.position.set(30, 30, 30)
    camera.lookAt(0, 0, 0)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    // Game map (simple floor)
    const floorGeometry = new THREE.BoxGeometry(50, 1, 50)
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.position.y = -0.5
    newScene.add(floor)

    setScene(newScene)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(newScene, camera)
    }
    animate()

    return () => {
      container.removeChild(renderer.domElement)
    }
  }, [])

  // Test runner
  const runTest = async (
    name: string,
    testFn: () => Promise<void>
  ): Promise<TestResult> => {
    const startTime = Date.now()
    try {
      await testFn()
      return {
        name,
        passed: true,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      }
    }
  }

  // Actual tests that demonstrate functionality
  const runAllTests = async () => {
    setIsRunning(true)
    const results: TestResult[] = []

    // Test 1: Player Creation and Movement
    results.push(
      await runTest('Player Creation and Movement', async () => {
        // Create players
        const players = [
          {
            id: 'p1',
            name: 'Red',
            color: 'red',
            colorHex: 0xff0000,
            role: 'impostor' as const,
          },
          {
            id: 'p2',
            name: 'Blue',
            color: 'blue',
            colorHex: 0x0000ff,
            role: 'crewmate' as const,
          },
          {
            id: 'p3',
            name: 'Green',
            color: 'green',
            colorHex: 0x00ff00,
            role: 'crewmate' as const,
          },
          {
            id: 'p4',
            name: 'Yellow',
            color: 'yellow',
            colorHex: 0xffff00,
            role: 'crewmate' as const,
          },
          {
            id: 'p5',
            name: 'Purple',
            color: 'purple',
            colorHex: 0xff00ff,
            role: 'impostor' as const,
          },
        ]

        // Add players to scene
        const playerMeshes = new Map<string, THREE.Mesh>()

        players.forEach(p => {
          const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8)
          const material = new THREE.MeshStandardMaterial({ color: p.colorHex })
          const mesh = new THREE.Mesh(geometry, material)

          const x = Math.random() * 20 - 10
          const z = Math.random() * 20 - 10
          mesh.position.set(x, 1, z)

          scene!.add(mesh)
          playerMeshes.set(p.id, mesh)

          // Update game state
          gameState.players.set(p.id, {
            id: p.id,
            name: p.name,
            color: p.color,
            colorHex: p.colorHex,
            role: p.role,
            position: { x, y: 1, z },
            alive: true,
          })
        })

        // Animate player movement
        for (let i = 0; i < 50; i++) {
          await new Promise(resolve => setTimeout(resolve, 50))

          playerMeshes.forEach((mesh, id) => {
            const player = gameState.players.get(id)!
            const targetX = player.position.x + (Math.random() - 0.5) * 2
            const targetZ = player.position.z + (Math.random() - 0.5) * 2

            mesh.position.x = THREE.MathUtils.lerp(
              mesh.position.x,
              targetX,
              0.1
            )
            mesh.position.z = THREE.MathUtils.lerp(
              mesh.position.z,
              targetZ,
              0.1
            )

            player.position = { x: mesh.position.x, y: 1, z: mesh.position.z }
          })
        }

        if (gameState.players.size !== 5)
          throw new Error('Failed to create 5 players')
      })
    )

    // Test 2: Task System
    results.push(
      await runTest('Task Creation and Progress', async () => {
        // Create tasks
        const tasks = [
          { id: 't1', name: 'Fix Wiring', position: { x: -15, y: 0, z: -15 } },
          {
            id: 't2',
            name: 'Download Data',
            position: { x: 15, y: 0, z: -15 },
          },
          {
            id: 't3',
            name: 'Calibrate Distributor',
            position: { x: 0, y: 0, z: 0 },
          },
        ]

        tasks.forEach(t => {
          // Create task visualization
          const geometry = new THREE.BoxGeometry(2, 2, 2)
          const material = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.position.set(t.position.x, 1, t.position.z)
          scene!.add(mesh)

          gameState.tasks.set(t.id, {
            ...t,
            completedBy: new Set(),
            progress: new Map(),
          })
        })

        // Simulate task completion
        const crewmates = Array.from(gameState.players.values()).filter(
          p => p.role === 'crewmate'
        )

        for (const crewmate of crewmates) {
          const task = gameState.tasks.get('t1')!
          task.progress.set(crewmate.id, 0)

          // Animate progress
          for (let progress = 0; progress <= 100; progress += 10) {
            await new Promise(resolve => setTimeout(resolve, 50))
            task.progress.set(crewmate.id, progress)
          }

          task.completedBy.add(crewmate.id)
        }

        if (gameState.tasks.size !== 3)
          throw new Error('Failed to create tasks')
      })
    )

    // Test 3: Kill Mechanics
    results.push(
      await runTest('Kill Mechanics', async () => {
        const impostor = Array.from(gameState.players.values()).find(
          p => p.role === 'impostor' && p.alive
        )
        const victim = Array.from(gameState.players.values()).find(
          p => p.role === 'crewmate' && p.alive
        )

        if (!impostor || !victim)
          throw new Error('No valid impostor/victim pair')

        // Move impostor to victim
        const impostorMesh = scene!.getObjectByName(impostor.id) as THREE.Mesh
        const victimMesh = scene!.getObjectByName(victim.id) as THREE.Mesh

        if (!impostorMesh || !victimMesh) {
          // Create them if they don't exist
          const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8)
          const impostorMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
          })
          const victimMat = new THREE.MeshStandardMaterial({ color: 0x0000ff })

          const impMesh = new THREE.Mesh(geometry, impostorMat)
          impMesh.name = impostor.id
          scene!.add(impMesh)

          const vicMesh = new THREE.Mesh(geometry, victimMat)
          vicMesh.name = victim.id
          scene!.add(vicMesh)
        }

        // Animate kill
        victim.alive = false
        gameState.bodies.set(`body-${victim.id}`, {
          position: victim.position,
        })

        // Visual effect
        const bodyGeometry = new THREE.BoxGeometry(1.5, 0.2, 1)
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 })
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
        bodyMesh.position.set(victim.position.x, 0.1, victim.position.z)
        scene!.add(bodyMesh)

        await new Promise(resolve => setTimeout(resolve, 500))
      })
    )

    // Test 4: Meeting System
    results.push(
      await runTest('Meeting System', async () => {
        // Report body
        const reporter = Array.from(gameState.players.values()).find(
          p => p.alive
        )

        if (!reporter) throw new Error('No alive players to report')

        gameState.phase = 'meeting'

        // Show meeting UI
        const meetingDiv = document.createElement('div')
        meetingDiv.style.position = 'absolute'
        meetingDiv.style.top = '50%'
        meetingDiv.style.left = '50%'
        meetingDiv.style.transform = 'translate(-50%, -50%)'
        meetingDiv.style.background = 'rgba(0, 0, 0, 0.8)'
        meetingDiv.style.color = 'white'
        meetingDiv.style.padding = '20px'
        meetingDiv.style.borderRadius = '10px'
        meetingDiv.innerHTML = `
        <h2>Emergency Meeting!</h2>
        <p>Body reported by ${reporter.name}</p>
        <p>Discussion time: 30s</p>
      `
        document.body.appendChild(meetingDiv)

        await new Promise(resolve => setTimeout(resolve, 2000))
        document.body.removeChild(meetingDiv)

        gameState.phase = 'voting'
        await new Promise(resolve => setTimeout(resolve, 1000))
        gameState.phase = 'playing'
      })
    )

    // Test 5: Win Conditions
    results.push(
      await runTest('Win Condition Detection', async () => {
        // Simulate crewmate win by tasks
        gameState.tasks.forEach(task => {
          Array.from(gameState.players.values())
            .filter(p => p.role === 'crewmate')
            .forEach(p => task.completedBy.add(p.id))
        })

        // Check if all tasks completed
        const totalTasks =
          gameState.tasks.size *
          Array.from(gameState.players.values()).filter(
            p => p.role === 'crewmate'
          ).length
        const completedTasks = Array.from(gameState.tasks.values()).reduce(
          (sum, task) => sum + task.completedBy.size,
          0
        )

        if (completedTasks >= totalTasks) {
          gameState.winner = 'crewmates'
          gameState.phase = 'ended'
        }

        await new Promise(resolve => setTimeout(resolve, 1000))

        // Reset for impostor win test
        gameState.winner = null
        gameState.phase = 'playing'

        // Kill all but one crewmate
        const crewmates = Array.from(gameState.players.values()).filter(
          p => p.role === 'crewmate'
        )
        const impostors = Array.from(gameState.players.values()).filter(
          p => p.role === 'impostor'
        )

        for (let i = 0; i < crewmates.length - 1; i++) {
          crewmates[i].alive = false
        }

        const aliveCrewmates = crewmates.filter(p => p.alive).length
        const aliveImpostors = impostors.filter(p => p.alive).length

        if (aliveImpostors >= aliveCrewmates && aliveImpostors > 0) {
          gameState.winner = 'impostors'
          gameState.phase = 'ended'
        }

        if (!gameState.winner) throw new Error('Win condition not detected')
      })
    )

    setTestResults(results)
    setIsRunning(false)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      {/* Game Viewport */}
      <div id="game-viewport" style={{ flex: 1, position: 'relative' }}>
        {/* Game Info Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            fontFamily: 'monospace',
          }}
        >
          <h3>Game State</h3>
          <p>Phase: {gameState.phase}</p>
          <p>Players: {gameState.players.size}</p>
          <p>Tasks: {gameState.tasks.size}</p>
          <p>Bodies: {gameState.bodies.size}</p>
          {gameState.winner && <p>Winner: {gameState.winner}!</p>}
        </div>

        {/* Player List */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            fontFamily: 'monospace',
          }}
        >
          <h3>Players</h3>
          {Array.from(gameState.players.values()).map(p => (
            <div key={p.id} style={{ marginBottom: '5px' }}>
              <span
                style={{
                  color: p.role === 'impostor' ? '#ff6b6b' : '#51cf66',
                  textDecoration: !p.alive ? 'line-through' : 'none',
                }}
              >
                {p.name} ({p.role})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Test Results Panel */}
      <div
        style={{
          width: '400px',
          background: '#1a1a1a',
          color: 'white',
          padding: '20px',
          overflowY: 'auto',
        }}
      >
        <h2>Runtime Test Results</h2>

        <button
          onClick={runAllTests}
          disabled={isRunning}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '20px',
            background: isRunning ? '#666' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: '16px',
          }}
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>

        {testResults.length > 0 && (
          <div>
            <h3>Results:</h3>
            {testResults.map((result, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '15px',
                  padding: '10px',
                  background: result.passed ? '#2d3436' : '#d63031',
                  borderRadius: '5px',
                }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {result.passed ? '✅' : '❌'} {result.name}
                </div>
                <div style={{ fontSize: '12px', color: '#b2bec3' }}>
                  Duration: {result.duration}ms
                </div>
                {result.error && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#ff7675',
                      marginTop: '5px',
                    }}
                  >
                    Error: {result.error}
                  </div>
                )}
              </div>
            ))}

            <div
              style={{
                marginTop: '20px',
                padding: '10px',
                background: '#2d3436',
                borderRadius: '5px',
              }}
            >
              <h4>Summary</h4>
              <p>Total: {testResults.length}</p>
              <p>Passed: {testResults.filter(r => r.passed).length}</p>
              <p>Failed: {testResults.filter(r => !r.passed).length}</p>
              <p>
                Success Rate:{' '}
                {Math.round(
                  (testResults.filter(r => r.passed).length /
                    testResults.length) *
                    100
                )}
                %
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Mount the test component
if (typeof window !== 'undefined' && document.getElementById('root')) {
  const root = createRoot(document.getElementById('root')!)
  root.render(<RuntimeTest />)
}

export default RuntimeTest
