const fs = require('fs');
const path = require('path');

// Fix null/undefined checks in various files
const fixes = [
  {
    file: 'src/service.ts',
    replacements: [
      {
        from: 'if (world.controls.stopAllActions)',
        to: 'if (world.controls?.stopAllActions)',
      },
    ],
  },
  {
    file: 'src/managers/behavior-manager.ts',
    replacements: [
      {
        from: 'entityId: UUID | null',
        to: 'entityId: UUID | undefined',
      },
      {
        from: '= null',
        to: '= undefined',
      },
    ],
  },
  {
    file: 'src/managers/message-manager.ts',
    replacements: [
      {
        from: 'entityId: string | null',
        to: 'entityId: string | undefined',
      },
      {
        from: 'new Date(msg.createdAt)',
        to: 'new Date(msg.createdAt || Date.now())',
      },
    ],
  },
  {
    file: 'src/managers/voice-manager.ts',
    replacements: [
      {
        from: 'entityId: UUID | null',
        to: 'entityId: UUID | undefined',
      },
    ],
  },
  {
    file: 'src/providers/character.ts',
    replacements: [
      {
        from: 'message.content.actions.includes',
        to: 'message.content.actions?.includes',
      },
      {
        from: 'character.style.all.length',
        to: 'character.style?.all?.length',
      },
      {
        from: 'character.style.post.length',
        to: 'character.style?.post?.length',
      },
      {
        from: 'character.style.chat.length',
        to: 'character.style?.chat?.length',
      },
    ],
  },
  {
    file: 'src/providers/world.ts',
    replacements: [
      {
        from: 'actionsSystem?.getNearby(50)',
        to: '(actionsSystem as any)?.getNearby?.(50)',
      },
    ],
  },
  {
    file: 'src/systems/environment.ts',
    replacements: [
      {
        from: 'cascades: null',
        to: 'cascades: undefined',
      },
      {
        from: 'shadowMapSize: null',
        to: 'shadowMapSize: undefined',
      },
      {
        from: 'lightIntensity: null',
        to: 'lightIntensity: undefined',
      },
    ],
  },
];

// Apply fixes
fixes.forEach(({ file, replacements }) => {
  const filePath = path.join(__dirname, '..', file);

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  replacements.forEach(({ from, to }) => {
    if (content.includes(from)) {
      content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
      changed = true;
      console.log(`  Fixed: ${from} -> ${to}`);
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${file}`);
  }
});

// Fix event handler signatures
const eventFiles = ['src/events.ts'];
eventFiles.forEach((file) => {
  const filePath = path.join(__dirname, '..', file);

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Make callback optional in event handlers
  content = content.replace(
    /callback:\s*HandlerCallback\s*\|?\s*undefined/g,
    'callback?: HandlerCallback'
  );

  // Add null checks
  content = content.replace(/await callback\(/g, 'await callback?.(');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed event handlers in: ${file}`);
});

console.log('TypeScript errors fixed!');
