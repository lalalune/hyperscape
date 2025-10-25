# Frequently Asked Questions (FAQ)

This FAQ addresses common questions about Asset Forge's functionality, costs, limitations, and best practices. Questions are organized by topic for easy navigation.

## Generation Costs and Pricing

### How much does it cost to generate assets?

Asset generation costs depend on the AI services used and the quality settings configured:

**DALL-E 3 Image Generation**
- Standard resolution (1024x1024): ~$0.04 per image
- High resolution (1024x1792): ~$0.08 per image
- Asset Forge uses standard resolution by default

**Meshy 3D Model Generation**
- Standard quality: ~$0.10-0.20 per model
- High quality: ~$0.30-0.50 per model
- Ultra quality: ~$0.80-1.20 per model
- Prices vary based on model complexity and processing time

**Material Variants (Retexturing)**
- ~$0.10-0.30 per variant
- Creating 3 variants (bronze, steel, mithril) costs ~$0.30-0.90 total

**Auto-Rigging**
- ~$0.20-0.40 per character
- Only applicable to humanoid character models

**Total Cost Examples**
- Simple weapon (standard quality, 3 variants, no sprites): ~$0.50-1.50
- High-quality armor piece (high quality, 5 variants, with sprites): ~$2.00-4.00
- Character model (ultra quality, rigged): ~$1.50-2.50

**Cost Reduction Strategies**
1. Use custom reference images instead of DALL-E (saves $0.04-0.08)
2. Disable retexturing for unique items that don't need variants
3. Choose standard quality for background assets, high/ultra for hero assets
4. Skip sprite generation unless needed for 2D gameplay elements
5. Batch similar assets to reuse prompts and reduce GPT-4 calls

**API Credits**
You need to maintain credits with:
- OpenAI (for GPT-4 and DALL-E)
- Meshy.ai (for 3D generation, retexturing, and rigging)

Costs are charged directly to your API accounts. Monitor usage through respective dashboards.

### Are there any free alternatives?

Partial free alternatives exist but with significant limitations:

**Free Options**
- **Meshy Free Tier**: Offers limited monthly credits (typically 10-20 generations)
- **OpenAI Free Trial**: New accounts receive $5 in credits
- **Local Image Generation**: Use Stable Diffusion locally instead of DALL-E (requires GPU)

**Limitations**
- Free tiers have strict rate limits and monthly caps
- Quality is often restricted to standard/preview modes
- No commercial usage rights on free tiers
- Processing times may be slower

**Self-Hosted Alternatives**
For complete cost elimination, consider:
- Running Stable Diffusion locally for concept art
- Using Blender with manual modeling (no AI)
- Importing pre-existing 3D models from free asset libraries

Asset Forge is designed for AI-powered generation; manual workflows bypass the automation benefits but eliminate API costs.

## Generation Time and Performance

### How long does generation take?

Generation time varies significantly based on quality settings and current API load:

**Pipeline Stage Timings**

1. **Text Input & GPT-4 Enhancement**: 5-15 seconds
   - GPT-4 processes descriptions quickly
   - Usually the fastest stage

2. **Image Generation (DALL-E)**: 10-30 seconds
   - Standard resolution: ~10-15 seconds
   - High resolution: ~20-30 seconds
   - Can be skipped if using custom reference images

3. **Image-to-3D Conversion (Meshy)**: 2-20 minutes
   - Standard quality: 2-5 minutes
   - High quality: 5-10 minutes
   - Ultra quality: 10-20 minutes
   - Time varies with model complexity and queue length

4. **Retexturing (Material Variants)**: 3-15 minutes per variant
   - Depends on texture resolution and quality
   - Multiple variants process sequentially
   - 3 variants: ~10-45 minutes total

5. **Auto-Rigging**: 5-15 minutes
   - Only for character models
   - Includes skeleton generation and weight painting

6. **Sprite Generation**: 1-5 minutes
   - Depends on number of angles and resolution
   - Runs locally, relatively fast

**Total Generation Time Examples**
- Minimum (standard weapon, no variants): ~3-7 minutes
- Typical (high-quality armor, 3 variants): ~20-40 minutes
- Maximum (ultra character, rigged, 5 variants): ~60-120 minutes

**Factors Affecting Speed**
- API server load (peak times are slower)
- Model complexity (detailed designs take longer)
- Quality settings (ultra is significantly slower)
- Number of variants (each adds processing time)
- Network connection speed
- Meshy queue position

**Optimization Tips**
1. Start generations during off-peak hours
2. Use standard quality for rapid prototyping
3. Generate base models first, add variants later
4. Test with simple prompts before complex ones
5. Monitor Meshy's status page for service health

