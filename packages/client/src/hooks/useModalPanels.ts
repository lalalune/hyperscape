/**
 * useModalPanels Hook
 *
 * Shared hook for subscribing to modal panel events (bank, store, dialogue, etc.).
 * Used by both InterfaceManager and MobileInterfaceManager to eliminate duplication.
 *
 * @packageDocumentation
 */

import { useState, useEffect, useCallback } from "react";
import { EventType } from "@hyperforge/shared";
import { useNotificationStore } from "@/ui/stores/notificationStore";
import type { InventoryItem, TradeOfferItem } from "@hyperforge/shared";
import type { ClientWorld } from "../types";

/** Network event names for UI interactions */
const NetworkEvents = {
  SMELTING_CLOSE: "smeltingClose",
  SMITHING_CLOSE: "smithingClose",
  CRAFTING_CLOSE: "craftingClose",
  TANNING_CLOSE: "tanningClose",
  FLETCHING_CLOSE: "fletchingClose",
  DUEL_ERROR: "duelError",
} as const;

interface LegacyUIUpdatePayload {
  component: string;
  data: Record<string, unknown>;
}

interface DuelCompletedPayload {
  won?: boolean;
  opponentName?: string;
  itemsReceived?: InventoryItem[];
  itemsLost?: InventoryItem[];
  totalValueWon?: number;
  totalValueLost?: number;
  forfeit?: boolean;
}

function normalizeDuelResultItems(
  items: InventoryItem[] | undefined,
): DuelResultData["itemsReceived"] {
  return (items ?? []).map((item) => ({
    itemId: item.itemId,
    quantity: item.quantity,
    value: 0,
  }));
}

interface ModalPanelSetters {
  setBankData: React.Dispatch<React.SetStateAction<BankData | null>>;
  setStoreData: React.Dispatch<React.SetStateAction<StoreData | null>>;
  setDialogueData: React.Dispatch<React.SetStateAction<DialogueData | null>>;
  setSmeltingData: React.Dispatch<React.SetStateAction<SmeltingData | null>>;
  setSmithingData: React.Dispatch<React.SetStateAction<SmithingData | null>>;
  setCraftingData: React.Dispatch<React.SetStateAction<CraftingData | null>>;
  setFletchingData: React.Dispatch<React.SetStateAction<FletchingData | null>>;
  setTanningData: React.Dispatch<React.SetStateAction<TanningData | null>>;
  setDuelData: React.Dispatch<React.SetStateAction<DuelData | null>>;
  setDuelResultData: React.Dispatch<
    React.SetStateAction<DuelResultData | null>
  >;
  setTradeData: React.Dispatch<React.SetStateAction<TradeData | null>>;
}

/** Bank item structure */
export interface BankItem {
  itemId: string;
  quantity: number;
  slot: number;
  tabIndex: number;
}

/** Bank tab structure */
export interface BankTab {
  tabIndex: number;
  iconItemId: string | null;
  items?: unknown[];
}

/** Bank data structure */
export interface BankData {
  visible: boolean;
  bankId: string;
  items: BankItem[];
  tabs: BankTab[];
  alwaysSetPlaceholder?: boolean;
  maxSlots: number;
}

/** Store item structure */
export interface StoreItem {
  id: string;
  itemId: string;
  name: string;
  price: number;
  stockQuantity: number;
  description?: string;
  category?: string;
}

/** Store data structure */
export interface StoreData {
  visible: boolean;
  storeId: string;
  storeName: string;
  buybackRate: number;
  items: StoreItem[];
  npcEntityId?: string;
}

/** Dialogue response structure */
export interface DialogueResponse {
  text: string;
  nextNodeId: string;
  effect?: string;
}

/** Dialogue data structure */
export interface DialogueData {
  visible: boolean;
  npcId: string;
  npcName: string;
  text: string;
  responses: DialogueResponse[];
  npcEntityId?: string;
}

/** Smelting bar structure */
export interface SmeltingBar {
  barItemId: string;
  levelRequired: number;
  primaryOre: string;
  secondaryOre: string | null;
  coalRequired: number;
}

/** Smelting data structure */
export interface SmeltingData {
  visible: boolean;
  furnaceId: string;
  availableBars: SmeltingBar[];
}

/** Smithing recipe structure */
export interface SmithingRecipe {
  itemId: string;
  name: string;
  barType: string;
  barsRequired: number;
  levelRequired: number;
  xp: number;
  category: string;
  outputQuantity?: number;
}

/** Smithing data structure */
export interface SmithingData {
  visible: boolean;
  anvilId: string;
  availableRecipes: SmithingRecipe[];
}

/** Crafting recipe structure */
export interface CraftingRecipeData {
  output: string;
  name: string;
  category: string;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  level: number;
  xp: number;
  meetsLevel: boolean;
  hasInputs: boolean;
}

/** Crafting data structure */
export interface CraftingData {
  visible: boolean;
  availableRecipes: CraftingRecipeData[];
  station: string;
}

/** Fletching recipe structure */
export interface FletchingRecipeData {
  recipeId: string;
  output: string;
  name: string;
  category: string;
  outputQuantity: number;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  level: number;
  xp: number;
  meetsLevel: boolean;
  hasInputs: boolean;
}

