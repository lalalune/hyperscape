/**
 * useRemovedItemTracking Hook
 *
 * Tracks removed items from trade offers for anti-scam feature.
 * Shows red flashing exclamation when items are removed.
 */

import { useState, useEffect, useRef } from "react";
import type { TradeOfferItem } from "@hyperforge/shared";
import {
  REMOVED_ITEM_DISPLAY_MS,
  REMOVED_ITEM_CHECK_INTERVAL_MS,
} from "../constants";
import type { RemovedItemIndicator, RemovedItemTrackingResult } from "../types";

export function useRemovedItemTracking(
  myOffer: TradeOfferItem[],
  theirOffer: TradeOfferItem[],
): RemovedItemTrackingResult {
  // Track removed items for red flashing exclamation (anti-scam feature)
  const [removedItems, setRemovedItems] = useState<RemovedItemIndicator[]>([]);

  // Track previous offers to detect removals
  const prevMyOfferRef = useRef<TradeOfferItem[]>([]);
  const prevTheirOfferRef = useRef<TradeOfferItem[]>([]);

  // Detect removed items and show red exclamation
  useEffect(() => {
    const prevMyOffer = prevMyOfferRef.current;
    const prevTheirOffer = prevTheirOfferRef.current;

    // Check for removed items in my offer
    for (const prevItem of prevMyOffer) {
      const stillExists = myOffer.some(
        (item) => item.tradeSlot === prevItem.tradeSlot,
      );
      if (!stillExists) {
        setRemovedItems((prev) => [
          ...prev,
          { slot: prevItem.tradeSlot, side: "my", timestamp: Date.now() },
        ]);
      }
    }

    // Check for removed items in their offer
    for (const prevItem of prevTheirOffer) {
      const stillExists = theirOffer.some(
        (item) => item.tradeSlot === prevItem.tradeSlot,
      );
      if (!stillExists) {
        setRemovedItems((prev) => [
          ...prev,
          { slot: prevItem.tradeSlot, side: "their", timestamp: Date.now() },
        ]);
      }
    }

    // Update refs
    prevMyOfferRef.current = [...myOffer];
    prevTheirOfferRef.current = [...theirOffer];
  }, [myOffer, theirOffer]);

  // Clear removed item indicators after timeout
  useEffect(() => {
    if (removedItems.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setRemovedItems((prev) =>
        prev.filter((item) => now - item.timestamp < REMOVED_ITEM_DISPLAY_MS),
      );
    }, REMOVED_ITEM_CHECK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [removedItems.length]);

  // Get removed slots for red exclamation display
  const myRemovedSlots = new Set(
    removedItems.filter((r) => r.side === "my").map((r) => r.slot),
  );
  const theirRemovedSlots = new Set(
    removedItems.filter((r) => r.side === "their").map((r) => r.slot),
  );

  return {
    removedItems,
    myRemovedSlots,
    theirRemovedSlots,
    hasRecentRemovals: removedItems.length > 0,
  };
}
