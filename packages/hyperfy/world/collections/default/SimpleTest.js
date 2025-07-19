// Simple test app to verify basic Hyperfy app structure works

console.log('🧪 Simple test app starting...')

app.configure([
  {
    key: 'testColor',
    type: 'text',
    label: 'Test Color',
    initial: 'red',
    hint: 'Color of the test cube'
  }
])

// Create a simple cube
const testMesh = app.create('mesh')
testMesh.type = 'box'
testMesh.scale.set(1, 1, 1)
testMesh.position.set(0, 1, 0)
testMesh.color = props.testColor

app.add(testMesh)

console.log('✅ Simple test app created successfully')