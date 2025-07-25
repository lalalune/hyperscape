// Minimal working RPG Goblin for testing
console.log('🧌 Working RPG Goblin starting...')

app.configure([
  {
    key: 'goblinName',
    type: 'text',
    label: 'Goblin Name',
    initial: 'Goblin'
  }
])

// Create visual representation
const goblinMesh = app.create('mesh')
goblinMesh.type = 'box'
goblinMesh.scale.set(0.8, 1.2, 0.8)
goblinMesh.position.set(0, 0.6, 0)
goblinMesh.color = 'green'

app.add(goblinMesh)

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.workingRPGGoblin = {
    name: props.goblinName,
    mesh: goblinMesh
  };
}

console.log('✅ Working RPG Goblin created successfully')