import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  gridWidth: 100,
  gridHeight: 100,
  outputDir: __dirname
};

// RPG-themed location types and descriptors
const LOCATION_TYPES = [
  'Forest', 'Mountain', 'Cave', 'Village', 'Castle', 'Ruins', 'Lake', 
  'Desert', 'Swamp', 'Temple', 'Tower', 'Meadow', 'Canyon', 'Port',
  'Mine', 'Graveyard', 'Bridge', 'Inn', 'Market', 'Fortress'
];

const DESCRIPTORS = [
  'Ancient', 'Mysterious', 'Abandoned', 'Hidden', 'Cursed', 'Sacred',
  'Dark', 'Bright', 'Misty', 'Crystal', 'Golden', 'Silver', 'Haunted',
  'Forgotten', 'Eternal', 'Whispering', 'Frozen', 'Burning', 'Silent'
];

const FEATURES = [
  'magical fountain', 'ancient obelisk', 'strange glowing crystals',
  'mysterious fog', 'abandoned campsite', 'hidden treasure', 'old well',
  'stone circle', 'ancient tree', 'underground passage', 'magical barrier',
  'healing spring', 'merchant caravan', 'wandering monsters', 'ancient altar',
  'runic inscriptions', 'natural cave', 'defensive walls', 'watchtower',
  'secret entrance', 'magical portal', 'ancient library', 'training grounds'
];

// Extracted lore elements from lore.md for generation
const LORE_ELEMENTS = {
  architects: ['Terranak', 'Aquanis', 'Pyrrhon', 'Zephyra', 'Umbriel', 'Luminara'],
  kingdoms: ['Celestial Empire of Lux Aeterna', 'Shadowmere Dominion', 'Verdant Throne', 'Forge Republics', 'Tidecaller Confederation'],
  magicSchools: ['Light (Lux)', 'Shadow (Umbra)', 'Nature (Silva)', 'Forge (Ignis)', 'Flow (Aqua)', 'Void (Nihil)'],
  mysteries: ['The Seventh Stone', 'Primarch Vaults', 'Whispering Waste', 'Chronomancer\'s Tower', 'Living Dungeon'],
  races: ['Humans', 'Luminari', 'Shadeskin', 'Sylvan', 'Forgeborn', 'Seafoam', 'Voidtouched'],
  locations: ['Shattered Sanctum', 'Port Ethereal', 'Bone Bridge', 'Wizard\'s Folly', 'Free City of Crossroads']
};

// Biomes and height levels
const BIOMES = ['Forest', 'Mountain', 'Plains', 'Desert', 'Swamp', 'Tundra', 'Coast', 'River', 'Lake', 'Hills'];
const HEIGHT_LEVELS = ['Sea Level', 'Valley', 'Plains', 'Hills', 'Mountainous', 'Peak'];

// Simple 2D distance function
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2)**2 + (y1 - y2)**2);
}

// Generate Voronoi-like regions
function generateRegions(width, height, numRegions) {
  const seeds = [];
  for (let i = 0; i < numRegions; i++) {
    seeds.push({ x: Math.floor(Math.random() * width), y: Math.floor(Math.random() * height), id: i });
  }
  
  const regions = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      let minDist = Infinity;
      let closestSeed = -1;
      for (let s = 0; s < seeds.length; s++) {
        const dist = distance(x, y, seeds[s].x, seeds[s].y);
        if (dist < minDist) {
          minDist = dist;
          closestSeed = s;
        }
      }
      row.push(closestSeed);
    }
    regions.push(row);
  }
  
  // Generate region metadata
  const regionMeta = seeds.map((seed, id) => ({
    id,
    biome: randomElement(BIOMES),
    name: `${randomElement(DESCRIPTORS)} ${randomElement(LOCATION_TYPES)} of ${randomElement(LORE_ELEMENTS.kingdoms)}`,
    lore: `This region is influenced by ${randomElement(LORE_ELEMENTS.architects)}, known for its ${randomElement(LORE_ELEMENTS.magicSchools)} magic. Legends speak of a hidden ${randomElement(LORE_ELEMENTS.mysteries)}.`,
    dominantRace: randomElement(LORE_ELEMENTS.races)
  }));
  
  return { regions, regionMeta };
}

// Simple Perlin-like noise for height (basic implementation)
function simpleNoise(x, y, width, height) {
  const freq = 0.1;
  return Math.sin(x * freq) * Math.cos(y * freq) + Math.random() * 0.2;
}

function generateHeightMap(width, height) {
  const heights = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const noiseValue = simpleNoise(x, y, width, height);
      const levelIndex = Math.floor((noiseValue + 1) / 2 * HEIGHT_LEVELS.length);
      row.push(HEIGHT_LEVELS[Math.min(levelIndex, HEIGHT_LEVELS.length - 1)]);
    }
    heights.push(row);
  }
  return heights;
}

