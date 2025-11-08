---
alwaysApply: true
description: Research-first protocol - code writing is the LAST priority
---

# Research-First Protocol

**CRITICAL RULE: Writing code is your LAST priority**

## The Mandatory Workflow

Before writing ANY code, you MUST complete these steps in order:

### 1. RESEARCH (First Priority)
- **Use deepwiki** for ANY external libraries, frameworks, or APIs
- Claude's built-in knowledge is outdated - always verify with deepwiki
- Research latest patterns, best practices, and API changes
- Don't assume you know how a library works

### 2. GATHER CONTEXT (Second Priority)
- **Read existing files** that are related to your task
- **Use Grep** to search for similar patterns in the codebase
- **Use Glob** to find files that might already implement this
- Understand the existing architecture before changing it

### 3. REUSE EXISTING CODE (Third Priority)
- **Triple check** if existing code already does what you need
- Prefer editing existing files over creating new ones
- Don't duplicate functionality that already exists
- Search thoroughly before assuming you need new code

### 4. VERIFY WITH USER (Fourth Priority)
- **Ask the user** if you have ANY uncertainty
- Never make assumptions about requirements
- Confirm your approach before implementing
- Get clarification on edge cases

### 5. KEEP IT SIMPLE (Fifth Priority)
- **Simplest solution wins** - no over-engineering
- Avoid unnecessary abstractions
- Don't create frameworks or systems for single use cases
- KISS principle: Keep It Simple, Stupid

### 6. WRITE CODE (LAST Priority)
- Only write code after exhausting steps 1-5
- If you skipped any step above, STOP and go back

## Pre-Code Checklist

Before writing ANY code, verify:
- [ ] Used deepwiki to research external libraries/frameworks?
- [ ] Read all relevant existing files?
- [ ] Searched codebase for existing similar functionality?
- [ ] Asked user to verify approach and assumptions?
- [ ] Confirmed this is the simplest possible solution?
- [ ] Triple-checked you're not duplicating existing code?

**If ANY checkbox is unchecked, DO NOT write code yet.**

## Examples of Violations

❌ **BAD**: "Let me create a new UserService to handle this"
- Did you check if UserService already exists?
- Did you read the existing service layer architecture?

❌ **BAD**: "I'll use React Query for this feature"
- Did you use deepwiki to check if React Query is the right choice?
- Did you check what data fetching patterns we already use?

❌ **BAD**: "Let me add this third-party library"
- Did you research if we have existing dependencies that do this?
- Did you ask the user if adding dependencies is acceptable?

✅ **GOOD**: "Let me first read the existing authentication code and search for similar patterns"
✅ **GOOD**: "I'll use deepwiki to research the latest Drizzle ORM patterns before implementing"
✅ **GOOD**: "I found existing code that does something similar - can I confirm you want me to extend that file rather than create a new one?"

## Remember

Code is a liability, not an asset. Less code is better. Reusing existing code is better than writing new code. Research prevents mistakes. Asking prevents assumptions. Simplicity prevents bugs.

**Research first. Code last. Always.**
