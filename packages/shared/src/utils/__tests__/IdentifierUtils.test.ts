/**
 * `IdentifierUtils` — branded ID validators / creators / converters.
 *
 * Provides compile-time-only type-safety on string identifiers.
 * The 33 exports follow a regular pattern (isValid*ID / create*ID
 * / to*ID for each branded type), so tests use parametric
 * coverage via `it.each` to avoid 33× boilerplate.
 *
 * Why test these: they're the single chokepoint between
 * unknown/external strings and the branded ID types every
 * gameplay system relies on. Drift in the validation rule
 * (e.g. accidentally accepting empty strings) would silently
 * unblock invalid IDs across the entire engine.
 */

import { describe, expect, it } from "vitest";
import {
  assertValidID,
  assertValidSlotNumber,
  createBankID,
  createEntityID,
  createItemID,
  createMobID,
  createNPCID,
  createPlayerID,
  createResourceID,
  createSessionID,
  createSlotNumber,
  createStoreID,
  isValidBankID,
  isValidEntityID,
  isValidID,
  isValidItemID,
  isValidMobID,
  isValidNPCID,
  isValidPlayerID,
  isValidResourceID,
  isValidSessionID,
  isValidSlotNumber,
  isValidStoreID,
  toBankID,
  toEntityID,
  toItemID,
  toMobID,
  toNPCID,
  toPlayerID,
  toResourceID,
  toSessionID,
  toSlotNumber,
  toStoreID,
} from "../IdentifierUtils";

// String-id triple: { name, isValid, create, to }
const STRING_ID_TYPES = [
  {
    name: "PlayerID",
    isValid: isValidPlayerID,
    create: createPlayerID,
    to: toPlayerID,
  },
  {
    name: "ItemID",
    isValid: isValidItemID,
    create: createItemID,
    to: toItemID,
  },
  {
    name: "MobID",
    isValid: isValidMobID,
    create: createMobID,
    to: toMobID,
  },
  {
    name: "EntityID",
    isValid: isValidEntityID,
    create: createEntityID,
    to: toEntityID,
  },
  {
    name: "StoreID",
    isValid: isValidStoreID,
    create: createStoreID,
    to: toStoreID,
  },
  {
    name: "BankID",
    isValid: isValidBankID,
    create: createBankID,
    to: toBankID,
  },
  {
    name: "ResourceID",
    isValid: isValidResourceID,
    create: createResourceID,
    to: toResourceID,
  },
  {
    name: "NPCID",
    isValid: isValidNPCID,
    create: createNPCID,
    to: toNPCID,
  },
  {
    name: "SessionID",
    isValid: isValidSessionID,
    create: createSessionID,
    to: toSessionID,
  },
] as const;

describe("isValid*ID — string-id type guards (parametric)", () => {
  it.each(STRING_ID_TYPES)("$name accepts non-empty strings", ({ isValid }) => {
    expect(isValid("abc")).toBe(true);
    expect(isValid("123")).toBe(true);
    expect(isValid("a")).toBe(true);
    expect(isValid("very-long-id_with-mixed_chars-123")).toBe(true);
  });

  it.each(STRING_ID_TYPES)("$name rejects empty string", ({ isValid }) => {
    expect(isValid("")).toBe(false);
  });

  it.each(STRING_ID_TYPES)("$name rejects non-string values", ({ isValid }) => {
    expect(isValid(0)).toBe(false);
    expect(isValid(null)).toBe(false);
    expect(isValid(undefined)).toBe(false);
    expect(isValid({})).toBe(false);
    expect(isValid([])).toBe(false);
    expect(isValid(true)).toBe(false);
  });
});

describe("create*ID — throwing creators (parametric)", () => {
  it.each(STRING_ID_TYPES)("create$name returns valid id", ({ create }) => {
    expect(create("abc")).toBe("abc");
  });

  it.each(STRING_ID_TYPES)(
    "create$name throws on invalid (empty) input",
    ({ create }) => {
      expect(() => create("")).toThrow(/Invalid/);
    },
  );

  it.each(STRING_ID_TYPES)(
    "create$name throws on non-string input",
    ({ create }) => {
      // The function signature only accepts string but runtime
      // can pass through unknown values via `as` casts; the
      // validator should still throw rather than silently brand
      // a number/null.
      expect(() => create(null as unknown as string)).toThrow();
      expect(() => create(undefined as unknown as string)).toThrow();
    },
  );
});

