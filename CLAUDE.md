# Hyperfy Testing Framework

`packages/docs/src/content/docs/ref/Group.md`:

```md
---
title: Group
description: A regular old node with no other behavior. Useful for grouping things together under one parent.
---

A regular old node with no other behavior. Useful for grouping things together under one parent.

## Properties

### `.{...Node}`

Inherits all [Node](/ref/Node) properties

```

`packages/docs/src/content/docs/ref/App.md`:

```md
---
title: App
description: Global app variable in Hyperfy v2.
---

The global `app` variable is always available within the app scripting runtime.

## Properties

### `.instanceId`: String

The instance ID of the current app.
Every app has its own unique ID that is shared across all clients and the server.

### `.version`: String

The version of the app instance.
This number is incremented whenever the app is modified which includes but is not limited to updating scripts and models.

### `.state`: Object

A plain old javascript object that you can use to store state in.
The servers state object is sent to all new clients that connect in their initial snapshot, allowing clients to initialize correctly, eg in the right position/mode.

### `.{...Node}`

Inherits all [Node](/ref/Node) properties

## Methods

### `.on(name, callback)`

Subscribes to custom networked app events and engine update events like `update`, `fixedUpdate` and `lateUpdate`.

Custom networked events are received when a different client/server sends an event with `app.send(event, data)`.

IMPORTANT: Only subscribe to update events when they are needed. The engine is optimized to completely skip over large amounts of apps that don't need to receive update events.

### `.off(name, callback)`

Unsubscribes from custom events and update events.

IMPORTANT: Be sure to unsubscribe from update events when they are not needed. The engine is optimized to completely skip over large amounts of apps that don't need to receive update events.

### `app.emit(key, value)`

Emits/signals a key,value to all apps or the world.


### `.send(name, data, skipNetworkId)`

Sends an event across the network.
If the caller is on the client, the event is sent to the server. The third argument `skipNetworkId` is a no-op here.
If the caller is on the server, the event is sent to all clients, with the `skipNetworkId` argument allowing you to skip sending to one specific client.

### `.get(nodeId)`: Node

Finds and returns any node with the matching ID from the model the app is using.
If your model is made with blender, this is the object "name".

NOTE: Blender GLTF exporter renames objects in some cases, eg by removing spaces. Best practice is to simply name everything in UpperCamelCase with no other characters.

### `.create(nodeName)`: Node

Creates and returns a node of the specified name.

#### `.control(options)`: Control

TODO: provides control to a client to respond to inputs and move the camera etc

#### `.configure(fields)`

Configures custom UI for your app. See [Props](/ref/Props) for more info.



```

`packages/docs/src/content/docs/ref/UI-Image.md`:

```md
---
title: UI Image
description: UI Image in a UI.
---

# UIImage

Represents an image inside a UI, similar to an img tag in HTML.

```jsx
const image = app.create('uiimage', {
  src: 'https://example.com/image.png',
  width: 200,
  height: 150,
  objectFit: 'cover',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  borderRadius: 10
});
```

## Properties

### `.display`: String

Determines whether the image is displayed or hidden. Options are flex or none.
Defaults to flex.


### `.src`: String

The URL of the image to display.
Defaults to null.

### `.height`: Number

The height of the image in pixels.
Defaults to null (image’s natural height).

### `.objectFit`: String

How the image should fit within its container. Options are contain, cover, or fill.
Defaults to contain.

### `.backgroundColor`: String

The radius of the border in pixels.
Defaults to 0.

### `.flexDirection`: String

The flex direction for the image container. Options are column, column-reverse, row, or row-reverse.
Inherits from parent UI node by default.

### `.justifyContent`: String

Options: flex-start, flex-end, center.
Inherits from parent UI node by default.

### `.alignItems`: String

Options: flex-start, flex-end, stretch, center, space-between, space-around, space-evenly.
Inherits from parent UI node by default.

### `.flexWrap`: String

Options: no-wrap, wrap.
Inherits from parent UI node by default.

### `.gap`: Number

The gap between child elements in pixels.
Inherits from parent UI node by default.

### `.margin`: Number

The outer margin of the image container in pixels.
Defaults to 0.

### `.padding`: Number

The inner padding of the image container in pixels.
Defaults to 0.

### `.borderWidth`: Number

The width of the border in pixels.
Defaults to 0.

### `.borderColor`: String

The color of the border.
Can be hex (e.g., #000000) or rgba (e.g., rgba(0, 0, 0, 0.5)).
Defaults to null.

---

## Methods

### `.loadImage(src)`: Promise

Loads an image from the specified URL. Returns a promise that resolves when the image is loaded or rejects if loading fails.

```jsx
image.src = 'https://example.com/new-image.png';
```

## Example Usage

Here’s an example of creating a responsive UI with an image that covers its container:

```jsx
// Create a UI node
const ui = app.create('ui', {
  space: 'screen',
  position: [0, 1, 0],
  width: 300,
  height: 200,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  pivot: 'top-left'
});

// Create an image element
const image = app.create('uiimage', {
  src: 'https://example.com/image.png',
  width: 300,
  height: 200,
  objectFit: 'cover',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 10
});

// Add the image to the UI node
ui.add(image);
```

In this example:

- The image is positioned at the top-left of the screen.
- The image covers its container while maintaining its aspect ratio.
- The container has a semi-transparent white background with rounded corners.

You can also make the image configurable using app.configure to allow users to change properties like the source URL or dimensions.

```jsx
// Configure the app with a file input for images
app.configure([
  {
    type: 'file',
    key: 'selectedImage',
    label: 'Upload Image',
    kind: 'texture' // Specify the kind as 'image' to restrict file types
  }
]);

// Create the image element using the selected file
const image = app.create('uiimage', {
  src: props.selectedImage?.url, // Use the URL of the selected image
  width: 300,
  height: 200,
  objectFit: 'cover',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 10
});
```
```

`packages/docs/src/content/docs/ref/Player.md`:

```md
---
title: Player
description: Represents a player. An instance of Player can be retrived from events or via World.getPlayer
---

Represents a player. An instance of Player can be retrived via [World.getPlayer](/ref/world)

## Properties

### `.id`: String

The players unique ID. This is always the same for the same player, even when they leave and come back.

### `.name`: String

The players name.

### `.local`: Boolean

Whether the player is local to this client.

### `.admin`: Boolean

Whether the player is an admin in this world.

### `.position`: Vector3

The players position in the world.

### `.quaternion`: Quaternion

The players rotation in the world.

### `.rotation`: Euler

The players rotation in the world.

## Methods

### `.teleport(position, rotationY)`

Teleports the player instantly to the new position. The `rotationY` value is in radians, and if omitted the player will continue facing their current direction.

### `.getBoneTransform(boneName)`: Matrix4

Returns a matrix of the bone transform in world space.

See [Avatar](/ref/avatar) for full details.

### `.damage(amount)`

Removes health from the player. Health cannot go below zero.

### `.heal(amount)`

Adds health to the player. Health cannot go above 100.

### `.applyEffect({ anchor, emote, snare, freeze, turn, duration, cancellable, onEnd })`

Applies an effect to the player. If the player already has an effect, it is replaced. If this function is called with `null` it removes any active effect.

All options are optional.

**anchor**: an [Anchor](/ref/anchor) to attach the player to

**emote**: a url to an emote to play while this effect is active

**snare**: a multiplier from 0 to 1 that reduces movement speed, where zero means no snaring and one means entirely snared. when snared, players can still turn and attempt to move.

**freeze**: when true, the player is frozen in place and all movement keys are ignored.

**turn**: when true, the player will continually face the direction the camera is looking in.

**duration**: how long this effect should last in seconds.

**cancellable**: whether any movement keys will cancel the effect. if enabled, freeze is ignored.

**onEnd**: a function that should be called either at the end of the `duration` or when the player moves if `cancellable`.





```

`packages/docs/src/content/docs/ref/Collider.mdx`:

```mdx
---
title: Collider
description: A collider connects to its parent rigidbody to simulate under physics.
---
import { Aside } from '@astrojs/starlight/components';

A collider connects to its parent rigidbody to simulate under physics.

<Aside>Setting/modifying the geometry are not currently supported, and only be configured within a GLTF (eg via blender).</Aside>


## Properties

### `.type`: String

The type of collider, must be `box`, `sphere` or `geometry`. Defaults to `box`.

### `.setSize(width, height, depth)`

When type is `box`, sets the size of the box. Defaults to `1, 1, 1`.

### `.radius`: Number

When type is `sphere`, sets the radius of the sphere. Defaults to `0.5`.

### `.convex`: Boolean

Whether the geometry should be considered "convex". If disabled, the mesh will act as a trimesh. Defaults to `false`

Convex meshes are not only more performant, but also allow two convex dynamic rigidbodies to collide. This is the same behavior that engines like Unity use.

### `.trigger`: Boolean

Whether the collider is a trigger. Defaults to `false`.

A trigger will not collide with anything, and instead will trigger the `onTriggerEnter` and `onTriggerLeave` functions on the parent rigidbody.

NOTE: Triggers are forced to act like convex shapes. This is a limitation in the physics engine.

### `.{...Node}`

Inherits all [Node](/ref/node) properties

```

`packages/docs/src/content/docs/ref/Video.md`:

