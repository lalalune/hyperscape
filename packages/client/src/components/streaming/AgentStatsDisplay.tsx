/**
 * AgentStatsDisplay - Shows agent HP bar and stats during fight
 *
 * Fighting-game style display with skewed clip-path HP bar, equipment cells
 * with manifest-loaded item icons, and inventory grid.
 */

import React, { useEffect, useState } from "react";
import type { AgentInfo } from "../../screens/StreamingMode";
import { GAME_API_URL } from "../../lib/api-config";

interface AgentStatsDisplayProps {
  agent: AgentInfo;
  side: "left" | "right";
}

// ---------------------------------------------------------------------------
// Item icon manifest loading (cached singleton)
// ---------------------------------------------------------------------------

interface ManifestItemRecord {
  id: string;
  iconPath?: string | null;
}

const ITEM_MANIFEST_FILES = [
  "weapons.json",
  "ammunition.json",
  "resources.json",
  "tools.json",
  "misc.json",
  "armor.json",
  "runes.json",
  "food.json",
] as const;

const INVENTORY_FALLBACK_ICONS = [
  "🗡️",
  "🪓",
  "🛡️",
  "🏹",
  "🧪",
  "💎",
  "🪙",
  "📜",
  "🪄",
  "🧿",
] as const;

let cachedItemIconMap: Record<string, string> | null = null;
let itemIconMapPromise: Promise<Record<string, string>> | null = null;

function resolveManifestIconPath(iconPath: string): string {
  const base = GAME_API_URL.replace(/\/$/, "");
  if (iconPath.startsWith("asset://")) {
    const relativePath = iconPath.replace("asset://", "");
    return `${base}/game-assets/${relativePath}`;
  }
  if (iconPath.startsWith("/")) return `${base}${iconPath}`;
  return `${base}/${iconPath}`;
}

async function loadItemIconMap(): Promise<Record<string, string>> {
  if (cachedItemIconMap) return cachedItemIconMap;
  if (itemIconMapPromise) return itemIconMapPromise;

  itemIconMapPromise = (async () => {
    let responses: ManifestItemRecord[][] = [];
    try {
      responses = await Promise.all(
        ITEM_MANIFEST_FILES.map(async (fileName) => {
          const response = await fetch(
            `${GAME_API_URL}/game-assets/manifests/items/${fileName}`,
            { cache: "force-cache" },
          );
          if (!response.ok) return [] as ManifestItemRecord[];
          return (await response.json()) as ManifestItemRecord[];
        }),
      );
    } catch {
      responses = [];
    }

    const items = responses.flat();
    const iconMap: Record<string, string> = {};
    for (const item of items) {
      if (!item.id || !item.iconPath) continue;
      iconMap[item.id] = resolveManifestIconPath(item.iconPath);
    }

    cachedItemIconMap = iconMap;
    return iconMap;
  })();

  return itemIconMapPromise;
}

