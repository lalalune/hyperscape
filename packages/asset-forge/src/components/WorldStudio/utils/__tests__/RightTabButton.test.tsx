/**
 * RightTabButton — right-rail tab button render tests.
 *
 * Phase 1.2 fourteenth carve. Pins the active/inactive visual
 * states (underline on active) and the click behavior.
 */

import { fireEvent, render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { RightTabButton } from "../RightTabButton";

describe("RightTabButton", () => {
  it("renders the label", () => {
    const { container } = render(
      <RightTabButton active={false} label="Plan" onClick={() => {}} />,
    );
    expect(container.textContent).toContain("Plan");
  });

  it("renders without the underline span when inactive", () => {
    const { container } = render(
      <RightTabButton active={false} label="Plan" onClick={() => {}} />,
    );
    // The underline span has the bg-gradient-to-r class
    expect(container.querySelector(".bg-gradient-to-r")).toBeNull();
  });

  it("renders the underline span when active", () => {
    const { container } = render(
      <RightTabButton active label="Plan" onClick={() => {}} />,
    );
    expect(container.querySelector(".bg-gradient-to-r")).not.toBeNull();
  });

  it("applies primary text styling when active", () => {
    const { container } = render(
      <RightTabButton active label="Plan" onClick={() => {}} />,
    );
    const button = container.querySelector("button")!;
    expect(button.className).toContain("text-text-primary");
  });

  it("applies muted text styling when inactive", () => {
    const { container } = render(
      <RightTabButton active={false} label="Plan" onClick={() => {}} />,
    );
    const button = container.querySelector("button")!;
    expect(button.className).toContain("text-text-tertiary");
  });

  it("fires onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <RightTabButton active={false} label="Plan" onClick={onClick} />,
    );
    fireEvent.click(container.querySelector("button")!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders as type='button' to avoid form submission", () => {
    const { container } = render(
      <RightTabButton active label="Plan" onClick={() => {}} />,
    );
    expect(container.querySelector("button")?.getAttribute("type")).toBe(
      "button",
    );
  });
});