/** Fletching data structure */
export interface FletchingData {
  visible: boolean;
  availableRecipes: FletchingRecipeData[];
}

/** Tanning recipe structure */
export interface TanningRecipeData {
  input: string;
  output: string;
  cost: number;
  name: string;
  hasHide: boolean;
  hideCount: number;
}

/** Tanning data structure */
export interface TanningData {
  visible: boolean;
  availableRecipes: TanningRecipeData[];
}

/** Loot window data structure */
export interface LootWindowData {
  visible: boolean;
  corpseId: string;
  corpseName: string;
  lootItems: InventoryItem[];
}

/** Quest start data structure */
export interface QuestStartData {
  visible: boolean;
  questId: string;
  questName: string;
  description: string;
  difficulty: string;
  requirements: {
    quests: string[];
    skills: Record<string, number>;
    items: string[];
  };
  rewards: {
    questPoints: number;
    items: Array<{ itemId: string; quantity: number }>;
    xp: Record<string, number>;
  };
}

/** Quest complete data structure */
export interface QuestCompleteData {
  visible: boolean;
  questName: string;
  rewards: {
    questPoints: number;
    items: Array<{ itemId: string; quantity: number }>;
    xp: Record<string, number>;
  };
}

/** XP lamp data structure */
export interface XpLampData {
  visible: boolean;
  itemId: string;
  slot: number;
  xpAmount: number;
}

/** Duel panel data structure */
export interface DuelData {
  visible: boolean;
  duelId: string;
  opponentId: string;
  opponentName: string;
  isChallenger: boolean;
  screenState: "RULES" | "STAKES" | "CONFIRMING";
  rules: {
    noRanged: boolean;
    noMelee: boolean;
    noMagic: boolean;
    noSpecialAttack: boolean;
    noPrayer: boolean;
    noPotions: boolean;
    noFood: boolean;
    noForfeit: boolean;
    noMovement: boolean;
    funWeapons: boolean;
  };
  equipmentRestrictions: {
    head: boolean;
    cape: boolean;
    amulet: boolean;
    weapon: boolean;
    body: boolean;
    shield: boolean;
    legs: boolean;
    gloves: boolean;
    boots: boolean;
    ring: boolean;
    ammo: boolean;
  };
  myAccepted: boolean;
  opponentAccepted: boolean;
  myStakes: Array<{
    inventorySlot: number;
    itemId: string;
    quantity: number;
    value: number;
  }>;
  opponentStakes: Array<{
    inventorySlot: number;
    itemId: string;
    quantity: number;
    value: number;
  }>;
  opponentModifiedStakes: boolean;
}

/** Trade data structure */
export interface TradeData {
  visible: boolean;
  tradeId: string;
  partnerId: string;
  partnerName: string;
  partnerLevel: number;
  myOffer: TradeOfferItem[];
  myAccepted: boolean;
  theirOffer: TradeOfferItem[];
  theirAccepted: boolean;
  myOfferValue: number;
  theirOfferValue: number;
  partnerFreeSlots: number;
  screen: "offer" | "confirm";
}

/** Duel result data structure (shown after duel completes) */
export interface DuelResultData {
  visible: boolean;
  won: boolean;
  opponentName: string;
  itemsReceived: Array<{
    itemId: string;
    quantity: number;
    value: number;
  }>;
  itemsLost: Array<{
    itemId: string;
    quantity: number;
    value: number;
  }>;
  totalValueWon: number;
  totalValueLost: number;
  forfeit: boolean;
}

const defaultDuelRules: DuelData["rules"] = {
  noRanged: false,
  noMelee: false,
  noMagic: false,
  noSpecialAttack: false,
  noPrayer: false,
  noPotions: false,
  noFood: false,
  noForfeit: false,
  noMovement: false,
  funWeapons: false,
};

const defaultEquipmentRestrictions: DuelData["equipmentRestrictions"] = {
  head: false,
  cape: false,
  amulet: false,
  weapon: false,
  body: false,
  shield: false,
  legs: false,
  gloves: false,
  boots: false,
  ring: false,
  ammo: false,
};

