/**
 * Secure Storage Tests
 *
 * Tests for the secure storage utility functions.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setAuthToken,
  getAuthToken,
  removeAuthToken,
  setSessionData,
  getSessionData,
  removeSessionData,
  isTokenValid,
  getTokenExpirationMs,
  clearAllAuthData,
} from "@/lib/secureStorage";

describe("secureStorage", () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("setAuthToken / getAuthToken", () => {
    it("should store and retrieve a token", () => {
      setAuthToken("test_token", "my-secret-token");
      const retrieved = getAuthToken("test_token");
      expect(retrieved).toBe("my-secret-token");
    });

    it("should return null for non-existent token", () => {
      const retrieved = getAuthToken("non_existent");
      expect(retrieved).toBeNull();
    });

    it("should return null for expired token", () => {
      // Set token with 1 second expiration
      setAuthToken("test_token", "my-secret-token", 1000);

      // Advance time past expiration
      vi.advanceTimersByTime(2000);

      const retrieved = getAuthToken("test_token");
      expect(retrieved).toBeNull();
    });

    it("should return token before expiration", () => {
      // Set token with 10 second expiration
      setAuthToken("test_token", "my-secret-token", 10000);

      // Advance time but not past expiration
      vi.advanceTimersByTime(5000);

      const retrieved = getAuthToken("test_token");
      expect(retrieved).toBe("my-secret-token");
    });
  });

  describe("removeAuthToken", () => {
    it("should remove a token", () => {
      setAuthToken("test_token", "my-secret-token");
      expect(getAuthToken("test_token")).toBe("my-secret-token");

      removeAuthToken("test_token");
      expect(getAuthToken("test_token")).toBeNull();
    });
  });

  describe("setSessionData / getSessionData", () => {
    it("should store and retrieve session data", () => {
      setSessionData("session_key", "session-value");
      const retrieved = getSessionData("session_key");
      expect(retrieved).toBe("session-value");
    });

    it("should return null for non-existent session data", () => {
      const retrieved = getSessionData("non_existent");
      expect(retrieved).toBeNull();
    });

    it("should return null for expired session data", () => {
      setSessionData("session_key", "session-value");

      // Session expiration is 8 hours, advance past that
      vi.advanceTimersByTime(9 * 60 * 60 * 1000);

      const retrieved = getSessionData("session_key");
      expect(retrieved).toBeNull();
    });
  });

  describe("removeSessionData", () => {
    it("should remove session data", () => {
      setSessionData("session_key", "session-value");
      expect(getSessionData("session_key")).toBe("session-value");

      removeSessionData("session_key");
      expect(getSessionData("session_key")).toBeNull();
    });
  });

  describe("isTokenValid", () => {
    it("should return true for valid token", () => {
      setAuthToken("test_token", "my-secret-token");
      expect(isTokenValid("test_token")).toBe(true);
    });

    it("should return false for non-existent token", () => {
      expect(isTokenValid("non_existent")).toBe(false);
    });

    it("should return false for expired token", () => {
      setAuthToken("test_token", "my-secret-token", 1000);
      vi.advanceTimersByTime(2000);
      expect(isTokenValid("test_token")).toBe(false);
    });
  });

  describe("getTokenExpirationMs", () => {
    it("should return remaining time for valid token", () => {
      setAuthToken("test_token", "my-secret-token", 10000);

      // Advance 3 seconds
      vi.advanceTimersByTime(3000);

      const remaining = getTokenExpirationMs("test_token");
      expect(remaining).toBe(7000);
    });

    it("should return -1 for non-existent token", () => {
      const remaining = getTokenExpirationMs("non_existent");
      expect(remaining).toBe(-1);
    });

    it("should return -1 for expired token", () => {
      setAuthToken("test_token", "my-secret-token", 1000);
      vi.advanceTimersByTime(2000);

      const remaining = getTokenExpirationMs("test_token");
      expect(remaining).toBe(-1);
    });
  });

  describe("clearAllAuthData", () => {
    it("should clear all auth tokens and session data", () => {
      // Set up some data
      localStorage.setItem("privy_auth_token", "token1");
      localStorage.setItem("privy_user_id", "user1");
      localStorage.setItem("hyperia_player_token", "token2");
      sessionStorage.setItem("session_data", "data1");

      clearAllAuthData();

      // All should be cleared
      expect(localStorage.getItem("privy_auth_token")).toBeNull();
      expect(localStorage.getItem("privy_user_id")).toBeNull();
      expect(localStorage.getItem("hyperia_player_token")).toBeNull();
      expect(sessionStorage.getItem("session_data")).toBeNull();
    });
  });
});
