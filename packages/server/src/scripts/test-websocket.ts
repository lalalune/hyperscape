// @ts-nocheck - Test script with optional dependencies
import WebSocket from "ws";
import { pack, unpack } from "msgpackr";

const WS_URL = "ws://localhost:5555/ws";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const socket = new WebSocket(WS_URL);

socket.on("open", () => {
  console.log("Connected to WebSocket");

  // Send character create packet
  // Packet format: [method, data]
  const packet = pack([
    "characterCreate",
    {
      name: "TestChar_" + Math.floor(Math.random() * 1000),
      avatar: "http://localhost:8080/avatar.vrm",
      wallet: "0x1234567890123456789012345678901234567890",
    },
  ]);

  socket.send(packet);
  console.log("Sent characterCreate packet");
});

socket.on("message", (data) => {
  try {
    const decoded = unpack(data as Buffer);
    console.log("Received:", decoded);

    if (Array.isArray(decoded)) {
      const [method, payload] = decoded;
      if (method === "onCharacterCreated") {
        console.log("✅ Character created successfully:", payload);
        socket.close();
        process.exit(0);
      }
    }
  } catch (e) {
    console.log("Received (raw):", data.toString());
  }
});

socket.on("error", (err) => {
  console.error("WebSocket error:", err);
  process.exit(1);
});

socket.on("close", () => {
  console.log("Disconnected");
});

// Timeout
setTimeout(() => {
  console.error("Timeout waiting for response");
  process.exit(1);
}, 5000);
