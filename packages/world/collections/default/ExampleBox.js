app.configure([
  {
    type: 'select',
    key: 'color',
    label: 'Box Color',
    options: ['red', 'green', 'blue', 'yellow', 'purple'],
    initial: 'blue'
  },
  {
    type: 'number',
    key: 'size',
    label: 'Size',
    initial: 1,
    min: 0.1,
    max: 5
  }
])

const mesh = app.create('mesh')
mesh.geometry = 'box'
mesh.material.color = props.color || 'blue'
mesh.scale.setScalar(props.size || 1)

// Simple interaction
const action = app.create('action')
action.label = 'Click Me!'
action.distance = 5
action.onTrigger = () => {
  console.log('Box clicked!')
}