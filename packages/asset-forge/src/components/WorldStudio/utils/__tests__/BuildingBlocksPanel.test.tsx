/**
 * BuildingBlocksPanel + PluginCard — render + behavior tests.
 *
 * Phase 1.2 fifteenth carve. Covers:
 *   - PluginCard: collapsed/expanded state, contribution count
 *     pluralization, "dev" pill for workspace-source plugins,
 *     "Use" button gating + click propagation, contribution-group
 *     null-skip
 *   - BuildingBlocksPanel: loading skeleton, error state, empty
 *     state, filter behavior, fetch happy path with stubbed
 *     global.fetch
 */

import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import {
  BuildingBlocksPanel,
  PluginCard,
  type PluginRegistryEntry,
} from "../BuildingBlocksPanel";

function makeEntry(
  partial: Partial<PluginRegistryEntry> = {},
): PluginRegistryEntry {
  return {
    id: "@hyperforge/hyperscape",
    npmName: "@hyperforge/hyperscape",
    name: "Hyperscape Plugin",
    version: "1.0.0",
    description: "Combat, skills, prayer.",
    contributions: {
      systems: [],
      entities: [],
      widgets: [],
      manifestSchemas: [],
      paletteCategories: [],
      toolbarTools: [],
      commands: [],
    },
    dependencies: [],
    tags: [],
    source: "node_modules",
    ...partial,
  };
}