// Generate a random element from an array
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Generate a unique name for a location
function generateLocationName() {
  const descriptor = randomElement(DESCRIPTORS);
  const locationType = randomElement(LOCATION_TYPES);
  return `${descriptor} ${locationType}`;
}

// Generate a description for a location
function generateDescription(name) {
  const templates = [
    `A ${name.toLowerCase()} that has stood here for centuries, weathered by time and elements.`,
    `This ${name.toLowerCase()} emanates an aura of mystery and ancient power.`,
    `Travelers speak in hushed tones about the ${name.toLowerCase()} and its strange properties.`,
    `The ${name.toLowerCase()} serves as a landmark for adventurers exploring these lands.`,
    `Local legends tell many tales about the ${name.toLowerCase()} and what lies within.`,
    `Few dare to venture into the ${name.toLowerCase()}, though those who do speak of great rewards.`
  ];
  return randomElement(templates);
}

// Generate notable features for a location
function generateFeatures() {
  const numFeatures = Math.floor(Math.random() * 3) + 1; // 1-3 features
  const selectedFeatures = [];
  
  for (let i = 0; i < numFeatures; i++) {
    let feature = randomElement(FEATURES);
    while (selectedFeatures.includes(feature)) {
      feature = randomElement(FEATURES);
    }
    selectedFeatures.push(feature);
  }
  
  return selectedFeatures;
}

// Update generateCell to include metadata and lore-based generation
function generateCell(x, y, regions, regionMeta, heightMap) {
  const regionId = regions[y][x];
  const region = regionMeta[regionId];
  const height = heightMap[y][x];
  const biome = region.biome; // Base on region, with possible variation
  
  // LLM-like prompt filling for name, description, history
  const nameTemplates = [
    `${randomElement(DESCRIPTORS)} ${biome} in the ${region.name}`,
    `Cell of ${randomElement(LORE_ELEMENTS.locations)} at ${height}`
  ];
  const name = randomElement(nameTemplates);
  
  const descriptionTemplates = [
    `A ${height.toLowerCase()} area in the ${biome.toLowerCase()} biome, part of ${region.name}. ${region.lore}`,
    `This location features ${randomElement(FEATURES)} and is inhabited by ${region.dominantRace}.`
  ];
  const description = randomElement(descriptionTemplates);
  
  const historyTemplates = [
    `Ancient history ties this place to the ${randomElement(LORE_ELEMENTS.architects)}, from the Age of ${randomElement(['Wonders', 'Kingdoms', 'Fractures'])}.`,
    `During the War of Nullification, this area was a battlefield for ${randomElement(LORE_ELEMENTS.kingdoms)}.`
  ];
  const history = randomElement(historyTemplates);
  
  return {
    x,
    y,
    name,
    description,
    history,
    features: generateFeatures(),
    metadata: {
      biome,
      height,
      region: region.id,
      regionName: region.name
    }
  };
}

// Update generateGrid
function generateGrid(width = CONFIG.gridWidth, height = CONFIG.gridHeight) {
  const numRegions = Math.floor((width * height) / 20); // ~5x5 regions avg
  const { regions, regionMeta } = generateRegions(width, height, numRegions);
  const heightMap = generateHeightMap(width, height);
  
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push(generateCell(x, y, regions, regionMeta, heightMap));
    }
    grid.push(row);
  }
  
  return {
    width,
    height,
    generatedAt: new Date().toISOString(),
    regions: regionMeta,
    cells: grid
  };
}

// Export grid to JSON file
function exportToJSON(grid, filename = 'rpg-grid.json') {
  const filepath = join(CONFIG.outputDir, filename);
  writeFileSync(filepath, JSON.stringify(grid, null, 2));
  console.log(`Grid exported to: ${filepath}`);
  return filepath;
}

