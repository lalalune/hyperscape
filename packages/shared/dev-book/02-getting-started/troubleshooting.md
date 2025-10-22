# Troubleshooting

[← Back to Index](../README.md)

---

## Common Issues

### Black Screen / Nothing Renders

**Symptoms:** Canvas is black, no 3D content visible

**Solutions:**

1. **Check WebGL Support**
   ```javascript
   // Visit https://get.webgl.org/
   const canvas = document.createElement('canvas');
   const gl = canvas.getContext('webgl2');
   if (!gl) {
     console.error('WebGL 2.0 not supported');
   }
   ```

2. **Verify Camera Position**
   ```typescript
   world.camera.position.set(0, 10, 20);
   world.camera.lookAt(0, 0, 0);
   ```

3. **Add Lighting**
   ```typescript
   const light = new THREE.DirectionalLight(0xffffff, 1);
   light.position.set(10, 10, 10);
   world.stage.scene.add(light);
   ```

---

### Physics Not Working

**Symptoms:** Objects fall through ground, no collisions

**Solutions:**

1. **Verify PhysX Loaded**
   ```typescript
   console.log('PhysX loaded:', world.physics.world !== null);
   ```

2. **Check Colliders**
   ```typescript
   entity.addComponent('collider', {
     shape: 'box',
     size: { x: 1, y: 1, z: 1 }
   });
   ```

---

### Network Connection Failed

**Symptoms:** Cannot connect to server

**Solutions:**

1. **Check Server URL**
   ```typescript
   // Correct
   serverUrl: 'ws://localhost:3000'

   // Wrong
   serverUrl: 'http://localhost:3000'
   ```

2. **Verify Server Running**
   ```bash
   # Start server first
   npm run start:server
   ```

---

### Performance Issues

**Symptoms:** Low FPS, stuttering

**Solutions:**

1. **Reduce Shadow Quality**
   ```typescript
   world.graphics!.shadows = 'low';
   ```

2. **Disable Post-Processing**
   ```typescript
   world.graphics!.postprocessing = false;
   ```

3. **Use LOD**
   ```typescript
   // Add LOD levels to reduce polys at distance
   const lod = new LOD();
   lod.addLevel(highDetail, 0);
   lod.addLevel(lowDetail, 50);
   ```

---

## Getting Help

- **GitHub Issues:** https://github.com/HyperscapeAI/hyperscape/issues
- **Discord:** Join our community
- **Documentation:** Read the [User Guides](../03-user-guides/creating-worlds.md)

---

[← Back to Index](../README.md) | [← Previous: Quick Start](quick-start.md)
