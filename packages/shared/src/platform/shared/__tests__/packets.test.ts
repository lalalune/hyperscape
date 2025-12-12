/**
 * Packet Serialization Tests
 *
 * Tests the binary packet protocol used for client-server communication.
 * Verifies:
 * - Packet encoding/decoding roundtrips
 * - Packet ID mapping
 * - Binary format correctness
 * - Edge cases (empty data, large payloads, special characters)
 *
 * NO MOCKS - Tests actual msgpackr serialization
 */

import { describe, it, expect } from "bun:test";
import { writePacket, readPacket } from "../packets";

describe("Packet Serialization", () => {
  describe("writePacket", () => {
    it("should create ArrayBuffer for valid packet names", () => {
      const packet = writePacket("snapshot", { test: true });

      expect(packet).toBeInstanceOf(ArrayBuffer);
      expect(packet.byteLength).toBeGreaterThan(0);
    });

    it("should throw for unknown packet names", () => {
      expect(() => writePacket("unknownPacket", {})).toThrow(
        "writePacket failed",
      );
    });

    it("should handle empty data", () => {
      const packet = writePacket("ping", undefined);

      expect(packet).toBeInstanceOf(ArrayBuffer);
    });

    it("should handle null data", () => {
      const packet = writePacket("ping", null);

      expect(packet).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe("readPacket", () => {
    it("should decode packet created by writePacket", () => {
      const originalData = { foo: "bar", count: 42 };
      const encoded = writePacket("snapshot", originalData);
      const [method, decoded] = readPacket(encoded);

      expect(method).toBe("onSnapshot");
      expect(decoded).toEqual(originalData);
    });

    it("should handle Uint8Array input", () => {
      const originalData = { test: true };
      const encoded = writePacket("entityAdded", originalData);
      const uint8 = new Uint8Array(encoded);
      const [method, decoded] = readPacket(uint8);

      expect(method).toBe("onEntityAdded");
      expect(decoded).toEqual(originalData);
    });

    it("should throw for invalid packet ID", () => {
      // Create a packet with invalid ID (255)
      const invalidPacket = new Uint8Array([0x92, 0xff, 0x00]); // msgpack array with id=255

      expect(() => readPacket(invalidPacket.buffer)).toThrow(
        "readPacket failed",
      );
    });
  });

  describe("roundtrip encoding", () => {
    const testCases: Array<{
      name: string;
      packetName: string;
      data: unknown;
    }> = [
      { name: "string data", packetName: "chatAdded", data: "hello world" },
      {
        name: "number data",
        packetName: "ping",
        data: Date.now(),
      },
      {
        name: "nested object",
        packetName: "snapshot",
        data: {
          id: "test-123",
          entities: [
            { id: "e1", type: "player" },
            { id: "e2", type: "mob" },
          ],
          settings: { volume: 0.5 },
        },
      },
      {
        name: "array data",
        packetName: "entityModified",
        data: {
          id: "entity-1",
          changes: {
            p: [100.5, 25.3, -50.7],
            q: [0, 0.707, 0, 0.707],
            v: [1.5, 0, 2.3],
          },
        },
      },
      {
        name: "boolean data",
        packetName: "entityEvent",
        data: { visible: true, active: false },
      },
      {
        name: "null values",
        packetName: "entityModified",
        data: { id: "test", changes: { target: null } },
      },
      {
        name: "empty object",
        packetName: "chatCleared",
        data: {},
      },
      {
        name: "unicode strings",
        packetName: "chatAdded",
        data: { from: "プレイヤー", body: "你好世界 🎮" },
      },
    ];

    for (const { name, packetName, data } of testCases) {
      it(`should roundtrip ${name}`, () => {
        const encoded = writePacket(packetName, data);
        const [, decoded] = readPacket(encoded);

        expect(decoded).toEqual(data);
      });
    }
  });

  describe("packet size efficiency", () => {
    it("should produce compact binary for position updates", () => {
      const positionUpdate = {
        id: "player-123",
        changes: {
          p: [100.123, 25.456, -50.789],
          q: [0, 0.707, 0, 0.707],
        },
      };

      const packet = writePacket("entityModified", positionUpdate);

      // Binary should be reasonably sized (msgpack is compact but overhead exists)
      // JSON is ~82 bytes, msgpack with packet ID is ~85 bytes
      // The main benefit is structured binary format, not raw size for small packets
      const jsonSize = JSON.stringify(positionUpdate).length;
      expect(packet.byteLength).toBeLessThan(jsonSize * 1.5); // Allow some overhead
    });

    it("should handle large entity lists efficiently", () => {
      const entities = Array.from({ length: 100 }, (_, i) => ({
        id: `entity-${i}`,
        type: i % 2 === 0 ? "player" : "mob",
        position: [
          Math.random() * 1000,
          Math.random() * 100,
          Math.random() * 1000,
        ],
      }));

      const packet = writePacket("snapshot", { entities });

      // Should complete without error and be reasonably sized
      expect(packet.byteLength).toBeGreaterThan(0);
      expect(packet.byteLength).toBeLessThan(50000); // Reasonable upper bound
    });
  });

  describe("all packet types", () => {
    // Core packets
    const corePackets = ["snapshot", "command", "ping", "pong", "kick"];

    // Entity packets
    const entityPackets = [
      "entityAdded",
      "entityModified",
      "entityRemoved",
      "entityEvent",
    ];

    // Chat packets
    const chatPackets = ["chatAdded", "chatCleared"];

    // Movement packets
    const movementPackets = [
      "moveRequest",
      "input",
      "inputAck",
      "correction",
      "playerTeleport",
      "playerPush",
      "entityTileUpdate",
      "tileMovementStart",
      "tileMovementEnd",
    ];

    // Combat packets
    const combatPackets = [
      "attackMob",
      "changeAttackStyle",
      "combatDamageDealt",
      "attackStyleChanged",
      "attackStyleUpdate",
    ];

    // Inventory packets
    const inventoryPackets = [
      "pickupItem",
      "dropItem",
      "equipItem",
      "unequipItem",
      "inventoryUpdated",
      "coinsUpdated",
      "equipmentUpdated",
    ];

    // Resource packets
    const resourcePackets = [
      "resourceSnapshot",
      "resourceSpawnPoints",
      "resourceSpawned",
      "resourceDepleted",
      "resourceRespawned",
      "resourceGather",
      "gatheringComplete",
    ];

    // Trading packets
    const tradingPackets = [
      "tradeRequest",
      "tradeResponse",
      "tradeOffer",
      "tradeConfirm",
      "tradeCancel",
      "tradeStarted",
      "tradeUpdated",
      "tradeCompleted",
      "tradeCancelled",
      "tradeError",
    ];

    // Character packets
    const characterPackets = [
      "characterListRequest",
      "characterCreate",
      "characterList",
      "characterCreated",
      "characterSelected",
      "enterWorld",
    ];

    // Death packets
    const deathPackets = [
      "deathScreen",
      "deathScreenClose",
      "requestRespawn",
      "playerSetDead",
      "playerRespawned",
    ];

    // Bank/Store packets
    const economyPackets = [
      "bankOpen",
      "bankState",
      "bankDeposit",
      "bankDepositAll",
      "bankWithdraw",
      "bankClose",
      "storeOpen",
      "storeState",
      "storeBuy",
      "storeSell",
      "storeClose",
    ];

    // Dialogue packets
    const dialoguePackets = [
      "npcInteract",
      "dialogueStart",
      "dialogueNodeChange",
      "dialogueResponse",
      "dialogueEnd",
      "dialogueClose",
    ];

    const allPackets = [
      ...corePackets,
      ...entityPackets,
      ...chatPackets,
      ...movementPackets,
      ...combatPackets,
      ...inventoryPackets,
      ...resourcePackets,
      ...tradingPackets,
      ...characterPackets,
      ...deathPackets,
      ...economyPackets,
      ...dialoguePackets,
    ];

    for (const packetName of allPackets) {
      it(`should encode/decode '${packetName}' packet`, () => {
        const testData = { test: true, packetType: packetName };

        const encoded = writePacket(packetName, testData);
        expect(encoded).toBeInstanceOf(ArrayBuffer);

        const [method, decoded] = readPacket(encoded);
        expect(method).toBe(
          `on${packetName.charAt(0).toUpperCase()}${packetName.slice(1)}`,
        );
        expect(decoded).toEqual(testData);
      });
    }
  });

  describe("binary format validation", () => {
    it("should use msgpack array format [id, data]", () => {
      const packet = writePacket("ping", 12345);
      const bytes = new Uint8Array(packet);

      // First byte should be msgpack fixarray (0x92 = 2-element array)
      // or array16/array32 for larger arrays
      const firstByte = bytes[0];
      expect(
        firstByte === 0x92 || // fixarray(2)
          firstByte === 0xdc || // array16
          firstByte === 0xdd, // array32
      ).toBe(true);
    });

    it("should use small integer for packet IDs", () => {
      // First few packets should have IDs 0-127 (positive fixint)
      const packet = writePacket("snapshot", null); // ID 0
      const bytes = new Uint8Array(packet);

      // Second byte should be the packet ID (0 for snapshot)
      // In msgpack, 0x00-0x7f are positive fixints
      expect(bytes[1]).toBeLessThanOrEqual(0x7f);
    });
  });
});
