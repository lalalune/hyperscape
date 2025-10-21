# Voice Generation Guide

Generate professional voice-overs for NPC dialogue using ElevenLabs text-to-speech AI.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Selecting a Voice](#selecting-a-voice)
- [Voice Settings](#voice-settings)
- [Generating Voices](#generating-voices)
- [Managing Voice Clips](#managing-voice-clips)
- [Exporting](#exporting)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Voice Generation system allows you to create AI-powered voice-overs for your NPC dialogue trees using ElevenLabs' advanced text-to-speech technology. Each dialogue node can have its own audio clip, creating fully voiced NPCs for your game.

### Features
- **3,000+ Voices**: Browse ElevenLabs' extensive voice library
- **32 Languages**: Support for multilingual content
- **Voice Customization**: Adjust stability, similarity, and style
- **Batch Generation**: Generate all dialogue clips at once
- **Cost Estimation**: See estimated costs before generating
- **Export Ready**: Voice clips included in NPC script exports

---

## Prerequisites

### 1. ElevenLabs API Key

Sign up at [elevenlabs.io](https://elevenlabs.io/) and get your API key.

### 2. Environment Configuration

Add your API key to `.env`:

```bash
ELEVENLABS_API_KEY=your-api-key-here
```

### 3. NPC Dialogue Tree

Create an NPC with a complete dialogue tree before generating voices:
1. Navigate to **Content Generation → NPCs**
2. Generate or create an NPC
3. Go to **Scripts** tab
4. Build dialogue tree with multiple nodes

---

## Getting Started

### Step 1: Access Voice Generation

1. Open Asset Forge
2. Navigate to **Content Generation → Scripts**
3. Select an NPC from the dropdown
4. Scroll down to the **🎙️ Voice Generation** section

### Step 2: Select a Voice

Click **Choose Voice from Library** to open the voice browser.

---

## Selecting a Voice

### Voice Library Browser

The voice library contains over 3,000 voices organized by category:

#### Browse Voices
- **Search**: Type to filter by name or description
- **Category Filter**: Select a specific category:
  - `narrative` - Storytelling voices
  - `conversational` - Natural dialogue
  - `characters` - Character voices
  - `professional` - Business/formal voices
  - And more...

#### Voice Information
Each voice card shows:
- **Name**: Voice identity
- **Category**: Voice type
- **Description**: Voice characteristics
- **Labels**: Accent, age, gender, etc.

#### Preview Voice
Click the **Preview** button to hear a sample:
- Sample text: "Hello, traveler! How can I assist you today?"
- Preview plays through your default audio device
- Only one preview can play at a time

#### Select Voice
Click on a voice card to select it (checkmark appears when selected).

---

## Voice Settings

### Model Selection

Choose the AI model for voice generation:

| Model | Quality | Speed | Cost | Best For |
|-------|---------|-------|------|----------|
| **Multilingual v2** | Highest | Slower | 1x | Final production |
| **Turbo v2.5** | High | Fast | 0.5x | Development/testing |
| **Flash v2.5** | Good | Fastest | 0.5x | Rapid prototyping |

### Voice Parameters

#### Stability (0-1)
- **Low (0-0.3)**: More variation, expressive
- **Medium (0.4-0.6)**: Balanced (recommended)
- **High (0.7-1.0)**: Consistent, predictable

#### Similarity Boost (0-1)
- **Low (0-0.5)**: More creative interpretation
- **Medium (0.6-0.8)**: Balanced (recommended)
- **High (0.9-1.0)**: Closest to original voice

#### Style (0-1)
- **Low (0)**: Neutral delivery
- **Medium (0.3-0.6)**: Some emotion
- **High (0.7-1.0)**: Exaggerated emotion

### Recommended Settings

**For NPCs:**
```
Model: Multilingual v2
Stability: 0.5
Similarity Boost: 0.75
Style: 0.0
```

**For Dramatic Characters:**
```
Model: Multilingual v2
Stability: 0.3
Similarity Boost: 0.6
Style: 0.5
```

---

## Generating Voices

### Batch Generation

Generate voices for all dialogue nodes at once:

1. Ensure voice is selected
2. Review voice settings
3. Check cost estimate (shown in top-right)
4. Click **Generate All Voices**

### Generation Process

```
Progress: Generating 5/10 dialogue clips...
[██████████░░░░░░░░░░] 50%
```

- Generation takes 1-3 seconds per clip
- Progress bar shows current status
- Can take 10-30 seconds for complete NPC

### What Gets Generated

Each dialogue node receives:
- MP3 audio file (192kbps, 44.1kHz)
- File size: ~50-100KB per clip
- Duration: Varies by text length
- Stored in: `gdd-assets/npc_{id}/voice/`

---

## Managing Voice Clips

### Generated Clips List

View all generated clips:
- ✓ **Green badge**: Clip generated successfully
- **Grey badge**: Clip not yet generated
- **Play button**: Preview the clip
- **Download button**: Download individual clip

### Individual Clip Actions

**Play Clip**
- Click play button to hear the clip
- Audio plays inline in the browser
- Verify quality before exporting

**Download Clip**
- Click download button
- Saves as: `{nodeId}.mp3`
- Use for individual distribution

### Bulk Actions

**Download All (ZIP)**
- Creates ZIP file with all clips
- Includes voice profile metadata
- Filename: `{npcName}_voices_{timestamp}.zip`

**Regenerate All**
- Replaces all existing clips
- Uses current voice settings
- Previous clips are overwritten

**Delete All Clips**
- Removes all voice files
- Frees up disk space
- Cannot be undone

---

## Exporting

### Script Export

Voice clips are automatically included in NPC script exports:

```json
{
  "npcId": "village_elder",
  "dialogueTree": { ... },
  "voice": {
    "npcId": "village_elder",
    "voiceId": "21m00Tcm4TlvDq8ikWAM",
    "voiceName": "Rachel - Calm",
    "settings": {
      "modelId": "eleven_multilingual_v2",
      "stability": 0.5,
      "similarityBoost": 0.75
    },
    "clips": {
      "greeting": {
        "nodeId": "greeting",
        "text": "Welcome, traveler!",
        "audioUrl": "voice/greeting.mp3",
        "fileSize": 52480,
        "generatedAt": "2025-10-21T10:30:00Z"
      }
    },
    "totalClips": 5
  }
}
```

### Content Pack Export

Voices are included in complete content packs:
- All audio files included in package
- Voice metadata preserved
- Ready for game integration

---

## Cost Estimation

### Pricing Model

ElevenLabs pricing (2025):
- **Multilingual v2**: 1 character = 1 credit
- **Turbo/Flash v2.5**: 1 character = 0.5 credit

### Cost Calculation

Example NPC with 10 dialogue nodes:
```
Total characters: 500
Model: Multilingual v2
Credits needed: 500
Estimated cost: $0.0015 USD
```

### Plan Limits

| Plan | Monthly Characters | Cost |
|------|-------------------|------|
| **Free** | 10,000 | $0 |
| **Starter** | 30,000 | $5 |
| **Creator** | 100,000 | $22 |
| **Pro** | 500,000 | $99 |

**Tip**: Use Turbo v2.5 for development to save credits.

---

## Troubleshooting

### "Voice generation service not available"

**Cause**: ElevenLabs API key not configured

**Solution**:
1. Check `.env` file has `ELEVENLABS_API_KEY=...`
2. Restart the API server: `npm run dev:backend`
3. Verify key at [elevenlabs.io/app/settings](https://elevenlabs.io/app/settings)

### "Failed to generate speech"

**Causes**:
- Rate limit exceeded
- Invalid API key
- Network connectivity issue

**Solutions**:
1. Wait 1 minute and retry
2. Check API key is valid
3. Verify internet connection
4. Check ElevenLabs service status

### "No voices found"

**Cause**: Voice library failed to load

**Solution**:
1. Click **Retry** button
2. Check browser console for errors
3. Verify API key permissions

### Generation is slow

**Solutions**:
- Use **Turbo v2.5** or **Flash v2.5** model
- Generate during off-peak hours
- Check internet speed
- Consider smaller batches

### Audio quality is poor

**Solutions**:
- Use **Multilingual v2** model
- Increase **Similarity Boost** to 0.8-0.9
- Increase **Stability** to 0.6-0.7
- Try a different voice
- Check source text for typos

### Clips not playing

**Solutions**:
- Check browser audio permissions
- Verify MP3 file exists in `gdd-assets/`
- Try different browser
- Check browser console for errors

---

## Best Practices

### Voice Selection
- **Match personality**: Choose voice that fits NPC archetype
- **Consistency**: Use same voice for all dialogue nodes
- **Preview first**: Always preview before batch generation

### Settings
- **Start with defaults**: Stability 0.5, Similarity 0.75
- **Iterate**: Adjust settings based on results
- **Test variations**: Try different settings for different emotions

### Workflow
1. **Create complete dialogue tree** first
2. **Select and preview** voice
3. **Adjust settings** for desired tone
4. **Generate batch** for all nodes
5. **Review and iterate** if needed
6. **Export** with scripts

### Cost Optimization
- Use **Turbo v2.5** for development
- Use **Multilingual v2** for final production
- Generate only when dialogue is finalized
- Preview before batch generation

---

## Integration with Game

### Loading Voice Clips

```typescript
// Game code - load NPC script with voice
const npcScript = await loadNPCScript('village_elder')

if (npcScript.voice) {
  console.log(`NPC has ${npcScript.voice.totalClips} voice clips`)

  // Preload audio files
  for (const [nodeId, clip] of Object.entries(npcScript.voice.clips)) {
    await audioSystem.preload(clip.audioUrl)
  }
}
```

### Playing Dialogue with Voice

```typescript
// When player interacts with NPC
function onNPCDialogue(nodeId: string) {
  const node = dialogueTree.nodes.find(n => n.id === nodeId)
  const voiceClip = npcScript.voice?.clips[nodeId]

  // Show text
  ui.showDialogue(node.text)

  // Play voice if available
  if (voiceClip) {
    audioSystem.play3D(voiceClip.audioUrl, {
      position: npc.position,
      volume: 1.0,
      group: 'voice'
    })
  }
}
```

---

## Advanced Features

### Voice Cloning

ElevenLabs supports custom voice cloning:
1. Upload 1+ minute of clean audio
2. Create custom voice in ElevenLabs dashboard
3. Voice appears in library
4. Use for unique NPC voices

### Multilingual NPCs

Generate dialogue in multiple languages:
```
Settings:
  Model: Multilingual v2
  Text: "Bonjour, voyageur!"
  Voice: French accent voice
```

### Emotion Control

Adjust style parameter for emotional delivery:
- **Angry**: Style 0.7, Stability 0.3
- **Sad**: Style 0.5, Stability 0.6
- **Excited**: Style 0.8, Stability 0.4

---

## Resources

- **ElevenLabs Documentation**: [elevenlabs.io/docs](https://elevenlabs.io/docs)
- **Voice Library**: [elevenlabs.io/voice-library](https://elevenlabs.io/voice-library)
- **Pricing**: [elevenlabs.io/pricing](https://elevenlabs.io/pricing)
- **API Reference**: [elevenlabs.io/docs/api-reference](https://elevenlabs.io/docs/api-reference)

---

## Next Steps

- [Content Generation Guide](./content-generation.md) - Create NPCs and quests
- [NPC Scripts Guide](./npc-scripts.md) - Build dialogue trees
- [Export Guide](../deployment/export-process.md) - Export content packs

---

**Back to**: [User Guides](../03-user-guides) | [Main Documentation](../../README.md)
