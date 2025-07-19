// Mock database for testing/development when SQLite isn't available
export async function getDB(path: string): Promise<any> {
  // Mock blueprint data - return sample blueprints for our RPG entities
  const mockBlueprints = [
    {
      id: 'rpg-player-spawn',
      data: JSON.stringify({
        id: 'RPGPlayer',
        name: 'RPG Player',
        appId: 'RPGPlayer',
        version: 1,
        props: { playerName: 'Test Player', visualColor: 'blue' },
        author: 'RPG System',
        desc: 'A test RPG player',
        model: null,
        script: null,
        preload: false,
        public: true,
        locked: false,
        unique: false,
        disabled: false
      })
    },
    {
      id: 'rpg-goblin-1',
      data: JSON.stringify({
        id: 'RPGGoblin',
        name: 'RPG Goblin',
        appId: 'RPGGoblin',
        version: 1,
        props: { goblinName: 'Test Goblin', visualColor: 'green' },
        author: 'RPG System',
        desc: 'A test RPG goblin',
        model: null,
        script: null,
        preload: false,
        public: true,
        locked: false,
        unique: false,
        disabled: false
      })
    },
    {
      id: 'rpg-bandit-1',
      data: JSON.stringify({
        id: 'RPGBandit',
        name: 'RPG Bandit',
        appId: 'RPGBandit',
        version: 1,
        props: { banditName: 'Desperate Bandit', visualColor: 'brown' },
        author: 'RPG System',
        desc: 'A desperate bandit enemy',
        model: null,
        script: null,
        preload: false,
        public: true,
        locked: false,
        unique: false,
        disabled: false
      })
    },
    {
      id: 'rpg-barbarian-1',
      data: JSON.stringify({
        id: 'RPGBarbarian',
        name: 'RPG Barbarian',
        appId: 'RPGBarbarian',
        version: 1,
        props: { barbarianName: 'Wild Barbarian', visualColor: 'orange' },
        author: 'RPG System',
        desc: 'A wild barbarian enemy',
        model: null,
        script: null,
        preload: false,
        public: true,
        locked: false,
        unique: false,
        disabled: false
      })
    },
    {
      id: 'rpg-bank-1',
      data: JSON.stringify({
        id: 'RPGBank',
        name: 'RPG Bank',
        appId: 'RPGBank',
        version: 1,
        props: { bankName: 'Bank of Hyperia', visualColor: 'blue' },
        author: 'RPG System',
        desc: 'A banking system for item storage',
        model: null,
        script: null,
        preload: false,
        public: true,
        locked: false,
        unique: false,
        disabled: false
      })
    },
    {
      id: 'rpg-store-1',
      data: JSON.stringify({
        id: 'RPGGeneralStore',
        name: 'RPG General Store',
        appId: 'RPGGeneralStore',
        version: 1,
        props: { storeName: 'General Store', visualColor: 'green' },
        author: 'RPG System',
        desc: 'A general store selling tools and arrows',
        model: null,
        script: null,
        preload: false,
        public: true,
        locked: false,
        unique: false,
        disabled: false
      })
    }
  ]

  const mockDB = function(tableName: string) {
    if (tableName === 'blueprints') {
      return Promise.resolve(mockBlueprints)
    }
    
    return {
      where: (column: string, value: any) => ({
        first: () => Promise.resolve(
          tableName === 'config' && column === 'key' && value === 'spawn' ? 
            { key: 'spawn', value: JSON.stringify({ position: [0, 0, 0], quaternion: [0, 0, 0, 1] }) } : null
        ),
        select: () => Promise.resolve([]),
        limit: () => Promise.resolve([]),
        orderBy: () => Promise.resolve([])
      }),
      insert: () => Promise.resolve({ insertId: 1 }),
      update: () => Promise.resolve(1),
      delete: () => Promise.resolve(1),
    }
  }

  // Add direct callable functionality
  Object.assign(mockDB, {
    raw: () => Promise.resolve([]),
    select: () => ({ 
      from: () => ({ 
        where: () => Promise.resolve([]),
        limit: () => Promise.resolve([]),
        orderBy: () => Promise.resolve([])
      })
    }),
    insert: () => Promise.resolve({ insertId: 1 }),
    update: () => Promise.resolve(1),
    delete: () => Promise.resolve(1),
    transaction: (callback: any) => callback(mockDB)
  })

  return mockDB
}