/**
 * PlanPreviewPanel — right-rail project plan render tests.
 *
 * Phase 1.2 sixteenth carve. Pins the build CTA gating logic
 * and the per-slot filled/empty toggle since these directly
 * drive what the user sees as the agent fills slots.
 */

import { fireEvent, render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import {
  createEmptyOnboardingPlan,
  type OnboardingPlan,
} from "../onboardingPlan";
import { PlanPreviewPanel } from "../PlanPreviewPanel";

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof PlanPreviewPanel>> = {},
) {
  return {
    plan: createEmptyOnboardingPlan(),
    canBuild: false,
    isCreating: false,
    isPending: false,
    onBuild: vi.fn(),
    onAskFor: vi.fn(),
    onRemoveTerrain: vi.fn(),
    onRemovePlugins: vi.fn(),
    onRemoveNpc: vi.fn(),
    onRemoveMobSpawn: vi.fn(),
    onRemoveQuest: vi.fn(),
    onRemoveAsset: vi.fn(),
    onRemoveUiPack: vi.fn(),
    ...overrides,
  };
}

describe("PlanPreviewPanel — header counter", () => {
  it("shows 0/21 for an empty plan", () => {
    const { container } = render(<PlanPreviewPanel {...defaultProps()} />);
    expect(container.textContent).toContain("0/21");
  });

  it("counts primary + secondary slots in the badge", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      pluginIds: ["combat"],
      roads: [{ id: "r1" }],
    };
    const { container } = render(
      <PlanPreviewPanel {...defaultProps({ plan })} />,
    );
    expect(container.textContent).toContain("2/21");
  });
});

