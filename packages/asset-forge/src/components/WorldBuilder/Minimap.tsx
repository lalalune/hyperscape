import React, { useEffect, useRef, useCallback } from "react";

import { THREE } from "@/utils/webgpu-renderer";

// ============== MINIMAP COMPONENT ==============

export interface MinimapProps {
  worldSize: number; // World size in meters
  cameraPosition: THREE.Vector3;
  cameraRotationY: number;
  towns: Array<{
    id: string;
    name: string;
    position: { x: number; z: number };
    size: string;
  }>;
  roads: Array<{ path: Array<{ x: number; z: number }> }>;
  className?: string;
  onNavigate?: (x: number, z: number) => void;
  showWilderness?: boolean;
}

const MINIMAP_SIZE = 180; // pixels
export const WILDERNESS_START_PERCENT = 0.7; // Wilderness starts at 70% from south

export const Minimap: React.FC<MinimapProps> = ({
  worldSize,
  cameraPosition,
  cameraRotationY,
  towns,
  roads,
  className = "",
  onNavigate,
  showWilderness = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Convert world coords to minimap coords
  // World coordinates: X increases east, Z increases north
  // Minimap coordinates: X increases right, Y increases DOWN (canvas standard)
  // So we need to flip Z to Y: high Z (north) should be low Y (top of minimap)
  const worldToMinimap = useCallback(
    (worldX: number, worldZ: number) => {
      const normalizedX = worldX / worldSize;
      const normalizedZ = worldZ / worldSize;
      return {
        x: Math.max(0, Math.min(MINIMAP_SIZE, normalizedX * MINIMAP_SIZE)),
        y: Math.max(
          0,
          Math.min(MINIMAP_SIZE, (1 - normalizedZ) * MINIMAP_SIZE),
        ), // Flip Z to Y
      };
    },
    [worldSize],
  );

  // Convert minimap coords to world coords
  // Reverse the flip: low Y (top/north) should be high Z
  const minimapToWorld = useCallback(
    (minimapX: number, minimapY: number) => {
      const normalizedX = minimapX / MINIMAP_SIZE;
      const normalizedZ = 1 - minimapY / MINIMAP_SIZE; // Flip Y back to Z
      return {
        x: normalizedX * worldSize,
        z: normalizedZ * worldSize,
      };
    },
    [worldSize],
  );

  // Update minimap on each frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const drawMinimap = () => {
      // Clear with dark background
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      const centerX = MINIMAP_SIZE / 2;
      const centerY = MINIMAP_SIZE / 2;
      const radius = MINIMAP_SIZE / 2 - 4;

      // Water background
      ctx.fillStyle = "#1e3a5f";
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      // Create clipping path for island shape
      ctx.save();
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
        const variation =
          0.85 + Math.sin(angle * 8) * 0.1 + Math.cos(angle * 5) * 0.05;
        const r = radius * variation;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.clip();

      // Draw safe zone (southern green area)
      const wildernessY = MINIMAP_SIZE * (1 - WILDERNESS_START_PERCENT);
      ctx.fillStyle = "#2d4a1c";
      ctx.fillRect(0, wildernessY, MINIMAP_SIZE, MINIMAP_SIZE - wildernessY);

      // Draw wilderness zone (northern red-tinted area) if enabled
      if (showWilderness) {
        // Gradient from green to red as you go north
        const gradient = ctx.createLinearGradient(0, wildernessY, 0, 0);
        gradient.addColorStop(0, "#3d5a2c"); // Transition zone
        gradient.addColorStop(0.3, "#4a3c2c"); // Dark transition
        gradient.addColorStop(1, "#5a2a2a"); // Deep wilderness (red-brown)
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, MINIMAP_SIZE, wildernessY + 10);

        // Add wilderness danger line
        ctx.strokeStyle = "rgba(255, 50, 50, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, wildernessY);
        ctx.lineTo(MINIMAP_SIZE, wildernessY);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Just green if wilderness not shown
        ctx.fillStyle = "#2d4a1c";
        ctx.fillRect(0, 0, MINIMAP_SIZE, wildernessY);
      }

      // Restore clipping
      ctx.restore();

      // Redraw island outline
      ctx.strokeStyle = "rgba(100, 150, 100, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
        const variation =
          0.85 + Math.sin(angle * 8) * 0.1 + Math.cos(angle * 5) * 0.05;
        const r = radius * variation;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Draw grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const pos = (i / 4) * MINIMAP_SIZE;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, MINIMAP_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(MINIMAP_SIZE, pos);
        ctx.stroke();
      }

      // Draw roads
      ctx.strokeStyle = "#8b7355";
      ctx.lineWidth = 2;
      for (const road of roads) {
        if (road.path.length < 2) continue;
        ctx.beginPath();
        const start = worldToMinimap(road.path[0].x, road.path[0].z);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < road.path.length; i++) {
          const point = worldToMinimap(road.path[i].x, road.path[i].z);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
      }

      // Draw towns
      for (const town of towns) {
        const pos = worldToMinimap(town.position.x, town.position.z);

        // Town size determines marker size
        const markerSize =
          town.size === "town" ? 6 : town.size === "village" ? 4 : 3;
        const color =
          town.size === "town"
            ? "#ffd700"
            : town.size === "village"
              ? "#c0c0c0"
              : "#D4AF37";

        // Draw town marker (square)
        ctx.fillStyle = color;
        ctx.fillRect(
          pos.x - markerSize / 2,
          pos.y - markerSize / 2,
          markerSize,
          markerSize,
        );

        // Draw town border
        ctx.strokeStyle = "#F5F5F5";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          pos.x - markerSize / 2,
          pos.y - markerSize / 2,
          markerSize,
          markerSize,
        );
      }

      // Draw camera position and view cone
      const camPos = worldToMinimap(cameraPosition.x, cameraPosition.z);

      // View cone (field of view indicator)
      const coneLength = 20;
      const coneAngle = Math.PI / 4; // 45 degree FOV on each side
      const facing = -cameraRotationY - Math.PI / 2; // Adjust for coordinate system

      ctx.fillStyle = "rgba(255, 100, 100, 0.2)";
      ctx.beginPath();
      ctx.moveTo(camPos.x, camPos.y);
      ctx.lineTo(
        camPos.x + Math.cos(facing - coneAngle) * coneLength,
        camPos.y + Math.sin(facing - coneAngle) * coneLength,
      );
      ctx.lineTo(
        camPos.x + Math.cos(facing + coneAngle) * coneLength,
        camPos.y + Math.sin(facing + coneAngle) * coneLength,
      );
      ctx.closePath();
      ctx.fill();

      // Camera marker (triangle pointing in view direction)
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      const triSize = 6;
      ctx.moveTo(
        camPos.x + Math.cos(facing) * triSize,
        camPos.y + Math.sin(facing) * triSize,
      );
      ctx.lineTo(
        camPos.x + Math.cos(facing + 2.5) * triSize,
        camPos.y + Math.sin(facing + 2.5) * triSize,
      );
      ctx.lineTo(
        camPos.x + Math.cos(facing - 2.5) * triSize,
        camPos.y + Math.sin(facing - 2.5) * triSize,
      );
      ctx.closePath();
      ctx.fill();

      // White outline around camera
      ctx.strokeStyle = "#F5F5F5";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(camPos.x, camPos.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      // Compass directions
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", MINIMAP_SIZE / 2, 12);
      ctx.fillText("S", MINIMAP_SIZE / 2, MINIMAP_SIZE - 4);
      ctx.fillText("W", 8, MINIMAP_SIZE / 2 + 4);
      ctx.fillText("E", MINIMAP_SIZE - 8, MINIMAP_SIZE / 2 + 4);

      animationId = requestAnimationFrame(drawMinimap);
    };

    drawMinimap();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [
    worldSize,
    cameraPosition,
    cameraRotationY,
    towns,
    roads,
    worldToMinimap,
    showWilderness,
  ]);

  // Handle click to navigate
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !onNavigate) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert minimap coords to world coords
      const world = minimapToWorld(x, y);
      onNavigate(world.x, world.z);
    },
    [minimapToWorld, onNavigate],
  );

  return (
    <div className={`${className} pointer-events-auto`}>
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className="shadow-lg cursor-crosshair rounded border-2 border-border-secondary"
        onClick={handleClick}
        title="Click to teleport camera"
      />
      <div className="flex flex-col gap-0.5 text-xs text-text-muted mt-1 px-1">
        <div className="flex justify-between">
          <span>Click to teleport</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-500" /> Town
          </span>
        </div>
        {showWilderness && (
          <div className="flex items-center gap-1 text-red-400/80">
            <span className="w-2 h-2 bg-red-800/80" />
            <span>Wilderness (PVP)</span>
          </div>
        )}
      </div>
    </div>
  );
};
