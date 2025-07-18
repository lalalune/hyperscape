const fs = require('fs');
const path = require('path');

const actionsDir = path.join(__dirname, '..', 'src', 'actions');

// Actions to fix
const actionsToFix = ['perception.ts', 'stop.ts', 'unuse.ts', 'use.ts', 'walk_randomly.ts'];

actionsToFix.forEach((filename) => {
  const filePath = path.join(actionsDir, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Fix handler signature - make state, options, callback, and responses optional
  content = content.replace(
    /handler:\s*async\s*\(\s*runtime:\s*IAgentRuntime,\s*([^:]+):\s*Memory,\s*([^:]+):\s*State,\s*([^:]+):\s*([^,]+),\s*([^:]+):\s*HandlerCallback,?\s*([^)]*)\)/g,
    (match, message, state, options, optionsType, callback, responses) => {
      return `handler: async (runtime: IAgentRuntime, ${message}: Memory, ${state}?: State, ${options}?: ${optionsType}, ${callback}?: HandlerCallback${responses ? `, ${responses}?: Memory[]` : ''})`;
    }
  );

  // Also fix simpler signatures without all parameters
  content = content.replace(
    /handler:\s*async\s*\(\s*runtime:\s*IAgentRuntime,\s*([^:]+):\s*Memory,\s*([^:]+):\s*State\s*\)/g,
    (match, message, state) => {
      return `handler: async (runtime: IAgentRuntime, ${message}: Memory, ${state}?: State)`;
    }
  );

  // Add callback check after service checks
  content = content.replace(/if\s*\(\s*!service\s*\|\|\s*!.*?\)\s*{/g, (match) => {
    if (!match.includes('!callback')) {
      return match.replace(/\)\s*{/, ' || !callback) {');
    }
    return match;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed: ${filename}`);
});

console.log('Handler signatures fixed!');
