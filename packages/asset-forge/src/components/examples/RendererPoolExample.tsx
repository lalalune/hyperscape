import React, { useEffect, useRef } from 'react'
import { AmbientLight, BoxGeometry, Color, DirectionalLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene } from 'three'
import { useRendererPool } from '../../hooks/useRendererPool'

/**
 * Example component demonstrating WebGL Renderer Pool usage
 *
 * This component shows how to:
 * 1. Acquire a renderer from the pool
 * 2. Use it for rendering
 * 3. Automatic cleanup on unmount
 */
export const RendererPoolExample: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Acquire renderer from pool
  const { renderer, isReady } = useRendererPool({
    containerRef,
    antialias: true,
    alpha: true,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
  })

  useEffect(() => {
    if (!renderer || !isReady || !containerRef.current) return

    // Create scene
    const scene = new Scene()
    scene.background = new Color(0x1a1a1a)

    // Create camera
    const camera = new PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 5

    // Add a rotating cube
    const geometry = new BoxGeometry(2, 2, 2)
    const material = new MeshStandardMaterial({
      color: 0x3b82f6,
      metalness: 0.3,
      roughness: 0.7
    })
    const cube = new Mesh(geometry, material)
    scene.add(cube)

    // Add lights
    const ambientLight = new AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    // Animation loop
    let animationId: number

    const animate = () => {
      animationId = requestAnimationFrame(animate)

      cube.rotation.x += 0.01
      cube.rotation.y += 0.01

      renderer.render(scene, camera)
    }

    animate()

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId)

      // Dispose scene resources
      geometry.dispose()
      material.dispose()

      // Renderer is automatically released by useRendererPool
    }
  }, [renderer, isReady])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '400px',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    />
  )
}

/**
 * Multiple viewers example - demonstrates pool sharing
 */
export const MultipleViewersExample: React.FC = () => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
      <RendererPoolExample />
      <RendererPoolExample />
      <RendererPoolExample />
      <RendererPoolExample />
    </div>
  )
}