### Can I generate multiple assets simultaneously?

Currently, Asset Forge processes one generation pipeline at a time through the UI. However:

**Single Pipeline Limitation**
- The UI tracks one active pipeline ID
- Starting a new generation while one is running may cause conflicts
- Wait for current generation to complete before starting another

**Workaround for Concurrent Generation**
- Open multiple browser tabs/windows of Asset Forge
- Each can run independent pipelines
- Monitor different generations in different tabs
- Be cautious of API rate limits

**Planned Features**
- Queue system for batch generation
- Parallel pipeline processing
- Background generation with notifications

**API-Level Concurrency**
If using the backend API directly (not UI):
- Multiple pipeline requests can be submitted
- Each receives a unique pipeline ID
- Poll each pipeline independently
- Meshy handles queuing automatically

**Rate Limits**
Be aware of API rate limits:
- OpenAI: ~3,500 requests/minute (generous for typical use)
- Meshy: Varies by subscription tier
- Exceeding limits causes temporary throttling

## Asset Import and Export

### Can I use my own 3D models?

Yes, Asset Forge supports importing custom 3D models for various workflows:

**Supported Import Scenarios**

1. **Armor Fitting**
   - Import custom character models (GLB/GLTF)
   - Import custom armor pieces
   - Fit armor to characters using the fitting service
   - Export fitted, bound armor

2. **Hand Rigging**
   - Import weapon models
   - Automatically detect grip points
   - Export rigged weapons with grip metadata

3. **Sprite Generation**
   - Import any 3D model
   - Generate 2D sprites from multiple angles
   - Export sprite sheets

4. **Asset Library Management**
   - Manually add models to `gdd-assets/` folder
   - Create metadata.json files
   - Models appear in asset library

**File Format Requirements**
- Primary format: GLB (recommended)
- Alternative: GLTF with embedded resources
- Must contain valid geometry
- Textures should be embedded or referenced correctly

**Import Limitations**
- No direct import UI in generation pipeline (use file browser)
- Complex rigs may need manual adjustment
- Non-standard bone hierarchies might cause fitting issues
- Materials should be PBR-compatible for best results

**Best Practices**
1. Export models in T-pose for rigging/fitting
2. Use standard bone naming conventions
3. Embed textures in GLB files
4. Keep polycount reasonable (< 50K triangles)
5. Center models at origin before export
6. Apply transforms in source application before export

### What file formats are supported?

Asset Forge works exclusively with GLTF-family formats:

**Supported Formats**

**GLB (GL Binary)** ✅
- Recommended format
- Single binary file
- All resources embedded
- Efficient for web use
- Generated by Meshy
- Used throughout Asset Forge

**GLTF (GL Transmission Format)** ✅
- JSON-based format
- Separate texture files
- Human-readable
- Less common in Asset Forge
- Can be imported if resources are available

**Unsupported Formats** ❌
- FBX: Use Blender to convert to GLB
- OBJ: Use Blender to convert to GLB
- STL: Use Blender to convert to GLB
- Collada (.dae): Use Blender to convert to GLB
- 3DS: Use Blender to convert to GLB

**Texture Formats**
Within GLTF/GLB files:
- PNG: Fully supported
- JPEG: Fully supported
- WebP: Supported in modern browsers
- KTX2: Advanced compressed format, limited support

**Export Formats**
Asset Forge exports in:
- GLB for 3D models
- PNG for concept art and sprites
- JSON for metadata

**Conversion Tools**
To convert other formats to GLB:
1. **Blender** (free, recommended)
   - File → Import → [Your Format]
   - File → Export → glTF 2.0
   - Choose "GLB" format
   - Enable "Remember Export Settings"

2. **Online Converters**
   - https://products.aspose.app/3d/conversion (various formats)
   - https://modelviewer.dev/editor/ (viewer and converter)

3. **Command-Line Tools**
   - gltf-pipeline (npm package)
   - obj2gltf (npm package)

**Format Validation**
Ensure your GLB files are valid:
- Use https://gltf-viewer.donmccurdy.com/ to preview
- Check for errors using https://github.khronos.org/glTF-Validator/

## Prompt Engineering and Quality

### How do I make better prompts?

Effective prompts are crucial for high-quality asset generation. Follow these guidelines:

**Prompt Structure**
```
[Asset Type] [Material/Style] [Distinctive Features] [Details] [Art Style Reference]
```

