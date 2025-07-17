import * as fs from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import seedrandom from 'seedrandom';
import { OpenAI } from 'openai';
import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  gridWidth: 20,
  gridHeight: 20,
  outputDir: __dirname,
  seed: 'default-seed', // Change this for different generations
  openaiApiKey: process.env.OPENAI_API_KEY, // Set this in environment
  cacheDir: path.join(__dirname, 'cache'),
};

// Ensure cache dir exists
fs.mkdirSync(CONFIG.cacheDir, { recursive: true });

// Initialize seeded random and OpenAI
let rng;
function initSeededRandom(seed) {
  rng = seedrandom(seed);
}
let openai = null;
if (CONFIG.openaiApiKey) {
  openai = new OpenAI({ apiKey: CONFIG.openaiApiKey });
} else {
  console.warn('OpenAI API key not set. Using fallback template generation.');
}

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

// Biome compatibility (simple adjacency rules)
const BIOME_COMPATIBILITY = {
  'Forest': ['Forest', 'Plains', 'Hills', 'Swamp', 'River', 'Lake', 'Coast'],
  'Mountain': ['Mountain', 'Hills', 'Plains', 'Tundra'],
  'Plains': ['Plains', 'Forest', 'Hills', 'Desert', 'Coast'],
  'Desert': ['Desert', 'Plains', 'Hills'],
  'Swamp': ['Swamp', 'Forest', 'River', 'Lake', 'Coast'],
  'Tundra': ['Tundra', 'Mountain', 'Plains'],
  'Coast': ['Coast', 'Plains', 'Forest', 'Swamp'],
  'River': ['River', 'Forest', 'Plains', 'Swamp', 'Lake'],
  'Lake': ['Lake', 'Forest', 'Plains', 'Swamp', 'River'],
  'Hills': ['Hills', 'Forest', 'Mountain', 'Plains', 'Desert']
};

// Function to get adjacent regions
function getAdjacentRegions(regions, width, height) {
  const adj = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = regions[y][x];
      if (!adj.has(id)) adj.set(id, new Set());
      // Check neighbors
      if (x > 0 && regions[y][x-1] !== id) adj.get(id).add(regions[y][x-1]);
      if (x < width-1 && regions[y][x+1] !== id) adj.get(id).add(regions[y][x+1]);
      if (y > 0 && regions[y-1][x] !== id) adj.get(id).add(regions[y-1][x]);
      if (y < height-1 && regions[y+1][x] !== id) adj.get(id).add(regions[y+1][x]);
    }
  }
  return adj;
}

// Adjust biomes for compatibility
function adjustBiomes(regionMeta, adjacencies) {
  const assignedBiomes = new Map();
  // Assign initial biomes with seeded random
  regionMeta.forEach(region => {
    assignedBiomes.set(region.id, randomElement(BIOMES));
  });
  // Iterate to fix incompatibilities
  let changes = true;
  while (changes) {
    changes = false;
    for (const [id, adjIds] of adjacencies) {
      const current = assignedBiomes.get(id);
      const incompatible = Array.from(adjIds).some(adjId => !BIOME_COMPATIBILITY[current].includes(assignedBiomes.get(adjId)));
      if (incompatible) {
        // Find a compatible biome
        const possible = BIOME_COMPATIBILITY[current].filter(b => Array.from(adjIds).every(adjId => BIOME_COMPATIBILITY[b].includes(assignedBiomes.get(adjId))));
        if (possible.length > 0) {
          assignedBiomes.set(id, randomElement(possible));
          changes = true;
        }
      }
    }
  }
  // Apply to regionMeta
  regionMeta.forEach(region => {
    region.biome = assignedBiomes.get(region.id);
  });
}

// Simple 2D distance function
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2)**2 + (y1 - y2)**2);
}

