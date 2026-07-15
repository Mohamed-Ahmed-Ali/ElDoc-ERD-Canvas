import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dock } from "./Dock";

describe("Dock", () => {
  it("fires onClear when the Clear canvas button is clicked", () => {
    const onClear = vi.fn();
    render(
      <Dock
        activeTool="select"
        onToolChange={() => {}}
        viewMode="compact"
        onToggleView={() => {}}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Clear canvas/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
