import type { ModelEdge, ModelNode } from "@mc/okf";
import type { Edge } from "@xyflow/react";
import type { ViewMode } from "../../state/viewMode";
import { erdAwareNodeSize } from "./layoutSize";

type Side = "left" | "right";

// pick the horizontal side each end of an edge attaches to.
//
// a handle the user explicitly chose (stored on the edge from a manual drag)
// always wins, so their choice is preserved. Otherwise the side is derived from
// the nodes' relative position: each end exits *toward* the other node — the
// shortest route, no loop-around. The SAME rule runs in compact and ERD mode, so
// the side never jumps when toggling views (imported/template edges carry no
// stored handle, which is exactly the case that used to disagree between modes).
// a hub's edges naturally split across both sides because each one faces its own
// neighbour.
function getAbsoluteX(node: ModelNode, byKey: Map<string, ModelNode>): number {
  let x = node.position.x;
  let current = node;
  while (current.parentId) {
    const parent = byKey.get(current.parentId);
    if (!parent) break;
    x += parent.position.x;
    current = parent;
  }
  return x;
}

// pick the horizontal side each end of an edge attaches to.
// derived from the nodes' absolute relative position: each end exits *toward*
// the other node — the shortest route, no loop-around.
// We ignore stored handles for horizontal direction so it dynamically updates when nodes move.
function edgeSides(
  src: ModelNode | undefined,
  tgt: ModelNode | undefined,
  viewMode: ViewMode,
  byKey: Map<string, ModelNode>,
): { source: Side; target: Side } {
  let source: Side = "right";
  let target: Side = "left";
  if (src && tgt) {
    const sx = getAbsoluteX(src, byKey) + erdAwareNodeSize(src, viewMode).width / 2;
    const tx = getAbsoluteX(tgt, byKey) + erdAwareNodeSize(tgt, viewMode).width / 2;
    if (tx < sx) {
      source = "left";
      target = "right";
    }
  }
  return { source, target };
}

function compactEdge(
  e: ModelEdge,
  sides: { source: Side; target: Side },
  onUpdateEdge?: (id: string, patch: any) => void,
): Edge {
  const direction = e.direction || (e.bidirectional ? "bidirectional" : "unspecified");
  const card = e.cardinality?.toUpperCase();
  const userAnimated = e.animated ?? true;

  let shouldFlow = false;
  let isReverse = false;
  if (direction === "from_to") {
    shouldFlow = true;
    isReverse = false;
  } else if (direction === "to_from") {
    shouldFlow = true;
    isReverse = true;
  } else if (direction === "unspecified") {
    if (card === "1:N") {
      shouldFlow = true;
      isReverse = false;
    } else if (card === "N:1") {
      shouldFlow = true;
      isReverse = true;
    }
  }

  const animated = userAnimated && shouldFlow;
  const className = isReverse ? "animated-reverse" : undefined;

  return {
    id: e.id,
    source: e.from,
    target: e.to,
    sourceHandle: sides.source,
    targetHandle: sides.target,
    type: "rel",
    className,
    data: {
      keys: e.keys,
      bidirectional: e.bidirectional,
      direction: e.direction,
      waypoints: e.waypoints,
      cardinality: e.cardinality,
      lineType: e.lineType,
      color: e.color,
      modelEdgeId: e.id,
      userAnimated,
      onUpdateEdge,
      // Compact edges all share the same side handle (left / right) so crow's-foot
      // SVG markers would pile up at a single point.  ERD field handles are per-row
      // and naturally fan out, so markers are safe there.
      isCompact: true,
    } as unknown as Record<string, unknown>,
  };
}

// reconnect (dragging an edge end to another port) is scoped to the SELECTED
// relationship only. Otherwise, when several edges share a node handle their
// reconnect anchors overlap and React Flow grabs whichever is topmost — not the
// one the user picked. ERD view is display-only, so reconnect is off there.
export function isEdgeReconnectable(
  modelEdgeId: string | undefined,
  selectedEdgeId: string | null,
  viewMode: ViewMode,
): boolean {
  return viewMode !== "logical" && modelEdgeId != null && modelEdgeId === selectedEdgeId;
}

export function buildRfEdges(
  edges: ModelEdge[],
  nodes: ModelNode[],
  viewMode: ViewMode,
  onUpdateEdge?: (id: string, patch: any) => void,
): Edge[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));

  if (viewMode === "compact") {
    return edges.map((e) =>
      compactEdge(e, edgeSides(byKey.get(e.from), byKey.get(e.to), viewMode, byKey), onUpdateEdge),
    );
  }

  const fieldsByKey = new Map<string, Set<string>>(
    nodes.map((n) => [n.key, new Set(n.schema.map((f) => f.name))]),
  );

  return edges.flatMap((e) => {
    const sides = edgeSides(byKey.get(e.from), byKey.get(e.to), viewMode, byKey);
    const usable = e.keys.filter((k) => k.left || k.right);
    if (usable.length === 0) return [compactEdge(e, sides)];

    const srcFields = fieldsByKey.get(e.from);
    const tgtFields = fieldsByKey.get(e.to);
    // move the anchor vertically onto the field row, keeping the side chosen
    // above. fr:<field> = right edge of the row, fl:<field> = left edge.
    const srcSide = sides.source === "left" ? "fl" : "fr";
    const tgtSide = sides.target === "left" ? "fl" : "fr";

    const k = usable[0];
    const direction = e.direction || (e.bidirectional ? "bidirectional" : "unspecified");
    const card = e.cardinality?.toUpperCase();
    const userAnimated = e.animated ?? true;

    let shouldFlow = false;
    let isReverse = false;
    if (direction === "from_to") {
      shouldFlow = true;
      isReverse = false;
    } else if (direction === "to_from") {
      shouldFlow = true;
      isReverse = true;
    } else if (direction === "unspecified") {
      if (card === "1:N") {
        shouldFlow = true;
        isReverse = false;
      } else if (card === "N:1") {
        shouldFlow = true;
        isReverse = true;
      }
    }

    const animated = userAnimated && shouldFlow;
    const className = isReverse ? "animated-reverse" : undefined;

    return [
      {
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: k.left && srcFields?.has(k.left) ? `${srcSide}:${k.left}` : sides.source,
        targetHandle: k.right && tgtFields?.has(k.right) ? `${tgtSide}:${k.right}` : sides.target,
        type: "rel",
        animated,
        className,
        data: {
          keys: e.keys,
          bidirectional: e.bidirectional,
          direction: e.direction,
          waypoints: e.waypoints,
          cardinality: e.cardinality,
          lineType: e.lineType,
          color: e.color,
          modelEdgeId: e.id,
          userAnimated,
          onUpdateEdge,
        } as unknown as Record<string, unknown>,
      },
    ];
  });
}