describe("PluginCard — collapsed state", () => {
  it("renders name + version", () => {
    const { container } = render(
      <PluginCard
        entry={makeEntry({ name: "Combat", version: "1.2.3" })}
        expanded={false}
        onToggle={() => {}}
        disabled={false}
        onUse={() => {}}
      />,
    );
    expect(container.textContent).toContain("Combat");
    expect(container.textContent).toContain("v1.2.3");
  });

  it("shows 'dev' pill when source is workspace", () => {
    const { container } = render(
      <PluginCard
        entry={makeEntry({ source: "workspace" })}
        expanded={false}
        onToggle={() => {}}
        disabled={false}
        onUse={() => {}}
      />,
    );
    expect(container.textContent?.toLowerCase()).toContain("dev");
  });

  it("does NOT show 'dev' pill when source is node_modules", () => {
    const { container } = render(
      <PluginCard
        entry={makeEntry({ source: "node_modules" })}
        expanded={false}
        onToggle={() => {}}
        disabled={false}
        onUse={() => {}}
      />,
    );
    // The dev pill is the only place "dev" appears as text
    const text = container.textContent ?? "";
    expect(text.toLowerCase().match(/\bdev\b/)).toBeNull();
  });

  it("falls back to id when description is empty", () => {
    const { container } = render(
      <PluginCard
        entry={makeEntry({ description: "", id: "@scope/empty-desc" })}
        expanded={false}
        onToggle={() => {}}
        disabled={false}
        onUse={() => {}}
      />,
    );
    expect(container.textContent).toContain("@scope/empty-desc");
  });

  it("singularizes '1 contribution', pluralizes '2 contributions'", () => {
    const { container: single } = render(
      <PluginCard
        entry={makeEntry({
          contributions: {
            systems: ["solo"],
            entities: [],
            widgets: [],
            manifestSchemas: [],
            paletteCategories: [],
            toolbarTools: [],
            commands: [],
          },
        })}
        expanded={false}
        onToggle={() => {}}
        disabled={false}
        onUse={() => {}}
      />,
    );
    expect(single.textContent).toContain("1 contribution");
    expect(single.textContent).not.toContain("1 contributions");

    const { container: multi } = render(
      <PluginCard
        entry={makeEntry({
          contributions: {
            systems: ["a", "b"],
            entities: [],
            widgets: [],
            manifestSchemas: [],
            paletteCategories: [],
            toolbarTools: [],
            commands: [],
          },
        })}
        expanded={false}
        onToggle={() => {}}
        disabled={false}
        onUse={() => {}}
      />,
    );
    expect(multi.textContent).toContain("2 contributions");
  });

  it("fires onToggle when the header button is clicked", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <PluginCard
        entry={makeEntry()}
        expanded={false}
        onToggle={onToggle}
        disabled={false}
        onUse={() => {}}
      />,
    );
    fireEvent.click(container.querySelector("button")!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("PluginCard — expanded state", () => {
  it("renders contribution groups only when non-empty", () => {
    const { container } = render(
      <PluginCard
        entry={makeEntry({
          contributions: {
            systems: ["sys1", "sys2"],
            entities: [],
            widgets: ["widget1"],
            manifestSchemas: [],
            paletteCategories: [],
            toolbarTools: [],
            commands: [],
          },
        })}
        expanded
        onToggle={() => {}}
        disabled={false}
        onUse={() => {}}
      />,
    );
    expect(container.textContent).toContain("Systems");
    expect(container.textContent).toContain("sys1, sys2");
    expect(container.textContent).toContain("Widgets");
    expect(container.textContent).toContain("widget1");
    expect(container.textContent).not.toContain("Entities");
    expect(container.textContent).not.toContain("Commands");
  });

  it("renders dependency list when entry has deps", () => {
    const { container } = render(
      <PluginCard
        entry={makeEntry({
          dependencies: [
            { id: "@scope/dep-a", versionRange: "^1.0" },
            { id: "@scope/dep-b", versionRange: "^2.0" },
          ],
        })}
        expanded
        onToggle={() => {}}
        disabled={false}
        onUse={() => {}}
      />,
    );
    expect(container.textContent).toContain("Depends on:");
    expect(container.textContent).toContain("@scope/dep-a");
    expect(container.textContent).toContain("@scope/dep-b");
  });

  it("'Use in my world' button fires onUse on click", () => {
    const onUse = vi.fn();
    const { container } = render(
      <PluginCard
        entry={makeEntry()}
        expanded
        onToggle={() => {}}
        disabled={false}
        onUse={onUse}
      />,
    );
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[type='button']"),
    );
    const useBtn = buttons.find((b) =>
      b.textContent?.includes("Use in my world"),
    );
    expect(useBtn).toBeDefined();
    fireEvent.click(useBtn!);
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it("disables the Use button when disabled=true", () => {
    const { container } = render(
      <PluginCard
        entry={makeEntry()}
        expanded
        onToggle={() => {}}
        disabled
        onUse={() => {}}
      />,
    );
    const buttons = container.querySelectorAll("button[type='button']");
    const useBtn = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(useBtn.disabled).toBe(true);
  });
});

describe("BuildingBlocksPanel — fetch lifecycle", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders loading state initially", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as never;
    const { container } = render(
      <BuildingBlocksPanel disabled={false} onUse={() => {}} />,
    );
    expect(container.textContent).toContain("Loading installed plugins");
  });

  it("renders fetched entries after the promise resolves", async () => {
    const entry = makeEntry({ name: "Combat Plugin" });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([entry]),
      } as Response),
    ) as never;

    const { container, findByText } = render(
      <BuildingBlocksPanel disabled={false} onUse={() => {}} />,
    );
    await findByText("Combat Plugin");
    expect(container.textContent).toContain("Combat Plugin");
  });

  it("renders error state on HTTP failure", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 } as Response),
    ) as never;

    const { findByText } = render(
      <BuildingBlocksPanel disabled={false} onUse={() => {}} />,
    );
    await findByText(/HTTP 500/);
  });

  it("renders empty-state message when fetch returns []", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response),
    ) as never;

    const { findByText } = render(
      <BuildingBlocksPanel disabled={false} onUse={() => {}} />,
    );
    await findByText("No installed plugins discovered.");
  });

  it("filters entries by id/name/description/tags", async () => {
    // Distinct descriptions so the "skills" filter only matches b.
    const a = makeEntry({
      id: "@scope/combat",
      name: "Combat",
      description: "Melee gameplay.",
    });
    const b = makeEntry({
      id: "@scope/skills",
      name: "Skills",
      description: "XP progression.",
    });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([a, b]),
      } as Response),
    ) as never;

    const { container, findByText, queryByText } = render(
      <BuildingBlocksPanel disabled={false} onUse={() => {}} />,
    );
    await findByText("Combat");

    const input = container.querySelector(
      "input[type='text']",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "skills" } });

    await waitFor(() => {
      expect(queryByText("Combat")).toBeNull();
      expect(queryByText("Skills")).not.toBeNull();
    });
  });
});