function handleLegacyEconomyUIUpdate(
  payload: LegacyUIUpdatePayload,
  setters: Pick<
    ModalPanelSetters,
    | "setBankData"
    | "setStoreData"
    | "setDialogueData"
    | "setSmeltingData"
    | "setSmithingData"
    | "setCraftingData"
    | "setFletchingData"
    | "setTanningData"
  >,
): void {
  const {
    setBankData,
    setStoreData,
    setDialogueData,
    setSmeltingData,
    setSmithingData,
    setCraftingData,
    setFletchingData,
    setTanningData,
  } = setters;

  if (payload.component === "bank") {
    const bankUpdate = payload.data as {
      items?: Array<{
        itemId: string;
        quantity: number;
        slot: number;
        tabIndex?: number;
      }>;
      tabs?: Array<{ tabIndex: number; iconItemId: string | null }>;
      alwaysSetPlaceholder?: boolean;
      maxSlots?: number;
      bankId?: string;
      isOpen?: boolean;
    };

    if (bankUpdate.isOpen === false) {
      setBankData(null);
      return;
    }

    if (bankUpdate.isOpen || bankUpdate.items !== undefined) {
      const itemsWithTabIndex = (bankUpdate.items || []).map((item) => ({
        ...item,
        tabIndex: item.tabIndex ?? 0,
      }));

      setBankData((prev) => ({
        visible: true,
        items:
          bankUpdate.items !== undefined
            ? itemsWithTabIndex
            : prev?.items || [],
        tabs:
          bankUpdate.tabs !== undefined ? bankUpdate.tabs : prev?.tabs || [],
        alwaysSetPlaceholder:
          bankUpdate.alwaysSetPlaceholder ??
          prev?.alwaysSetPlaceholder ??
          false,
        maxSlots: bankUpdate.maxSlots ?? prev?.maxSlots ?? 480,
        bankId: bankUpdate.bankId ?? prev?.bankId ?? "spawn_bank",
      }));
      setDialogueData(null);
      return;
    }
  }

  if (payload.component === "store") {
    const storeUpdate = payload.data as {
      storeId: string;
      storeName: string;
      buybackRate: number;
      npcEntityId?: string;
      items: StoreItem[];
      isOpen?: boolean;
    };

    if (storeUpdate.isOpen) {
      setStoreData({
        visible: true,
        storeId: storeUpdate.storeId,
        storeName: storeUpdate.storeName,
        buybackRate: storeUpdate.buybackRate || 0.5,
        npcEntityId: storeUpdate.npcEntityId,
        items: storeUpdate.items || [],
      });
      setDialogueData(null);
    } else {
      setStoreData(null);
    }
    return;
  }

  if (payload.component === "dialogue") {
    const dialogueUpdate = payload.data as {
      npcId: string;
      npcName: string;
      text: string;
      responses: DialogueResponse[];
      npcEntityId?: string;
    };

    setDialogueData((prev) => ({
      visible: true,
      npcId: dialogueUpdate.npcId,
      npcName: dialogueUpdate.npcName || prev?.npcName || "NPC",
      text: dialogueUpdate.text,
      responses: dialogueUpdate.responses || [],
      npcEntityId: dialogueUpdate.npcEntityId || prev?.npcEntityId,
    }));
    return;
  }

  if (payload.component === "dialogueEnd") {
    setDialogueData(null);
    return;
  }

  if (payload.component === "smelting") {
    const smeltingUpdate = payload.data as {
      isOpen: boolean;
      furnaceId?: string;
      availableBars?: SmeltingBar[];
    };

    if (
      smeltingUpdate.isOpen &&
      smeltingUpdate.furnaceId &&
      smeltingUpdate.availableBars
    ) {
      setSmeltingData({
        visible: true,
        furnaceId: smeltingUpdate.furnaceId,
        availableBars: smeltingUpdate.availableBars,
      });
    } else {
      setSmeltingData(null);
    }
    return;
  }

  if (payload.component === "smithing") {
    const smithingUpdate = payload.data as {
      isOpen: boolean;
      anvilId?: string;
      availableRecipes?: SmithingRecipe[];
    };

    if (
      smithingUpdate.isOpen &&
      smithingUpdate.anvilId &&
      smithingUpdate.availableRecipes
    ) {
      setSmithingData({
        visible: true,
        anvilId: smithingUpdate.anvilId,
        availableRecipes: smithingUpdate.availableRecipes,
      });
    } else {
      setSmithingData(null);
    }
    return;
  }

  if (payload.component === "crafting") {
    const craftingUpdate = payload.data as {
      isOpen: boolean;
      availableRecipes?: CraftingRecipeData[];
      station?: string;
    };

    if (craftingUpdate.isOpen && craftingUpdate.availableRecipes) {
      setCraftingData({
        visible: true,
        availableRecipes: craftingUpdate.availableRecipes,
        station: craftingUpdate.station || "crafting",
      });
    } else {
      setCraftingData(null);
    }
    return;
  }

  if (payload.component === "fletching") {
    const fletchingUpdate = payload.data as {
      isOpen: boolean;
      availableRecipes?: FletchingRecipeData[];
    };

    if (fletchingUpdate.isOpen && fletchingUpdate.availableRecipes) {
      setFletchingData({
        visible: true,
        availableRecipes: fletchingUpdate.availableRecipes,
      });
    } else {
      setFletchingData(null);
    }
    return;
  }

  if (payload.component === "tanning") {
    const tanningUpdate = payload.data as {
      isOpen: boolean;
      availableRecipes?: TanningRecipeData[];
    };

    if (tanningUpdate.isOpen && tanningUpdate.availableRecipes) {
      setTanningData({
        visible: true,
        availableRecipes: tanningUpdate.availableRecipes,
      });
    } else {
      setTanningData(null);
    }
  }
}

