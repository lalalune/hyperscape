# Glossary

This glossary provides comprehensive definitions of terms, concepts, and technologies used throughout the Asset Forge project. Terms are organized by category for easy reference.

## AI and Machine Learning Terms

### GPT-4
**General Pre-trained Transformer 4** - OpenAI's large language model used in Asset Forge for prompt enhancement, generating detailed 3D model descriptions from user input, and creating optimized prompts for downstream AI services. GPT-4 acts as an intelligent intermediary that understands user intent and translates it into technical specifications suitable for 3D generation.

### DALL-E 3
OpenAI's advanced image generation model used to create concept art and reference images for 3D model generation. DALL-E 3 takes text descriptions and produces high-quality 2D images that serve as visual references for the 3D modeling pipeline. The generated concept art helps ensure the final 3D model matches the intended aesthetic and design.

### Meshy.ai
A specialized AI service for converting 2D images into 3D models. Asset Forge uses Meshy's API to transform DALL-E generated concept art into fully-formed 3D meshes. Meshy provides multiple quality levels (standard, high, ultra) and supports both text-to-3D and image-to-3D workflows. The service handles the complex task of inferring depth, geometry, and structure from 2D representations.

### MediaPipe Hands
Google's machine learning framework for hand pose detection and tracking. Asset Forge leverages MediaPipe to detect hand positions in reference images during the hand rigging process. The framework identifies 21 hand landmarks (finger joints, palm points) with high accuracy, enabling automatic calculation of grip points and weapon alignment.

### TensorFlow.js
Google's JavaScript library for running machine learning models in the browser. Asset Forge uses TensorFlow.js to execute MediaPipe models client-side, enabling real-time hand pose detection without requiring server-side processing. This provides immediate feedback during the hand rigging workflow.

### Hand Pose Detection
The process of identifying and tracking hand positions, orientations, and joint locations in images or 3D space. Asset Forge's hand rigging system uses pose detection to automatically determine optimal weapon grip points by analyzing how a virtual hand would naturally hold a weapon model.

