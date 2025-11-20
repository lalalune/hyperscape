# Hyperscape Plugin Rules - Organization Guide

This directory contains focused, composable rules for the Hyperscape plugin, following [Cursor's rule guidelines](https://cursor.com/docs/context/rules).

## Rule Structure

Rules are split into focused files, each under 500 lines:

### Overview Rule
- **`hyperscape-plugin-eliza.mdc`** (77 lines) - Quick reference and overview
  - Always applies to plugin files
  - References detailed rule files
  - Provides quick patterns and reminders

### Detailed Rules
- **`plugin-eliza-core-principles.mdc`** (106 lines) - Core architecture principles
  - Always applies to plugin files
  - Service-first architecture
  - Type safety and error handling
  - Forbidden/required patterns

- **`plugin-eliza-actions.mdc`** (130 lines) - Action implementation patterns
  - Applies to `src/actions/**/*.ts`
  - References actual action files
  - Action structure and validation patterns

- **`plugin-eliza-providers.mdc`** (103 lines) - Provider implementation patterns
  - Applies to `src/providers/**/*.ts`
  - References actual provider files
  - Provider structure and ordering

- **`plugin-eliza-service-managers.mdc`** (118 lines) - Service and manager patterns
  - Applies to `src/service.ts`, `src/services/**/*.ts`, `src/managers/**/*.ts`
  - Service lifecycle patterns
  - Manager initialization order

- **`plugin-eliza-systems-testing.mdc`** (108 lines) - Systems and testing patterns
  - Applies to `src/systems/**/*.ts`, `src/testing/**/*.ts`, `src/__tests__/**/*.ts`
  - System implementation patterns
  - Testing frameworks and patterns

- **`plugin-eliza-directory-structure.mdc`** (92 lines) - File organization
  - Applies to all plugin files
  - Directory structure and naming conventions
  - Import patterns

- **`plugin-eliza-config-templates.mdc`** (105 lines) - Config, templates, utils
  - Applies to `src/config/**/*.ts`, `src/templates/**/*.ts`, `src/utils/**/*.ts`
  - Configuration patterns
  - Template structure
  - Utility function patterns

## Rule Application

Rules use Cursor's MDC format with:
- `description` - What the rule covers
- `globs` - File patterns that trigger the rule
- `alwaysApply` - Whether rule applies automatically

Rules are applied intelligently based on:
- File patterns (`globs`)
- Always apply flag (`alwaysApply: true`)
- Manual @-mentioning

## File References

Rules reference actual code files using `@filename` syntax:
- `@packages/plugin-eliza/src/index.ts` - Plugin entry point
- `@packages/plugin-eliza/src/actions/movement.ts` - Action examples
- `@packages/plugin-eliza/src/providers/gameState.ts` - Provider examples

This ensures rules stay current with actual code patterns.

## Cursor Hooks

Hooks enforce rules automatically:
- **beforeSubmitPrompt** - Research and KISS reminders
- **afterFileEdit** - Rule violation checks
- **beforeReadFile** - Research reminders for complex files

See `~/.cursor/hooks.json` for hook configuration.

## Best Practices

Following Cursor's guidelines:
- ✅ All rules under 500 lines
- ✅ Focused and composable
- ✅ Concrete examples with file references
- ✅ Clear, actionable guidance
- ✅ Written like internal documentation

