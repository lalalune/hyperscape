import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EquipmentSlotName,
  ITEMS,
  type Item,
  type PlayerEquipmentItems,
} from "@hyperforge/shared";
import { EquipmentPanel } from "../../src/game/panels/EquipmentPanel";

let mockShouldUseMobileUI = false;

vi.mock("@/ui", async () => {
  const actual = await vi.importActual<typeof import("@/ui")>("@/ui");

  return {
    ...actual,
    useDroppable: vi.fn(() => ({
      isOver: false,
      setNodeRef: vi.fn(),
    })),
    useDragStore: vi.fn(
      (selector: (state: { item: null; isDragging: boolean }) => unknown) =>
        selector({
          item: null,
          isDragging: false,
        }),
    ),
    useMobileLayout: vi.fn(() => ({
      isMobile: mockShouldUseMobileUI,
      isTablet: false,
      isDesktop: !mockShouldUseMobileUI,
      orientation: mockShouldUseMobileUI ? "portrait" : "landscape",
      isPortrait: mockShouldUseMobileUI,
      isLandscape: !mockShouldUseMobileUI,
      shouldUseMobileUI: mockShouldUseMobileUI,
      touchTargetSize: mockShouldUseMobileUI ? 48 : 40,
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      viewport: {
        width: mockShouldUseMobileUI ? 390 : 1280,
        height: mockShouldUseMobileUI ? 844 : 720,
      },
    })),
  };
});

function createMockItem(
  id: string,
  name: string,
  equipSlot?: Item["equipSlot"],
  quantity = 1,
): Item {
  return {
    id,
    name,
    type: "weapon" as Item["type"],
    description: `A ${name}`,
    examine: `Examine ${name}`,
    tradeable: true,
    rarity: "common" as Item["rarity"],
    modelPath: null,
    iconPath: `/items/${id}.png`,
    equipSlot,
    quantity,
    stackable: quantity > 1,
    maxStackSize: quantity > 1 ? 1000 : 1,
  };
}

describe("EquipmentPanel", () => {
  const emptyEquipment: PlayerEquipmentItems = {
    helmet: null,
    body: null,
    legs: null,
    boots: null,
    gloves: null,
    cape: null,
    amulet: null,
    ring: null,
    weapon: null,
    shield: null,
    arrows: null,
  };

  beforeEach(() => {
    mockShouldUseMobileUI = false;
    ITEMS.clear();

    ITEMS.set(
      "bronze_sword",
      createMockItem("bronze_sword", "Bronze Sword", EquipmentSlotName.WEAPON),
    );
    ITEMS.set(
      "iron_helmet",
      createMockItem("iron_helmet", "Iron Helmet", EquipmentSlotName.HELMET),
    );
    ITEMS.set(
      "bronze_arrow",
      createMockItem(
        "bronze_arrow",
        "Bronze Arrow",
        EquipmentSlotName.ARROWS,
        25,
      ),
    );
  });

  it("renders the paperdoll slots and keeps the portrait in a loading state before world data is available", () => {
    const { container } = render(<EquipmentPanel equipment={emptyEquipment} />);

    expect(container.querySelectorAll("[data-equipment-slot]")).toHaveLength(
      11,
    );

    const portrait = container.querySelector(
      '[data-equipment-portrait="true"]',
    );
    expect(portrait).toBeInTheDocument();
    expect(portrait).toHaveAttribute("data-portrait-mode", "loading");

    expect(screen.getByTitle("Head (empty)")).toBeInTheDocument();
    expect(screen.getByTitle("Weapon (empty)")).toBeInTheDocument();
    expect(screen.getByLabelText("Empty Head slot")).toBeInTheDocument();
    expect(screen.getByLabelText("Empty Weapon slot")).toBeInTheDocument();
  });

  it("shows equipped item icons with slot labels and without visible item-name labels in slot tiles", () => {
    const equipment: PlayerEquipmentItems = {
      ...emptyEquipment,
      helmet: createMockItem(
        "iron_helmet",
        "Iron Helmet",
        EquipmentSlotName.HELMET,
      ),
      weapon: createMockItem(
        "bronze_sword",
        "Bronze Sword",
        EquipmentSlotName.WEAPON,
      ),
      arrows: createMockItem(
        "bronze_arrow",
        "Bronze Arrow",
        EquipmentSlotName.ARROWS,
        25,
      ),
    };

    render(<EquipmentPanel equipment={equipment} />);

    expect(screen.getByAltText("Iron Helmet")).toBeInTheDocument();
    expect(screen.getByAltText("Bronze Sword")).toBeInTheDocument();
    expect(screen.getByAltText("Bronze Arrow")).toBeInTheDocument();
    expect(screen.queryByText("Bronze Sword")).not.toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("updates the rendered equipment when props change", () => {
    const initialEquipment: PlayerEquipmentItems = {
      ...emptyEquipment,
      weapon: createMockItem(
        "bronze_sword",
        "Bronze Sword",
        EquipmentSlotName.WEAPON,
      ),
    };

    const { rerender } = render(
      <EquipmentPanel equipment={initialEquipment} />,
    );
    expect(screen.getByAltText("Bronze Sword")).toBeInTheDocument();

    rerender(<EquipmentPanel equipment={emptyEquipment} />);
    expect(screen.queryByAltText("Bronze Sword")).not.toBeInTheDocument();

    rerender(
      <EquipmentPanel
        equipment={{
          ...emptyEquipment,
          helmet: createMockItem(
            "iron_helmet",
            "Iron Helmet",
            EquipmentSlotName.HELMET,
          ),
        }}
      />,
    );

    expect(screen.getByAltText("Iron Helmet")).toBeInTheDocument();
  });

  it("keeps the portrait container in the compact mobile layout", () => {
    mockShouldUseMobileUI = true;

    const { container } = render(<EquipmentPanel equipment={emptyEquipment} />);

    expect(
      container.querySelector('[data-equipment-grid="paperdoll"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-equipment-portrait="true"]'),
    ).toBeInTheDocument();
  });
});
