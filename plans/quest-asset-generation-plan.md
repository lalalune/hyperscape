# Quest System Asset Generation Plan

This document outlines all assets needed to complete the quest system implementation.

---

## Summary

| Category | Total | Status |
|----------|------:|--------|
| **Quest NPCs** | 7 | 🔴 Need Generation |
| **Mob Models** | 2 | ⚠️ Check if exist |
| **Music Tracks** | 4 | 🔴 Need Generation |
| **Ambient Sounds** | 13 | 🔴 Need Generation |

---

## 1. NPC Models (AssetForge)

Generate using `bun run dev:forge` at http://localhost:3400/generation

### Priority 1: Tutorial NPCs (Required for starter quests)

| # | NPC ID | Name | Output Path | Scale |
|---|--------|------|-------------|------:|
| 1 | `mentor_elara` | Mentor Elara | `npcs/mentor_elara.glb` | 1.0 |
| 2 | `foreman_grimjaw` | Foreman Grimjaw | `npcs/foreman_grimjaw.glb` | 0.9 |
| 3 | `scout_vex` | Scout Vex | `npcs/scout_vex.glb` | 1.05 |
| 4 | `chef_helena` | Chef Helena | `npcs/chef_helena.glb` | 1.0 |

### Priority 2: Combat NPCs (Required for intermediate quests)

| # | NPC ID | Name | Output Path | Scale |
|---|--------|------|-------------|------:|
| 5 | `warrior_thorne` | Warrior Thorne | `npcs/warrior_thorne.glb` | 1.1 |

### Priority 3: Endgame NPCs (Required for experienced/legendary quests)

| # | NPC ID | Name | Output Path | Scale |
|---|--------|------|-------------|------:|
| 6 | `elder_sage` | Elder Sage | `npcs/elder_sage.glb` | 1.0 |
| 7 | `commander_aldric` | Commander Aldric | `npcs/commander_aldric.glb` | 1.15 |

---

## 2. NPC Generation Prompts

### 2.1 Mentor Elara
**Visual:** Wise female sage who teaches survival skills
```
Fantasy female mentor sage, middle-aged, kind wise face with warm expression, 
silver-streaked long hair in a practical braid, wearing simple but elegant 
dark blue teaching robes with silver trim, leather belt with pouches containing 
scrolls and herbs, holding a wooden staff with a soft glowing crystal at the top, 
barefoot or simple sandals, gentle magical aura around her, low-poly stylized 
RPG character, full body standing pose
```
**Tags:** `fantasy`, `low-poly`, `stylized`, `rpg-character`, `npc`, `female`, `sage`

---

### 2.2 Foreman Grimjaw
**Visual:** Gruff dwarven mining supervisor
```
Gruff dwarven mining foreman, stocky muscular build, weathered rugged face 
with thick braided beard containing metal clasps, protective leather work apron 
over sturdy brown work clothes, heavy mining boots, tool belt with hammer 
pickaxe and measuring tools, mining helmet with attached lantern, coal dust 
and sweat stains on clothes, crossed arms confident pose, low-poly stylized 
RPG character, full body
```
**Tags:** `fantasy`, `dwarf`, `low-poly`, `stylized`, `rpg-character`, `npc`, `miner`

---

### 2.3 Scout Vex
**Visual:** Agile elven ranger scout
```
Lithe elven ranger scout, androgynous sharp features, short practical dark hair 
with braids, alert watchful eyes, wearing muted green-brown leather armor for 
stealth, hooded cloak draped over shoulders, shortbow strapped to back with 
quiver of arrows, belt pouches with maps and rope, light leather boots for 
quick movement, one hand raised in greeting, low-poly stylized RPG character, 
full body standing
```
**Tags:** `fantasy`, `elf`, `ranger`, `low-poly`, `stylized`, `rpg-character`, `npc`

---

### 2.4 Chef Helena
**Visual:** Friendly rotund tavern cook
```
Friendly stout human female tavern chef cook, round cheerful face with rosy 
cheeks and warm smile, hair tied back in a neat bun covered with a white cap, 
wearing flour-dusted cream colored apron over simple peasant dress, wooden 
spoon tucked into apron pocket, carrying a steaming pot or ladle, comfortable 
worn leather shoes, welcoming open posture, low-poly stylized RPG character, 
full body
```
**Tags:** `fantasy`, `human`, `low-poly`, `stylized`, `rpg-character`, `npc`, `tavern`