```md
---
title: Video
description: Renders a video into the world, either on a simple plane or onto geometry.

---


Renders a video into the world, either on a simple plane or onto geometry.

## Properties

### `.src`: String

A url to a video file, or an asset url from a video prop.

Currently only `mp4` and `m3u8` (HLS streams) are supported.

### `.linked`: Number|String

By default, videos are not linked and each node spawns a new video player with its own state and control.

If you plan to show a video multiple times throughout the world and require the state and controls to be synchronized, you can set this property to `true` or use a string ID to link video nodes together. This is allows you to have potentially hundreds of instances of a single video playing within the world all with individual audio emitters with very little overhead.

### `.loop`: Boolean

Whether the video should loop. Defaults to `false`.

### `.visible`: Boolean

Whether the video should be displayed. Defaults to `true`.

This can be used if you just want to play audio headlessly with more control over the audio position.

### `.color`: String

The color of the mesh before the video is playing. Defaults to `black`.

### `.lit`: Boolean

Whether the mesh material is lit (reacts to lighting) or not. Defaults to `false`.

### `.doubleside`: Boolean

Whether the video should play on both sides of the plane. Does not apply to custom geometry. Defaults to `true`.

### `.castShadow`: Boolean

Whether the mesh should cast a shadow. Defaults to `false`.

### `.receiveShadow`: Boolean

Whether the video should receive shadows. Defaults to `false`.

### `.aspect`: Number

The aspect ratio.

When using a video plane (eg not using the `.geometry` property) before the video loads this aspect ratio will be used to calculate any `width` or `height` values that are set to null in order to maintain the correct pre-video aspect ratio of the plane. Once the video is playing the video's actual aspect ratio will take over and re-calculate any missing `width` or `height` values set to null and resize itself to maintain the videos aspect ratio.

When using custom geometry, you should set this to the physical/visual aspect ratio of the geometry you are projecting onto. If your geometry is a curved 16:9 aspect ratio screen, you would set this value to `16 / 9` or `1.777`. If you are making a 360 sphere your aspect ratio should be `2 / 1` as most 360 videos use an aspect ratio of 2:1

This may be slightly confusing but when set up correctly it allows you to swap and play any video with any dimensions and it will display correctly without stretching or distortion.

NOTE: UV's for custom geometry should generally stretch to take up the entire 0,0 -> 1,1 UV texture area, we then use your provided `aspect` value to scale and offset the video.

### `.fit`: Enum("none", "contain", "cover")

The resize strategy for fitting the video onto its surface. `contain` will shrink the video until it is entirely visible. `cover` will expand the video until it covers the entire surface. `none` will apply no logic and preserve existing UVs.

Defaults to `contain`.

### `.width`: Number|null

The fixed width of the plane when not using a custom geometry. Can be set to `null` to be automatic. When automatic, the width will match the `.ratio` value until the video begins playback and will then resize to match the video dimensions. Defaults to `null`.

### `.height`: Number|null

The fixed height of the plane when not using a custom geometry. Can be set to `null` to be automatic. When automatic, the height will match the `.ratio` value until the video begins playback and will then resize to match the video dimensions. Defaults to `null`.

### `.geometry`: Geometry

The custom geometry to use instead of a plane. Geometry can be extracted from a `Mesh` node's `.geometry` property.

### `.volume`: Number

The volume of the videos audio. Defaults to `1`.

### `.group`: String

The audio group this music belongs to. Players can adjust the volume of these groups individually. Must be `music` or `sfx` (`voice` not allowed). Defaults to `music`.

### `.spatial`: Boolean

Whether music should be played spatially and heard by players nearby. Defaults to `true`.

### `.distanceModel`: Enum('linear', 'inverse', 'expontential')

When spatial is enabled, the distance model to use. Defaults to `inverse`.

### `.refDistance`: Number

When spatial is enabled, the reference distance to use. Defaults to `1`.

### `.maxDistance`: Number

When spatial is enabled, the max distance to use. Defaults to `40`.

### `.rolloffFactor`: Number

When spatial is enabled, the rolloff factor to use. Defaults to `3`.

### `.coneInnerAngle`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `360`.

### `.coneOuterAngle`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `360`.

### `.coneOuterGain`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `0`.

### `.isPlaying`: Boolean

Whether the video is currently playing. Read-only.

### `.currentTime`: Number

The current time of the video. Can be used to read and update the current time of the video.

### `.{...Node}`

Inherits all [Node](/ref/node) properties

## Methods

### `.play()`

Plays the audio.

### `.pause()`

Pauses the audio, retaining the current time.

### `.stop()`

Stops the audio and resets the time back to zero.
```

`packages/docs/src/content/docs/ref/index.mdx`:

```mdx
---
title: Nodes
description: Docs for Nodes in Hyperfy v2.
---
import { Aside } from '@astrojs/starlight/components';
import { FileTree } from '@astrojs/starlight/components';

<FileTree>

- docs
  - ref
    - [Action.md](/ref/action/)
    - [Anchor.md](/ref/anchor)
    - [App.md](/ref/app)
    - [Audio.md](/ref/audio)
    - [Avatar.md](/ref/avatar)
    - [Collider.md](/ref/collider)
    - [Group.md](/ref/group)
    - [LOD.md](/ref/lod)
    - [Material.md](/ref/material)
    - [Mesh.md](/ref/mesh)
    - [Node.md](/ref/node)
    - [Num.md](/ref/num)
    - [Player.md](/ref/player)
    - [Props.md](/ref/props)
    - [rigidbody.md](/ref/rigidBody)
    - [UI.md](/ref/ui)
    - [UIText.md](/ref/ui-text)
    - [UIView.md](/ref/ui-view)
    - [UIImage.md](/ref/ui-image)
    - [World.md](/ref/world)


</FileTree>


<Aside type="caution">
From [17 Mar 25](https://github.com/hyperfy-xyz/hyperfy/tree/main/docs)  - things move fast - may change from in-alpha
</Aside>


### [Action](/ref/action)

An action is something people can interact with in the world.

---

### [Anchor](/ref/anchor)

An anchor can be used to attach players to them, eg for seating or vehicles.

---

### [App](/ref/app)
Global app variable in Hyperfy v2.

---


### [Audio](/ref/audio)
Represents a single audio clip that can be played in the world.

---

### [Avatar](/ref/avatar)
Renders a VRM avatar

---

### [Collider](/ref/collider)
A collider connects to its parent rigidbody to simulate under physics.

---

### [Group](/ref/group)
A regular old node with no other behavior. Useful for grouping things together underone parent.

---

### [LOD](/ref/lod)
A LOD can hold multiple child nodes and automatically activate/deactivate them based on their distance from the camera.

---

### [Material](/ref/material)
A material on a Mesh node.

---

### [Mesh](/ref/mesh)
Represents a mesh to be rendered.

---

### [Node](/ref/node)
The base class for all other nodes.

---

### [Num](/ref/num)
Global num method, to generate random numbers replace Math.random()

---

### [Props](/ref/props)
Apps can expose a list of custom UI fields allowing non-technical people to configure or change the way your apps work.

---

### [Player](/ref/player)
Represents a player. An instance of Player can be retrived from events or via World.getPlayer

---

### [RigidBody](/ref/rigidBody)
A rigidbody that has colliders as children will act under physics.

---

### [UI](/ref/ui)
Displays a UI plane in-world

---

### [UIText](/ref/ui-text)
Represents text inside a UI.

---

### [UIView](/ref/ui-view)
Represents a single view inside a UI, similar to a `div`.

---

### [UIImage](/ref/ui-image)

An image in a UI.

---

### [World](/ref/world)
The global `world` variable is always available within the app scripting runtime.

---
```

`packages/docs/src/content/docs/ref/rigid-body.mdx`:

```mdx
---
title: rigidbody
description: A rigidbody that has colliders as children will act under physics.
---
import { Aside } from '@astrojs/starlight/components';

A rigidbody that has colliders as children will act under physics.

## Properties

### `.type`: String

The type of rigidbody, either `static`, `kinematic` or `dynamic`. Defaults to `static`.

NOTE: if you plan to move the rigidbody with code without being dynamic, use `kinematic` for performance reasons.

### `.onContactStart`: Function

The function to call when a child collider generates contacts with another rigidbody.

### `.onContactEnd`: Function

The function to call when a child collider ends contacts with another rigidbody.

### `.onTriggerEnter`: Function

The function to call when a child trigger collider is entered.

### `.onTriggerLeave`: Function

The function to call when a child trigger collider is left.

### `.{...Node}`

Inherits all [Node](/ref/Node) properties

```

`packages/docs/src/content/docs/ref/Node.md`:

```md
---
title: Node
description: The base class for all other nodes.
---


The base class for all other nodes.

## Properties

### `.id`: String

The ID of the node. This is auto generated when creating nodes via script. For GLTF models converted to nodes, it uses the same object name you would see in blender.

NOTE: Blender GLTF exporter does rename objects in some cases, eg by removing spaces. Best practice is to simply name everything in UpperCamelCase with no other characters.

### `.position`: Vector3

The local position of the node.

### `.quaternion`: Quaternion

The local quaternion rotation of the node. Updating this automatically updates the `rotation` property.

### `.rotation`: Euler

The local euler rotation of the node. Updating this automatically updates the `quaternion` property.

### `.scale`: Vector3

The local scale of the node.

### `.matrixWorld`: Matrix4

The world matrix of this node in global space.

### `.parent`: Node

The parent node, if any.

### `.children`: [Node]

The child nodes.

## Methods

### `.add(otherNode)`: Self

Adds `otherNode` as a child of this node.

### `.remove(otherNode)`: Self

Removes `otherNode` if it is a child of this node.

### `.traverse(callback)`

Traverses this and all descendents calling `callback` with the node in the first argument.





```

`packages/docs/src/content/docs/ref/Audio.md`:

