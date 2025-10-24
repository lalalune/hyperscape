#!/usr/bin/env node

/**
 * Fix Three.js import issues
 * - Remove unused imports
 * - Fix duplicate imports from type files
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const fixes = [
  // Remove unused Quaternion from ArmorFittingViewer.tsx
  {
    file: 'src/components/ArmorFitting/ArmorFittingViewer.tsx',
    find: /, Quaternion/,
    replace: ''
  },
  // Remove duplicate Scene import (keep the Three.js one, remove the component one)
  {
    file: 'src/components/ArmorFitting/ArmorFittingViewer.tsx',
    find: /import \{ Scene \} from '\.\/MeshFittingDebugger\/components\/Scene'\n/,
    replace: ''
  },
  // Remove unused AnimationAction from AvatarArmorDemo.tsx
  {
    file: 'src/components/ArmorFitting/MeshFittingDebugger/components/AvatarArmorDemo.tsx',
    find: /AnimationAction, /,
    replace: ''
  },
  // Remove unused AnimationAction from HelmetDemo.tsx
  {
    file: 'src/components/ArmorFitting/MeshFittingDebugger/components/HelmetDemo.tsx',
    find: /AnimationAction, /,
    replace: ''
  },
  // Remove unused Quaternion from useArmorFitting.ts
  {
    file: 'src/components/ArmorFitting/MeshFittingDebugger/hooks/useArmorFitting.ts',
    find: /, Quaternion/,
    replace: ''
  },
  // Remove unused MeshBasicMaterial from EquipmentViewer.tsx
  {
    file: 'src/components/Equipment/EquipmentViewer.tsx',
    find: /, MeshBasicMaterial/,
    replace: ''
  },
  // Remove unused SphereGeometry from EquipmentViewer.tsx
  {
    file: 'src/components/Equipment/EquipmentViewer.tsx',
    find: /, SphereGeometry/,
    replace: ''
  },
  // Fix duplicate SkeletonHelper - rename the Three.js import to something else temporarily
  // Actually, we need to check which one is actually used
]

console.log('Fixing Three.js import issues...\n')

for (const fix of fixes) {
  const filePath = path.join(__dirname, '..', fix.file)

  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    const originalContent = content

    content = content.replace(fix.find, fix.replace)

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8')
      console.log(`✅ Fixed: ${fix.file}`)
    }
  } catch (error) {
    console.error(`❌ Error fixing ${fix.file}: ${error.message}`)
  }
}

console.log('\nFixes applied. Re-running typecheck...')