describe("to*ID — null-returning safe converters (parametric)", () => {
  it.each(STRING_ID_TYPES)("to$name returns id when valid", ({ to }) => {
    expect(to("abc")).toBe("abc");
  });

  it.each(STRING_ID_TYPES)(
    "to$name returns null on invalid input (does NOT throw)",
    ({ to }) => {
      expect(to("")).toBeNull();
      expect(to(null)).toBeNull();
      expect(to(undefined)).toBeNull();
      expect(to(123)).toBeNull();
      expect(to({})).toBeNull();
    },
  );
});

describe("isValidSlotNumber + createSlotNumber + toSlotNumber", () => {
  it("accepts non-negative integers", () => {
    expect(isValidSlotNumber(0)).toBe(true);
    expect(isValidSlotNumber(1)).toBe(true);
    expect(isValidSlotNumber(27)).toBe(true);
  });

  it("rejects negative numbers", () => {
    expect(isValidSlotNumber(-1)).toBe(false);
    expect(isValidSlotNumber(-100)).toBe(false);
  });

  it("rejects non-integer numbers", () => {
    expect(isValidSlotNumber(1.5)).toBe(false);
    expect(isValidSlotNumber(0.1)).toBe(false);
  });

  it("rejects non-number values", () => {
    expect(isValidSlotNumber("0")).toBe(false);
    expect(isValidSlotNumber(null)).toBe(false);
    expect(isValidSlotNumber(undefined)).toBe(false);
  });

  it("createSlotNumber returns the number when valid", () => {
    expect(createSlotNumber(0)).toBe(0);
    expect(createSlotNumber(27)).toBe(27);
  });

  it("createSlotNumber throws on invalid input", () => {
    expect(() => createSlotNumber(-1)).toThrow(/Invalid slot number/);
    expect(() => createSlotNumber(1.5)).toThrow(/Invalid slot number/);
  });

  it("toSlotNumber returns null on invalid input", () => {
    expect(toSlotNumber(-1)).toBeNull();
    expect(toSlotNumber(1.5)).toBeNull();
    expect(toSlotNumber("0")).toBeNull();
    expect(toSlotNumber(null)).toBeNull();
  });

  it("toSlotNumber returns the number when valid", () => {
    expect(toSlotNumber(0)).toBe(0);
    expect(toSlotNumber(42)).toBe(42);
  });
});

describe("isValidID — generic any-string-id guard", () => {
  it("accepts non-empty strings", () => {
    expect(isValidID("abc")).toBe(true);
    expect(isValidID("a")).toBe(true);
  });

  it("rejects empty string + non-strings", () => {
    expect(isValidID("")).toBe(false);
    expect(isValidID(0)).toBe(false);
    expect(isValidID(null)).toBe(false);
  });
});

describe("assertValidID + assertValidSlotNumber", () => {
  it("assertValidID is a no-op on valid input", () => {
    expect(() => assertValidID("abc")).not.toThrow();
  });

  it("assertValidID throws with the supplied type label on invalid input", () => {
    expect(() => assertValidID("", "PlayerID")).toThrow(/Invalid PlayerID/);
    expect(() => assertValidID(123, "MobID")).toThrow(/Invalid MobID/);
  });

  it("assertValidID defaults the type label to 'ID' when omitted", () => {
    expect(() => assertValidID("")).toThrow(/Invalid ID/);
  });

  it("assertValidSlotNumber is a no-op on valid input", () => {
    expect(() => assertValidSlotNumber(0)).not.toThrow();
    expect(() => assertValidSlotNumber(42)).not.toThrow();
  });

  it("assertValidSlotNumber throws on invalid input", () => {
    expect(() => assertValidSlotNumber(-1)).toThrow(/Invalid slot number/);
    expect(() => assertValidSlotNumber(1.5)).toThrow(/Invalid slot number/);
    expect(() => assertValidSlotNumber("0")).toThrow(/Invalid slot number/);
  });
});
