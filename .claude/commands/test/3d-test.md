---
description: Test 3D viewer and Three.js components
allowed-tools: [Bash, Read, Grep]
---

# 3D Component Testing

Test Three.js and React Three Fiber components with visual verification.

## Run 3D Viewer Tests

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== 3D Component Tests ===" && echo "Testing: VRM viewer, Three.js scene, animations" && echo && bun test --grep "3D|viewer|three|VRM" 2>&1 && echo -e "\n✅ 3D tests passed" || (echo -e "\n❌ 3D tests failed - check error screenshots in /logs" && exit 1)`
```

## Test Categories

Tests cover:
- **VRM Model Loading** - Character model import and parsing
- **Animation Retargeting** - Bone mapping and animation transfer
- **Hand Tracking** - MediaPipe hand tracking integration
- **Scene Rendering** - Three.js scene hierarchy
- **Camera Controls** - OrbitControls and camera positioning
- **Model Scaling** - 1.7m default height for characters
- **Ground Positioning** - Proper floor alignment

## Visual Verification

Use colored cube proxies for visual testing:

- 🔴 **Red** - Characters/VRM models
- 🔵 **Blue** - Items/Props
- 🟢 **Green** - Rigging points/bones
- 🟡 **Yellow** - Camera targets
- 🟣 **Purple** - Light sources
- ⚪ **White** - Ground plane

## Components Tested

- @packages/asset-forge/src/components/shared/ThreeViewer.tsx
- @packages/asset-forge/src/components/VRMViewer/
- @packages/asset-forge/src/components/Preview3D/
- @packages/asset-forge/src/hooks/useVRM.ts
- @packages/asset-forge/src/utils/vrmUtils.ts

## Error Handling

- Screenshots saved to `/logs/3d-errors/`
- Scene snapshots for debugging
- Console logs captured
- Stack traces preserved

## Visual Regression

For visual regression testing:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Visual regression tests not yet implemented" && echo "Use Playwright + Percy for visual diffs"`
```

## See Also

- `/test` - Full test suite
- @.claude/memory/testing-standards.md - Testing guidelines
