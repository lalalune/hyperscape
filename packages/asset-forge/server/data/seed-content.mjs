/**
 * Seed Content Data
 *
 * Pre-generated quests, NPCs, and lore for immediate user experience.
 * This content demonstrates all features and serves as examples for new users.
 */

export const SEED_QUESTS = [
  {
    id: 'quest_goblin_invasion',
    title: 'Goblin Invasion',
    description: 'A horde of goblins has been spotted near the village outskirts. Help defend the settlement by clearing out the goblin threat before they attack.',
    difficulty: 'medium',
    estimatedDuration: 15,
    questGiver: 'npc_gareth_guard',
    objectives: [
      {
        id: 'obj_kill_goblins',
        type: 'combat',
        description: 'Defeat 10 goblins threatening the village',
        target: 'mob_goblin',
        quantity: 10,
        optional: false
      },
      {
        id: 'obj_boss_goblin',
        type: 'combat',
        description: 'Defeat the Goblin Chieftain',
        target: 'mob_goblin_chieftain',
        quantity: 1,
        optional: true
      }
    ],
    rewards: {
      experience: 250,
      gold: 100,
      items: [
        { itemId: 'item_iron_sword', quantity: 1 }
      ]
    },
    loreContext: 'The goblins have been growing bolder, raiding nearby farms and threatening trade routes.',
    storyline: 'Part of the ongoing conflict between human settlements and goblin territories',
    requirements: {
      level: 5
    },
    tags: ['combat', 'defense', 'goblin', 'beginner-friendly'],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  },

  {
    id: 'quest_herb_gathering',
    title: 'The Healing Herb',
    description: 'Luna the Herbalist needs fresh healing herbs to replenish her medical supplies. Gather herbs from the forest for her.',
    difficulty: 'easy',
    estimatedDuration: 10,
    questGiver: 'npc_luna_herbalist',
    objectives: [
      {
        id: 'obj_gather_herbs',
        type: 'gathering',
        description: 'Collect 5 healing herbs from the forest',
        target: 'resource_healing_herb',
        quantity: 5,
        location: 'Forest Glen',
        optional: false
      }
    ],
    rewards: {
      experience: 100,
      gold: 50,
      items: [
        { itemId: 'item_health_potion', quantity: 3 }
      ]
    },
    loreContext: 'Healing herbs are essential for treating wounded travelers and villagers.',
    storyline: 'An introduction to the herbalism trade and gathering skills',
    requirements: {
      level: 1
    },
    tags: ['gathering', 'peaceful', 'herbalism', 'tutorial'],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  },

  {
    id: 'quest_blacksmith_request',
    title: "The Blacksmith's Request",
    description: 'The village blacksmith needs help fulfilling orders. Craft an iron sword using materials from the mine and deliver it to a guard.',
    difficulty: 'medium',
    estimatedDuration: 20,
    questGiver: 'npc_gareth_guard',
    objectives: [
      {
        id: 'obj_gather_ore',
        type: 'gathering',
        description: 'Mine 5 iron ore',
        target: 'resource_iron_ore',
        quantity: 5,
        optional: false
      },
      {
        id: 'obj_craft_sword',
        type: 'processing',
        description: 'Craft an iron sword at the forge',
        target: 'item_iron_sword',
        quantity: 1,
        optional: false
      },
      {
        id: 'obj_deliver_sword',
        type: 'delivery',
        description: 'Deliver the iron sword to Gareth',
        target: 'npc_gareth_guard',
        quantity: 1,
        optional: false
      }
    ],
    rewards: {
      experience: 350,
      gold: 150,
      items: [
        { itemId: 'item_steel_ingot', quantity: 5 }
      ]
    },
    loreContext: 'The village needs proper weapons to defend against goblin raids.',
    storyline: 'Introduction to the crafting system and resource processing',
    requirements: {
      level: 3,
      skills: {
        mining: 10,
        smithing: 5
      }
    },
    tags: ['crafting', 'mining', 'smithing', 'delivery'],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  },

  {
    id: 'quest_ancient_artifact',
    title: 'The Ancient Artifact',
    description: 'Eldric the Wise seeks a powerful artifact hidden in the ruins. Venture into dangerous territory to retrieve it.',
    difficulty: 'hard',
    estimatedDuration: 45,
    questGiver: 'npc_eldric_wise',
    objectives: [
      {
        id: 'obj_explore_ruins',
        type: 'social',
        description: 'Explore the Ancient Ruins',
        location: 'Ancient Ruins',
        optional: false
      },
      {
        id: 'obj_defeat_guardians',
        type: 'combat',
        description: 'Defeat 3 Stone Guardians',
        target: 'mob_stone_guardian',
        quantity: 3,
        optional: false
      },
      {
        id: 'obj_retrieve_artifact',
        type: 'delivery',
        description: 'Retrieve the Arcane Crystal',
        target: 'item_arcane_crystal',
        quantity: 1,
        optional: false
      },
      {
        id: 'obj_return_artifact',
        type: 'delivery',
        description: 'Return the artifact to Eldric',
        target: 'npc_eldric_wise',
        quantity: 1,
        optional: false
      }
    ],
    rewards: {
      experience: 1000,
      gold: 500,
      items: [
        { itemId: 'item_mage_staff', quantity: 1 },
        { itemId: 'item_mana_potion', quantity: 5 }
      ],
      reputation: {
        'Mages Guild': 100
      }
    },
    loreContext: 'The artifact is said to contain immense magical power from the Age of Wonders.',
    storyline: 'Main quest line connecting to the ancient history of the realm',
    requirements: {
      level: 15,
      completedQuests: ['quest_goblin_invasion']
    },
    tags: ['epic', 'magic', 'exploration', 'storyline'],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  },

  {
    id: 'quest_market_economics',
    title: 'Market Day',
    description: 'Mira the Merchant needs help with trading. Buy goods from farmers, sell them in the city, and learn the art of commerce.',
    difficulty: 'easy',
    estimatedDuration: 12,
    questGiver: 'npc_mira_merchant',
    objectives: [
      {
        id: 'obj_buy_wheat',
        type: 'economy',
        description: 'Buy 10 wheat from farmers',
        target: 'item_wheat',
        quantity: 10,
        optional: false
      },
      {
        id: 'obj_sell_bread',
        type: 'economy',
        description: 'Sell 5 bread loaves in the market',
        target: 'item_bread',
        quantity: 5,
        optional: false
      },
      {
        id: 'obj_profit',
        type: 'economy',
        description: 'Earn 100 gold in profit',
        quantity: 100,
        optional: true
      }
    ],
    rewards: {
      experience: 150,
      gold: 200,
      reputation: {
        'Merchant Guild': 50
      }
    },
    loreContext: 'The Merchant Guild controls most trade routes and seeks enterprising individuals.',
    storyline: 'Introduction to the economy system and trading mechanics',
    requirements: {
      level: 2
    },
    tags: ['economy', 'trading', 'peaceful', 'tutorial'],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  }
]

