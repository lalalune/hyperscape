---
title: Scripts
description: Scripting API resource for Hyperfy v2.
---
import { Aside } from '@astrojs/starlight/components';


## Scripting Interface

To open the in world scripting window, right click on a model to inspect it and click script. Save your scripts with `cmd + s` or `ctrl + s` depending on your OS.

## World Hierarchy

Worlds are made up of the following hierarchy:
```
Worlds contain:
  └─ Entities which include:
      ├─ Players which contain:
      |   └─ Nodes (e.g. avatar, joint)
      └─ Apps  which contain:
          └─ Nodes (e.g. mesh, collider, rigidbody)
```

Certain `entity` and `node` attributes within a world can be accesed from the global world API:

- [world](/ref/world)

## Global Entities

Apps run inside their own secure environment, which allow apps built by many different authors to co-exist in a real-time digital world.

Just as websites run inside a DOM-based environment that provides browser APIs via globals, apps are provided with specific APIs for the global app and player entities:

- [app](/ref/app)
- [props](/ref/props)
- [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [num](/ref/num)
- [Vector3](https://threejs.org/docs/#api/en/math/Vector3)
- [Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
- [Euler](https://threejs.org/docs/#api/en/math/Euler)
- [Matrix4](https://threejs.org/docs/#api/en/math/Matrix4)


## Nodes

Apps are made up of a hierarchy of nodes that you can view and modify within the app runtime using scripts.
Nodes contain certain default attributes that are inherited by all other nodes such as `node.position` or `node.scale`. Information on the standard node attributes can be found in [Node](/ref/node)

Other node attributes are based on common standards in [Three.js](https://threejs.org/) with more information found externally below:


## Entity Nodes

When a model is added to a scene, a [group node](/ref/group) is created containing a collection of nodes which mirrors your gltf model hierarchy. It is important to be mindful of these naming conventions when working on a model in software like Blender so you can access these mesh nodes like:

`app.get(<mesh-node-name>)`

If you are importing a model from someplace like [Sketchfab](https://sketchfab.com/) and you don't know the root model name, you can return it with `const id = app.id`. You can then find the id's of sub meshes by traversing the node hierarchy.

### Creating Nodes

Some nodes can/need to be created using `app.create('<node-name>')`. Information on using each node type and thier attributes can be found below:

**Model**
- [Mesh](/ref/mesh)
- [Material](/ref/material)
- [LOD](/ref/lod)

**Interaction**
- [Action](/ref/action)
- [Collider](/ref/collider)
- [rigidbody](/ref/rigidbody)
- [Controller](/ref/controller)

**UI**
- [UI](/ref/ui)
- [UIText](/ref/ui-text)
- [UIViews](/ref/ui-view)


**Environment**
- [Audio](/ref/audio)
- [Sky](/ref/sky)

**Generic**
- [Group](/ref/group)
- [Node](/ref/node)


## Player Entity

Some nodes are specific to the `player` entity:

- [Avatar](/ref/avatar)



# Overview

Hyperfy is a web-based multiplayer collaborative world engine for building 3D games and experiences accessible in the browser.

## Error Reporting System

Hyperfy includes a comprehensive frontend error reporting system that captures and sends SES (Secure EcmaScript) and other frontend errors to the backend for logging and monitoring.

### Features

- **Comprehensive Error Capture**: Catches JavaScript errors, unhandled promise rejections, and React component errors
- **SES Error Detection**: Specifically identifies and reports SES/lockdown related errors
- **Backend Integration**: Sends all errors to `/api/errors/frontend` endpoint for centralized logging
- **User Context**: Associates errors with user IDs and session information
- **Development Testing**: Includes testing utilities for validating error reporting

### Usage

The error reporting system is automatically initialized when the client starts. No additional setup is required.

#### Manual Error Reporting

```javascript
// Report a custom error
import { errorReporting } from './error-reporting'
errorReporting.reportCustomError('Something went wrong', { context: 'additional info' })
```

#### Testing Error Reporting

In development, you can test the error reporting system using the browser console:

```javascript
// Test all error types
window.testErrorReporting.testAll()

// Test specific error types
window.testErrorReporting.testBasicError()
window.testErrorReporting.testSESError()
window.testErrorReporting.testUnhandledRejection()
```

#### Backend Error Logs

Frontend errors are logged on the backend with the following format:

```
[SES Frontend Error] 2024-01-01T12:00:00.000Z
Error Message: SES lockdown error occurred
Stack Trace: Error: SES lockdown error...
URL: http://localhost:3333
User Agent: Mozilla/5.0...
Additional Context: {...}
```

### System Components

1. **ErrorReportingService** (`error-reporting.ts`): Core service for capturing and sending errors
2. **SESErrorHandler** (`ses-error-handler.ts`): Specialized handler for SES-related errors
3. **ErrorBoundary** (`ErrorBoundary.tsx`): React error boundary component
4. **Backend API** (`/api/errors/frontend`): Endpoint for receiving frontend errors
5. **Testing Utilities** (`test-error-reporting.ts`): Development testing tools
Admins of a world can drag and drop glb models into the world in realtime and move them around etc.
When dropping a glb into the world, it becomes an "app".
Each app is comprised of a glb model, and optional script, and any number of additional config/assets that can be provided through props.
Every single thing in a world is an app.
Each script attached to an app is written in javascript.
Apps all run inside an isolated runtime environment with different globals to the ones web developers generally find when making websites.
Scripts execute on both the server and the clients.
When the server boots up, the app scripts execute first on the server, and then when clients connect the scripts run after they receive the initial snapshot.
When scripts are edited on the client by a builder, the app script changes execute instantly on the client first, and then the server is notified to reboot with the new script.
Each app script has access to all of the nodes that make up the glb model and they can move, clone or remove any part of it using code.
If in blender for example, your mesh is named "Sword" then in a script you can get a handle of this mesh node using `app.get('Sword')`.

## The `world` global

The app runtime exposes a `world` global variable, providing access to info about the world itself or performing world related functions

`world.isServer`
- a boolean that is true if the code currently executing is on the server

`world.isClient`
- a boolean that is true if the code currently executing is on a client

`world.stage.scene.add(node)`
- adds a node into world-space

`world.remove(node)`
- removes a node from world space

`world.attach(node)`
- attaches a node into world-space, maintaining its current world transform

`world.on(event, callback)`
- listens to world events emitted by other apps, allows inter-app communication
- applies only to its own context, eg if running on the server it will only listen to events emitted by other apps on the server

`world.off(event, callback)`
- cancel a world event listener

`world.getTime()`
- returns the number of seconds since the server booted up.
- this is also usable on the client which synchronizes time with the server automatically.

`world.chat(msg, broadcast)`
- posts a message in the local chat, with the option to broadcast to all other clients and the server
- TODO: msg object needs details here

`world.getPlayer(playerId)`
- returns a handle to a player
- if playerId is not specified, it returns the local player if running on a client

`world.getPlayers()`
- returns an array of all players currently in the world

`world.createLayerMask(...layers)`
- create a collision layer mask for raycasts etc
- TODO: provide more details

`world.raycast(origin, direction, maxDistance, layerMask)`
- performs a physics raycast and returns the first hit, if any.
- hit object = { tag: String, playerId: String }

`world.get(key)`
- returns value from key-value storage
- only works on the server

`world.set(key, value)`
- sets a value in key-value storage
- only works on the server

## The `app` global

The app runtime exposes an `app` global variable that provides access to the root app node itself and also a few additional methods for the app itself

`app.instanceId`
- a unique id for an instance of this app

`app.state`
- the state object for this app.
- when clients connect to the world, the current value of `app.state` is sent to the client and available when the client script runs.
- that is all it does, it does not automatically sync one or both ways when changed, but it can be used to keep state up to date as server events are received.

`app.props`
- TODO: need to describe props

`app.on(event, callback)`
- listens to app events from itself in other contexts.
- on the client, this will be called when the server calls `app.send(event, data)`
- on the server, this will be called when a client calls `app.send(event, data)`

`app.off(event, callback)`
- removes a previously bound listener

`app.send(event, data)`
- sends event to the same app running on its opposite context
- if called on the client, it will be sent to the server
- if called on the server, it will be sent to all clients

`app.send(playerId, event, data)`
- same as `app.send` but targets a specific player client
- automatically routes correctly and can be called from any client or the server

`app.emit(event, data)`
- emits an event from this app to the world, for other apps that might be listening
- should generally be namedspaced (eg `mything:myevent`) to avoid inadvertent collisions
- if called on a client, only apps on that client will be able to receive the event
- if called on the server, only apps on that server will be able to receive the event

`app.get(name)`
- returns a specifc node somewhere in the hierarchy
- nodes can be meshes, rigidbodies, colliders, and many more

`app.create(name, data)`
- creates a node such as an action, ui, etc
- nodes can then be added to the world (`world.stage.scene.add(node)`) or the local app space (`app.ad(node)`) or another node (`otherNode.add(node)`)
- TODO: provide more info

`app.control(options)`
- creates a control handle for reading and writing inputs, camera transforms, etc
- TODO: provide more info

`app.configure(fields)`
- exposes prop inputs in the app inspector that allow non-developers to configure your app
- the values of the props are read in-script from the `props` global object
- TODO: explain each field type, when logic, keys etc

## The `node` base class

Every single node in the world (mesh, collider, etc) inherits the node base class and its methods and properties.

`node.id`
- a string id of the node
- this cannot be changed once set, eg a glb will have these that match blender object names, and you can set this once when creating a node with `app.create('mesh', { id: 'myId' })` if needed
- if not provided when creating a node, it will be given a unique one automatically

`node.name`
- the node type, eg `mesh` or `action` or `rigidbody` etc

`node.position`
- a `Vector3` representing the local position of the node

`node.quaternion`
- a `Quaternion` representing the the local quaternion of the node
- changing this automatically syncs with `node.rotation`

`node.rotation`
- a `Euler` representing the the local rotation of the node
- changing this automatically syncs with `node.quaternion`

`node.scale`
- a `Vector3` representing local scale of the node

`node.matrixWorld`
- a `Matrix4` for world transform of the node
- this is automatically updated each frame if the local transform of this or any parents change

`node.active`
- whether the node is active or not
- when not active, it as if its not even in the world, including all of its children

`node.parent`
- the parent node if any

`node.children`
- an array of all child nodes

`node.add(childNode)`
- adds a node as a child of this one

`node.remove(childNode)`
- removes a node from a child of this one

`node.clone(recursive)`
- clones the node so that it can be re-used
- must then be added to the world, app or another node to be active in the world

`node.onPointerEnter`
- can be set to a function to be notified when the player reticle is pointing at this node/mesh etc

`node.onPointerLeave`
- can be set to a function to be notified when the player reticle leaves pointing at this node/mesh etc

`node.onPointerDown`
- can be set to a function to be notified when the player reticle clicks on this node/mesh etc

`node.onPointerUp`
- can be set to a function to be notified when the player reticle released click on this node/mesh etc

`node.cursor`
- changes the cursor in pointer mode when hovering over this node, useful for ui etc eg `pointer`