**Good Prompt Example**
```
A medieval longsword with a leather-wrapped handle, silver crossguard,
and runes etched along the blade. The pommel features a red gemstone.
Low-poly 3D model, game-ready, RuneScape art style.
```

**Bad Prompt Example**
```
sword
```

**Key Elements to Include**

1. **Asset Type** (Required)
   - Be specific: "longsword" not "weapon"
   - Include size: "one-handed", "two-handed"
   - Specify variant: "curved scimitar" vs "straight blade"

2. **Materials** (Recommended)
   - Primary material: steel, wood, leather
   - Secondary materials: brass fittings, cloth wrapping
   - Material finish: polished, rusted, weathered

3. **Distinctive Features** (Recommended)
   - Unique elements: "skull pommel", "serrated edge"
   - Decorative aspects: "gold inlay", "carved patterns"
   - Functional features: "double-edged", "hooked blade"

4. **Color and Texture** (Optional but helpful)
   - Primary colors: "dark iron", "crimson leather"
   - Texture qualities: "rough-hewn", "smooth polished"
   - Weathering: "battle-worn", "pristine"

5. **Art Style** (Highly Recommended)
   - Reference game: "RuneScape style", "WoW style"
   - Style descriptors: "low-poly", "stylized", "hand-painted"
   - Avoid: "realistic", "photorealistic" (usually poor results)

**Advanced Techniques**

**Use GPT-4 Enhancement**
- Enable GPT-4 enhancement in settings
- Provide a basic description
- GPT-4 expands it with technical details
- Review and adjust the enhanced prompt

**Negative Prompts** (Advanced)
- While not directly supported, describe what you DON'T want
- Example: "simple design, no excessive ornamentation"

**Iteration Strategy**
1. Start with a basic prompt
2. Generate a test asset (standard quality)
3. Identify what's missing or incorrect
4. Add specific details to address issues
5. Regenerate with improved prompt
6. Repeat until satisfied

**Category-Specific Tips**

**Weapons**
- Specify grip: "leather-wrapped handle", "wooden shaft"
- Describe blade: "curved", "straight", "serrated"
- Include guard: "crossguard", "basket hilt", "no guard"
- Mention weight class: "light dagger", "heavy greatsword"

**Armor**
- Specify slot: "chestplate", "helmet", "gauntlets"
- Describe coverage: "full plate", "leather pauldrons", "chainmail"
- Include decoration: "engraved", "plain", "emblazoned with symbol"
- Mention articulation: "segmented plates", "solid piece"

**Characters**
- Describe body type: "humanoid", "muscular", "slender"
- Specify proportions: "heroic proportions", "realistic"
- Include clothing: "robed", "armored", "tribal garments"
- Mention pose: "T-pose" (critical for rigging)

**Items and Props**
- Describe function: "healing potion", "treasure chest"
- Specify size: "small vial", "large barrel"
- Include details: "cork stopper", "iron bands"
- Mention contents: "glowing liquid", "gold coins"

**Common Mistakes to Avoid**
- Too vague: "make a cool sword"
- Too realistic: "photorealistic chainmail armor"
- Conflicting styles: "medieval laser sword"
- Too complex: describing 10 different elements (AI gets confused)
- Wrong format: describing a scene instead of an object
- Missing art style: fails to match game aesthetic

**Testing and Refinement**
- Save prompts that work well
- Build a library of effective prompt templates
- Share successful prompts with team
- Use custom asset types to save prompt patterns

### Why is my generation failing?

Generation failures can occur at various stages. Here's how to diagnose and fix common issues:

**Stage 1: GPT-4 Enhancement Failures**

**Symptoms**
- Error during prompt processing
- "Failed to enhance prompt" message

**Common Causes**
- Invalid API key
- Insufficient OpenAI credits
- Rate limit exceeded
- Extremely long input text

**Solutions**
1. Verify `VITE_OPENAI_API_KEY` in `.env`
2. Check OpenAI account for available credits
3. Wait a few minutes if rate limited
4. Shorten your description
5. Disable GPT-4 enhancement and use manual prompts

**Stage 2: Image Generation Failures**

**Symptoms**
- DALL-E fails to create concept art
- "Image generation failed" error

**Common Causes**
- Prohibited content in prompt (weapons with extreme violence)
- API key issues
- Service outage
- Prompt too complex or contradictory

**Solutions**
1. Review OpenAI's content policy
2. Simplify prompt, remove potentially problematic words
3. Check OpenAI status page
4. Try again in a few minutes
5. Use custom reference image to bypass DALL-E

**Stage 3: 3D Model Generation Failures**

**Symptoms**
- Meshy task fails or times out
- "Model generation failed" message
- Stuck on "processing" for 30+ minutes

