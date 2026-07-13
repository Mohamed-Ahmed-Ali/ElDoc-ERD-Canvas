import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  useReactFlow,
  Position,
  type EdgeProps,
} from "@xyflow/react";
import type { ModelEdge } from "@mc/okf";
import { useTheme } from "../../state/theme";

export type RelEdgeData = Pick<
  ModelEdge,
  "keys" | "bidirectional" | "direction" | "cardinality" | "lineType" | "color" | "waypoints"
> & {
  userAnimated?: boolean;
  modelEdgeId?: string;
  onUpdateEdge?: (id: string, patch: any) => void;
  /** True for compact-mode edges where all edges share the same node-level port.
   *  In that case crow's-foot markers would pile up at one point, so we skip them. */
  isCompact?: boolean;
};

// ---------------------------------------------------------------------------
// Crow's-foot SVG marker definitions
//
// These are <marker> elements attached to the path via markerStart / markerEnd.
// They are always exactly at the path endpoint — impossible to drift or float.
//
// orient="auto-start-reverse" lets one definition work correctly at both ends:
//   • markerEnd   → marker faces in the path direction
//   • markerStart → rotated 180° automatically
//
// WHY per-edge IDs?  Markers inherit style from their definition, so using a
// single shared definition would cause colour bleed when edges have different
// custom colours.
//
// WHY only for ERD (non-compact) edges?  In ERD mode each edge connects to a
// distinct field handle at a different Y position, so markers naturally spread
// out and never overlap.  In compact mode every edge on the same side shares
// the same handle pixel → markers would pile up → we skip them there.
// ---------------------------------------------------------------------------

interface CrowsFootMarkersProps {
  id: string;
  color: string;
}

