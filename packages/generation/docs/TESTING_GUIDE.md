# Testing and Validation Guide

This guide covers comprehensive testing and validation of generated assets for the Hyperscape RPG.

## Overview

The generation system includes multiple validation layers:
1. **Automated Validation** - Technical requirements and quality checks
2. **Visual Testing** - Screenshot-based verification
3. **Human Review** - Manual quality assessment
4. **Integration Testing** - End-to-end pipeline validation

## Automated Validation

### Asset Requirements

Each asset type has specific validation requirements:

#### Weapons
- **Polycount**: 500-5,000 triangles
- **Hardpoints**: Must detect grip positions
- **Format**: GLB with textures
- **Metadata**: Equipment stats and bonuses

#### Armor
- **Polycount**: 500-8,000 triangles
- **Placement**: Attachment points for body parts
- **Format**: GLB with textures
- **Metadata**: Defense bonuses and requirements

#### Characters/Monsters
- **Polycount**: 2,000-15,000 triangles
- **Rigging**: Bone structure for animation
- **Format**: GLB with textures
- **Metadata**: Combat stats and behaviors

#### Buildings
- **Polycount**: 5,000-30,000 triangles
- **Analysis**: Entry points and functional areas
- **Format**: GLB with textures
- **Metadata**: NPC positions and interactions

#### Tools
- **Polycount**: 200-3,000 triangles
- **Format**: GLB with textures
- **Metadata**: Tool type and usage

#### Consumables/Resources
- **Polycount**: 100-4,000 triangles
- **Format**: GLB with textures
- **Metadata**: Stackable properties

### Running Validation

```bash
# Validate a single generated asset
npm run validate <asset-id>

# Run full validation suite
npm run test:validation

# Generate validation report
npm run validate:report
```

## Visual Testing

### Screenshot Generation
- **Overhead camera** captures asset from multiple angles
- **Lighting setup** ensures consistent visibility
- **Background** uses solid colors for clear contrast
- **Multiple views** (front, side, top, isometric)

### Visual Checks
- Model loads correctly
- Textures display properly
- No visual artifacts
- Appropriate scale and proportions
- Material quality meets standards

### Automated Visual Analysis
- **Color analysis** detects dominant colors
- **Edge detection** identifies model boundaries
- **Texture quality** measures resolution and clarity
- **Lighting response** verifies material properties

## Human Review Process

### Review Checklist

Each asset type has a specific review checklist:

#### Weapons
- [ ] Grip position is correct
- [ ] Weapon orientation matches expected usage
- [ ] Blade/head is properly aligned
- [ ] Scale is appropriate for character hands
- [ ] Material tier is visually distinct

#### Armor
- [ ] Armor piece fits expected body part
- [ ] Attachment points are logical
- [ ] No clipping issues with character model
- [ ] Material looks appropriate for armor type
- [ ] Tier progression feels logical

#### Characters
- [ ] Character proportions are correct
- [ ] Rigging points are positioned properly
- [ ] Facial features are appropriate
- [ ] Equipment attachment points exist
- [ ] Matches game aesthetic

#### Buildings
- [ ] Entry points are clearly defined
- [ ] Interior space is functional
- [ ] NPC placement positions make sense
- [ ] Building style fits game aesthetic
- [ ] Scale is appropriate for gameplay

### Quality Assessment Questions

For each asset, reviewers should consider:
1. Does this asset look like it belongs in a RuneScape-style RPG?
2. Would players immediately understand what this item is?
3. Is the visual quality consistent with other game assets?
4. Are there any obvious visual artifacts or errors?
5. Does the material tier feel appropriately valuable?
6. Would you be excited to obtain this item in-game?

### Review Scoring

Assets are scored on a 1-10 scale across these criteria:
- **Visual Quality** (1-10): Overall appearance and finish
- **Accuracy** (1-10): Matches description and requirements
- **Game Fit** (1-10): Fits RPG aesthetic and style
- **Technical Quality** (1-10): Clean geometry and textures
- **Innovation** (1-10): Creative and interesting design

## Integration Testing

### End-to-End Pipeline Tests

Test the complete generation pipeline:

1. **Input Processing** - Description parsing and type detection
2. **Image Generation** - Concept art creation
3. **3D Generation** - Model creation from image
4. **Remeshing** - Polycount optimization
5. **Analysis** - Hardpoint/placement detection
6. **Finalization** - Asset packaging and metadata

