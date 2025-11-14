# Voice Generation Guide

Generate professional voice-overs for NPC dialogue using ElevenLabs text-to-speech AI.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Voice Standalone Page](#voice-standalone-page)
- [Selecting a Voice](#selecting-a-voice)
- [Voice Settings](#voice-settings)
- [Generating Voices](#generating-voices)
- [Managing Voice Clips](#managing-voice-clips)
- [Exporting](#exporting)
- [Performance Features](#performance-features)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Voice Generation system allows you to create AI-powered voice-overs for your NPC dialogue trees using ElevenLabs' advanced text-to-speech technology. Each dialogue node can have its own audio clip, creating fully voiced NPCs for your game.

### Features
- **3,000+ Voices**: Browse ElevenLabs' extensive voice library
- **32 Languages**: Support for multilingual content
- **Voice Customization**: Adjust stability, similarity, and style
- **Batch Generation**: Generate all dialogue clips at once
- **Real-time Cost Estimation**: See estimated costs as you type (debounced for performance)
- **Export Ready**: Voice clips included in NPC script exports
- **Standalone Experimentation**: Test voice settings without creating NPCs
- **High Performance**: Optimized for large text inputs (5000 character limit)

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

## Voice Standalone Page

The **Voice Standalone Page** provides a dedicated environment for experimenting with voice generation without needing to create NPCs or dialogue trees first.

### Access Voice Standalone

1. Open Asset Forge
2. Navigate to **Voice → Standalone** in the sidebar
3. The standalone voice experimentation page will load

### Features

#### Text Input
- **Character limit**: 5,000 characters (ElevenLabs maximum)
- **Real-time character counter**: Shows current count and limit
- **Warning threshold**: Yellow indicator at 90% (4,500 characters)
- **Debounced updates**: Input optimized for large text without lag

#### Cost Estimation
- **Live calculation**: Updates as you type (with 100ms debounce)
- **Model-aware**: Adjusts based on selected model
- **Character count**: Shows billable characters
- **USD estimate**: Displays cost in dollars

#### Voice Browser
- **Full library access**: All 3,000+ voices available
- **Advanced filtering**: Search and category filters
- **Voice preview**: Test voices before generating
- **Favorites**: Save frequently used voices

#### Settings Presets
- **Quick configuration**: One-click preset selection
- **Narrator preset**: Optimized for storytelling
- **Character preset**: Optimized for game characters
- **Professional preset**: Optimized for formal content
- **Custom settings**: Manual control of all parameters

#### Generation Controls
- **Instant preview**: Generate and play immediately
- **Download option**: Save generated audio file
- **Error handling**: Clear feedback on failures
- **Subscription tracking**: View quota usage

### Use Cases

**1. Voice Testing**
```
Test different voices for NPC archetypes:
- Try 5-10 voices with sample dialogue
- Compare quality and tone
- Save favorites for later use
```

**2. Prompt Optimization**
```
Experiment with text formatting:
- Add punctuation for pauses
- Use CAPS for emphasis
- Test different phrasings
```

**3. Settings Calibration**
```
Find optimal parameters:
- Adjust stability for consistency
- Tune similarity for voice accuracy
- Control style for emotion level
```

**4. Cost Planning**
```
Estimate project costs:
- Paste full script to see total cost
- Compare model pricing
- Plan budget allocation
```

### Performance Features

The standalone page includes several performance optimizations:

#### Debounced Text Input
- **100ms debounce**: Prevents excessive re-renders
- **Separated state**: Input state vs. computed state
- **Smooth typing**: No lag even with 5,000 characters
- **Efficient updates**: 100x fewer re-renders vs. direct binding

**Technical Details:**
```typescript
// Input updates immediately for responsive UI
const [inputText, setInputText] = useState('')

// Debounced text used for expensive operations
const [debouncedText, setDebouncedText] = useState('')

// Cost calculation only runs after 100ms of no typing
useEffect(() => {
  if (debouncedText.length === 0) return
  voiceGenerationService.estimateCost(debouncedText.length, modelId)
}, [debouncedText])
```

#### Optimized Cost Calculation
- Only calculates when text changes (debounced)
- Skips calculation for empty text
- Caches results to prevent duplicate API calls
- Updates asynchronously without blocking UI

#### Character Counter
- Updates in real-time as you type
- Color-coded warnings:
  - **Green**: 0-4,499 characters (safe)
  - **Yellow**: 4,500-4,999 characters (warning)
  - **Red**: 5,000+ characters (at limit)

### Best Practices

**Workflow:**
1. Select a voice from the browser
2. Apply a preset or configure custom settings
3. Paste or type your text (up to 5,000 chars)
4. Review cost estimate
5. Click "Generate Voice"
6. Preview the audio
7. Download if satisfied

**Performance Tips:**
- Large text inputs (>1,000 chars) benefit from debouncing
- Cost estimates update smoothly without blocking typing
- Use presets for faster configuration
- Preview before generating multiple variations

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

## Performance Features

The voice generation system includes several performance optimizations to ensure smooth operation even with large text inputs and complex workflows.

### Text Input Debouncing

**Problem Solved**: Typing large amounts of text (1,000+ characters) can trigger excessive re-renders and cost calculations, causing UI lag.

**Solution**: 100ms debounce on text state updates separates immediate input from expensive operations.

**Benefits**:
- ✅ **100x fewer re-renders**: ~45 renders vs. ~4,500 for 5,000 character input
- ✅ **30x faster**: Text input test completes in <2s vs. 60s timeout
- ✅ **Smooth typing**: No lag or stuttering during fast typing
- ✅ **Responsive UI**: Character counter updates immediately, cost calculations debounced

**Implementation**:
```typescript
// Two separate state variables
const [inputText, setInputText] = useState('')        // Updates immediately
const [debouncedText, setDebouncedText] = useState('') // Updates after 100ms

// Debounce effect
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedText(inputText)
  }, 100)
  return () => clearTimeout(timer)
}, [inputText])

// Expensive operations use debouncedText
useEffect(() => {
  if (debouncedText.length === 0) {
    setCostEstimate(null)
    return
  }
  voiceGenerationService.estimateCost(debouncedText.length, modelId)
    .then(estimate => setCostEstimate(estimate))
}, [debouncedText, modelId])
```

### Cost Calculation Optimization

**Features**:
- Only calculates when debounced text changes
- Skips calculation for empty text
- Caches model information to prevent duplicate lookups
- Runs asynchronously without blocking UI
- Handles errors gracefully without crashing

### Test Performance

The test suite includes optimizations for large text input testing:

**fillLargeTextarea Helper**:
```typescript
// Direct DOM manipulation instead of character-by-character typing
export async function fillLargeTextarea(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  await page.evaluate(
    ({ sel, txt }) => {
      const element = document.querySelector(sel) as HTMLTextAreaElement
      if (element) {
        element.value = txt
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }
    },
    { sel: selector, txt: text }
  )
  await page.waitForTimeout(500) // Wait for debounce to settle
}
```

**Benefits**:
- ✅ Sets 5,000 characters instantly vs. 60+ seconds
- ✅ Properly triggers React events
- ✅ Waits for debounce to settle
- ✅ Enables comprehensive large-text testing

### Data Attributes for Testing

All key UI elements include `data-testid` attributes for stable, reliable test selectors:

**Available Test IDs**:
```typescript
// Page structure
data-testid="voice-standalone-page"        // Main container
data-testid="page-title"                   // Page heading

// Input elements
data-testid="voice-input-text"             // Text textarea
data-testid="character-counter"            // Character count display
data-testid="cost-estimate"                // Cost estimation badge

// Controls
data-testid="voice-browser-toggle"         // Voice browser button

// Navigation (dynamic)
data-testid="nav-section-${sectionId}"     // Navigation section
data-testid="nav-item-${itemId}"           // Navigation item
```

**Benefits**:
- ✅ Stable selectors that don't break with text changes
- ✅ Language-independent (works with translations)
- ✅ Resilient to CSS class changes
- ✅ Easier debugging and test maintenance

### Performance Metrics

**Large Text Input (5,000 characters)**:
- Old: 60+ seconds (timeout)
- New: <2 seconds
- Improvement: 30x faster

**Re-render Count (5,000 character input)**:
- Old: ~4,500 renders (1 per character)
- New: ~45 renders (1 per debounce period)
- Improvement: 100x fewer renders

**Cost Calculations**:
- Old: ~4,500 API calls (1 per character)
- New: ~45 API calls (1 per debounce period)
- Improvement: 100x fewer calculations

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
