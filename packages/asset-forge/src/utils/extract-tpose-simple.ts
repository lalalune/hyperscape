import * as fs from 'fs'
import * as path from 'path'

interface ExtractOptions {
  inputPath: string
  outputPath: string
  verbose?: boolean
}

/**
 * Simple T-pose extraction by copying GLB and stripping animations
 * This approach preserves the exact scale structure of the original file
 */
async function extractTPoseSimple(options: ExtractOptions): Promise<void> {
  const { inputPath, outputPath, verbose = true } = options
  
  if (verbose) {
    console.log('🎯 Simple T-Pose Extraction Tool')
    console.log(`📥 Input: ${inputPath}`)
    console.log(`📤 Output: ${outputPath}`)
    console.log('---')
  }
  
  // Read the input file
  const inputBuffer = fs.readFileSync(inputPath)
  const inputSize = inputBuffer.length
    
    if (verbose) {
      console.log(`✅ Input file loaded: ${(inputSize / 1024 / 1024).toFixed(2)} MB`)
    }
    
    // GLB format: 
    // - 12 bytes: header (magic, version, length)
    // - Chunks: each chunk has 8 byte header (length, type) followed by data
    
    // Verify GLB magic number
    const magic = inputBuffer.readUInt32LE(0)
    if (magic !== 0x46546C67) { // 'glTF' in little-endian
      throw new Error('Not a valid GLB file')
    }
    
    const version = inputBuffer.readUInt32LE(4)
    const totalLength = inputBuffer.readUInt32LE(8)
    
    if (verbose) {
      console.log(`📊 GLB version: ${version}`)
      console.log(`📊 Total length: ${totalLength} bytes`)
    }
    
    // Parse chunks
    let offset = 12 // Skip header
    const chunks: Array<{ type: string, data: Buffer }> = []
    
    while (offset < inputBuffer.length) {
      const chunkLength = inputBuffer.readUInt32LE(offset)
      const chunkType = inputBuffer.readUInt32BE(offset + 4)
      
      const typeStr = String.fromCharCode(
        (chunkType >> 24) & 0xff,
        (chunkType >> 16) & 0xff,
        (chunkType >> 8) & 0xff,
        chunkType & 0xff
      )
      
      const chunkData = inputBuffer.slice(offset + 8, offset + 8 + chunkLength)
      chunks.push({ type: typeStr, data: chunkData })
      
      if (verbose) {
        console.log(`  Chunk: ${typeStr} (${chunkLength} bytes)`)
      }
      
      // Chunks are padded to 4-byte boundaries
      const paddedLength = Math.ceil(chunkLength / 4) * 4
      offset += 8 + paddedLength
    }
    
    // Find and modify the JSON chunk to remove animations
    const jsonChunk = chunks.find(c => c.type === 'JSON')
    if (!jsonChunk) {
      throw new Error('No JSON chunk found in GLB')
    }
    
    // Parse the glTF JSON
    const gltfJson = JSON.parse(jsonChunk.data.toString())
    
    if (verbose) {
      console.log(`\n🎬 Original animations: ${gltfJson.animations?.length || 0}`)
      if (gltfJson.animations) {
        gltfJson.animations.forEach((anim: { name?: string }, i: number) => {
          console.log(`  - Animation ${i}: ${anim.name || 'unnamed'}`)
        })
      }
    }
    
    // Remove animations
    delete gltfJson.animations
    
    // Convert back to buffer
    const newJsonStr = JSON.stringify(gltfJson)
    const newJsonBuffer = Buffer.from(newJsonStr)
    
    // Pad to 4-byte boundary
    const paddedLength = Math.ceil(newJsonBuffer.length / 4) * 4
    const paddedJsonBuffer = Buffer.alloc(paddedLength)
    newJsonBuffer.copy(paddedJsonBuffer)
    
    // Update JSON chunk
    jsonChunk.data = paddedJsonBuffer
    
    // Reconstruct GLB
    let newTotalLength = 12 // header
    chunks.forEach(chunk => {
      newTotalLength += 8 + chunk.data.length // chunk header + data
    })
    
    // Create output buffer
    const outputBuffer = Buffer.alloc(newTotalLength)
    
    // Write header
    outputBuffer.writeUInt32LE(0x46546C67, 0) // magic
    outputBuffer.writeUInt32LE(version, 4)
    outputBuffer.writeUInt32LE(newTotalLength, 8)
    
    // Write chunks
    offset = 12
    chunks.forEach(chunk => {
      // Chunk header
      outputBuffer.writeUInt32LE(chunk.data.length, offset)
      
      // Convert type string back to uint32
      const typeBytes = Buffer.from(chunk.type, 'ascii')
      typeBytes.copy(outputBuffer, offset + 4)
      
      // Chunk data
      chunk.data.copy(outputBuffer, offset + 8)
      
      offset += 8 + chunk.data.length
    })
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    // Write output file
    fs.writeFileSync(outputPath, outputBuffer)
    
    if (verbose) {
      const stats = fs.statSync(outputPath)
      console.log(`\n✅ T-pose exported successfully!`)
      console.log(`📁 File: ${outputPath}`)
      console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`🎬 Animations removed: ${gltfJson.animations?.length || 0}`)
    console.log('\n💡 The model is now in T-pose with the same scale structure as the original')
  }
}

// Export for use in other scripts
export { extractTPoseSimple }

// CLI usage
export async function runCLI() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.log('Usage: npm run assets:extract-tpose <input.glb> <output.glb>')
    console.log('Example: npm run assets:extract-tpose gdd-assets/goblin/animations/walking.glb gdd-assets/goblin/t-pose.glb')
    process.exit(1)
  }
  
  const inputPath = path.resolve(args[0])
  const outputPath = path.resolve(args[1])
  
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`)
    process.exit(1)
  }
  
  await extractTPoseSimple({ inputPath, outputPath })
  process.exit(0)
} 