function handleLegacyDuelUIUpdate(
  payload: LegacyUIUpdatePayload,
  setters: Pick<ModalPanelSetters, "setDuelData" | "setDuelResultData">,
): void {
  const { setDuelData, setDuelResultData } = setters;

  if (payload.component === "duel" && payload.data?.isOpen) {
    const duelOpenData = payload.data as {
      duelId?: string;
      opponent?: { id: string; name: string };
      isChallenger?: boolean;
    };
    setDuelData({
      visible: true,
      duelId: duelOpenData.duelId || "",
      opponentId: duelOpenData.opponent?.id || "",
      opponentName: duelOpenData.opponent?.name || "",
      isChallenger: duelOpenData.isChallenger || false,
      screenState: "RULES",
      rules: { ...defaultDuelRules },
      equipmentRestrictions: { ...defaultEquipmentRestrictions },
      myAccepted: false,
      opponentAccepted: false,
      myStakes: [],
      opponentStakes: [],
      opponentModifiedStakes: false,
    });
    return;
  }

  if (payload.component === "duelRulesUpdate") {
    const rulesData = payload.data as {
      duelId: string;
      rules: Record<string, boolean>;
      challengerAccepted: boolean;
      targetAccepted: boolean;
    };
    setDuelData((prev) => {
      if (!prev || prev.duelId !== rulesData.duelId) return prev;
      const isChallenger = prev.isChallenger;
      return {
        ...prev,
        rules: {
          noRanged: rulesData.rules.noRanged ?? prev.rules.noRanged,
          noMelee: rulesData.rules.noMelee ?? prev.rules.noMelee,
          noMagic: rulesData.rules.noMagic ?? prev.rules.noMagic,
          noSpecialAttack:
            rulesData.rules.noSpecialAttack ?? prev.rules.noSpecialAttack,
          noPrayer: rulesData.rules.noPrayer ?? prev.rules.noPrayer,
          noPotions: rulesData.rules.noPotions ?? prev.rules.noPotions,
          noFood: rulesData.rules.noFood ?? prev.rules.noFood,
          noForfeit: rulesData.rules.noForfeit ?? prev.rules.noForfeit,
          noMovement: rulesData.rules.noMovement ?? prev.rules.noMovement,
          funWeapons: rulesData.rules.funWeapons ?? prev.rules.funWeapons,
        },
        myAccepted: isChallenger
          ? rulesData.challengerAccepted
          : rulesData.targetAccepted,
        opponentAccepted: isChallenger
          ? rulesData.targetAccepted
          : rulesData.challengerAccepted,
      };
    });
    return;
  }

  if (payload.component === "duelEquipmentUpdate") {
    const equipData = payload.data as {
      duelId: string;
      equipmentRestrictions: Record<string, boolean>;
      challengerAccepted: boolean;
      targetAccepted: boolean;
    };
    setDuelData((prev) => {
      if (!prev || prev.duelId !== equipData.duelId) return prev;
      const isChallenger = prev.isChallenger;
      return {
        ...prev,
        equipmentRestrictions: {
          head:
            equipData.equipmentRestrictions.head ??
            prev.equipmentRestrictions.head,
          cape:
            equipData.equipmentRestrictions.cape ??
            prev.equipmentRestrictions.cape,
          amulet:
            equipData.equipmentRestrictions.amulet ??
            prev.equipmentRestrictions.amulet,
          weapon:
            equipData.equipmentRestrictions.weapon ??
            prev.equipmentRestrictions.weapon,
          body:
            equipData.equipmentRestrictions.body ??
            prev.equipmentRestrictions.body,
          shield:
            equipData.equipmentRestrictions.shield ??
            prev.equipmentRestrictions.shield,
          legs:
            equipData.equipmentRestrictions.legs ??
            prev.equipmentRestrictions.legs,
          gloves:
            equipData.equipmentRestrictions.gloves ??
            prev.equipmentRestrictions.gloves,
          boots:
            equipData.equipmentRestrictions.boots ??
            prev.equipmentRestrictions.boots,
          ring:
            equipData.equipmentRestrictions.ring ??
            prev.equipmentRestrictions.ring,
          ammo:
            equipData.equipmentRestrictions.ammo ??
            prev.equipmentRestrictions.ammo,
        },
        myAccepted: isChallenger
          ? equipData.challengerAccepted
          : equipData.targetAccepted,
        opponentAccepted: isChallenger
          ? equipData.targetAccepted
          : equipData.challengerAccepted,
      };
    });
    return;
  }

  if (payload.component === "duelAcceptanceUpdate") {
    const acceptData = payload.data as {
      duelId: string;
      challengerAccepted: boolean;
      targetAccepted: boolean;
    };
    setDuelData((prev) => {
      if (!prev || prev.duelId !== acceptData.duelId) return prev;
      const isChallenger = prev.isChallenger;
      return {
        ...prev,
        myAccepted: isChallenger
          ? acceptData.challengerAccepted
          : acceptData.targetAccepted,
        opponentAccepted: isChallenger
          ? acceptData.targetAccepted
          : acceptData.challengerAccepted,
      };
    });
    return;
  }

  if (payload.component === "duelStakesUpdate") {
    const stakesData = payload.data as {
      duelId: string;
      challengerStakes: DuelData["myStakes"];
      targetStakes: DuelData["myStakes"];
      challengerAccepted: boolean;
      targetAccepted: boolean;
      modifiedBy: string;
    };
    setDuelData((prev) => {
      if (!prev || prev.duelId !== stakesData.duelId) return prev;
      const isChallenger = prev.isChallenger;
      return {
        ...prev,
        myStakes: isChallenger
          ? stakesData.challengerStakes
          : stakesData.targetStakes,
        opponentStakes: isChallenger
          ? stakesData.targetStakes
          : stakesData.challengerStakes,
        myAccepted: isChallenger
          ? stakesData.challengerAccepted
          : stakesData.targetAccepted,
        opponentAccepted: isChallenger
          ? stakesData.targetAccepted
          : stakesData.challengerAccepted,
        opponentModifiedStakes: stakesData.modifiedBy === prev.opponentId,
      };
    });
    return;
  }

  if (payload.component === "duelStateChange") {
    const stateData = payload.data as { duelId: string; state: string };
    setDuelData((prev) => {
      if (!prev || prev.duelId !== stateData.duelId) return prev;
      const panelStates = new Set(["RULES", "STAKES", "CONFIRMING"]);
      if (!panelStates.has(stateData.state)) {
        return null;
      }
      return {
        ...prev,
        screenState: stateData.state as DuelData["screenState"],
        myAccepted: false,
        opponentAccepted: false,
      };
    });
    return;
  }

  if (
    payload.component === "duelClose" ||
    payload.component === "duelCancelled"
  ) {
    const closeData = payload.data as { duelId?: string };
    setDuelData((prev) => {
      if (!prev) return prev;
      if (closeData.duelId && prev.duelId !== closeData.duelId) return prev;
      return null;
    });
    return;
  }

  if (payload.component === "duelCompleted") {
    const completedData = payload.data as unknown as DuelCompletedPayload;
    setDuelData(null);
    setDuelResultData({
      visible: true,
      won: completedData.won ?? false,
      opponentName: completedData.opponentName || "Unknown",
      itemsReceived: normalizeDuelResultItems(completedData.itemsReceived),
      itemsLost: normalizeDuelResultItems(completedData.itemsLost),
      totalValueWon: completedData.totalValueWon || 0,
      totalValueLost: completedData.totalValueLost || 0,
      forfeit: completedData.forfeit || false,
    });
  }
}

