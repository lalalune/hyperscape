# Feature Development Workflow

## Overview
Standard workflow for implementing new features in Hyperscape.

## Implementation Flow

### 1. Planning Phase
- Review GDD (Game Design Document) for feature requirements
- Check existing architecture and systems
- Identify dependencies and integration points
- Create ADR if architectural decision needed

### 2. Implementation Phase
- Create feature branch: `git checkout -b feature/feature-name`
- Implement feature following architecture patterns
- Use existing Hyperscape systems where possible
- Keep RPG isolated from Hyperscape core
- Write production code only (no TODOs or examples)

### 3. Testing Requirements
- Write comprehensive tests using Playwright
- Test multimodal verification (data + visual)
- Use real Hyperscape instances, no mocks
- Save error logs to `/logs` folder
- Ensure all tests pass before proceeding

### 4. Code Review Process
- Self-review against compliance checklist
- Verify TypeScript strict typing (no `any` types)
- Check that all features have tests
- Ensure no hardcoded data
- Verify file dependencies are updated

### 5. Integration
- Merge feature branch to main
- Run full test suite
- Verify no regressions
- Update documentation if needed

## Deployment Procedures
- Run pre-deployment checklist
- Deploy to staging environment
- Verify functionality in staging
- Deploy to production
- Monitor for issues

## Feature Checklist
- [ ] Feature implemented according to GDD
- [ ] All tests written and passing
- [ ] No TypeScript errors
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Deployed and verified