**Common Causes**
- Invalid Meshy API key
- Reference image too complex or unclear
- Insufficient Meshy credits
- Service timeout or outage
- Image doesn't contain a clear object

**Solutions**
1. Verify `VITE_MESHY_API_KEY` in `.env`
2. Check Meshy account credits
3. Check Meshy status page
4. Review reference image - is object clear and centered?
5. Try simpler prompt with less detail
6. Use standard quality instead of ultra
7. Wait and retry if service is degraded

**Stage 4: Retexturing Failures**

**Symptoms**
- Base model generated but variants fail
- "Retexturing failed" for some materials

**Common Causes**
- Meshy service issues
- Invalid material prompts
- Base model unsuitable for retexturing
- Insufficient credits

**Solutions**
1. Skip failed variant and generate it separately later
2. Check material preset prompts for conflicts
3. Try different material presets
4. Ensure base model has proper UVs

**Stage 5: Rigging Failures**

**Symptoms**
- Model generated but rigging fails
- "Auto-rigging failed" error

**Common Causes**
- Model not humanoid
- Model not in T-pose
- Multiple disconnected meshes
- Extreme proportions

**Solutions**
1. Ensure prompt specifies "T-pose"
2. Verify model is humanoid in structure
3. Use high or ultra quality (better rigging results)
4. Try regenerating with simplified prompt
5. Skip auto-rigging and rig manually in Blender

**General Troubleshooting Steps**

1. **Check Browser Console**
   - Open DevTools (F12)
   - Look for error messages
   - Check Network tab for failed requests

2. **Verify API Keys**
   - Ensure `.env` file exists
   - Confirm keys are correct (no extra spaces)
   - Restart dev server after changing `.env`

3. **Check API Credits**
   - OpenAI dashboard: https://platform.openai.com/usage
   - Meshy dashboard: https://app.meshy.ai/
   - Add credits if low

4. **Review Service Status**
   - OpenAI: https://status.openai.com/
   - Meshy: Check their website or Discord

5. **Inspect Pipeline State**
   - Open Redux DevTools
   - Check generation store state
   - Look for error messages in pipeline stages

6. **Test with Known-Good Prompt**
```
A simple bronze dagger with leather handle,
low-poly 3D model, game-ready, stylized art style
```

If this fails, the issue is environmental (API keys, credits, services).
If this succeeds, the issue is with your custom prompt.

7. **Check Logs**
   - Backend console output
   - Look for error stack traces
   - Check for timeout messages

**Getting Help**
If issues persist:
1. Copy exact error message
2. Note which pipeline stage failed
3. Share your prompt (if comfortable)
4. Check generation history for patterns
5. Report issue with reproduction steps

## Editing and Customization

### Can I edit generated models?

Yes, generated models can be edited using external 3D software:

**Recommended Tools**

**Blender** (Free, Open Source)
- Industry-standard 3D software
- Full support for GLTF/GLB
- Comprehensive modeling, texturing, rigging tools
- Python scripting for batch operations

**Other Options**
- Cinema 4D: Professional, expensive
- Maya: Professional, expensive
- 3ds Max: Professional, expensive, Windows only
- Houdini: Procedural modeling
- ZBrush: Sculpting and high-poly detail

**Editing Workflow**

1. **Export from Asset Forge**
   - Download GLB from asset library
   - Save to local file system

2. **Import to Blender**
   - File → Import → glTF 2.0
   - Navigate to downloaded GLB
   - Import settings: default works well

3. **Make Edits**
   - Modify geometry, materials, textures
   - Add details or simplify
   - Adjust UV mapping
   - Edit rig or animations

4. **Export from Blender**
   - File → Export → glTF 2.0
   - Choose GLB format
   - Check "Remember Export Settings"
   - Export

5. **Re-import to Asset Forge**
   - Place GLB in `gdd-assets/[asset-name]/`
   - Refresh asset library
   - Model updates automatically

**Common Edits**

**Geometry Changes**
- Add details: engravings, damage, wear
- Simplify: reduce polycount for performance
- Scale: adjust proportions
- Combine: merge multiple models

**Material Adjustments**
- Change colors via PBR base color
- Adjust metalness/roughness
- Add texture maps
- Create custom materials

**Rigging Modifications**
- Adjust skin weights for better deformation
- Add or remove bones
- Rename bones for compatibility
- Create custom animations

**UV Unwrapping**
- Improve existing UVs
- Create custom UV layouts
- Fix stretching or distortion

