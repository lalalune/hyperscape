# RuneScape AI Generation Testing Guide

## Prerequisites

1. **Meshy AI API Key**: Sign up at https://www.meshy.ai and get your API key
2. **Environment Setup**: Set your API key:
   ```bash
   export MESHY_API_KEY="your-api-key-here"
   ```

## Testing Single Item Generation

Run the test script to generate a single item (Bronze Sword) with full PBR textures:

```bash
cd packages/hyperfy/src/rpg/ai-creation
bun run test-single-item-generation.ts
```

### What the Test Does:

1. **Generates a 3D Model**: Creates a Bronze Sword using Meshy AI's two-stage workflow
   - Preview stage: Generates base mesh
   - Refine stage: Applies PBR textures

2. **Downloads All Assets**:
   - GLB model file
   - Base color texture (diffuse/albedo)
   - Metallic map
   - Normal map  
   - Roughness map
   - Preview video (if available)

3. **Validates the Output**:
   - Checks GLB file format validity
   - Verifies all texture files exist
   - Confirms hardpoint detection (grip positions)

### Expected Output:

```
🧪 Testing Single Item Generation with PBR Textures
============================================================

📦 Test Item: Bronze Sword (ID: 1)
📝 Description: A bronze sword, a basic weapon for beginners
⚔️  Type: sword

🎨 Starting generation pipeline...
🔨 Processing item_1: Bronze Sword
🎯 Generating complete 3D model: "A bronze sword, a basic weapon for beginners"
✅ Complete model generated successfully

📥 Downloaded Assets:
   Model: ./generation-output/models/1/[taskId]_model.glb
   Textures:
     - Base Color: ./generation-output/models/1/[taskId]_base_color.png
     - Metallic: ./generation-output/models/1/[taskId]_metallic.png
     - Normal: ./generation-output/models/1/[taskId]_normal.png
     - Roughness: ./generation-output/models/1/[taskId]_roughness.png

🔍 Validating GLB file...
   File Size: XX.XKB
   ✅ Valid GLB file (glTF binary format)

🎨 Validating PBR textures...
   ✅ baseColor: XX.XKB
   ✅ metallic: XX.XKB
   ✅ normal: XX.XKB
   ✅ roughness: XX.XKB
   Total textures: 4

🎯 Detected Hardpoints:
   Primary Grip: {"x":0,"y":0.2,"z":0}
   Confidence: 85.0%

✅ Test completed successfully!
```

## Running Full Batch Generation

Once the single item test passes, you can generate all items:

```bash
bun run generate-all-runescape-items.ts
```

This will:
- Load all items from JSON files
- Skip any already generated models
- Generate 3D models with PBR textures for each item
- Save everything to `./generation-output/runescape-items/`
- Create an HTML report of the generation process

## Output Structure

```
generation-output/
├── models/
│   └── {item_id}/
│       ├── {taskId}_model.glb          # 3D model
│       ├── {taskId}_base_color.png     # Diffuse texture
│       ├── {taskId}_metallic.png       # Metallic map
│       ├── {taskId}_normal.png         # Normal map
│       ├── {taskId}_roughness.png      # Roughness map
│       └── {taskId}_preview.mp4        # Preview video
└── runescape-items/
    ├── {id}_{name}.glb                 # Final remeshed models
    ├── generation-cache.json           # Cache for resuming
    └── generation-report.html          # Visual report
```

## Troubleshooting

1. **"MESHY_API_KEY environment variable is not set!"**
   - Make sure you've exported your API key in the current terminal session

2. **"Canvas module not available"**  
   - This warning is normal - the system uses a fallback for texture generation

3. **Generation fails with API errors**
   - Check your Meshy AI quota/credits
   - Verify your API key is valid
   - Try reducing batch size in CONFIG

4. **Models missing textures**
   - Ensure `enablePbr: true` in the generation config
   - Check that all texture files downloaded successfully

## Viewing Generated Models

You can view the generated GLB files in:
- **Blender**: Import as glTF 2.0
- **Three.js Editor**: https://threejs.org/editor/
- **Babylon.js Sandbox**: https://sandbox.babylonjs.com/
- **glTF Viewer**: https://gltf-viewer.donmccurdy.com/

The textures should be automatically applied when loading the GLB file. 