```md
---
title: Audio
description: Represents a single audio clip that can be played in the world.
---

Represents a single audio clip that can be played in the world.

# Audio

Represents a single audio clip that can be played in the world.

## Properties

### `.src`: String

An absolute url to an audio file, or an asset url from an audio file embedded in the app.

Currently only `mp3` files are supported.

### `.volume`: Number

The audio volume. Defaults to `1`.

### `.loop`: Boolean

Whether the audio should loop. Defaults to `false`.

### `.group`: Enum('music', 'sfx')

The type of audio being played. Choose `music` for ambient sounds or live event music etc. Choose `sfx` for short sound effects that happen throughout the world.

Users are able to adjust the global audio volume for these groups independently.

Defaults to `music`.

### `.spatial`: Boolean

Whether music should be played spatially and heard by people nearby. Defaults to `true`.

### `.distanceModel`: Enum('linear', 'inverse', 'expontential')

When spatial is enabled, the distance model to use. Defaults to `inverse`.

### `.refDistance`: Number

When spatial is enabled, the reference distance to use. Defaults to `1`.

### `.maxDistance`: Number

When spatial is enabled, the max distance to use. Defaults to `40`.

### `.rolloffFactor`: Number

When spatial is enabled, the rolloff factor to use. Defaults to `3`.

### `.coneInnerAngle`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `360`.

### `.coneOuterAngle`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `360`.

### `.coneOuterGain`: Number

When spatial is enabled, the cone inner angle to use. Defaults to `0`.

### `.currentTime`: Number

Gets and sets the current playback time, in seconds.

### `.{...Node}`

Inherits all [Node](/ref/node) properties

## Methods

### `.play()`

Plays the audio.

NOTE: If no click gesture has ever happened within the world, playback won't begin until it has.

### `.pause()`

Pauses the audio, retaining the current time.

### `.stop()`

Stops the audio and resets the time back to zero.
```

`packages/docs/src/content/docs/ref/LOD.md`:

```md
---
title: LOD
description: A LOD can hold multiple child nodes and automatically activate/deactivate them based on their distance from the camera.
---

A LOD can hold multiple child nodes and automatically activate/deactivate them based on their distance from the camera.

## Properties

### `.{...Node}`

Inherits all [Node](/ref/Node) properties

## Methods

### `.insert(node, maxDistance)`

Adds `node` as a child of this node and also registers it to be activated/deactivated based on the `maxDistance` value.


```

`packages/docs/src/content/docs/ref/Props.mdx`:

```mdx
---
title: Props
description: Apps can expose a list of custom UI fields allowing non-technical people to configure or change the way your apps work.
---

import { Aside } from '@astrojs/starlight/components';


Apps can expose a list of custom UI fields allowing non-technical people to configure or change the way your apps work.


## Configure

To generate custom UI for your app, configure the fields at the top of your app's script like this:

```jsx
app.configure([
  {
    key: 'name',
    type: 'text',
    label: 'Name',
  }
])
```

The example above will create a text input for you to enter a name.

## Props

Apps have a global `props` variable for you to read back the values entered in custom fields.

```jsx
props.name
```

## Fields

### Text

A text input

```jsx
{
  type: 'text',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  placeholder: String,   // an optional placeholder displayed inside the input
  initial: String,       // the initial value to set if not configured
}
```

### Textarea

A multi-line textarea input

```jsx
{
  type: 'textarea',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  placeholder: String,   // an optional placeholder displayed inside the input
  initial: String,       // the initial value to set if not configured
}
```

### Number

A number input. Also supports math entry and up/down stepping.

```jsx
{
  type: 'number',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  dp: Number,            // the number of decimal places allowed (default = 0)
  min: Number,           // the minimum value allowed (default = -Infinity)
  max: Number,           // the maximum value allowed (default = Infinity)
  step: Number,          // the amount incremented/decrement when pressing up/down arrows (default = 1)
  initial: Number,       // the initial value to set if not configured (default = 0)
}
```

### Range

A range slider input

```jsx
{
  type: 'range',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the slider
  min: Number,           // the minimum value allowed (default = 0)
  max: Number,           // the maximum value allowed (default = 1)
  step: Number,          // the step amount when sliding (default= 0.05)
  initial: Number,       // the initial value to set if not configured (default = 0)
}
```

### Toggle

A boolean toggle field

```jsx
{
  type: 'toggle',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  trueLabel: String,     // optional, defaults to "Yes"
  falseLabel: String,    // optional, defaults to "No"
  initial: String,       // the initial value to set if not configured
}
```

### Switch

A switch field with many options

```jsx
{
  type: 'switch',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  options: [
    {
      label: String,     // the label to show on this switch item
      value: String,     // the value to set on the props when selected
    }
  ],
  initial: String,       // the initial value to set if not configured
}
```

### File

A file field for selecting and uploading additional assets that can be used by your app.

```jsx
{
  type: 'file',
  key: String,           // the key on `props` to set this value
  label: String,         // the label for the text input
  kind: String,          // the kind of file, must be one of: avatar, emote, model, texture, hdr, audio
}
```

Note that the value set on props is an object that looks like this:

```jsx
{
  type: String,         // the type of file (avatar, emote, model, texture, hdr, audio)
  name: String,         // the original files name
  url: String,          // the url to the file
}
```

The type of file you collect depends on how you would use it. For example you can use audio files with an audio node:

```jsx
const audio = app.create('audio', {
  src: props.audio?.url
})
audio.play()
```

### Button

Displays a button that when clicked, executes something in the running app.

```jsx
{
  type: 'button',
  key: String,           // a unique `key` for this button
  label: String,         // the label for the button
  onClick: Function,
}
```
```

`packages/docs/src/content/docs/ref/Anchor.md`:

```md
---
title: Anchor
description: An anchor can be used to attach players to them, eg for seating or vehicles.
---


For the most part, an anchor acts just like a group node.
But more importantly they can be used to attach players to them, eg for seating or vehicles.

When creating an anchor, be sure to give it a unique ID within your app to ensure that every client has the same ID for the player to be anchored to:

```jsx
const seat = app.create('anchor', { id: 'seat' })
car.add(seat)

// later...
player.setEffect({ anchor: seat })
```

For more information about effects, see [Player.setEffect](/ref/player).

## Properties

### `.{...Node}`

Inherits all [Node](/ref/node) properties


```

`packages/docs/src/content/docs/ref/Material.md`:

```md
---
title: Material
description: A material on a Mesh node.
---

A material on a [Mesh](/ref/Mesh) node.

## Properties

### `.textureX`: Number

The offset of the texture on the `x` axis. Useful for UV scrolling.

### `.textureY`: Number

The offset of the texture on the `y` axis. Useful for UV scrolling.

### `.emissiveIntensity`: Number

The emissive intensity of the material. Values greater than `1` will activate HDR Bloom, as long as the emissive color is not black.
```

`packages/docs/src/content/docs/ref/Mesh.mdx`:

```mdx
---
title: Mesh
description: Represents a mesh to be rendered.
---
import { Aside } from '@astrojs/starlight/components';

Represents a mesh to be rendered.
Internally the mesh is automatically instanced for performance.

<Aside>Setting/modifying the geometry or materials are not currently supported, and only be configured within a GLTF (eg via blender).</Aside>

## Properties

### `.castShadow`: Boolean

Whether this mesh should cast a shadow. Defaults to `true`.

### `.receiveShadow`: Boolean

Whether this mesh should receive a shadow. Defaults to `true`.

### `.{...Node}`

Inherits all [Node](/ref/node) properties

```

`packages/docs/src/content/docs/ref/World.md`:

```md
---
title: World
description: The global `world` variable is always available within the app scripting runtime.
---


The global `world` variable is always available within the app scripting runtime.


### `.networkId`: String

A unique ID for the current server or client.

### `.isServer`: Boolean

Whether the script is currently executing on the server.

### `.isClient`: Boolean

Whether the script is currently executing on the client.

### `.add(node)`

Adds a node into world-space, outside of the apps local hierarchy.

### `.remove(node)`

Removes a node from world-space, outside of the apps local hierarchy.

### `.attach(node)`

Adds a node into world-space, maintaining its current world transform.

### `.on(event, callback)`

Subscribes to world events.
Currently only `enter` and `leave` are available which let you know when a player enters or leaves the world.

### `.off(event, callback)`

Unsubscribes from world events.

### `.raycast(origin: Vector3, direction: Vector3, maxDistance: ?Number, layerMask: ?Number)`

Raycasts the physics scene.
If `maxDistance` is not specified, max distance is infinite.
If `layerMask` is not specified, it will hit anything.

### `.createLayerMask(...groups)`

Creates a bitmask to be used in `world.raycast()`.
Currently the only groups available are `environment` and `player`.

### `.getPlayer(playerId)`: Player

Returns a player. If no `playerId` is provided it returns the local player.

### `.getPlayers()`: [...Player]

Returns an array of all players.

```

`packages/docs/src/content/docs/ref/Avatar.md`:

```md
---
title: Avatar
description: Renders a VRM avatar
---

Renders a VRM avatar

```jsx
const src = props.avatar?.url
const emote = props.emote?.url
const avatar = app.create('avatar', { src, emote })
app.add(avatar)
```

## Properties

### `.src`: String

An asset url (eg from props) or an absolute URL to a `.vrm` file.

### `.emote`: String

An emote url (eg from props) or an absolute URL to a `.glb` file with an emote animation.

## Methods

### `.getHeight()`: Number

Returns the height of the avatar in meters. This might be `null` if the avatar hasn't loaded yet. Read-only.

### `.getBoneTransform(boneName)`: Matrix4

Returns a matrix of the bone transform in world space.

```jsx
const matrix = avatar.getBoneTransform('rightHand')
weapon.position.setFromMatrixPosition(matrix)
weapon.quaternion.setFromRotationMatrix(matrix)
```

Note that VRM avatars have required and optional bones, and in some cases incuding while avatars are loading this method may return null.

The VRM spec defines the following bones as required:

```
hips, spine, chest, neck, head, leftShoulder, leftUpperArm, leftLowerArm, leftHand, rightShoulder, rightUpperArm, rightLowerArm, rightHand, leftUpperLeg, leftLowerLeg, leftFoot, leftToes, rightUpperLeg, rightLowerLeg, rightFoot, rightToes
```

### `.{...Node}`

Inherits all [Node](/ref/node) properties

```