describe("PlanPreviewPanel — empty slot CTAs", () => {
  it("clicking an empty primary slot fires onAskFor with the empty prompt", () => {
    const onAskFor = vi.fn();
    const { getByText } = render(
      <PlanPreviewPanel {...defaultProps({ onAskFor })} />,
    );
    fireEvent.click(getByText("Pick a gameplay style"));
    expect(onAskFor).toHaveBeenCalledTimes(1);
    expect(onAskFor.mock.calls[0][0]).toContain("plugin");
  });

  it("disables CTAs when isPending=true", () => {
    const { getByText } = render(
      <PlanPreviewPanel {...defaultProps({ isPending: true })} />,
    );
    const button = getByText("Pick a gameplay style").closest(
      "button",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("disables CTAs when isCreating=true", () => {
    const { getByText } = render(
      <PlanPreviewPanel {...defaultProps({ isCreating: true })} />,
    );
    const button = getByText("Pick a gameplay style").closest(
      "button",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe("PlanPreviewPanel — filled slots", () => {
  it("renders 'NPCs' count badge + per-entry name when npcs are set", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      npcs: [
        { id: "shop", name: "Eldric", type: "shopkeeper" },
        { id: "guard", name: "Garrick", type: "guard" },
      ],
    };
    const { container } = render(
      <PlanPreviewPanel {...defaultProps({ plan })} />,
    );
    expect(container.textContent).toContain("Eldric");
    expect(container.textContent).toContain("Garrick");
    expect(container.textContent).toContain("2 placed");
  });

  it("clicking remove on an NPC fires onRemoveNpc with the index", () => {
    const onRemoveNpc = vi.fn();
    const plan = {
      ...createEmptyOnboardingPlan(),
      npcs: [
        { id: "shop", name: "Eldric" },
        { id: "guard", name: "Garrick" },
      ],
    };
    const { getByLabelText } = render(
      <PlanPreviewPanel {...defaultProps({ plan, onRemoveNpc })} />,
    );
    fireEvent.click(getByLabelText("Remove Garrick"));
    expect(onRemoveNpc).toHaveBeenCalledWith(1);
  });

  it("renders 'Asset bakes' row only when assets.length > 0", () => {
    const noAssets = render(<PlanPreviewPanel {...defaultProps()} />);
    expect(noAssets.container.textContent).not.toContain("Asset bakes");

    const withAssets = render(
      <PlanPreviewPanel
        {...defaultProps({
          plan: {
            ...createEmptyOnboardingPlan(),
            assets: [{ name: "asset_a" }],
          },
        })}
      />,
    );
    expect(withAssets.container.textContent).toContain("Asset bakes");
    expect(withAssets.container.textContent).toContain("asset_a");
  });
});

describe("PlanPreviewPanel — theme summary", () => {
  it("falls back to 'No theme picked yet' when no content pack installed", () => {
    const { container } = render(<PlanPreviewPanel {...defaultProps()} />);
    expect(container.textContent).toContain("No theme picked yet");
  });

  it("derives short theme name from content-pack-* id", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      assetPackIds: ["@hyperforge/content-pack-tropical-v1"],
    };
    const { container } = render(
      <PlanPreviewPanel {...defaultProps({ plan })} />,
    );
    expect(container.textContent).toContain("tropical");
  });

  it("ignores non-content-pack-* installs for theme detection", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      assetPackIds: ["@hyperforge/asset-pack-hyperia-trees-v1"],
    };
    const { container } = render(
      <PlanPreviewPanel {...defaultProps({ plan })} />,
    );
    expect(container.textContent).toContain("No theme picked yet");
  });
});

describe("PlanPreviewPanel — Build CTA", () => {
  it("disables the Build button when canBuild=false", () => {
    const { getByText } = render(
      <PlanPreviewPanel {...defaultProps({ canBuild: false })} />,
    );
    const btn = getByText(/Generate world/).closest(
      "button",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables the Build button when canBuild=true", () => {
    const { getByText } = render(
      <PlanPreviewPanel {...defaultProps({ canBuild: true })} />,
    );
    const btn = getByText(/Generate world/).closest(
      "button",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("fires onBuild when clicked", () => {
    const onBuild = vi.fn();
    const { getByText } = render(
      <PlanPreviewPanel {...defaultProps({ canBuild: true, onBuild })} />,
    );
    fireEvent.click(getByText(/Generate world/));
    expect(onBuild).toHaveBeenCalledTimes(1);
  });

  it("shows 'Generating world…' + spinner when isCreating=true", () => {
    const { container } = render(
      <PlanPreviewPanel
        {...defaultProps({ canBuild: true, isCreating: true })}
      />,
    );
    expect(container.textContent).toContain("Generating world");
  });

  it("hint text shifts based on slot fill state", () => {
    // 0 slots set, not building yet
    const empty = render(<PlanPreviewPanel {...defaultProps()} />);
    expect(empty.container.textContent).toContain(
      "Tell the agent what you want to build.",
    );

    // 1 slot set but canBuild=false (shouldn't happen in real flow but
    // the gate is independent — pin the messaging anyway)
    const someWithoutCanBuild = render(
      <PlanPreviewPanel
        {...defaultProps({
          plan: { ...createEmptyOnboardingPlan(), pluginIds: ["combat"] },
          canBuild: false,
        })}
      />,
    );
    expect(someWithoutCanBuild.container.textContent).toContain(
      "Fill at least one slot",
    );
  });
});

describe("PlanPreviewPanel — World Detail collapsible", () => {
  it("starts collapsed when no secondary slots are set", () => {
    const { container } = render(<PlanPreviewPanel {...defaultProps()} />);
    // Roads is a secondary slot; its emptyPrompt CTA shouldn't be
    // rendered while the section is collapsed
    expect(container.textContent).not.toContain("Add roads");
  });

  it("auto-expands when at least one secondary slot is set", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      roads: [{ id: "r1", name: "Main Road" }],
    };
    const { container } = render(
      <PlanPreviewPanel {...defaultProps({ plan })} />,
    );
    // With expansion, the roads slot is visible with its entry
    expect(container.textContent).toContain("Main Road");
  });

  it("shows X/14 secondary slot counter", () => {
    const plan = {
      ...createEmptyOnboardingPlan(),
      roads: [{ id: "r1" }],
      mines: [{ id: "m1" }],
    };
    const { container } = render(
      <PlanPreviewPanel {...defaultProps({ plan })} />,
    );
    expect(container.textContent).toContain("2/14");
  });
});
