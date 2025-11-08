# Testing Workflow

## Overview
Comprehensive testing procedures for Hyperscape features using real gameplay testing.

## Test Execution Procedures

### 1. Test Setup
- Create Hyperscape world instance for test
- Add all required entities (players, mobs, items)
- Verify entities are added correctly
- Set up overhead camera rig for visual testing

### 2. Visual Testing Setup
- Configure colored cube proxies:
  - 🔴 Players
  - 🟢 Goblins
  - 🔵 Items
  - 🟡 Trees
  - 🟣 Banks
  - 🟨 Stores
- Set up Playwright browser instance
- Configure screenshot capture

### 3. Test Execution
- Run test scenario
- Capture screenshots at key points
- Verify Three.js scene hierarchy
- Check entity positions and states
- Verify ECS system data

### 4. Error Log Collection
- Capture all console errors
- Save logs to `/logs` folder
- Include test name and timestamp
- Verify logs are empty after successful test

### 5. Test Result Validation
- Check visual test results (pixel analysis)
- Verify Three.js scene state
- Validate ECS component data
- Confirm no errors in logs
- Document any failures

## Testing Methods

### Three.js Testing
- Check scene hierarchy
- Verify object positions
- Validate entity existence

### Visual Testing
- Screenshot analysis
- Colored pixel detection
- Distance calculations

### System Integration
- ECS system introspection
- Component data validation
- Event system verification

### LLM Verification (Sparingly)
- Use GPT-4o for complex UI verification
- Image analysis for edge cases
- Only when necessary (slow/expensive)

## Test Requirements
- Every feature MUST have tests
- All tests MUST pass before moving on
- Use real gameplay, real objects, real data
- No mocks, spies, or test framework abstractions