export const SEED_NPCS = [
  {
    id: 'npc_eldric_wise',
    personality: {
      name: 'Eldric the Wise',
      archetype: 'Sage',
      traits: ['wise', 'patient', 'mysterious', 'knowledgeable'],
      goals: ['Preserve ancient knowledge', 'Guide young adventurers', 'Protect magical artifacts'],
      moralAlignment: 'Lawful Good',
      backstory: 'Eldric has studied magic for over 60 years and knows secrets of the ancient world. He seeks brave souls to help recover lost artifacts before they fall into the wrong hands.',
      questsOffered: ['quest_ancient_artifact']
    },
    dialogues: [
      {
        id: 'greeting',
        text: 'Ah, welcome traveler. I sense great potential in you. Perhaps you can help me with a delicate matter?',
        responses: [
          {
            text: 'What do you need help with?',
            nextNodeId: 'quest_offer',
            effects: []
          },
          {
            text: 'Tell me about yourself.',
            nextNodeId: 'about_eldric',
            effects: []
          },
          {
            text: 'Goodbye.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'quest_offer',
        text: 'I seek an ancient artifact, the Arcane Crystal, hidden in ruins to the east. But beware - stone guardians protect it. Will you retrieve it for me?',
        responses: [
          {
            text: 'I accept this quest.',
            nextNodeId: 'quest_accepted',
            effects: [{ type: 'accept_quest', value: 'quest_ancient_artifact' }],
            questReference: 'quest_ancient_artifact'
          },
          {
            text: "I'm not ready yet.",
            nextNodeId: 'greeting',
            effects: []
          }
        ]
      },
      {
        id: 'about_eldric',
        text: 'I have dedicated my life to studying the arcane arts. The knowledge of the ancients must be preserved for future generations.',
        responses: [
          {
            text: 'Tell me about your quest.',
            nextNodeId: 'quest_offer',
            effects: []
          },
          {
            text: 'Fascinating. Goodbye.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'quest_accepted',
        text: 'Excellent! May fortune favor your journey. Return to me when you have the crystal.',
        responses: [
          {
            text: 'I will return soon.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      }
    ],
    behavior: {
      schedule: [
        { time: '06:00', location: 'Mage Tower', activity: 'studying' },
        { time: '12:00', location: 'Library', activity: 'researching' },
        { time: '18:00', location: 'Mage Tower', activity: 'meditation' }
      ],
      wanderRadius: 5,
      stayInZone: true
    },
    services: ['quest'],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  },

  {
    id: 'npc_mira_merchant',
    personality: {
      name: 'Mira the Merchant',
      archetype: 'Trader',
      traits: ['friendly', 'shrewd', 'optimistic', 'chatty'],
      goals: ['Expand trading empire', 'Build customer relationships', 'Find rare goods'],
      moralAlignment: 'Neutral Good',
      backstory: 'Mira inherited her family trading business and has expanded it into a thriving enterprise. She loves meeting new people and finding good deals.',
      questsOffered: ['quest_market_economics']
    },
    dialogues: [
      {
        id: 'greeting',
        text: 'Welcome, welcome! Looking to buy or sell today? I have the finest goods in all the land!',
        responses: [
          {
            text: "Show me your wares.",
            nextNodeId: 'shop',
            effects: [{ type: 'open_shop', value: 'mira_shop' }]
          },
          {
            text: 'Do you have any work for me?',
            nextNodeId: 'quest_offer',
            effects: []
          },
          {
            text: 'Just browsing.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'quest_offer',
        text: "Actually, yes! I need someone to help me with market trading. Buy some wheat from the farmers, sell bread at the market. Think you can handle it?",
        responses: [
          {
            text: 'Sounds profitable. I accept!',
            nextNodeId: 'quest_accepted',
            effects: [{ type: 'accept_quest', value: 'quest_market_economics' }],
            questReference: 'quest_market_economics'
          },
          {
            text: 'Not interested in trading.',
            nextNodeId: 'greeting',
            effects: []
          }
        ]
      },
      {
        id: 'quest_accepted',
        text: 'Wonderful! Remember - buy low, sell high. Come back when you\'ve made a nice profit!',
        responses: [
          {
            text: "I'll get started right away.",
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'shop',
        text: 'Take your time! Everything is competitively priced.',
        responses: [
          {
            text: 'Show me healing potions.',
            nextNodeId: 'shop',
            effects: []
          },
          {
            text: 'Thanks, I\'m done shopping.',
            nextNodeId: 'greeting',
            effects: []
          }
        ]
      }
    ],
    behavior: {
      schedule: [
        { time: '08:00', location: 'Market Square', activity: 'selling' },
        { time: '14:00', location: 'Market Square', activity: 'trading' },
        { time: '20:00', location: 'Shop', activity: 'closing_up' }
      ],
      wanderRadius: 10,
      stayInZone: false
    },
    services: ['shop', 'quest'],
    inventory: [
      { itemId: 'item_health_potion', stock: 20, price: 25 },
      { itemId: 'item_mana_potion', stock: 15, price: 30 },
      { itemId: 'item_bread', stock: 50, price: 5 },
      { itemId: 'item_iron_ingot', stock: 10, price: 40 }
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  },

  {
    id: 'npc_gareth_guard',
    personality: {
      name: 'Gareth the Guard',
      archetype: 'Warrior',
      traits: ['disciplined', 'protective', 'gruff', 'honorable'],
      goals: ['Protect the village', 'Train new fighters', 'Eliminate threats'],
      moralAlignment: 'Lawful Neutral',
      backstory: 'Gareth is a veteran guard who has defended the village for 20 years. He takes his duty seriously and has little patience for troublemakers.',
      questsOffered: ['quest_goblin_invasion', 'quest_blacksmith_request']
    },
    dialogues: [
      {
        id: 'greeting',
        text: 'State your business. I have no time for idle chatter.',
        responses: [
          {
            text: 'I want to help defend the village.',
            nextNodeId: 'quest_offer',
            effects: []
          },
          {
            text: 'Tell me about the goblin threat.',
            nextNodeId: 'about_goblins',
            effects: []
          },
          {
            text: 'Sorry to bother you.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'quest_offer',
        text: 'Good. We need able bodies. Goblins have been spotted near the outskirts. Clear them out and report back to me.',
        responses: [
          {
            text: 'I\'ll handle it.',
            nextNodeId: 'quest_accepted',
            effects: [{ type: 'accept_quest', value: 'quest_goblin_invasion' }],
            questReference: 'quest_goblin_invasion'
          },
          {
            text: 'Sounds dangerous.',
            nextNodeId: 'greeting',
            effects: []
          }
        ]
      },
      {
        id: 'about_goblins',
        text: 'Filthy creatures. They raid our farms, steal our supplies. We need to show them strength or they\'ll never leave us alone.',
        responses: [
          {
            text: 'Let me help.',
            nextNodeId: 'quest_offer',
            effects: []
          },
          {
            text: 'I understand. Goodbye.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'quest_accepted',
        text: 'Good luck. Strike hard and fast. Dismissed.',
        responses: [
          {
            text: 'Yes sir.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      }
    ],
    behavior: {
      schedule: [
        { time: '06:00', location: 'Guard Post', activity: 'patrol_prep' },
        { time: '12:00', location: 'Village Gates', activity: 'patrolling' },
        { time: '18:00', location: 'Guard Post', activity: 'training' }
      ],
      wanderRadius: 20,
      stayInZone: false
    },
    services: ['quest'],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  },

  {
    id: 'npc_luna_herbalist',
    personality: {
      name: 'Luna the Herbalist',
      archetype: 'Healer',
      traits: ['kind', 'nurturing', 'gentle', 'knowledgeable'],
      goals: ['Heal the sick', 'Preserve nature', 'Teach herbalism'],
      moralAlignment: 'Neutral Good',
      backstory: 'Luna learned the healing arts from her grandmother. She tends to the sick and injured, using herbs and natural remedies to mend wounds and cure ailments.',
      questsOffered: ['quest_herb_gathering']
    },
    dialogues: [
      {
        id: 'greeting',
        text: 'Hello dear. Do you need healing, or perhaps you\'ve come to help gather herbs?',
        responses: [
          {
            text: 'I can help gather herbs.',
            nextNodeId: 'quest_offer',
            effects: []
          },
          {
            text: 'Tell me about your healing work.',
            nextNodeId: 'about_healing',
            effects: []
          },
          {
            text: 'Just passing through.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'quest_offer',
        text: 'How wonderful! I need healing herbs from the forest. Would you gather 5 for me? They have white flowers and grow near oak trees.',
        responses: [
          {
            text: 'I\'ll gather them for you.',
            nextNodeId: 'quest_accepted',
            effects: [{ type: 'accept_quest', value: 'quest_herb_gathering' }],
            questReference: 'quest_herb_gathering'
          },
          {
            text: 'Maybe later.',
            nextNodeId: 'greeting',
            effects: []
          }
        ]
      },
      {
        id: 'about_healing',
        text: 'Nature provides everything we need to heal. Herbs, roots, flowers - each has its purpose. I simply help people find the right remedy.',
        responses: [
          {
            text: 'Can I help you?',
            nextNodeId: 'quest_offer',
            effects: []
          },
          {
            text: 'That\'s beautiful. Farewell.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'quest_accepted',
        text: 'Thank you so much, dear. Be careful in the forest, and take your time.',
        responses: [
          {
            text: 'I\'ll be back soon.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      }
    ],
    behavior: {
      schedule: [
        { time: '07:00', location: 'Herb Garden', activity: 'tending_plants' },
        { time: '13:00', location: 'Clinic', activity: 'treating_patients' },
        { time: '19:00', location: 'Herb Garden', activity: 'harvesting' }
      ],
      wanderRadius: 15,
      stayInZone: true
    },
    services: ['quest'],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  },

  {
    id: 'npc_finnigan_rogue',
    personality: {
      name: 'Rogue Finnigan',
      archetype: 'Trickster',
      traits: ['cunning', 'charming', 'secretive', 'opportunistic'],
      goals: ['Gather information', 'Stay one step ahead', 'Profit from chaos'],
      moralAlignment: 'Chaotic Neutral',
      backstory: 'Finnigan knows everyone\'s secrets and sells information to the highest bidder. He walks the line between legal and illegal, always with a clever excuse ready.',
      questsOffered: []
    },
    dialogues: [
      {
        id: 'greeting',
        text: '*Eyes you suspiciously* Well, well. New face in town. Looking for information, or just lost?',
        responses: [
          {
            text: 'What kind of information do you have?',
            nextNodeId: 'about_info',
            effects: []
          },
          {
            text: 'Who are you exactly?',
            nextNodeId: 'about_finnigan',
            effects: []
          },
          {
            text: 'I don\'t trust you.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'about_info',
        text: 'Oh, I know a little about everything. Secret passages, guard routes, merchant schedules... For the right price, of course.',
        responses: [
          {
            text: 'Interesting. I\'ll keep that in mind.',
            nextNodeId: 'greeting',
            effects: []
          },
          {
            text: 'I\'m not interested in shady dealings.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      },
      {
        id: 'about_finnigan',
        text: '*Grins* Me? Just a humble information broker. I help people find what they need. Nothing illegal, mind you. Just... creative entrepreneurship.',
        responses: [
          {
            text: 'Sounds suspicious.',
            nextNodeId: 'greeting',
            effects: []
          },
          {
            text: 'Goodbye.',
            nextNodeId: 'end',
            effects: []
          }
        ]
      }
    ],
    behavior: {
      schedule: [
        { time: '10:00', location: 'Tavern', activity: 'gathering_rumors' },
        { time: '16:00', location: 'Market', activity: 'observing' },
        { time: '22:00', location: 'Alley', activity: 'secret_meeting' }
      ],
      wanderRadius: 25,
      stayInZone: false
    },
    services: [],
    metadata: {
      createdAt: new Date().toISOString(),
      author: 'Asset Forge Team',
      version: '1.0.0'
    }
  }
]

export const SEED_LORE = [
  {
    id: 'lore_ancient_wars',
    title: 'The Ancient Wars',
    content: 'Thousands of years ago, the Age of Wonders ended in a cataclysmic war between powerful mage kingdoms. The Arcane Council sought to control all magic, while the Free Mages rebelled. Their battle devastated the land and shattered powerful artifacts across the realm. The ruins scattered throughout the world are remnants of that terrible conflict. Many artifacts remain hidden, their power dormant but not forgotten.',
    category: 'history',
    tags: ['magic', 'war', 'ancient', 'artifacts'],
    relatedEntities: [
      { type: 'npc', id: 'npc_eldric_wise', name: 'Eldric the Wise' },
      { type: 'item', id: 'item_arcane_crystal', name: 'Arcane Crystal' }
    ],
    createdAt: new Date().toISOString()
  },

  {
    id: 'lore_merchant_guild',
    title: 'The Merchant Guild',
    content: 'Founded 200 years ago, the Merchant Guild controls most trade routes and commerce in the civilized lands. Guild membership grants access to protected caravans, better prices, and trading privileges. The Guild maintains strict rules: honest dealing, fair pricing, and protection of members. Those who betray the Guild face severe consequences. The current Guildmaster, Lady Silvana, has expanded operations into new territories and established trade agreements with formerly hostile regions.',
    category: 'faction',
    tags: ['economy', 'guild', 'trade', 'politics'],
    relatedEntities: [
      { type: 'npc', id: 'npc_mira_merchant', name: 'Mira the Merchant' }
    ],
    createdAt: new Date().toISOString()
  },

  {
    id: 'lore_goblin_territories',
    title: 'Goblin Territories',
    content: 'Goblins are intelligent creatures, despite what many humans believe. They organize in clans led by chieftains, each controlling specific territories. Recent expansion of human settlements has pushed into traditional goblin lands, causing conflicts. While some goblins raid and pillage, others seek peaceful coexistence. The current wave of attacks stems from the displacement of the Redclaw clan, whose ancestral caves were flooded during mining operations. Understanding this history might lead to diplomatic solutions, but most prefer the simple solution of combat.',
    category: 'location',
    tags: ['goblins', 'conflict', 'territory', 'politics'],
    relatedEntities: [
      { type: 'npc', id: 'npc_gareth_guard', name: 'Gareth the Guard' },
      { type: 'zone', id: 'zone_goblin_camp', name: 'Goblin Camp' }
    ],
    createdAt: new Date().toISOString()
  },

  {
    id: 'lore_healing_arts',
    title: 'The Healing Arts',
    content: 'Herbalism and natural healing have been practiced since ancient times. Unlike magical healing which requires mana and training, herbal remedies use the innate properties of plants. Healing herbs contain natural restorative compounds, while moonblossom flowers can cure poison. The Art requires patience, knowledge of plants, and deep respect for nature. Master herbalists like Luna the Herbalist spend years studying plant lore and healing techniques. The Herbalist\'s Code teaches: "Take only what you need, give thanks to the earth, and heal without judgment." Many magical healers dismiss herbalism as primitive, but experienced adventurers know the value of a good healing herb when mana runs dry.',
    category: 'artifact',
    tags: ['healing', 'herbs', 'nature', 'medicine'],
    relatedEntities: [
      { type: 'npc', id: 'npc_luna_herbalist', name: 'Luna the Herbalist' },
      { type: 'item', id: 'item_healing_herb', name: 'Healing Herb' },
      { type: 'item', id: 'item_health_potion', name: 'Health Potion' }
    ],
    createdAt: new Date().toISOString()
  }
]

export const getSeedContent = () => ({
  quests: SEED_QUESTS,
  npcs: SEED_NPCS,
  lore: SEED_LORE,
  version: '1.0.0',
  generatedAt: new Date().toISOString()
})