`packages/docs/src/content/docs/ref/Action.md`:

```md
---
title: Action
description: An action is something people can interact with in the world. (v2)
---

An action is something people can interact with in the world.

## Properties

### `.label`: String

The label shown to the user when they are nearby. Defaults to `Interact`.

### `.distance`: Number

The distance in meters that the action should be displayed. The engine will only ever show this if they are nearby AND there is no other action that is closer. Defaults to `3`.

### `.duration`: Number

How long the player must hold down the interact button to trigger it, in seconds. Defaults to `0.5`

### `.onStart`: Function

The function to call when the interact button is first pressed.

### `.onTrigger`: Function

The function to call when the interact button has been held down for the full `duration`.

### `.onCancel`: Function

The function call if the interact button is released before the full `duration`.

### `.{...Node}`

Inherits all [Node](/ref/node) properties

```

`packages/docs/src/content/docs/ref/UI-View.md`:

```md
---
title: UIView
description: Represents a single view inside a UI, similar to a `div`.
---

Represents a single view inside a UI, similar to a `div`.


```jsx
const view = app.create('uiview')
view.backgroundColor = 'rgba(0, 0, 0, 0.5)'
```

## Properties

### `.display`: String

Either `none` or `flex`.
Defaults to `flex`.

### `.width`: Number

The width of the view in pixels. Defaults to `100`.

### `.height`: Number

The height of the view in pixels. Defaults to `100`.

### `.backgroundColor`: String

The background color of the view.
Can be hex (eg `#000000`) or rgba (eg `rgba(0, 0, 0, 0.5)`).
Defaults to `null`.

### `.borderWidth`: Number

The width of the border in pixels.

### `.borderColor`: String

The color of the border.

### `.borderRadius`: Number

The radius of the border in pixels.

### `.margin`: Number

The outer margin of the view in pixels.
Defaults to `0`.

### `.padding`: Number

The inner padding of the view in pixels.
Defaults to `0`.

### `.flexDirection`: String

The flex direction. `column`, `column-reverse`, `row` or `row-reverse`.
Defaults to `column`.

### `.justifyContent`: String

Options: `flex-start`, `flex-end`, `center`.
Defaults to `flex-start`.

### `.alignItems`: String

Options: `stretch`, `flex-start`, `flex-end`, `center`, `baseline`.
Defaults to `stretch`.

### `.alignContent`: String

Options: `flex-start`, `flex-end`, `stretch`, `center`, `space-between`, `space-around`, `space-evenly`.
Defaults to `flex-start`.

### `.flexBasis`: Number

Defaults to `null`.

### `.flexGrow`: Number

Defaults to `null`.

### `.flexShrink`: Number

Defaults to `null`.

### `.flexWrap`: String

Options: `no-wrap`, `wrap`.
Defaults to `no-wrap`.

### `.gap`: Number

Defaults to `0`.

### `.{...Node}`

Inherits all [Node](/ref/node) properties

```

`packages/docs/src/content/docs/ref/UI-Text.md`:

```md
---
title: UIText
description: Represents text inside a UI.
---

Represents text inside a UI.

```jsx
const text = app.create('uitext')
text.value = 'Hello world'
```

## Properties

### `.display`: String

Either `none` or `flex`.
Defaults to `flex`.

### `.backgroundColor`: String

The background color of the view.
Can be hex (eg `#000000`) or rgba (eg `rgba(0, 0, 0, 0.5)`).
Defaults to `null`.

### `.borderRadius`: Number

The radius of the border in pixels.

### `.margin`: Number

The outer margin of the view in pixels.
Defaults to `0`.

### `.padding`: Number

The inner padding of the view in pixels.
Defaults to `0`.

### `.value`: String

The text to display.

### `.fontSize`: Number

The font size in pixels.
Defauls to `16`.

### `.color`: Number

The font color.
Defauls to `#000000`.

### `.lineHeight`: Number

The line height.
Defaults to `1.2`.

### `.textAlign`: String

Options: `left`, `center`, `right`.
Defaults to `left`.

### `.fontFamily`: String

Defaults to `Rubik`.

### `.fontWeight`: Number

Defaults to `normal`, can also be a number like `100` or string like `bold`.

### `.{...Node}`

Inherits all [Node](/ref/Node) properties

```

`packages/docs/src/content/docs/ref/Num.md`:

```md
---
title: Num
description: Global num method, to generate random numbers replace Math.random()
---

This is a global method that can be used to generate random numbers, since `Math.random()` is not allowed inside the app script runtime.

```sh frame="none"
/**
 * function num(min, max, dp=0)
 */

// random integer between 0 and 10
num(0, 10)

// random float between 100 and 1000 with 2 decimal places
num(100, 1000, 2)
```


```

`packages/docs/src/content/docs/ref/UI.md`:

```md
---
title: UI
description: Displays a UI plane in-world
---

Displays a UI plane in-world

```jsx
const ui = app.create('ui')
ui.backgroundColor = 'rgba(0, 0, 0, 0.5)'
```

## Properties

### `.space`: String

Whether this UI should be rendered in `world` space or `screen` space.
When `world`, a plane geometry is physically placed in the world.
When `screen`, the canvas is drawn directly on the screen.
Defaults to `world`.

NOTE: when using `screen`, the `.position` value now represents a ratio from 0 to 1 on each axis. For example `position.x = 1` is the far right of the screen and `position.x = 0` is the far left. Use this in combination with the `pivot` and `offset` values.

```jsx
/**
 * Example:
 * The following screen-space UI is rendered in the top left of the
 * screen, 20px away from both edges.
*/
const ui = app.create('ui', {
  space: 'screen',
  pivot: 'top-right',
  position: [1, 0, 0] // far right
  offset: [-20, 20, 0] // 20px left, 20px down
})
```

### `.width`: Number

The width of the UI canvas in pixels. Defaults to `100`.

### `.height`: Number

The height of the UI canvas in pixels. Defaults to `100`.

### `.size`: Number

This value converts pixels to meters.
For example if you set `width = 100` and `size = 0.01` your UI will have a width of one meter.
This allows you to build UI while thinking in pixels instead of meters, and makes it easier to resize things later.
Defaults to `0.01`.

### `.lit`: Boolean

Whether the canvas is affected by lighting. Defaults to `false`.

### `.doubleside`: Boolean

Whether the canvas is doublesided. Defaults to `false`.

### `.billboard`: String

Makes the UI face the camera. Can be `none`, `full` or `y`. Default to `none`.

### `.pivot`: String

Determines where the "center" of the UI is.
Options are: `top-left`, `top-center`, `top-right`, `center-left`, `center`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`.
Defaults to `center`.

### `.offset`: Vector3

Only applicable when using screen-space.
The offset in pixels applied after the `position` value.

### `.pointerEvents`: Boolean

Whether the UI should receive or ignore pointer events. Defaults to `true`.
If you are building informational screen-space UI that does not need to respond to pointer events, this should be set to `false` for an improved user experience.

### `.backgroundColor`: String

The background color of the UI.
Can be hex (eg `#000000`) or rgba (eg `rgba(0, 0, 0, 0.5)`).
Defaults to `null`.

### `.borderWidth`: Number

The width of the border in pixels.

### `.borderColor`: String

The color of the border.

### `.borderRadius`: Number

The radius of the border in pixels.

### `.padding`: Number

The inner padding of the UI in pixels.
Defaults to `0`.

### `.flexDirection`: String

The flex direction. `column`, `column-reverse`, `row` or `row-reverse`.
Defaults to `column`.

### `.justifyContent`: String

Options: `flex-start`, `flex-end`, `center`.
Defaults to `flex-start`.

### `.alignItems`: String

Options: `stretch`, `flex-start`, `flex-end`, `center`, `baseline`.
Defaults to `stretch`.

### `.alignContent`: String

Options: `flex-start`, `flex-end`, `stretch`, `center`, `space-between`, `space-around`, `space-evenly`.
Defaults to `flex-start`.

### `.flexWrap`: String

Options: `no-wrap`, `wrap`.
Defaults to `no-wrap`.

### `.gap`: Number

Defaults to `0`.

### `.{...Node}`

Inherits all [Node](/ref/node) properties

```

## Production Testing Setup

Hyperfy includes a comprehensive visual testing framework located at `scripts/test-framework.mjs` that tests:

1. **Startup Testing**: Verifies server loads without critical errors
2. **Rendering Testing**: Confirms WebGL canvas is rendering properly  
3. **App Loading Testing**: Validates that .hyp apps initialize correctly
4. **Combat Testing**: Tests game mechanics and interactions

### Running Tests

```bash
# Run all tests (headless)
npm run test:hyperfy

# Run tests with visible browser (for debugging)
npm run test:hyperfy:headed