// Generate Voronoi-like regions
function generateRegions(width, height, numRegions) {
  const seeds = [];
  for (let i = 0; i < numRegions; i++) {
    seeds.push({ x: Math.floor(rng() * width), y: Math.floor(rng() * height), id: i });
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
  
  const adjacencies = getAdjacentRegions(regions, width, height);
  adjustBiomes(regionMeta, adjacencies);
  return { regions, regionMeta, adjacencies };
}

// Simple Perlin-like noise for height (basic implementation)
function simpleNoise(x, y, width, height) {
  const freq = 0.1;
  return Math.sin(x * freq) * Math.cos(y * freq) + rng() * 0.2;
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
  return array[Math.floor(rng() * array.length)];
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
  const numFeatures = Math.floor(rng() * 3) + 1; // 1-3 features
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

// New function for LLM generation
async function generateCellContent(metadata, lore) {
  if (!openai) {
    // Fallback templates
    const nameTemplates = [
      `${randomElement(DESCRIPTORS)} ${metadata.biome} in the ${metadata.regionName}`,
      `Cell of ${randomElement(LORE_ELEMENTS.locations)} at ${metadata.height}`
    ];
    const name = randomElement(nameTemplates);
    
    const descriptionTemplates = [
      `A ${metadata.height.toLowerCase()} area in the ${metadata.biome.toLowerCase()} biome, part of ${metadata.regionName}. ${metadata.regionLore}`,
      `This location features ${randomElement(FEATURES)} and is inhabited by ${randomElement(LORE_ELEMENTS.races)}.`
    ];
    const description = randomElement(descriptionTemplates);
    
    const historyTemplates = [
      `Ancient history ties this place to the ${randomElement(LORE_ELEMENTS.architects)}, from the Age of ${randomElement(['Wonders', 'Kingdoms', 'Fractures'])}.`,
      `During the War of Nullification, this area was a battlefield for ${randomElement(LORE_ELEMENTS.kingdoms)}.`
    ];
    const history = randomElement(historyTemplates);
    
    const features = generateFeatures();
    return { name, description, history, features };
  }
  
  const prompt = `You are a creative RPG world builder. Using the following lore from Aethermoor and cell metadata, generate:
- name: A fitting name
- description: 2-3 sentence description
- history: 1-2 sentence history tying to the lore
- features: Array of 2-4 notable features or buildings

Lore: ${lore}

Metadata:
- Biome: ${metadata.biome}
- Height: ${metadata.height}
- Region: ${metadata.regionName} (${metadata.regionLore})

Ensure content is immersive and consistent with the lore.`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });
  
  let content;
  try {
    content = JSON.parse(response.choices[0].message.content);
    console.log(content);
  } catch (e) {
    console.error('LLM response not valid JSON:', response.choices[0].message.content);
    // Fallback
    return generateCellContent(metadata, lore); // Recursive fallback
  }
  return content;
}

// New function for cached LLM call
async function cachedLLM(prompt, cacheKey, retry = 0) {
  const hash = crypto.createHash('md5').update(prompt).digest('hex');
  const cacheFile = path.join(CONFIG.cacheDir, `${cacheKey}_${hash}.json`);
  if (fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }
  if (!openai) return {}; // or appropriate fallback value
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });
  const content = response.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error('Invalid JSON from LLM:', content);
    if (retry < 1) {
      return await cachedLLM(prompt, cacheKey, retry + 1); // Retry once
    }
    parsed = []; // For batch, return empty array
  }
  fs.writeFileSync(cacheFile, JSON.stringify(parsed));
  return parsed;
}

// Update generateCell to use LLM
async function generateCell(x, y, regions, regionMeta, heightMap, lore) {
  const regionId = regions[y][x];
  const region = regionMeta[regionId];
  const height = heightMap[y][x];
  const biome = region.biome;
  
  const metadata = {
    biome,
    height,
    regionName: region.name,
    regionLore: region.lore
  };
  
  const { name, description, history, features } = await generateCellContent(metadata, lore);
  
  return {
    x,
    y,
    name,
    description,
    history,
    features,
    metadata
  };
}

