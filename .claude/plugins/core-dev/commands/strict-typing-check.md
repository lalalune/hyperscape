---
description: Enforce TypeScript strict typing standards (ADR-0006)
---

# Strict Typing Standards Check

Enforcing TypeScript strict typing per **ADR-0006**: No `any` or `unknown` types allowed.

## Check Process

I will:
1. Search for `any` type usage across the codebase
2. Search for `unknown` type usage
3. Find property existence checks (`'property' in object`)
4. Identify missing return types on public methods
5. Report violations with file locations
6. Help fix violations using proper typing patterns

## Forbidden Patterns

- `any` types - **NEVER**
- `as any` - **NEVER**
- `unknown` types (except external APIs)
- Property existence checks
- Optional chaining for type narrowing

## Required Patterns

- Explicit return types on public methods
- Strong type assumptions based on context
- Non-null assertions when safe (`value!`)
- Discriminated unions for variants
- Import types explicitly (`import type { }`)

Which package should I check, or should I scan the entire monorepo?