function handleLegacyTradeUIUpdate(
  payload: LegacyUIUpdatePayload,
  setters: Pick<ModalPanelSetters, "setTradeData">,
): void {
  const { setTradeData } = setters;

  if (payload.component === "trade" && payload.data?.isOpen) {
    const tradeOpenData = payload.data as {
      tradeId?: string;
      partner?: { id: string; name: string; level: number };
    };
    setTradeData({
      visible: true,
      tradeId: tradeOpenData.tradeId || "",
      partnerId: tradeOpenData.partner?.id || "",
      partnerName: tradeOpenData.partner?.name || "",
      partnerLevel: tradeOpenData.partner?.level || 0,
      myOffer: [],
      myAccepted: false,
      theirOffer: [],
      theirAccepted: false,
      myOfferValue: 0,
      theirOfferValue: 0,
      partnerFreeSlots: 28,
      screen: "offer",
    });
    return;
  }

  if (payload.component === "tradeUpdate") {
    const updateData = payload.data as {
      tradeId: string;
      myOffer: TradeOfferItem[];
      myAccepted: boolean;
      theirOffer: TradeOfferItem[];
      theirAccepted: boolean;
    };
    setTradeData((prev) => {
      if (!prev || prev.tradeId !== updateData.tradeId) return prev;
      return {
        ...prev,
        myOffer: updateData.myOffer || prev.myOffer,
        myAccepted: updateData.myAccepted,
        theirOffer: updateData.theirOffer || prev.theirOffer,
        theirAccepted: updateData.theirAccepted,
      };
    });
    return;
  }

  if (payload.component === "tradeConfirm") {
    const confirmData = payload.data as {
      tradeId: string;
      myOffer: TradeOfferItem[];
      theirOffer: TradeOfferItem[];
      myOfferValue: number;
      theirOfferValue: number;
      myAccepted: boolean;
      theirAccepted: boolean;
    };
    setTradeData((prev) => {
      if (!prev || prev.tradeId !== confirmData.tradeId) return prev;
      return {
        ...prev,
        screen: "confirm",
        myOffer: confirmData.myOffer || prev.myOffer,
        theirOffer: confirmData.theirOffer || prev.theirOffer,
        myOfferValue: confirmData.myOfferValue ?? prev.myOfferValue,
        theirOfferValue: confirmData.theirOfferValue ?? prev.theirOfferValue,
        myAccepted: confirmData.myAccepted,
        theirAccepted: confirmData.theirAccepted,
      };
    });
    return;
  }

  if (payload.component === "tradeClose") {
    const closeData = payload.data as { tradeId?: string };
    setTradeData((prev) => {
      if (!prev) return prev;
      if (closeData.tradeId && prev.tradeId !== closeData.tradeId) return prev;
      return null;
    });
  }
}

/**
 * Hook return type for modal panels
 */
export interface ModalPanelsState {
  // Panel data
  bankData: BankData | null;
  storeData: StoreData | null;
  dialogueData: DialogueData | null;
  smeltingData: SmeltingData | null;
  smithingData: SmithingData | null;
  craftingData: CraftingData | null;
  fletchingData: FletchingData | null;
  tanningData: TanningData | null;
  lootWindowData: LootWindowData | null;
  questStartData: QuestStartData | null;
  questCompleteData: QuestCompleteData | null;
  xpLampData: XpLampData | null;
  duelData: DuelData | null;
  duelResultData: DuelResultData | null;
  tradeData: TradeData | null;