# Run tests with verbose logging
npm run test:hyperfy:verbose
```

### Test Requirements

- Server must be running on localhost:3333 before running tests
- Tests use real Playwright browser automation (no mocks)
- Visual verification through canvas analysis and pixel detection
- Console message monitoring for app initialization
- Game state verification through window globals

## Combat System Architecture

### Click-to-Attack Implementation

The combat system uses click-to-attack mechanics with automatic movement.

### Visual Combat Feedback

- Health bars above entities with color-coded states
- Console logging for all combat actions
- Chat system integration for damage messages
- Respawn mechanics with 30-second timer

### Testing Combat

The testing framework includes combat verification:
- Triggers attacks via `window.rpgGoblin.attack(mockPlayer)`
- Monitors console messages for combat events
- Verifies damage calculations and health updates

# RuneScape-Inspired MVP Game Design Document

## 1. Game Overview

### Core Concept
A simplified MVP version of RuneScape built as a self-contained package using Hyperfy's Entity Component System and multiplayer architecture. The game features classic MMORPG mechanics including combat, skills, resource gathering, and progression in a persistent 3D world.

### Key Features
- Grid-based world with height-mapped terrain
- Real-time multiplayer gameplay
- Skill-based progression system
- Resource gathering and crafting
- PvE combat with loot drops
- Banking and inventory management
- Support for both human players and AI agents

### Target Experience
Players start with minimal equipment and must progress through combat and resource gathering to acquire better gear and increase their skills. The game emphasizes gradual progression and resource management in a shared persistent world.

---

## 2. World Design

### World Structure
- **Grid System**: World divided into discrete grid cells
- **Height Map**: Vertex-colored terrain with PhysX collision
- **Shared World**: Single persistent world for all players
- **No Occlusions**: Entirely height-map based with no overhangs

### Biome Types
Various biomes with appropriate resources and mob spawns:
- **Mistwood Valley**: Foggy forests with goblin camps
- **Goblin Wastes**: Barren lands dominated by goblin tribes
- **Darkwood Forest**: Dense, shadowy woods hiding dark warriors
- **Northern Reaches**: Frozen tundra with ice caves
- **Blasted Lands**: Desolate areas corrupted by dark magic
- **Lakes**: Fishing spots along shorelines
- **Plains**: General purpose areas with roads and camps

### Difficulty Zones
Four difficulty levels distributed across the map:
- **Level 0**: Starter towns (safe zones)
- **Level 1**: Low-level mob areas (Goblins, Bandits, Barbarians)
- **Level 2**: Intermediate mob areas (Hobgoblins, Guards, Dark Warriors)
- **Level 3**: High-level mob areas (Black Knights, Ice Warriors, Dark Rangers)

### Starter Towns
Multiple starter towns with:
- **Bank**: Item storage facility
- **General Store**: Basic equipment vendor
- **Safe Zone**: No hostile mobs
- **Random Spawn**: New players randomly assigned to different towns

### Resource Distribution
- **Trees**: Scattered throughout appropriate biomes
- **Fishing Spots**: Along lake shorelines
- **Mob Spawns**: Based on biome and difficulty level

### Terrain Rules
- Water bodies are impassable
- Steep mountain slopes block movement
- PhysX engine handles collision detection

---

## 3. Player Systems

### Starting Conditions
- **Equipment**: Bronze sword (equipped)
- **Location**: Random starter town
- **Stats**: Base level 1 in all skills

### Core Stats
- **ATK (Attack)**: Determines accuracy and weapon access
- **STR (Strength)**: Determines damage dealt
- **RANGE**: Ranged combat effectiveness
- **DEF (Defense)**: Damage reduction and armor access
- **CON (Constitution)**: Health points

### Derived Stats
- **Combat Level**: Aggregate of ATK, STR, RANGE, DEF
- **Health Points**: Determined by Constitution level
- **Armor Rating**: Based on Defense and equipment

### Movement System
- **Walking**: Default movement speed
- **Running**: Faster movement, consumes stamina
- **Stamina Bar**: Depletes while running, regenerates when walking
- **Click-to-Move**: Orthographic overhead camera with point-and-click navigation

### Death Mechanics
- Items dropped at death location (headstone)
- Player respawns at nearest starter town
- Must retrieve items from death location

### Level Progression
- Experience-based leveling following RuneScape formulas
- Skills level independently through use
- No point allocation system

---

## 4. Combat System

### Combat Mechanics
- **Real-time combat**: Auto-attack when in range
- **Attack Styles**: Player selects focus for XP distribution
- **Damage Calculation**: Based on RuneScape formulas
- **Hit Frequency**: Determined by Attack level and equipment
- **Damage Amount**: Determined by Strength and weapon
- **Ranged Combat**: Requires bow and arrows equipped

### Ranged Combat Specifics
- **Arrow Requirement**: Must have arrows equipped to use bow
- **Arrow Consumption**: Arrows are depleted with each shot
- **No Arrows**: Cannot attack with bow if no arrows equipped

### Combat Flow
1. Player initiates combat by attacking mob
2. Auto-attack continues while in range
3. XP distributed based on selected combat style
4. Constitution XP always gained
5. Loot drops on mob death

### PvP Status
- **MVP Scope**: PvE only
- **Future**: PvP combat planned

---

## 5. Skills System

### Available Skills (MVP)
1. **Attack**: Melee accuracy and weapon requirements
2. **Strength**: Melee damage
3. **Defense**: Damage reduction and armor requirements
4. **Constitution**: Health points
5. **Range**: Ranged combat
6. **Woodcutting**: Tree harvesting
7. **Fishing**: Fish gathering
8. **Firemaking**: Creating fires from logs
9. **Cooking**: Preparing food

### Skill Mechanics
- **Experience Gain**: Through relevant actions
- **Level Requirements**: Gate equipment and activities
- **Level Cap**: Following RuneScape standards

### Resource Gathering
- **Woodcutting**: Click tree with hatchet equipped
- **Fishing**: Click water edge with fishing rod equipped
- **Success Rates**: Based on skill level

### Processing Skills
- **Firemaking**: Use tinderbox on logs in inventory
- **Cooking**: Use raw fish on fire

---

## 6. Items and Equipment

### Weapon Types
1. **Swords**
   - Bronze (Level 1+)
   - Steel (Level 10+)
   - Mithril (Level 20+)

2. **Bows**
   - Wood (Level 1+)
   - Oak (Level 10+)
   - Willow (Level 20+)

3. **Shields**
   - Bronze (Level 1+)
   - Steel (Level 10+)
   - Mithril (Level 20+)

### Ammunition
- **Arrows**: Required for bow usage
- **Consumption**: Depleted on use
- **Equipment Slot**: Dedicated arrow slot
- **Stackable**: Can carry multiple arrows in one slot

### Armor Types
Three equipment slots:
1. **Helmet**
2. **Body**
3. **Legs**

Armor Materials:
- Leather/Hard Leather/Studded Leather
- Bronze/Steel/Mithril

### Equipment Slots
- **Weapon**: Primary weapon slot
- **Shield**: Off-hand slot
- **Helmet**: Head protection
- **Body**: Torso protection
- **Legs**: Leg protection
- **Arrows**: Ammunition slot (required for bows)

### Tools
- **Hatchet**: Bronze only (MVP)
- **Fishing Rod**: Standard
- **Tinderbox**: Fire creation

### Resources
- **Logs**: From trees
- **Raw Fish**: From fishing
- **Cooked Fish**: Processed food

### Currency
- **Coins**: Universal currency
- Dropped by mobs
- Used at general store

### Item Properties
- **Stack Limit**: 28 inventory slots
- **Bank Storage**: Unlimited slots per bank
- **Tradeable**: All items (future feature)
- **Requirements**: Level gates for equipment

---

## 7. NPCs and Mobs

### Difficulty Level 1 - Beginner Enemies

**Goblins**
- **Description**: Small green humanoids with crude weapons
- **Locations**: Mistwood Valley, Goblin Wastes
- **Behavior**: Moderately aggressive, low aggro range
- **Combat Stats**: Low attack/defense, minimal HP
- **Drops**: Coins (common), bronze equipment (rare)
- **Lore**: The classic first enemy - every adventurer remembers their first goblin kill

**Men/Women (Desperate Bandits)**
- **Description**: Humans who turned to crime after the Calamity
- **Locations**: Near roads and town outskirts
- **Behavior**: Aggressive to low-level players only
- **Combat Stats**: Slightly stronger than goblins
- **Drops**: Small amounts of coins
- **Lore**: More desperate than evil, victims of circumstance

**Barbarians**
- **Description**: Primitive humans living in the wilderness
- **Locations**: Forest camps and clearings
- **Behavior**: Aggressive within camp boundaries
- **Combat Stats**: Tougher than bandits, more HP
- **Drops**: Coins, basic equipment (bronze tier)
- **Lore**: Wild warriors who reject civilization

### Difficulty Level 2 - Intermediate Enemies

**Hobgoblins**
- **Description**: Larger, militaristic cousins of goblins
- **Locations**: Deeper areas of Goblin Wastes
- **Behavior**: Highly aggressive, larger aggro range
- **Combat Stats**: Organized fighters with better accuracy
- **Drops**: More coins, steel equipment (uncommon)
- **Lore**: Elite goblin warriors with military discipline

**Guards (Corrupted Soldiers)**
- **Description**: Former kingdom soldiers serving dark masters
- **Locations**: Ancient ruins, abandoned fortresses
- **Behavior**: Aggressive, patrol fixed areas
- **Combat Stats**: Well-trained, balanced offense/defense
- **Drops**: Steel equipment (common), coins
- **Lore**: Once protectors, now enslaved by darkness

**Dark Warriors**
- **Description**: Warriors who embraced darkness after the Calamity
- **Locations**: Depths of Darkwood Forest
- **Behavior**: Very aggressive, ignore player level
- **Combat Stats**: High damage, moderate defense
- **Drops**: Steel equipment, cursed items (future content)
- **Lore**: Fallen knights who chose power over honor

### Difficulty Level 3 - Advanced Enemies

**Black Knights**
- **Description**: The most feared human enemies, masters of combat
- **Locations**: Black Knight Fortress, dark strongholds
- **Behavior**: Extremely aggressive, always hostile
- **Combat Stats**: Elite warriors with high stats across the board
- **Drops**: Mithril equipment (uncommon), substantial coins
- **Lore**: Elite dark warriors in pitch-black armor

**Ice Warriors**
- **Description**: Ancient warriors of Valorhall, frozen but still fighting
- **Locations**: Ice caves in the Northern Reaches
- **Behavior**: Aggressive, slow but extremely tough
- **Combat Stats**: Very high defense and HP
- **Drops**: Mithril equipment, ancient treasures
- **Lore**: Frozen champions guarding old kingdom treasures

**Dark Rangers**
- **Description**: Master bowmen who turned to darkness
- **Locations**: Shadows of the Blasted Lands
- **Behavior**: Aggressive at long range
- **Combat Stats**: Deadly accuracy, high ranged damage
- **Drops**: Mithril equipment, arrows (common)
- **Lore**: Elite archers with powerful longbows

### Mob Properties (All Enemies)
- **Stats**: Same system as players (ATK, STR, DEF, etc.)
- **Aggression**: Variable per mob type
- **Aggro Range**: Distance at which aggressive mobs attack
- **Level Check**: High-level players ignored by low-level aggressive mobs (except special cases)
- **Chase Mechanics**: Return to spawn if player escapes range
- **Special Cases**: Dark Warriors and higher always aggressive regardless of player level

### Spawning System
- **Global Timer**: 15-minute respawn cycle
- **Fixed Locations**: Mobs spawn at predetermined points
- **Biome Appropriate**: Mobs match their environment
- **Difficulty Appropriate**: Mob level matches zone difficulty

### Loot System
- **Guaranteed Drops**: Every mob drops something
- **Drop Tables**: 
  - Level 1 mobs: Coins (always), bronze equipment (rare)
  - Level 2 mobs: More coins (always), steel equipment (uncommon)
  - Level 3 mobs: Substantial coins (always), mithril equipment (uncommon), arrows (common for Dark Rangers)
- **Level Scaling**: Better items from harder mobs
- **Common Drops**: Coins (most frequent)
- **Equipment Drops**: Match mob's difficulty tier

---

## 8. Economy and Trading

### General Store
Available Items:
- **Hatchet** (Bronze) - For woodcutting
- **Fishing Rod** - For fishing
- **Tinderbox** - For firemaking
- **Arrows** - Ammunition for bows

### Banking System
- **Location**: One per starter town
- **Storage**: Unlimited slots
- **Independence**: Each bank separate (no shared storage)
- **Interface**: Click to open, drag items to store/retrieve

### Economy Flow
1. Kill mobs for coins
2. Purchase tools and arrows from store
3. Gather resources with tools
4. Process resources for consumables
5. Use consumables to sustain combat

---

## 9. User Interface

### HUD Elements
- **Health Bar**: Current/Max HP
- **Stamina Bar**: Running energy
- **Combat Style Selector**: XP distribution choice
- **Arrow Counter**: Shows equipped arrow count

### Interface Windows
- **Inventory**: 28-slot grid
- **Bank**: Unlimited storage grid
- **Skills**: Skill levels and XP
- **Equipment**: Worn items display (including arrow slot)
- **Map**: World overview

### Control Scheme
- **Movement**: Click-to-move (orthographic overhead view)
- **Combat**: Click enemy to attack
- **Interaction**: Click objects/NPCs
- **Inventory Management**: Drag and drop

---

## 10. Multiplayer Architecture

### Network Structure
- **WebSocket Connection**: Real-time communication
- **Persistent World**: Shared game state
- **Entity Synchronization**: Via Hyperfy ECS

### Player Management
- **Authentication**: Account-based system
- **Character Persistence**: Stats and inventory saved
- **Concurrent Players**: Unlimited (infrastructure dependent)

---

## 11. AI Agent Integration

### Agent Capabilities
- **Connection**: WebSocket (same as players)
- **Physics Simulation**: Accurate world model
- **Vision**: Screenshot capability (future)
- **Decision Making**: LLM-driven via ElizaOS

### Agent Actions
All player actions available:
- Attack
- Gather (contextual: chop/fish)
- Interact
- Go To
- Equip/Unequip
- Drop/Pick Up
- Loot
- Eat
- Inventory management

### Agent Interfaces
Queryable game state:
- Inventory contents
- Player stats
- Nearby entities
- Skills and XP
- Equipment status
- Arrow count

### Navigation
- **Semantic**: North/South/East/West
- **Relative**: Near/far descriptions
- **Text-based**: MUD-like interface

---

## 12. Technical Implementation

### Core Technology
- **Engine**: Hyperfy (TypeScript)
- **Networking**: LiveKit WebRTC
- **3D Graphics**: Three.js
- **Physics**: PhysX
- **Avatar Format**: VRM
- **Model Format**: GLB

### Asset Pipeline
1. **Concept**: AI-generated designs
2. **3D Generation**: MeshyAI
3. **Rigging**: Automatic for humanoids
4. **Hardpoint Detection**: AI-assisted attachment points
5. **Optimization**: 2000 triangle target

### World Generation
- **Height Maps**: Procedural generation
- **Vertex Coloring**: Biome representation
- **Collision Mesh**: PhysX integration

### Animation System
Shared rig for all humanoids:
- Walk/Run cycles
- Combat animations (melee and ranged)
- Gathering animations
- Generic interaction
- Death animation

---

## 13. Testing Framework

### Visual Testing System
- **Camera Setup**: Overhead orthographic view
- **Color Proxies**: Unique colors per entity type
- **Pixel Analysis**: Verify entity positions
- **Automation**: Puppeteer/Cypress integration

### Test Scenarios
Individual test worlds for:
- Combat verification (melee and ranged)
- Movement validation
- Inventory management
- Resource gathering
- Banking operations
- Mob spawning
- Arrow depletion

### Verification Methods
- **Visual**: Color-based position tracking
- **Programmatic**: Direct state queries
- **Behavioral**: Action sequence validation
- **Statistical**: Damage/XP calculations

### Test Requirements
- No simulation or "fake" tests
- Real world interaction
- Visual confirmation required
- Automated regression testing

---

## 14. MVP Scope and Future Expansions

### MVP Deliverables
- Core combat system (melee and ranged)
- Basic resource gathering (wood, fish)
- Three equipment tiers
- Arrow system for ranged combat
- Simple progression system
- Banking and inventory
- Multiplayer support
- AI agent compatibility

### Explicit MVP Limitations
- No PvP combat
- Limited skills (9 total)
- Three equipment tiers only
- Single tool tier (bronze)
- No trading between players
- No quests or NPCs beyond mobs
- Basic arrow type only

### Success Metrics
- Stable multiplayer performance
- Functional progression loop
- AI agents successfully playing
- All systems visually testable
- Complete end-to-end testing of every system with no mocks, all tests passing

# Scripts

## IMPORTANT

As Hyperfy is in alpha, the scripting API is likely to evolve fast with breaking changes.
This means your apps can and will break as you upgrade worlds.
Once scripting is stable we'll move toward a forward compatible model, which will allow apps to be shared/traded with more confidence that they will continue to run correctly.

## Lifecycle

TODO: explain the app lifecycle across client and server

## Globals

Apps run inside their own secure environment with a strict API that allows apps built by many different authors to co-exist in a real-time digital world.

Just as websites run inside a DOM-based environment that provides browser APIs via globals, Apps run inside an app-based environment that provides app specific APIs by way of its own set of globals.

- [app](hyperfy/docs/ref/App.md)
- [world](hyperfy/docs/ref/World.md)
- [props](hyperfy/docs/ref/Props.md)
- [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [num](hyperfy/docs/ref/num.md)
- [Vector3](https://threejs.org/docs/#api/en/math/Vector3)
- [Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
- [Euler](https://threejs.org/docs/#api/en/math/Euler)
- [Matrix4](https://threejs.org/docs/#api/en/math/Matrix4)

## Nodes

Apps are made up of a hierarchy of nodes that you can view and modify within the app runtime using scripts.

The gltf model that each app is based on is automatically converted into nodes and inserted into the app runtime for you to interact with.

Some nodes can also be created and used on the fly using `app.create(nodeName)`.

- [Group](hyperfy/docs/ref/Group.md)
- [Mesh](hyperfy/docs/ref/Mesh.md)
- [LOD](hyperfy/docs/ref/LOD.md)
- [Avatar](hyperfy/docs/ref/Avatar.md)
- [Action](hyperfy/docs/ref/Action.md)
- [Controller](hyperfy/docs/ref/Controller.md)
- [RigidBody](hyperfy/docs/ref/RigidBody.md)
- [Collider](hyperfy/docs/ref/Collider.md)
- [Joint](hyperfy/docs/ref/Joint.md)
# Scripts

## IMPORTANT

As Hyperfy is in alpha, the scripting API is likely to evolve fast with breaking changes.
This means your apps can and will break as you upgrade worlds.
Once scripting is stable we'll move toward a forward compatible model, which will allow apps to be shared/traded with more confidence that they will continue to run correctly.

## Lifecycle

TODO: explain the app lifecycle across client and server

## Globals

Apps run inside their own secure environment with a strict API that allows apps built by many different authors to co-exist in a real-time digital world.

Just as websites run inside a DOM-based environment that provides browser APIs via globals, Apps run inside an app-based environment that provides app specific APIs by way of its own set of globals.

- [app](hyperfy/docs/ref/App.md)
- [world](hyperfy/docs/ref/World.md)
- [props](hyperfy/docs/ref/Props.md)
- [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [num](hyperfy/docs/ref/num.md)
- [Vector3](https://threejs.org/docs/#api/en/math/Vector3)
- [Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
- [Euler](https://threejs.org/docs/#api/en/math/Euler)
- [Matrix4](https://threejs.org/docs/#api/en/math/Matrix4)

## Nodes

Apps are made up of a hierarchy of nodes that you can view and modify within the app runtime using scripts.

The gltf model that each app is based on is automatically converted into nodes and inserted into the app runtime for you to interact with.

Some nodes can also be created and used on the fly using `app.create(nodeName)`.

- [Group](hyperfy/docs/ref/Group.md)
- [Mesh](hyperfy/docs/ref/Mesh.md)
- [LOD](hyperfy/docs/ref/LOD.md)
- [Avatar](hyperfy/docs/ref/Avatar.md)
- [Action](hyperfy/docs/ref/Action.md)
- [Controller](hyperfy/docs/ref/Controller.md)
- [RigidBody](hyperfy/docs/ref/RigidBody.md)
- [Collider](hyperfy/docs/ref/Collider.md)
- [Joint](hyperfy/docs/ref/Joint.md)

## The Virtual World Philosophy

### Worlds vs Games

In Hyperfy, you don't build a "game" in the traditional sense. You build a world with game-like mechanics. This distinction is crucial:

- **Traditional Game**: Players launch, play through designed experiences, then exit
- **Hyperfy World**: A persistent space where gameplay emerges from the interaction of systems, players, and objects

## Architecture and Design Patterns

### The Client-Server Authority Model

Hyperfy uses an authoritative server model, which fundamentally shapes how you design game mechanics:

**Server Authority Means**:
- The server is the single source of truth
- Clients send intentions, not actions
- All game logic validation happens server-side
- State changes propagate from server to clients

**Design Implications**:
- Never trust client input
- Design with latency in mind
- Implement prediction for responsive feel
- Plan for conflict resolution

### System-Based Architecture

Hyperfy encourages system-based thinking. Instead of objects with behaviors, you have:

- **Systems**: Logic processors that operate on components
- **Components**: Pure data containers
- **Entities**: Identifiers that link components together

This separation allows for incredible flexibility and reusability.

### Event-Driven Communication

Systems communicate through events rather than direct calls. This creates loose coupling and allows for:
- Easy extension of functionality
- Multiple systems responding to single actions
- Clean separation of concerns
- Easier debugging and testing

## Physics and Spatial Reasoning

### Understanding PhysX Integration

Hyperfy uses PhysX for physics simulation, which provides:
- Realistic collision detection
- Efficient broad-phase culling
- Stable constraint solving
- Deterministic results

### Designing with Physics

Physics isn't just for realism - it's a design tool:

**Movement Mechanics**:
- Controller capsules for character movement
- Terrain collision for environmental boundaries
- Trigger volumes for area detection

**Interaction Systems**:
- Proximity-based activation
- Line-of-sight checks
- Projectile trajectories
- Area effects

# Generation

For text and image generation, as well as image desciption, use gpt-4o and gpt-4o-mini from OpenAI.

For 3D item generation, remeshing, retexturing, avatar creation and rigging, we are using meshy.ai

The API keys for these are available in the root project .env, so use dotenv to access environment variables

Current Anthropic models:
Claude Opus 4 claude-opus-4-20250514
Claude Sonnet 4	claude-sonnet-4-20250514

Current OpenAI models:
'gpt-4o'
'gpt-4o-mini'
'o1-2024-12-17'

Current OpenAI image models:
'gpt-image-1' // newer and better, more controllable but needs special API key access / KYC
'dall-e-3'

# Tech Stack

Hyperfy (in packages/hypefy) - A 3D multiplayer game engine built on three.js -- includes voice with LiveKit, avatars with VRM, an application abstraction for building self-contained world apps and more
We need to make sure we build persistence into Hyperfy for our apps

Playwright - Browser engine for running tests and simulating gameplay

React - UI and frontend is done in React

ElizaOS - Our AI agent framework. Eliza runs with 'elizaos start' and we have a plugin-hyperfy for Eliza which enables Eliza plugins to join Hyperfy worlds and call all available actions.

Three.js - Our 3D graphics library -- we should try to use the Hyperfy abstractions where possible

Sqlite - for persistence we will store all application data in the database, which is currently a local Sqlite instance# Tech Stack

Hyperfy (in packages/hypefy) - A 3D multiplayer game engine built on three.js -- includes voice with LiveKit, avatars with VRM, an application abstraction for building self-contained world apps and more
We need to make sure we build persistence into Hyperfy for our apps

Playwright - Browser engine for running tests and simulating gameplay

React - UI and frontend is done in React

ElizaOS - Our AI agent framework. Eliza runs with 'elizaos start' and we have a plugin-hyperfy for Eliza which enables Eliza plugins to join Hyperfy worlds and call all available actions.

Three.js - Our 3D graphics library -- we should try to use the Hyperfy abstractions where possible

Sqlite - for persistence we will store all application data in the database, which is currently a local Sqlite instance

# Real code only
For testing the RPG, we will not be using any mocks, spies, or other kinds of test framework structure -- instead we build mini-worlds where we test each feature individually, with clear structure and saving of all error logs to that after running the tests we can identify if the test passed or if there were failures or errors

# Test Multimodally and Verify in Browser
We will test these scenarios a few different ways -- first, we will evaluate the in-game world metrics we would expect
    -> If we're testing if a player has moved, we can check the position of the player in the three.js scene
    -> We should also build visual testing with screenshots to verify that objects are actually on screen -- to do this we need an overhead camera rig and solid color proxies for each of the objects (cube proxies)
    -> Any other kinds of testing that actually test the real runtime and gameplay should be implemented
    -> We want to minimize test-specific code and objects, since it leads to bugs. We want to use real objects, real items from the game, real mobs and player proxies etc

# Basic Screen Testing
Is the entire screen all white? All black? 95%+ one single color? Something might be wrong. Verify that the player object is actually visible, the camera rig actually works, the world actually loads using basic pixel  and have statistics to help yourself understand when there might be something weird

# Visual Testing
For visual testing, we will use Playwright and a testing rig that screenshots the overhead of the scenario and checks for the existing of very specific colored pixels. Each entity (items, mobs, player, etc) in our scenario tests will be represented by a cube with a specific known color which we can check for. If a blue player kills a green goblin and loots the corpse, we can check that the green pixels went away and there are now red corpse pixels, for example. We can also check the distance of cubes from each other by getting all pixels of a color and average the positions. So if we are testing melee attack, for example, we can visualize the cubes as being adjacent and test the adjacency.

# Three.js Testing
Three.js creates a hierarchy of scene objects which have known properties like position. For testing if a player has moved, we can get their current position and verify that, say, they aren't just at 0. We can also verify that they exist in the hierarchy, etc. Our testing setup should make it easy to log and get this information.

# Systems and Data
Hyperfy is an ECS engine, to verify certain things we will want to be able to introspect systems and data attached to components. So if we want to check player money, we need to go through the Hyperfy systems to see how much money they have.

# LLM Based Verification
OpenAI GPT-4o and Anthropic Claude can now see images which we screenshot from Playwright and answer questions about them or verify stuff. We should use this sparingly as it is slow and expensive, but useful for figuring out what's going wrong, especially with UI or complicated scenarios. We can build this into our screenshot testing loop for tests where we want to verify, say, that something is on screen in the UI in the right place, that the UI looks good and doesn't have overlaps, etc.

# Testing Frameworks
We will use Playwright and custom tests which set up a Hyperfy world, add all of the entities, verify they are added, runs the test and verifies everything passes with no errors
We are using Cursor and Claude Code which most tend to swallow errors in the logs, so we need to make sure the logs are output somewhere and contain all errors, and that after running our tests we verify that the logs are empty and free of any errors.

So all tests MUST use Hyperfy and Playwright, and real elements of the RPG.# Real code only
For testing the RPG, we will not be using any mocks, spies, or other kinds of test framework structure -- instead we build mini-worlds where we test each feature individually, with clear structure and saving of all error logs to that after running the tests we can identify if the test passed or if there were failures or errors

# Test Multimodally and Verify in Browser
We will test these scenarios a few different ways -- first, we will evaluate the in-game world metrics we would expect
    -> If we're testing if a player has moved, we can check the position of the player in the three.js scene
    -> We should also build visual testing with screenshots to verify that objects are actually on screen -- to do this we need an overhead camera rig and solid color proxies for each of the objects (cube proxies)
    -> Any other kinds of testing that actually test the real runtime and gameplay should be implemented
    -> We want to minimize test-specific code and objects, since it leads to bugs. We want to use real objects, real items from the game, real mobs and player proxies etc

# All Features Must have tests

This is extremely important. If you make a feature, make a test for it and make sure all tests pass

# All Tests Must Pass
It's important that we always get all tests to pass before moving on -- even "minor" ones. No tests are minor if any are failing.
If our goal is to demonstrate something isn't working, start out by making tests that fail, then fix the underlying code so they pass
Testing is extremely important! If it's not tested, it's probably broken.
NEVER shortcut, simplify or skip in tests. The goal of tests is to identify bugs in the code, NOT to get the tests to pass.

# Packages in this project

We have the following packages:

## Hyperfy

three.js based world engine. Should stay pure to world engine and NOT include any code specific to the RPG, but should be flexible and extensible to allow games such as the RPG to be built. IT IS VERY IMPORTANT that we don't add RPG code or modify or hardcode stuff into Hyperfy, it needs to be a flexible world/metaverse engine for all games.

## Plugin Hyperfy

This is a plugin for elizaOS agents to connect to Hyperfy. This should be general and not have RPG code specific to the RPG, but it needs to dynamically load in the available actions from the game so that it can contextually give the agents a list of actions they can perform when those actions are valid. For example, a use item action is valid on an item in the agent's inventory. All elizaOS code should go here, and any action definitions should not be specific to elizaOS agents, but should just be a general manifest of available actions that the client can receive.

## RPG

This is an RPG game based on Runescape, but with a twist-- everything is AI generated. The world, the lore, the items, the mobs, the player, the animation, everything. The RPG is built on Hyperfy, but is cleanly separated from it. It uses Hyperfy's generic structure and serialization system to build a full-scale MMORPG. We make need to add systems to enable persistent, serialization, shared state, and anti-cheat. We will build general system implementations into Hyperfy as needed which are extended and customized by the RPG for this specific game. It's the difference between the framework and application layer, and it's very important we keep this boundary.

## test-framework

This is a standalone Hyperfy testing framework which we can use for the RPG to test everything. We want to test data on Systems, in the three.js scene graph and visually through the browser, as well as with logs in Playwright and whatever else we can get in terms of actual telemetry on the actual game. We don't use mocks or unit tests, we ONLY do gameplay testing on the real gameplay elements, real game engine, etc. This prevents us from creating garbage tests and hallucinated code that doesn't actually work. We should make sure this test framework is robust, and then used in the RPG to test every single aspect of the RPG. But we want this standalone so we can use it for other games as well, so no hardcoded RPG stuff.

# Important notes on development

- Always make sure that whatever you build has tests
- Don't create new files to test things out or fix things
- KEEP IT SIMPLE!
- Always implement real working code, never examples or shortcuts-- those just cause problems in the future.
- When writing tests, don't use mocks-- they don't work-- instead write real runtime tests and lean on visual testing, testing the three.js scene hierarchy and real data values, etc
- Checking where things are in space is also a good way to test stuff!
- If you're not sure, ask me about something, I know a lot about the system.
- Don't create new files unless you need to. Revise existing files whenever possible. It makes cleanup much easier in the future.
- Instead of creating a _v2.ts, just update the v1 file.
- IF you write docs, store them in the /docs folder, but generally don't bother writing a bunch of markdown files
- If you save logs, store them in the /logs folder, it could help you to read back the actual outputs since your other method of seeing them gets clipped
- Don't change foundational code or stuff unless yuo have to, especially if it's to address the symptom of a problem
- Always make sure you are absolutely certain and have a clear test demonstrating that something core is wrong before changing it
- Do not make assumptions about game features-- always refer to the GDD
- Do not add any extra features that are not covered in the GDD
- Use environment variables in the .env with dotenv package
- Ignore Hyperfy's .hyp format, ALWAYS make systems
- Always define types in a types.ts and use the existing types before making new ones
- Try to make each package self-contained and modular, they can import each other through the workspace if needed (but no circular dependencies)
- If it doesn't have a real test that starts up Puppeteer and actually runs the actions and screenshots the world, then it probably isnt actually working
- So PLEASE use Puppeteer and make sure that every feature, item, interaction, etc is tested with every means we have
- Tests are extremely important -- use real tests with the real files, NO MOCKS ALLOWED
- We can create Hyperfy worlds for each test and run them individually so we don't need mocks
- Always write production code -- instead of TODO or "will fill this out later" actually take the time to write out all of the code
- Don't hardcode anything, always make sure yuo are building toward the general case and a system that will have many more items, players, mobs, etc
- Don't work around problems -- fix the root cause. Don't just write code to avoid something that isn't doing what you want, lets make it work how we want it to
- Instead of writing new abstractions, deepy research Hyperfy and how we can use the existing code and systems to achieve our goals
- Always separate data from logic -- DON'T hardcode data or examples into the code. Move it to a JSON if necessary, and don't just make up examples

## VERY IMPORTANT

Don't create new files. Especialy don't create "check-*.ts", "test-*.mjs", "fix-*.js" etc. NO files like that. You can run shell commands, you can change the code and run it, but creating new files adds confusing and bloat. Don't save reports or guides or any markdown files either, OTHER than modifying the README.md when you make a significant feature change that changes the docs.

You VERY rarely need to create new files, if you're creating a new file you might be accidentally recreating a file that exists or causing bloat and should do some research first.

Clean up after yourself. If you do create any test files, delete them when you're done.

import { Aside } from '@astrojs/starlight/components';

# Important rules for development and testing

## Fail fast

We NEVER want to hide our bugs. No if ('property' in obj) -- if obj.property fails typecheck, then we're using it wrong. If obj.property fails because its unknown, then add a throw so when we run it we see the error response

## Don't ignore errors -- use patterns to throw if data is not what we expect

The goal of our testing and development *is to catch bugs* and the best way to do that is at runtime, when running through actual user behaviors. Make sure that if the data we expect is not right, we throw or error. We never use try catch, we never do null checks on data we critically need.

## The goal of tests is to find bugs

Don't make useless tests. Don't make tests that count the number of services in the plugin. Make tests that find bugs in the runtime objects. We don't use mocks or unit test patterns with fake code, everything we do uses REAL code.

## No unit testing library and no mocks

Your tendency is to make a lot of bad unit tests that don't really test anything. So you are banned from using any unit testing library. Instead, you must create scenarios using e2e testing tools like the built-in elizaos plugin test suite tools for plugins ('elizaos test' will run all the tests in the plugin 'tests' property) and Cypress for testing applications.

## Always do e2e tests with real objects

We can only know if the code works if we actually run through the real thing end to end

## Always upgrade the existing tests and only add new tests when there are new features

We don't want quick tests, simple tests, one-offs or scripts. Always focus on making the current tests pass and improving them. Don't create new files unless there are new features. There should NEVER be more test files than there are features.

## Always run all tests

Don't just run some tests and think you are done. If all tests don't pass, the feature is not implemented. Always run ALL tests. Always make sure all tests are enabled and run from the "test" npm script. Features are only implemented when all tests pass.

## Never disable tests

If tests fail, fix them. This is your priority. DO NOT disable tests.

## TL;DR

No defensive programming -- actively find and throw errors
No unit testing library, no mocks, no "test" code -- everything should use a live runtime environment with setups where we can observe errors
No useless tests -- Don't make tests that don't test anything
Don't create new test scripts -- improve the ones you have
Fix tests-- this is your biggest priority, don't ignore and don't disable them
Always run all tests-- if all tests dont pass, the feature isn't properly implemented

# ALWAYS REMIND YOURSELF OF THESE THINGS

Did I implement correct tests which actually test the running code in an end-to-end setting?
Did I implement throws and error identification to catch any errors?
Did I remove all defensive programming, try catch etc?
Did I implement all of the requirements and get all of the tests to pass 100%?
Are there any files I can consolidate or remove so that the project is clean and doesn't have duplicate files?
Are all of the tests connected to 'bun run test' and are they running successfully?
Is there any way that this could error in ways I can't catch?

# ALWAYS RUN YOUR TESTS

If you create a feature, make sure 100% of ALL TESTS IN THE PROJECT are passing

# VISUAL TESTS = Success

Create cube proxies with a flat unlit material for all items with specific colors (Like #ABC123) and then test for those pixels
Use an overhead camera rig to screenshot and test for this color
If you don't see the color on screen, probably not working!

# CRASHBLOCKS = APP DOESN'T WORK

Look out in the client world for crash blocks. If these are present then the apps didn't load and crashed, and we need to fix them.

# BIG REFACTOR - NO MORE HYP FILES

Instead of making "apps" in Hyperfy, which are "user generated", we are going to remove this capability and instead make Systems and RPGApps. RPGApps are created by Systems and are NOT UGC apps. They can not be added by users. They are created by Systems which have full access to the entire Hyperfy engine.

# IMPORTANT RULE: DO NOT SIMPLIFY

This is very important. DO NOT make new files. ESPECIALLY do not make "simple" versions or "minimal" versions of files. Just fix the errors you see in place. If you add "minimal" files you break real production code and add bloat and larp.

YOU ARE BANNED FROM MAKING MINIMAL REPRODUCTONS. YOU ARE BANNED FROM MAKING SIMPLE EXAMPLES.

Your goal is to fix the existing code, NOT generate new files.

DO NOT generate new files. Instead, FIX THE FILES YOU HAVE. FIX THE CODE YOU HAVE.

This is the most important rule you can follow. Not following it = you are fired.

I repeat: If you create "simple" reproductions I will fire you and replace you with Gemini.

# IMPORTANT RULE: One build, one dev, one start, one test

It is very important that when we run 'npm run build' we get ALL build steps. No npm run build:*

Same with start, test and dev

EVERY TEST SHOULD RUN WITH 'bun run test'

EVERYTHING SHOULD START WHEN RUNNING 'bun run start'

EVERYTHING SHOULD START IN WATCH MODE WHEN RUNNING 'bun run dev'

EVERYTHING SHOULD BUILD, ALL SERVERS AND CONTAINERS AND APPS AND EVERYTHING when running 'bun run build'

ONE SCRIPT = ONE ACTION

Each package.json MUST contain 'dev', 'start', 'build', 'test' and 'lint' and ONLY those

All binary compilation etc must be encapsulated

No tauri:dev -- just dev
No build:server -- just build


# EXTREMELY IMPORTANT

Don't disable working code. Don't comment plugins out. Your goal is to fix these plugins, so comenting them out just hides real bugs.

Your goal is to fix code. Commenting out working code breaks it worse and hides errors, giving a false sense of confidence.

Don't comment out files, don't comment out working imports, don't disable plugins. Focus on fixing the errors you see, not simplifying the problem (which often hides the errors and adds bloat).

I repeat: DO NOT just make radical infrastructure changes or comment out important parts.

DO NOT create minimal workflows. Test the full worlflow. You will only add more bugs if you do that. If you fix the full workflow, the bugs go away.

If you create a minimal test or workflow or you comment out an important section of code arbitrarily then you will be fired.