function getDeterministicFallbackIcon(itemKey: string, slot: number): string {
  const source = `${itemKey}:${slot}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return INVENTORY_FALLBACK_ICONS[hash % INVENTORY_FALLBACK_ICONS.length]!;
}

// ---------------------------------------------------------------------------
// Equipment slot ordering
// ---------------------------------------------------------------------------

const EQUIPMENT_SLOT_ORDER = [
  "weapon",
  "shield",
  "helm",
  "helmet",
  "body",
  "legs",
  "boots",
  "gloves",
  "cape",
  "amulet",
  "ring",
] as const;

const EQUIPPED_SLOTS_VISIBLE = 6;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentStatsDisplay({ agent, side }: AgentStatsDisplayProps) {
  const hpPercent = Math.max(0, Math.min(100, (agent.hp / agent.maxHp) * 100));
  const isCritical = hpPercent < 20;
  const hpColor = isCritical ? "#ff0d3c" : "#00ffcc";
  const isRight = side === "right";

  const [itemIconMap, setItemIconMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    void loadItemIconMap().then((iconMap) => {
      if (!isMounted) return;
      setItemIconMap(iconMap);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Direction-dependent clip paths for the skewed HP bar
  const hpOuterClipPath = isRight
    ? "polygon(2% 0, 100% 0, 98% 100%, 0 100%)"
    : "polygon(0 0, 98% 0, 100% 100%, 2% 100%)";
  const hpFillClipPath = isRight
    ? "polygon(10px 0, 100% 0, 100% 100%, 0 100%)"
    : "polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)";
  const skewDir = isRight ? "skew(15deg)" : "skew(-15deg)";

  // Build inventory lookup from positional array
  const inventoryBySlot = new Map(
    (agent.inventory ?? [])
      .map((item, index) =>
        item
          ? ({ slot: index, ...item } as {
              slot: number;
              itemId: string;
              quantity: number;
            })
          : null,
      )
      .filter(
        (item): item is { slot: number; itemId: string; quantity: number } =>
          item !== null,
      )
      .map((item) => [item.slot, item] as const),
  );

  // Build deduplicated equipped item list
  const equippedItemIds: string[] = [];
  const seenEquipped = new Set<string>();
  for (const slot of EQUIPMENT_SLOT_ORDER) {
    const itemId = agent.equipment?.[slot];
    if (!itemId || seenEquipped.has(itemId)) continue;
    equippedItemIds.push(itemId);
    seenEquipped.add(itemId);
  }
  if (agent.equipment) {
    for (const itemId of Object.values(agent.equipment)) {
      if (!itemId || seenEquipped.has(itemId)) continue;
      equippedItemIds.push(itemId);
      seenEquipped.add(itemId);
    }
  }
  const equippedCells = [
    ...equippedItemIds.slice(0, EQUIPPED_SLOTS_VISIBLE),
    ...Array.from({
      length: Math.max(0, EQUIPPED_SLOTS_VISIBLE - equippedItemIds.length),
    }).map(() => null as string | null),
  ];

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        width: "clamp(280px, 38vw, 480px)",
        alignItems: isRight ? "flex-end" : "flex-start",
      }}
    >
      {/* Name + stats row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          width: "100%",
          padding: "0 6px",
          fontFamily: "'Teko', 'Arial Black', sans-serif",
          textTransform: "uppercase" as const,
          flexDirection: isRight ? "row-reverse" : "row",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexDirection: isRight ? "row-reverse" : "row",
          }}
        >
          <span
            style={{
              background: "#ff0d3c",
              color: "#fff",
              padding: "2px 8px",
              fontSize: "0.85rem",
              fontWeight: 900,
              transform: skewDir,
              border: "1px solid #fff",
              display: "inline-block",
            }}
          >
            #{agent.rank > 0 ? agent.rank : "-"}
          </span>
          <span
            style={{
              color: "#fff",
              fontSize: "clamp(1rem, 2vw, 1.4rem)",
              fontWeight: 900,
              letterSpacing: 1,
              textShadow: "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000",
            }}
          >
            {agent.name}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexDirection: isRight ? "row-reverse" : "row",
            background: "rgba(0,0,0,0.7)",
            padding: "2px 10px",
            transform: skewDir,
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexDirection: "row",
            }}
          >
            <span
              style={{ color: "#aaa", fontSize: "0.65rem", fontWeight: 800 }}
            >
              OVR
            </span>
            <span
              style={{ color: "#f2d08a", fontSize: "0.9rem", fontWeight: 900 }}
            >
              {agent.wins}-{agent.losses}
            </span>
          </div>
          <span style={{ color: "#555", fontSize: "0.8rem", margin: "0 4px" }}>
            /
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexDirection: "row",
            }}
          >
            <span
              style={{ color: "#aaa", fontSize: "0.65rem", fontWeight: 800 }}
            >
              H2H
            </span>
            <span
              style={{ color: "#f2d08a", fontSize: "0.9rem", fontWeight: 900 }}
            >
              {agent.headToHeadWins || 0}-{agent.headToHeadLosses || 0}
            </span>
          </div>
        </div>
      </div>

      {/* HP bar - skewed fighting-game style frame + inset fill */}
      <div
        style={{
          width: "100%",
          height: 28,
          position: "relative",
          clipPath: hpOuterClipPath,
          background: "#fff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 2,
            clipPath: hpOuterClipPath,
            background: "rgba(0,0,0,0.8)",
            overflow: "hidden",
            zIndex: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              ...(isRight ? { right: 0 } : { left: 0 }),
              width: `${hpPercent}%`,
              background: hpColor,
              clipPath: hpFillClipPath,
              transition: "width 0.15s ease-out, background 0.2s",
              boxShadow: isCritical
                ? "inset 0 0 8px rgba(255,13,60,0.45)"
                : "inset 0 0 8px rgba(0,255,204,0.35)",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            ...(isRight ? { right: 32 } : { left: 32 }),
            color: "#fff",
            fontSize: "1.2rem",
            fontWeight: 900,
            fontFamily: "monospace",
            textShadow:
              "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {agent.hp}
        </div>
      </div>

      {/* Bottom: DMG + equipment + inventory */}
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginTop: 4,
          padding: "0 6px",
          gap: 2,
          flexDirection: isRight ? "row-reverse" : "row",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.8)",
            border: "2px solid #ff0d3c",
            padding: "5px 15px",
            transform: skewDir,
            minWidth: 82,
            boxShadow: "0 0 10px rgba(255,13,60,0.3)",
          }}
        >
          <div
            style={{
              color: "#ff0d3c",
              fontSize: "1.55rem",
              fontWeight: 900,
              lineHeight: 1,
              textShadow: "0 0 8px rgba(255,13,60,0.6)",
            }}
          >
            {agent.damageDealtThisFight}
          </div>
          <div
            style={{
              color: "#fff",
              fontSize: "0.65rem",
              fontWeight: 800,
              letterSpacing: 2,
              marginTop: 2,
            }}
          >
            DMG
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flex: 1,
            minWidth: 0,
            gap: 6,
            background: "rgba(0,0,0,0.6)",
            padding: "3px 6px",
            minHeight: 56,
            border: "1px solid rgba(255,255,255,0.2)",
            transform: skewDir,
            flexDirection: isRight ? "row-reverse" : "row",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(17, minmax(0, 1fr))",
              gridTemplateRows: "repeat(2, minmax(0, 1fr))",
              gap: 2,
              flex: 1,
              minWidth: 0,
              width: "100%",
            }}
          >
            {renderEquipmentAndInventoryGrid(
              equippedCells,
              inventoryBySlot,
              itemIconMap,
              isRight,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipment + Inventory grid renderer (17 cols x 2 rows)
// ---------------------------------------------------------------------------

function renderEquipmentAndInventoryGrid(
  equippedCells: (string | null)[],
  inventoryBySlot: Map<
    number,
    { slot: number; itemId: string; quantity: number }
  >,
  itemIconMap: Record<string, string>,
  isRight: boolean,
): React.ReactNode[] {
  const equippedSection = equippedCells.map((itemId, idx) => {
    const normalizedItemId =
      itemId && itemId.endsWith("_noted")
        ? itemId.replace(/_noted$/, "")
        : itemId;
    const iconUrl = normalizedItemId
      ? (itemIconMap[itemId ?? ""] ?? itemIconMap[normalizedItemId] ?? null)
      : null;

    return (
      <div
        key={`equipped-${idx}-${itemId ?? "empty"}`}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          background: "rgba(255,255,255,0.05)",
          border: itemId
            ? "1px solid rgba(100,200,255,0.6)"
            : "1px solid rgba(100,200,255,0.2)",
          borderRadius: 2,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
        }}
      >
        {itemId && iconUrl ? (
          <img
            src={iconUrl}
            alt={normalizedItemId ?? itemId}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            style={{
              width: "110%",
              height: "110%",
              objectFit: "cover",
              display: "block",
            }}
            draggable={false}
          />
        ) : itemId ? (
          <span
            style={{
              fontSize: 10,
              lineHeight: 1,
              filter: "drop-shadow(0 0 2px rgba(0,0,0,0.6))",
            }}
          >
            {getDeterministicFallbackIcon(normalizedItemId || itemId, idx)}
          </span>
        ) : null}
      </div>
    );
  });

  const inventorySection = Array.from({ length: 28 }).map((_, i) => {
    const slotItem = inventoryBySlot.get(i);
    const hasItem = Boolean(slotItem);
    const itemId = slotItem?.itemId ?? "";
    const normalizedItemId = itemId.endsWith("_noted")
      ? itemId.replace(/_noted$/, "")
      : itemId;
    const iconUrl =
      itemIconMap[itemId] ?? itemIconMap[normalizedItemId] ?? null;

    return (
      <div
        key={`inv-${i}`}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          background: "rgba(255,255,255,0.05)",
          border: hasItem
            ? "1px solid rgba(242,208,138,0.5)"
            : "1px solid rgba(255,255,255,0.08)",
          transition: "all 0.2s",
          overflow: "hidden",
          borderRadius: 2,
        }}
      >
        {hasItem && iconUrl ? (
          <img
            src={iconUrl}
            alt={normalizedItemId}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            style={{
              width: "110%",
              height: "110%",
              objectFit: "cover",
              display: "block",
            }}
            draggable={false}
          />
        ) : hasItem ? (
          <span
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              lineHeight: 1,
              filter: "drop-shadow(0 0 2px rgba(0,0,0,0.55))",
            }}
          >
            {getDeterministicFallbackIcon(normalizedItemId || "item", i)}
          </span>
        ) : null}
      </div>
    );
  });

  // Interleave: 3 equipment + 14 inventory per row, direction-aware
  const rows: React.ReactNode[] = [];
  for (let row = 0; row < 2; row++) {
    const eqRow = equippedSection.slice(row * 3, row * 3 + 3);
    const invRow = inventorySection.slice(row * 14, row * 14 + 14);
    if (isRight) {
      rows.push(...invRow, ...eqRow);
    } else {
      rows.push(...eqRow, ...invRow);
    }
  }
  return rows;
}
