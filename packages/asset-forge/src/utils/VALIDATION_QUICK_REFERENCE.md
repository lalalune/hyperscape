# Validation Helpers - Quick Reference Guide

## Import

```typescript
import {
  isDefined,
  isNonEmpty,
  safeFirst,
  ensureArray,
  // ... etc
} from '@/utils/validation-helpers'
```

---

## Common Patterns

### ✅ Safe Property Access

```typescript
// ❌ UNSAFE
const name = user.profile.name
const firstItem = items[0].name

// ✅ SAFE - Optional Chaining
const name = user?.profile?.name ?? 'Unknown'
const firstItem = items?.[0]?.name

// ✅ SAFE - Helper Function
const firstItem = safeFirst(items)
if (firstItem) {
  console.log(firstItem.name)
}
```

---

### ✅ Safe Array Operations

```typescript
// ❌ UNSAFE
const names = users.map(u => u.name)
const total = items.reduce((sum, item) => sum + item.price, 0)

// ✅ SAFE - With Nullish Coalescing
const names = users?.map(u => u.name) ?? []
const total = items?.reduce((sum, item) => sum + (item.price ?? 0), 0) ?? 0

// ✅ SAFE - With Helper
const names = ensureArray(users).map(u => u.name)
```

---

### ✅ Type Guards

```typescript
// ❌ UNSAFE
if (value) {
  console.log(value.property)
}

// ✅ SAFE - Type Guard
if (isDefined(value)) {
  console.log(value.property) // TypeScript knows value is defined
}

// ✅ SAFE - Non-Empty Array
if (isNonEmpty(items)) {
  console.log(items[0]) // Safe access
}
```

---

### ✅ Function Arguments

```typescript
// ❌ UNSAFE
function processItems(items) {
  return items.map(...)
}

// ✅ SAFE - Validation
function processItems(items: Item[] | null | undefined): ProcessedItem[] {
  if (!items || items.length === 0) {
    return []
  }
  return items.map(...)
}

// ✅ SAFE - Helper
function processItems(items: Item[] | null | undefined): ProcessedItem[] {
  return ensureArray(items).map(...)
}
```

---

### ✅ API Responses

```typescript
// ❌ UNSAFE
const data = await response.json()
console.log(data.user.name)

// ✅ SAFE - Optional Chaining
const data = await response.json()
const name = data?.user?.name ?? 'Unknown'

// ✅ SAFE - With Validation
const data = await response.json()
if (hasRequiredProps(data, ['user'])) {
  console.log(data.user.name) // Type-safe
}
```

---

### ✅ JSON Parsing

```typescript
// ❌ UNSAFE
const data = JSON.parse(jsonString)

// ✅ SAFE - Try-Catch
try {
  const data = JSON.parse(jsonString)
} catch (error) {
  console.error('Parse failed:', error)
}

// ✅ SAFE - Helper
const data = safeJsonParse<MyType>(jsonString)
if (data) {
  // Use data safely
}
```

---

### ✅ Nullish Coalescing vs Logical OR

```typescript
// ❌ WRONG - Falsy values (0, '', false) are replaced
const value = config.value || defaultValue

// ✅ CORRECT - Only null/undefined are replaced
const value = config.value ?? defaultValue

// Examples:
0 || 10        // 10 ❌
0 ?? 10        // 0  ✅

'' || 'default'   // 'default' ❌
'' ?? 'default'   // ''        ✅

false || true  // true  ❌
false ?? true  // false ✅
```

---

## Helper Function Reference

### Type Guards
- `isDefined<T>(value)` - Check if not null/undefined
- `isNonEmpty<T>(array)` - Check if array has elements
- `isNonEmptyString(value)` - Check if string is not empty
- `isObject(value)` - Check if value is a valid object

### Safe Access
- `safeArrayAccess<T>(array, index)` - Safe array[index]
- `safeFirst<T>(array)` - Safe array[0]
- `safeLast<T>(array)` - Safe array[length-1]
- `safeGet<T, K>(obj, key)` - Safe obj.key
- `safeJsonParse<T>(json)` - Safe JSON.parse()

### Value Coercion
- `ensureArray<T>(value)` - Convert to array ([] if null)
- `ensureString(value)` - Convert to string ('' if null)
- `ensureNumber(value, default)` - Convert to number

### Validation
- `validateArray<T>(array, name)` - Validate non-empty array
- `filterDefined<T>(array)` - Remove null/undefined
- `hasRequiredProps<T, K>(obj, keys)` - Check required properties

### Execution
- `safeExecute<T>(fn, errorMsg)` - Execute with error catching
- `safeExecuteAsync<T>(fn, errorMsg)` - Async execute with error catching

### Assertions
- `assertDefined<T>(value, message)` - Throw if null/undefined

---

## When to Use What

### Use Optional Chaining (`?.`)
- Accessing nested properties
- Property chains that may be undefined
- Array element access

### Use Nullish Coalescing (`??`)
- Providing default values
- When falsy values (0, '', false) are valid
- Replacing only null/undefined

### Use Helper Functions
- Complex validation logic
- Reusable patterns across codebase
- When you need type narrowing
- Array operations with unknown state

### Use Try-Catch
- JSON parsing
- External API calls
- File operations
- Any operation that can throw

---

## Anti-Patterns to Avoid

### ❌ Non-Null Assertion (`!`)
```typescript
// ❌ AVOID - Can crash at runtime
const name = user!.name

// ✅ USE INSTEAD
const name = user?.name ?? 'Unknown'
```

### ❌ Type Casting with `as`
```typescript
// ❌ AVOID - Bypasses type safety
const name = (data as User).name

// ✅ USE INSTEAD
if (isDefined(data) && hasRequiredProps(data, ['name'])) {
  const name = data.name
}
```

### ❌ Logical OR for Defaults
```typescript
// ❌ AVOID - Incorrect for 0, '', false
const count = value || 0

// ✅ USE INSTEAD
const count = value ?? 0
```

---

## Best Practices

1. **Always validate API responses**
2. **Use optional chaining for nested access**
3. **Prefer `??` over `||` for defaults**
4. **Add null checks in array operations**
5. **Use type guards for better TypeScript inference**
6. **Validate function arguments at entry point**
7. **Use try-catch for operations that can throw**
8. **Leverage helper functions for common patterns**

---

## Examples from Codebase

### Asset Filtering
```typescript
// Before
if (state.searchTerm && !asset.name.toLowerCase().includes(...))

// After
if (state.searchTerm && !asset.name?.toLowerCase().includes(...))
```

### API Response Handling
```typescript
// Before
return data.voices

// After
return data.voices ?? []
```

### Nested Property Access
```typescript
// Before
const avatarMerged = PromptService.mergePrompts(data.avatar.default, data.avatar.custom)

// After
const avatarMerged = PromptService.mergePrompts(
  data?.avatar?.default ?? {},
  data?.avatar?.custom ?? {}
)
```

---

**Remember:** Prevention is better than runtime crashes!