**Non-Destructive Workflow**
To preserve original:
1. Create backup of original GLB
2. Save edited version with different name
3. Create new asset entry with edited version
4. Keep both in library for comparison

**Blender Tips for Game Assets**
- Use Edit Mode for geometry changes
- Use Shader Editor for material adjustments
- Use Weight Paint mode for rigging
- Use UV Editor for texture mapping
- Apply all transforms before export (Ctrl+A)
- Check "Export Deformation Bones Only" for rigged models

### How do I add custom materials?

Asset Forge supports custom materials for retexturing:

**Method 1: Custom Material Presets (UI)**

1. **Open Generation Page**
2. **Configure Retexturing**
   - Enable "Generate Material Variants"
   - Scroll to material selection

3. **Add Custom Material**
   - Click "Add Custom Material"
   - Enter material name (e.g., "Dragonscale")
   - Enter display name (e.g., "Dragonscale Armor")
   - Choose a color for UI display
   - Enter style prompt:
     ```
     Made of iridescent dragonscale material with
     shimmering green and blue hues, overlapping
     scales with a glossy finish
     ```

4. **Select for Generation**
   - Check your custom material
   - Proceed with generation
   - Variant will be created using your prompt

**Method 2: Edit material-presets.json**

1. **Locate File**
   ```
   packages/asset-forge/public/material-presets.json
   ```

2. **Add New Preset**
   ```json
   {
     "id": "dragonscale",
     "name": "dragonscale",
     "displayName": "Dragonscale",
     "category": "special",
     "tier": 5,
     "color": "#1e9e6d",
     "stylePrompt": "Made of iridescent dragonscale material with shimmering green and blue hues, overlapping scales with a glossy finish"
   }
   ```

3. **Save File**
4. **Reload Application**
   - Preset appears in material list
   - Available for all future generations

**Material Preset Fields**

- `id`: Unique identifier (lowercase, no spaces)
- `name`: Internal name
- `displayName`: Name shown in UI
- `category`: "metals", "gemstones", "special", "organic", "magical"
- `tier`: 1-5 (affects filtering and organization)
- `color`: Hex color for UI chip display
- `stylePrompt`: Description for Meshy retexturing

**Style Prompt Guidelines**

Good prompts include:
- Base material: "made of steel"
- Visual properties: "dark gray color, brushed metal finish"
- Texture details: "slightly scratched, battle-worn"
- Special effects: "faint blue glow along edges" (use sparingly)