### Batch Testing

Test batch generation of complete item sets:

```bash
# Test all RPG weapons
npm run test:batch rpg-weapons-batch.json

# Test all RPG armor
npm run test:batch rpg-armor-batch.json

# Test all RPG monsters
npm run test:batch rpg-monsters-batch.json

# Test complete RPG asset set
npm run test:batch rpg-complete-batch.json
```

### Performance Testing

Monitor generation performance:
- **Generation time** per asset
- **Memory usage** during processing
- **API rate limits** for external services
- **Cache hit rates** for repeated requests

## Test Scenarios

### Core Test Scenarios

#### 1. Basic Weapon Generation
- **Input**: "A simple bronze sword"
- **Expected**: Sword model with grip hardpoints
- **Validation**: Polycount < 5000, hardpoints detected

#### 2. Tiered Armor Generation
- **Input**: Bronze/Steel/Mithril helmet variations
- **Expected**: Three distinct helmet models
- **Validation**: Visual tier progression, appropriate materials

#### 3. Building Functionality
- **Input**: "A small town bank"
- **Expected**: Bank with vault and teller areas
- **Validation**: Entry points detected, functional areas mapped

#### 4. Character Rigging
- **Input**: "A goblin warrior"
- **Expected**: Rigged character model
- **Validation**: Bone structure appropriate for animation

### Edge Case Testing

#### 1. Ambiguous Descriptions
- **Input**: "A thing"
- **Expected**: Graceful fallback to decoration type
- **Validation**: Asset generated despite vague description

#### 2. Complex Materials
- **Input**: "A mithril sword with glowing runes"
- **Expected**: Magical appearance with special effects
- **Validation**: Material tier correctly applied

#### 3. Large Buildings
- **Input**: "A massive castle"
- **Expected**: Complex building within polycount limits
- **Validation**: Polycount < 30000, multiple functional areas

## Continuous Integration

### Automated Testing Pipeline

```yaml
# .github/workflows/generation-tests.yml
name: Generation Tests
on: [push, pull_request]

jobs:
  test-generation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run validation tests
        run: npm run test:validation
      - name: Generate test report
        run: npm run validate:report
      - name: Upload test results
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: test-results/
```

### Quality Gates

Before merging changes:
- [ ] All validation tests pass
- [ ] Visual regression tests pass
- [ ] Human review scores > 7/10 average
- [ ] Performance benchmarks met
- [ ] No critical security issues

## Monitoring and Metrics

### Success Metrics
- **Validation pass rate**: > 90%
- **Human review scores**: > 7/10 average
- **Generation time**: < 5 minutes per asset
- **Cache hit rate**: > 60%
- **API error rate**: < 5%

### Quality Metrics
- **Visual quality scores**: Track over time
- **User satisfaction**: Feedback from game developers
- **Asset usage**: Which assets are actually used in game
- **Iteration rate**: How often assets need regeneration

## Debugging and Troubleshooting

### Common Issues

#### 1. Low Polycount
- **Symptom**: Model too simple or blocky
- **Solution**: Increase target polycount or improve prompt
- **Prevention**: Set appropriate polycount minimums

#### 2. Missing Hardpoints
- **Symptom**: Weapon analysis fails
- **Solution**: Improve weapon detection algorithm
- **Prevention**: Better weapon type classification

#### 3. Poor Textures
- **Symptom**: Blurry or incorrect materials
- **Solution**: Regenerate with better image prompt
- **Prevention**: Use material-specific keywords

#### 4. Scale Issues
- **Symptom**: Asset too large/small for game
- **Solution**: Normalize scale in post-processing
- **Prevention**: Include scale references in prompts

### Debug Tools

```bash
# Enable verbose logging
DEBUG=true npm run generate

# Save intermediate results
SAVE_INTERMEDIATES=true npm run generate

# Skip caching for testing
NO_CACHE=true npm run generate

# Test with mock APIs
MOCK_APIS=true npm run test
```

## Conclusion

Comprehensive testing ensures that generated assets meet the high quality standards required for an RPG game. By combining automated validation, visual testing, and human review, we can maintain consistency and quality across all generated content.

The testing framework is designed to catch issues early in the generation process, reducing the need for manual fixes and ensuring that assets are game-ready upon generation.