### Model Inference
The process of using a trained machine learning model to make predictions or generate outputs. In Asset Forge, inference occurs when GPT-4 generates descriptions, DALL-E creates images, Meshy produces 3D models, or MediaPipe detects hand poses. Inference is distinguished from training (which Asset Forge doesn't perform).

### Prompt Engineering
The practice of crafting effective text prompts to guide AI model outputs. Asset Forge employs sophisticated prompt engineering to ensure consistent, high-quality results from GPT-4, DALL-E, and Meshy. This includes using style guides, technical specifications, and structured prompt templates.

### Embedding
Vector representations of data (text, images, 3D models) in high-dimensional space. While Asset Forge doesn't directly work with embeddings, the AI services it uses (GPT-4, DALL-E, Meshy) internally convert inputs to embeddings for processing.

## 3D Graphics Terms

### GLB (GL Binary)
The binary version of the glTF 3D model format. GLB files contain all model data (geometry, textures, materials, animations) in a single binary file, making them ideal for web distribution. Asset Forge uses GLB as its primary 3D model format because it's compact, efficient, and widely supported by Three.js and web browsers.

### GLTF (GL Transmission Format)
An open-standard 3D file format designed for efficient transmission and loading of 3D models. GLTF can be either JSON-based (.gltf) or binary (.glb). The format is optimized for web use and includes support for materials, textures, animations, and skinned meshes. Asset Forge generates and consumes GLTF/GLB files exclusively.

### Polycount
The number of polygons (triangles) in a 3D model. Lower polycount models render faster but have less detail; higher polycount models are more detailed but computationally expensive. Asset Forge's quality settings influence polycount: standard quality targets 5-10K polygons, high quality 15-30K, and ultra quality 50K+. The normalization service can reduce polycount while preserving visual quality.

### PBR (Physically Based Rendering)
A rendering approach that simulates real-world light behavior using physics-based material properties. PBR materials in Asset Forge define metalness, roughness, base color, and normal maps to create realistic surfaces that respond accurately to lighting. Meshy generates PBR-ready models, and Asset Forge's material variant system creates different PBR presets (bronze, steel, mithril).

### Rigging
The process of creating a skeletal structure (bones) for a 3D model to enable animation. Rigging involves defining bones, joint hierarchies, and how mesh vertices respond to bone movement (skinning). Asset Forge supports automatic rigging through Meshy's rigging API, which analyzes character models and generates appropriate skeletal structures.

### Skeleton
A hierarchical structure of bones used to animate 3D models. Skeletons define joints (bones) and their parent-child relationships. In Asset Forge, character models can have skeletons automatically generated during the rigging stage. The skeleton enables animations like walking, attacking, or idle poses.

### Skinned Mesh
A 3D mesh that deforms based on an underlying skeleton's movement. Skinning defines how each vertex in the mesh is influenced by nearby bones through weight values. Asset Forge's armor fitting system creates skinned meshes by transferring skin weights from character models to armor pieces, ensuring armor deforms naturally with character animations.

### Animation Clip
A sequence of keyframes defining how a skeleton's bones move over time. Animation clips in GLTF format include timing information, interpolation methods, and bone transformations. Asset Forge preserves animation clips when processing rigged models and can extract T-pose states from animated models.

### Vertex
A point in 3D space that defines part of a mesh's geometry. Vertices have positions and can have additional attributes like normals, UVs (texture coordinates), colors, and skin weights. Asset Forge's fitting and normalization services manipulate vertex positions and attributes.

### Normal Map
A texture that adds surface detail to a model without increasing geometry. Normal maps encode surface orientation information, creating the illusion of bumps, scratches, and fine details. PBR materials in Asset Forge often include normal maps for enhanced realism.

### UV Mapping
The process of projecting a 2D texture onto a 3D model's surface. UV coordinates define how texture pixels map to mesh vertices. Asset Forge receives UV-mapped models from Meshy and preserves UV mappings during processing operations.

### Mesh
The collection of vertices, edges, and faces that define a 3D object's shape. Meshes can be static (Mesh) or animated (SkinnedMesh) in Three.js. Asset Forge works extensively with both types, performing operations like scaling, deformation, and weight transfer.

### Bounding Box
An axis-aligned rectangular volume that fully contains a 3D object. Bounding boxes are used for collision detection, size measurements, and alignment. Asset Forge uses bounding boxes to calculate model dimensions, scale armor pieces, and center objects.

### World Space vs Local Space
**World Space** refers to absolute positions in the 3D scene. **Local Space** refers to positions relative to an object's parent. Asset Forge carefully manages space transformations during armor fitting to ensure correct alignment between models with different hierarchies.

### Matrix Transformation
A mathematical representation of position, rotation, and scale operations. Three.js uses 4x4 matrices to represent object transformations. Asset Forge frequently updates matrix world calculations to ensure accurate spatial relationships between fitted components.

## Asset Terms

### Base Model
The original, primary version of a generated 3D asset before any variants are created. The base model serves as the template for material variants in Asset Forge's retexturing pipeline. For example, a bronze sword would be the base model, with steel and mithril variants derived from it.

### Variant
An alternative version of a base model with different materials, textures, or colors. Asset Forge's material variant system creates multiple variants from a single base model by regenerating textures with different material prompts (e.g., bronze → steel → mithril). Variants share the same geometry but have different visual appearances.

### Material Preset
A predefined configuration for generating material variants, including display name, color, tier, and style prompts. Material presets in Asset Forge are defined in `material-presets.json` and include categories like metals (bronze, iron, steel), gemstones (ruby, sapphire, emerald), and special materials (dragonbone, obsidian). Each preset contains AI prompts that guide Meshy's retexturing process.

### Tier
A quality or rarity level assigned to assets, typically numeric (Tier 1-5 in RPG context). Higher tiers represent more powerful, rare, or valuable items. Asset Forge includes tier information in metadata and uses it for material preset filtering (e.g., mithril is Tier 4, bronze is Tier 1).

### Asset Type
The category of a 3D asset defining its purpose and structure. Asset Forge supports various types including weapons (sword, axe, bow), armor (helmet, chestplate, gloves), characters (humanoid, creature), items (potion, coin, key), and buildings (house, tower, wall). Each type has specific generation prompts and processing requirements.

### Subtype
A more specific categorization within an asset type. For weapons, subtypes include one-handed, two-handed, ranged. For armor, subtypes correspond to equipment slots (head, body, hands, feet). Subtypes help refine generation prompts and determine processing pipelines.

### Concept Art
A 2D image representing the intended design of a 3D asset before modeling begins. In Asset Forge's pipeline, concept art is generated by DALL-E from text descriptions and serves as a reference image for Meshy's 3D generation. Concept art ensures visual consistency and provides a preview of the final asset.

### Metadata
Structured information describing an asset's properties, generation history, and characteristics. Asset Forge stores comprehensive metadata in JSON format, including asset ID, name, type, generation method, creation timestamps, file paths, rigging status, and custom attributes. Metadata enables asset management, filtering, and retrieval.

### Asset Library
The collection of all generated 3D models managed by Asset Forge. The library is stored in the `gdd-assets/` directory, with each asset in its own folder containing the GLB file, concept art, metadata, and variants. The library can be browsed, filtered, and searched through the Assets page.

## Pipeline Terms

### Stage
A discrete step in the generation pipeline with specific inputs, processing, and outputs. Asset Forge's generation pipeline includes stages like text input, GPT-4 enhancement, image generation, image-to-3D conversion, retexturing, rigging, and sprite generation. Each stage can succeed, fail, or be skipped based on configuration.

### Status
The current state of a pipeline stage or overall generation process. Statuses in Asset Forge include idle (not started), active/processing (in progress), completed (finished successfully), failed (encountered an error), and skipped (intentionally bypassed). Status updates provide real-time feedback during generation.

### Polling
A technique for checking the status of long-running operations by repeatedly querying an API endpoint. Asset Forge polls Meshy's API every 2-3 seconds during 3D generation to check if models are ready. Polling continues until the operation completes, fails, or times out.

### Timeout
A maximum time limit for an operation to complete before being considered failed. Asset Forge uses timeouts to prevent indefinite waiting when AI services experience issues. Typical timeouts are 30 seconds for API calls, 5-10 minutes for image generation, and 15-30 minutes for 3D model generation depending on quality level.

### Pipeline ID
A unique identifier for a specific generation pipeline execution. Pipeline IDs in Asset Forge track individual generation requests through all stages, enabling progress monitoring, result retrieval, and error tracking. IDs are generated when starting a pipeline and used for all subsequent operations.

### Queue
An ordered list of pending operations waiting for processing. While Asset Forge doesn't implement explicit queuing (each generation runs independently), Meshy's backend uses queues to manage multiple concurrent generation requests. Users may experience variable wait times based on queue length.

### Retry Logic
Automated attempts to repeat failed operations. Asset Forge implements retry logic for transient failures like network errors or temporary API unavailability. Retries use exponential backoff (increasing delays between attempts) to avoid overwhelming services.

### Idempotency
The property that performing an operation multiple times produces the same result. Asset Forge's API endpoints are designed to be idempotent where possible, meaning retrying a request won't create duplicate assets or corrupted state.

## Fitting and Rigging Terms

### Shrinkwrap
A mesh deformation technique that wraps one mesh (armor) tightly around another (character body). Asset Forge's armor fitting uses shrinkwrap-like algorithms to conform armor pieces to character models. The process projects armor vertices onto the body surface and adjusts positions to create a tight fit.

### Weight Transfer
Copying skinning weights from one mesh to another. When fitting armor to a rigged character, Asset Forge transfers skin weights from the body mesh to the armor mesh. This ensures the armor deforms correctly with character animations, moving naturally with underlying bones.

### Bone Mapping
The process of establishing correspondence between bone hierarchies in different models. Asset Forge performs bone mapping when binding armor to characters, matching armor bones (or creating them) to character skeleton bones. Proper bone mapping ensures animations affect fitted armor correctly.

### Binding
Attaching a mesh to a skeleton so it deforms with bone movement. Asset Forge binds fitted armor meshes to character skeletons by creating SkinnedMesh objects with appropriate bone references and skin weights. Binding converts static armor meshes into animated components.

### Grip Point
The position and orientation where a character's hand should hold a weapon. Asset Forge's hand rigging system automatically calculates grip points by analyzing weapon geometry (handle location) and simulating natural hand poses using MediaPipe. Grip points are stored in weapon metadata for use in character animations.

### Handle Detection
Identifying the portion of a weapon model intended for gripping. Asset Forge's weapon handle detector analyzes geometry to find cylindrical or elongated sections suitable for hands. Detection considers size, position, and orientation to distinguish handles from blades or other weapon parts.

### T-Pose
A standard reference pose for rigged characters with arms extended horizontally, forming a T shape. T-poses are used as the default state for rigging, weight transfer, and fitting operations. Asset Forge includes a T-pose extraction service that removes animations from character models and returns them to their base pose.

### Joint
A connection point between bones in a skeleton. Joints define rotation axes and movement constraints. Asset Forge works with Three.js Bone objects representing joints and calculates joint positions during rigging and fitting operations.

### Skin Weights
Numerical values (0-1) defining how much each bone influences each vertex in a skinned mesh. A vertex might be 70% influenced by the shoulder bone and 30% by the arm bone. Asset Forge transfers skin weights from body meshes to armor meshes during fitting to ensure natural deformation.

### Deformation
The process of changing a mesh's shape, either through direct vertex manipulation or skeletal animation. Asset Forge performs deformation during armor fitting (shrinkwrap) and preserves deformation capabilities (skinning) when binding armor to skeletons.

### Skeleton Alignment
Ensuring two models' skeletal structures are positioned and oriented consistently. Asset Forge aligns armor and character skeletons before weight transfer by matching bone positions and rotations. Misalignment causes artifacts like detached armor or incorrect deformation.

### Influence Range
The spatial area within which a bone affects nearby vertices. During weight transfer, Asset Forge calculates which character bones should influence each armor vertex based on proximity. Influence range determines how weights are distributed across multiple bones.

## Technical Terms

### Zustand
A lightweight state management library for React applications. Asset Forge uses Zustand to manage application state including generation configuration, asset lists, fitting parameters, and UI state. Zustand stores are defined with TypeScript for type safety and use middleware for persistence and development tools.

### Immer
A library for working with immutable state using mutable-style syntax. Asset Forge's Zustand stores use Immer middleware, allowing state updates with simple property assignments (state.value = newValue) while maintaining immutability guarantees. This simplifies state management code.

### Store
A centralized state container in Zustand holding related data and actions. Asset Forge defines multiple stores: useGenerationStore (generation pipeline), useAssetsStore (asset library), useArmorFittingStore (fitting parameters), useHandRiggingStore (rigging state), and useDebuggerStore (development tools). Each store is independently managed but can interact when needed.

### Middleware
Functions that enhance store behavior in Zustand. Asset Forge uses persist middleware (save state to localStorage), devtools middleware (Redux DevTools integration), subscribeWithSelector middleware (granular subscriptions), and immer middleware (immutable updates). Middleware wraps stores and intercepts actions.

### OrbitControls
A Three.js camera controller enabling intuitive 3D navigation through mouse/touch input. OrbitControls allows users to rotate around objects (orbit), pan (translate), and zoom. Asset Forge uses OrbitControls extensively in the 3D viewer, armor fitting page, and hand rigging page for model inspection.

### Raycasting
A technique for detecting intersections between a ray and 3D objects. Asset Forge uses raycasting for click detection (selecting models), measuring distances (fitting calculations), and finding surfaces (projection during shrinkwrap). Three.js provides Raycaster for efficient ray-object intersection testing.

### Scene Graph
A hierarchical tree structure representing the organization of objects in a 3D scene. Three.js uses a scene graph with parent-child relationships. Asset Forge carefully manages the scene graph during fitting operations, ensuring proper parenting and transformation inheritance.

### Buffer Geometry
Three.js's efficient representation of 3D geometry using typed arrays. BufferGeometry stores vertex positions, normals, UVs, and other attributes in contiguous memory for fast GPU upload. Asset Forge works with BufferGeometry when manipulating meshes, accessing vertex data, and creating modified geometries.

### Material
A definition of how a 3D surface should appear when rendered, including color, reflectivity, and texture. Asset Forge primarily uses MeshStandardMaterial (PBR) and MeshBasicMaterial (simple). Materials include properties like color, metalness, roughness, and texture maps.

### Texture
An image applied to a 3D model's surface to provide color, detail, or material properties. Asset Forge loads textures from GLB files and applies them using Three.js's TextureLoader. Textures can be diffuse (color), normal (surface detail), or PBR maps (metalness/roughness).

### Renderer
The component responsible for converting 3D scene data into 2D images displayed on screen. Asset Forge uses Three.js's WebGPURenderer, which leverages GPU acceleration for real-time rendering. The renderer is configured with antialiasing, shadow mapping, and appropriate pixel ratios for quality output.

### Frame Buffer
A memory buffer storing rendered image data. Asset Forge uses render targets (framebuffers) during sprite generation to capture model renders from different angles without displaying them on screen. Framebuffer contents are read back and saved as PNG files.

### Shader
GPU programs defining how vertices are positioned and pixels are colored. While Asset Forge doesn't implement custom shaders, Three.js materials compile to shaders. The PBR materials used throughout Asset Forge run sophisticated fragment shaders for realistic lighting calculations.

### Canvas
The HTML5 canvas element where Three.js renders 3D content. Asset Forge creates canvas elements for the main 3D viewer and uses React Three Fiber's declarative canvas components. Canvases provide WebGPU rendering contexts.

### WebGPU
A modern JavaScript API for rendering 3D graphics in web browsers using GPU acceleration. WebGPU is the underlying technology powering Three.js in Asset Forge. It provides better performance and more advanced GPU features compared to WebGL. Asset Forge leverages WebGPU for all 3D visualization, enabling real-time interaction with complex models.

### Vector3
A three-dimensional vector representing positions, directions, or scales in 3D space. Three.js's Vector3 class is used extensively in Asset Forge for calculations, transformations, and spatial operations. Common operations include distance measurement, normalization, and interpolation.

### Quaternion
A mathematical representation of rotations in 3D space. Quaternions avoid gimbal lock problems inherent in Euler angles. Asset Forge uses quaternions when working with bone rotations and orientation calculations, though most user-facing code presents rotations as Euler angles for simplicity.

### Euler Angles
Rotations represented as three separate angles around X, Y, and Z axes. Euler angles are intuitive but can suffer from gimbal lock. Asset Forge displays rotations as Euler angles in the UI but often converts to quaternions internally for calculations.

### LOD (Level of Detail)
A technique for using different model complexities based on viewing distance or importance. While Asset Forge doesn't implement automatic LOD systems, the quality settings (standard/high/ultra) effectively create different LOD levels during generation.

---

This glossary covers the essential terminology needed to understand Asset Forge's architecture, features, and implementation. For more detailed information about specific concepts, refer to the relevant sections of the main documentation.
