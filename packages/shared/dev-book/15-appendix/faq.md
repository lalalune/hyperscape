# Frequently Asked Questions

[← Back to Index](../README.md)

---

## General Questions

### What is Hyperscape Shared?

Hyperscape Shared is the core 3D multiplayer game engine that powers the Hyperscape RPG project. It provides Entity Component System architecture, PhysX physics, Three.js rendering, and client-server networking.

---

### Is it free to use?

Yes, Hyperscape Shared is part of the open-source Hyperscape project.

---

### What platforms are supported?

- **Client:** Modern browsers (Chrome, Firefox, Safari, Edge)
- **Server:** Node.js 18+ or Bun runtime
- **Testing:** Headless mode with Playwright

---

## Technical Questions

### Why use TypeScript?

TypeScript provides type safety, better IDE support, and catches errors at compile-time rather than runtime.

---

### Why PhysX over other physics engines?

PhysX is industry-standard, highly performant, has native Node.js support, and provides more features than alternatives like Cannon.js.

---

### Can I use custom 3D models?

Yes! Hyperscape supports GLTF/GLB models and VRM avatars. Load them with:

```typescript
const gltf = await world.loader.loadGLTF('asset://model.glb');
world.stage.scene.add(gltf.scene);
```

---

### How many players can the server handle?

The engine is optimized for 50-100 concurrent players. With proper optimization, you can support more.

---

### Can I use this for non-RPG games?

Yes! While built for RPGs, Hyperscape Shared is a general-purpose 3D multiplayer engine. You can build any type of 3D multiplayer game.

---

## Development Questions

### How do I add a new system?

```typescript
class MySystem extends System {
  init() { /* ... */ }
  update(delta: number) { /* ... */ }
}

world.register('mySystem', MySystem);
```

See [Adding Systems](../11-development/adding-systems.md) for details.

---

### How do I create custom entities?

```typescript
class MyEntity extends Entity {
  async createMesh() { /* ... */ }
  async onInteract(data) { /* ... */ }
}

const entity = new MyEntity(world, config);
await entity.init();
```

See [Adding Entities](../11-development/adding-entities.md) for details.

---

### How do I handle collisions?

Use raycasting or collision events:

```typescript
// Raycast
const hit = world.physics.raycast(origin, direction, maxDistance);

// Collision events
world.on('collision', (data) => {
  console.log('Collision:', data.entityId, data.targetId);
});
```

---

## Performance Questions

### Why is my game running slow?

Common causes:
1. Too many high-poly models
2. No LOD system
3. Shadow quality too high
4. Post-processing enabled on low-end devices

See [Troubleshooting](../02-getting-started/troubleshooting.md) for solutions.

---

### How can I optimize performance?

1. Use LOD for distant objects
2. Reduce shadow quality
3. Use object pooling
4. Enable frustum culling
5. Reduce texture sizes

See [Performance Guidelines](../11-development/debugging.md) for details.

---

## Networking Questions

### How does client-server work?

The server is **authoritative** - it validates all actions and maintains true game state. Clients predict actions for responsiveness and receive corrections from the server.

---

### What if the player has high latency?

Hyperscape uses:
- Client prediction for responsiveness
- Server reconciliation for accuracy
- Interpolation for smooth movement
- Lag compensation for fairness

---

### Can I build a peer-to-peer game?

Hyperscape is designed for client-server architecture. P2P is not currently supported.

---

## Still Have Questions?

- **GitHub Issues:** https://github.com/HyperscapeAI/hyperscape/issues
- **Discord:** Join our community
- **Documentation:** Browse the [full docs](../README.md)

---

[← Back to Index](../README.md) | [← Previous: Glossary](glossary.md) | [Next: Resources →](resources.md)
