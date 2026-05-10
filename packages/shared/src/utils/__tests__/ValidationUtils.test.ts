/**
 * `ValidationUtils` — shared type-guard + validator tests.
 *
 * The basic typeof-checks are trivial but their semantic
 * choices matter (e.g. `isNumber` rejects NaN and Infinity,
 * `isObject` rejects null). The substantive validators
 * (isValidColor / isValidUrl) carry bug-prone regex / URL
 * parsing logic worth locking in.
 *
 * isValidUrl had a latent bug — `new URL(value)` throws on
 * invalid input but the function was supposed to be a boolean
 * type guard. Fixed in the same commit; tests below pin
 * down the corrected behavior.
 */

import { describe, expect, it } from "vitest";
import {
  isArray,
  isBoolean,
  isNumber,
  isObject,
  isString,
  isValidColor,
  isValidUrl,
  validatePosition,
} from "../ValidationUtils";

describe("isNumber", () => {
  it("returns true for finite numbers", () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(1)).toBe(true);
    expect(isNumber(-1.5)).toBe(true);
    expect(isNumber(1e10)).toBe(true);
  });

  it("returns false for NaN — strict numeric check", () => {
    expect(isNumber(NaN)).toBe(false);
  });

  it("returns false for ±Infinity — strict finite check", () => {
    expect(isNumber(Infinity)).toBe(false);
    expect(isNumber(-Infinity)).toBe(false);
  });

  it("returns false for non-number values", () => {
    expect(isNumber("1")).toBe(false);
    expect(isNumber(null)).toBe(false);
    expect(isNumber(undefined)).toBe(false);
    expect(isNumber(true)).toBe(false);
  });
});

describe("isBoolean / isString", () => {
  it("isBoolean only accepts true/false", () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(1)).toBe(false);
    expect(isBoolean("true")).toBe(false);
    expect(isBoolean(null)).toBe(false);
  });

  it("isString accepts only string values (incl. empty)", () => {
    expect(isString("")).toBe(true);
    expect(isString("hello")).toBe(true);
    expect(isString(0)).toBe(false);
    expect(isString(null)).toBe(false);
  });
});

describe("isObject", () => {
  it("returns true for plain objects + arrays + class instances", () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(new Map())).toBe(true);
  });

  it("returns false for null (the typeof-object trap)", () => {
    expect(isObject(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isObject(0)).toBe(false);
    expect(isObject("string")).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });
});

describe("isArray", () => {
  it("returns true for arrays", () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
  });

  it("returns false for non-arrays even when iterable", () => {
    expect(isArray({})).toBe(false);
    expect(isArray("string")).toBe(false);
    expect(isArray(new Set([1]))).toBe(false);
    expect(isArray(null)).toBe(false);
  });
});

describe("isValidColor", () => {
  it("accepts hex colors", () => {
    expect(isValidColor("#ff0000")).toBe(true);
    expect(isValidColor("#fff")).toBe(true);
  });

  it("accepts rgb / rgba colors", () => {
    expect(isValidColor("rgb(255, 0, 0)")).toBe(true);
    expect(isValidColor("rgba(255, 0, 0, 0.5)")).toBe(true);
  });

  it("accepts hsl / hsla colors", () => {
    expect(isValidColor("hsl(120, 50%, 50%)")).toBe(true);
    expect(isValidColor("hsla(120, 50%, 50%, 0.8)")).toBe(true);
  });

  it("accepts named colors (alpha-only string)", () => {
    expect(isValidColor("red")).toBe(true);
    expect(isValidColor("blue")).toBe(true);
    expect(isValidColor("rebeccapurple")).toBe(true);
  });

  it("rejects strings with non-letters that don't match a known prefix", () => {
    expect(isValidColor("123")).toBe(false);
    expect(isValidColor("not-a-color")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isValidColor(0xff0000)).toBe(false);
    expect(isValidColor(null)).toBe(false);
    expect(isValidColor(undefined)).toBe(false);
  });
});

describe("isValidUrl — type guard, never throws", () => {
  it("accepts well-formed http and https URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
    expect(isValidUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("accepts other valid URL schemes", () => {
    expect(isValidUrl("file:///tmp/x.txt")).toBe(true);
    expect(isValidUrl("ws://localhost:5555/socket")).toBe(true);
  });

  it("returns false for malformed strings (does NOT throw)", () => {
    // Pre-fix this would throw — the test pins down the fix.
    expect(() => isValidUrl("not a url")).not.toThrow();
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("//missing-scheme")).toBe(false);
  });

  it("returns false for non-string inputs", () => {
    expect(isValidUrl(null)).toBe(false);
    expect(isValidUrl(undefined)).toBe(false);
    expect(isValidUrl(123)).toBe(false);
    expect(isValidUrl({})).toBe(false);
  });
});

describe("validatePosition", () => {
  it("accepts a fully-formed Vec3", () => {
    expect(validatePosition({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(validatePosition({ x: 1.5, y: -2, z: 100 })).toBe(true);
  });

  it("rejects when any axis is missing", () => {
    expect(validatePosition({ x: 0, y: 0 })).toBe(false);
    expect(validatePosition({ x: 0, z: 0 })).toBe(false);
    expect(validatePosition({ y: 0, z: 0 })).toBe(false);
  });

  it("rejects when any axis is NaN or Infinity (uses isNumber)", () => {
    expect(validatePosition({ x: NaN, y: 0, z: 0 })).toBe(false);
    expect(validatePosition({ x: 0, y: Infinity, z: 0 })).toBe(false);
  });

  it("rejects null + undefined + non-objects", () => {
    expect(validatePosition(null)).toBe(false);
    expect(validatePosition(undefined)).toBe(false);
    expect(validatePosition("0,0,0")).toBe(false);
    expect(validatePosition(42)).toBe(false);
  });

  it("rejects when an axis is a string number", () => {
    // isNumber requires actual number type, not coercible string.
    expect(validatePosition({ x: "1", y: 0, z: 0 })).toBe(false);
  });
});
