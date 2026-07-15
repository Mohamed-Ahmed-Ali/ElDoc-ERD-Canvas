import type { ModelGraph, ModelNode } from "@mc/okf";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Inspector } from "./Inspector";

const node: ModelNode = {
  key: "a",
  title: "Orders",
  inputSource: "SQL",
  schema: [{ name: "id", type: "INTEGER", pk: true }],
  position: { x: 0, y: 0 },
};
const graph: ModelGraph = { storageId: null, nodes: [node], edges: [] };
const noop = () => {};

afterEach(() => vi.restoreAllMocks());

describe("Inspector", () => {
  it("renders the object inspector for a selected node", () => {
    render(
      <Inspector
        open={true}
        onOpenChange={noop}
        selection={{ type: "node", id: "a" }}
        nodes={[node]}
        edges={[]}
        graph={graph}
        onUpdateNode={noop}
        onUpdateEdge={noop}
        onAddComment={noop}
        onResolveComment={noop}
        onDeleteComment={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText(/Details/i)).toBeTruthy();
  });
});