---

### 2.5 Warrior Thorne
**Visual:** Battle-scarred veteran trainer
```
Scarred veteran human warrior trainer, tall muscular athletic build, short 
military-cut gray hair, battle scars across face and arms, stern but fair 
expression, wearing well-maintained iron chainmail armor over padded cloth, 
leather sword belt with training sword, armored bracers and greaves, sturdy 
combat boots, arms crossed in evaluating stance, low-poly stylized RPG 
character, full body
```
**Tags:** `fantasy`, `warrior`, `human`, `low-poly`, `stylized`, `rpg-character`, `npc`

---

### 2.6 Elder Sage
**Visual:** Ancient mystical scholar
```
Ancient wise elder sage mage, very old with long flowing white beard and hair, 
deeply wrinkled face with knowing piercing eyes, wearing elaborate dark purple 
arcane robes with gold mystical embroidery and symbols, holding an ancient tome 
or crystal orb, gnarled wooden staff at his side, pointed wizard hat optional, 
mystical particles floating around him, hunched slightly with age but radiating 
power, low-poly stylized RPG character, full body
```
**Tags:** `fantasy`, `mage`, `wizard`, `low-poly`, `stylized`, `rpg-character`, `npc`

---

### 2.7 Commander Aldric
**Visual:** Imposing military commander
```
Imposing human military commander, tall and powerfully built, strong jaw with 
neatly trimmed dark beard streaked with gray, stern commanding presence, wearing 
ornate steel plate armor with gold Haven insignia on breastplate, crimson cape 
flowing behind, decorated sword at hip, gauntlets removed and held in one hand, 
standing in heroic commanding pose, low-poly stylized RPG character, full body
```
**Tags:** `fantasy`, `knight`, `commander`, `human`, `low-poly`, `stylized`, `rpg-character`, `npc`

---

## 3. Mob Models (Verify Existence)

Check if these models exist in `packages/server/world/assets/mobs/`:

| # | Mob ID | Name | Expected Path | Level |
|---|--------|------|---------------|------:|
| 1 | `goblin` | Goblin | `mobs/goblin.glb` | 2 |
| 2 | `shadow_crawler` | Shadow Crawler | `mobs/shadow_crawler.glb` | 8 |

### If Missing - Generation Prompts

**Goblin:**
```
Small green goblin creature, hunched posture, pointed ears, sharp teeth in 
mischievous grin, wearing ragged cloth armor and leather scraps, carrying 
crude wooden club or rusty dagger, yellow glowing eyes, dirty and wild 
appearance, aggressive stance ready to attack, low-poly stylized RPG mob, 
full body
```

**Shadow Crawler:**
```
Twisted shadow creature, quadrupedal spider-like horror, dark writhing form 
made of living darkness, multiple glowing red or purple eyes, sharp claws 
and spines, wisps of shadow trailing from body, hunched predatory pose, 
otherworldly and terrifying, dark purple and black color scheme with glowing 
accents, low-poly stylized RPG mob, full body
```

---

## 4. Music Tracks (Audio Generation)

| # | Track ID | Area | Mood | Duration |
|---|----------|------|------|----------|
| 1 | `town_peaceful` | Haven | Calm, welcoming, medieval town | 3-5 min loop |
| 2 | `mine_peaceful` | Southern Mines | Industrial, rhythmic, echo | 2-4 min loop |
| 3 | `wilderness_tense` | Eastern Wilds | Adventurous, slightly dangerous | 3-5 min loop |
| 4 | `dungeon_ominous` | Shadow Caves | Dark, foreboding, horror | 3-5 min loop |

### Music Generation Suggestions

**1. town_peaceful**
- Style: Fantasy RPG town theme
- Instruments: Lute, flute, soft strings, light percussion
- Tempo: Moderate (80-100 BPM)
- Reference: Tavern/village themes from fantasy RPGs

**2. mine_peaceful**
- Style: Dwarven mining theme
- Instruments: Anvil percussion, deep drums, echoing hammers, horns
- Tempo: Steady (70-90 BPM)
- Reference: Mines of Moria-style ambience with work rhythm

**3. wilderness_tense**
- Style: Open wilderness exploration
- Instruments: Strings, woodwinds, tribal drums
- Tempo: Variable (90-120 BPM)
- Reference: Adventurous travel themes with hints of danger