// Update generateGrid to generate region lore first
async function generateGrid(width = CONFIG.gridWidth, height = CONFIG.gridHeight) {
  initSeededRandom(CONFIG.seed);
  const numRegions = Math.floor((width * height) / 20); // ~5x5 regions avg
  const { regions, regionMeta, adjacencies } = generateRegions(width, height, numRegions);
  const heightMap = generateHeightMap(width, height);
  
  const lore = await fs.promises.readFile('lore.md', 'utf8'); // Read lore.md
  
  if (openai) {
    // LLM region lore
    for (const region of regionMeta) {
      const regionPrompt = `Generate rich lore and history for this RPG region in Aethermoor:
- name: ${region.name}
- biome: ${region.biome}
- dominantRace: ${region.dominantRace}
Using lore: ${lore}
Output ONLY JSON with: lore (3-5 sentences), history (2-3 sentences). No other text.`;
      const regionData = await cachedLLM(regionPrompt, `region_${region.id}`);
      region.lore = regionData.lore || region.lore;
      region.history = regionData.history || '';
    }
  } else {
    // Fallback region lore
    regionMeta.forEach(region => {
      region.lore = `This ${region.biome.toLowerCase()} region of ${region.name} is home to ${region.dominantRace}. It is influenced by ${randomElement(LORE_ELEMENTS.architects)} and known for ${randomElement(LORE_ELEMENTS.magicSchools)} magic. Legends tell of a ${randomElement(LORE_ELEMENTS.mysteries)}. Local conflicts involve ${randomElement(['the Worldstone Crisis', 'the Pretender\'s War', 'the Deepwood Plague'])}. The area features unique ${randomElement(FEATURES)}.`;
      region.history = `Formed during the ${randomElement(['Age of Wonders', 'Age of Kingdoms', 'Age of Fractures'])}, this region was once part of ${randomElement(LORE_ELEMENTS.kingdoms)}. It played a role in the War of Nullification as a ${randomElement(['battleground', 'sanctuary', 'source of Voidshards'])}. Today, it faces challenges from ${randomElement(['planar invasions', 'the Null Conspiracy', 'ancient guardians'])}.`;
    });
  }
  console.log('// regionMeta');
  console.log(regionMeta);
  
  // Now batch cells per region
  const cellsByRegion = regionMeta.map(() => []);
  const grid = Array.from({length: height}, () => Array(width).fill(null));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rid = regions[y][x];
      cellsByRegion[rid].push({ x, y, height: heightMap[y][x] });
    }
  }
  
  for (let rid = 0; rid < regionMeta.length; rid++) {
    const region = regionMeta[rid];
    const batchCells = cellsByRegion[rid];
    if (batchCells.length === 0) continue;
    
    let batchData;
    if (openai) {
      const batchPrompt = `You are generating RPG cell details. Based on:
- Region: ${region.name} (${region.biome})
- Region Lore: ${region.lore}
- Region History: ${region.history}
- Overall Lore: ${lore.slice(0,1000)}...

For each of these cells: ${JSON.stringify(batchCells)}
Generate an object with: x, y, name (fitting name), description (2-3 sentences), history (1-2 sentences tying to lore), features (array of 2-4 strings for notable features/buildings).

Output ONLY a JSON array of these objects, nothing else. Ensure valid JSON.`;
      batchData = await cachedLLM(batchPrompt, `cells_region_${rid}`);
    } else {
      // Fallback: generate using generateCellContent
      batchData = [];
      for (const cell of batchCells) {
        const metadata = {
          biome: region.biome,
          height: cell.height,
          regionName: region.name,
          regionLore: region.lore
        };
        const content = generateCellContent(metadata, lore); // Note: not async in fallback
        batchData.push({
          x: cell.x,
          y: cell.y,
          ...content
        });
      }
    }
    
    console.log('// batchData');
    console.log(batchData);
    
    if (!Array.isArray(batchData)) {
      console.error(`Invalid batch data for region ${rid}:`, batchData);
      // Fallback: generate individually with fallback method
      for (const cell of batchCells) {
        const metadata = {
          biome: region.biome,
          height: cell.height,
          regionName: region.name,
          regionLore: region.lore
        };
        const content = generateCellContent(metadata, lore); // Use fallback
        grid[cell.y][cell.x] = {
          x: cell.x,
          y: cell.y,
          ...content,
          metadata
        };
      }
      continue;
    }

    // Assign to grid
    batchData.forEach(cellData => {
      const { x, y } = cellData;
      grid[y][x] = {
        x, y,
        name: cellData.name,
        description: cellData.description,
        history: cellData.history,
        features: cellData.features,
        metadata: {
          biome: region.biome,
          height: heightMap[y][x],
          region: rid,
          regionName: region.name
        }
      };
    });
  }
  
  // Post-process to fill any null cells with fallback
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] === null) {
        console.warn(`Fallback for null cell at [${x},${y}]`);
        const rid = regions[y][x];
        const region = regionMeta[rid];
        const metadata = {
          biome: region.biome,
          height: heightMap[y][x],
          regionName: region.name,
          regionLore: region.lore
        };
        const content = generateCellContent(metadata, lore); // Sync fallback
        grid[y][x] = {
          x,
          y,
          ...content,
          metadata
        };
      }
    }
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
  fs.writeFileSync(filepath, JSON.stringify(grid, null, 2));
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
  fs.writeFileSync(filepath, html);
  console.log(`HTML visualization saved to: ${filepath}`);
  return filepath;
}

// Helper to get RGB from hex
function getRGB(hex) {
  return parseInt(hex.slice(1,3),16) + ',' + parseInt(hex.slice(3,5),16) + ',' + parseInt(hex.slice(5,7),16);
}

// Main execution
async function main() {
  console.log('🎲 RPG Grid Generator');
  console.log('====================\n');
  
  if (!CONFIG.openaiApiKey) {
    console.log('Warning: No OpenAI API key detected. Using fallback generation.');
  }

  // Generate the grid
  console.log(`Generating ${CONFIG.gridWidth}x${CONFIG.gridHeight} grid...`);
  const grid = await generateGrid();
  
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