Avoid:
- Changing geometry: "add spikes" (retexturing doesn't modify shape)
- Dramatic style changes: "make it look organic" (stick to material swaps)
- Conflicting descriptions: "shiny and matte" (be consistent)

**Material Categories**

**Metals**
- bronze, iron, steel, mithril, adamantite
- silver, gold, platinum, electrum
- darksteel, cobalt, titanium

**Gemstones**
- ruby, sapphire, emerald, diamond
- amethyst, topaz, onyx, jade

**Special**
- dragonbone, obsidian, crystal, ethereal
- shadow, radiant, void, celestial

**Organic**
- wood, bone, chitin, leather
- vine, bark, shell, coral

**Magical**
- arcane, frost, flame, lightning
- holy, unholy, void, astral

**Testing Custom Materials**
1. Start with one custom material
2. Generate a test asset
3. Review quality of variant
4. Adjust style prompt if needed
5. Add to preset library once satisfied

## Quality and Technical Questions

### What's the difference between quality levels?

Asset Forge offers three quality levels affecting generation time, cost, and output:

**Standard Quality**

**Characteristics**
- Polycount: 5,000-10,000 triangles
- Generation time: 2-5 minutes
- Cost: ~$0.10-0.20 per model
- Texture resolution: 1024x1024
- Detail level: Basic shapes, major features

**Best For**
- Rapid prototyping and concept testing
- Background assets and props
- Items viewed from a distance
- Mobile games and low-spec targets
- Quick iteration during design phase

**Limitations**
- Less geometric detail
- Simpler materials
- May miss fine features
- Lower texture quality

**High Quality** (Default)

**Characteristics**
- Polycount: 15,000-30,000 triangles
- Generation time: 5-10 minutes
- Cost: ~$0.30-0.50 per model
- Texture resolution: 2048x2048
- Detail level: Good detail, most features captured

**Best For**
- Primary game assets
- Hero weapons and armor
- Character models
- Assets viewed up close
- Production-ready content

**Advantages**
- Balance of quality and speed
- Sufficient detail for most uses
- Reasonable cost
- Good material definition

**Ultra Quality**

**Characteristics**
- Polycount: 50,000+ triangles
- Generation time: 10-20 minutes
- Cost: ~$0.80-1.20 per model
- Texture resolution: 4096x4096
- Detail level: Excellent detail, fine features

**Best For**
- Hero assets and centerpieces
- Marketing materials and renders
- Cinematic close-ups
- High-end PC games
- Portfolio pieces

**Considerations**
- Significantly longer generation time
- Higher cost per asset
- May need decimation for real-time use
- Large file sizes

**Quality Comparison Table**

| Aspect | Standard | High | Ultra |
|--------|----------|------|-------|
| Polycount | 5-10K | 15-30K | 50K+ |
| Time | 2-5 min | 5-10 min | 10-20 min |
| Cost | $0.10-0.20 | $0.30-0.50 | $0.80-1.20 |
| Texture | 1024px | 2048px | 4096px |
| Detail | Basic | Good | Excellent |
| Use Case | Background | Primary | Hero |

**Choosing Quality Level**

Ask yourself:
1. **How close will players see this?**
   - Distance: Standard
   - Medium: High
   - Close-up: Ultra

2. **What's the asset's importance?**
   - Generic prop: Standard
   - Player equipment: High
   - Legendary item: Ultra

3. **What's my timeline?**
   - Rapid prototyping: Standard
   - Production: High
   - Marketing: Ultra

4. **What's my budget?**
   - Limited: Standard
   - Moderate: High
   - Premium: Ultra

5. **What's my target platform?**
   - Mobile/Web: Standard
   - Console: High
   - High-end PC: Ultra

**Quality Upgrade Strategy**
1. Generate all assets at standard for concept approval
2. Regenerate approved assets at high quality
3. Select hero assets for ultra quality treatment
4. Apply optimization to ultra assets if needed

**Post-Generation Optimization**
Ultra quality models can be decimated:
- Use Blender's Decimate modifier
- Reduce to 50-75% polycount
- Preserve UV mapping and materials
- Often indistinguishable from direct high-quality generation

## Advanced Features

### How does hand rigging work?

Hand rigging automatically determines where and how a character's hand should hold a weapon:

**Process Overview**

1. **Weapon Upload**
   - User imports weapon GLB file
   - System analyzes geometry

2. **Handle Detection**
   - Automated algorithm identifies grip section
   - Looks for cylindrical shapes, appropriate sizing
   - Considers position (typically center/bottom of weapon)

3. **Orthographic Rendering**
   - Weapon rendered from multiple angles
   - Creates 2D reference images
   - Ensures consistent lighting and framing

4. **Hand Pose Generation**
   - MediaPipe AI analyzes rendered images
   - Detects hand landmarks (21 points)
   - Calculates natural grip position

5. **Grip Point Calculation**
   - 3D position computed from 2D detections
   - Orientation determined from handle angle
   - Offset values stored in metadata

6. **Export**
   - Rigged weapon saved with grip metadata
   - Can be used in character animation systems
   - Metadata includes position, rotation, scale adjustments

**Technical Details**

**MediaPipe Hand Detection**
- Detects 21 landmarks per hand
- Key points: wrist, thumb tip, index finger tip, palm center
- Confidence scores for each detection
- Works on 2D images of 3D renders

**Grip Point Definition**
Stored as:
```json
{
  "gripPosition": [0.0, 0.5, 0.0],
  "gripRotation": [0, 0, 0],
  "gripScale": 1.0,
  "handOffset": [0.1, 0, 0]
}
```

**Use Cases**
- Character animation: position hand relative to weapon
- Inventory previews: show weapon being held
- Combat systems: accurate weapon placement
- Character customization: weapon fits any character rig

**Limitations**
- Works best with traditional weapon shapes
- Unusual weapons may need manual adjustment
- Detection quality depends on handle clarity
- Currently supports right-hand grip (left-hand planned)

**Manual Override**
If automatic detection fails:
1. Use Blender to add empty object at grip point
2. Name it "GripPoint"
3. Export with weapon
4. Asset Forge reads empty location as grip

### How does armor fitting work?

Armor fitting automatically adapts armor pieces to character models:

**Fitting Process**

1. **Model Loading**
   - Character model loaded (must be rigged)
   - Armor piece loaded (can be static)
   - Both displayed in 3D viewer

2. **Skeleton Analysis**
   - Character skeleton extracted
   - Bone positions and hierarchy analyzed
   - Reference bones identified (spine, chest, shoulders)

3. **Mesh Deformation (Shrinkwrap)**
   - Armor vertices projected onto character surface
   - Ray casting determines nearest body points
   - Armor mesh deformed to conform to body shape
   - Offset applied to prevent z-fighting

4. **Weight Transfer**
   - Character skin weights analyzed
   - For each armor vertex, find nearest body vertex
   - Copy skin weights from body to armor
   - Smooth weight transitions across armor surface

5. **Binding**
   - Armor converted to SkinnedMesh
   - Bound to character skeleton
   - Shares bone hierarchy with character
   - Now animates with character

6. **Export**
   - Fitted, bound armor saved as GLB
   - Includes skeleton references
   - Ready for use in animation system

**Fitting Parameters**

**Offset**
- Distance armor floats above body surface
- Too small: armor clips into body
- Too large: armor looks detached
- Typical: 0.01-0.05 units

**Sample Density**
- Number of sample points for weight transfer
- Higher: more accurate, slower
- Lower: faster, less accurate
- Typical: 100-500 samples

**Smoothing Iterations**
- Number of weight smoothing passes
- Reduces sharp weight transitions
- Higher: smoother, potentially less accurate
- Typical: 2-5 iterations

**Best Practices**
1. Use T-pose characters for fitting
2. Ensure armor and character are similar scale
3. Start with default parameters
4. Adjust offset if clipping or gaps occur
5. Increase sample density for complex armor
6. Test fitted armor with animations

**Common Issues**

**Armor Too Small/Large**
- Use scale controls before fitting
- Fitting doesn't auto-scale, only deforms

**Clipping**
- Increase offset parameter
- Armor may need manual editing in Blender

**Detached Sections**
- Armor piece may have disconnected parts
- Weight transfer treats each part independently
- May need manual weight painting

**Deformation Artifacts**
- Increase smoothing iterations
- Increase sample density
- Check character rig quality

### Can I generate animations?

Animation support in Asset Forge is limited but growing:

**Current Animation Support**

**Rigged Characters**
- Auto-rigging creates skeleton
- Basic T-pose rig included
- No animations generated currently

**Animation Preservation**
- If source model has animations, they're preserved
- GLTF animation clips maintained during processing
- Can be viewed in external tools (Blender, Three.js viewer)

**Animation-Related Tools**

**T-Pose Extraction**
- Removes animations from rigged models
- Returns character to base T-pose
- Useful for fitting and rigging operations

**Sprite Animation**
- Generate sprites from animated models
- Capture different animation frames
- Create sprite sheets for 2D animations

**Planned Animation Features**

**Animation Generation** (Roadmap)
- Integration with animation AI services (Mixamo, etc.)
- Auto-generate walk, run, attack, idle cycles
- Apply animations to rigged characters

**Animation Retargeting**
- Transfer animations between characters
- Adapt animations to different skeletal structures

**Current Workaround**

1. **Generate Rigged Character in Asset Forge**
2. **Export to Mixamo**
   - Upload GLB to https://www.mixamo.com/
   - Mixamo auto-rigs (or uses existing rig)
   - Apply animations from Mixamo library
   - Download with animations

3. **Re-import to Asset Forge**
   - Place animated GLB in asset library
   - Animations preserved and playable

**Animation in Hyperscape**
If using assets in Hyperscape:
- Hyperscape has its own animation system
- Rigged assets integrate with Hyperscape character controller
- Animations defined in Hyperscape game code

## Export and Integration

### How do I export for Unity/Unreal/Blender?

Asset Forge generates GLB files compatible with all major engines:

**Unity**

1. **Export GLB from Asset Forge**
2. **Import to Unity**
   - Drag GLB into Assets folder
   - Unity auto-converts to internal format
   - Materials may need adjustment

3. **Material Setup**
   - Unity creates materials from GLTF
   - May default to Standard shader
   - Consider switching to URP or HDRP shaders
   - Adjust metalness/roughness as needed

4. **Rigging/Animations**
   - Unity reads GLTF skeleton and animations
   - Configure as "Humanoid" or "Generic" avatar
   - Animations appear in Animation window

**Unreal Engine**

1. **Export GLB from Asset Forge**
2. **Import to Unreal**
   - Use Import dialog
   - Choose GLB file
   - Configure import settings:
     - Import Mesh: Yes
     - Import Materials: Yes
     - Import Textures: Yes

3. **Material Conversion**
   - Unreal creates material instances
   - PBR maps connected automatically
   - May need to adjust material blend modes

4. **Skeletal Meshes**
   - Import as Skeletal Mesh if rigged
   - Skeleton asset created automatically
   - Animations imported as Animation Sequences

**Blender**

1. **Export GLB from Asset Forge**
2. **Import to Blender**
   - File → Import → glTF 2.0
   - Select GLB file
   - Default settings work well

3. **Editing**
   - All data imports: mesh, materials, rig, animations
   - PBR materials use Principled BSDF
   - Fully editable

4. **Re-export**
   - File → Export → glTF 2.0
   - Choose GLB format
   - "Remember Export Settings" recommended

**Godot**

1. **Export GLB from Asset Forge**
2. **Import to Godot**
   - Drag GLB into FileSystem dock
   - Godot processes automatically
   - Double-click to open in scene

3. **Integration**
   - Instance into scene
   - Materials converted to Godot materials
   - Animations available in AnimationPlayer

**Three.js (Web)**

Asset Forge uses Three.js internally, so exports are natively compatible:

```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const loader = new GLTFLoader()
loader.load('path/to/model.glb', (gltf) => {
  scene.add(gltf.scene)
  // Access animations
  const mixer = new THREE.AnimationMixer(gltf.scene)
  gltf.animations.forEach((clip) => {
    mixer.clipAction(clip).play()
  })
})
```

**Babylon.js**

```javascript
BABYLON.SceneLoader.ImportMesh(
  '',
  'path/to/',
  'model.glb',
  scene,
  (meshes) => {
    // Meshes loaded
  }
)
```

**General Tips**
- GLB is universally supported
- PBR materials translate well across engines
- Rigging may need minor adjustments per engine
- Test in target engine early in pipeline
- Keep polycount appropriate for target platform

## Usage Limits and Policies

### Is there a limit on assets?

Asset Forge itself has no hard limits, but practical constraints exist:

**Asset Forge Limits**
- No maximum number of assets in library
- No storage quotas (local file system)
- No restrictions on generations per day (app-level)

**API Service Limits**

**OpenAI**
- Rate limits: ~3,500 requests/minute
- Usage limits: Based on account tier
- Billing limits: Set in OpenAI dashboard
- Free tier: $5 credit (new accounts)

**Meshy**
- Free tier: 10-20 generations/month
- Paid tiers: Varies by subscription
- Concurrent generations: Limited by tier
- Monthly credits: Resets monthly

**Practical Limits**

**File System Storage**
- Each asset: 5-20 MB (GLB + textures + metadata)
- 100 assets: ~500 MB - 2 GB
- 1000 assets: ~5 GB - 20 GB
- Consider storage capacity of your machine

**Performance**
- Large asset libraries (1000+) may slow UI
- Loading all assets at once impacts browser memory
- Pagination recommended for large libraries

**Recommended Practices**
1. Organize assets into projects/folders
2. Archive unused assets periodically
3. Monitor API usage and costs
4. Set billing alerts in API dashboards
5. Use standard quality for testing, high/ultra for finals
6. Delete failed/test generations regularly

**Scaling Up**
For production use with thousands of assets:
- Implement database for asset metadata
- Use cloud storage for GLB files
- Add pagination to asset browser
- Consider caching strategies

### How do I contribute?

Asset Forge is part of the Hyperscape project and welcomes contributions:

**Types of Contributions**

**Code Contributions**
- Bug fixes
- New features
- Performance improvements
- Test coverage
- Documentation

**Content Contributions**
- Material presets
- Prompt templates
- Example assets
- Tutorial content

**Documentation**
- Improve existing docs
- Add examples
- Create guides
- Translate documentation

**Reporting Issues**
- Bug reports
- Feature requests
- Usability feedback

**Contribution Workflow**

1. **Fork Repository**
   ```bash
   git clone https://github.com/[org]/hyperscape
   cd hyperscape/packages/asset-forge
   ```

2. **Create Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow coding standards (see CLAUDE.md)
   - Write tests for new features
   - Update documentation

4. **Test Changes**
   ```bash
   bun run typecheck
   bun run lint
   # Test manually in browser
   ```

5. **Commit Changes**
   - Write clear commit messages
   - Reference issue numbers if applicable

6. **Submit Pull Request**
   - Describe changes clearly
   - Link to related issues
   - Add screenshots for UI changes

**Development Guidelines**
- Follow TypeScript strong typing rules (no `any`)
- Prefer editing existing files over creating new ones
- Write real tests, not mocks
- Keep features modular and self-contained

**Getting Help**
- Check existing documentation
- Review similar implementations in codebase
- Ask in project discussions/chat
- Reference architectural decision records (ADRs)

**Recognition**
- Contributors credited in project
- Significant contributions acknowledged in releases

---

This FAQ covers the most common questions about Asset Forge. For more detailed information, refer to the main documentation sections. If your question isn't answered here, please check the documentation index or reach out to the development team.
