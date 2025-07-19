import fs from 'fs-extra'
import path from 'path'
import { importApp } from '../core/extras/appTools'
import { isArray } from 'lodash-es'

interface CollectionOptions {
  collectionsDir: string;
  assetsDir: string;
}

export async function initCollections({ collectionsDir, assetsDir }: CollectionOptions) {
  const collections: any[] = []
  const dirs = await fs.readdir(collectionsDir)
  
  for (const dir of dirs) {
    const dirPath = path.join(collectionsDir, dir)
    const stat = await fs.stat(dirPath)
    if (!stat.isDirectory()) continue
    
    const manifestPath = path.join(dirPath, 'manifest.json')
    if (!(await fs.exists(manifestPath))) continue
    
    console.log(`[Collections] Loading manifest: ${manifestPath}`)
    const manifest = await fs.readJson(manifestPath)
    console.log(`[Collections] Manifest content:`, manifest)
    
    // Handle both old 'items' format and new 'apps' format
    let appFiles: string[] = []
    if (isArray(manifest.apps)) {
      // New format: {"apps": ["App1.hyp", "App2.hyp"]}
      appFiles = manifest.apps
      console.log(`[Collections] Found ${appFiles.length} apps in ${dir}:`, appFiles)
    } else if (isArray(manifest.items)) {
      // Old format: {"items": [{"file": "App1.hyp"}, {"file": "App2.hyp"}]}
      appFiles = manifest.items.map((item: any) => item.file).filter(Boolean)
      console.log(`[Collections] Found ${appFiles.length} items in ${dir}:`, appFiles)
    } else {
      console.log(`[Collections] No apps or items found in ${dir} manifest`)
      continue
    }
    
    // Create blueprints array for this collection
    const blueprints: any[] = []
    
    // Load each app file and convert to blueprint
    for (const appFile of appFiles) {
      if (!appFile.endsWith('.hyp')) continue
      
      const filePath = path.join(dirPath, appFile)
      console.log(`[Collections] Loading app file: ${filePath}`)
      
      if (!(await fs.exists(filePath))) {
        console.warn(`[Collections] App file not found: ${filePath}`)
        continue
      }
      
      try {
        const fileData = await fs.readFile(filePath, 'utf8')
        const appData = JSON.parse(fileData)
        console.log(`[Collections] Loaded app data for ${appFile}:`, appData.name)
        
        // Convert app data to blueprint format
        const blueprint = {
          id: `${dir}/${appFile}`, // unique blueprint ID
          name: appData.name || appFile.replace('.hyp', ''),
          version: 0, // initial version
          script: appData.script ? `/collections/${dir}/${appData.script}` : `/collections/${dir}/${appFile.replace('.hyp', '.js')}`, // full script path from server root
          props: appData.properties || {}, // app properties
          // Optional fields based on app data
          ...(appData.model && { model: appData.model }),
          ...(appData.disabled && { disabled: appData.disabled })
        }
        blueprints.push(blueprint)
        console.log(`[Collections] Created blueprint: ${blueprint.id} with script: ${blueprint.script}`)
      } catch (error) {
        console.error(`[Collections] Error loading ${filePath}:`, error)
      }
    }
    
    // Only add collection if it has blueprints
    if (blueprints.length > 0) {
      const collection = {
        id: dir,
        name: manifest.name || dir,
        blueprints: blueprints
      }
      collections.push(collection)
      console.log(`[Collections] Created collection '${dir}' with ${blueprints.length} blueprints`)
    }
  }
  
  console.log(`[Collections] Total collections loaded: ${collections.length}`)
  collections.forEach((collection, index) => {
    console.log(`[Collections] Collection ${index}: id=${collection.id}, name=${collection.name}, blueprints=${collection.blueprints.length}`)
  })
  console.log(`[Collections] About to return collections`)
  return collections
}