  // Setters
  setBankData: React.Dispatch<React.SetStateAction<BankData | null>>;
  setStoreData: React.Dispatch<React.SetStateAction<StoreData | null>>;
  setDialogueData: React.Dispatch<React.SetStateAction<DialogueData | null>>;
  setSmeltingData: React.Dispatch<React.SetStateAction<SmeltingData | null>>;
  setSmithingData: React.Dispatch<React.SetStateAction<SmithingData | null>>;
  setCraftingData: React.Dispatch<React.SetStateAction<CraftingData | null>>;
  setFletchingData: React.Dispatch<React.SetStateAction<FletchingData | null>>;
  setTanningData: React.Dispatch<React.SetStateAction<TanningData | null>>;
  setLootWindowData: React.Dispatch<
    React.SetStateAction<LootWindowData | null>
  >;
  setQuestStartData: React.Dispatch<
    React.SetStateAction<QuestStartData | null>
  >;
  setQuestCompleteData: React.Dispatch<
    React.SetStateAction<QuestCompleteData | null>
  >;
  setXpLampData: React.Dispatch<React.SetStateAction<XpLampData | null>>;
  setDuelData: React.Dispatch<React.SetStateAction<DuelData | null>>;
  setDuelResultData: React.Dispatch<
    React.SetStateAction<DuelResultData | null>
  >;
  setTradeData: React.Dispatch<React.SetStateAction<TradeData | null>>;

  // Close handlers
  closeBank: () => void;
  closeStore: () => void;
  closeDialogue: () => void;
  closeSmelting: () => void;
  closeSmithing: () => void;
  closeCrafting: () => void;
  closeFletching: () => void;
  closeTanning: () => void;
  closeLootWindow: () => void;
  closeQuestStart: () => void;
  closeQuestComplete: () => void;
  closeXpLamp: () => void;
  closeDuel: () => void;
  closeDuelResult: () => void;
  closeTrade: () => void;
}

// Also export as ModalPanelsResult for backwards compatibility
export type ModalPanelsResult = ModalPanelsState;

/**
 * useModalPanels - Subscribe to modal panel events
 *
 * Handles:
 * - Bank open/close (BANK_OPEN, BANK_CLOSE)
 * - Store open/close (STORE_OPEN, STORE_CLOSE)
 * - Dialogue start/end (DIALOGUE_START, DIALOGUE_END)
 * - Smelting open/close (SMELTING_INTERFACE_OPEN, network smeltingClose)
 * - Smithing open/close (SMITHING_INTERFACE_OPEN, network smithingClose)
 * - Loot window (CORPSE_CLICK)
 * - Quest start/complete (QUEST_START_CONFIRM, QUEST_COMPLETED)
 * - XP lamp (XP_LAMP_USE_REQUEST)
 *
 * @param world - The game world instance
 * @returns Modal panel state and setters
 */
