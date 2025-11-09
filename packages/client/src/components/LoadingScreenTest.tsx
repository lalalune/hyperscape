/**
 * LoadingScreenTest.tsx - Test component to view the loading screen
 *
 * Access this at: http://localhost:3000/loading-test
 */

import React from "react";
import { LoadingScreen } from "./LoadingScreen";

// Mock World object with minimal required properties
const mockWorld = {
  settings: {
    title: "Hyperscape",
    desc: "A 3D multiplayer RPG adventure",
    image: null,
  },
  resolveURL: (url: string) => url,
  on: () => {},
  off: () => {},
} as any;

export function LoadingScreenTest() {
  const [progress, setProgress] = React.useState(0);
  const [message, setMessage] = React.useState("Initializing...");

  // Simulate loading progress
  React.useEffect(() => {
    const messages = [
      "Initializing...",
      "Loading systems...",
      "Loading assets...",
      "Preparing world...",
      "Almost ready...",
      "Finalizing...",
    ];

    let currentProgress = 0;
    let messageIndex = 0;

    const interval = setInterval(() => {
      currentProgress += Math.random() * 10;

      if (currentProgress >= 100) {
        currentProgress = 100;
        setMessage("Complete!");
        clearInterval(interval);
      } else {
        messageIndex = Math.floor((currentProgress / 100) * messages.length);
        setMessage(messages[Math.min(messageIndex, messages.length - 1)]);
      }

      setProgress(currentProgress);

      // Trigger mock progress event
      const event = new CustomEvent("assets-loading-progress", {
        detail: {
          progress: currentProgress,
          stage: messages[Math.min(messageIndex, messages.length - 1)],
        },
      });
      window.dispatchEvent(event);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <LoadingScreen world={mockWorld} message={message} />

      {/* Test Controls */}
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "10px",
          background: "rgba(0, 0, 0, 0.8)",
          color: "white",
          padding: "15px",
          borderRadius: "8px",
          zIndex: 9999,
          fontFamily: "monospace",
        }}
      >
        <div
          style={{ marginBottom: "10px", fontSize: "14px", fontWeight: "bold" }}
        >
          Loading Screen Test
        </div>
        <div style={{ fontSize: "12px" }}>
          Progress: {Math.floor(progress)}%
        </div>
        <div style={{ fontSize: "12px", marginTop: "5px" }}>
          Message: {message}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "10px",
            padding: "5px 10px",
            background: "#4a90e2",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Restart
        </button>
      </div>
    </div>
  );
}
