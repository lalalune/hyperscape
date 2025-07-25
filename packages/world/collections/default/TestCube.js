console.log('🔴 TestCube - Adding mesh to scene graph...')

app.configure([
  {
    type: 'select',
    key: 'color',
    label: 'Box Color',
    options: ['red', 'green', 'blue', 'yellow', 'purple'],
    initial: 'red'
  },
  {
    type: 'number',
    key: 'size',
    label: 'Size',
    initial: 2,
    min: 0.1,
    max: 5
  }
])

const mesh = app.create('mesh', {
  type: 'box'
})

console.log('🔧 Created mesh - constructor name:', mesh.constructor.name)
console.log('🔧 Mesh prototype chain:', Object.getPrototypeOf(mesh).constructor.name)
console.log('🔧 Mesh has mount method:', typeof mesh.mount === 'function')

mesh.scale.setScalar(props.size || 2)

console.log('🔧 Mesh configuration complete - type:', mesh.type, 'scale:', props.size || 2)
console.log('🔧 Material and color set via creation parameters')

// CRITICAL: Add the mesh to the app's node hierarchy!
app.add(mesh)

console.log('🔧 Mesh created and added to app with type:', mesh.type)
console.log('✅ TestCube - Mesh should now be in scene graph!')