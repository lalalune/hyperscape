// Simple test app for verifying Hyperfy functionality
console.log('🎯 Simple Test App starting...')

// Create a simple mesh without complex geometry
const testMesh = app.create('mesh')
testMesh.geometry = 'box'
testMesh.position.set(0, 1, 0)
testMesh.material.color = '#FF0000' // Red for visibility

// Test identification for visual tests
testMesh.userData.testId = 'simple-test'
testMesh.userData.testType = 'TEST_OBJECT'

app.add(testMesh)

// Simple action
const action = app.create('action')
action.label = 'Test Action'
action.distance = 3
action.onTrigger = () => {
  console.log('✅ Test action triggered!')
}

testMesh.add(action)

console.log('✅ Simple Test App loaded successfully')