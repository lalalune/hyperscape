import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'

interface MinimapProps {
  world: any
  width?: number
  height?: number
  zoom?: number
  className?: string
  style?: React.CSSProperties
}

interface EntityPip {
  id: string
  type: 'player' | 'enemy' | 'building' | 'item'
  position: THREE.Vector3
  color: string
}

export function Minimap({ 
  world, 
  width = 200, 
  height = 200, 
  zoom = 50,
  className = '',
  style = {}
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const terrainMeshRef = useRef<THREE.Mesh | null>(null)
  const [entityPips, setEntityPips] = useState<EntityPip[]>([])

  // Initialize minimap renderer and camera
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create orthographic camera for overhead view
    const camera = new THREE.OrthographicCamera(
      -zoom, zoom, zoom, -zoom, 0.1, 1000
    )
    camera.position.set(0, 100, 0)
    camera.lookAt(0, 0, 0)
    camera.up.set(0, 0, -1) // Z up for top-down view
    cameraRef.current = camera

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      canvas,
      alpha: true,
      antialias: false
    })
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0.8)
    rendererRef.current = renderer

    // Create scene
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(0, 10, 0)
    scene.add(directionalLight)

    return () => {
      renderer.dispose()
    }
  }, [width, height, zoom])

  // Create terrain representation
  useEffect(() => {
    if (!sceneRef.current || !world.stage) return

    // Create a simplified terrain mesh for the minimap
    const geometry = new THREE.PlaneGeometry(100, 100, 32, 32)
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x4a5c3a, // Forest green
      wireframe: false
    })
    
    const terrainMesh = new THREE.Mesh(geometry, material)
    terrainMesh.rotation.x = -Math.PI / 2 // Lay flat
    terrainMesh.position.y = -1
    
    sceneRef.current.add(terrainMesh)
    terrainMeshRef.current = terrainMesh

    return () => {
      if (terrainMeshRef.current && sceneRef.current) {
        sceneRef.current.remove(terrainMeshRef.current)
        terrainMeshRef.current.geometry.dispose()
        if (Array.isArray(terrainMeshRef.current.material)) {
          terrainMeshRef.current.material.forEach(m => m.dispose())
        } else {
          terrainMeshRef.current.material.dispose()
        }
      }
    }
  }, [world])

  // Update camera position based on player position
  useEffect(() => {
    if (!world.entities?.player || !cameraRef.current) return

    const updateCameraPosition = () => {
      const player = world.entities.player
      if (player?.position && cameraRef.current) {
        cameraRef.current.position.x = player.position.x
        cameraRef.current.position.z = player.position.z
        cameraRef.current.lookAt(
          player.position.x, 
          0, 
          player.position.z
        )
      }
    }

    updateCameraPosition()
    
    // Update every frame
    const intervalId = setInterval(updateCameraPosition, 100)
    
    return () => clearInterval(intervalId)
  }, [world])

  // Collect entity data for pips
  useEffect(() => {
    if (!world.entities) return

    const updateEntityPips = () => {
      const pips: EntityPip[] = []
      
      // Add player pip
      const player = world.entities.player
      if (player?.position) {
        pips.push({
          id: 'local-player',
          type: 'player',
          position: new THREE.Vector3(player.position.x, 0, player.position.z),
          color: '#00ff00' // Green for local player
        })
      }

      // Add other players
      const players = world.getPlayers?.() || []
      players.forEach((otherPlayer: any) => {
        if (otherPlayer.id !== player?.id && otherPlayer.position) {
          pips.push({
            id: otherPlayer.id,
            type: 'player',
            position: new THREE.Vector3(otherPlayer.position.x, 0, otherPlayer.position.z),
            color: '#0088ff' // Blue for other players
          })
        }
      })

      // Add enemies - check RPG entities or stage entities
      if (world.stage?.scene) {
        world.stage.scene.traverse((object: any) => {
          // Look for RPG mob entities with certain naming patterns
          if (object.name && (
            object.name.includes('Goblin') || 
            object.name.includes('Bandit') || 
            object.name.includes('Barbarian') ||
            object.name.includes('Guard') ||
            object.name.includes('Knight') ||
            object.name.includes('Warrior') ||
            object.name.includes('Ranger')
          )) {
            const worldPos = new THREE.Vector3()
            object.getWorldPosition(worldPos)
            
            pips.push({
              id: object.uuid,
              type: 'enemy',
              position: new THREE.Vector3(worldPos.x, 0, worldPos.z),
              color: '#ff4444' // Red for enemies
            })
          }
          
          // Look for building/structure entities
          if (object.name && (
            object.name.includes('Bank') ||
            object.name.includes('Store') ||
            object.name.includes('Building') ||
            object.name.includes('Structure') ||
            object.name.includes('House') ||
            object.name.includes('Shop')
          )) {
            const worldPos = new THREE.Vector3()
            object.getWorldPosition(worldPos)
            
            pips.push({
              id: object.uuid,
              type: 'building',
              position: new THREE.Vector3(worldPos.x, 0, worldPos.z),
              color: '#ffaa00' // Orange for buildings
            })
          }
        })
      }

      // Check for RPG-specific entities via systems
      if (world.systems) {
        world.systems.forEach((system: any) => {
          // Look for RPG systems that might have entity data
          if (system.constructor.name.includes('RPG') && system.entities) {
            Object.values(system.entities).forEach((entity: any) => {
              if (entity.position && entity.type) {
                let color = '#ffffff'
                let type: EntityPip['type'] = 'item'
                
                switch (entity.type) {
                  case 'mob':
                  case 'enemy':
                    color = '#ff4444'
                    type = 'enemy'
                    break
                  case 'building':
                  case 'structure':
                    color = '#ffaa00'
                    type = 'building'
                    break
                  case 'item':
                  case 'loot':
                    color = '#ffff44'
                    type = 'item'
                    break
                }
                
                pips.push({
                  id: entity.id || entity.uuid || Math.random().toString(),
                  type,
                  position: new THREE.Vector3(entity.position.x, 0, entity.position.z),
                  color
                })
              }
            })
          }
        })
      }

      setEntityPips(pips)
    }

    updateEntityPips()
    const intervalId = setInterval(updateEntityPips, 200)
    
    return () => clearInterval(intervalId)
  }, [world])

  // Render pips on canvas
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return

    const render = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
        
        // Draw pips on top of the 3D render
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // Draw entity pips
            entityPips.forEach(pip => {
              // Convert world position to screen position
              const vector = pip.position.clone()
              vector.project(cameraRef.current!)
              
              const x = (vector.x * 0.5 + 0.5) * width
              const y = (vector.y * -0.5 + 0.5) * height
              
              // Only draw if within bounds
              if (x >= 0 && x <= width && y >= 0 && y <= height) {
                // Set pip properties based on type
                let radius = 3
                let borderColor = '#ffffff'
                let borderWidth = 1
                
                switch (pip.type) {
                  case 'player':
                    radius = pip.id === 'local-player' ? 5 : 4
                    borderWidth = pip.id === 'local-player' ? 2 : 1
                    break
                  case 'enemy':
                    radius = 3
                    borderColor = '#ffffff'
                    borderWidth = 1
                    break
                  case 'building':
                    radius = 4
                    borderColor = '#000000'
                    borderWidth = 2
                    break
                  case 'item':
                    radius = 2
                    borderColor = '#ffffff'
                    borderWidth = 1
                    break
                }
                
                // Draw pip
                ctx.fillStyle = pip.color
                ctx.beginPath()
                
                // Draw different shapes for different types
                if (pip.type === 'building') {
                  // Square for buildings
                  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
                  ctx.strokeStyle = borderColor
                  ctx.lineWidth = borderWidth
                  ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2)
                } else {
                  // Circle for everything else
                  ctx.arc(x, y, radius, 0, 2 * Math.PI)
                  ctx.fill()
                  
                  // Add border for better visibility
                  ctx.strokeStyle = borderColor
                  ctx.lineWidth = borderWidth
                  ctx.stroke()
                }
              }
            })
          }
        }
      }
    }

    const intervalId = setInterval(render, 16) // ~60 FPS
    
    return () => clearInterval(intervalId)
  }, [entityPips, width, height])

  const containerStyle: React.CSSProperties = {
    width: width,
    height: height,
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'rgba(0, 0, 0, 0.8)',
    ...style
  }

  return (
    <div className={`minimap ${className}`} style={containerStyle}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
      <div style={{
        position: 'absolute',
        top: '4px',
        left: '4px',
        fontSize: '10px',
        color: 'rgba(255, 255, 255, 0.8)',
        textShadow: '1px 1px 1px rgba(0, 0, 0, 0.8)',
        pointerEvents: 'none'
      }}>
        Minimap
      </div>
    </div>
  )
}