export function useModalPanels(world: ClientWorld | null): ModalPanelsState {
  const [bankData, setBankData] = useState<BankData | null>(null);
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [dialogueData, setDialogueData] = useState<DialogueData | null>(null);
  const [smeltingData, setSmeltingData] = useState<SmeltingData | null>(null);
  const [smithingData, setSmithingData] = useState<SmithingData | null>(null);
  const [craftingData, setCraftingData] = useState<CraftingData | null>(null);
  const [fletchingData, setFletchingData] = useState<FletchingData | null>(
    null,
  );
  const [tanningData, setTanningData] = useState<TanningData | null>(null);
  const [lootWindowData, setLootWindowData] = useState<LootWindowData | null>(
    null,
  );
  const [questStartData, setQuestStartData] = useState<QuestStartData | null>(
    null,
  );
  const [questCompleteData, setQuestCompleteData] =
    useState<QuestCompleteData | null>(null);
  const [xpLampData, setXpLampData] = useState<XpLampData | null>(null);
  const [duelData, setDuelData] = useState<DuelData | null>(null);
  const [duelResultData, setDuelResultData] = useState<DuelResultData | null>(
    null,
  );
  const [tradeData, setTradeData] = useState<TradeData | null>(null);

  // Close handlers
  const closeBank = useCallback(() => setBankData(null), []);
  const closeStore = useCallback(() => setStoreData(null), []);
  const closeDialogue = useCallback(() => setDialogueData(null), []);
  const closeSmelting = useCallback(() => setSmeltingData(null), []);
  const closeSmithing = useCallback(() => setSmithingData(null), []);
  const closeCrafting = useCallback(() => setCraftingData(null), []);
  const closeFletching = useCallback(() => setFletchingData(null), []);
  const closeTanning = useCallback(() => setTanningData(null), []);
  const closeLootWindow = useCallback(() => setLootWindowData(null), []);
  const closeQuestStart = useCallback(() => setQuestStartData(null), []);
  const closeQuestComplete = useCallback(() => setQuestCompleteData(null), []);
  const closeXpLamp = useCallback(() => setXpLampData(null), []);
  const closeDuel = useCallback(() => setDuelData(null), []);
  const closeDuelResult = useCallback(() => setDuelResultData(null), []);
  const closeTrade = useCallback(() => setTradeData(null), []);

  useEffect(() => {
    if (!world) return;

    // Bank handlers
    const handleBankOpen = (data: unknown) => {
      const d = data as BankData;
      if (d) {
        setBankData({ ...d, visible: true });
        setDialogueData(null);
      }
    };

    const handleBankClose = () => setBankData(null);

    // Store handlers
    const handleStoreOpen = (data: unknown) => {
      const d = data as StoreData;
      if (d) {
        setStoreData({ ...d, visible: true });
        setDialogueData(null);
      }
    };

    const handleStoreClose = () => setStoreData(null);

    // Dialogue handlers
    const handleDialogueStart = (data: unknown) => {
      const d = data as DialogueData;
      if (d) setDialogueData({ ...d, visible: true });
    };

    const handleDialogueEnd = () => setDialogueData(null);

    // Smelting handlers
    const handleSmeltingOpen = (data: unknown) => {
      const d = data as SmeltingData;
      if (d) setSmeltingData({ ...d, visible: true });
    };

    const handleSmeltingClose = () => setSmeltingData(null);

    // Smithing handlers
    const handleSmithingOpen = (data: unknown) => {
      const d = data as SmithingData;
      if (d) setSmithingData({ ...d, visible: true });
    };

    const handleSmithingClose = () => setSmithingData(null);

    // Crafting handlers
    const handleCraftingOpen = (data: unknown) => {
      const d = data as CraftingData;
      if (d) setCraftingData({ ...d, visible: true });
    };

    const handleCraftingClose = () => setCraftingData(null);

    // Fletching handlers
    const handleFletchingOpen = (data: unknown) => {
      const d = data as FletchingData;
      if (d) setFletchingData({ ...d, visible: true });
    };

    const handleFletchingClose = () => setFletchingData(null);

    // Tanning handlers
    const handleTanningOpen = (data: unknown) => {
      const d = data as TanningData;
      if (d) setTanningData({ ...d, visible: true });
    };

    const handleTanningClose = () => setTanningData(null);

    // Corpse click handler (loot window trigger)
    const handleCorpseClick = (data: unknown) => {
      const d = data as {
        corpseId: string;
        playerId: string;
        lootItems?: Array<{ itemId: string; quantity: number }>;
        position: { x: number; y: number; z: number };
      };
      setLootWindowData({
        visible: true,
        corpseId: d.corpseId,
        corpseName: "Gravestone",
        lootItems:
          d.lootItems?.map((item, index) => ({
            id: `${d.corpseId}-${index}`,
            slot: index,
            itemId: item.itemId,
            quantity: item.quantity,
            metadata: null,
          })) || [],
      });
    };

    // Quest start handler
    const handleQuestStartConfirm = (data: unknown) => {
      const d = data as {
        questId: string;
        questName: string;
        description: string;
        difficulty: string;
        requirements: {
          quests: string[];
          skills: Record<string, number>;
          items: string[];
        };
        rewards: {
          questPoints: number;
          items: Array<{ itemId: string; quantity: number }>;
          xp: Record<string, number>;
        };
      };
      setQuestStartData({
        visible: true,
        questId: d.questId,
        questName: d.questName,
        description: d.description,
        difficulty: d.difficulty,
        requirements: d.requirements || { quests: [], skills: {}, items: [] },
        rewards: d.rewards || { questPoints: 0, items: [], xp: {} },
      });
    };

    // Quest complete handler
    const handleQuestCompleted = (data: unknown) => {
      const d = data as {
        playerId: string;
        questId: string;
        questName: string;
        rewards: {
          questPoints: number;
          items: Array<{ itemId: string; quantity: number }>;
          xp: Record<string, number>;
        };
      };
      const localId = world.entities?.player?.id;
      if (!localId || d.playerId === localId) {
        setQuestCompleteData({
          visible: true,
          questName: d.questName,
          rewards: d.rewards || { questPoints: 0, items: [], xp: {} },
        });
      }
    };

    // XP lamp handler
    const handleXpLampUseRequest = (data: unknown) => {
      const d = data as {
        playerId: string;
        itemId: string;
        slot: number;
        xpAmount: number;
      };
      const localId = world.entities?.player?.id;
      if (!localId || d.playerId === localId) {
        setXpLampData({
          visible: true,
          itemId: d.itemId,
          slot: d.slot,
          xpAmount: d.xpAmount,
        });
      }
    };

    // UI_UPDATE handler for duel panel
    const handleUIUpdate = (data: unknown) => {
      const payload = data as LegacyUIUpdatePayload;
      handleLegacyEconomyUIUpdate(payload, {
        setBankData,
        setStoreData,
        setDialogueData,
        setSmeltingData,
        setSmithingData,
        setCraftingData,
        setFletchingData,
        setTanningData,
      });
      handleLegacyDuelUIUpdate(payload, { setDuelData, setDuelResultData });
      handleLegacyTradeUIUpdate(payload, { setTradeData });
    };

    // Register world event listeners
    world.on(EventType.BANK_OPEN, handleBankOpen, undefined);
    world.on(EventType.BANK_CLOSE, handleBankClose, undefined);
    world.on(EventType.STORE_OPEN, handleStoreOpen, undefined);
    world.on(EventType.STORE_CLOSE, handleStoreClose, undefined);
    world.on(EventType.DIALOGUE_START, handleDialogueStart, undefined);
    world.on(EventType.DIALOGUE_END, handleDialogueEnd, undefined);
    world.on(EventType.SMELTING_INTERFACE_OPEN, handleSmeltingOpen, undefined);
    world.on(EventType.SMITHING_INTERFACE_OPEN, handleSmithingOpen, undefined);
    world.on(EventType.CRAFTING_INTERFACE_OPEN, handleCraftingOpen, undefined);
    world.on(
      EventType.FLETCHING_INTERFACE_OPEN,
      handleFletchingOpen,
      undefined,
    );
    world.on(EventType.TANNING_INTERFACE_OPEN, handleTanningOpen, undefined);
    world.on(EventType.CORPSE_CLICK, handleCorpseClick, undefined);
    world.on(EventType.QUEST_START_CONFIRM, handleQuestStartConfirm, undefined);
    world.on(EventType.QUEST_COMPLETED, handleQuestCompleted, undefined);
    world.on(EventType.XP_LAMP_USE_REQUEST, handleXpLampUseRequest, undefined);
    world.on(EventType.UI_UPDATE, handleUIUpdate, undefined);

    // Handle duel error packets from server
    const handleDuelError = (data: unknown) => {
      const { message } = data as { message: string; code: string };
      useNotificationStore.getState().showError(message, "Duel");
    };

    // Register network event listeners
    if (world.network) {
      world.network.on(NetworkEvents.SMELTING_CLOSE, handleSmeltingClose);
      world.network.on(NetworkEvents.SMITHING_CLOSE, handleSmithingClose);
      world.network.on(NetworkEvents.CRAFTING_CLOSE, handleCraftingClose);
      world.network.on(NetworkEvents.FLETCHING_CLOSE, handleFletchingClose);
      world.network.on(NetworkEvents.TANNING_CLOSE, handleTanningClose);
      world.network.on(NetworkEvents.DUEL_ERROR, handleDuelError);
    }

    return () => {
      // Unregister world event listeners
      world.off(EventType.BANK_OPEN, handleBankOpen, undefined, undefined);
      world.off(EventType.BANK_CLOSE, handleBankClose, undefined, undefined);
      world.off(EventType.STORE_OPEN, handleStoreOpen, undefined, undefined);
      world.off(EventType.STORE_CLOSE, handleStoreClose, undefined, undefined);
      world.off(
        EventType.DIALOGUE_START,
        handleDialogueStart,
        undefined,
        undefined,
      );
      world.off(
        EventType.DIALOGUE_END,
        handleDialogueEnd,
        undefined,
        undefined,
      );
      world.off(
        EventType.SMELTING_INTERFACE_OPEN,
        handleSmeltingOpen,
        undefined,
        undefined,
      );
      world.off(
        EventType.SMITHING_INTERFACE_OPEN,
        handleSmithingOpen,
        undefined,
        undefined,
      );
      world.off(
        EventType.CRAFTING_INTERFACE_OPEN,
        handleCraftingOpen,
        undefined,
        undefined,
      );
      world.off(
        EventType.FLETCHING_INTERFACE_OPEN,
        handleFletchingOpen,
        undefined,
        undefined,
      );
      world.off(
        EventType.TANNING_INTERFACE_OPEN,
        handleTanningOpen,
        undefined,
        undefined,
      );
      world.off(
        EventType.CORPSE_CLICK,
        handleCorpseClick,
        undefined,
        undefined,
      );
      world.off(
        EventType.QUEST_START_CONFIRM,
        handleQuestStartConfirm,
        undefined,
        undefined,
      );
      world.off(
        EventType.QUEST_COMPLETED,
        handleQuestCompleted,
        undefined,
        undefined,
      );
      world.off(
        EventType.XP_LAMP_USE_REQUEST,
        handleXpLampUseRequest,
        undefined,
        undefined,
      );
      world.off(EventType.UI_UPDATE, handleUIUpdate, undefined, undefined);

      // Unregister network event listeners
      if (world.network) {
        world.network.off(NetworkEvents.SMELTING_CLOSE, handleSmeltingClose);
        world.network.off(NetworkEvents.SMITHING_CLOSE, handleSmithingClose);
        world.network.off(NetworkEvents.CRAFTING_CLOSE, handleCraftingClose);
        world.network.off(NetworkEvents.FLETCHING_CLOSE, handleFletchingClose);
        world.network.off(NetworkEvents.TANNING_CLOSE, handleTanningClose);
        world.network.off(NetworkEvents.DUEL_ERROR, handleDuelError);
      }
    };
  }, [world]);

  return {
    bankData,
    storeData,
    dialogueData,
    smeltingData,
    smithingData,
    craftingData,
    fletchingData,
    tanningData,
    lootWindowData,
    questStartData,
    questCompleteData,
    xpLampData,
    duelData,
    duelResultData,
    tradeData,
    setBankData,
    setStoreData,
    setDialogueData,
    setSmeltingData,
    setSmithingData,
    setCraftingData,
    setFletchingData,
    setTanningData,
    setLootWindowData,
    setQuestStartData,
    setQuestCompleteData,
    setXpLampData,
    setDuelData,
    setDuelResultData,
    setTradeData,
    closeBank,
    closeStore,
    closeDialogue,
    closeSmelting,
    closeSmithing,
    closeCrafting,
    closeFletching,
    closeTanning,
    closeLootWindow,
    closeQuestStart,
    closeQuestComplete,
    closeXpLamp,
    closeDuel,
    closeDuelResult,
    closeTrade,
  };
}
