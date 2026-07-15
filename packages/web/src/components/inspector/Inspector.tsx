import { useRef, useState, useCallback, useEffect } from "react";
import { PanelRightOpen } from "lucide-react";
import type { ModelNode, ModelEdge, ModelGraph, CommentEntry } from "@mc/okf";
import { ObjectInspector } from "./ObjectInspector";
import { RelationshipInspector } from "./RelationshipInspector";
import { CommentsPanel } from "./CommentsPanel";

// persist inspector width across reloads so the user doesn't have to re-drag
// every session. Falls back to 320 if localStorage is unavailable.
const WIDTH_KEY = "mc.inspectorWidth.v1";
function loadWidth(): number {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY));
    return n >= 320 ? n : 320;
  } catch {
    return 320;
  }
}
function saveWidth(w: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(w));
  } catch {
    /* private mode */
  }
}

function getJoinFieldType(nodes: ModelNode[], edge: ModelEdge, nodeKey: string): string {
  const otherNodeKey = edge.from === nodeKey ? edge.to : edge.from;
  const otherNode = nodes.find((n) => n.key === otherNodeKey);
  const otherFieldName = edge.from === nodeKey ? edge.keys[0]?.right : edge.keys[0]?.left;
  const otherField = otherNode?.schema.find((f) => f.name === otherFieldName);
  return otherField?.type ?? "STRING";
}

type Selection = { type: "node"; id: string } | { type: "edge"; id: string } | null;

interface InspectorProps {
  selection: Selection;
  nodes: ModelNode[];
  edges: ModelEdge[];
  graph: ModelGraph;
  onUpdateNode: (key: string, patch: Partial<ModelNode>) => void;
  onUpdateEdge: (id: string, patch: Partial<ModelEdge>) => void;
  onAddComment: (entry: Omit<CommentEntry, "id" | "createdAt">) => void;
  onResolveComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
  onClose: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_WIDTH = 320;

function EmptyState() {
  return (
    <div className="px-6 py-[46px] text-center text-slate-500 text-[13px] leading-[1.6]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        width={42}
        height={42}
        className="mx-auto mb-3 opacity-35"
      >
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="4" width="7" height="6" rx="1.5" />
        <rect x="9" y="14" width="7" height="6" rx="1.5" />
      </svg>
      <div>
        Select an object or relationship to edit.
        <br />
        <br />
        Changes here are automatically saved to your model.
      </div>
    </div>
  );
}

export function Inspector({
  selection,
  nodes,
  edges,
  graph,
  onUpdateNode,
  onUpdateEdge,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  onClose,
  open,
  onOpenChange,
}: InspectorProps) {
  const [width, setWidth] = useState(loadWidth);
  const drawerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const selectedNode =
    selection?.type === "node" ? nodes.find((n) => n.key === selection.id) : undefined;
  const selectedEdge =
    selection?.type === "edge" ? edges.find((e) => e.id === selection.id) : undefined;

  const title = selectedNode
    ? selectedNode.title.trim() || "Untitled"
    : selectedEdge
      ? "Relationship"
      : "Inspector";

  // open comment count badge in the header
  const openCommentCount = selection
    ? (graph.comments ?? []).filter((c) => c.anchorId === selection.id && !c.resolved).length
    : 0;

  // ── Resize — PointerEvent + setPointerCapture so dragging outside the window
  // (e.g. to the left edge of a second monitor) doesn't orphan the drag state.
  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  const onResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizingRef.current) return;
    const delta = startXRef.current - e.clientX;
    const newWidth = Math.min(
      window.innerWidth * 0.5,
      Math.max(MIN_WIDTH, startWidthRef.current + delta),
    );
    setWidth(newWidth);
  }, []);

  const onResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // persist the chosen width so next reload picks it up.
      saveWidth(width);
    },
    [width],
  );

  // also persist on unmount in case the user resizes then closes the inspector
  // without releasing the pointer (edge case but cheap to handle).
  useEffect(() => {
    return () => {
      saveWidth(width);
    };
  }, [width]);

  return (
    <div
      ref={drawerRef}
      className="bg-white border-l border-[#d8dee8] flex-shrink-0 flex flex-col z-10 shadow-[-4px_0_16px_rgba(15,23,42,0.04)] relative transition-[width,border-color] duration-300 ease-in-out"
      style={{
        width: open ? width : 0,
        minWidth: open ? MIN_WIDTH : 0,
        overflow: "hidden",
        borderLeft: open ? "1px solid var(--border-panel)" : "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
      }}
    >
      {/* Resize handle — PointerEvent-based so capture survives leaving the window */}
      {open && (
        <div
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          className="absolute left-0 top-0 w-[7px] h-full cursor-col-resize z-[18] group"
          title="Drag to resize"
        >
          <div className="absolute left-[2px] top-0 w-[2px] h-full bg-transparent group-hover:bg-[#1e88e5] transition-colors" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 bg-white border border-[#d8dee8] rounded-md shadow-sm flex flex-col justify-center items-center gap-[2px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="w-1.5 h-[2px] bg-slate-400 rounded-full" />
            <span className="w-1.5 h-[2px] bg-slate-400 rounded-full" />
            <span className="w-1.5 h-[2px] bg-slate-400 rounded-full" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-[14px] border-b border-[#d8dee8] flex items-center gap-2 flex-shrink-0">
        <h3 className="text-[13.5px] font-[650] flex-1 text-slate-900">{title}</h3>
        {openCommentCount > 0 && (
          <span
            title={`${openCommentCount} open comment${openCommentCount > 1 ? "s" : ""}`}
            className="text-[10.5px] font-semibold bg-[#1e88e5] text-white rounded-full px-[6px] py-[1px]"
          >
            {openCommentCount}
          </span>
        )}
        <button
          onClick={() => {
            onClose();
            onOpenChange(false);
          }}
          title="Close inspector"
          className="cursor-pointer text-slate-500 border-none bg-none text-[18px] leading-none hover:text-slate-900 transition-colors p-0 bg-transparent"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-4 overflow-y-auto flex-1 min-h-0">
        {selectedNode ? (
          <>
            <ObjectInspector
              node={selectedNode}
              nodes={nodes}
              tags={graph.tags}
              onUpdate={(patch) => onUpdateNode(selectedNode.key, patch)}
            />
            <CommentsPanel
              anchorType="node"
              anchorId={selectedNode.key}
              graph={graph}
              onAdd={onAddComment}
              onResolve={onResolveComment}
              onDelete={onDeleteComment}
            />
          </>
        ) : selectedEdge ? (
          <>
            <RelationshipInspector
              edge={selectedEdge}
              fromNode={nodes.find((n) => n.key === selectedEdge.from)}
              toNode={nodes.find((n) => n.key === selectedEdge.to)}
              onUpdate={(patch) => onUpdateEdge(selectedEdge.id, patch)}
              onEnsureField={(nodeKey, fieldName) => {
                const node = nodes.find((n) => n.key === nodeKey);
                if (!node || !fieldName || node.schema.some((f) => f.name === fieldName)) return;
                // match the type of the field on the other side of the join so a key
                // pointing at an INTEGER PK isn't created as STRING.
                const type = getJoinFieldType(nodes, selectedEdge, nodeKey);
                onUpdateNode(nodeKey, {
                  schema: [...node.schema, { name: fieldName, type, pk: false }],
                });
              }}
            />
            <CommentsPanel
              anchorType="edge"
              anchorId={selectedEdge.id}
              graph={graph}
              onAdd={onAddComment}
              onResolve={onResolveComment}
              onDelete={onDeleteComment}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
