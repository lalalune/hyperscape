/**
 * Validator Security Tests
 *
 * Tests path traversal prevention and input validation
 */

import { validateAssetId, validateNpcId, validateFilename, validateDirectoryName } from '../validators.mjs'

// Test helper
function expectError(fn, message) {
  try {
    fn()
    console.error(`❌ Expected error but none was thrown: ${message}`)
    return false
  } catch (error) {
    console.log(`✅ ${message}: ${error.message}`)
    return true
  }
}

function expectSuccess(fn, value, message) {
  try {
    const result = fn()
    if (result === value) {
      console.log(`✅ ${message}: ${result}`)
      return true
    } else {
      console.error(`❌ Expected ${value} but got ${result}: ${message}`)
      return false
    }
  } catch (error) {
    console.error(`❌ Unexpected error: ${message}: ${error.message}`)
    return false
  }
}

console.log('\n🔒 Testing Path Traversal Prevention\n')

// Path traversal attacks
expectError(() => validateAssetId('../../../etc/passwd'), 'Blocks ../../../etc/passwd')
expectError(() => validateAssetId('..\\..\\..\\windows\\system32'), 'Blocks ..\\..\\..\\windows\\system32')
expectError(() => validateAssetId('asset/../../../etc/passwd'), 'Blocks asset/../../../etc/passwd')
expectError(() => validateAssetId('asset/../../etc/passwd'), 'Blocks asset/../../etc/passwd')
expectError(() => validateAssetId('./etc/passwd'), 'Blocks ./etc/passwd')
expectError(() => validateAssetId('.hidden'), 'Blocks .hidden (hidden files)')

// Special characters
expectError(() => validateAssetId('asset/with/slash'), 'Blocks asset/with/slash')
expectError(() => validateAssetId('asset\\with\\backslash'), 'Blocks asset\\with\\backslash')
expectError(() => validateAssetId('asset;rm -rf'), 'Blocks asset;rm -rf')
expectError(() => validateAssetId('asset|cat /etc/passwd'), 'Blocks asset|cat /etc/passwd')
expectError(() => validateAssetId('asset&whoami'), 'Blocks asset&whoami')
expectError(() => validateAssetId('asset`whoami`'), 'Blocks asset`whoami`')
expectError(() => validateAssetId('asset$(whoami)'), 'Blocks asset$(whoami)')

// Null bytes
expectError(() => validateAssetId('asset\0.txt'), 'Blocks null byte injection')

// Empty/invalid inputs
expectError(() => validateAssetId(''), 'Blocks empty string')
expectError(() => validateAssetId(null), 'Blocks null')
expectError(() => validateAssetId(undefined), 'Blocks undefined')
expectError(() => validateAssetId(123), 'Blocks number')
expectError(() => validateAssetId({}), 'Blocks object')

// Length limits
expectError(() => validateAssetId('a'.repeat(101)), 'Blocks overly long asset ID (101 chars)')

console.log('\n✅ Testing Valid Asset IDs\n')

// Valid asset IDs
expectSuccess(() => validateAssetId('sword-iron'), 'sword-iron', 'Accepts sword-iron')
expectSuccess(() => validateAssetId('armor_chest_1'), 'armor_chest_1', 'Accepts armor_chest_1')
expectSuccess(() => validateAssetId('npc-goblin-warrior'), 'npc-goblin-warrior', 'Accepts npc-goblin-warrior')
expectSuccess(() => validateAssetId('asset123'), 'asset123', 'Accepts asset123')
expectSuccess(() => validateAssetId('MyAsset-v2_final'), 'MyAsset-v2_final', 'Accepts MyAsset-v2_final')

console.log('\n✅ Testing Valid Filenames\n')

// Valid filenames (with extensions)
expectSuccess(() => validateFilename('model.glb'), 'model.glb', 'Accepts model.glb')
expectSuccess(() => validateFilename('texture_diffuse.png'), 'texture_diffuse.png', 'Accepts texture_diffuse.png')
expectSuccess(() => validateFilename('metadata.json'), 'metadata.json', 'Accepts metadata.json')

console.log('\n🔒 Testing Filename Path Traversal\n')

expectError(() => validateFilename('../../../etc/passwd'), 'Blocks ../../../etc/passwd in filename')
expectError(() => validateFilename('../.env'), 'Blocks ../.env in filename')
expectError(() => validateFilename('.htaccess'), 'Blocks .htaccess (hidden file)')

console.log('\n✅ Testing NPC ID Validation\n')

// Valid NPC IDs
expectSuccess(() => validateNpcId('merchant-blacksmith'), 'merchant-blacksmith', 'Accepts merchant-blacksmith')
expectSuccess(() => validateNpcId('guard_01'), 'guard_01', 'Accepts guard_01')

// Invalid NPC IDs
expectError(() => validateNpcId('../../../etc/passwd'), 'Blocks path traversal in NPC ID')

console.log('\n✅ Testing Directory Name Validation\n')

// Valid directory names
expectSuccess(() => validateDirectoryName('temp-images'), 'temp-images', 'Accepts temp-images')
expectSuccess(() => validateDirectoryName('gdd-assets'), 'gdd-assets', 'Accepts gdd-assets')

// Invalid directory names
expectError(() => validateDirectoryName('../../../etc'), 'Blocks path traversal in directory name')
expectError(() => validateDirectoryName('dir/subdir'), 'Blocks slash in directory name')

console.log('\n✅ All validation tests completed!\n')