**4. dungeon_ominous**
- Style: Dark dungeon crawl
- Instruments: Deep drones, unsettling strings, sparse percussion
- Tempo: Slow (50-70 BPM)
- Reference: Horror game cave/dungeon themes

---

## 5. Ambient Sound Effects

### Haven (Town)
| # | Sound ID | Description | Loop |
|---|----------|-------------|------|
| 1 | `birds` | Gentle birdsong, morning atmosphere | Yes |
| 2 | `marketplace` | Crowd chatter, merchant calls, coin sounds | Yes |
| 3 | `hammer_on_anvil` | Distant smithing, metalwork | Yes |

### Southern Mines
| # | Sound ID | Description | Loop |
|---|----------|-------------|------|
| 4 | `pickaxe_sounds` | Mining impacts, rock breaking | Yes |
| 5 | `cave_echo` | Subtle cave ambience with echo | Yes |

### Eastern Wilds
| # | Sound ID | Description | Loop |
|---|----------|-------------|------|
| 6 | `wind` | Gentle to moderate wind through trees | Yes |
| 7 | `distant_growls` | Occasional goblin/creature sounds | Yes |
| 8 | `goblin_chatter` | Distant goblin voices, grunts | Yes |

### Shadow Caves
| # | Sound ID | Description | Loop |
|---|----------|-------------|------|
| 9 | `dripping_water` | Cave water drops, echoing | Yes |
| 10 | `echoes` | Unsettling cave echoes | Yes |
| 11 | `distant_shrieks` | Far-off creature screams | Yes |
| 12 | `shadow_whispers` | Ethereal, otherworldly whispers | Yes |

---

## 6. Asset Installation Paths

After generation, place assets in these directories:

```
packages/server/world/assets/
├── npcs/
│   ├── mentor_elara.glb
│   ├── foreman_grimjaw.glb
│   ├── scout_vex.glb
│   ├── chef_helena.glb
│   ├── warrior_thorne.glb
│   ├── elder_sage.glb
│   ├── commander_aldric.glb
│   └── sentinel_marcus.glb  (if updating)
├── mobs/
│   ├── goblin.glb
│   └── shadow_crawler.glb
├── audio/
│   ├── music/
│   │   ├── town_peaceful.ogg
│   │   ├── mine_peaceful.ogg
│   │   ├── wilderness_tense.ogg
│   │   └── dungeon_ominous.ogg
│   └── ambient/
│       ├── birds.ogg
│       ├── marketplace.ogg
│       ├── hammer_on_anvil.ogg
│       ├── pickaxe_sounds.ogg
│       ├── cave_echo.ogg
│       ├── wind.ogg
│       ├── distant_growls.ogg
│       ├── goblin_chatter.ogg
│       ├── dripping_water.ogg
│       ├── echoes.ogg
│       ├── distant_shrieks.ogg
│       └── shadow_whispers.ogg
```

---

## 7. Generation Checklist

### NPCs (AssetForge)
- [ ] Mentor Elara
- [ ] Foreman Grimjaw
- [ ] Scout Vex
- [ ] Chef Helena
- [ ] Warrior Thorne
- [ ] Elder Sage
- [ ] Commander Aldric

### Mobs (Verify/Generate)
- [ ] Goblin - verify exists
- [ ] Shadow Crawler - verify exists

### Music (Audio Tool)
- [ ] town_peaceful
- [ ] mine_peaceful
- [ ] wilderness_tense
- [ ] dungeon_ominous

### Ambient Sounds (Audio Tool)
- [ ] birds
- [ ] marketplace
- [ ] hammer_on_anvil
- [ ] pickaxe_sounds
- [ ] cave_echo
- [ ] wind
- [ ] distant_growls
- [ ] goblin_chatter
- [ ] dripping_water
- [ ] echoes
- [ ] distant_shrieks
- [ ] shadow_whispers

---

## 8. Tools & Resources

### AssetForge (3D Models)
- **Start:** `bun run dev:forge`
- **UI:** http://localhost:3400
- **Docs:** `packages/asset-forge/dev-book/`

### Audio Generation Options
1. **AI Music Generators:** Suno, Udio, AIVA
2. **Sound Libraries:** Freesound.org, Zapsplat
3. **Custom:** Audacity + VST instruments

### File Formats
- **3D Models:** GLB (preferred), GLTF
- **Audio:** OGG (recommended), MP3, WAV