function CrowsFootMarkers({ id, color }: CrowsFootMarkersProps) {
  const sw = 1.7;
  return (
    <>
      {/* ── Many end: crow's foot (three splayed lines) + mandatory bar ── */}
      <marker
        id={`cf-many-${id}`}
        viewBox="0 0 20 20"
        refX="17"
        refY="10"
        markerWidth="13"
        markerHeight="13"
        orient="auto-start-reverse"
      >
        {/* Three crow's foot lines, fanning from the entry point outward */}
        <line x1="2" y1="3"  x2="12" y2="10" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <line x1="2" y1="10" x2="16" y2="10" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <line x1="2" y1="17" x2="12" y2="10" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        {/* Mandatory bar — sits closest to the node */}
        <line x1="16" y1="2" x2="16" y2="18" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </marker>

      {/* ── One end: double bar (exactly one, mandatory) ── */}
      <marker
        id={`cf-one-${id}`}
        viewBox="0 0 20 20"
        refX="17"
        refY="10"
        markerWidth="13"
        markerHeight="13"
        orient="auto-start-reverse"
      >
        <line x1="9"  y1="2" x2="9"  y2="18" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <line x1="16" y1="2" x2="16" y2="18" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </marker>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main edge component
// ---------------------------------------------------------------------------

function RelEdgeInner(props: EdgeProps) {
  const activeTheme = useTheme();
  const isTurbo = activeTheme === "turbo";
  const isDark = activeTheme === "dark" || isTurbo;
  const { screenToFlowPosition } = useReactFlow();
  const [dragPointIdx, setDragPointIdx] = useState<number | null>(null);
  const [localWaypoints, setLocalWaypoints] = useState<{ x: number; y: number }[] | null>(null);
  const [lastClick, setLastClick] = useState<{ time: number; idx: number } | null>(null);

  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } =
    props;

  const edgeData = data as unknown as RelEdgeData | undefined;
  const keys = edgeData?.keys ?? [];
  const bidirectional = edgeData?.bidirectional ?? false;
  const cardinality = edgeData?.cardinality?.toUpperCase();
  const lineType = edgeData?.lineType ?? "bezier";
  const userAnimated = edgeData?.userAnimated ?? true;
  const customColor = edgeData?.color;
  const direction = edgeData?.direction || (bidirectional ? "bidirectional" : "unspecified");
  const isCompact = edgeData?.isCompact ?? false;

  const waypoints = localWaypoints ?? edgeData?.waypoints ?? [];
  const pts = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];

  // ── Build multi-segment path ─────────────────────────────────────────────

  let edgePath = "";
  let labelX = 0;
  let labelY = 0;
  const interactionPaths: JSX.Element[] = [];

  const handleSegmentDoubleClick = (idx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newWps = [...waypoints];
    newWps.splice(idx, 0, pos);
    if (edgeData?.modelEdgeId && edgeData.onUpdateEdge)
      edgeData.onUpdateEdge(edgeData.modelEdgeId, { waypoints: newWps });
  };

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];

    let sPos = sourcePosition;
    let tPos = targetPosition;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const isHorizontal = Math.abs(dx) > Math.abs(dy);

    if (i > 0) {
      sPos = isHorizontal
        ? dx > 0 ? Position.Right : Position.Left
        : dy > 0 ? Position.Bottom : Position.Top;
    }
    if (i < pts.length - 2) {
      tPos = isHorizontal
        ? dx > 0 ? Position.Left : Position.Right
        : dy > 0 ? Position.Top : Position.Bottom;
    }

    let segmentPath = "";
    let segLabelX = 0;
    let segLabelY = 0;

    if (lineType === "straight") {
      [segmentPath, segLabelX, segLabelY] = getStraightPath({
        sourceX: p1.x, sourceY: p1.y,
        targetX: p2.x, targetY: p2.y,
      });
    } else if (lineType === "step") {
      [segmentPath, segLabelX, segLabelY] = getSmoothStepPath({
        sourceX: p1.x, sourceY: p1.y, sourcePosition: sPos,
        targetX: p2.x, targetY: p2.y, targetPosition: tPos,
        borderRadius: 0,
      });
    } else {
      [segmentPath, segLabelX, segLabelY] = getBezierPath({
        sourceX: p1.x, sourceY: p1.y, sourcePosition: sPos,
        targetX: p2.x, targetY: p2.y, targetPosition: tPos,
      });
    }

    edgePath += segmentPath + " ";

    // Label anchors to the mathematical centre of the middle segment,
    // returned directly by the React Flow path generator.
    if (i === Math.floor((pts.length - 1) / 2)) {
      labelX = segLabelX;
      labelY = segLabelY;
    }

    interactionPaths.push(
      <path
        key={`seg-${i}`}
        d={segmentPath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onDoubleClick={handleSegmentDoubleClick(i)}
        className="react-flow__edge-interaction"
        style={{ cursor: "crosshair" }}
      />,
    );
  }

  // ── Perpendicular label offset ───────────────────────────────────────────
  // Pushes the key pill off the stroke so it never occludes the line.

  const edgeDx = targetX - sourceX;
  const edgeDy = targetY - sourceY;
  const edgeLen = Math.hypot(edgeDx, edgeDy) || 1;
  const LABEL_OFFSET = 14;
  const perpX = (-edgeDy / edgeLen) * LABEL_OFFSET;
  const perpY = (edgeDx / edgeLen) * LABEL_OFFSET;

  // ── Cardinality markers ──────────────────────────────────────────────────
  // Crow's-foot SVG markers are used in ERD mode (non-compact) because field
  // handles are per-row so each edge has a unique Y → markers fan out naturally.
  // In compact mode all edges share one handle per side → we skip markers.

  const markerColor = selected
    ? "#1e88e5"
    : customColor || (isTurbo ? "#ae53ba" : isDark ? "#64748b" : "#94a3b8");

  let markerStartId: string | undefined;
  let markerEndId: string | undefined;

  if (!isCompact && cardinality) {
    if (cardinality === "1:N") {
      markerStartId = `cf-one-${id}`;
      markerEndId   = `cf-many-${id}`;
    } else if (cardinality === "N:1") {
      markerStartId = `cf-many-${id}`;
      markerEndId   = `cf-one-${id}`;
    } else if (cardinality === "1:1") {
      markerStartId = `cf-one-${id}`;
      markerEndId   = `cf-one-${id}`;
    } else if (cardinality === "N:N") {
      markerStartId = `cf-many-${id}`;
      markerEndId   = `cf-many-${id}`;
    }
  }

  // ── Visual properties ────────────────────────────────────────────────────

  const strokeColor = selected
    ? "#1e88e5"
    : customColor || (isTurbo ? `url(#edge-gradient-${id})` : "var(--edge-stroke)");

  const strokeWidth = selected ? 2 : 1.5;
  const strokeDasharray = userAnimated ? "6 4" : undefined;

  // ── Flow animation ───────────────────────────────────────────────────────

  let shouldFlow = false;
  if (userAnimated) {
    if (direction === "from_to" || direction === "to_from") shouldFlow = true;
    else if (direction === "unspecified" && (cardinality === "1:N" || cardinality === "N:1"))
      shouldFlow = true;
  }

  // ── Center label ─────────────────────────────────────────────────────────

  const label =
    keys.length > 0 ? keys.map((k) => `${k.left || "?"} = ${k.right || "?"}`).join(", ") : "";

  // In compact mode, also show cardinality in the center label since we suppress markers.
  const compactCard = isCompact && cardinality ? cardinality : "";

  // Direction arrow for non-animated edges that don't already have markers
  let midArrow = "";
  if (!userAnimated && (!cardinality || isCompact)) {
    if (direction === "bidirectional") {
      midArrow = "↔";
    } else if (direction === "from_to") {
      midArrow = Math.abs(edgeDx) > Math.abs(edgeDy)
        ? edgeDx > 0 ? "→" : "←"
        : edgeDy > 0 ? "↓" : "↑";
    } else if (direction === "to_from") {
      midArrow = Math.abs(edgeDx) > Math.abs(edgeDy)
        ? edgeDx < 0 ? "→" : "←"
        : edgeDy < 0 ? "↓" : "↑";
    }
  }

  const showLabel = !!(label || midArrow || compactCard);

  const labelBg = isTurbo ? "#1A192B" : isDark ? "#1e293b" : "#ffffff";
  const labelBorder = selected
    ? "#1e88e5"
    : isTurbo ? "#ae53ba" : isDark ? "#334155" : "#d8dee8";
  const labelColor = isTurbo ? "#e2e8f0" : isDark ? "#f1f5f9" : "#0f172a";
  const arrowColor = selected ? "#1e88e5" : isDark ? "#64748b" : "#94a3b8";

  // ── Waypoint handlers ────────────────────────────────────────────────────

  const onPointPointerDown = (idx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();

    const now = Date.now();
    if (lastClick && lastClick.idx === idx && now - lastClick.time < 300) {
      // Double click detected!
      setLastClick(null);
      const newWps = [...waypoints];
      newWps.splice(idx, 1);
      if (edgeData?.modelEdgeId && edgeData.onUpdateEdge) {
        edgeData.onUpdateEdge(edgeData.modelEdgeId, { waypoints: newWps });
      }
      return;
    }
    setLastClick({ time: now, idx });

    (e.target as Element).setPointerCapture(e.pointerId);
    setDragPointIdx(idx);
    setLocalWaypoints(waypoints);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragPointIdx === null || !localWaypoints) return;
    e.stopPropagation();
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newWps = [...localWaypoints];
    newWps[dragPointIdx] = pos;
    setLocalWaypoints(newWps);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragPointIdx !== null && localWaypoints) {
      e.stopPropagation();
      (e.target as Element).releasePointerCapture(e.pointerId);
      setDragPointIdx(null);
      setLocalWaypoints(null);
      
      // Only persist to the store if the user actually dragged the point
      if (localWaypoints !== waypoints && edgeData?.modelEdgeId && edgeData.onUpdateEdge) {
        edgeData.onUpdateEdge(edgeData.modelEdgeId, { waypoints: localWaypoints });
      }
    }
  };


  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <defs>
        {/* Per-edge crow's-foot marker defs — unique ID avoids colour bleed */}
        {markerStartId && <CrowsFootMarkers id={id} color={markerColor} />}

        {isTurbo && (
          <linearGradient id={`edge-gradient-${id}`}>
            <stop offset="0%" stopColor="#ae53ba" />
            <stop offset="100%" stopColor="#2a8af6" />
          </linearGradient>
        )}
      </defs>

      {/* Soft selection glow rendered beneath the stroke */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#1e88e5"
          strokeWidth={10}
          strokeOpacity={0.12}
          strokeLinecap="round"
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: strokeColor, strokeWidth, strokeDasharray }}
        className={shouldFlow ? "react-flow__edge-path" : ""}
        markerStart={markerStartId ? `url(#${markerStartId})` : undefined}
        markerEnd={markerEndId ? `url(#${markerEndId})` : undefined}
      />

      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              // Perpendicular offset keeps the pill off the stroke
              transform: `translate(-50%, -50%) translate(${labelX + perpX}px,${labelY + perpY}px)`,
              pointerEvents: "all",
              background: labelBg,
              border: `1px solid ${labelBorder}`,
              borderRadius: 5,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.01em",
              color: labelColor,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              gap: 5,
              boxShadow: selected
                ? "0 0 0 3px rgba(30,136,229,0.15), 0 2px 6px rgba(0,0,0,0.10)"
                : "0 1px 3px rgba(0,0,0,0.08)",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
            className="nodrag nopan"
          >
            {midArrow && (
              <span style={{ fontSize: 10, color: arrowColor }}>{midArrow}</span>
            )}
            {compactCard && (
              <span style={{ fontSize: 10, fontWeight: 600, color: markerColor }}>{compactCard}</span>
            )}
            {label && <span>{label}</span>}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Transparent hit-area paths for double-click waypoint insertion */}
      {interactionPaths}

      {/* Waypoint handles — only visible when the edge is selected */}
      {selected &&
        waypoints.map((wp, i) => (
          <g key={`wp-${i}`}>
            <circle
              cx={wp.x}
              cy={wp.y}
              r={9}
              fill="transparent"
              style={{ cursor: "grab", pointerEvents: "all" }}
              onPointerDown={onPointPointerDown(i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
            <circle
              cx={wp.x}
              cy={wp.y}
              r={5}
              fill="#1e88e5"
              stroke="white"
              strokeWidth={2}
              style={{ pointerEvents: "none" }}
            />
          </g>
        ))}
    </>
  );
}

export const RelEdge = memo(RelEdgeInner);
