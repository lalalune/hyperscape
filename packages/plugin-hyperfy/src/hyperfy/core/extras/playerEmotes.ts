/**
 * Local implementation of Hyperfy player emotes
 * This replaces the import from '../hyperfy/src/core/extras/playerEmotes.js'
 */

export interface EmoteDefinition {
  name: string;
  path: string;
  duration: number;
  description: string;
  loop?: boolean;
}

export const playerEmotes: EmoteDefinition[] = [
  {
    name: 'wave',
    path: '/emotes/emote-waving-both-hands.glb',
    duration: 2000,
    description: 'Wave with both hands',
    loop: false,
  },
  {
    name: 'dance',
    path: '/emotes/emote-dance-happy.glb',
    duration: 5000,
    description: 'Happy dance',
    loop: true,
  },
  {
    name: 'dance-hiphop',
    path: '/emotes/emote-dance-hiphop.glb',
    duration: 6000,
    description: 'Hip hop dance',
    loop: true,
  },
  {
    name: 'dance-breaking',
    path: '/emotes/emote-dance-breaking.glb',
    duration: 8000,
    description: 'Breakdancing',
    loop: true,
  },
  {
    name: 'dance-popping',
    path: '/emotes/emote-dance-popping.glb',
    duration: 7000,
    description: 'Popping dance',
    loop: true,
  },
  {
    name: 'cry',
    path: '/emotes/emote-crying.glb',
    duration: 3000,
    description: 'Crying',
    loop: true,
  },
  {
    name: 'crawl',
    path: '/public/emotes/emote-crawling.glb',
    duration: 4000,
    description: 'Crawling on ground',
    loop: true,
  },
  {
    name: 'death',
    path: '/emotes/emote-death.glb',
    duration: 3000,
    description: 'Dramatic death',
    loop: false,
  },
  {
    name: 'fire',
    path: '/emotes/emote-firing-gun.glb',
    duration: 2000,
    description: 'Firing a gun',
    loop: false,
  },
  {
    name: 'kiss',
    path: '/emotes/emote-kiss.glb',
    duration: 2500,
    description: 'Blow a kiss',
    loop: false,
  },
  {
    name: 'look',
    path: '/emotes/emote-looking-around.glb',
    duration: 3000,
    description: 'Looking around',
    loop: false,
  },
  {
    name: 'punch',
    path: '/emotes/emote-punch.glb',
    duration: 1500,
    description: 'Throw a punch',
    loop: false,
  },
  {
    name: 'rude',
    path: '/emotes/emote-rude-gesture.glb',
    duration: 2000,
    description: 'Rude gesture',
    loop: false,
  },
  {
    name: 'sorrow',
    path: '/emotes/emote-sorrow.glb',
    duration: 3000,
    description: 'Express sorrow',
    loop: true,
  },
  {
    name: 'squat',
    path: '/emotes/emote-squat.glb',
    duration: 2000,
    description: 'Squat exercise',
    loop: true,
  },
];

// Export a map for easy lookup
export const emoteMap = new Map<string, EmoteDefinition>(
  playerEmotes.map((emote) => [emote.name, emote])
);

// Helper to get emote by name
export function getEmoteByName(name: string): EmoteDefinition | undefined {
  return emoteMap.get(name);
}

// Helper to get all emote names
export function getEmoteNames(): string[] {
  return playerEmotes.map((e) => e.name);
}