// Generate HTML visualization
function generateHTMLVisualization(grid) {
  // Biome colors
  const BIOME_COLORS = {
    'Forest': '#228B22',
    'Mountain': '#808080',
    'Plains': '#90EE90',
    'Desert': '#F4A460',
    'Swamp': '#556B2F',
    'Tundra': '#F0F8FF',
    'Coast': '#1E90FF',
    'River': '#00BFFF',
    'Lake': '#4169E1',
    'Hills': '#556B2F'
  };
  
  // Height opacity (darker for higher)
  const HEIGHT_OPACITY = {
    'Sea Level': 0.4,
    'Valley': 0.5,
    'Plains': 0.6,
    'Hills': 0.7,
    'Mountainous': 0.8,
    'Peak': 0.9
  };
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RPG Grid Map</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f0e6d2;
        }
        h1 {
            color: #5d4e37;
            text-align: center;
        }
        .grid-container {
            display: grid;
            grid-template-columns: repeat(${grid.width}, 1fr);
            gap: 2px;
            max-width: 1200px;
            margin: 0 auto;
            background-color: #3e3e3e;
            padding: 2px;
            border: 3px solid #5d4e37;
        }
        .cell {
            background-color: rgba(var(--biome-color), var(--height-opacity));
            border: 1px solid #8b7355;
            padding: 10px;
            min-height: 120px;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
        }
        .cell:hover {
            background-color: #e8dcc0;
            transform: scale(1.02);
            z-index: 10;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .cell-coords {
            position: absolute;
            top: 2px;
            right: 5px;
            font-size: 10px;
            color: #999;
        }
        .cell-name {
            font-weight: bold;
            color: #5d4e37;
            margin-bottom: 5px;
            font-size: 14px;
        }
        .cell-description {
            font-size: 11px;
            color: #666;
            margin-bottom: 5px;
            line-height: 1.3;
        }
        .cell-features {
            font-size: 10px;
            color: #8b7355;
            font-style: italic;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.8);
        }
        .modal-content {
            background-color: #f9f4e8;
            margin: 10% auto;
            padding: 20px;
            border: 3px solid #5d4e37;
            width: 80%;
            max-width: 500px;
            position: relative;
        }
        .close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        .close:hover {
            color: #000;
        }
        .info {
            text-align: center;
            margin: 20px 0;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>RPG World Grid Map</h1>
    <div class="info">
        Grid Size: ${grid.width} x ${grid.height} | Generated: ${new Date(grid.generatedAt).toLocaleString()}
    </div>
    <div class="grid-container">
${grid.cells.map(row => 
    row.map(cell => `        <div class="cell" style="--biome-color: ${getRGB(BIOME_COLORS[cell.metadata.biome] || '#FFFFFF')}; --height-opacity: ${HEIGHT_OPACITY[cell.metadata.height] || 1};" onclick="showDetails(${cell.x}, ${cell.y})">
            <div class="cell-coords">[${cell.x},${cell.y}]</div>
            <div class="cell-name">${cell.name}</div>
        </div>`).join('\n')
).join('\n')}
    </div>

    <div id="modal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal()">&times;</span>
            <div id="modal-details"></div>
        </div>
    </div>

    <script>
        const gridData = ${JSON.stringify(grid)};
        
        function showDetails(x, y) {
            const cell = gridData.cells[y][x];
            const modal = document.getElementById('modal');
            const details = document.getElementById('modal-details');
            
            details.innerHTML = \`
                <h2>\${cell.name}</h2>
                <p><strong>Coordinates:</strong> [\${x}, \${y}]</p>
                <p><strong>Description:</strong> \${cell.description}</p>
                <p><strong>Notable Features:</strong></p>
                <ul>
                    \${cell.features.map(f => '<li>' + f + '</li>').join('')}
                </ul>
                <p><strong>Metadata:</strong> Biome - \${cell.metadata.biome}, Height - \${cell.metadata.height}, Region - \${cell.metadata.regionName}</p>
                <p><strong>History:</strong> \${cell.history}</p>
            \`;
            
            modal.style.display = 'block';
        }
        
        function closeModal() {
            document.getElementById('modal').style.display = 'none';
        }
        
        window.onclick = function(event) {
            const modal = document.getElementById('modal');
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        }
    </script>
</body>
</html>`;
  
  const filepath = join(CONFIG.outputDir, 'generator.html');
  writeFileSync(filepath, html);
  console.log(`HTML visualization saved to: ${filepath}`);
  return filepath;
}

// Helper to get RGB from hex
function getRGB(hex) {
  return parseInt(hex.slice(1,3),16) + ',' + parseInt(hex.slice(3,5),16) + ',' + parseInt(hex.slice(5,7),16);
}

// Main execution
function main() {
  console.log('🎲 RPG Grid Generator');
  console.log('====================\n');
  
  // Generate the grid
  console.log(`Generating ${CONFIG.gridWidth}x${CONFIG.gridHeight} grid...`);
  const grid = generateGrid();
  
  // Export to JSON
  const jsonPath = exportToJSON(grid);
  
  // Generate HTML visualization
  const htmlPath = generateHTMLVisualization(grid);
  
  console.log('\n✅ Generation complete!');
  console.log(`   - JSON data: ${jsonPath}`);
  console.log(`   - Visualization: ${htmlPath}`);
  console.log('\nOpen the HTML file in your browser to explore the grid!');
  
  // Show a sample of the generated content
  console.log('\n📍 Sample location:');
  const sampleCell = grid.cells[0][0];
  console.log(`   Name: ${sampleCell.name}`);
  console.log(`   Description: ${sampleCell.description}`);
  console.log(`   Features: ${sampleCell.features.join(', ')}`);
  console.log(`   History: ${sampleCell.history}`);
  console.log(`   Metadata: ${JSON.stringify(sampleCell.metadata)}`);
}

// Run the generator
main();